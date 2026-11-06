import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import worker from '../workers/daechion/billing.cjs'
import apiCheck from '../scripts/daechion-api-check.cjs'

test('disabled provider phases do not require billing, SMS, Daechion or Google credentials',async()=>{
  const service=worker.runtime({DAECHION_SHEETS_ENABLED:'true',DAECHION_READY_MESSAGE_ENABLED:'true',DAECHION_ENROLLMENT_ENABLED:'true',GOOGLE_SERVICE_ACCOUNT_JSON:'not valid JSON'})
  const result=await service.cycle(false)
  assert.deepEqual(result,{sent:0,unknown:0,skipped:0,failed:0,checked:0,enrolled:0,review:0,sheets:0,messages:0,deferred:0})
  await assert.rejects(service.setupSheets(),/separate new spreadsheet/)
})

test('API preflight checks configuration, tenant and scopes before listing or any student reads',async()=>{
  const env={DAECHION_API_KEY:'fake-only',DAECHION_TENANT_ID:'test-tenant'}
  const scopes=['students:read','students:write','lectures:read','enrollments:write']
  let reads=0
  const service={me:async()=>({tenantId:'test-tenant',scopes}),lectures:async()=>{reads++;return [{id:10,name:'검수 강의',opened:true,weeklyLectures:[{id:100}]}]},student:async()=>{throw Error('unexpected')},students:async()=>{throw Error('unexpected')}}
  await assert.rejects(apiCheck.runApiCheck(['--create'],env,service),/INVALID_API_CHECK_ARGUMENTS/)
  await assert.rejects(apiCheck.runApiCheck([],{},service),/API_CHECK_CONFIGURATION_REQUIRED/)
  await assert.rejects(apiCheck.runApiCheck([],{...env,DAECHION_TENANT_ID:'wrong'},service),/API_CHECK_TENANT_MISMATCH/)
  await assert.rejects(apiCheck.runApiCheck([],env,{...service,me:async()=>({tenantId:'test-tenant',scopes:['lectures:read']})}),/API_CHECK_SCOPE_MISSING/)
  assert.equal(reads,0)
  const result=await apiCheck.runApiCheck([],env,service)
  assert.equal(result.readOnly,true);assert.equal(result.lectureCount,1);assert.equal(result.identityLookup.checked,false)
  assert.equal(JSON.stringify(result).includes(env.DAECHION_API_KEY),false)
})

test('automatic enrollment and readiness messages stop before provider calls until actual file access is verified',async()=>{
  for(const verified of [undefined,'false']){
    const runtime=worker.runtime({DAECHION_ACCESS_POLICY_VERIFIED:verified})
    await assert.rejects(runtime.cycle(true,{enrollmentEnabled:true,paymentsEnabled:true}),/ACCESS_POLICY_VERIFICATION_REQUIRED/)
    await assert.rejects(runtime.cycle(false,{readyMessagesEnabled:true}),/ACCESS_POLICY_VERIFICATION_REQUIRED/)
    assert.equal((await runtime.cycle(false)).sent,0)
  }
})

test('optional phone lookup preflight checks both guardian slots including an inactive student without exposing phones',async()=>{
  const env={DAECHION_API_KEY:'fake-only',DAECHION_TENANT_ID:'test-tenant'},calls=[]
  const student={id:77,name:'개인정보 검수',studentPhoneNumber:'010-0000-0001',parentPhoneNumber:'01000000002',parentPhoneNumber2:'01000000003',active:false}
  const service={me:async()=>({tenantId:'test-tenant',scopes:['students:read','students:write','lectures:read','enrollments:write']}),lectures:async()=>[],student:async id=>{assert.equal(id,77);return student},students:async(phone,name)=>{assert.equal(name,'');calls.push(phone);return [student]}}
  const result=await apiCheck.runApiCheck(['--student-id','77'],env,service)
  assert.deepEqual(calls,['01000000001','01000000002','01000000003'])
  assert.deepEqual(result.identityLookup,{checked:true,phoneKinds:['studentPhoneNumber','parentPhoneNumber','parentPhoneNumber2'],inactiveStudent:true})
  assert.equal(/0100000000|개인정보 검수|fake-only/.test(JSON.stringify(result)),false)
  await assert.rejects(apiCheck.runApiCheck(['--student-id','77'],env,{...service,students:async()=>[]}),/API_CHECK_PHONE_LOOKUP_INCOMPLETE/)
  const missing={...student,studentPhoneNumber:null,parentPhoneNumber:null,parentPhoneNumber2:null}
  await assert.rejects(apiCheck.runApiCheck(['--student-id','77'],env,{...service,student:async()=>missing}),/API_CHECK_STUDENT_PHONE_MISSING/)
})

