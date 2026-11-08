import {test} from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import worker from '../workers/daechion/orders.cjs'

const id='10000000-0000-4000-8000-000000000001',fingerprint='a'.repeat(64)
const base={DAECHION_ORDER_WORKER_ENABLED:'true',DAECHION_ORDER_ACCEPTANCE_ID:id,DAECHION_ORDER_ACCEPTANCE_FINGERPRINT:fingerprint,DAECHION_TENANT_ID:'fixture'}
test('entrypoint defaults to checks and rejects untargeted or malformed execution before runtime construction',async()=>{
  let constructed=0,checked=0,processed=0
  const makeRuntime=()=>{constructed++;return {check:async()=>{checked++;return {schemaChecked:true}},once:async value=>{assert.equal(value,id);processed++}}}
  for(const argv of [[],['--check']])await worker.main({argv,env:{},makeRuntime,write:()=>{}})
  assert.equal(constructed,2);assert.equal(checked,2);assert.equal(processed,0)
  for(const argv of [['--once'],['--loop'],['--once','--order-id',id,'--check'],['--once','--order-id','not-id'],['--setup-sheets'],['--check','--check']])
    await assert.rejects(worker.main({argv,env:base,makeRuntime,write:()=>{}}),/ORDER_WORKER_ARGUMENTS_REJECTED/)
  assert.equal(constructed,2)
  for(const env of [{},{...base,DAECHION_ORDER_WORKER_ENABLED:'false'},{...base,DAECHION_ORDER_ACCEPTANCE_FINGERPRINT:''},{...base,DAECHION_ORDER_ACCEPTANCE_ID:id.replace(/1$/,'2')}])
    await assert.rejects(worker.main({argv:['--once','--order-id',id],env,makeRuntime,write:()=>{}}))
  await worker.main({argv:['--once','--order-id',id],env:base,makeRuntime,write:()=>{}})
  assert.equal(checked,3);assert.equal(processed,1)
  await assert.rejects(worker.main({argv:['--once','--order-id',id],env:base,
    makeRuntime:()=>({check:async()=>{throw Error('schema unavailable')},once:async()=>{assert.fail('Cannot execute before readiness')}}),write:()=>{}}),/schema unavailable/)
  await assert.rejects(worker.main({argv:['--once','--order-id',id],env:base,
    makeRuntime:()=>({check:async()=>({}),once:async()=>({processingFailed:true})}),write:()=>{}}),/ORDER_WORKER_PHASE_FAILED/)
  const result=spawnSync(process.execPath,['workers/daechion/orders.cjs','--bad'],{encoding:'utf8',env:{...process.env,DAECHION_API_KEY:'do-not-log-this-key'}})
  assert.equal(result.status,1);assert.equal(result.stdout,'');assert.equal(result.stderr.trim(),'DAECHION_ORDER_WORKER_FAILED')
})
const fakeDatabase=(events,target={request_fingerprint:fingerprint,tenant_id:'fixture'})=>async run=>run({query:async(sql,args)=>{
  events.push({sql,args})
  return {rows:sql.startsWith('SELECT request_fingerprint')?(target?[target]:[]):sql.startsWith('SELECT *')?[{id}]:[{version:'2'}]}
}})
test('check is read-only, providers are lazy, and a wrong order never reaches a provider or write',async()=>{
  const events=[]
  const providers=new Proxy({},{get(){throw Error('A provider was constructed unexpectedly')}})
  const service=worker.runtime(base,{withClient:fakeDatabase(events),providers,checkSchemas:async()=>{}})
  assert.deepEqual(await service.check(),{schemaChecked:true,active:false})
  assert.deepEqual(events.map(e=>e.sql),['BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY','COMMIT'])
  await assert.rejects(service.once(id),/ORDER_WORKER_PHASES_DISABLED/)
  for(const target of [null,{request_fingerprint:'b'.repeat(64),tenant_id:'fixture'},{request_fingerprint:fingerprint,tenant_id:'wrong'}]){
    const log=[],runtime=worker.runtime({...base,DAECHION_ORDER_PAYMENT_READ_ENABLED:'true'}, {withClient:fakeDatabase(log,target),providers})
    await assert.rejects(runtime.once(id),/ORDER_ACCEPTANCE_TARGET_MISMATCH/)
    assert.equal(log.length,1)
  }
  const failed=worker.runtime(base,{withClient:fakeDatabase(events),providers,checkSchemas:async()=>{throw Error('unready')}})
  await assert.rejects(failed.check(),/unready/)
  assert.equal(events.at(-1).sql,'ROLLBACK')
})
test('phase prerequisites reject competing writers and incomplete enrollment settings',()=>{
  for(const changed of [{DAECHION_BILLING_SEND_ENABLED:'true'},{DAECHION_ENROLLMENT_ENABLED:'true'},
    {DAECHION_ORDER_ENROLLMENT_ENABLED:'true'}, {DAECHION_ORDER_SEND_ENABLED:'true'},
    {DAECHION_ORDER_READY_MESSAGE_ENABLED:'true'},
    {DAECHION_ORDER_PAYMENT_READ_ENABLED:'true',DAECHION_ORDER_ENROLLMENT_ENABLED:'true',DAECHION_IDENTITY_LOOKUP_VERIFIED:'true'},
    {DAECHION_ORDER_PAYMENT_READ_ENABLED:'true',DAECHION_ORDER_READY_MESSAGE_ENABLED:'true',DAECHION_ACCESS_POLICY_VERIFIED:'true',DAECHION_READY_MESSAGE_ENABLED:'true'}])
    assert.throws(()=>worker.runtime({...base,...changed}))
})
test('an unsafe Sheet destination stops before processing or constructing a Google provider',async()=>{
  let processed=false
  const runtime=worker.runtime({...base,DAECHION_ORDER_SHEETS_ENABLED:'true',
    DAECHION_ORDER_SHEETS_SPREADSHEET_ID:'1jzwafX-L-QatwQUxlv5VnLqYZIZB3GQjRKmTEUp2L3g',DAECHION_ORDER_SHEETS_SHEET_ID:'0',
    GOOGLE_SHEET_ID:'1jzwafX-L-QatwQUxlv5VnLqYZIZB3GQjRKmTEUp2L3g',DAECHION_SHEETS_SPREADSHEET_ID:'fixture_new_workflow_sheet_id',DAECHION_SHEETS_SHEET_ID:'0'},
    {withClient:fakeDatabase([]),providers:new Proxy({},{get(){assert.fail('Unsafe target must be rejected first')}}),processOrder:async()=>{processed=true}})
  await assert.rejects(runtime.once(id));assert.equal(processed,false)
})
test('one selected order flows through processing then delivery; a processing exception is held and never sends a ready message',async()=>{
  const env={...base,DAECHION_ORDER_PAYMENT_READ_ENABLED:'true',DAECHION_ORDER_READY_MESSAGE_ENABLED:'true',DAECHION_ACCESS_POLICY_VERIFIED:'true'}
  const events=[],phase=[]
  const options={withClient:fakeDatabase(events),providers:{payment:{accountId:'fixture'},message:{}},
    processOrder:async(value,flags)=>{assert.equal(value,id);assert.deepEqual(flags,{send:false,read:true,enroll:false});phase.push('process')},
    deliverOrder:async(value,flags)=>{assert.equal(value,id);assert.equal(flags.message,true);phase.push('deliver')}}
  assert.deepEqual(await worker.runtime(env,options).once(id),{processed:true,processingFailed:false,deliveryFailed:false})
  assert.deepEqual(phase,['process','deliver'])
  const failed=worker.runtime(env,{...options,processOrder:async()=>{throw Error('private upstream data')},deliverOrder:async(_value,flags)=>{
    assert.equal(flags.message,false);assert.ok(events.some(e=>e.args?.includes('worker_execution_unknown')))
  }})
  assert.deepEqual(await failed.once(id),{processed:true,processingFailed:true,deliveryFailed:false})
  assert.equal(JSON.stringify(events).includes('private upstream data'),false)
})
