const { setTimeout: sleep } = require('node:timers/promises')

// Only locally defined phase names may enter logs; never serialize errors.
const sessionFailureStage = error => ['API_PREFLIGHT','BROWSER_LAUNCH','BROWSER_CONTEXT','SESSION_REFRESH'].includes(error?.stage) ? error.stage : undefined

function workerArguments(argv,env){
  const options=[...argv],index=options.indexOf('--application-id')
  let applicationId
  if(index!==-1){
    applicationId=options[index+1]
    require('zod').z.string().uuid().parse(applicationId)
    options.splice(index,2)
    if(!options.includes('--once')||options.some(value=>['--check','--setup-sheets','--session-only','--application-id'].includes(value))||
      env.DAECHION_ACCEPTANCE_TEST_ONLY!=='true'||env.DAECHION_ACCEPTANCE_APPLICATION_ID!==applicationId||
      !/^[a-f0-9]{64}$/.test(env.DAECHION_ACCEPTANCE_SNAPSHOT_FINGERPRINT??''))throw Error('ACCEPTANCE_TARGET_REQUIRED')
    acceptanceLectures(env)
  }
  if(options.some(value=>!['--check','--once','--setup-sheets','--session-only','--reconcile-sheets'].includes(value)))throw Error('INVALID_WORKER_ARGUMENT')
  if(options.includes('--reconcile-sheets')&&!applicationId)throw Error('ACCEPTANCE_TARGET_REQUIRED')
  if(env.DAECHION_ACCEPTANCE_TEST_ONLY==='true'&&!applicationId&&!options.includes('--check')&&!options.includes('--session-only'))throw Error('ACCEPTANCE_TARGET_REQUIRED')
  return {options,applicationId}
}
function acceptanceLectures(env){
  let ids
  try{ids=JSON.parse(env.DAECHION_ACCEPTANCE_LECTURE_IDS??'')}catch{throw Error('ACCEPTANCE_TARGET_REQUIRED')}
  if(!Array.isArray(ids)||!ids.length||ids.length>30||ids.some(id=>!Number.isSafeInteger(id)||id<=0)||new Set(ids).size!==ids.length)throw Error('ACCEPTANCE_TARGET_REQUIRED')
  return ids
}
async function checkAcceptanceTarget(applicationId,env,withClient){
  workerArguments(['--once','--application-id',applicationId],env)
  const {applicationSnapshotSchema}=require('../../.daechion-worker-build/lib/daechion/ledger.js')
  const {createHash}=require('node:crypto')
  await withClient(async client=>{
    const target=(await client.query('SELECT request_fingerprint,product_id,submission FROM daechion_automation.applications WHERE id=$1',[applicationId])).rows[0]
    if(!target||target.request_fingerprint!==env.DAECHION_ACCEPTANCE_SNAPSHOT_FINGERPRINT||target.submission?.purchaseProcess!=='PROCESS_2'||
      ['12course','chuweol'].includes(target.product_id))throw Error('ACCEPTANCE_TARGET_MISMATCH')
    const snapshot=applicationSnapshotSchema.parse(target.submission),lectureIds=acceptanceLectures(env)
    const actual=(await client.query('SELECT lecture_id FROM daechion_automation.registrations WHERE application_id=$1 ORDER BY lecture_id',[applicationId])).rows.map(row=>Number(row.lecture_id))
    const fingerprint=createHash('sha256').update(JSON.stringify({snapshot,lectureIds})).digest('hex')
    if(snapshot.productId!==target.product_id||fingerprint!==target.request_fingerprint||JSON.stringify(actual)!==JSON.stringify([...lectureIds].sort((a,b)=>a-b)))throw Error('ACCEPTANCE_TARGET_MISMATCH')
  })
}

