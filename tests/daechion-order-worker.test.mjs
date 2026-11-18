import {test} from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {EventEmitter} from 'node:events'
import scheduler from '../.daechion-worker-build/lib/daechion/orders/scheduler.js'
import worker from '../workers/daechion/orders.cjs'

const id='10000000-0000-4000-8000-000000000001',fingerprint='a'.repeat(64)
const base={DAECHION_ORDER_WORKER_ENABLED:'true',DAECHION_ORDER_ACCEPTANCE_ID:id,DAECHION_ORDER_ACCEPTANCE_FINGERPRINT:fingerprint,DAECHION_TENANT_ID:'fixture'}

test('loop requires a separate explicit switch, forbids acceptance credentials and drains on stop without overlapping cycles',async()=>{
  const env={DAECHION_ORDER_WORKER_ENABLED:'true',DAECHION_ORDER_LOOP_ENABLED:'true'}
  assert.deepEqual(worker.argumentsFor(['--loop'],env),{command:'loop'})
  for(const changed of [{...env,DAECHION_ORDER_LOOP_ENABLED:'false'},{...env,DAECHION_ORDER_ACCEPTANCE_ID:id},{...env,DAECHION_ORDER_ACCEPTANCE_FINGERPRINT:fingerprint},{}])
    assert.throws(()=>worker.argumentsFor(['--loop'],changed),/ARGUMENTS_REJECTED/)
  assert.throws(()=>worker.runtime({...env,DAECHION_ORDER_ENROLLMENT_ENABLED:'true',DAECHION_ORDER_PAYMENT_READ_ENABLED:'true',DAECHION_IDENTITY_LOOKUP_VERIFIED:'true',DAECHION_ACCESS_POLICY_VERIFIED:'true'}),/SESSION_MAINTENANCE_REQUIRED/)
  const controller=new AbortController(),events=[],writes=[]
  await worker.main({argv:['--loop'],env,signal:controller.signal,write:r=>writes.push(r),
    makeRuntime:()=>({check:async()=>{events.push('check')},cycle:async()=>{events.push('cycle');return {processed:1}}}),
    wait:async(ms,{signal})=>{assert.equal(ms,30000);assert.equal(signal.aborted,false);events.push('wait');controller.abort()}})
  assert.deepEqual(events,['check','cycle','wait']);assert.deepEqual(writes,[{processed:1}])
  const stopped=new AbortController();stopped.abort()
  await worker.main({argv:['--loop'],env,signal:stopped.signal,write:()=>assert.fail('No cycle after stop'),makeRuntime:()=>({check:async()=>{},cycle:async()=>assert.fail('Stopped')})})
})

test('scheduler session lock skips a competing replica and fences disconnects without exposing upstream errors',async()=>{
  let held=false
  const clients=[]
  const withClient=async run=>{
    const c=new EventEmitter();clients.push(c)
    c.query=async sql=>{
      if(sql.includes('pg_try_advisory_lock')){const locked=!held;if(locked)held=true;return {rows:[{locked}]}}
      if(sql.includes('pg_advisory_unlock')){held=false;return {rows:[{unlocked:true}]}}
      return {rows:[]}
    }
    return run(c)
  }
  let entered,release;const begun=new Promise(r=>{entered=r}),wait=new Promise(r=>{release=r})
  const first=scheduler.withSchedulerLock(withClient,'fixture',async assert=>{await assert();entered();await wait;return 'done'})
  await begun
  assert.equal(await scheduler.withSchedulerLock(withClient,'fixture',async()=>assert.fail('Competing worker')),null)
  release();assert.equal(await first,'done');assert.equal(held,false)
  await assert.rejects(scheduler.withSchedulerLock(withClient,'fixture',async assert=>{clients.at(-1).emit('end');await assert()}),/SCHEDULER_CONNECTION_LOST/)
  assert.ok(clients.every(c=>c.listenerCount('error')===0&&c.listenerCount('end')===0))
})
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
test('an unsafe Sheet destination disables only sheet delivery without constructing a Google provider',async()=>{
  let processed=false
  const runtime=worker.runtime({...base,DAECHION_ORDER_SHEETS_ENABLED:'true',
    DAECHION_ORDER_SHEETS_SPREADSHEET_ID:'1jzwafX-L-QatwQUxlv5VnLqYZIZB3GQjRKmTEUp2L3g',DAECHION_ORDER_SHEETS_SHEET_ID:'0',
    GOOGLE_SHEET_ID:'1jzwafX-L-QatwQUxlv5VnLqYZIZB3GQjRKmTEUp2L3g',DAECHION_SHEETS_SPREADSHEET_ID:'fixture_new_workflow_sheet_id',DAECHION_SHEETS_SHEET_ID:'0'},
    {withClient:fakeDatabase([]),providers:new Proxy({},{get(){assert.fail('Unsafe target must be rejected first')}}),processOrder:async()=>{processed=true},
      deliverOrder:async(_id,flags)=>{assert.deepEqual(flags,{message:false,sheets:false})}})
  const result=await runtime.once(id);assert.equal(processed,true);assert.deepEqual(result.deferredPhases,['sheets'])
})

