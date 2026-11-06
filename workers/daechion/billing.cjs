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
  let provider
  function paymentProvider() {
    if(!provider)provider=payssamBillingProvider({apiKey:env.PAYSSAM_API_KEY,member:env.PAYSSAM_MEMBER,
      merchant:env.PAYSSAM_MERCHANT,callbackUrl:env.DAECHION_BILLING_CALLBACK_URL})
    return provider
  }
  let daechion, tenantChecked = false,sessionRefreshAt=0
  let messageProvider
  function readyMessageProvider(){
    if(!messageProvider)messageProvider=solapiReadyProvider({apiKey:env.SOLAPI_API_KEY,apiSecret:env.SOLAPI_API_SECRET,sender:env.SOLAPI_SENDER})
    return messageProvider
  }
  let sheetApi, sheetTarget
  function sheetRuntime() {
    if(sheetApi&&sheetTarget)return {sheetApi,sheetTarget}
    if(env.DAECHION_SHEETS_ENABLED!=='true')throw Error('NEW_SHEET_CONFIGURATION_REQUIRED')
    const {googleSheetsApi}=require('../../.daechion-worker-build/lib/daechion/google-sheets.js')
    const {sheetsDestination}=require('../../.daechion-worker-build/lib/daechion/sheets-view.js')
    sheetsDestination(env.DAECHION_SHEETS_SPREADSHEET_ID,env.GOOGLE_SHEET_ID)
    if(!/^\d+$/.test(env.DAECHION_SHEETS_SHEET_ID??''))throw Error('NEW_SHEET_TAB_REQUIRED')
    sheetTarget={spreadsheetId:env.DAECHION_SHEETS_SPREADSHEET_ID,legacySpreadsheetId:env.GOOGLE_SHEET_ID,sheetId:Number(env.DAECHION_SHEETS_SHEET_ID)}
    sheetApi=googleSheetsApi(env.GOOGLE_SERVICE_ACCOUNT_JSON??'')
    return {sheetApi,sheetTarget}
  }
  function browserProvider() {
    if(daechion)return daechion
    if (!env.DAECHION_API_KEY || !env.DAECHION_TENANT_ID?.trim()) throw Error('DAECHION_TENANT_CONFIGURATION_REQUIRED')
    const { daechionClient } = require('../../.daechion-worker-build/lib/daechion/client.js')
    const api = daechionClient({ apiKey: env.DAECHION_API_KEY })
    const {browserAccessProvider}=require('./browser/provider.cjs')
    const {browserSessionStore}=require('./browser/session-store.cjs')
    const sessions=browserSessionStore(env,withAutomationClient)
    daechion = {...api,...browserAccessProvider(env,api,{sessions})}
    return daechion
  }
  function enrollmentProvider(){
    if (env.DAECHION_PAYMENT_READ_ENABLED !== 'true') throw Error('PAYMENT_READ_REQUIRED_FOR_ENROLLMENT')
    if (env.DAECHION_IDENTITY_LOOKUP_VERIFIED !== 'true') throw Error('IDENTITY_LOOKUP_VERIFICATION_REQUIRED')
    return browserProvider()
  }
  async function maintainSession(){
    const id=Number(env.DAECHION_BROWSER_CHECK_LECTURE_ID??env.DAECHION_CONTENT_TEST_LECTURE_ID)
    if(!Number.isSafeInteger(id)||id<=0)throw Error('CONTENT_SESSION_CHECK_TARGET_REQUIRED')
    return browserProvider().refreshSession(id)
  }
  return {
    maintainSession,
    async check() {
      await withAutomationClient(async client => {
        const state = await migrations.status(client)
        if (!state.tracked || state.pending.length) throw Error('AUTOMATION_SCHEMA_NOT_READY')
        await migrations.checkSchema(client)
      })
    },
    async setupSheets() {
      const sheet=sheetRuntime()
      await setupApplicationSheet(sheet.sheetApi,sheet.sheetTarget)
    },
    async cycle(sendEnabled, { paymentsEnabled = false, enrollmentEnabled = false, sheetsEnabled = false,readyMessagesEnabled=false } = {}) {
      // Actual API QA showed enrollment can succeed without existing file access.
      // Never announce readiness until this external prerequisite is verified.
      if ((enrollmentEnabled || readyMessagesEnabled) && env.DAECHION_ACCESS_POLICY_VERIFIED !== 'true') throw Error('ACCESS_POLICY_VERIFICATION_REQUIRED')
      const outcomes = { sent: 0, unknown: 0, skipped: 0, failed: 0, checked: 0, enrolled: 0, review: 0, sheets:0,messages:0,deferred:0 }
      const provider=(sendEnabled||paymentsEnabled)?paymentProvider():undefined
      if (enrollmentEnabled && !tenantChecked) {
        if (String((await enrollmentProvider().me()).tenantId) !== env.DAECHION_TENANT_ID.trim()) throw Error('DAECHION_TENANT_MISMATCH')
        tenantChecked = true
      }
      if(enrollmentEnabled&&Date.now()>=sessionRefreshAt){
        try{await maintainSession();sessionRefreshAt=Date.now()+15*60*1000}
        catch{outcomes.failed++;sessionRefreshAt=Date.now()+60000}
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
            const result = await enrollApplication(row.id, true, { daechion,tenantId:env.DAECHION_TENANT_ID.trim(), withClient: withAutomationClient })
            if (result === 'DONE') outcomes.enrolled++
            else if (result === 'REVIEW') outcomes.review++
            else outcomes.skipped++
          } catch { outcomes.failed++ }
        }
      }
      if(readyMessagesEnabled){
        const messageProvider=readyMessageProvider()
        for(let i=0;i<5;i++){
          try{const result=await sendOneReadyMessage({provider:messageProvider,withClient:withAutomationClient});if(result==='SKIPPED')break;if(result==='SENT')outcomes.messages++;else outcomes.unknown++}catch{outcomes.failed++;break}
        }
      }
      if(sheetsEnabled) {
        const {sheetApi,sheetTarget}=sheetRuntime()
        for(let i=0;i<5;i++) {
          try {
            const result=await syncOneApplication({api:sheetApi,target:sheetTarget,withClient:withAutomationClient})
            if(result==='SKIPPED')break
            if(result==='DONE')outcomes.sheets++;else if(result==='DEFERRED')outcomes.deferred++;else outcomes.unknown++
          }catch{outcomes.failed++;break}
        }
      }
      return outcomes
    },
  }
}

