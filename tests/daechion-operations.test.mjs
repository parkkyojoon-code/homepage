import {test} from 'node:test'
import assert from 'node:assert/strict'
import {PGlite} from '@electric-sql/pglite'
import migrations from '../scripts/daechion-migrations.cjs'
import operations from '../.daechion-test-build/lib/daechion/operations.js'
import publisher from '../.daechion-test-build/lib/daechion/operations-sheet.js'
import ledger from '../.daechion-test-build/lib/daechion/ledger.js'
import sheetsWorker from '../.daechion-test-build/lib/daechion/sheets-worker.js'
import sheetsView from '../.daechion-test-build/lib/daechion/sheets-view.js'
import worker from '../workers/daechion/billing.cjs'

const target={spreadsheetId:'new-operations-sheet-123456789',legacySpreadsheetId:'legacy-sheet-never-write-123456789',sheetId:0}
function fakeApi(){
  const writes=[],owned={properties:{sheetId:611061501,title:'자동화 점검'},developerMetadata:[{metadataKey:'pkjmath_operations_v1',metadataValue:'1'}]}
  const main={properties:{sheetId:0,title:'신청 목록'},developerMetadata:[{metadataKey:'pkjmath_process2_sheet_v1',metadataValue:'1'}]}
  const sheets=[main]
  return {writes,sheets,async call(method,path,body){
    assert.ok(!path.includes(target.legacySpreadsheetId))
    if(method==='GET')return {sheets}
    assert.equal(path,`/spreadsheets/${target.spreadsheetId}:batchUpdate`)
    writes.push(body)
    if(body.requests.some(r=>r.addSheet))sheets.push(owned)
    return {spreadsheetId:target.spreadsheetId,replies:body.requests.map(()=>({}))}
  }}
}

test('durable per-application diagnostics preserve business states, privacy, recovery and unknown writes',async()=>{
  const db=new PGlite(),client={query:(sql,values)=>db.query(sql,values)}
  try{
    for(const migration of migrations.loadMigrations())await db.exec(migration.body)
    const snapshot={studentHistory:'NEW',productId:'diagnostic-fixture',productTitle:'격리 검수',tuitionWon:900,textbookWon:0,totalWon:900,
      studentName:'가상학생',guardianName:'',studentPhone:'01000000001',payerPhone:'01000000001',guardianPhone:'',applicantType:'STUDENT',mode:'ONLINE',campus:'',selectedSubjects:[],additionalInputs:[],confirmPayment:true,agreePrivacy:true,noticeVersion:'fixture'}
    const {id}=await ledger.createApplication(client,crypto.randomUUID(),snapshot,[{productId:snapshot.productId,lectureIds:[10]}],'PROCESS_2')
    const initial=(await db.query('SELECT payment_state,automation_state,notification_state FROM daechion_automation.applications WHERE id=$1',[id])).rows[0]
    await operations.recordOperation(client,{phase:'enrollment',applicationId:id,ok:false})
    await operations.recordOperation(client,{phase:'enrollment',applicationId:id,ok:false})
    const issue=(await operations.operationRows(client))[0]
    assert.equal(issue.scope,id);assert.equal(issue.occurrences,'2');assert.equal(issue.state,'OPEN')
    assert.equal((await db.query('SELECT count(*)::int AS n FROM daechion_automation.outbox WHERE application_id=$1',[id])).rows[0].n,2)
    let job=await sheetsWorker.claimSheetJob(client,id)
    assert.match(sheetsView.applicationSheetRow(job.view)[32],/오류 확인 필요: 수강 등록/)
    await sheetsWorker.finishSheetJob(client,job,true)
    await operations.recordOperation(client,{phase:'enrollment',applicationId:id,ok:true})
    assert.equal((await operations.operationRows(client))[0].state,'RESOLVED')
    job=await sheetsWorker.claimSheetJob(client,id)
    assert.match(sheetsView.applicationSheetRow(job.view)[32],/복구 확인: 수강 등록/)
    await sheetsWorker.finishSheetJob(client,job,false)
    assert.ok((await operations.operationRows(client)).some(r=>r.scope===id&&r.phase==='sheets'&&r.state==='OPEN'))
    assert.match((await operations.operationSummary(client,id)).join('\n'),/신청 목록 반영/)
    assert.deepEqual((await db.query('SELECT payment_state,automation_state,notification_state FROM daechion_automation.applications WHERE id=$1',[id])).rows[0],initial)
    await assert.rejects(operations.recordOperation(client,{phase:'enrollment',applicationId:id,ok:false,code:'private cookie 01012345678'}))
    await operations.recordOperation(client,{phase:'sessionRefresh',ok:false,code:'SESSION_REFRESH'})
    assert.ok((await operations.operationRows(client)).some(r=>r.scope==='WORKER'&&r.state==='OPEN'))
    await operations.recordOperation(client,{phase:'sessionRefresh',ok:true})
    assert.equal((await operations.operationRows(client)).find(r=>r.scope==='WORKER').state,'RESOLVED')
    // A successful retry, not merely running another cycle, clears an issue.
    const env={DAECHION_DIAGNOSTICS_SHEETS_ENABLED:'true',DAECHION_API_KEY:'fixture-only',DAECHION_TENANT_ID:'fixture',DAECHION_BROWSER_CHECK_LECTURE_ID:'10'}
    let failure=true
    const runtime=worker.runtime(env,{withClient:run=>run(client),providers:{daechion:{refreshSession:async()=>{if(failure)throw Object.assign(Error('secret cookie'),{stage:'BROWSER_CONTEXT'});return {refreshed:true}}}}})
    await assert.rejects(runtime.maintainSession())
    assert.equal((await operations.operationRows(client)).find(r=>r.scope==='WORKER').code,'BROWSER_CONTEXT')
    failure=false;await runtime.maintainSession()
    assert.equal((await operations.operationRows(client)).find(r=>r.scope==='WORKER').state,'RESOLVED')
  }finally{await db.close()}
})

