import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,readdirSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {PGlite} from '@electric-sql/pglite'

const build=process.env.DAECHION_AUTOMATIC_REVIEW_TEST_BUILD??'.daechion-test-build'
const load=async name=>(await import(new URL(`../${build}/lib/daechion/orders/${name}.js`,import.meta.url))).default
const automatic=await load('automatic-review'),checkout=await load('checkout'),admin=await load('admin')
const manual=await load('manual-review'),billing=await load('billing'),preflight=await load('preflight'),enrollment=await load('enrollment')
const scheduler=await load('scheduler')

test('existing-student automatic review admits only fresh complete read-only evidence for untouched orders',async t=>{
  const db=new PGlite();let tail=Promise.resolve(),sequence=0
  const withClient=run=>{const next=tail.then(()=>run(db));tail=next.catch(()=>{});return next}
  const products=[101,102].map(id=>({productId:`product-${id}`,title:`검수 ${id}`,saleKind:'SINGLE',priceWon:1000,tenantId:'fixture',revision:'r1',
    purchaseProcess:'PROCESS_2',visible:true,lectures:[{id,name:`강의 ${id}`}]}))
  const query=(sql,args)=>withClient(c=>c.query(sql,args))
  const row=async id=>(await query('SELECT * FROM daechion_orders.orders WHERE id=$1',[id])).rows[0]
  const actions=async id=>(await query('SELECT * FROM daechion_orders.admin_actions WHERE order_id=$1 ORDER BY after_version',[id])).rows
  const fixture=async(extra={})=>{
    const n=++sequence,contact={studentName:`검수 학생 ${n}`,studentPhone:`0100000${String(n).padStart(4,'0')}`,guardianName:'검수 보호자',
      guardianPhone:`0100001${String(n).padStart(4,'0')}`,payerPhone:'01000009999',applicantType:'STUDENT',studentHistory:'EXISTING',agreePrivacy:true,confirmPayment:true,...extra.contact}
    const ports={tenantId:'fixture',subjectSecret:'s'.repeat(32),catalog:async()=>products,withClient,
      ownership:async(cart,_contact,key)=>({cartFingerprint:cart.fingerprint,subjectKey:key,checkedAt:new Date().toISOString(),identity:'REVIEW',existingStudent:'EXISTING',
        lectures:cart.items.flatMap(i=>i.lectures.map(l=>({id:l.id,state:'UNKNOWN'}))),...extra.report})}
    const quote=await checkout.quoteCheckout({items:products.map(p=>({productId:p.productId})),contact,expectedTotalWon:2000},ports)
    const {orderId}=await checkout.receiveOrder({quoteId:quote.quoteId,quoteToken:quote.quoteToken,requestKey:randomUUID(),expectedTotalWon:2000},ports)
    const f={orderId,quote,contact,profiles:[{id:9000+n,name:contact.studentName,active:false,studentPhoneNumber:contact.studentPhone,parentPhoneNumber:'01000008888',parentPhoneNumber2:contact.guardianPhone}],
      scans:0,creates:0,scan:undefined}
    f.api={me:async()=>({tenantId:'fixture'}),student:async id=>({...f.profiles.find(p=>p.id===id)}),
      students:async phone=>f.profiles.filter(p=>[p.studentPhoneNumber,p.parentPhoneNumber,p.parentPhoneNumber2].includes(phone)).map(p=>({...p})),
      createStudent:async()=>{f.creates++;throw Error('AUTOMATIC_REVIEW_MUST_NOT_CREATE')},
      lectures:async()=>[101,102].map(id=>({id,opened:true,weeklyLectures:[{id:id*100}]}))}
    f.inspectOwnership=async input=>{f.scans++;return f.scan?f.scan(input):{studentId:input.studentId,lectures:input.lectureIds.map(id=>({id,state:'NOT_OWNED'}))}}
    f.autoPorts={tenantId:'fixture',withClient,api:f.api,inspectOwnership:f.inspectOwnership}
    f.hold=async()=>{
      const current=await row(orderId)
      return withClient(c=>admin.applyOrderAdminAction(c,'fixture',{requestKey:randomUUID(),orderId,expectedVersion:String(current.version),action:'HOLD',operatorName:'실제 담당자',reason:'수동 확인 보류',confirmed:true}))
    }
    return f
  }
  const assertUntouched=async f=>{
    assert.equal((await row(f.orderId)).checkout_state,'REVIEW')
    assert.equal((await actions(f.orderId)).length,0)
    assert.equal((await query('SELECT count(*)::int AS n FROM daechion_orders.bills WHERE order_id=$1',[f.orderId])).rows[0].n,0)
    assert.equal(f.creates,0)
  }
  const providerFor=()=>{
    let bill,sends=0,observation={state:'UNKNOWN'}
    return {accountId:'fixture-account',send:async input=>{bill=input;sends++;return 'SENT'},read:async()=>observation,
      get sends(){return sends},paid(){observation={state:'F',billId:bill.billId,amountWon:2000,paidAt:new Date().toISOString()}}}
  }
  const billingPorts=(f,provider)=>({withClient,provider,preflight:context=>preflight.preflightOrder(context,{tenantId:'fixture',subjectSecret:'s'.repeat(32),
    api:{...f.api,inspectOwnership:f.inspectOwnership},manualReview:context=>withClient(c=>manual.latestReview(c,context.orderId))})})
  try{
    for(const name of ['001_initial.sql','002_identity.sql','006_operations.sql'])await db.exec(readFileSync(new URL(`../db/daechion/${name}`,import.meta.url),'utf8'))
    for(const name of readdirSync(new URL('../db/daechion-orders/',import.meta.url)).filter(name=>/^\d+.*\.sql$/.test(name)).sort())
      await db.exec(readFileSync(new URL(`../db/daechion-orders/${name}`,import.meta.url),'utf8'))

    await t.test('billing scheduler selects an untouched existing-student review after Sheets completes and preserves hold, duplicate and recovery exclusions',async()=>{
      const initial=await fixture(),human=await fixture(),duplicate=await fixture(),recovery=await fixture(),ready=await fixture()
      await human.hold()
      duplicate.scan=async input=>({studentId:input.studentId,lectures:input.lectureIds.map(id=>({id,state:'OWNED'}))})
      assert.equal(await automatic.autoReviewExistingOrder(duplicate.orderId,duplicate.autoPorts),'OWNED')
      await query("UPDATE daechion_orders.orders SET review_code='identity_create_unknown',identity_write_started=true WHERE id=$1",[recovery.orderId])
      assert.equal(await automatic.autoReviewExistingOrder(ready.orderId,ready.autoPorts),'APPROVED')
      for(const f of [initial,human,duplicate,recovery,ready])await query("UPDATE daechion_orders.jobs SET state='DONE' WHERE order_id=$1 AND kind='SHEETS'",[f.orderId])
      const flags={send:false,read:false,enroll:false,message:false,sheets:false}
      assert.deepEqual(await withClient(c=>scheduler.selectScheduledOrders(c,'fixture',flags)),[])
      const selected=await withClient(c=>scheduler.selectScheduledOrders(c,'fixture',{...flags,send:true}))
      assert.deepEqual(selected.map(order=>order.id).sort(),[initial.orderId,ready.orderId].sort())
      assert.equal((await row(initial.orderId)).checkout_state,'REVIEW')
      assert.equal(await automatic.autoReviewExistingOrder(recovery.orderId,recovery.autoPorts),'SKIPPED')
    })
    await t.test('inactive existing student and guardian2 automatically pass, bill once, and reuse the exact account after payment',async()=>{
      const f=await fixture()
      assert.equal(await automatic.autoReviewExistingOrder(f.orderId,f.autoPorts),'APPROVED')
      const saved=await row(f.orderId),audit=await actions(f.orderId)
      assert.equal(saved.checkout_state,'READY');assert.equal(saved.identity_state,'WAITING');assert.equal(saved.student_id,null);assert.ok(saved.confirmed_at)
      assert.equal(audit.length,1);assert.equal(audit[0].action,'APPROVE_EXISTING');assert.equal(audit[0].operator_name,'시스템 자동 확인')
      assert.match(audit[0].reason,/^자동 보유 강의 확인:/);assert.equal(Number(audit[0].student_id),f.profiles[0].id)
      assert.deepEqual(audit[0].target_ids,[101,102]);assert.equal(f.scans,1)
      const proof=await withClient(c=>manual.latestReview(c,f.orderId));assert.equal(proof.automatic,true)
      assert.equal(await automatic.autoReviewExistingOrder(f.orderId,f.autoPorts),'SKIPPED')
      const provider=providerFor(),ports=billingPorts(f,provider)
      assert.equal(await billing.sendOrderBill(f.orderId,true,ports),'SENT');assert.equal(provider.sends,1);assert.equal(f.scans,2)
      assert.equal(await billing.sendOrderBill(f.orderId,true,ports),'SKIPPED');assert.equal(provider.sends,1)
      provider.paid();assert.equal(await billing.checkOrderPayment(f.orderId,true,ports),'PAID')
      const granted=[],daechion={...f.api,enroll:async()=>{throw Error('FULL_COURSE_ENROLLMENT_FORBIDDEN')},
        ensureFirstLessonAccess:async input=>{await input.beforeWrite();if(!input.enrollmentRecorded){granted.push([input.lectureId,input.studentId]);await input.recordEnrollment()}
          return {verified:true,lectureId:input.lectureId,studentId:input.studentId,weeklyLectureIds:[input.weeklyLectureId]}}}
      for(let n=0;n<2;n++)assert.equal(await enrollment.runOrderGrant(f.orderId,true,{withClient,provider,tenantId:'fixture',daechion}),'VERIFIED')
      assert.deepEqual(granted,[[101,f.profiles[0].id],[102,f.profiles[0].id]]);assert.equal(f.creates,0)
      assert.equal(Number((await row(f.orderId)).student_id),f.profiles[0].id)
    })
    await t.test('missing, duplicate, unexpected, uncertain or mismatched ownership evidence never approves an order',async()=>{
      for(const mode of ['missing','duplicate','unexpected','student','unknown','transport']){
        const f=await fixture()
        f.scan=async input=>{
          if(mode==='transport')throw Error('UPSTREAM_PRIVATE_DETAILS')
          const result={studentId:input.studentId,lectures:input.lectureIds.map(id=>({id,state:'NOT_OWNED'}))}
          if(mode==='missing')result.lectures.pop()
          if(mode==='duplicate')result.lectures[1]={...result.lectures[0]}
          if(mode==='unexpected')result.lectures[1].id=999
          if(mode==='student')result.studentId++
          if(mode==='unknown')result.lectures[0].state='UNKNOWN'
          return result
        }
        assert.equal(await automatic.autoReviewExistingOrder(f.orderId,f.autoPorts),'REVIEW',mode);await assertUntouched(f)
      }
    })
    await t.test('any owned target records a bounded hold and never subtracts items or sends an invoice',async()=>{
      const f=await fixture()
      f.scan=async input=>({studentId:input.studentId,lectures:input.lectureIds.map((id,index)=>({id,state:index?'NOT_OWNED':'OWNED'}))})
      assert.equal(await automatic.autoReviewExistingOrder(f.orderId,f.autoPorts),'OWNED')
      const held=await row(f.orderId);assert.equal(held.review_code,'ownership_already_enrolled');assert.equal(held.total_won,2000)
      assert.equal((await query('SELECT count(*)::int AS n FROM daechion_orders.items WHERE order_id=$1',[f.orderId])).rows[0].n,2)
      await assertUntouched(f)
      assert.equal(await automatic.autoReviewExistingOrder(f.orderId,f.autoPorts),'SKIPPED');assert.equal(f.scans,1)
    })
    await t.test('a declaration mismatch, ambiguous sibling, name mismatch or unlinked guardian cannot use the automatic path',async()=>{
      for(const mode of ['declaration','ambiguous','name','guardian','tenant']){
        const f=await fixture(mode==='declaration'?{contact:{studentHistory:'NEW'}}:{})
        if(mode==='ambiguous')f.profiles.push({...f.profiles[0],id:f.profiles[0].id+1000,name:'형제',studentPhoneNumber:'01000007777'})
        if(mode==='name')f.profiles[0].name='다른 이름'
        if(mode==='guardian')f.profiles[0].parentPhoneNumber2='01000006666'
        if(mode==='tenant')f.api.me=async()=>({tenantId:'different'})
        assert.equal(await automatic.autoReviewExistingOrder(f.orderId,f.autoPorts),mode==='declaration'?'SKIPPED':'REVIEW',mode)
        await assertUntouched(f);assert.equal(f.scans,0)
      }
    })
    await t.test('a quote without positive existing-student lookup evidence is not silently auto-approved',async()=>{
      const unknown=await fixture({report:{existingStudent:'UNKNOWN'}})
      assert.equal(await automatic.autoReviewExistingOrder(unknown.orderId,unknown.autoPorts),'SKIPPED')
      await assertUntouched(unknown);assert.equal(unknown.scans,0)
      const human=await fixture();await human.hold()
      assert.equal(await automatic.autoReviewExistingOrder(human.orderId,human.autoPorts),'SKIPPED')
      assert.equal(human.scans,0);assert.equal((await actions(human.orderId)).length,1)
    })
    await t.test('profile changes during the browser read and reads exceeding sixty seconds cannot approve',async()=>{
      for(const field of ['name','parentPhoneNumber2']){
        const f=await fixture()
        f.scan=async input=>{f.profiles[0][field]=field==='name'?'읽는 동안 변경':'01000005555';return {studentId:input.studentId,lectures:input.lectureIds.map(id=>({id,state:'NOT_OWNED'}))}}
        assert.equal(await automatic.autoReviewExistingOrder(f.orderId,f.autoPorts),'REVIEW');await assertUntouched(f)
      }
      const slow=await fixture(),now=Date.now;let elapsed=0
      slow.scan=async input=>{elapsed=61000;return {studentId:input.studentId,lectures:input.lectureIds.map(id=>({id,state:'NOT_OWNED'}))}}
      Date.now=()=>now()+elapsed
      try{assert.equal(await automatic.autoReviewExistingOrder(slow.orderId,slow.autoPorts),'REVIEW')}finally{Date.now=now}
      await assertUntouched(slow)
    })
    await t.test('a human hold racing the ownership read wins and is never overwritten',async()=>{
      const f=await fixture()
      f.scan=async input=>{await f.hold();return {studentId:input.studentId,lectures:input.lectureIds.map(id=>({id,state:'NOT_OWNED'}))}}
      assert.equal(await automatic.autoReviewExistingOrder(f.orderId,f.autoPorts),'STALE')
      const held=await row(f.orderId),audit=await actions(f.orderId)
      assert.equal(held.review_code,'admin_hold');assert.equal(audit.length,1);assert.equal(audit[0].operator_name,'실제 담당자')
      assert.equal(await automatic.autoReviewExistingOrder(f.orderId,f.autoPorts),'SKIPPED')
    })
    await t.test('concurrent automatic readers can record only one approval for the same immutable order',async()=>{
      const f=await fixture(),results=await Promise.all([automatic.autoReviewExistingOrder(f.orderId,f.autoPorts),automatic.autoReviewExistingOrder(f.orderId,f.autoPorts)])
      assert.equal(results.filter(result=>result==='APPROVED').length,1)
      assert.equal((await actions(f.orderId)).length,1)
      assert.equal((await row(f.orderId)).checkout_state,'READY')
    })
    await t.test('fresh billing rechecks ownership and changed account IDs after billing never create replacement accounts',async()=>{
      const first=await fixture();assert.equal(await automatic.autoReviewExistingOrder(first.orderId,first.autoPorts),'APPROVED')
      first.scan=async input=>({studentId:input.studentId,lectures:input.lectureIds.map(id=>({id,state:'OWNED'}))})
      const rejectedProvider=providerFor();assert.equal(await billing.sendOrderBill(first.orderId,true,billingPorts(first,rejectedProvider)),'SKIPPED')
      assert.equal(rejectedProvider.sends,0);assert.equal((await row(first.orderId)).review_code,'billing_preflight_review')
      for(const field of ['id','parentPhoneNumber2']){
        const second=await fixture();assert.equal(await automatic.autoReviewExistingOrder(second.orderId,second.autoPorts),'APPROVED')
        const provider=providerFor(),ports=billingPorts(second,provider)
        assert.equal(await billing.sendOrderBill(second.orderId,true,ports),'SENT');provider.paid();assert.equal(await billing.checkOrderPayment(second.orderId,true,ports),'PAID')
        if(field==='id')second.profiles[0].id+=10000
        else second.profiles[0].parentPhoneNumber2='01000005555'
        const daechion={...second.api,ensureFirstLessonAccess:async()=>{throw Error('WRONG_ACCOUNT_MUST_NOT_ENROLL')}}
        assert.equal(await enrollment.runOrderGrant(second.orderId,true,{withClient,provider,tenantId:'fixture',daechion}),'SKIPPED')
        assert.equal((await row(second.orderId)).checkout_state,'REVIEW');assert.equal(second.creates,0)
      }
    })
  }finally{await db.close()}
})