async function main({ argv = process.argv.slice(2), env = process.env, makeRuntime = runtime,
  write = value => console.log(JSON.stringify(value)) } = {}) {
  if (argv.some(value => !['--check', '--once','--setup-sheets','--session-only'].includes(value))) throw Error('INVALID_WORKER_ARGUMENT')
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
  if(argv.includes('--session-only')){
    if(env.DAECHION_SESSION_MAINTENANCE_ENABLED!=='true')throw Error('SESSION_MAINTENANCE_DISABLED')
    const controller=new AbortController()
    let stopping=false
    const stop=()=>{stopping=true;controller.abort()}
    process.once('SIGTERM',stop);process.once('SIGINT',stop)
    try{
      do{
        let refreshed=false
        try{refreshed=(await service.maintainSession())?.refreshed===true}catch{}
        write({sessionMaintenance:true,refreshed,sending:false})
        if(argv.includes('--once')||stopping)break
        try{await sleep(refreshed?900000:60000,undefined,{signal:controller.signal})}catch{if(!stopping)throw Error('SESSION_MAINTENANCE_WAIT_FAILED')}
      }while(!stopping)
    }finally{process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop)}
    return
  }
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

if (require.main === module) main().then(() => process.exit(0)).catch(error => {
  // No connection strings, applicant IDs/phones, provider bodies or credentials.
  const safe = /^(?:ACCESS_POLICY_VERIFICATION_REQUIRED|SHEETS_HTTP_(?:400|401|403|404|409|429|500|502|503|504)|SHEETS_CREDENTIALS_REQUIRED|SHEETS_REQUEST_UNCONFIRMED|NEW_SHEET_(?:CONFIGURATION_REQUIRED|TAB_REQUIRED|TAB_NOT_FOUND|TAB_NOT_EMPTY|HEADERS_CHANGED)|SHEET_SETUP_UNCONFIRMED|INVALID_SHEET_METADATA|INVALID_NEW_SHEET_TARGET)$/.test(error?.message??'') ? error.message : undefined
  console.error('DAECHION_BILLING_WORKER_FAILED' + (safe ? ':' + safe : '')); process.exit(1)
})
module.exports = { main, runtime }
