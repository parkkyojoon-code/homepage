const built = name => require('../../.daechion-worker-build/lib/daechion/' + name + '.js')

function argumentsFor(argv, env) {
  if (!argv.length || argv.length === 1 && argv[0] === '--check') return { command: 'check' }
  if (argv.length === 1 && argv[0] === '--setup-sheets' && env.DAECHION_ORDER_WORKER_ENABLED === 'true' && env.DAECHION_ORDER_SHEETS_ENABLED === 'true') return { command: 'setup' }
  if (argv.length === 3 && argv[0] === '--once' && argv[1] === '--order-id' &&
    require('zod').z.string().uuid().safeParse(argv[2]).success && env.DAECHION_ORDER_WORKER_ENABLED === 'true' &&
    env.DAECHION_ORDER_ACCEPTANCE_ID === argv[2] && /^[a-f0-9]{64}$/.test(env.DAECHION_ORDER_ACCEPTANCE_FINGERPRINT ?? '')) {
    return { command: 'once', id: argv[2] }
  }
  throw Error('ORDER_WORKER_ARGUMENTS_REJECTED')
}
function runtime(env, overrides = {}) {
  // Snapshot switches once, never change a phase halfway through a cycle.
  env = { ...env }
  const flags = built('orders/runner').orderWorkerSettings(env)
  const deliveryFlags = built('orders/delivery').orderDeliverySettings(env)
  if (flags.enroll && !flags.read) throw Error('ORDER_ENROLLMENT_REQUIRES_PAYMENT_READ')
  if ((flags.send || flags.enroll) && env.DAECHION_IDENTITY_LOOKUP_VERIFIED !== 'true') throw Error('ORDER_IDENTITY_LOOKUP_NOT_VERIFIED')
  if ((flags.enroll || deliveryFlags.message) && env.DAECHION_ACCESS_POLICY_VERIFIED !== 'true') throw Error('ORDER_ACCESS_POLICY_NOT_VERIFIED')
  const withClient = overrides.withClient ?? built('database').withAutomationClient
  const providers = overrides.providers ?? {}
  let api, payment, daechion, message, sheet
  function apiProvider() {
    if (!env.DAECHION_TENANT_ID?.trim() || !env.DAECHION_API_KEY) throw Error('ORDER_TENANT_CONFIGURATION_REQUIRED')
    return api ??= providers.api ?? built('client').daechionClient({ apiKey: env.DAECHION_API_KEY })
  }
  function paymentProvider() {
    return payment ??= providers.payment ?? built('payssam').payssamBillingProvider({ apiKey: env.PAYSSAM_API_KEY,
      member: env.PAYSSAM_MEMBER, merchant: env.PAYSSAM_MERCHANT, callbackUrl: env.DAECHION_BILLING_CALLBACK_URL })
  }
  function enrollmentProvider() {
    if (daechion) return daechion
    if (providers.daechion) return daechion = providers.daechion
    const official = apiProvider()
    const sessions = require('./browser/session-store.cjs').browserSessionStore(env, withClient)
    return daechion = { ...official, ...require('./browser/provider.cjs').browserAccessProvider(env, official, { sessions }) }
  }
  function messageProvider() {
    return message ??= providers.message ?? built('ready-message').solapiReadyProvider({ apiKey: env.SOLAPI_API_KEY,
      apiSecret: env.SOLAPI_API_SECRET, sender: env.SOLAPI_SENDER })
  }
  function sheetProvider() {
    if (sheet) return sheet
    const target = built('orders/delivery').orderSheetTarget(env)
    built('orders/sheets-publisher').validateOrderSheetTarget(target)
    return sheet = { api: providers.sheets ?? built('google-sheets').googleSheetsApi(env.GOOGLE_SERVICE_ACCOUNT_JSON ?? ''), target }
  }
  async function check() {
    await withClient(async client => {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
      try {
        if (overrides.checkSchemas) await overrides.checkSchemas(client)
        else {
          const old = require('../../scripts/daechion-migrations.cjs')
          if ((await old.status(client)).pending.length) throw Error('ORDER_LEGACY_SCHEMA_NOT_READY')
          await old.checkSchema(client)
          await require('../../scripts/daechion-order-migrations.cjs').checkReady(client)
        }
        await client.query('COMMIT')
      } catch (error) { await client.query('ROLLBACK'); throw error }
    })
    return { schemaChecked: true, active: Object.values({ ...flags, ...deliveryFlags }).some(Boolean) }
  }
  async function once(id) {
    argumentsFor(['--once', '--order-id', id], env)
    if (!Object.values({ ...flags, ...deliveryFlags }).some(Boolean)) throw Error('ORDER_WORKER_PHASES_DISABLED')
    // No external factory, lookup or mutation before the exact order is bound.
    await withClient(async client => {
      const row = (await client.query('SELECT request_fingerprint,tenant_id FROM daechion_orders.orders WHERE id=$1', [id])).rows[0]
      if (!row || row.request_fingerprint !== env.DAECHION_ORDER_ACCEPTANCE_FINGERPRINT || row.tenant_id !== env.DAECHION_TENANT_ID?.trim()) throw Error('ORDER_ACCEPTANCE_TARGET_MISMATCH')
    })
    if (flags.send && (env.DAECHION_ORDERS_SUBJECT_SECRET?.length ?? 0) < 32) throw Error('ORDER_SUBJECT_SECRET_REQUIRED')
    // Validate every enabled provider before the first irreversible phase.
    const provider = flags.send || flags.read || deliveryFlags.message ? paymentProvider() : undefined
    const official = flags.send ? apiProvider() : undefined
    const enrollment = flags.enroll ? enrollmentProvider() : undefined
    const ready = deliveryFlags.message ? messageProvider() : undefined
    const sheets = deliveryFlags.sheets ? sheetProvider() : undefined
    let processingFailed = false, deliveryFailed = false
    try {
      await (overrides.processOrder ?? built('orders/runner').processOrder)(id, flags, {
        withClient, provider, daechion: enrollment, tenantId: env.DAECHION_TENANT_ID.trim(),
        preflight: context => built('orders/preflight').preflightOrder(context, {
          tenantId: env.DAECHION_TENANT_ID.trim(), subjectSecret: env.DAECHION_ORDERS_SUBJECT_SECRET, api: official,
          manualReview: context => withClient(client => built('orders/manual-review').latestReview(client, context.orderId)) }),
      })
    } catch {
      processingFailed = true
      // Record only our own bounded code; provider exceptions can contain secrets.
      try {
        const store = built('orders/worker-store')
        await withClient(client => store.orderTransaction(client, async () => {
          if (await store.lockOrder(client, id)) await store.holdOrder(client, id, 'worker_execution_unknown')
        }))
      } catch { /* A database outage cannot be reported through that same database. */ }
    }
    // Sheets can still publish the recorded review state if business processing failed.
    // Do not announce completion after an unclassified processing failure.
    try {
      const delivered = await (overrides.deliverOrder ?? built('orders/delivery').deliverOrder)(id,
        { ...deliveryFlags, message: deliveryFlags.message && !processingFailed },
        { withClient, payment: provider, message: ready, api: sheets?.api, target: sheets?.target })
      deliveryFailed = delivered?.message === 'UNKNOWN' || delivered?.sheets === 'UNKNOWN'
    } catch { deliveryFailed = true }
    return { processed: true, processingFailed, deliveryFailed }
  }
  return { check, once, async setupSheets() {
    argumentsFor(['--setup-sheets'], env)
    const { api, target } = sheetProvider()
    await built('orders/sheets-publisher').setupOrderSheet(api, target)
    return { sheetPrepared: true }
  } }
}
async function main({ argv = process.argv.slice(2), env = process.env, makeRuntime = runtime, write = value => console.log(JSON.stringify(value)) } = {}) {
  const options = argumentsFor(argv, env), service = makeRuntime(env)
  const checked = await service.check()
  if (options.command === 'check') return write(checked)
  const result = options.command === 'once' ? await service.once(options.id) : await service.setupSheets()
  write(result)
  if (result?.processingFailed || result?.deliveryFailed) throw Error('ORDER_WORKER_PHASE_FAILED')
}
if (require.main === module) main().catch(() => { console.error('DAECHION_ORDER_WORKER_FAILED'); process.exitCode = 1 })
module.exports = { argumentsFor, runtime, main }
