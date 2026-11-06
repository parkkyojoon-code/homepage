const { setTimeout: sleep } = require('node:timers/promises')

function runtime(env) {
  const { withAutomationClient } = require('../../.daechion-worker-build/lib/daechion/database.js')
  const { sendApplicationBill } = require('../../.daechion-worker-build/lib/daechion/billing.js')
  const { payssamBillingProvider } = require('../../.daechion-worker-build/lib/daechion/payssam.js')
  const { checkApplicationPayment } = require('../../.daechion-worker-build/lib/daechion/payment.js')
  const { enrollApplication } = require('../../.daechion-worker-build/lib/daechion/enrollment.js')
  const { syncOneApplication } = require('../../.daechion-worker-build/lib/daechion/sheets-worker.js')
  const { setupApplicationSheet } = require('../../.daechion-worker-build/lib/daechion/sheets-publisher.js')
  const { sendOneReadyMessage,solapiReadyProvider } = require('../../.daechion-worker-build/lib/daechion/ready-message.js')
  const migrations = require('../../scripts/daechion-migrations.cjs')
  const provider = payssamBillingProvider({ apiKey: env.PAYSSAM_API_KEY, member: env.PAYSSAM_MEMBER,
    merchant: env.PAYSSAM_MERCHANT, callbackUrl: env.DAECHION_BILLING_CALLBACK_URL })
  let daechion, tenantChecked = false
  let messageProvider
  if(env.DAECHION_READY_MESSAGE_ENABLED==='true')messageProvider=solapiReadyProvider({apiKey:env.SOLAPI_API_KEY,apiSecret:env.SOLAPI_API_SECRET,sender:env.SOLAPI_SENDER})
  let sheetApi, sheetTarget
  if(env.DAECHION_SHEETS_ENABLED==='true') {
    const {googleSheetsApi}=require('../../.daechion-worker-build/lib/daechion/google-sheets.js')
    const {sheetsDestination}=require('../../.daechion-worker-build/lib/daechion/sheets-view.js')
    sheetsDestination(env.DAECHION_SHEETS_SPREADSHEET_ID,env.GOOGLE_SHEET_ID)
    if(!/^\d+$/.test(env.DAECHION_SHEETS_SHEET_ID??''))throw Error('NEW_SHEET_TAB_REQUIRED')
    sheetTarget={spreadsheetId:env.DAECHION_SHEETS_SPREADSHEET_ID,legacySpreadsheetId:env.GOOGLE_SHEET_ID,sheetId:Number(env.DAECHION_SHEETS_SHEET_ID)}
    sheetApi=googleSheetsApi(env.GOOGLE_SERVICE_ACCOUNT_JSON??'')
  }
  if (env.DAECHION_ENROLLMENT_ENABLED === 'true') {
    if (env.DAECHION_PAYMENT_READ_ENABLED !== 'true') throw Error('PAYMENT_READ_REQUIRED_FOR_ENROLLMENT')
    if (env.DAECHION_IDENTITY_LOOKUP_VERIFIED !== 'true') throw Error('IDENTITY_LOOKUP_VERIFICATION_REQUIRED')
    if (!env.DAECHION_API_KEY || !env.DAECHION_TENANT_ID?.trim()) throw Error('DAECHION_TENANT_CONFIGURATION_REQUIRED')
    const { daechionClient } = require('../../.daechion-worker-build/lib/daechion/client.js')
    daechion = daechionClient({ apiKey: env.DAECHION_API_KEY })
  }
  return {
    async check() {
      await withAutomationClient(async client => {
        const state = await migrations.status(client)
        if (!state.tracked || state.pending.length) throw Error('AUTOMATION_SCHEMA_NOT_READY')
        await migrations.checkSchema(client)
      })
    },
    async setupSheets() {
      if(!sheetApi||!sheetTarget)throw Error('NEW_SHEET_CONFIGURATION_REQUIRED')
      await setupApplicationSheet(sheetApi,sheetTarget)
    },
    async cycle(sendEnabled, { paymentsEnabled = false, enrollmentEnabled = false, sheetsEnabled = false,readyMessagesEnabled=false } = {}) {
      const outcomes = { sent: 0, unknown: 0, skipped: 0, failed: 0, checked: 0, enrolled: 0, review: 0, sheets:0,messages:0 }
      if (enrollmentEnabled && !tenantChecked) {
        if (!daechion || String((await daechion.me()).tenantId) !== env.DAECHION_TENANT_ID.trim()) throw Error('DAECHION_TENANT_MISMATCH')
        tenantChecked = true
      }
      const ids = sendEnabled ? await withAutomationClient(async client => {
        const result = await client.query(`SELECT a.id FROM daechion_automation.applications a
          WHERE a.payment_state='PENDING' AND a.automation_state='ACTIVE'
          AND a.product_id NOT IN ('12course','chuweol') AND a.submission->>'purchaseProcess'='PROCESS_2'
          AND EXISTS(SELECT 1 FROM daechion_automation.registrations r WHERE r.application_id=a.id)
          AND (NOT EXISTS(SELECT 1 FROM daechion_automation.bills b WHERE b.application_id=a.id)
            OR EXISTS(SELECT 1 FROM daechion_automation.bills b WHERE b.application_id=a.id AND b.is_current AND b.state='RESERVED'))
          ORDER BY a.created_at,a.id LIMIT 5`)
        return result.rows.map(row => row.id)
      }) : []
      for (const id of ids) {
        try {
          const result = await sendApplicationBill(id, true, { provider, withClient: withAutomationClient })
          if (result.outcome === 'SENT') outcomes.sent++
          else if (result.outcome === 'UNKNOWN') outcomes.unknown++
          else outcomes.skipped++
        } catch { outcomes.failed++ }
      }
      if (paymentsEnabled) {
        const payments = await withAutomationClient(async client => (await client.query(`SELECT a.id FROM daechion_automation.applications a
          JOIN daechion_automation.bills b ON b.application_id=a.id AND b.is_current
          WHERE b.state IN ('SENT','SEND_UNKNOWN') AND b.provider_account=$1
          ORDER BY b.checked_at NULLS FIRST,a.created_at,a.id LIMIT 5`, [provider.accountId])).rows)
        for (const row of payments) {
          try {
            const result = await checkApplicationPayment(row.id, { provider, withClient: withAutomationClient })
            outcomes.checked++; if (result === 'UNKNOWN') outcomes.unknown++
          }
          catch { outcomes.failed++ }
        }
      }
      if (enrollmentEnabled) {
        const applications = await withAutomationClient(async client => (await client.query(`SELECT a.id FROM daechion_automation.applications a
          WHERE a.payment_state='PAID' AND a.automation_state='ACTIVE' AND a.review_code IS NULL
          AND EXISTS(SELECT 1 FROM daechion_automation.registrations r WHERE r.application_id=a.id AND
            (r.state='PENDING' OR (r.state='RUNNING' AND r.lease_until<=now())))
          ORDER BY a.updated_at,a.id LIMIT 5`)).rows)
        for (const row of applications) {
          try {
            const result = await enrollApplication(row.id, true, { daechion, withClient: withAutomationClient })
            if (result === 'DONE') outcomes.enrolled++
            else if (result === 'REVIEW') outcomes.review++
            else outcomes.skipped++
          } catch { outcomes.failed++ }
        }
      }
      if(readyMessagesEnabled){
        if(!messageProvider)throw Error('READY_MESSAGE_CONFIGURATION_REQUIRED')
        for(let i=0;i<5;i++){
          try{const result=await sendOneReadyMessage({provider:messageProvider,withClient:withAutomationClient});if(result==='SKIPPED')break;if(result==='SENT')outcomes.messages++;else outcomes.unknown++}catch{outcomes.failed++;break}
        }
      }
      if(sheetsEnabled) {
        if(!sheetApi||!sheetTarget)throw Error('NEW_SHEET_CONFIGURATION_REQUIRED')
        for(let i=0;i<5;i++) {
          try {
            const result=await syncOneApplication({api:sheetApi,target:sheetTarget,withClient:withAutomationClient})
            if(result==='SKIPPED')break
            if(result==='DONE')outcomes.sheets++;else outcomes.unknown++
          }catch{outcomes.failed++;break}
        }
      }
      return outcomes
    },
  }
}