function runtime(env,{withClient,providers={}}={}) {
  const { withAutomationClient:databaseClient } = require('../../.daechion-worker-build/lib/daechion/database.js')
  const withAutomationClient=withClient??databaseClient
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
    if(providers.payment)return providers.payment
    if(!provider)provider=payssamBillingProvider({apiKey:env.PAYSSAM_API_KEY,member:env.PAYSSAM_MEMBER,
      merchant:env.PAYSSAM_MERCHANT,callbackUrl:env.DAECHION_BILLING_CALLBACK_URL})
    return provider
  }
  let daechion, tenantChecked = false,sessionRefreshAt=0
  let messageProvider
  function readyMessageProvider(){
    if(providers.message)return providers.message
    if(!messageProvider)messageProvider=solapiReadyProvider({apiKey:env.SOLAPI_API_KEY,apiSecret:env.SOLAPI_API_SECRET,sender:env.SOLAPI_SENDER})
    return messageProvider
  }
  const diagnosticsEnabled=env.DAECHION_DIAGNOSTICS_SHEETS_ENABLED==='true'
  const {recordOperation,operationRows}=require('../../.daechion-worker-build/lib/daechion/operations.js')
  const {publishOperations}=require('../../.daechion-worker-build/lib/daechion/operations-sheet.js')
  let diagnosticStorageFailed=false
  async function observe(phase,applicationId,ok,code){
    if(!diagnosticsEnabled)return
    try{await withAutomationClient(client=>recordOperation(client,{phase,applicationId,ok,code}));}
    catch{diagnosticStorageFailed=true}
  }
  async function observeSelected(phase,id,ok,code){
    await observe(phase,id,ok,code)
    if(ok&&id)await observe(phase,undefined,true)
  }
  let sheetApi, sheetTarget
  function sheetRuntime() {
    if(sheetApi&&sheetTarget)return {sheetApi,sheetTarget}
    if(env.DAECHION_SHEETS_ENABLED!=='true'&&!diagnosticsEnabled)throw Error('NEW_SHEET_CONFIGURATION_REQUIRED')
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
    if(providers.daechion){daechion=providers.daechion;return daechion}
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
    try{
      const result=await browserProvider().refreshSession(id)
      await observe('sessionRefresh',undefined,result?.refreshed===true)
      return result
    }catch(error){await observe('sessionRefresh',undefined,false,sessionFailureStage(error));throw error}
  }
  return {
    maintainSession,
    async syncDiagnostics(){
      if(!diagnosticsEnabled)return {enabled:false}
      try{
        const {sheetApi,sheetTarget}=sheetRuntime()
        // This projection-only path is independent of financial switches.
        for(let i=0;i<5;i++){
          let selected
          try{
            const result=await syncOneApplication({onApplication:id=>{selected=id},api:sheetApi,target:sheetTarget,withClient:withAutomationClient})
            if(result==='SKIPPED')break
            await observeSelected('sheets',selected,result==='DONE',result==='DEFERRED'?'DEFERRED':'UNKNOWN')
          }catch{await observe('sheets',selected,false);break}
        }
        const issues=await withAutomationClient(client=>operationRows(client))
        if(diagnosticStorageFailed)issues.unshift({scope:'WORKER',phase:'diagnostics',state:'OPEN',code:'기록 저장 확인 필요',occurrences:'1',first_failed_at:new Date(),last_failed_at:new Date(),resolved_at:null})
        await publishOperations(sheetApi,sheetTarget,issues)
        await observe('diagnostics',undefined,true)
        return {enabled:true,updated:true,storageFailed:diagnosticStorageFailed}
      }catch{await observe('diagnostics',undefined,false);return {enabled:true,updated:false,storageFailed:diagnosticStorageFailed}}
    },
    async reconcileSheets(applicationId){
      await checkAcceptanceTarget(applicationId,env,withAutomationClient)
      const {sheetApi,sheetTarget}=sheetRuntime()
      return syncOneApplication({applicationId,reconcileUnknown:true,api:sheetApi,target:sheetTarget,withClient:withAutomationClient})
    },
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
    async cycle(sendEnabled, { paymentsEnabled = false, enrollmentEnabled = false, sheetsEnabled = false,readyMessagesEnabled=false,applicationId } = {}) {
      if(applicationId!==undefined||env.DAECHION_ACCEPTANCE_TEST_ONLY==='true'){
        // Validate the immutable snapshot before constructing any external provider.
        await checkAcceptanceTarget(applicationId,env,withAutomationClient)
      }
      // Actual API QA showed enrollment can succeed without existing file access.
      // Never announce readiness until this external prerequisite is verified.
      if ((enrollmentEnabled || readyMessagesEnabled) && env.DAECHION_ACCESS_POLICY_VERIFIED !== 'true') throw Error('ACCESS_POLICY_VERIFICATION_REQUIRED')
      const outcomes = { sent: 0, unknown: 0, skipped: 0, failed: 0, checked: 0, enrolled: 0, review: 0, sheets:0,messages:0,deferred:0 }
      const failed = (phase,error) => {
        outcomes.failed++
        outcomes.failurePhases ??= {}
        outcomes.failurePhases[phase] = (outcomes.failurePhases[phase] ?? 0) + 1
        const stage = phase === 'sessionRefresh' ? sessionFailureStage(error) : undefined
        if(stage) outcomes.sessionFailureStage = stage
      }
      const provider=(sendEnabled||paymentsEnabled)?paymentProvider():undefined
      if (enrollmentEnabled && !tenantChecked) {
        if (String((await enrollmentProvider().me()).tenantId) !== env.DAECHION_TENANT_ID.trim()) throw Error('DAECHION_TENANT_MISMATCH')
        tenantChecked = true
      }
      if(enrollmentEnabled&&Date.now()>=sessionRefreshAt){
        try{await maintainSession();sessionRefreshAt=Date.now()+15*60*1000}
        catch(error){failed('sessionRefresh',error);sessionRefreshAt=Date.now()+60000}
      }
      const ids = sendEnabled ? await withAutomationClient(async client => {
        const result = await client.query(`SELECT a.id FROM daechion_automation.applications a
          WHERE a.payment_state='PENDING' AND a.automation_state='ACTIVE'
          AND ($1::uuid IS NULL OR a.id=$1)
          AND a.product_id NOT IN ('12course','chuweol') AND a.submission->>'purchaseProcess'='PROCESS_2'
          AND EXISTS(SELECT 1 FROM daechion_automation.registrations r WHERE r.application_id=a.id)
          AND (NOT EXISTS(SELECT 1 FROM daechion_automation.bills b WHERE b.application_id=a.id)
            OR EXISTS(SELECT 1 FROM daechion_automation.bills b WHERE b.application_id=a.id AND b.is_current AND b.state='RESERVED'))
          ORDER BY a.created_at,a.id LIMIT 5`,[applicationId??null])
        return result.rows.map(row => row.id)
      }) : []
      for (const id of ids) {
        try {
          const result = await sendApplicationBill(id, true, { provider, withClient: withAutomationClient })
          if(['SENT','UNKNOWN'].includes(result.outcome))await observe('billing',id,result.outcome==='SENT',result.outcome==='UNKNOWN'?'UNKNOWN':undefined)
          if (result.outcome === 'SENT') outcomes.sent++
          else if (result.outcome === 'UNKNOWN') outcomes.unknown++
          else outcomes.skipped++
        } catch(error) { failed('billing',error);await observe('billing',id,false) }
      }
      if (paymentsEnabled) {
        const payments = await withAutomationClient(async client => (await client.query(`SELECT a.id FROM daechion_automation.applications a
          JOIN daechion_automation.bills b ON b.application_id=a.id AND b.is_current
          WHERE b.state IN ('SENT','SEND_UNKNOWN') AND b.provider_account=$1
          AND ($2::uuid IS NULL OR a.id=$2)
          ORDER BY b.checked_at NULLS FIRST,a.created_at,a.id LIMIT 5`, [provider.accountId,applicationId??null])).rows)
        for (const row of payments) {
          try {
            const result = await checkApplicationPayment(row.id, { provider, withClient: withAutomationClient })
            if(result!=='SKIPPED'&&result!=='STALE')await observe('paymentRead',row.id,result!=='UNKNOWN',result==='UNKNOWN'?'UNKNOWN':undefined)
            outcomes.checked++; if (result === 'UNKNOWN') outcomes.unknown++
          }
          catch(error) { failed('paymentRead',error);await observe('paymentRead',row.id,false) }
        }
      }
      if (enrollmentEnabled) {
        const applications = await withAutomationClient(async client => (await client.query(`SELECT a.id FROM daechion_automation.applications a
          WHERE a.payment_state='PAID' AND a.automation_state='ACTIVE' AND a.review_code IS NULL
          AND ($1::uuid IS NULL OR a.id=$1)
          AND EXISTS(SELECT 1 FROM daechion_automation.registrations r WHERE r.application_id=a.id AND
            (r.state='PENDING' OR (r.state='RUNNING' AND r.lease_until<=now())))
          ORDER BY a.updated_at,a.id LIMIT 5`,[applicationId??null])).rows)
        for (const row of applications) {
          try {
            const result = await enrollApplication(row.id, true, { daechion,tenantId:env.DAECHION_TENANT_ID.trim(), withClient: withAutomationClient })
            if(['DONE','REVIEW'].includes(result))await observe('enrollment',row.id,result==='DONE',result==='REVIEW'?'UNKNOWN':undefined)
            if (result === 'DONE') outcomes.enrolled++
            else if (result === 'REVIEW') outcomes.review++
            else outcomes.skipped++
          } catch(error) { failed('enrollment',error);await observe('enrollment',row.id,false) }
        }
      }
      if(readyMessagesEnabled){
        const messageProvider=readyMessageProvider()
        for(let i=0;i<5;i++){
          let selected=applicationId
          try{
            const result=await sendOneReadyMessage({applicationId,onApplication:id=>{selected=id},provider:messageProvider,withClient:withAutomationClient})
            if(result==='SKIPPED')break
            await observeSelected('readyMessage',selected,result==='SENT',result==='UNKNOWN'?'UNKNOWN':undefined)
            if(result==='SENT')outcomes.messages++;else outcomes.unknown++
          }catch(error){failed('readyMessage',error);await observe('readyMessage',selected,false);break}
        }
      }
      if(sheetsEnabled) {
        const {sheetApi,sheetTarget}=sheetRuntime()
        for(let i=0;i<5;i++) {
          let selected=applicationId
          try {
            const result=await syncOneApplication({applicationId,onApplication:id=>{selected=id},api:sheetApi,target:sheetTarget,withClient:withAutomationClient})
            if(result==='SKIPPED')break
            await observeSelected('sheets',selected,result==='DONE',result==='DEFERRED'?'DEFERRED':'UNKNOWN')
            if(result==='DONE')outcomes.sheets++;else if(result==='DEFERRED')outcomes.deferred++;else outcomes.unknown++
          }catch(error){failed('sheets',error);await observe('sheets',selected,false);break}
        }
      }
      return outcomes
    },
  }
}

