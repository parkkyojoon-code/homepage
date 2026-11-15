import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,readdirSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {PGlite} from '@electric-sql/pglite'
import checkout from '../.daechion-test-build/lib/daechion/orders/checkout.js'
import sheets from '../.daechion-test-build/lib/daechion/orders/sheets-worker.js'
import recovery from '../.daechion-test-build/lib/daechion/orders/sheet-recovery.js'
import admin from '../.daechion-test-build/lib/daechion/orders/admin.js'
import view from '../.daechion-test-build/lib/daechion/orders/sheets-view.js'

const target={spreadsheetId:'order-retry-fixture-only',legacySpreadsheetId:'original-sheet-fixture-only',sheetId:2,
  singleIntake:{spreadsheetId:'order-retry-fixture-only',sheetId:7}}
const migration=name=>readFileSync(new URL('../db/'+name,import.meta.url),'utf8')
async function database(legacy=false){
  const db=new PGlite();let tail=Promise.resolve()
  const port={query:(sql,args)=>db.query(sql,args),exec:sql=>db.exec(sql),close:()=>db.close(),
    withClient:run=>{const next=tail.then(()=>run(db));tail=next.catch(()=>{});return next}}
  await port.exec(migration('daechion/001_initial.sql'))
  await port.exec(migration('daechion-orders/001_initial.sql'))
  await port.exec(migration('daechion/002_identity.sql'))
  await port.exec(migration('daechion/006_operations.sql'))
  for(const name of readdirSync(new URL('../db/daechion-orders/',import.meta.url)).sort()){
    if(!/^\d+.*\.sql$/.test(name)||name.startsWith('001_')||legacy&&Number(name.slice(0,3))>10)continue
    await port.exec(migration('daechion-orders/'+name))
  }
  return port
}
let sequence=0
async function order(db){
  const person={studentName:'복구 검증',studentPhone:`0100010${String(++sequence).padStart(4,'0')}`,guardianName:'',guardianPhone:'',
    payerPhone:'01000009999',applicantType:'STUDENT',studentHistory:'NEW',agreePrivacy:true,confirmPayment:true}
  const product={productId:'retry',title:'복구 강의',saleKind:'SINGLE',priceWon:1000,tenantId:'fixture',revision:'r1',purchaseProcess:'PROCESS_2',visible:true,lectures:[{id:10,name:'강의'}]}
  const ports={tenantId:'fixture',subjectSecret:'s'.repeat(32),catalog:async()=>[product],withClient:db.withClient,
    ownership:async(cart,_contact,key)=>({cartFingerprint:cart.fingerprint,subjectKey:key,checkedAt:new Date().toISOString(),identity:'PASSED',lectures:[{id:10,state:'NOT_OWNED'}]})}
  const quote=await checkout.quoteCheckout({items:[{productId:'retry'}],contact:person,expectedTotalWon:1000},ports)
  const received=await checkout.receiveOrder({quoteId:quote.quoteId,quoteToken:quote.quoteToken,requestKey:randomUUID(),expectedTotalWon:1000},ports)
  const job=(await db.query("SELECT id FROM daechion_orders.jobs WHERE order_id=$1 AND kind='SHEETS'",[received.orderId])).rows[0]
  return {id:received.orderId,jobId:String(job.id)}
}
const state=(db,jobId)=>db.query('SELECT * FROM daechion_orders.jobs WHERE id=$1',[jobId]).then(r=>r.rows[0])
const due=(db,jobId)=>db.query('UPDATE daechion_orders.jobs SET available_at=now() WHERE id=$1',[jobId])
const expire=(db,jobId)=>db.query("UPDATE daechion_orders.jobs SET lease_until=now()-interval '1 second' WHERE id=$1",[jobId])
function sheet(db,jobId){
  const data={row:null,memo:'직원 원문 메모',inserts:0,updates:0,readFailures:0,readError:'SHEETS_HTTP_503',beforeRead:null,
    crashBeforeWrite:false,crashAfterWrite:false,metadataId:45,headers:[...view.ORDER_HEADERS,'직원 메모']}
  const api={call:async(method,path,body)=>{
    assert.ok(path.startsWith('/spreadsheets/'+target.spreadsheetId))
    const write=method!=='GET'&&!path.endsWith('/developerMetadata:search')&&!path.endsWith('/values:batchGetByDataFilter')
    if(write){
      const saved=await state(db,jobId)
      assert.equal(saved.state,'RUNNING');assert.equal(saved.sheet_write_started,true)
      assert.equal(saved.sheet_read_token,saved.lease_token)
      if(data.crashBeforeWrite)throw Error('SHEETS_REQUEST_UNCONFIRMED')
    }else{
      if(data.beforeRead){const callback=data.beforeRead;data.beforeRead=null;await callback()}
      if(data.readFailures>0){data.readFailures--;throw Error(data.readError)}
    }
    if(path.endsWith('/developerMetadata:search')){
      const lookup=body.dataFilters[0].developerMetadataLookup
      assert.deepEqual(lookup.metadataLocation,{sheetId:target.sheetId})
      if(lookup.metadataKey==='pkjmath_order_sheet_v1')return {matchedDeveloperMetadata:[{developerMetadata:{metadataId:1,location:{sheetId:target.sheetId}}}]}
      assert.equal(lookup.metadataKey,'pkjmath_order_id')
      return data.row?{matchedDeveloperMetadata:[{developerMetadata:{metadataId:data.metadataId,
        location:{dimensionRange:{sheetId:target.sheetId,dimension:'ROWS',startIndex:1,endIndex:2}}}}]}:{}
    }
    if(method==='GET'&&path.includes('?fields='))return {sheets:[{properties:{sheetId:target.sheetId,title:'주문 전용',gridProperties:{columnCount:50}}}]}
    if(method==='GET')return {values:[data.headers]}
    if(path.endsWith('/values:batchGetByDataFilter')){
      assert.equal(body.dataFilters[0].developerMetadataLookup.metadataId,data.metadataId)
      return {spreadsheetId:target.spreadsheetId,valueRanges:[{valueRange:{values:[[...data.row,data.memo]]}}]}
    }
    if(path.endsWith('/values:batchUpdateByDataFilter')){
      assert.equal(body.data[0].dataFilter.developerMetadataLookup.metadataId,data.metadataId)
      assert.equal(body.data[0].values[0].length,view.ORDER_HEADERS.length)
      data.row=[...body.data[0].values[0]];data.updates++
      return {spreadsheetId:target.spreadsheetId,totalUpdatedRows:1}
    }
    assert.ok(path.endsWith(':batchUpdate'))
    assert.equal(body.requests.length,3)
    assert.equal(body.requests[0].insertDimension.range.sheetId,target.sheetId)
    assert.equal(body.requests[2].createDeveloperMetadata.developerMetadata.location.dimensionRange.sheetId,target.sheetId)
    data.row=body.requests[1].updateCells.rows[0].values.map(cell=>cell.userEnteredValue.stringValue??cell.userEnteredValue.numberValue)
    data.inserts++
    if(data.crashAfterWrite)throw Error('SHEETS_REQUEST_UNCONFIRMED')
    return {spreadsheetId:target.spreadsheetId,replies:[{},{},{}]}
  }}
  return {data,api,ports:{withClient:db.withClient,api,target}}
}
async function approval(db,orderId,jobId){
  const version=String((await db.query('SELECT version FROM daechion_orders.orders WHERE id=$1',[orderId])).rows[0].version)
  const input={requestKey:randomUUID(),orderId,expectedVersion:version,operatorName:'복구 검수',reason:'시트 연결 점검 완료',confirmed:true,
    action:'RECONCILE_SHEETS',jobId,confirmExistingRow:true}
  await db.withClient(c=>admin.applyOrderAdminAction(c,'fixture',input))
  return input
}
function failCompletion(db){
  return run=>db.withClient(c=>run({query:(sql,args)=>{
    if(sql.includes("SET state=CASE WHEN $3::boolean"))throw Error('SIMULATED_PROCESS_EXIT')
    return c.query(sql,args)
  }}))
}

