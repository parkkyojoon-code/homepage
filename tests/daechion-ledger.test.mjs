import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { PGlite } from '@electric-sql/pglite'
import pg from 'pg'
import ledger from '../.daechion-test-build/lib/daechion/ledger.js'
import sheetView from '../.daechion-test-build/lib/daechion/sheets-view.js'
import intake from '../.daechion-test-build/lib/daechion/intake.js'
import billing from '../.daechion-test-build/lib/daechion/billing.js'
import payment from '../.daechion-test-build/lib/daechion/payment.js'
import enrollment from '../.daechion-test-build/lib/daechion/enrollment.js'
import identityStore from '../.daechion-test-build/lib/daechion/identity-store.js'
import intakeHttp from '../.daechion-test-build/lib/daechion/intake-http.js'
import publisher from '../.daechion-test-build/lib/daechion/sheets-publisher.js'
import sheetsWorker from '../.daechion-test-build/lib/daechion/sheets-worker.js'
import admin from '../.daechion-test-build/lib/daechion/admin.js'
import adminHttp from '../.daechion-test-build/lib/daechion/admin-http.js'
import readyMessage from '../.daechion-test-build/lib/daechion/ready-message.js'
import migrations from '../scripts/daechion-migrations.cjs'

const { createApplication, reserveBill, applicationSnapshotSchema } = ledger
const { applicationSheetRow, SHEET_HEADERS, sheetsDestination } = sheetView
const input = {
  studentHistory:'EXISTING',
  productId: 'new-short-course', productTitle: '신규 단기 강의', tuitionWon: 1000, textbookWon: 200, totalWon: 1200,
  studentName: '검수학생', guardianName: '검수학부모', studentPhone: '010-0000-0001', payerPhone: '010-0000-0003',
  guardianPhone: '010-0000-0002', applicantType: 'GUARDIAN', mode: 'ONLINE', campus: '', selectedSubjects: ['미적'],
  additionalInputs: [{ label: '신청 메모', value: '검수용' }], confirmPayment: true, agreePrivacy: true, noticeVersion: 'test-only',
}
const bindings = [{ productId: input.productId, lectureIds: [10, 11] }]
async function database() {
  const value = process.env.DAECHION_TEST_POSTGRES_URL
  if (!value) return new PGlite()
  const url = new URL(value)
  if (!['127.0.0.1','localhost'].includes(url.hostname) || url.pathname !== '/daechion_ci' || url.username !== 'daechion_ci') {
    throw Error('Tests require the isolated loopback daechion_ci database')
  }
  const client = new pg.Client({connectionString:value})
  await client.connect()
  // This dedicated CI database contains no user data; never use the application URL here.
  await client.query('DROP SCHEMA IF EXISTS daechion_automation CASCADE; DROP TABLE IF EXISTS public.legacy_students;')
  return {isPostgres:true,query:(sql,values)=>client.query(sql,values),exec:sql=>client.query(sql),close:()=>client.end()}
}
function migrationClient(db) {
  return { query: async(sql,values) => {
    // Advisory lock behavior must also be tested on real PostgreSQL before deployment.
    if (!db.isPostgres && sql === 'SELECT pg_advisory_xact_lock(61106, 1501)') return { rows: [] }
    if (!values && sql.includes(';')) { await db.exec(sql); return { rows: [] } }
    return db.query(sql,values)
  } }
}