async function main({ argv = process.argv.slice(2), env = process.env, makeRuntime = runtime,
  write = value => console.log(JSON.stringify(value)) } = {}) {
  const parsed=workerArguments(argv,env)
  argv=parsed.options
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
  if(argv.includes('--reconcile-sheets')){
    const result=await service.reconcileSheets(parsed.applicationId)
    write({sheetReconciliation:true,result,sending:false});return
  }
  if(argv.includes('--session-only')){
    if(env.DAECHION_SESSION_MAINTENANCE_ENABLED!=='true')throw Error('SESSION_MAINTENANCE_DISABLED')
    const controller=new AbortController()
    let stopping=false
    const stop=()=>{stopping=true;controller.abort()}
    process.once('SIGTERM',stop);process.once('SIGINT',stop)
    try{
      do{
        let refreshed=false, failureStage
        try{refreshed=(await service.maintainSession())?.refreshed===true}catch(error){failureStage=sessionFailureStage(error)}
        const diagnostics=env.DAECHION_DIAGNOSTICS_SHEETS_ENABLED==='true'?await service.syncDiagnostics():undefined
        write({sessionMaintenance:true,refreshed,sending:false,...(failureStage?{failureStage}:{}),...(diagnostics?{diagnostics}:{})})
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
        ...(parsed.applicationId?{applicationId:parsed.applicationId}:{}),
      }), sending: sendEnabled })
      if(env.DAECHION_DIAGNOSTICS_SHEETS_ENABLED==='true')write({diagnostics:await service.syncDiagnostics()})
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
module.exports = { main, runtime,workerArguments,checkAcceptanceTarget }