const loopEnv={DAECHION_ORDER_WORKER_ENABLED:'true',DAECHION_ORDER_LOOP_ENABLED:'true',DAECHION_TENANT_ID:'fixture',
  DAECHION_API_KEY:'x'.repeat(48),DAECHION_ORDER_PAYMENT_READ_ENABLED:'true',DAECHION_ORDER_ENROLLMENT_ENABLED:'true',
  DAECHION_IDENTITY_LOOKUP_VERIFIED:'true',DAECHION_ACCESS_POLICY_VERIFIED:'true',DAECHION_ORDER_SESSION_MAINTENANCE_ENABLED:'true'}
function loopDatabase(selected=[{id,request_fingerprint:fingerprint,needs_enrollment:true}]){
  const calls=[]
  const c=new EventEmitter()
  c.query=async(sql,args)=>{
    calls.push({sql,args})
    if(sql.includes('pg_try_advisory_lock'))return {rows:[{locked:true}]}
    if(sql.includes('pg_advisory_unlock'))return {rows:[{unlocked:true}]}
    if(sql.startsWith('SELECT state,next_check_at'))return {rows:[{state:'READY',fresh:true}]}
    if(sql.startsWith('SELECT o.id,o.request_fingerprint'))return {rows:selected}
    if(sql.startsWith('SELECT request_fingerprint'))return {rows:[{request_fingerprint:fingerprint,tenant_id:'fixture'}]}
    if(sql.startsWith('SELECT *,now()'))return {rows:[{id,checkout_state:'READY',payment_state:'PAID'}]}
    if(sql.startsWith('SELECT 1 FROM daechion_orders.grants'))return {rows:[{ok:1}]}
    return {rows:[]}
  }
  return {calls,withClient:async run=>run(c)}
}
test('broken message and sheet setup do not block healthy payment and enrollment phases, and readiness reports them',async()=>{
  for(const optional of ['message','sheets']){
    const db=loopDatabase(),runs=[],deliveries=[];let refreshed=0
    const settings={...loopEnv,
      ...(optional==='message'?{DAECHION_ORDER_READY_MESSAGE_ENABLED:'true',SOLAPI_SENDER:'bad'}:
        {DAECHION_ORDER_SHEETS_ENABLED:'true',DAECHION_ORDER_SHEETS_SPREADSHEET_ID:'fixture_order_sheet_123456789',DAECHION_ORDER_SHEETS_SHEET_ID:'2',
          DAECHION_SHEETS_SPREADSHEET_ID:'fixture_single_sheet_123456789',DAECHION_SHEETS_SHEET_ID:'0',GOOGLE_SHEET_ID:'fixture_legacy_sheet_123456789',GOOGLE_SERVICE_ACCOUNT_JSON:'private-invalid-json'})}
    const service=worker.runtime(settings,{withClient:db.withClient,checkSchemas:async()=>{},
      providers:{payment:{accountId:'fixture'},daechion:{refreshSession:async()=>{refreshed++;return {refreshed:true}}}},
      processOrder:async(_id,flags)=>runs.push(flags),deliverOrder:async(_id,flags)=>deliveries.push(flags)})
    const checked=await service.check();assert.equal(checked.providersReady[optional],false)
    const result=await service.cycle()
    assert.equal(result.processed,1);assert.equal(result.failed,1);assert.equal(result.sessionReady,true)
    assert.deepEqual(runs,[{send:false,read:true,enroll:true}]);assert.deepEqual(deliveries,[{message:false,sheets:false}]);assert.equal(refreshed,1)
    assert.equal(JSON.stringify(db.calls).includes('private-invalid-json'),false)
  }
})
test('enrollment quarantine stops the batch without later orders, delivery or unlocking its browser lease',async()=>{
  const second=id.replace(/1$/,'2'),selected=[id,second].map(id=>({id,request_fingerprint:fingerprint,needs_enrollment:true}))
  const db=loopDatabase(selected),runs=[],deliveries=[];let available=true,refreshed=0
  const service=worker.runtime({...loopEnv,DAECHION_ORDER_SEND_ENABLED:'true',DAECHION_ORDERS_SUBJECT_SECRET:'s'.repeat(32),
    DAECHION_ORDER_SHEETS_ENABLED:'true',DAECHION_ORDER_SHEETS_SPREADSHEET_ID:'fixture_order_sheet_123456789',DAECHION_ORDER_SHEETS_SHEET_ID:'2',
    DAECHION_SHEETS_SPREADSHEET_ID:'fixture_single_sheet_123456789',DAECHION_SHEETS_SHEET_ID:'0',GOOGLE_SHEET_ID:'fixture_legacy_sheet_123456789'},
    {withClient:db.withClient,checkSchemas:async()=>{},
      providers:{payment:{accountId:'fixture'},api:{},sheets:{},daechion:{isAvailable:()=>available,refreshSession:async()=>{refreshed++;return {refreshed:true}}}},
      processOrder:async(orderId,flags)=>{
        runs.push({id:orderId,...flags})
        if(flags.enroll)available=false
        else assert.ok(db.calls.some(row=>row.sql.startsWith('UPDATE daechion_orders.scheduler_sessions')&&row.args[1]==='FAILED'))
      },deliverOrder:async(orderId,flags)=>{deliveries.push({id:orderId,...flags})}})
  const first=await service.cycle()
  assert.equal(first.processed,1);assert.equal(first.sessionReady,false);assert.equal(first.browserRestartRequired,true)
  assert.deepEqual(runs,[{id,send:true,read:true,enroll:true}])
  assert.deepEqual(deliveries,[])
  assert.equal(db.calls.some(row=>row.sql.startsWith('UPDATE daechion_orders.scheduler_orders s SET finished_at')),false)
  assert.equal((await service.check()).providersReady.browser,false)
  const next=await service.cycle()
  assert.equal(next.processed,0);assert.equal(next.sessionReady,false);assert.equal(next.browserRestartRequired,true);assert.equal(refreshed,1)
  assert.equal(runs.length,1,'quarantine cannot be reset or trusted from cached READY')
})