test('isolated ledger and separate Sheets projection',{timeout:90000},async t => {
  const db = await database()
  const client = { query: (sql, values) => !db.isPostgres && /^SELECT pg_advisory_xact_lock\(6110[78],/.test(sql) ? Promise.resolve({rows:[]}) : db.query(sql, values) }
  const make = (key = randomUUID(), data = input) => createApplication(client, key, data, bindings, 'PROCESS_2')
  let applicationId
  try {
    await db.exec('CREATE TABLE legacy_students(id integer PRIMARY KEY); INSERT INTO legacy_students VALUES(7);')
    const migrator = migrationClient(db)
    await t.test('migration status is read-only; tracked application is repeatable and checksum protected',async()=>{
      assert.deepEqual(await migrations.status(migrator),{tracked:false,pending:['001_initial.sql','002_identity.sql','003_admin_messages.sql']})
      assert.equal((await db.query("SELECT to_regnamespace('daechion_automation') AS name")).rows[0].name,null)
      assert.deepEqual(await migrations.migrate(migrator),['001_initial.sql','002_identity.sql','003_admin_messages.sql'])
      assert.deepEqual(await migrations.migrate(migrator),[])
      await assert.rejects(migrations.migrate(migrator,{...migrations.loadMigration(),checksum:'changed'}),/AUTOMATION_MIGRATION_HISTORY_MISMATCH/)
    })
    await t.test('new schema preserves existing public tables and creates a durable sheet job only',async()=>{
      const result = await make(); applicationId = result.id
      assert.equal(result.created,true)
      assert.deepEqual((await db.query('SELECT id FROM legacy_students')).rows,[{id:7}])
      const row = (await db.query('SELECT * FROM daechion_automation.applications WHERE id=$1',[applicationId])).rows[0]
      assert.equal(row.submission.guardianName,input.guardianName)
      assert.equal(row.submission.payerPhone,'01000000003'); assert.equal(row.submission.guardianPhone,'01000000002')
      assert.equal(row.payment_state,'PENDING'); assert.equal(row.notification_state,'NOT_READY')
      assert.equal((await db.query('SELECT * FROM daechion_automation.registrations WHERE application_id=$1',[applicationId])).rows.length,2)
      assert.deepEqual((await db.query('SELECT kind FROM daechion_automation.outbox WHERE application_id=$1',[applicationId])).rows,[{kind:'SHEETS'}])
    })
    await t.test('same request key is replayed without duplicate applications or jobs; changed data is rejected',async()=>{
      const key = randomUUID(), first = await make(key)
      assert.deepEqual(await make(key),{id:first.id,created:false})
      await assert.rejects(make(key,{...input,studentName:'다른학생'}),/request_key_conflict/)
      assert.equal((await db.query('SELECT id FROM daechion_automation.applications WHERE request_key=$1',[key])).rows.length,1)
      assert.equal((await db.query('SELECT id FROM daechion_automation.outbox WHERE application_id=$1',[first.id])).rows.length,1)
    })
    await t.test('intake persists server-derived application and targets atomically without claiming billing success',async()=>{
      const product = {id:'intake-course',name:'신규 접수 검수',visible:true,purchaseProcess:'PROCESS_2',
        modes:{online:{enabled:true,price:1000},offline:{enabled:false,price:0}},textbook:{included:true,price:200}}
      const request = {requestKey:randomUUID(),productId:product.id,applicantType:'STUDENT',studentHistory:'NEW',studentName:'검수학생',
        guardianName:'검수학부모',studentPhone:'01000000001',payerPhone:'01000000003',guardianPhone:'01000000002',
        mode:'ONLINE',expectedTotalWon:1200,confirmPayment:true,agreePrivacy:true}
      const ports = {loadProduct:()=>product,bindings:[{productId:product.id,lectureIds:[30]}],withClient:run=>run(client)}
      const result = await intake.submitApplication(request,ports)
      assert.equal(result.status,'RECEIVED'); assert.equal(result.invoiceStatus,undefined)
      assert.deepEqual(await intake.submitApplication(request,ports),{...result,created:false})
      await assert.rejects(intake.submitApplication({...request,studentName:'다른학생'},ports),/REQUEST_CONFLICT/)
      const row = (await db.query('SELECT submission FROM daechion_automation.applications WHERE id=$1',[result.applicationId])).rows[0]
      assert.equal(row.submission.guardianName,request.guardianName)
      assert.equal(row.submission.guardianPhone,request.guardianPhone)
      assert.equal(row.submission.payerPhone,request.payerPhone)
      assert.deepEqual((await db.query('SELECT lecture_id::text AS lecture_id,state FROM daechion_automation.registrations WHERE application_id=$1',[result.applicationId])).rows,[{lecture_id:'30',state:'PENDING'}])
      assert.equal((await db.query('SELECT id FROM daechion_automation.bills WHERE application_id=$1',[result.applicationId])).rows.length,0)
      assert.deepEqual((await db.query('SELECT kind FROM daechion_automation.outbox WHERE application_id=$1',[result.applicationId])).rows,[{kind:'SHEETS'}])
    })
    await t.test('parallel PostgreSQL requests share one application and one sheet job',{skip:!db.isPostgres},async()=>{
      const clients = [new pg.Client({connectionString:process.env.DAECHION_TEST_POSTGRES_URL}),new pg.Client({connectionString:process.env.DAECHION_TEST_POSTGRES_URL})]
      try {
        await Promise.all(clients.map(client=>client.connect()))
        const key = randomUUID()
        const results = await Promise.all(clients.map(client=>createApplication(client,key,input,bindings,'PROCESS_2')))
        assert.equal(results[0].id,results[1].id)
        assert.deepEqual(results.map(result=>result.created).sort(),[false,true])
        assert.equal((await db.query('SELECT id FROM daechion_automation.outbox WHERE application_id=$1',[results[0].id])).rows.length,1)
      } finally { await Promise.all(clients.map(client=>client.end())) }
    })
    await t.test('billing sends one persisted numeric invoice to the payer and records seven-day waiting only after acknowledgement',async()=>{
      const created = await make(), calls = []
      const provider = {accountId:'mock-account',send:async job=>{calls.push(job);return 'SENT'}}
      const ports = {provider,withClient:run=>run(client)}
      assert.deepEqual(await billing.sendApplicationBill(created.id,false,ports),{outcome:'DISABLED'})
      assert.equal(calls.length,0)
      assert.equal((await db.query('SELECT id FROM daechion_automation.bills WHERE application_id=$1',[created.id])).rows.length,0)
      assert.deepEqual(await billing.sendApplicationBill(created.id,true,ports),{outcome:'SENT'})
      assert.deepEqual(await billing.sendApplicationBill(created.id,true,ports),{outcome:'SKIPPED'})
      assert.equal(calls.length,1)
      assert.equal(calls[0].recipientPhone,'01000000003')
      assert.match(calls[0].billId,/^9\d{19}$/)
      assert.equal(calls[0].amountWon,1200)
      assert.equal(calls[0].id,undefined)
      const bill = (await db.query('SELECT * FROM daechion_automation.bills WHERE application_id=$1',[created.id])).rows[0]
      assert.equal(bill.bill_id,calls[0].billId); assert.equal(bill.state,'SENT')
      assert.equal(new Date(bill.due_at)-new Date(bill.sent_at),7*86400000)
      assert.equal(await billing.recordBillSent(client,created.id,bill.id,'mock-account'),false)
      const app = (await db.query('SELECT payment_state,notification_state,review_code FROM daechion_automation.applications WHERE id=$1',[created.id])).rows[0]
      assert.deepEqual(app,{payment_state:'PENDING',notification_state:'NOT_READY',review_code:null})
      assert.equal((await db.query('SELECT id FROM daechion_automation.outbox WHERE application_id=$1',[created.id])).rows.length,4)
      assert.equal((await db.query("SELECT id FROM daechion_automation.outbox WHERE application_id=$1 AND kind='READY_MESSAGE'",[created.id])).rows.length,0)
    })
    await t.test('timeouts and worker crashes leave a durable unknown state that is never automatically resent',async()=>{
      const created = await make(); let calls = 0
      const ports = {provider:{accountId:'mock-account',send:async()=>{calls++;throw Error('private network error')}},withClient:run=>run(client)}
      assert.deepEqual(await billing.sendApplicationBill(created.id,true,ports),{outcome:'UNKNOWN'})
      assert.deepEqual(await billing.sendApplicationBill(created.id,true,ports),{outcome:'SKIPPED'})
      assert.equal(calls,1)
      const unknown = (await db.query('SELECT state,sent_at,due_at FROM daechion_automation.bills WHERE application_id=$1',[created.id])).rows[0]
      assert.deepEqual(unknown,{state:'SEND_UNKNOWN',sent_at:null,due_at:null})
      assert.equal((await db.query('SELECT review_code FROM daechion_automation.applications WHERE id=$1',[created.id])).rows[0].review_code,'bill_send_unknown')
      const crashed = await make()
      await billing.reserveApplicationBill(client,crashed.id,'mock-account')
      assert.ok(await billing.claimBillSend(client,crashed.id,'mock-account'))
      assert.equal(await billing.claimBillSend(client,crashed.id,'mock-account'),null)
      assert.deepEqual(await billing.sendApplicationBill(crashed.id,true,ports),{outcome:'SKIPPED'})
      assert.equal(calls,1)
    })
    await t.test('a lost acknowledgement database write cannot cause a second provider send',async()=>{
      const created = await make(); let sends = 0, connections = 0
      const provider = {accountId:'mock-account',send:async()=>{sends++;return 'SENT'}}
      await assert.rejects(billing.sendApplicationBill(created.id,true,{provider,withClient:async run=>{
        connections++;if(connections===3) throw Error('simulated connection loss');return run(client)
      }}),/BILLING_STORAGE_FAILED/)
      assert.deepEqual(await billing.sendApplicationBill(created.id,true,{provider,withClient:run=>run(client)}),{outcome:'SKIPPED'})
      assert.equal(sends,1)
    })
    await t.test('manual holds, paid applications and mismatched provider accounts cannot send a new bill',async()=>{
      const provider = {accountId:'mock-account',send:async()=>{throw Error('Unexpected provider call')}}
      for (const state of ["automation_state='HOLD'","payment_state='PAID'"]) {
        const created = await make()
        await db.query(`UPDATE daechion_automation.applications SET ${state} WHERE id=$1`,[created.id])
        assert.deepEqual(await billing.sendApplicationBill(created.id,true,{provider,withClient:run=>run(client)}),{outcome:'SKIPPED'})
      }
      const created = await make()
      await billing.reserveApplicationBill(client,created.id,'first-account')
      await assert.rejects(billing.reserveApplicationBill(client,created.id,'other-account'),/BILLING_ACCOUNT_MISMATCH/)
      await assert.rejects(billing.sendApplicationBill(created.id,true,{provider,withClient:run=>run(client)}),/BILLING_ACCOUNT_MISMATCH/)
      assert.deepEqual((await db.query('SELECT automation_state,review_code FROM daechion_automation.applications WHERE id=$1',[created.id])).rows,[{automation_state:'HOLD',review_code:'billing_account_mismatch'}])
    })
    await t.test('a manual hold during provider send is preserved when acknowledgement arrives',async()=>{
      const created = await make()
      const provider = {accountId:'mock-account',send:async()=>{
        await db.query("UPDATE daechion_automation.applications SET automation_state='HOLD',review_code='manual_hold' WHERE id=$1",[created.id]);return 'SENT'
      }}
      assert.deepEqual(await billing.sendApplicationBill(created.id,true,{provider,withClient:run=>run(client)}),{outcome:'SENT'})
      assert.deepEqual((await db.query('SELECT automation_state,review_code FROM daechion_automation.applications WHERE id=$1',[created.id])).rows,[{automation_state:'HOLD',review_code:'manual_hold'}])
    })
    await t.test('parallel PostgreSQL billing workers obtain one send claim',{skip:!db.isPostgres},async()=>{
      const created = await make();let sends = 0
      const ports = {provider:{accountId:'mock-account',send:async()=>{sends++;return 'SENT'}},withClient:async run=>{
        const separate = new pg.Client({connectionString:process.env.DAECHION_TEST_POSTGRES_URL});await separate.connect()
        try{return await run(separate)}finally{await separate.end()}
      }}
      const results = await Promise.all([billing.sendApplicationBill(created.id,true,ports),billing.sendApplicationBill(created.id,true,ports)])
      assert.deepEqual(results.map(result=>result.outcome).sort(),['SENT','SKIPPED'])
      assert.equal(sends,1)
    })
    await t.test('compiled worker checks the real isolated PostgreSQL without sending or reserving a bill',{skip:!db.isPostgres},async()=>{
      const before = (await db.query('SELECT count(*)::text AS n FROM daechion_automation.bills')).rows[0].n
      const result = spawnSync(process.execPath,['workers/daechion/billing.cjs','--check','--once'],{
        cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:20000,
        env:{...process.env,DAECHION_DATABASE_URL:process.env.DAECHION_TEST_POSTGRES_URL,
          DAECHION_BILLING_WORKER_ENABLED:'true',DAECHION_BILLING_SEND_ENABLED:'true',
          DAECHION_PAYMENT_READ_ENABLED:'true',DAECHION_ENROLLMENT_ENABLED:'true',DAECHION_IDENTITY_LOOKUP_VERIFIED:'true',DAECHION_API_KEY:'fake-key',DAECHION_TENANT_ID:'fake-tenant',
          DAECHION_READY_MESSAGE_ENABLED:'true',SOLAPI_API_KEY:'fake-key',SOLAPI_API_SECRET:'fake-secret',SOLAPI_SENDER:'01000000999',DAECHION_SHEETS_ENABLED:'false',
          PAYSSAM_API_KEY:'fake-test-key',PAYSSAM_MEMBER:'fake-member',PAYSSAM_MERCHANT:'fake-merchant',
          DAECHION_BILLING_CALLBACK_URL:'https://web.invalid/api/daechion/billing/callback'},
      })
      assert.equal(result.status,0,result.stderr)
      assert.deepEqual(JSON.parse(result.stdout),{ready:true,schema:'daechion_automation',sending:false})
      assert.equal((await db.query('SELECT count(*)::text AS n FROM daechion_automation.bills')).rows[0].n,before)
    })
    const paymentFixture = async (studentHistory='EXISTING') => {
      const result = await make(undefined,{...input,studentHistory})
      await billing.sendApplicationBill(result.id,true,{provider:{accountId:'payment-test',send:async()=> 'SENT'},withClient:run=>run(client)})
      return result.id
    }
    const observe = async (id, changes={}) => {
      const target = await payment.paymentTarget(client,id,'payment-test')
      const bill = (await db.query('SELECT sent_at,due_at FROM daechion_automation.bills WHERE id=$1',[target.recordId])).rows[0]
      return payment.applyPaymentObservation(client,target,{state:'F',billId:target.billId,amountWon:1200,paidAt:new Date(new Date(bill.sent_at).getTime()+1000).toISOString(),...changes})
    }
    const appRow = async id => (await db.query('SELECT * FROM daechion_automation.applications WHERE id=$1',[id])).rows[0]
    const student = {id:77,name:input.studentName,studentPhoneNumber:'01000000001',parentPhoneNumber:'01000000002',active:false}
    const fakeDaechion = (overrides={}) => ({students:async()=>[student],student:async()=>student,
      createStudent:async()=>{throw Error('unexpected create')},
      enroll:async(lectureId,studentId)=>({lectureId,studentId,enrolledWeeklyLectureIds:[100],alreadyEnrolledWeeklyLectureIds:[]}),...overrides})

    await t.test('a changed worker tenant cannot create accounts or grant the same numeric lecture ID in another academy',async()=>{
      const {id}=await make(undefined,{...input,studentHistory:'EXISTING',daechionTenantId:'tenant-original'})
      await billing.sendApplicationBill(id,true,{provider:{accountId:'payment-test',send:async()=> 'SENT'},withClient:run=>run(client)})
      await observe(id)
      let calls=0
      const service=fakeDaechion({students:async()=>{calls++;return [student]},enroll:async()=>{calls++;throw Error('wrong tenant must not call provider')}})
      assert.equal(await enrollment.enrollApplication(id,true,{tenantId:'tenant-other',daechion:service,withClient:run=>run(client)}),'REVIEW')
      assert.equal(calls,0);assert.equal((await appRow(id)).review_code,'enrollment_tenant_mismatch')
      assert.equal((await appRow(id)).submission.daechionTenantId,'tenant-original')
    })
    await t.test('verified timely payments are replay-safe and stale unpaid responses cannot undo them',async()=>{
      const id = await paymentFixture(), target = await payment.paymentTarget(client,id,'payment-test')
      assert.equal(await observe(id),'PAID')
      const version = (await appRow(id)).version
      assert.equal(await observe(id),'PAID')
      assert.equal(String((await appRow(id)).version),String(version))
      assert.equal(await payment.applyPaymentObservation(client,target,{state:'W',billId:target.billId,amountWon:null,paidAt:null}),'STALE')
      assert.equal((await appRow(id)).payment_state,'PAID')
    })
    await t.test('only confirmed unpaid invoices expire; timely payment discovered after closure resumes, late payment stays held',async()=>{
      for (const kind of ['unknown','unpaid','timely','late']) {
        const id = await paymentFixture()
        await db.query("UPDATE daechion_automation.bills SET sent_at=now()-interval '8 days',due_at=now()-interval '1 day' WHERE application_id=$1",[id])
        await observe(id,kind==='unknown'?{state:'UNKNOWN'}:{state:'W',amountWon:null,paidAt:null})
        assert.equal((await appRow(id)).automation_state,kind==='unknown'?'ACTIVE':'CLOSED')
        if(kind==='timely'||kind==='late') {
          const bill = (await db.query('SELECT due_at FROM daechion_automation.bills WHERE application_id=$1',[id])).rows[0]
          await observe(id,{paidAt:new Date(new Date(bill.due_at).getTime()+(kind==='timely'?-1000:1000)).toISOString()})
          const app = await appRow(id)
          assert.equal(app.payment_state,'PAID');assert.equal(app.automation_state,kind==='timely'?'ACTIVE':'HOLD')
          assert.equal(app.review_code,kind==='timely'?null:'late_payment')
          assert.equal((await db.query('SELECT state FROM daechion_automation.registrations WHERE application_id=$1 LIMIT 1',[id])).rows[0].state,kind==='timely'?'PENDING':'STOPPED')
        }
      }
    })
    await t.test('wrong amounts, missing approval times, manual holds and unknown sends never become enrollment-eligible',async()=>{
      for(const change of [{amountWon:1199},{paidAt:null}]) {
        const id = await paymentFixture();await observe(id,change)
        assert.equal((await appRow(id)).automation_state,'HOLD')
        assert.equal(await enrollment.claimEnrollment(client,id),null)
      }
      const held = await paymentFixture()
      await db.query("UPDATE daechion_automation.applications SET automation_state='HOLD',review_code='manual_hold' WHERE id=$1",[held])
      await observe(held)
      assert.equal((await appRow(held)).review_code,'manual_hold')
      assert.equal(await enrollment.claimEnrollment(client,held),null)
      const unknown = (await make()).id
      await billing.reserveApplicationBill(client,unknown,'payment-test');await billing.claimBillSend(client,unknown,'payment-test')
      await observe(unknown,{paidAt:new Date().toISOString()})
      assert.equal((await appRow(unknown)).automation_state,'HOLD')
      assert.equal(await enrollment.claimEnrollment(client,unknown),null)
    })
    await t.test('unpaid applicants cannot call Daechion; paid new students receive all targets and one ready-message job',async()=>{
      const unpaid = (await make()).id
      const forbidden = fakeDaechion({students:async()=>{throw Error('must not lookup unpaid')}})
      assert.equal(await enrollment.enrollApplication(unpaid,true,{daechion:forbidden,withClient:run=>run(client)}),'SKIPPED')
      const id = await paymentFixture('NEW');await observe(id)
      let created = null, createCalls = 0, enrollCalls = 0
      const daechion = fakeDaechion({students:async()=>created?[created]:[],createStudent:async data=>{
        createCalls++;assert.deepEqual(data,{name:input.studentName,studentPhone:'01000000001',guardianPhone:'01000000002'});created=student;return student
      },enroll:async(lectureId,studentId)=>{enrollCalls++;return {lectureId,studentId,enrolledWeeklyLectureIds:[100],alreadyEnrolledWeeklyLectureIds:[]}}})
      const ports = {daechion,withClient:run=>run(client)}
      assert.equal(await enrollment.enrollApplication(id,true,ports),'DONE')
      assert.equal((await appRow(id)).notification_state,'NOT_READY')
      assert.equal(await enrollment.enrollApplication(id,true,ports),'DONE')
      assert.equal(await enrollment.enrollApplication(id,true,ports),'SKIPPED')
      assert.equal(createCalls,1);assert.equal(enrollCalls,2)
      assert.equal((await appRow(id)).notification_state,'PENDING')
      assert.equal((await db.query("SELECT id FROM daechion_automation.outbox WHERE application_id=$1 AND kind='READY_MESSAGE'",[id])).rows.length,1)
      await observe(id,{state:'C',paidAt:null})
      assert.equal((await appRow(id)).payment_state,'CANCELLED')
      assert.equal((await appRow(id)).automation_state,'HOLD')
      assert.ok((await db.query('SELECT state FROM daechion_automation.registrations WHERE application_id=$1',[id])).rows.every(row=>row.state==='DONE'))
      assert.equal((await db.query("SELECT state FROM daechion_automation.outbox WHERE application_id=$1 AND kind='READY_MESSAGE'",[id])).rows[0].state,'FAILED')
    })
    await t.test('unknown enrollment writes and expired claims require review rather than replay',async()=>{
      const id = await paymentFixture();await observe(id);let calls = 0
      const ports = {daechion:fakeDaechion({enroll:async()=>{calls++;throw Error('private timeout')}}),withClient:run=>run(client)}
      assert.equal(await enrollment.enrollApplication(id,true,ports),'REVIEW')
      assert.equal(await enrollment.enrollApplication(id,true,ports),'SKIPPED');assert.equal(calls,1)
      const crashed = await paymentFixture();await observe(crashed)
      assert.ok(await enrollment.claimEnrollment(client,crashed))
      await db.query("UPDATE daechion_automation.registrations SET lease_until=now()-interval '1 second' WHERE application_id=$1 AND state='RUNNING'",[crashed])
      assert.equal(await enrollment.claimEnrollment(client,crashed),null)
      assert.equal((await appRow(crashed)).review_code,'enrollment_unknown')
    })
    await t.test('history mismatch is stored for Sheets and blocks both account creation and registration',async()=>{
      const id = await paymentFixture('NEW');await observe(id);let writes = 0
      const ports = {daechion:fakeDaechion({createStudent:async()=>{writes++;return student},enroll:async()=>{writes++;throw Error('must not enroll')}}),withClient:run=>run(client)}
      assert.equal(await enrollment.enrollApplication(id,true,ports),'REVIEW');assert.equal(writes,0)
      const check = (await db.query('SELECT status,detected_type,reason_code FROM daechion_automation.identity_checks WHERE application_id=$1',[id])).rows[0]
      assert.deepEqual(check,{status:'REVIEW',detected_type:'EXISTING',reason_code:'identity_declaration_mismatch'})
      const view = {id,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),snapshot:applicationSnapshotSchema.parse({...input,studentHistory:'NEW'}),
        billingState:'SENT',allBillIds:[],paymentState:'PAID',lectureIds:[10],registrationState:'REVIEW',notificationState:'NOT_READY',
        identity:{status:check.status,detected:check.detected_type,reason:check.reason_code}}
      const row = Object.fromEntries(SHEET_HEADERS.map((key,index)=>[key,applicationSheetRow(view)[index]]))
      assert.equal(row['중복 수강생 확인'],'확인 필요');assert.match(row['중복 확인 사유'],/다름/)
      assert.throws(()=>applicationSheetRow({...view,identity:{status:'PASSED',detected:'NEW'}}),/Invalid identity pass/)
    })
    await t.test('phone claims prevent overlapping applications and a failed multi-phone claim rolls back fully',async()=>{
      const first = await make(),second = await make()
      await identityStore.claimIdentityPhones(client,first.id,applicationSnapshotSchema.parse(input))
      await assert.rejects(identityStore.claimIdentityPhones(client,second.id,applicationSnapshotSchema.parse({...input,studentPhone:'01000000000'})),/identity_phone_busy/)
      assert.equal((await db.query('SELECT phone FROM daechion_automation.identity_phone_claims WHERE application_id=$1',[second.id])).rows.length,0)
      await identityStore.releaseIdentityPhones(client,first.id)
      await identityStore.claimIdentityPhones(client,second.id,applicationSnapshotSchema.parse(input))
      await identityStore.releaseIdentityPhones(client,second.id)
    })
    await t.test('unknown student creation keeps phone claims and makes another overlapping application require review',async()=>{
      const first = await paymentFixture('NEW');await observe(first);let creates = 0
      const ports = {daechion:fakeDaechion({students:async()=>[],createStudent:async()=>{creates++;throw Error('unknown creation')}}),withClient:run=>run(client)}
      assert.equal(await enrollment.enrollApplication(first,true,ports),'REVIEW')
      const second = await paymentFixture('NEW');await observe(second)
      assert.equal(await enrollment.enrollApplication(second,true,ports),'REVIEW');assert.equal(creates,1)
      assert.equal((await db.query('SELECT status,reason_code FROM daechion_automation.identity_checks WHERE application_id=$1',[first])).rows[0].reason_code,'identity_create_unknown')
      assert.equal((await db.query('SELECT reason_code FROM daechion_automation.identity_checks WHERE application_id=$1',[second])).rows[0].reason_code,'identity_phone_busy')
      assert.equal((await db.query('SELECT phone FROM daechion_automation.identity_phone_claims WHERE application_id=$1',[first])).rows.length,2)
      // Test cleanup only. Production must reconcile the unknown write before releasing.
      await identityStore.releaseIdentityPhones(client,first)
    })
    await t.test('parallel PostgreSQL applications cannot both claim the same login numbers',{skip:!db.isPostgres},async()=>{
      const apps = [await make(),await make()]
      const clients = apps.map(()=>new pg.Client({connectionString:process.env.DAECHION_TEST_POSTGRES_URL}))
      try {
        await Promise.all(clients.map(item=>item.connect()))
        const results = await Promise.allSettled(clients.map((item,index)=>identityStore.claimIdentityPhones(item,apps[index].id,applicationSnapshotSchema.parse(input))))
        assert.equal(results.filter(item=>item.status==='fulfilled').length,1)
        assert.equal(results.filter(item=>item.status==='rejected').length,1)
        assert.equal((await db.query('SELECT DISTINCT application_id FROM daechion_automation.identity_phone_claims WHERE application_id=ANY($1::uuid[])',[apps.map(item=>item.id)])).rows.length,1)
      } finally {
        await Promise.all(clients.map(item=>item.end()))
        for(const app of apps) await identityStore.releaseIdentityPhones(client,app.id)
      }
    })
    await t.test('cancellation during external enrollment suppresses completion and preserves manual revocation policy',async()=>{
      const id = await paymentFixture();await observe(id)
      const ports = {daechion:fakeDaechion({enroll:async(lectureId,studentId)=>{
        await observe(id,{state:'C',paidAt:null});return {lectureId,studentId,enrolledWeeklyLectureIds:[100],alreadyEnrolledWeeklyLectureIds:[]}
      }}),withClient:run=>run(client)}
      assert.equal(await enrollment.enrollApplication(id,true,ports),'REVIEW')
      assert.equal((await appRow(id)).review_code,'payment_cancelled')
      assert.equal((await appRow(id)).notification_state,'NOT_READY')
      assert.equal((await db.query("SELECT id FROM daechion_automation.outbox WHERE application_id=$1 AND kind='READY_MESSAGE'",[id])).rows.length,0)
    })
    await t.test('parallel PostgreSQL enrollment workers cannot duplicate the same target',{skip:!db.isPostgres},async()=>{
      const made = await createApplication(client,randomUUID(),input,[{productId:input.productId,lectureIds:[10]}],'PROCESS_2')
      await billing.sendApplicationBill(made.id,true,{provider:{accountId:'payment-test',send:async()=> 'SENT'},withClient:run=>run(client)})
      await observe(made.id);let calls = 0
      const ports = {daechion:fakeDaechion({enroll:async(lectureId,studentId)=>{calls++;return {lectureId,studentId,enrolledWeeklyLectureIds:[100],alreadyEnrolledWeeklyLectureIds:[]}}}),withClient:async run=>{
        const separate = new pg.Client({connectionString:process.env.DAECHION_TEST_POSTGRES_URL});await separate.connect()
        try{return await run(separate)}finally{await separate.end()}
      }}
      assert.deepEqual((await Promise.all([enrollment.enrollApplication(made.id,true,ports),enrollment.enrollApplication(made.id,true,ports)])).sort(),['DONE','SKIPPED'])
      assert.equal(calls,1)
    })
    await t.test('legacy products, mismatched amounts, unknown inputs and missing consent are not accepted',async()=>{
      for (const productId of ['12course','chuweol']) await assert.rejects(createApplication(client,randomUUID(),{...input,productId},[{productId,lectureIds:[10]}],'PROCESS_2'),/product_not_enabled/)
      await assert.rejects(createApplication(client,randomUUID(),input,bindings),/product_not_enabled/)
      for (const data of [{...input,totalWon:1001},{...input,agreePrivacy:false},{...input,password:'not-a-real-password'}]) await assert.rejects(make(randomUUID(),data))
    })
    await t.test('an outbox failure rolls back the application and its registration targets',async()=>{
      const key = randomUUID()
      const broken = { query: async(sql,values) => {
        if(sql.startsWith('INSERT INTO daechion_automation.outbox')) throw Error('test queue failure')
        return db.query(sql,values)
      } }
      const before = (await db.query('SELECT count(*) AS n FROM daechion_automation.registrations')).rows[0].n
      await assert.rejects(createApplication(broken,key,input,bindings,'PROCESS_2'),/test queue failure/)
      assert.equal((await db.query('SELECT id FROM daechion_automation.applications WHERE request_key=$1',[key])).rows.length,0)
      assert.equal((await db.query('SELECT count(*) AS n FROM daechion_automation.registrations')).rows[0].n,before)
    })
    await t.test('numeric bill IDs are reserved once and cannot be rebound or charged at a different amount',async()=>{
      const request = {applicationId,revision:1,providerAccount:'test-account',billId:'202611060000000001',amountWon:1200}
      const first = await reserveBill(client,request)
      assert.equal(await reserveBill(client,request),first)
      await assert.rejects(reserveBill(client,{...request,billId:'202611060000000002'}),/bill_not_reserved/)
      const second = await make()
      await assert.rejects(reserveBill(client,{...request,applicationId:second.id}))
      await assert.rejects(reserveBill(client,{...request,applicationId:second.id,billId:'202611060000000003',amountWon:900}))
      await assert.rejects(reserveBill(client,{...request,billId:'not-numeric'}))
    })
    await t.test('sending timestamps must define seven days and completed registrations need a student',async()=>{
      await assert.rejects(db.query("UPDATE daechion_automation.bills SET state='SENT' WHERE application_id=$1",[applicationId]))
      await assert.rejects(db.query("UPDATE daechion_automation.bills SET sent_at=now() WHERE application_id=$1",[applicationId]))
      await assert.rejects(db.query("UPDATE daechion_automation.bills SET sent_at=now(),due_at=now()+interval '6 days' WHERE application_id=$1",[applicationId]))
      await db.query("UPDATE daechion_automation.bills SET state='SENT',sent_at=now(),due_at=now()+interval '7 days' WHERE application_id=$1",[applicationId])
      await assert.rejects(db.query("UPDATE daechion_automation.registrations SET state='DONE' WHERE application_id=$1",[applicationId]))
    })
    await t.test('projection contains all accepted fields, distinct phones and full bill history as text',()=>{
      const view = {id:applicationId,createdAt:'2026-11-06T00:00:00Z',updatedAt:'2026-11-06T01:00:00Z',
        snapshot:applicationSnapshotSchema.parse(input),billingState:'SENT',currentBillId:'202611060000000002',
        allBillIds:['202611060000000001','202611060000000002'],paymentState:'PENDING',lectureIds:[10,11],
        registrationState:'PENDING',notificationState:'NOT_READY'}
      const values = applicationSheetRow(view)
      assert.equal(values.length,SHEET_HEADERS.length)
      const row = Object.fromEntries(SHEET_HEADERS.map((header,i)=>[header,values[i]]))
      assert.equal(row['학생 이름'],input.studentName); assert.equal(row['학부모 이름'],input.guardianName)
      assert.equal(row['학생 전화번호'],'01000000001'); assert.equal(row['결제 전화번호'],'01000000003')
      assert.equal(row['보호자 로그인 전화번호'],'01000000002'); assert.equal(row['총 청구 금액'],1200)
      assert.equal(row['신청시각'],'2026-11-06 09:00:00'); assert.equal(row['선택 과목'],'미적')
      assert.equal(row['전체 청구서 번호'],view.allBillIds.join('\n')); assert.match(row['추가 신청 정보'],/신청 메모: 검수용/)
      assert.equal(row['결제 상태'],'미납'); assert.equal(row['등록 상태'],'등록 대기')
      assert.equal(row['안내 발송 상태'],'등록 완료 후 발송')
      assert.throws(()=>applicationSheetRow({...view,paymentState:'typo'}),/Unknown Sheets state/)
      assert.throws(()=>applicationSheetRow({...view,allBillIds:[]}),/Missing current bill history/)
      assert.equal(Object.keys(row).some(key=>/비밀번호|API/.test(key)),false)
    })
    await t.test('sheet destination must be a different file and use RAW literal values',()=>{
      const legacy = 'legacy-test-spreadsheet-0001', fresh = 'new-test-spreadsheet-0001'
      assert.throws(()=>sheetsDestination(legacy,legacy))
      assert.throws(()=>sheetsDestination(fresh,''))
      assert.throws(()=>sheetsDestination('https://example.com',legacy))
      assert.deepEqual(sheetsDestination(fresh,legacy),{spreadsheetId:fresh,valueInputOption:'RAW'})
    })
    const adminInput=async(id,action,extra={})=>({requestKey:randomUUID(),applicationId:id,expectedVersion:String((await appRow(id)).version),action,operatorName:'검수 담당자',reason:'격리 검수에서 외부 내역 직접 확인',confirmed:true,...extra})
    await t.test('admin actions require a fresh version, retain an audit and replay once without duplicate side effects',async()=>{
      const id=await paymentFixture();await observe(id)
      const action=await adminInput(id,'HOLD')
      assert.deepEqual(await admin.applyAdminAction(client,action),{replayed:false})
      assert.deepEqual(await admin.applyAdminAction(client,action),{replayed:true})
      await assert.rejects(admin.applyAdminAction(client,{...action,requestKey:randomUUID()}),/STALE/)
      await assert.rejects(admin.applyAdminAction(client,{...action,reason:'changed request'}),/STALE/)
      assert.equal((await appRow(id)).payment_state,'PAID');assert.equal((await appRow(id)).automation_state,'HOLD')
      assert.equal((await db.query('SELECT id FROM daechion_automation.admin_actions WHERE application_id=$1',[id])).rows.length,1)
    })
    await t.test('manual student approval resolves a NEW mismatch without rewriting the declared history',async()=>{
      const id=await paymentFixture('NEW');await observe(id)
      const ports={daechion:fakeDaechion(),withClient:run=>run(client)}
      assert.equal(await enrollment.enrollApplication(id,true,ports),'REVIEW')
      const action=await adminInput(id,'RESUME',{studentId:77})
      await assert.rejects(admin.applyAdminAction(client,action,{...student,name:'다른학생'}),/INVALID_EVIDENCE/)
      await admin.applyAdminAction(client,action,student)
      assert.equal((await appRow(id)).submission.studentHistory,'NEW')
      assert.equal(await enrollment.enrollApplication(id,true,ports),'DONE')
      assert.equal(await enrollment.enrollApplication(id,true,ports),'DONE')
      assert.ok((await db.query('SELECT manual_review_id FROM daechion_automation.identity_checks WHERE application_id=$1',[id])).rows[0].manual_review_id)
      await admin.applyAdminAction(client,await adminInput(id,'REVOKED'))
      assert.equal((await appRow(id)).automation_state,'REVOKED')
      await observe(id)
      assert.equal((await appRow(id)).automation_state,'REVOKED')
    })
    await t.test('manual payment evidence is checked and late manual registration is not undone by the polling worker',async()=>{
      const id=(await make(undefined,{...input,studentHistory:'NEW'})).id
      await billing.reserveApplicationBill(client,id,'payment-test');await billing.claimBillSend(client,id,'payment-test')
      const bill=(await db.query('SELECT bill_id FROM daechion_automation.bills WHERE application_id=$1',[id])).rows[0]
      const paidAt=new Date(Date.now()-1000).toISOString(),sentAt=new Date(Date.now()-8*86400000).toISOString()
      const paymentAction=await adminInput(id,'CONFIRM_PAYMENT',{billId:bill.bill_id,amountWon:1200,paidAt,sentAt})
      await assert.rejects(admin.applyAdminAction(client,{...paymentAction,amountWon:1}),/INVALID_EVIDENCE/)
      await admin.applyAdminAction(client,paymentAction)
      const action=await adminInput(id,'MANUAL_COMPLETE',{studentId:77})
      await admin.applyAdminAction(client,action,student)
      assert.ok((await appRow(id)).manual_access_action)
      await observe(id,{paidAt})
      assert.ok((await appRow(id)).manual_access_action);assert.equal((await appRow(id)).review_code,'manual_access_recorded')
      await observe(id,{state:'C',paidAt:null})
      assert.equal((await appRow(id)).manual_access_action,null);assert.equal((await appRow(id)).payment_state,'CANCELLED')
    })
    await t.test('admin HTTP checks login and origin before reading records or trusting manual evidence',async()=>{
      let connections=0
      const ports={authed:async()=>false,enabled:true,origins:['https://admin.invalid'],withClient:async run=>{connections++;return run(client)},student:async()=>student}
      const request=new Request('https://admin.invalid/api/admin/daechion/applications')
      assert.equal((await adminHttp.adminGet(request,ports)).status,401);assert.equal(connections,0)
      assert.equal((await adminHttp.adminGet(request,{...ports,authed:async()=>true,enabled:false})).status,503)
      const cross=new Request(request.url,{method:'POST',headers:{Origin:'https://wrong.invalid','Content-Type':'application/json'},body:'{}'})
      assert.equal((await adminHttp.adminPost(cross,{...ports,authed:async()=>true})).status,403);assert.equal(connections,0)
    })
    await t.test('LMS sends only after all grants, only to student/guardian, and never twice',async()=>{
      await db.query("UPDATE daechion_automation.outbox SET state='FAILED',lease_token=NULL,lease_until=NULL WHERE kind='READY_MESSAGE' AND state IN ('PENDING','RUNNING')")
      await db.query("UPDATE daechion_automation.applications SET notification_state='FAILED' WHERE notification_state='PENDING'")
      const id=await paymentFixture();await observe(id)
      const ports={daechion:fakeDaechion(),withClient:run=>run(client)}
      await enrollment.enrollApplication(id,true,ports)
      let calls=[]
      const sms={provider:{send:async data=>{calls.push(data);return {accepted:true,messageId:'accepted-'+calls.length}}},withClient:run=>run(client)}
      assert.equal(await readyMessage.sendOneReadyMessage(sms),'SKIPPED')
      await enrollment.enrollApplication(id,true,ports)
      assert.equal(await readyMessage.sendOneReadyMessage(sms),'SENT');assert.equal(await readyMessage.sendOneReadyMessage(sms),'SKIPPED')
      assert.deepEqual(calls.map(item=>item.phone).sort(),['01000000001','01000000002'])
      assert.equal((await appRow(id)).notification_state,'SENT')
    })
    await t.test('partial LMS uncertainty never resends an accepted recipient',async()=>{
      const id=await paymentFixture();await observe(id)
      const registration={daechion:fakeDaechion(),withClient:run=>run(client)}
      await enrollment.enrollApplication(id,true,registration);await enrollment.enrollApplication(id,true,registration)
      let calls=0
      const ports={provider:{send:async()=>{calls++;return calls===1?{accepted:true,messageId:'one-accepted'}:{accepted:false}}},withClient:run=>run(client)}
      assert.equal(await readyMessage.sendOneReadyMessage(ports),'UNKNOWN');assert.equal(await readyMessage.sendOneReadyMessage(ports),'SKIPPED');assert.equal(calls,2)
      assert.deepEqual((await db.query('SELECT state FROM daechion_automation.ready_receipts WHERE application_id=$1 ORDER BY phone',[id])).rows.map(item=>item.state),['SENT','UNKNOWN'])
    })
    await t.test('cancellation while sending LMS stops remaining recipients and cannot mark the whole job delivered',async()=>{
      const id=await paymentFixture();await observe(id)
      const registration={daechion:fakeDaechion(),withClient:run=>run(client)}
      await enrollment.enrollApplication(id,true,registration);await enrollment.enrollApplication(id,true,registration)
      let calls=0
      const ports={provider:{send:async()=>{calls++;await observe(id,{state:'C',paidAt:null});return {accepted:true,messageId:'accepted-before-cancel'}}},withClient:run=>run(client)}
      assert.equal(await readyMessage.sendOneReadyMessage(ports),'UNKNOWN');assert.equal(calls,1)
      assert.equal((await appRow(id)).notification_state,'UNKNOWN');assert.equal((await appRow(id)).payment_state,'CANCELLED')
    })
    await t.test('parallel PostgreSQL message workers send each recipient only once',{skip:!db.isPostgres},async()=>{
      const id=await paymentFixture();await observe(id)
      const registration={daechion:fakeDaechion(),withClient:run=>run(client)}
      await enrollment.enrollApplication(id,true,registration);await enrollment.enrollApplication(id,true,registration)
      const calls=[]
      const ports={provider:{send:async data=>{calls.push(data.phone);return {accepted:true,messageId:'concurrent-'+data.receiptId}}},withClient:async run=>{
        const separate=new pg.Client({connectionString:process.env.DAECHION_TEST_POSTGRES_URL});await separate.connect()
        try{return await run(separate)}finally{await separate.end()}
      }}
      assert.deepEqual((await Promise.all([readyMessage.sendOneReadyMessage(ports),readyMessage.sendOneReadyMessage(ports)])).sort(),['SENT','SKIPPED'])
      assert.deepEqual(calls.sort(),['01000000001','01000000002'])
    })
    await t.test('public intake enforces origin, size, required history, durable replay and recent duplicate protection',async()=>{
      const product={id:'public-http-intake',name:'공개 접수 검수',visible:true,purchaseProcess:'PROCESS_2',modes:{online:{enabled:true,price:1200},offline:{enabled:false,price:0}},textbook:{included:false,price:0}}
      const bindings=[{productId:product.id,lectureIds:[10]}],origin='https://test.invalid'
      const ports={settings:{origins:[origin],bindings},bindings,loadProduct:()=>product,withClient:run=>run(client),ready:async()=>{}}
      const body={requestKey:randomUUID(),productId:product.id,studentHistory:'NEW',applicantType:'STUDENT',studentName:'접수검수',studentPhone:'01000000777',payerPhone:'01000000888',mode:'ONLINE',expectedTotalWon:1200,confirmPayment:true,agreePrivacy:true}
      const request=(value,site=origin)=>new Request(origin+'/api/daechion/applications',{method:'POST',headers:{Origin:site,'Content-Type':'application/json'},body:JSON.stringify(value)})
      assert.equal((await intakeHttp.intakePost(request(body),{...ports,settings:null})).status,503)
      assert.equal((await intakeHttp.intakePost(request(body,'https://other.invalid'),ports)).status,403)
      assert.equal((await intakeHttp.intakePost(request({...body,studentHistory:undefined}),ports)).status,400)
      assert.equal((await intakeHttp.intakePost(request({...body,studentName:'x'.repeat(9000)}),ports)).status,413)
      const first=await intakeHttp.intakePost(request(body),ports);assert.equal(first.status,201)
      const receipt=await first.json();assert.equal(receipt.status,'RECEIVED')
      const retry=await intakeHttp.intakePost(request(body),ports);assert.equal(retry.status,200);assert.equal((await retry.json()).applicationId,receipt.applicationId)
      assert.equal((await intakeHttp.intakePost(request({...body,requestKey:randomUUID()}),ports)).status,429)
      assert.equal((await db.query('SELECT id FROM daechion_automation.bills WHERE application_id=$1',[receipt.applicationId])).rows.length,0)
      const failed=await intakeHttp.intakePost(request({...body,requestKey:randomUUID()}),{...ports,ready:async()=>{throw Error('private database detail')}})
      assert.equal(failed.status,503);assert.equal((await failed.text()).includes('private'),false)
    })
    await t.test('parallel PostgreSQL public intake rejects a second UUID for the same recent student/product',{skip:!db.isPostgres},async()=>{
      const connections=[new pg.Client({connectionString:process.env.DAECHION_TEST_POSTGRES_URL}),new pg.Client({connectionString:process.env.DAECHION_TEST_POSTGRES_URL})]
      const snapshot={...input,productId:'public-concurrent',studentPhone:'01000000666',payerPhone:'01000000555'}
      try{
        await Promise.all(connections.map(item=>item.connect()))
        const results=await Promise.allSettled(connections.map(item=>createApplication(item,randomUUID(),snapshot,[{productId:snapshot.productId,lectureIds:[10]}],'PROCESS_2',true)))
        assert.equal(results.filter(item=>item.status==='fulfilled').length,1)
        assert.match(results.find(item=>item.status==='rejected').reason.message,/intake_throttled/)
      }finally{await Promise.all(connections.map(item=>item.end()))}
    })
    await t.test('Sheets uses ID metadata after sorting, literal values and managed columns only',async()=>{
      const target={spreadsheetId:'new-spreadsheet-test-1234567',legacySpreadsheetId:'old-spreadsheet-test-1234567',sheetId:7}
      const view={id:randomUUID(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),snapshot:applicationSnapshotSchema.parse({...input,studentName:'=not-a-formula'}),billingState:'NOT_CREATED',allBillIds:[],paymentState:'PENDING',lectureIds:[10],registrationState:'PENDING',notificationState:'NOT_READY'}
      const calls=[]
      const api={call:async(method,path,body)=>{
        calls.push({method,path,body})
        if(path.includes('developerMetadata:search')){
          const key=body.dataFilters[0].developerMetadataLookup.metadataKey
          return {matchedDeveloperMetadata:[{developerMetadata:key==='pkjmath_application_id'?{metadataId:45,location:{dimensionRange:{sheetId:7,dimension:'ROWS',startIndex:19,endIndex:20}}}:{metadataId:1,location:{sheetId:7}}}]}
        }
        if(path.includes('?fields='))return {sheets:[{properties:{sheetId:7,title:'신규 신청'}}]}
        if(method==='GET')return {values:[SHEET_HEADERS]}
        return {spreadsheetId:target.spreadsheetId,totalUpdatedRows:1}
      }}
      await publisher.publishApplication(api,target,view)
      const update=calls.find(item=>item.path.endsWith('values:batchUpdateByDataFilter')).body
      assert.equal(update.valueInputOption,'RAW');assert.equal(update.data[0].dataFilter.developerMetadataLookup.metadataId,45)
      assert.equal(update.data[0].values[0].length,SHEET_HEADERS.length);assert.ok(update.data[0].values[0].includes('=not-a-formula'))
      const before=calls.length
      await assert.rejects(publisher.publishApplication(api,{...target,spreadsheetId:target.legacySpreadsheetId},view))
      assert.equal(calls.length,before)
    })
    await t.test('unconfirmed Sheets writes block only that application publication instead of repeating inserts',async()=>{
      await db.query("UPDATE daechion_automation.outbox SET state='DONE',lease_token=NULL,lease_until=NULL WHERE kind='SHEETS'")
      const created=await make()
      const api={call:async(method,path,body)=>{
        if(path.includes('developerMetadata:search'))return body.dataFilters[0].developerMetadataLookup.metadataKey==='pkjmath_process2_sheet_v1'?{matchedDeveloperMetadata:[{developerMetadata:{metadataId:1,location:{sheetId:7}}}]}:{}
        if(path.includes('?fields='))return {sheets:[{properties:{sheetId:7,title:'신규 신청'}}]}
        if(method==='GET')return {values:[SHEET_HEADERS]}
        throw Error('simulated lost insert response')
      }}
      const ports={api,target:{spreadsheetId:'new-spreadsheet-test-1234567',legacySpreadsheetId:'old-spreadsheet-test-1234567',sheetId:7},withClient:run=>run(client)}
      assert.equal(await sheetsWorker.syncOneApplication(ports),'UNKNOWN')
      assert.equal(await sheetsWorker.syncOneApplication(ports),'SKIPPED')
      assert.equal((await appRow(created.id)).payment_state,'PENDING')
      assert.equal((await db.query("SELECT state FROM daechion_automation.outbox WHERE application_id=$1 AND kind='SHEETS'",[created.id])).rows[0].state,'UNKNOWN')
    })
    await t.test('Sheets setup adopts only an exact empty imported template and preserves any staff data',async()=>{
      const target={spreadsheetId:'new-spreadsheet-test-1234567',legacySpreadsheetId:'old-spreadsheet-test-1234567',sheetId:7}
      const headers=[...SHEET_HEADERS,'직원 메모']
      for(const mode of ['template','wrongHeader','existingData','changedDuringRead']){
        let writes=0
        const api={call:async(method,path,body)=>{
          if(path.includes('?fields='))return {sheets:[{properties:{sheetId:7,title:'신규강의 신청현황',gridProperties:{columnCount:39}}}]}
          if(path.includes('developerMetadata:search'))return {}
          if(method==='GET'){
            if(decodeURIComponent(path).endsWith('!1:1'))return {values:[mode==='wrongHeader'?['다른 업무 목록']:headers]}
            return {values:[mode==='changedDuringRead'?['누군가 변경함']:headers,...(mode==='existingData'?[['실제 업무 데이터']]:[])]}
          }
          writes++;return {spreadsheetId:target.spreadsheetId,replies:body.requests.map(()=>({}))}
        }}
        if(mode==='template'){await publisher.setupApplicationSheet(api,target);assert.equal(writes,1)}
        else{await assert.rejects(publisher.setupApplicationSheet(api,target),/NEW_SHEET_TAB_NOT_EMPTY|NEW_SHEET_HEADERS_CHANGED/);assert.equal(writes,0)}
      }
    })
    await t.test('Sheets setup initializes an empty separate tab and refuses hidden existing data',async()=>{
      const target={spreadsheetId:'new-spreadsheet-test-1234567',legacySpreadsheetId:'old-spreadsheet-test-1234567',sheetId:7}
      const calls=[]
      let populated=false
      const api={call:async(method,path,body)=>{
        calls.push({method,path,body})
        if(path.includes('?fields='))return {sheets:[{properties:{sheetId:7,title:'신규 신청',gridProperties:{columnCount:26}}}]}
        if(path.includes('developerMetadata:search'))return {}
        if(method==='GET')return populated&&!decodeURIComponent(path).endsWith('!1:1')?{values:[[],['existing staff data']]}:{}
        return {spreadsheetId:target.spreadsheetId,replies:body.requests.map(()=>({}))}
      }}
      await publisher.setupApplicationSheet(api,target)
      const setup=calls.find(item=>item.path.endsWith(':batchUpdate')).body.requests
      assert.equal(setup.filter(item=>item.addConditionalFormatRule).length,3)
      assert.equal(setup.find(item=>item.updateCells).updateCells.rows[0].values.at(-1).userEnteredValue.stringValue,'직원 메모')
      calls.length=0;populated=true
      await assert.rejects(publisher.setupApplicationSheet(api,target),/NEW_SHEET_TAB_NOT_EMPTY/)
      assert.equal(calls.some(item=>item.path.endsWith(':batchUpdate')),false)
    })
  } finally { await db.close() }
})