test('Sheets first-row retries preserve durable no-write evidence and never replay uncertain inserts',async t=>{
  const db=await database()
  try{
    await t.test('three initial 503 reads remain safely retryable, cap backoff, then publish exactly one row',async()=>{
      const o=await order(db),s=sheet(db,o.jobId);s.data.readFailures=3
      for(let attempt=1;attempt<=3;attempt++){
        assert.equal(await sheets.syncOrderSheet(o.id,true,s.ports),'DEFERRED')
        const saved=await state(db,o.jobId)
        assert.equal(saved.state,'PENDING');assert.equal(saved.sheet_write_started,false)
        assert.equal(saved.sheet_read_attempts,attempt);assert.equal(saved.last_error,'sheet_read_retry')
        const delay=Date.parse(saved.available_at)-Date.now()
        assert.ok(delay>(attempt<3?50_000:290_000)&&delay<=(attempt<3?60_000:300_000))
        assert.equal(await sheets.syncOrderSheet(o.id,true,s.ports),'SKIPPED')
        await due(db,o.jobId)
      }
      assert.equal(s.data.inserts,0)
      assert.equal(await sheets.syncOrderSheet(o.id,true,s.ports),'DONE')
      assert.equal(await sheets.syncOrderSheet(o.id,true,s.ports),'SKIPPED')
      assert.equal(s.data.inserts,1);assert.equal(s.data.updates,0);assert.equal(s.data.memo,'직원 원문 메모')
      assert.equal((await state(db,o.jobId)).sheet_read_attempts,3)
    })
    await t.test('an approved no-write failure can create its first row once under concurrent recovery and audit replay',async()=>{
      const o=await order(db),s=sheet(db,o.jobId);s.data.readFailures=1;s.data.readError='SHEETS_HTTP_403'
      assert.equal(await sheets.syncOrderSheet(o.id,true,s.ports),'UNKNOWN')
      assert.equal((await state(db,o.jobId)).sheet_write_started,false)
      const input=await approval(db,o.id,o.jobId)
      assert.equal((await db.withClient(c=>admin.applyOrderAdminAction(c,'fixture',input))).replayed,true)
      let release,started
      const waiting=new Promise(resolve=>{release=resolve}),began=new Promise(resolve=>{started=resolve})
      s.data.beforeRead=async()=>{started();await waiting}
      const first=recovery.deliverOrderSheet(o.id,true,s.ports);await began
      assert.equal(await recovery.deliverOrderSheet(o.id,true,s.ports),'SKIPPED')
      release();assert.equal(await first,'DONE')
      assert.equal(await recovery.deliverOrderSheet(o.id,true,s.ports),'SKIPPED')
      assert.equal(s.data.inserts,1);assert.equal(s.data.updates,0);assert.equal(s.data.memo,'직원 원문 메모')
      assert.equal((await db.query('SELECT count(*)::int AS n FROM daechion_orders.sheet_recoveries WHERE order_id=$1',[o.id])).rows[0].n,1)
    })
    await t.test('a crash before write evidence is committed can retry after its lease expires',async()=>{
      const o=await order(db),s=sheet(db,o.jobId);s.data.readFailures=1
      await assert.rejects(sheets.syncOrderSheet(o.id,true,{...s.ports,withClient:failCompletion(db)}),/SIMULATED_PROCESS_EXIT/)
      assert.equal((await state(db,o.jobId)).state,'RUNNING');assert.equal((await state(db,o.jobId)).sheet_write_started,false)
      await expire(db,o.jobId)
      assert.equal(await sheets.syncOrderSheet(o.id,true,s.ports),'DONE');assert.equal(s.data.inserts,1)
      assert.equal(s.data.memo,'직원 원문 메모')
    })
    await t.test('a transient read during approved no-write recovery returns to automatic retry',async()=>{
      const o=await order(db),s=sheet(db,o.jobId);s.data.readFailures=1;s.data.readError='SHEETS_HTTP_403'
      assert.equal(await sheets.syncOrderSheet(o.id,true,s.ports),'UNKNOWN')
      const input=await approval(db,o.id,o.jobId)
      s.data.readFailures=1;s.data.readError='SHEETS_HTTP_503'
      assert.equal(await recovery.deliverOrderSheet(o.id,true,s.ports),'DEFERRED')
      const requested=(await db.query('SELECT state,result_code FROM daechion_orders.sheet_recoveries WHERE request_key=$1',[input.requestKey])).rows[0]
      assert.deepEqual(requested,{state:'FAILED',result_code:'sheet_read_retry'})
      assert.equal((await state(db,o.jobId)).state,'PENDING');assert.equal((await state(db,o.jobId)).sheet_write_started,false)
      await due(db,o.jobId)
      assert.equal(await recovery.deliverOrderSheet(o.id,true,s.ports),'DONE');assert.equal(s.data.inserts,1)
    })
    await t.test('a crash after the durable send marker never recreates a missing row',async()=>{
      const o=await order(db),s=sheet(db,o.jobId);s.data.crashBeforeWrite=true
      await assert.rejects(sheets.syncOrderSheet(o.id,true,{...s.ports,withClient:failCompletion(db)}),/SIMULATED_PROCESS_EXIT/)
      assert.equal((await state(db,o.jobId)).sheet_write_started,true);assert.equal(s.data.inserts,0)
      await expire(db,o.jobId);s.data.crashBeforeWrite=false
      assert.equal(await sheets.syncOrderSheet(o.id,true,s.ports),'SKIPPED')
      assert.equal((await state(db,o.jobId)).state,'UNKNOWN')
      await approval(db,o.id,o.jobId)
      assert.equal(await recovery.deliverOrderSheet(o.id,true,s.ports),'UNKNOWN')
      assert.equal(s.data.inserts,0);assert.equal(s.data.updates,0)
      await assert.rejects(db.query('UPDATE daechion_orders.jobs SET sheet_write_started=false WHERE id=$1',[o.jobId]),/WRITE_EVIDENCE_FROZEN/)
    })
    await t.test('a crash after an actual insertion reconciles its metadata row and preserves notes',async()=>{
      const o=await order(db),s=sheet(db,o.jobId);s.data.crashAfterWrite=true
      await assert.rejects(sheets.syncOrderSheet(o.id,true,{...s.ports,withClient:failCompletion(db)}),/SIMULATED_PROCESS_EXIT/)
      await expire(db,o.jobId);s.data.crashAfterWrite=false
      assert.equal(await sheets.syncOrderSheet(o.id,true,s.ports),'SKIPPED')
      assert.equal(s.data.inserts,1)
      await approval(db,o.id,o.jobId)
      assert.equal(await recovery.deliverOrderSheet(o.id,true,s.ports),'DONE')
      assert.equal(await recovery.deliverOrderSheet(o.id,true,s.ports),'SKIPPED')
      assert.equal(s.data.inserts,1);assert.equal(s.data.updates,1);assert.equal(s.data.metadataId,45);assert.equal(s.data.memo,'직원 원문 메모')
    })
    await t.test('an expired read lease cannot send a write and two ordinary workers insert once',async()=>{
      const fenced=await order(db),f=sheet(db,fenced.jobId)
      f.data.beforeRead=()=>expire(db,fenced.jobId)
      assert.equal(await sheets.syncOrderSheet(fenced.id,true,f.ports),'UNKNOWN');assert.equal(f.data.inserts,0)
      assert.equal(await sheets.syncOrderSheet(fenced.id,true,f.ports),'DONE');assert.equal(f.data.inserts,1)
      const o=await order(db),s=sheet(db,o.jobId)
      let release,started
      const waiting=new Promise(resolve=>{release=resolve}),began=new Promise(resolve=>{started=resolve})
      s.data.beforeRead=async()=>{started();await waiting}
      const first=sheets.syncOrderSheet(o.id,true,s.ports);await began
      assert.equal(await sheets.syncOrderSheet(o.id,true,s.ports),'SKIPPED')
      release();assert.equal(await first,'DONE');assert.equal(s.data.inserts,1)
    })
    await t.test('an expired approval lease fences the recovery before any external write',async()=>{
      const o=await order(db),s=sheet(db,o.jobId);s.data.readFailures=1;s.data.readError='SHEETS_HTTP_403'
      assert.equal(await sheets.syncOrderSheet(o.id,true,s.ports),'UNKNOWN')
      const input=await approval(db,o.id,o.jobId)
      s.data.beforeRead=()=>db.query("UPDATE daechion_orders.sheet_recoveries SET lease_until=now()-interval '1 second' WHERE request_key=$1",[input.requestKey])
      assert.equal(await recovery.deliverOrderSheet(o.id,true,s.ports),'UNKNOWN')
      assert.equal(s.data.inserts,0);assert.equal(s.data.updates,0)
      assert.equal((await state(db,o.jobId)).sheet_write_started,false)
      assert.equal(await recovery.deliverOrderSheet(o.id,true,s.ports),'SKIPPED')
      assert.equal((await db.query('SELECT state FROM daechion_orders.sheet_recoveries WHERE request_key=$1',[input.requestKey])).rows[0].state,'UNKNOWN')
      await approval(db,o.id,o.jobId)
      assert.equal(await recovery.deliverOrderSheet(o.id,true,s.ports),'DONE');assert.equal(s.data.inserts,1)
    })
    await t.test('an old worker taking over a safe retry loses no-write proof if it crashes',async()=>{
      const o=await order(db),s=sheet(db,o.jobId);s.data.readFailures=1
      assert.equal(await sheets.syncOrderSheet(o.id,true,s.ports),'DEFERRED')
      await due(db,o.jobId)
      // The pre-012 claim changes its lease but knows nothing about read tokens.
      await db.query(`UPDATE daechion_orders.jobs SET state='RUNNING',attempts=attempts+1,last_error=NULL,
        lease_token=$2,lease_until=now()-interval '1 second' WHERE id=$1`,[o.jobId,randomUUID()])
      assert.equal((await state(db,o.jobId)).sheet_write_started,true)
      assert.equal(await sheets.syncOrderSheet(o.id,true,s.ports),'SKIPPED')
      assert.equal(await sheets.syncOrderSheet(o.id,true,{...s.ports,authorise:async()=>true},true),'UNKNOWN')
      assert.equal(s.data.inserts,0)
    })
  }finally{await db.close()}
})

