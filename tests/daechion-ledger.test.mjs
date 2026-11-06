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
import migrations from '../scripts/daechion-migrations.cjs'

const { createApplication, reserveBill, applicationSnapshotSchema } = ledger
const { applicationSheetRow, SHEET_HEADERS, sheetsDestination } = sheetView
const input = {
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
  const client = { query: (sql, values) => db.query(sql, values) }
  const make = (key = randomUUID(), data = input) => createApplication(client, key, data, bindings, 'PROCESS_2')
  let applicationId
  try {
    await db.exec('CREATE TABLE legacy_students(id integer PRIMARY KEY); INSERT INTO legacy_students VALUES(7);')
    const migrator = migrationClient(db)
    await t.test('migration status is read-only; tracked application is repeatable and checksum protected',async()=>{
      assert.deepEqual(await migrations.status(migrator),{tracked:false,pending:['001_initial.sql']})
      assert.equal((await db.query("SELECT to_regnamespace('daechion_automation') AS name")).rows[0].name,null)
      assert.deepEqual(await migrations.migrate(migrator),['001_initial.sql'])
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
      const request = {requestKey:randomUUID(),productId:product.id,applicantType:'STUDENT',studentName:'검수학생',
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
          DAECHION_PAYMENT_READ_ENABLED:'true',DAECHION_ENROLLMENT_ENABLED:'true',DAECHION_API_KEY:'fake-key',DAECHION_TENANT_ID:'fake-tenant',
          PAYSSAM_API_KEY:'fake-test-key',PAYSSAM_MEMBER:'fake-member',PAYSSAM_MERCHANT:'fake-merchant',
          DAECHION_BILLING_CALLBACK_URL:'https://web.invalid/api/daechion/billing/callback'},
      })
      assert.equal(result.status,0,result.stderr)
      assert.deepEqual(JSON.parse(result.stdout),{ready:true,schema:'daechion_automation',sending:false})
      assert.equal((await db.query('SELECT count(*)::text AS n FROM daechion_automation.bills')).rows[0].n,before)
    })
    const paymentFixture = async () => {
      const result = await make()
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
      const id = await paymentFixture();await observe(id)
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