test('migration failure rolls back new DDL and preserves legacy data',{timeout:90000},async()=>{
  const db = await database()
  try {
    await db.exec('CREATE TABLE legacy_students(id integer PRIMARY KEY); INSERT INTO legacy_students VALUES(7);')
    const initial = migrations.loadMigration()
    await assert.rejects(migrations.migrate(migrationClient(db),{...initial,body:initial.body+'\nSELECT missing_column FROM missing_table;'}))
    assert.equal((await db.query("SELECT to_regnamespace('daechion_automation') AS name")).rows[0].name,null)
    assert.deepEqual((await db.query('SELECT id FROM legacy_students')).rows,[{id:7}])
    await db.exec('CREATE SCHEMA daechion_automation;CREATE TABLE daechion_automation.existing_record(id integer);')
    await assert.rejects(migrations.migrate(migrationClient(db)),/UNTRACKED_AUTOMATION_SCHEMA/)
    assert.ok((await db.query("SELECT to_regclass('daechion_automation.existing_record') AS name")).rows[0].name)
  } finally { await db.close() }
})

test('identity migration upgrades tracked 001 without rewriting submissions or old schema checksums',{timeout:90000},async()=>{
  const db = await database()
  try {
    const initial = migrations.loadMigration(),id = randomUUID()
    await db.exec(initial.body)
    await db.exec('CREATE TABLE daechion_automation.schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())')
    await db.query('INSERT INTO daechion_automation.schema_migrations(name,checksum) VALUES($1,$2)',[initial.name,initial.checksum])
    await db.query('INSERT INTO daechion_automation.applications(id,request_key,request_fingerprint,product_id,product_title,tuition_won,textbook_won,total_won,submission) VALUES($1,$2,$3,$4,$5,1000,200,1200,$6::jsonb)',[id,randomUUID(),'0'.repeat(64),input.productId,input.productTitle,JSON.stringify(input)])
    assert.deepEqual(await migrations.status(migrationClient(db)),{tracked:true,pending:['002_identity.sql','003_admin_messages.sql']})
    const second = migrations.loadMigration('002_identity.sql')
    await assert.rejects(migrations.migrate(migrationClient(db),[initial,{...second,body:second.body+'\nSELECT * FROM missing_upgrade_table;'}]))
    assert.equal((await db.query("SELECT to_regclass('daechion_automation.identity_checks') AS name")).rows[0].name,null)
    assert.deepEqual(await migrations.status(migrationClient(db)),{tracked:true,pending:['002_identity.sql','003_admin_messages.sql']})
    assert.deepEqual(await migrations.migrate(migrationClient(db)),['002_identity.sql','003_admin_messages.sql'])
    assert.deepEqual((await db.query('SELECT submission FROM daechion_automation.applications WHERE id=$1',[id])).rows[0].submission,input)
    assert.deepEqual((await db.query('SELECT status,student_id FROM daechion_automation.identity_checks WHERE application_id=$1',[id])).rows,[{status:'WAITING',student_id:null}])
    assert.equal((await db.query("SELECT checksum FROM daechion_automation.schema_migrations WHERE name='001_initial.sql'")).rows[0].checksum,initial.checksum)
  } finally {await db.close()}
})
