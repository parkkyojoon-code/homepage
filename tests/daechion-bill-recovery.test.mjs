import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,readdirSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {PGlite} from '@electric-sql/pglite'

const build=process.env.DAECHION_BILL_RECOVERY_TEST_BUILD??'.daechion-test-build'
const load=async name=>(await import(new URL(`../${build}/lib/daechion/orders/${name}.js`,import.meta.url))).default
const checkout=await load('checkout'),billing=await load('billing'),admin=await load('admin'),adminHttp=await load('admin-http')
const recovery=await load('bill-recovery'),paid=await load('paid-recovery'),enrollment=await load('enrollment')
const request=body=>new Request('https://fixture.invalid/api/admin/daechion/orders',{method:'POST',
  headers:{origin:'https://fixture.invalid','content-type':'application/json'},body:JSON.stringify(body)})

test('paid SEND_UNKNOWN reconciliation is an audited same-bill recovery with its original dispatch deadline',async t=>{
  const db=new PGlite();let tail=Promise.resolve(),sequence=0
  const withClient=run=>{const next=tail.then(()=>run(db));tail=next.catch(()=>{});return next}
  const query=(sql,args)=>withClient(c=>c.query(sql,args))
  const orderRow=async id=>(await query('SELECT * FROM daechion_orders.orders WHERE id=$1',[id])).rows[0]
  const billRow=async id=>(await query('SELECT *,send_attempted_at::text AS exact_attempt,sent_at::text AS exact_sent,due_at::text AS exact_due FROM daechion_orders.bills WHERE order_id=$1',[id])).rows[0]
  const product={productId:'bill-recovery-fixture',title:'가상 복구 강의',saleKind:'SINGLE',priceWon:1200,tenantId:'fixture',revision:'r1',purchaseProcess:'PROCESS_2',visible:true,lectures:[{id:101,name:'가상 강의'}]}
  const ports={tenantId:'fixture',subjectSecret:'s'.repeat(32),catalog:async()=>[product],withClient,
    ownership:async(cart,_contact,key)=>({cartFingerprint:cart.fingerprint,subjectKey:key,checkedAt:new Date().toISOString(),identity:'PASSED',existingStudent:'NEW',lectures:[{id:101,state:'NOT_OWNED'}]})}
  async function fixture(sendResult='UNKNOWN'){
    const n=++sequence,contact={studentName:`가상 학생 ${n}`,studentPhone:`0100000${String(n).padStart(4,'0')}`,guardianName:'',guardianPhone:'',payerPhone:'01000009999',
      applicantType:'STUDENT',studentHistory:'NEW',agreePrivacy:true,confirmPayment:true}
    const quote=await checkout.quoteCheckout({items:[{productId:product.productId}],contact,expectedTotalWon:1200},ports)
    const {orderId}=await checkout.receiveOrder({quoteId:quote.quoteId,quoteToken:quote.quoteToken,requestKey:randomUUID(),expectedTotalWon:1200},ports)
    const f={orderId,contact,sends:0,reads:0,observation:{state:'UNKNOWN'},bill:null}
    f.provider={accountId:'fixture-account',send:async bill=>{f.bill=bill;f.sends++;return sendResult},read:async()=>{f.reads++;return f.observation}}
    f.billing={withClient,provider:f.provider,preflight:async()=> 'READY'}
    assert.equal(await billing.sendOrderBill(orderId,true,f.billing),sendResult)
    f.paid=()=>{f.observation={state:'F',billId:f.bill.billId,amountWon:1200,paidAt:new Date().toISOString()}}
    f.context=async()=>{const row=await orderRow(orderId);return withClient(c=>recovery.billRecoveryContext(c,'fixture',orderId,String(row.version),f.bill.billId))}
    f.action=async(action='RECONCILE_BILL')=>({requestKey:randomUUID(),orderId,expectedVersion:String((await orderRow(orderId)).version),action,
      operatorName:'검수 담당자',reason:'결제선생에서 같은 청구의 실제 결제를 대조함',confirmed:true,billId:f.bill.billId,confirmPaid:true})
    f.admin={tenantId:'fixture',enabled:true,origins:['https://fixture.invalid'],authed:async()=>true,ready:async()=>{},withClient,
      inspectBillRecovery:context=>recovery.inspectBillRecovery(context,f.provider),inspectPaid:context=>paid.inspectPaid(context,f.provider)}
    return f
  }
  const assertHeld=async(f,code='bill_send_unknown')=>{
    const row=await orderRow(f.orderId),bill=await billRow(f.orderId)
    assert.equal(row.checkout_state,'REVIEW');assert.equal(row.review_code,code);assert.equal(bill.state,'SEND_UNKNOWN');assert.equal(bill.send_recovery_action_id,null)
    assert.equal((await query("SELECT count(*)::int AS n FROM daechion_orders.admin_actions WHERE order_id=$1 AND action='RECONCILE_BILL'",[f.orderId])).rows[0].n,0)
    assert.equal(f.sends,1)
  }
  try{
    for(const name of ['001_initial.sql','002_identity.sql','006_operations.sql'])await db.exec(readFileSync(new URL(`../db/daechion/${name}`,import.meta.url),'utf8'))
    const migrations=readdirSync(new URL('../db/daechion-orders/',import.meta.url)).filter(name=>/^\d+.*\.sql$/.test(name)).sort()
    for(const name of migrations.filter(name=>name<'013_bill_send_recovery.sql'))await db.exec(readFileSync(new URL(`../db/daechion-orders/${name}`,import.meta.url),'utf8'))
    const old=await fixture(),missing=await fixture(),ambiguous=await fixture(),invalidDuplicate=await fixture(),late=await fixture()
    await query("DELETE FROM daechion_orders.events WHERE order_id=$1 AND kind='bill_send_attempted'",[missing.orderId])
    await query("INSERT INTO daechion_orders.events(order_id,kind) VALUES($1,'bill_send_attempted')",[ambiguous.orderId])
    await query("INSERT INTO daechion_orders.events(order_id,kind,created_at) VALUES($1,'bill_send_attempted',now()+interval '1 day')",[invalidDuplicate.orderId])
    await query("UPDATE daechion_orders.orders SET created_at=now()-interval '9 days' WHERE id=$1",[late.orderId])
    await query("UPDATE daechion_orders.events SET created_at=now()-interval '8 days' WHERE order_id=$1 AND kind='bill_send_attempted'",[late.orderId])
    for(const name of migrations.filter(name=>name>='013_bill_send_recovery.sql'))await db.exec(readFileSync(new URL(`../db/daechion-orders/${name}`,import.meta.url),'utf8'))

    await t.test('legacy dispatch is backfilled only from one original event and never invented for missing or ambiguous history',async()=>{
      const context=await old.context();assert.ok(context)
      const event=(await query("SELECT to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS time FROM daechion_orders.events WHERE order_id=$1 AND kind='bill_send_attempted'",[old.orderId])).rows[0]
      assert.equal(context.bill.attemptedAt,event.time)
      assert.equal(await missing.context(),null);assert.equal(await ambiguous.context(),null);assert.equal(await invalidDuplicate.context(),null)
      assert.equal((await billRow(missing.orderId)).send_attempted_at,null);assert.equal((await billRow(ambiguous.orderId)).send_attempted_at,null)
      await assert.rejects(query("UPDATE daechion_orders.events SET created_at=now() WHERE order_id=$1 AND kind='bill_send_attempted'",[old.orderId]),/ORDER_BILL_ATTEMPT_HISTORY_IMMUTABLE/)
    })
    await t.test('HTTP recovery records the observed payment on the same bill, replays one audit, and requires a separate resume before normal enrollment',async()=>{
      const f=await fixture();f.paid();await billing.checkOrderPayment(f.orderId,true,f.billing)
      const before=await billRow(f.orderId),input=await f.action(),context=await f.context(),proof=await recovery.inspectBillRecovery(context,f.provider)
      assert.ok(proof);assert.equal(proof.attemptedAt,context.bill.attemptedAt)
      assert.equal((await withClient(c=>admin.orderDetail(c,'fixture',f.orderId))).canReconcileBill,true)
      const response=await adminHttp.orderAdminPost(request(input),f.admin);assert.equal(response.status,200,await response.clone().text())
      const result=await response.json(),after=await billRow(f.orderId),order=await orderRow(f.orderId)
      assert.equal(after.id,before.id);assert.equal(after.bill_id,before.bill_id);assert.equal(after.exact_attempt,before.exact_attempt)
      assert.equal(after.exact_sent,after.exact_attempt);assert.equal(after.state,'SENT');assert.equal(after.last_payment_state,'PAID');assert.equal(after.send_recovery_action_id,input.requestKey)
      assert.equal((await query("SELECT due_at=send_attempted_at+interval '7 days' AS exact FROM daechion_orders.bills WHERE order_id=$1",[f.orderId])).rows[0].exact,true)
      assert.equal(order.checkout_state,'REVIEW');assert.equal(order.review_code,'bill_reconciled');assert.equal(order.payment_state,'PAID');assert.equal(order.identity_state,'WAITING');assert.equal(order.student_id,null)
      assert.equal(f.sends,1);assert.equal((await query('SELECT count(*)::int AS n FROM daechion_orders.bills WHERE order_id=$1',[f.orderId])).rows[0].n,1)
      const replay=await adminHttp.orderAdminPost(request(input),{...f.admin,inspectBillRecovery:async()=>assert.fail('Replay cannot query the provider again')})
      assert.equal(replay.status,200);assert.deepEqual(await replay.json(),{success:true,replayed:true,version:result.version})
      assert.equal((await query("SELECT count(*)::int AS n FROM daechion_orders.admin_actions WHERE order_id=$1 AND action='RECONCILE_BILL'",[f.orderId])).rows[0].n,1)
      const resume=await f.action('RESUME_PAID'),resumed=await adminHttp.orderAdminPost(request(resume),f.admin)
      assert.equal(resumed.status,200,await resumed.clone().text());assert.equal((await orderRow(f.orderId)).checkout_state,'READY')
      let creates=0;const students=[],api={me:async()=>({tenantId:'fixture'}),lectures:async()=>[{id:101,opened:true,weeklyLectures:[{id:10100}]}],
        students:async phone=>students.filter(student=>student.studentPhoneNumber===phone),student:async id=>students.find(student=>student.id===id),
        createStudent:async contact=>{creates++;const student={id:60001,name:contact.name,studentPhoneNumber:contact.studentPhone,active:true};students.push(student);return student},
        ensureFirstLessonAccess:async grant=>{await grant.beforeWrite();await grant.recordEnrollment();return {verified:true,lectureId:grant.lectureId,studentId:grant.studentId,weeklyLectureIds:[grant.weeklyLectureId]}}}
      assert.equal(await enrollment.runOrderGrant(f.orderId,true,{withClient,provider:f.provider,tenantId:'fixture',daechion:api}),'VERIFIED')
      assert.equal(creates,1);assert.equal(f.sends,1);assert.equal((await orderRow(f.orderId)).notification_state,'PENDING')
    })
    await t.test('wrong account, bill, amount, cancelled/unknown responses and invalid approval times are rejected without mutations',async()=>{
      for(const mode of ['account','bill','amount','cancelled','unknown','early','future','throw']){
        const f=await fixture();f.paid();const context=await f.context()
        const observation={...f.observation}
        if(mode==='bill')observation.billId='9'.repeat(20)
        if(mode==='amount')observation.amountWon=1
        if(mode==='cancelled')observation.state='C'
        if(mode==='unknown')f.observation={state:'UNKNOWN'}
        else if(mode==='early')observation.paidAt=new Date(Date.parse(context.bill.attemptedAt)-61000).toISOString()
        else if(mode==='future')observation.paidAt=new Date(Date.now()+61000).toISOString()
        if(mode!=='unknown')f.observation=observation
        const provider=mode==='account'?{...f.provider,accountId:'other-account'}:mode==='throw'?{...f.provider,read:async()=>{throw Error('PRIVATE_UPSTREAM_DATA')}}:f.provider
        assert.equal(await recovery.inspectBillRecovery(context,provider),null,mode);await assertHeld(f)
      }
      late.paid();const context=await late.context();assert.ok(context)
      assert.equal(await recovery.inspectBillRecovery(context,late.provider),null);await assertHeld(late)
    })
    await t.test('stale reads, stale order versions and tampered server evidence roll back their audit and keep the invoice held',async()=>{
      for(const mode of ['old-proof','token','version','fingerprint','tenant','attempt']){
        const f=await fixture();f.paid();const input=await f.action(),context=await f.context(),proof=await recovery.inspectBillRecovery(context,f.provider)
        assert.ok(proof)
        if(mode==='old-proof')proof.checkedAt=new Date(Date.now()-61000).toISOString()
        if(mode==='token')await billing.checkOrderPayment(f.orderId,true,f.billing)
        if(mode==='version')input.expectedVersion=String(BigInt(input.expectedVersion)+1n)
        if(mode==='fingerprint')proof.requestFingerprint='0'.repeat(64)
        if(mode==='tenant')proof.tenantId='other-tenant'
        if(mode==='attempt')proof.attemptedAt=new Date(Date.parse(proof.attemptedAt)-1).toISOString()
        await assert.rejects(withClient(c=>admin.applyOrderAdminAction(c,'fixture',input,undefined,undefined,undefined,undefined,proof)))
        await assertHeld(f)
      }
    })
    await t.test('a cancellation or newer observation between inspection and commit wins over recovery',async()=>{
      for(const mode of ['cancel','new-read']){
        const f=await fixture();f.paid();const input=await f.action()
        const response=await adminHttp.orderAdminPost(request(input),{...f.admin,inspectBillRecovery:async context=>{
          const proof=await recovery.inspectBillRecovery(context,f.provider)
          if(mode==='cancel')f.observation={state:'C',billId:f.bill.billId,amountWon:null,paidAt:null}
          await billing.checkOrderPayment(f.orderId,true,f.billing)
          return proof
        }})
        assert.equal(response.status,409)
        assert.equal((await query("SELECT count(*)::int AS n FROM daechion_orders.admin_actions WHERE order_id=$1 AND action='RECONCILE_BILL'",[f.orderId])).rows[0].n,0)
        if(mode==='cancel'){assert.equal((await orderRow(f.orderId)).payment_state,'CANCELLED');assert.equal((await billRow(f.orderId)).state,'CANCELLED')}
        else await assertHeld(f)
        assert.equal(f.sends,1)
      }
    })
    await t.test('database guards reject forged timestamps, unapproved recovery links and incomplete recovery audit commits',async()=>{
      const f=await fixture();f.paid();const input=await f.action(),context=await f.context(),proof=await recovery.inspectBillRecovery(context,f.provider)
      await assert.rejects(query('UPDATE daechion_orders.bills SET send_attempted_at=now() WHERE order_id=$1',[f.orderId]),/ORDER_BILL_ATTEMPT_FROZEN/)
      await assert.rejects(query("UPDATE daechion_orders.bills SET send_recovery_action_id=$2,state='SENT',sent_at=send_attempted_at,due_at=send_attempted_at+interval '7 days',last_payment_state='PAID',checked_at=clock_timestamp() WHERE order_id=$1",[f.orderId,randomUUID()]),/ORDER_BILL_RECOVERY_APPROVAL_REQUIRED/)
      await assert.rejects(query(`INSERT INTO daechion_orders.admin_actions(request_key,order_id,fingerprint,action,operator_name,reason,before_version,after_version,recovery_evidence)
        VALUES($1,$2,$3,'RECONCILE_BILL','검수','미완료 복구',$4,$5,$6::jsonb)`,
        [input.requestKey,f.orderId,'a'.repeat(64),input.expectedVersion,(BigInt(input.expectedVersion)+1n).toString(),JSON.stringify({billRecovery:proof})]),/ORDER_ADMIN_COMMIT_INCOMPLETE/)
      await assertHeld(f)
    })
    await t.test('normal send acknowledgement remains unchanged and cancelled or late SENT bills cannot enter this recovery',async()=>{
      const normal=await fixture('SENT'),normalBill=await billRow(normal.orderId)
      assert.equal(normalBill.state,'SENT');assert.equal(normalBill.send_recovery_action_id,null);assert.ok(normalBill.send_attempted_at)
      assert.equal(await normal.context(),null)
      const cancelled=await fixture();cancelled.observation={state:'D',billId:cancelled.bill.billId,amountWon:null,paidAt:null}
      await billing.checkOrderPayment(cancelled.orderId,true,cancelled.billing);assert.equal(await cancelled.context(),null)
      const lateSent=await fixture('SENT');await query("UPDATE daechion_orders.bills SET sent_at=now()-interval '8 days',due_at=now()-interval '1 day' WHERE order_id=$1",[lateSent.orderId])
      lateSent.paid();await billing.checkOrderPayment(lateSent.orderId,true,lateSent.billing)
      const detail=await withClient(c=>admin.orderDetail(c,'fixture',lateSent.orderId))
      assert.equal(detail.order.review_code,'late_payment');assert.equal(detail.canResumePaid,false);assert.equal(detail.canReconcileBill,false)
    })
  }finally{await db.close()}
})