async function main({ argv = process.argv.slice(2), env = process.env, makeRuntime = runtime,
  write = value => console.log(JSON.stringify(value)) } = {}) {
  if (argv.some(value => !['--check', '--once','--setup-sheets'].includes(value))) throw Error('INVALID_WORKER_ARGUMENT')
  if (env.DAECHION_BILLING_WORKER_ENABLED !== 'true') {
    if (argv.includes('--check')) throw Error('DAECHION_BILLING_WORKER_DISABLED')
    write({ enabled: false }); return
  }
  const service = makeRuntime(env)
  const sendEnabled = env.DAECHION_BILLING_SEND_ENABLED === 'true'
  // check always takes precedence, even if --once and send-enabled are also supplied.
  if (argv.includes('--check')) {
    await service.check(); write({ ready: true, schema: 'daechion_automation', sending: false }); return
  }
  await service.check()
  if(argv.includes('--setup-sheets')) {await service.setupSheets();write({sheetInitialized:true});return}
  let stopping = false
  const stop = () => { stopping = true }
  process.once('SIGTERM', stop); process.once('SIGINT', stop)
  try {
    do {
      write({ ...await service.cycle(sendEnabled, {
        paymentsEnabled: env.DAECHION_PAYMENT_READ_ENABLED === 'true',
        enrollmentEnabled: env.DAECHION_ENROLLMENT_ENABLED === 'true',
        sheetsEnabled: env.DAECHION_SHEETS_ENABLED === 'true',
        readyMessagesEnabled:env.DAECHION_READY_MESSAGE_ENABLED==='true',
      }), sending: sendEnabled })
      if (argv.includes('--once') || stopping) break
      await sleep(30000)
    } while (!stopping)
  } finally {
    process.removeListener('SIGTERM', stop); process.removeListener('SIGINT', stop)
  }
}

if (require.main === module) main().then(() => process.exit(0)).catch(() => {
  // No connection strings, applicant IDs/phones, provider bodies or credentials.
  console.error('DAECHION_BILLING_WORKER_FAILED'); process.exit(1)
})
module.exports = { main }