test('unconfirmed browser termination during refresh never selects an order or starts a business phase',async()=>{
  const db=loopDatabase(),runs=[],deliveries=[]
  const service=worker.runtime(loopEnv,{withClient:db.withClient,providers:{payment:{accountId:'fixture'},daechion:{
    refreshSession:async()=>{throw Object.assign(Error('private upstream credentials'),{stage:'SESSION_REFRESH',browserTerminationUnconfirmed:true})}}},
    processOrder:async()=>runs.push('business'),deliverOrder:async()=>deliveries.push('delivery')})
  const result=await service.cycle()
  assert.deepEqual(result,{busy:false,processed:0,failed:1,sessionReady:false,browserRestartRequired:true})
  assert.deepEqual(runs,[]);assert.deepEqual(deliveries,[])
  assert.equal(db.calls.some(row=>row.sql.startsWith('SELECT o.id,o.request_fingerprint')),false)
  assert.equal(JSON.stringify(result).includes('private'),false)
})

test('a database outage cannot hide refresh quarantine or make a later cycle touch the database',async()=>{
  const db=loopDatabase(),schedulerClient=new EventEmitter(),afterQuarantine=[]
  let quarantined=false,connections=0,refreshes=0
  schedulerClient.query=async(sql,args)=>{
    if(quarantined){afterQuarantine.push(sql);throw Error('private database outage')}
    return db.withClient(c=>c.query(sql,args))
  }
  const service=worker.runtime(loopEnv,{
    withClient:async run=>{
      connections++
      if(quarantined)throw Error('private diagnostic outage')
      return db.withClient(run)
    },
    withSchedulerClient:async run=>{connections++;return run(schedulerClient)},
    providers:{daechion:{refreshSession:async()=>{
      refreshes++;quarantined=true
      throw Object.assign(Error('private browser session'),{browserTerminationUnconfirmed:true})
    }}},
    processOrder:async()=>assert.fail('No business phase after quarantine'),
    deliverOrder:async()=>assert.fail('No delivery after quarantine'),
  })
  const first=await service.cycle()
  assert.deepEqual(first,{busy:false,processed:0,failed:1,sessionReady:false,browserRestartRequired:true})
  await new Promise(setImmediate)
  assert.equal(afterQuarantine.length,1,'Only the scheduler lock release may be attempted after quarantine')
  assert.ok(afterQuarantine[0].includes('pg_advisory_unlock'))
  assert.equal(db.calls.some(row=>row.sql.startsWith('UPDATE daechion_orders.scheduler_sessions')),false)
  const before=connections
  assert.deepEqual(await service.cycle(),first)
  assert.equal(connections,before);assert.equal(refreshes,1)
  assert.equal(schedulerClient.listenerCount('error'),0);assert.equal(schedulerClient.listenerCount('end'),0)
  const output=[];let waits=0
  await assert.rejects(worker.main({argv:['--loop'],env:loopEnv,write:value=>output.push(value),wait:async()=>{waits++},
    makeRuntime:()=>({check:async()=>{},cycle:service.cycle})}),/^Error: DAECHION_ORDER_BROWSER_RESTART_REQUIRED$/)
  assert.equal(waits,0);assert.equal(connections,before)
  assert.deepEqual(output,[{cycleFailed:true,browserRestartRequired:true,code:'DAECHION_ORDER_BROWSER_RESTART_REQUIRED'}])
})