test('operations tab is idempotent, scoped and preserves application rows and staff notes',async()=>{
  const api=fakeApi(),now=new Date('2026-11-07T13:00:00Z')
  const issues=[{scope:'WORKER',phase:'sessionRefresh',state:'OPEN',code:'SESSION_REFRESH',occurrences:'2',first_failed_at:now,last_failed_at:now}]
  await publisher.publishOperations(api,target,issues,now)
  await publisher.publishOperations(api,target,[{...issues[0],state:'RESOLVED',resolved_at:now}],now)
  assert.equal(api.writes.filter(w=>w.requests.some(r=>r.addSheet)).length,1)
  for(const write of api.writes)for(const request of write.requests){
    if(request.updateCells)assert.equal(request.updateCells.range.sheetId,611061501)
  }
  assert.match(JSON.stringify(api.writes),/확인 필요/);assert.match(JSON.stringify(api.writes),/복구 확인/)
  assert.match(JSON.stringify(api.writes),/2026-11-07 22:00:00/)
  assert.match(JSON.stringify(api.writes),/30분/)
  assert.ok(api.writes[0].requests.some(r=>r.addConditionalFormatRule?.rule.ranges[0].sheetId===0))
  const conflict=fakeApi();conflict.sheets.push({properties:{sheetId:99,title:'자동화 점검'}})
  await assert.rejects(publisher.publishOperations(conflict,target,issues),/OPERATIONS_TAB_CONFLICT/)
  assert.equal(conflict.writes.length,0)
  await assert.rejects(publisher.publishOperations(fakeApi(),{...target,spreadsheetId:target.legacySpreadsheetId},issues))
  const unowned=fakeApi();unowned.sheets[0].developerMetadata=[]
  await assert.rejects(publisher.publishOperations(unowned,target,issues),/NEW_SHEET_NOT_INITIALIZED/)
  assert.equal(unowned.writes.length,0)
})

test('session-only Sheets diagnostics remain separate from every financial action',async()=>{
  const calls=[],output=[]
  await worker.main({argv:['--session-only','--once'],env:{DAECHION_BILLING_WORKER_ENABLED:'true',DAECHION_SESSION_MAINTENANCE_ENABLED:'true',DAECHION_DIAGNOSTICS_SHEETS_ENABLED:'true'},
    makeRuntime:()=>({check:async()=>{},maintainSession:async()=>{calls.push('session');throw Object.assign(Error('private'),{stage:'SESSION_REFRESH'})},syncDiagnostics:async()=>{calls.push('projection');return {enabled:true,updated:true}},cycle:async()=>{throw Error('financial action forbidden')}}),write:value=>output.push(value)})
  assert.deepEqual(calls,['session','projection']);assert.equal(output[0].sending,false);assert.equal(output[0].diagnostics.updated,true)
  assert.ok(!JSON.stringify(output).includes('private'))
})