test('read-only preflight selects a unique lecture ID and rejects closed or empty targets before student lookup',async()=>{
  const env={DAECHION_API_KEY:'fake-only',DAECHION_TENANT_ID:'test-tenant'}
  const lectures=[{id:6006577,name:'同名',opened:true,weeklyLectures:[{id:101}]},{id:99,name:'同名',opened:true,weeklyLectures:[{id:102}]}]
  let reads=0
  const service={me:async()=>({tenantId:'test-tenant',scopes:['students:read','students:write','lectures:read','enrollments:write']}),lectures:async()=>lectures,
    student:async()=>{reads++;throw Error('Unexpected student lookup')},students:async()=>{throw Error('Unexpected phone lookup')},
    enroll:async()=>{throw Error('Must not enroll')},createStudent:async()=>{throw Error('Must not create')}}
  const result=await apiCheck.runApiCheck(['--lecture-id','6006577'],env,service)
  assert.deepEqual(result.selectedLecture,{id:6006577,name:'同名',opened:true,weeklyLectureIds:[101]})
  assert.equal(result.readOnly,true)
  for(const [item,code] of [[undefined,'NOT_FOUND'],[{...lectures[0],opened:false},'CLOSED'],[{...lectures[0],weeklyLectures:[]},'EMPTY'],
    [{...lectures[0],weeklyLectures:[{id:101},{id:101}]},'DUPLICATE_WEEK_ID']]){
    await assert.rejects(apiCheck.runApiCheck(['--student-id','1','--lecture-id','6006577'],env,{...service,lectures:async()=>item?[item]:[]}),new RegExp(code))
  }
  for(const args of [['--lecture-id'],['--lecture-id','0'],['--lecture-id','6006577','--lecture-id','99'],['--lecture-id','9999999999999999999']])
    await assert.rejects(apiCheck.runApiCheck(args,env,service),/INVALID_API_CHECK_ARGUMENTS/)
  assert.equal(reads,0)
})

test('API check CLI refuses missing credentials without printing environment secrets',()=>{
  const result=spawnSync(process.execPath,['scripts/daechion-api-check.cjs'],{cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:10000,env:{...process.env,DAECHION_API_KEY:'',DAECHION_TENANT_ID:'',PRIVATE_TEST_MARKER:'must-not-print'}})
  assert.equal(result.status,1);assert.equal(result.stdout,'');assert.match(result.stderr,/^API_CHECK_CONFIGURATION_REQUIRED\s*$/)
})

test('default disabled worker CLI exits without loading a database or provider', () => {
  const result = spawnSync(process.execPath, ['workers/daechion/billing.cjs'], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 10000,
    env: { ...process.env, DAECHION_BILLING_WORKER_ENABLED: '', DAECHION_DATABASE_URL: 'must-not-connect', PAYSSAM_API_KEY: 'must-not-print' },
  })
  assert.equal(result.status, 0)
  assert.deepEqual(JSON.parse(result.stdout), { enabled: false })
  assert.equal(result.stderr, '')
})

test('connection check never starts a send cycle even when sending and --once are enabled', async () => {
  const calls = [], output = []
  await worker.main({ argv: ['--check', '--once'], env: { DAECHION_BILLING_WORKER_ENABLED: 'true', DAECHION_BILLING_SEND_ENABLED: 'true', DAECHION_PAYMENT_READ_ENABLED:'true', DAECHION_ENROLLMENT_ENABLED:'true' },
    makeRuntime: () => ({ check: async () => { calls.push('check') }, cycle: async () => { calls.push('send') } }),
    write: value => output.push(value),
  })
  assert.deepEqual(calls, ['check'])
  assert.deepEqual(output, [{ ready: true, schema: 'daechion_automation', sending: false }])
})