test('a fatal grant interrupts cycle and once before runner cleanup settles, preserving receiver and fencing late DB work',async()=>{
  for(const mode of ['cycle','once']){
    const db=loopDatabase();let releaseLate,queryStarted,cleanupStarted=false,lateWork
    const started=new Promise(resolve=>{queryStarted=resolve})
    class BrowserFixture {
      #receiver='original provider'
      async refreshSession(){assert.equal(this.#receiver,'original provider');return {refreshed:true}}
      async ensureFirstLessonAccess(){
        assert.equal(this.#receiver,'original provider')
        throw Object.assign(Error('private browser write state'),{browserTerminationUnconfirmed:true})
      }
    }
    const service=worker.runtime({...loopEnv,...(mode==='once'?{DAECHION_ORDER_ACCEPTANCE_ID:id,DAECHION_ORDER_ACCEPTANCE_FINGERPRINT:fingerprint}:{} )},{
      withClient:async run=>db.withClient(c=>run({query:async(sql,args)=>{
        if(sql==='SELECT late_before_fatal')return new Promise(resolve=>{releaseLate=()=>resolve({rows:[]});queryStarted()})
        return c.query(sql,args)
      }})),
      providers:{payment:{accountId:'fixture'},daechion:new BrowserFixture()},
      processOrder:async(_id,_flags,ports)=>{
        lateWork=ports.withClient(async c=>{
          await c.query('SELECT late_before_fatal')
          await c.query('UPDATE synthetic_late_business_write')
        })
        lateWork.catch(()=>{})
        await started
        try{await ports.daechion.ensureFirstLessonAccess({})}
        catch{cleanupStarted=true;await new Promise(()=>{})}
      },
      deliverOrder:async()=>assert.fail('No delivery after fatal grant'),
    })
    const result=await (mode==='cycle'?service.cycle():service.once(id))
    assert.equal(result.browserRestartRequired,true)
    await new Promise(setImmediate)
    assert.equal(cleanupStarted,true)
    releaseLate()
    await assert.rejects(lateWork,/^Error: DAECHION_ORDER_BROWSER_RESTART_REQUIRED$/)
    assert.equal(db.calls.some(row=>row.sql==='UPDATE synthetic_late_business_write'),false)
    const before=db.calls.length
    assert.equal((await service.cycle()).browserRestartRequired,true)
    assert.equal(db.calls.length,before)
  }
})

test('quarantine query fencing preserves connection events and their original receiver',async()=>{
  const db=loopDatabase();let checked=false
  const service=worker.runtime(loopEnv,{withClient:db.withClient,
    providers:{payment:{accountId:'fixture'},daechion:{refreshSession:async()=>({refreshed:true})}},
    processOrder:async(_id,_flags,ports)=>ports.withClient(async client=>{
      const listener=()=>{}
      const before=client.listenerCount('end')
      client.on('end',listener)
      assert.equal(client.listenerCount('end'),before+1)
      assert.equal(client.listeners('end').includes(listener),true)
      client.removeListener('end',listener)
      assert.equal(client.listenerCount('end'),before)
      await client.query('SELECT receiver_preserved')
      checked=true
    }),deliverOrder:async()=>{},
  })
  const result=await service.cycle()
  assert.equal(result.failed,0);assert.equal(checked,true)
})

test('actual runtime CLI exits with a fatal refresh while scheduler unlock is permanently pending',()=>{
  const env={DAECHION_ORDER_WORKER_ENABLED:'true',DAECHION_ORDER_LOOP_ENABLED:'true',DAECHION_TENANT_ID:'fixture',
    DAECHION_ORDER_PAYMENT_READ_ENABLED:'true',DAECHION_ORDER_SESSION_MAINTENANCE_ENABLED:'true'}
  const script=`const {EventEmitter}=require('node:events');const worker=require('./workers/daechion/orders.cjs');
    const env=${JSON.stringify(env)},client=new EventEmitter();
    client.query=async sql=>{
      if(sql.includes('pg_try_advisory_lock'))return {rows:[{locked:true}]};
      if(sql.includes('pg_advisory_unlock'))return new Promise(()=>{});
      if(sql.startsWith('SELECT state,next_check_at'))return {rows:[{state:'READY',fresh:true}]};
      return {rows:[]};
    };
    const service=worker.runtime(env,{withClient:async run=>run(client),checkSchemas:async()=>{},providers:{daechion:{
      refreshSession:async()=>{throw Object.assign(Error('private browser credentials'),{browserTerminationUnconfirmed:true})}}}});
    setInterval(()=>{},1000);worker.runCli({argv:['--loop'],env,makeRuntime:()=>service});`
  const result=spawnSync(process.execPath,['-e',script],{cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:5000})
  assert.equal(result.error,undefined);assert.equal(result.status,1)
  assert.deepEqual(JSON.parse(result.stdout),{cycleFailed:true,browserRestartRequired:true,code:'DAECHION_ORDER_BROWSER_RESTART_REQUIRED'})
  assert.equal(result.stderr.trim(),'DAECHION_ORDER_BROWSER_RESTART_REQUIRED')
  assert.equal((result.stdout+result.stderr).includes('private'),false)
})

test('actual runtime CLI exits on a fatal grant even when its DB connection cleanup never completes',()=>{
  for(const mode of ['loop','once']){
    const env={...loopEnv,...(mode==='once'?{DAECHION_ORDER_ACCEPTANCE_ID:id,DAECHION_ORDER_ACCEPTANCE_FINGERPRINT:fingerprint}:{})}
    const script=`const {EventEmitter}=require('node:events');const worker=require('./workers/daechion/orders.cjs');
      const id=${JSON.stringify(id)},fingerprint=${JSON.stringify(fingerprint)},env=${JSON.stringify(env)};
      ${loopDatabase.toString()}
      const db=loopDatabase();let unsafe=false;
      const service=worker.runtime(env,{
        withClient:async run=>{try{return await db.withClient(run)}finally{if(unsafe)await new Promise(()=>{})}},
        checkSchemas:async()=>{},providers:{payment:{accountId:'fixture'},daechion:{
          receiver:'original',refreshSession:async()=>({refreshed:true}),
          async ensureFirstLessonAccess(){
            if(this.receiver!=='original')throw Error('provider receiver lost');
            unsafe=true;throw Object.assign(Error('private browser write state'),{browserTerminationUnconfirmed:true});
          }
        }},
        processOrder:async(_id,_flags,ports)=>ports.withClient(async()=>{
          try{await ports.daechion.ensureFirstLessonAccess({})}catch{throw Error('private runner review cleanup')}
        }),deliverOrder:async()=>{throw Error('No late delivery')}
      });
      setInterval(()=>{},1000);worker.runCli({argv:${JSON.stringify(mode==='loop'?['--loop']:['--once','--order-id',id])},env,makeRuntime:()=>service});`
    const result=spawnSync(process.execPath,['-e',script],{cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:5000})
    assert.equal(result.error,undefined);assert.equal(result.status,1)
    if(mode==='loop')assert.deepEqual(JSON.parse(result.stdout),{cycleFailed:true,browserRestartRequired:true,code:'DAECHION_ORDER_BROWSER_RESTART_REQUIRED'})
    else assert.equal(result.stdout,'')
    assert.equal(result.stderr.trim(),'DAECHION_ORDER_BROWSER_RESTART_REQUIRED')
    assert.equal((result.stdout+result.stderr).includes('private'),false)
  }
})

test('main treats browser quarantine as fatal outside its retry catch and removes signal handlers',async()=>{
  for(const mode of ['return','throw']){
    const output=[],before=['SIGTERM','SIGINT'].map(event=>process.listenerCount(event));let cycles=0,waits=0
    await assert.rejects(worker.main({argv:['--loop'],env:loopEnv,write:value=>output.push(value),wait:async()=>{waits++},
      makeRuntime:()=>({check:async()=>{},cycle:async()=>{cycles++
        if(mode==='throw')throw Object.assign(Error('private cookie and phone'),{browserTerminationUnconfirmed:true})
        return {browserRestartRequired:true,private:'must not log'}
      }})}),/^Error: DAECHION_ORDER_BROWSER_RESTART_REQUIRED$/)
    assert.equal(cycles,1);assert.equal(waits,0)
    assert.deepEqual(output,[{cycleFailed:true,browserRestartRequired:true,code:'DAECHION_ORDER_BROWSER_RESTART_REQUIRED'}])
    assert.deepEqual(['SIGTERM','SIGINT'].map(event=>process.listenerCount(event)),before)
    assert.equal(JSON.stringify(output).includes('private'),false)
  }
})

test('real CLI termination exits even with active event-loop handles instead of retaining an Online fatal worker',()=>{
  const script=`const worker=require('./workers/daechion/orders.cjs');setInterval(()=>{},1000);
    worker.runCli({argv:['--loop'],env:{DAECHION_ORDER_WORKER_ENABLED:'true',DAECHION_ORDER_LOOP_ENABLED:'true'},
    makeRuntime:()=>({check:async()=>{},cycle:async()=>({browserRestartRequired:true,private:'must-not-print'})})});`
  const result=spawnSync(process.execPath,['-e',script],{cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:5000})
  assert.equal(result.error,undefined);assert.equal(result.status,1)
  assert.deepEqual(JSON.parse(result.stdout),{cycleFailed:true,browserRestartRequired:true,code:'DAECHION_ORDER_BROWSER_RESTART_REQUIRED'})
  assert.equal(result.stderr.trim(),'DAECHION_ORDER_BROWSER_RESTART_REQUIRED')
  assert.equal((result.stdout+result.stderr).includes('must-not-print'),false)
})

test('a new process rechecks cached READY and isolates unavailable browser credentials from payment reads',async()=>{
  const db=loopDatabase(),runs=[],deliveries=[]
  const service=worker.runtime({...loopEnv,DAECHION_CONTENT_BROWSER_ENABLED:'false',DAECHION_BROWSER_STORAGE_STATE:'private-invalid-auth'},
    {withClient:db.withClient,providers:{payment:{accountId:'fixture'}},
      processOrder:async(_id,flags)=>runs.push(flags),deliverOrder:async(_id,flags)=>deliveries.push(flags)})
  const result=await service.cycle()
  assert.equal(result.sessionReady,false);assert.equal(result.processed,1)
  assert.deepEqual(runs,[{send:false,read:true,enroll:false}]);assert.equal(deliveries.length,1)
  assert.ok(db.calls.some(row=>row.sql.startsWith('UPDATE daechion_orders.scheduler_sessions')&&row.args[1]==='FAILED'))
  assert.equal(JSON.stringify(db.calls).includes('private-invalid-auth'),false)
})
test('missing new-checkout secret defers only billing while existing payment and enrollment work continues',async()=>{
  const db=loopDatabase(),runs=[]
  const service=worker.runtime({...loopEnv,DAECHION_ORDER_SEND_ENABLED:'true'},
    {withClient:db.withClient,providers:{payment:{accountId:'fixture'},api:{},daechion:{refreshSession:async()=>({refreshed:true})}},
      processOrder:async(_id,flags)=>runs.push(flags),deliverOrder:async()=>{}})
  const result=await service.cycle()
  assert.equal(result.processed,1);assert.deepEqual(runs,[{send:false,read:true,enroll:true}])
  const once=worker.runtime({...base,...loopEnv,DAECHION_ORDER_LOOP_ENABLED:'false',DAECHION_ORDER_SEND_ENABLED:'true'},
    {withClient:db.withClient,providers:{payment:{accountId:'fixture'},api:{},daechion:{}},processOrder:async()=>{},deliverOrder:async()=>{}})
  assert.deepEqual((await once.once(id)).deferredPhases,['billing'])
})
test('a cycle error drains its boundary and retries on the next interval without exposing upstream details',async()=>{
  const controller=new AbortController(),writes=[];let cycles=0,waits=0
  await worker.main({argv:['--loop'],env:loopEnv,signal:controller.signal,write:value=>writes.push(value),
    makeRuntime:()=>({check:async()=>{},cycle:async()=>{if(++cycles===1)throw Error('private-database-error');return {processed:1}}}),
    wait:async()=>{if(++waits===2)controller.abort()}})
  assert.equal(cycles,2);assert.deepEqual(writes,[{cycleFailed:true,code:'ORDER_CYCLE_UNAVAILABLE'},{processed:1}])
  assert.equal(JSON.stringify(writes).includes('private-database-error'),false)
})
test('explicit checks expose incomplete provider readiness without starting a business cycle',async()=>{
  const writes=[]
  await assert.rejects(worker.main({argv:['--check'],env:{},write:value=>writes.push(value),
    makeRuntime:()=>({check:async()=>({schemaChecked:true,active:true,providersReady:{payment:true,message:false}}),
      cycle:async()=>assert.fail('A check must never run a cycle')})}),/ORDER_PROVIDER_CONFIGURATION_REQUIRED/)
  assert.deepEqual(writes,[{schemaChecked:true,active:true,providersReady:{payment:true,message:false}}])
})
test('one selected order flows through processing then delivery; a processing exception is held and never sends a ready message',async()=>{
  const env={...base,DAECHION_ORDER_PAYMENT_READ_ENABLED:'true',DAECHION_ORDER_READY_MESSAGE_ENABLED:'true',DAECHION_ACCESS_POLICY_VERIFIED:'true'}
  const events=[],phase=[]
  const options={withClient:fakeDatabase(events),providers:{payment:{accountId:'fixture'},message:{}},
    processOrder:async(value,flags)=>{assert.equal(value,id);assert.deepEqual(flags,{send:false,read:true,enroll:false});phase.push('process')},
    deliverOrder:async(value,flags)=>{assert.equal(value,id);assert.equal(flags.message,true);phase.push('deliver')}}
  assert.deepEqual(await worker.runtime(env,options).once(id),{processed:true,processingFailed:false,deliveryFailed:false})
  assert.deepEqual(phase,['process','deliver'])
  for(const delivered of [{message:'UNKNOWN',sheets:'DISABLED'},{message:'SENT',sheets:'UNKNOWN'}]){
    assert.deepEqual(await worker.runtime(env,{...options,deliverOrder:async()=>delivered}).once(id),{processed:true,processingFailed:false,deliveryFailed:true})
  }
  const failed=worker.runtime(env,{...options,processOrder:async()=>{throw Error('private upstream data')},deliverOrder:async(_value,flags)=>{
    assert.equal(flags.message,false);assert.ok(events.some(e=>e.args?.includes('worker_execution_unknown')))
  }})
  assert.deepEqual(await failed.once(id),{processed:true,processingFailed:true,deliveryFailed:false})
  assert.equal(JSON.stringify(events).includes('private upstream data'),false)
})