test('migration 012 treats only historical persisted read-retry errors as safe across old-worker rollout',async()=>{
  const db=await database(true)
  try{
    const safe=await order(db),unknown=await order(db),running=await order(db)
    await db.query("UPDATE daechion_orders.jobs SET state='UNKNOWN',attempts=3,last_error='sheet_read_retry' WHERE id=$1",[safe.jobId])
    await db.query("UPDATE daechion_orders.jobs SET state='UNKNOWN',attempts=1,last_error='sheet_publish_unknown' WHERE id=$1",[unknown.jobId])
    await db.query("UPDATE daechion_orders.jobs SET state='RUNNING',attempts=1,lease_token=$2,lease_until=now()-interval '1 second' WHERE id=$1",[running.jobId,randomUUID()])
    await db.exec(migration('daechion-orders/012_sheet_read_recovery.sql'))
    assert.equal((await state(db,safe.jobId)).state,'PENDING');assert.equal((await state(db,safe.jobId)).sheet_write_started,false)
    assert.equal((await state(db,unknown.jobId)).state,'UNKNOWN');assert.equal((await state(db,unknown.jobId)).sheet_write_started,true)
    assert.equal((await state(db,running.jobId)).sheet_write_started,true)
    const s=sheet(db,safe.jobId),u=sheet(db,unknown.jobId),r=sheet(db,running.jobId)
    assert.equal(await sheets.syncOrderSheet(safe.id,true,s.ports),'DONE');assert.equal(s.data.inserts,1)
    assert.equal(await sheets.syncOrderSheet(unknown.id,true,{...u.ports,authorise:async()=>true},true),'UNKNOWN');assert.equal(u.data.inserts,0)
    assert.equal(await sheets.syncOrderSheet(running.id,true,r.ports),'SKIPPED');assert.equal(r.data.inserts,0)
    // An old worker may finish its third read failure after the migration ran.
    const late=await order(db),l=sheet(db,late.jobId)
    await db.query("UPDATE daechion_orders.jobs SET state='UNKNOWN',attempts=3,last_error='sheet_read_retry' WHERE id=$1",[late.jobId])
    assert.equal(await sheets.syncOrderSheet(late.id,true,l.ports),'DONE');assert.equal(l.data.inserts,1)
  }finally{await db.close()}
})