test('once mode checks readiness and passes explicit send permission; failed checks cannot send', async () => {
  const calls = []
  for (const flag of [undefined, 'false', 'true']) {
    await worker.main({ argv: ['--once'], env: { DAECHION_BILLING_WORKER_ENABLED: 'true', DAECHION_BILLING_SEND_ENABLED: flag },
      makeRuntime: () => ({ check: async () => {}, cycle: async enabled => { calls.push(enabled); return {} } }), write: () => {},
    })
  }
  assert.deepEqual(calls, [false, false, true])
  await assert.rejects(worker.main({ argv: ['--once'], env: { DAECHION_BILLING_WORKER_ENABLED: 'true', DAECHION_BILLING_SEND_ENABLED: 'true' },
    makeRuntime: () => ({ check: async () => { throw Error('not ready') }, cycle: async () => { throw Error('must not send') } }),
  }), /not ready/)
  await assert.rejects(worker.main({ argv: ['--check'], env: {} }), /DISABLED/)
  await assert.rejects(worker.main({ argv: ['--send-everything'], env: {} }), /INVALID_WORKER_ARGUMENT/)
})

test('payment reads and enrollment have separate default-off controls', async () => {
  const flags = []
  for (const env of [{}, {DAECHION_PAYMENT_READ_ENABLED:'true'}, {DAECHION_PAYMENT_READ_ENABLED:'true',DAECHION_ENROLLMENT_ENABLED:'true'}]) {
    await worker.main({argv:['--once'],env:{DAECHION_BILLING_WORKER_ENABLED:'true',...env},
      makeRuntime:()=>({check:async()=>{},cycle:async(_send,options)=>{flags.push(options);return {}}}),write:()=>{}})
  }
  assert.deepEqual(flags,[{paymentsEnabled:false,enrollmentEnabled:false,sheetsEnabled:false,readyMessagesEnabled:false},{paymentsEnabled:true,enrollmentEnabled:false,sheetsEnabled:false,readyMessagesEnabled:false},{paymentsEnabled:true,enrollmentEnabled:true,sheetsEnabled:false,readyMessagesEnabled:false}])
})

test('explicit Sheets setup never enters the financial cycle and --check takes precedence',async()=>{
  for(const check of [false,true]){
    const calls=[]
    await worker.main({argv:check?['--setup-sheets','--check']:['--setup-sheets'],env:{DAECHION_BILLING_WORKER_ENABLED:'true'},
      makeRuntime:()=>({check:async()=>{calls.push('check')},setupSheets:async()=>{calls.push('setup')},cycle:async()=>{calls.push('financial')}}),write:()=>{}})
    assert.deepEqual(calls,check?['check']:['check','setup'])
  }
})

test('session-only mode cannot send bills, read payments, enroll, publish Sheets or send messages even with all flags set',async()=>{
  for(const success of [true,false]){
    const calls=[],output=[]
    await worker.main({argv:['--session-only','--once','--setup-sheets'],env:{DAECHION_BILLING_WORKER_ENABLED:'true',DAECHION_SESSION_MAINTENANCE_ENABLED:'true',
      DAECHION_BILLING_SEND_ENABLED:'true',DAECHION_PAYMENT_READ_ENABLED:'true',DAECHION_ENROLLMENT_ENABLED:'true',DAECHION_SHEETS_ENABLED:'true',DAECHION_READY_MESSAGE_ENABLED:'true'},
    makeRuntime:()=>({check:async()=>calls.push('check'),maintainSession:async()=>{calls.push('session');if(!success)throw Error('private error');return {refreshed:true}},
      cycle:async()=>{throw Error('Must not enter financial cycle')},setupSheets:async()=>{throw Error('Must not publish Sheets')}}),write:value=>output.push(value)})
    assert.deepEqual(calls,['check','session']);assert.deepEqual(output,[{sessionMaintenance:true,refreshed:success,sending:false}])
  }
  await assert.rejects(worker.main({argv:['--session-only','--once'],env:{DAECHION_BILLING_WORKER_ENABLED:'true'},makeRuntime:()=>({check:async()=>{}})}),/SESSION_MAINTENANCE_DISABLED/)
})
