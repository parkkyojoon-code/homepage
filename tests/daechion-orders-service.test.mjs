import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {PGlite} from '@electric-sql/pglite'
import pg from 'pg'
import checkout from '../.daechion-test-build/lib/daechion/orders/checkout.js'
import http from '../.daechion-test-build/lib/daechion/orders/http.js'
import ownership from '../.daechion-test-build/lib/daechion/orders/ownership.js'
import cartPolicy from '../.daechion-test-build/lib/daechion/orders/cart.js'
import catalogPolicy from '../.daechion-test-build/lib/daechion/orders/catalog.js'
import orderBilling from '../.daechion-test-build/lib/daechion/orders/billing.js'
import orderEnrollment from '../.daechion-test-build/lib/daechion/orders/enrollment.js'
import orderRunner from '../.daechion-test-build/lib/daechion/orders/runner.js'
import orderMessage from '../.daechion-test-build/lib/daechion/orders/ready-message.js'
import orderSheets from '../.daechion-test-build/lib/daechion/orders/sheets-worker.js'
import orderPublisher from '../.daechion-test-build/lib/daechion/orders/sheets-publisher.js'
import orderView from '../.daechion-test-build/lib/daechion/orders/sheets-view.js'
import orderStore from '../.daechion-test-build/lib/daechion/orders/worker-store.js'
import orderDelivery from '../.daechion-test-build/lib/daechion/orders/delivery.js'

async function database(){
  const connectionString=process.env.DAECHION_TEST_POSTGRES_URL
  if(connectionString){
    const url=new URL(connectionString)
    if(!['127.0.0.1','localhost'].includes(url.hostname)||url.pathname!=='/daechion_ci'||url.username!=='daechion_ci')throw Error('ISOLATED_ORDER_TEST_DATABASE_REQUIRED')
    const pool=new pg.Pool({connectionString,max:5})
    return {query:(sql,values)=>pool.query(sql,values),exec:sql=>pool.query(sql),close:()=>pool.end(),
      withClient:async run=>{const c=await pool.connect();try{return await run(c)}finally{c.release()}}}
  }
  const db=new PGlite();let tail=Promise.resolve()
  return {query:(sql,values)=>db.query(sql,values),exec:sql=>db.exec(sql),close:()=>db.close(),
    withClient:run=>{const next=tail.then(()=>run(db));tail=next.catch(()=>{});return next}}
}
const product=(productId,ids,priceWon=900)=>({productId,title:productId,saleKind:ids.length>1?'BUNDLE':'SINGLE',priceWon,tenantId:'fixture',revision:'r1',purchaseProcess:'PROCESS_2',visible:true,lectures:ids.map(id=>({id,name:`강의 ${id}`}))})
const products=[product('a',[10],12900),product('b',[11],18500),product('pack',[20,21],25000),product('overlap',[20],900)]
let sequence=0
const contact=()=>({studentName:'가상 학생',studentPhone:`0100000${String(++sequence).padStart(4,'0')}`,guardianName:'',guardianPhone:'',payerPhone:'01000009999',applicantType:'STUDENT',studentHistory:'NEW',agreePrivacy:true,confirmPayment:true})
const report=(cart,key,states={})=>({cartFingerprint:cart.fingerprint,subjectKey:key,checkedAt:new Date().toISOString(),identity:'PASSED',lectures:cart.items.flatMap(i=>i.lectures.map(l=>({id:l.id,state:states[l.id]??'NOT_OWNED'})))})
const request=(body,headers={})=>new Request('https://fixture.invalid/api/daechion/orders',{method:'POST',headers:{origin:'https://fixture.invalid','content-type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)})

test('checkout service persists token-bound quotes and atomic orders without external writes',async t=>{
  const db=await database()
  const ports={tenantId:'fixture',subjectSecret:'s'.repeat(32),catalog:async()=>products,ownership:async(cart,_contact,key)=>report(cart,key),withClient:db.withClient}
  const quote=(ids=['a','b'],extra={})=>checkout.quoteCheckout({items:ids.map(productId=>({productId})),contact:contact(),expectedTotalWon:ids.reduce((s,id)=>s+products.find(p=>p.productId===id).priceWon,0),...extra},ports)
  const orderInput=q=>({quoteId:q.quoteId,quoteToken:q.quoteToken,requestKey:randomUUID(),expectedTotalWon:q.totalWon})
  try{
    // This file runs serially after the other DB suites and only in a disposable database.
    await db.exec('DROP SCHEMA IF EXISTS daechion_orders CASCADE; DROP SCHEMA IF EXISTS daechion_automation CASCADE;')
    await db.exec(readFileSync(new URL('../db/daechion/001_initial.sql',import.meta.url),'utf8'))
    await db.exec(readFileSync(new URL('../db/daechion-orders/001_initial.sql',import.meta.url),'utf8'))
    await db.exec(readFileSync(new URL('../db/daechion/002_identity.sql',import.meta.url),'utf8'))
    await db.exec(readFileSync(new URL('../db/daechion-orders/002_workers.sql',import.meta.url),'utf8'))
    await db.exec(readFileSync(new URL('../db/daechion-orders/003_delivery.sql',import.meta.url),'utf8'))
    await t.test('one exact total produces immutable items, grants, one Sheets job and no bill or student',async()=>{
      const q=await quote(),input=orderInput(q)
      assert.equal(q.status,'READY');assert.equal(q.totalWon,31400)
      const stored=(await db.query('SELECT token_hash,snapshot FROM daechion_orders.quotes WHERE id=$1',[q.quoteId])).rows[0]
      assert.notEqual(stored.token_hash,q.quoteToken);assert.ok(!JSON.stringify(stored).includes(q.quoteToken))
      const result=await checkout.receiveOrder(input,ports)
      assert.equal(result.created,true);assert.equal(result.reviewRequired,false)
      const row=(await db.query('SELECT * FROM daechion_orders.orders WHERE id=$1',[result.orderId])).rows[0]
      assert.equal(row.checkout_state,'READY');assert.equal(row.payment_state,'PENDING');assert.equal(row.student_id,null)
      assert.equal((await db.query('SELECT count(*)::int AS n FROM daechion_orders.items WHERE order_id=$1',[result.orderId])).rows[0].n,2)
      assert.equal((await db.query('SELECT count(*)::int AS n FROM daechion_orders.grants WHERE order_id=$1',[result.orderId])).rows[0].n,2)
      assert.equal((await db.query('SELECT kind FROM daechion_orders.jobs WHERE order_id=$1',[result.orderId])).rows[0].kind,'SHEETS')
      assert.equal((await db.query('SELECT count(*)::int AS n FROM daechion_orders.bills')).rows[0].n,0)
      assert.deepEqual(await checkout.receiveOrder(input,ports),{...result,created:false})
      await assert.rejects(checkout.receiveOrder({...input,quoteToken:'0'.repeat(64)},ports),/QUOTE_UNAVAILABLE/)
      await assert.rejects(checkout.receiveOrder({...input,expectedTotalWon:1},ports),/REQUEST_CONFLICT/)
      await assert.rejects(checkout.receiveOrder({...input,requestKey:randomUUID()},ports),/REQUEST_CONFLICT/)
    })
    await t.test('overlap never performs ownership lookup or saves a quote',async()=>{
      const result=await checkout.quoteCheckout({items:[{productId:'pack'},{productId:'overlap'}],contact:contact(),expectedTotalWon:25900},{...ports,ownership:()=>{throw Error('MUST_NOT_LOOKUP')}})
      assert.equal(result.status,'CART_CONFLICT');assert.equal(result.quoteToken,undefined)
    })
    await t.test('owned single requires the changed total, all-owned creates nothing, owned bundle is non-billable review',async()=>{
      const input={items:[{productId:'a'},{productId:'b'}],contact:contact(),expectedTotalWon:31400}
      const q=await checkout.quoteCheckout(input,{...ports,ownership:async(c,_p,k)=>report(c,k,{10:'OWNED'})})
      assert.equal(q.status,'RECONFIRM');assert.equal(q.totalWon,18500)
      await assert.rejects(checkout.receiveOrder({...orderInput(q),expectedTotalWon:31400},ports),/PRICE_CHANGED/)
      const accepted=await checkout.receiveOrder(orderInput(q),ports)
      assert.equal((await db.query('SELECT product_id FROM daechion_orders.items WHERE order_id=$1',[accepted.orderId])).rows[0].product_id,'b')
      const none=await checkout.quoteCheckout({...input,contact:contact()},{...ports,ownership:async(c,_p,k)=>report(c,k,{10:'OWNED',11:'OWNED'})})
      assert.equal(none.status,'NO_PURCHASE');assert.equal(none.quoteId,undefined)
      const hold=await checkout.quoteCheckout({items:[{productId:'pack'}],contact:contact(),expectedTotalWon:25000},{...ports,ownership:async(c,_p,k)=>report(c,k,{20:'OWNED'})})
      assert.equal(hold.status,'REVIEW');assert.equal(hold.totalWon,25000)
      const held=await checkout.receiveOrder(orderInput(hold),ports)
      assert.equal(held.reviewRequired,true)
      assert.equal((await db.query('SELECT checkout_state FROM daechion_orders.orders WHERE id=$1',[held.orderId])).rows[0].checkout_state,'REVIEW')
    })
    await t.test('expiry, changed catalog and mismatched subject secret cannot create an order',async()=>{
      const expired=await quote();await db.query("UPDATE daechion_orders.quotes SET state='EXPIRED' WHERE id=$1",[expired.quoteId])
      await assert.rejects(checkout.receiveOrder(orderInput(expired),ports),/QUOTE_UNAVAILABLE/)
      const changed=await quote()
      await assert.rejects(checkout.receiveOrder(orderInput(changed),{...ports,catalog:async()=>products.map(p=>({...p,revision:'r2'}))}),/PRICE_CHANGED/)
      await assert.rejects(checkout.receiveOrder(orderInput(changed),{...ports,subjectSecret:'t'.repeat(32)}),/QUOTE_UNAVAILABLE/)
      assert.equal((await db.query('SELECT count(*)::int AS n FROM daechion_orders.orders WHERE quote_id=$1',[changed.quoteId])).rows[0].n,0)
    })
    await t.test('two tabs with distinct tokens and request keys cannot buy overlapping targets twice',async()=>{
      const person=contact(),q1=await quote(['a'],{contact:person}),q2=await quote(['a'],{contact:person})
      const results=await Promise.allSettled([checkout.receiveOrder(orderInput(q1),ports),checkout.receiveOrder(orderInput(q2),ports)])
      assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
      assert.equal(results.find(r=>r.status==='rejected').reason.code,'ORDER_PENDING')
      assert.equal((await db.query('SELECT count(*)::int AS n FROM daechion_orders.orders WHERE student_phone=$1',[person.studentPhone])).rows[0].n,1)
    })
    await t.test('pending legacy intake and shared guardian identities are held without touching legacy rows',async()=>{
      const person=contact(),id=randomUUID(),saved={...person,noticeVersion:'fixture'}
      await db.query(`INSERT INTO daechion_automation.applications(id,request_key,request_fingerprint,product_id,product_title,tuition_won,textbook_won,total_won,submission) VALUES($1,$2,$3,'old','fixture',900,0,900,$4::jsonb)`,[id,randomUUID(),'0'.repeat(64),JSON.stringify(saved)])
      await db.query('INSERT INTO daechion_automation.registrations(application_id,lecture_id) VALUES($1,10)',[id])
      await assert.rejects(checkout.receiveOrder(orderInput(await quote(['a'],{contact:person})),ports),/ORDER_PENDING/)
      assert.deepEqual((await db.query('SELECT submission FROM daechion_automation.applications WHERE id=$1',[id])).rows[0].submission,saved)
      const related=contact();related.guardianPhone=person.studentPhone
      await assert.rejects(checkout.receiveOrder(orderInput(await quote(['a'],{contact:related})),ports),/ORDER_PENDING/)
    })
    await t.test('atomic rollback leaves no half order when outbox persistence fails',async()=>{
      const q=await quote(),input=orderInput(q)
      const failing={...ports,withClient:run=>db.withClient(c=>run({query:(sql,p)=>sql.includes('INSERT INTO daechion_orders.jobs')?Promise.reject(Error('FIXTURE_FAILURE')):c.query(sql,p)}))}
      await assert.rejects(checkout.receiveOrder(input,failing),/FIXTURE_FAILURE/)
      assert.equal((await db.query('SELECT count(*)::int AS n FROM daechion_orders.orders WHERE quote_id=$1',[q.quoteId])).rows[0].n,0)
      assert.equal((await db.query('SELECT state FROM daechion_orders.quotes WHERE id=$1',[q.quoteId])).rows[0].state,'READY')
      assert.equal((await checkout.receiveOrder(input,ports)).created,true)
    })
    await t.test('HTTP defaults off, rejects forged input/origin/oversized data and hides internal failures',async()=>{
      const web={...ports,settings:{origins:['https://fixture.invalid']},ready:async()=>{}}
      assert.deepEqual(await (await http.orderCatalog({...web,settings:null})).json(),{available:false,products:[]})
      const listing=await (await http.orderCatalog({...web,catalog:async()=>[...products,{...products[0],productId:'forged',purchaseProcess:'PROCESS_1'}]})).json()
      assert.equal(listing.available,true);assert.equal(listing.products.length,products.length)
      assert.deepEqual(Object.keys(listing.products[0]).sort(),['lectureCount','priceWon','productId','saleKind','title'])
      assert.equal((await http.orderCatalog({...web,ready:async()=>{throw Error('NO_SCHEMA')}})).status,503)
      assert.equal((await http.orderPost('cart',request({}),{...web,settings:null})).status,503)
      assert.equal((await http.orderPost('cart',request({},{origin:'https://evil.invalid'}),web)).status,403)
      assert.equal((await http.orderPost('cart',request({},{'content-type':'text/plain'}),web)).status,415)
      assert.equal((await http.orderPost('cart',request('x'.repeat(17000)),web)).status,413)
      assert.equal((await http.orderPost('cart',request({items:[{productId:'a',priceWon:1}]}),web)).status,400)
      const broken=await http.orderPost('cart',request({items:[{productId:'a'}]}),{...web,ready:async()=>{throw Error('secret phone SQL')}})
      assert.equal(broken.status,503);assert.ok(!(await broken.text()).includes('secret'))
      const response=await http.orderPost('quotes',request({items:[{productId:'a'}],contact:contact(),expectedTotalWon:12900}),web)
      assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store')
      const q=await response.json(),result=await http.orderPost('orders',request(orderInput(q)),web)
      assert.equal(result.status,201);assert.equal((await result.json()).status,'RECEIVED')
      const env={DAECHION_ORDERS_ENABLED:'true',DAECHION_DATABASE_URL:'fixture',DAECHION_API_KEY:'fixture',DAECHION_TENANT_ID:'fixture',DAECHION_ORDERS_SUBJECT_SECRET:'s'.repeat(32),DAECHION_APP_ORIGIN:'https://fixture.invalid'}
      assert.ok(http.orderSettings(env));assert.equal(http.orderSettings({...env,DAECHION_INTAKE_ENABLED:'true'}),null)
      assert.equal(http.orderSettings({...env,DAECHION_APP_ORIGIN:'http://public.invalid'}),null)
    })
    const workerOrder=async(ids=['pack','b'])=>checkout.receiveOrder(orderInput(await quote(ids)),ports)
    const providerFor=(amount)=>{
      let sends=0,bill,observation={state:'UNKNOWN'}
      return {accountId:'fixture-account',send:async job=>{sends++;bill=job;return 'SENT'},read:async()=>observation,
        get sends(){return sends},get bill(){return bill},set observation(value){observation=value},
        paid(){observation={state:'F',billId:bill.billId,amountWon:amount,paidAt:new Date().toISOString()}}}
    }
    await t.test('one invoice covers a bundle and single, flags default off and incomplete access cannot notify',async()=>{
      const order=await workerOrder(),provider=providerFor(43500),billing={withClient:db.withClient,provider,preflight:async context=>{context.totalWon=1;context.contact.payerPhone='01000000000';return 'READY'}}
      assert.equal(await orderBilling.sendOrderBill(order.orderId,false,billing),'DISABLED');assert.equal(provider.sends,0)
      assert.equal(await orderBilling.checkOrderPayment(order.orderId,false,billing),'DISABLED')
      assert.equal(await orderEnrollment.runOrderGrant(order.orderId,false,{}),'DISABLED')
      await assert.rejects(db.query("UPDATE daechion_orders.orders SET notification_state='PENDING' WHERE id=$1",[order.orderId]),/ORDER_CONTENT_NOT_READY/)
      const results=await Promise.all([orderBilling.sendOrderBill(order.orderId,true,billing),orderBilling.sendOrderBill(order.orderId,true,billing)])
      assert.equal(results.filter(v=>v==='SENT').length,1);assert.equal(provider.sends,1)
      assert.equal(provider.bill.amountWon,43500);assert.match(provider.bill.productName,/외 1개 상품/)
      assert.equal(provider.bill.recipientPhone,'01000009999')
      assert.equal(await orderBilling.sendOrderBill(order.orderId,true,billing),'SKIPPED');assert.equal(provider.sends,1)
      provider.paid();assert.equal(await orderBilling.checkOrderPayment(order.orderId,true,billing),'PAID')
      assert.equal((await db.query('SELECT count(*)::int AS n FROM daechion_orders.bills WHERE order_id=$1',[order.orderId])).rows[0].n,1)
      await assert.rejects(db.query("INSERT INTO daechion_orders.jobs(id,order_id,kind,event_version) VALUES($1,$2,'READY_MESSAGE',99)",[randomUUID(),order.orderId]),/ORDER_CONTENT_NOT_READY/)
    })
    await t.test('unknown send is never resent and a paid response to an unconfirmed send stays held',async()=>{
      const order=await workerOrder(['a']),provider=providerFor(12900)
      const billing={withClient:db.withClient,provider:{...provider,send:async job=>{await provider.send(job);return 'UNKNOWN'}},preflight:async()=> 'READY'}
      assert.equal(await orderBilling.sendOrderBill(order.orderId,true,billing),'UNKNOWN')
      assert.equal(await orderBilling.sendOrderBill(order.orderId,true,billing),'SKIPPED');assert.equal(provider.sends,1)
      provider.paid();assert.equal(await orderBilling.checkOrderPayment(order.orderId,true,{...billing,provider}),'RECORDED')
      const row=(await db.query('SELECT checkout_state,review_code FROM daechion_orders.orders WHERE id=$1',[order.orderId])).rows[0]
      assert.equal(row.checkout_state,'REVIEW');assert.equal(row.review_code,'bill_send_unknown')
    })
    await t.test('amount mismatch, malformed approval and cancellation never unlock access',async()=>{
      for(const state of ['amount','malformed','cancel']){
        const order=await workerOrder(['a']),provider=providerFor(12900),billing={withClient:db.withClient,provider,preflight:async()=> 'READY'}
        await orderBilling.sendOrderBill(order.orderId,true,billing);provider.paid()
        provider.observation=state==='amount'?{state:'F',billId:provider.bill.billId,amountWon:1,paidAt:new Date().toISOString()}:state==='malformed'?{state:'OTHER',billId:provider.bill.billId,amountWon:12900,paidAt:new Date().toISOString()}:{state:'C',billId:provider.bill.billId,amountWon:null,paidAt:null}
        await orderBilling.checkOrderPayment(order.orderId,true,billing)
        assert.equal((await db.query('SELECT daechion_orders.paid_eligible($1) AS ok',[order.orderId])).rows[0].ok,false)
        assert.equal((await db.query('SELECT checkout_state FROM daechion_orders.orders WHERE id=$1',[order.orderId])).rows[0].checkout_state,'REVIEW')
      }
    })
    await t.test('a stale approval cannot overwrite cancellation, and a confirmed send resolves an in-flight send review',async()=>{
      const order=await workerOrder(['a']),provider=providerFor(12900),billing={withClient:db.withClient,provider,preflight:async()=> 'READY'}
      await orderBilling.sendOrderBill(order.orderId,true,billing);provider.paid()
      const approved=await provider.read();let begin,finish
      const begun=new Promise(resolve=>{begin=resolve}),delayed=new Promise(resolve=>{finish=resolve})
      const stale=orderBilling.checkOrderPayment(order.orderId,true,{...billing,provider:{accountId:provider.accountId,read:async()=>{begin();return delayed}}})
      await begun;provider.observation={state:'C',billId:provider.bill.billId,amountWon:null,paidAt:null}
      await orderBilling.checkOrderPayment(order.orderId,true,billing);finish(approved)
      assert.equal(await stale,'STALE')
      assert.equal((await db.query('SELECT payment_state FROM daechion_orders.orders WHERE id=$1',[order.orderId])).rows[0].payment_state,'CANCELLED')
      const next=await workerOrder(['a']),second=providerFor(12900);let sending,ack
      const started=new Promise(resolve=>{sending=resolve}),reply=new Promise(resolve=>{ack=resolve})
      const sendingPorts={withClient:db.withClient,preflight:async()=> 'READY',provider:{accountId:second.accountId,send:async job=>{await second.send(job);sending();return reply}}}
      const send=orderBilling.sendOrderBill(next.orderId,true,sendingPorts)
      await started;second.observation={state:'W',billId:second.bill.billId,amountWon:null,paidAt:null}
      await orderBilling.checkOrderPayment(next.orderId,true,{withClient:db.withClient,provider:second});ack('SENT')
      assert.equal(await send,'SENT')
      assert.equal((await db.query('SELECT checkout_state FROM daechion_orders.orders WHERE id=$1',[next.orderId])).rows[0].checkout_state,'READY')
    })
    await t.test('the seven-day wait closes unpaid orders; on-time late observations recover, late payments stay held',async()=>{
      for(const late of [false,true]){
        const order=await workerOrder(['a']),provider=providerFor(12900),billing={withClient:db.withClient,provider,preflight:async()=> 'READY'}
        await orderBilling.sendOrderBill(order.orderId,true,billing)
        await db.query("UPDATE daechion_orders.bills SET sent_at=now()-interval '8 days',due_at=now()-interval '1 day' WHERE order_id=$1",[order.orderId])
        provider.observation={state:'W',billId:provider.bill.billId,amountWon:null,paidAt:null}
        await orderBilling.checkOrderPayment(order.orderId,true,billing)
        assert.equal((await db.query('SELECT checkout_state FROM daechion_orders.orders WHERE id=$1',[order.orderId])).rows[0].checkout_state,'CLOSED')
        const expiredView=await db.withClient(c=>orderView.orderSheetView(c,order.orderId))
        assert.equal(expiredView.values[orderView.ORDER_HEADERS.indexOf('처리 확인')],'대기 종료')
        provider.observation={state:'F',billId:provider.bill.billId,amountWon:12900,paidAt:new Date(Date.now()-(late?0:2*86400000)).toISOString()}
        await orderBilling.checkOrderPayment(order.orderId,true,billing)
        assert.equal((await db.query('SELECT checkout_state FROM daechion_orders.orders WHERE id=$1',[order.orderId])).rows[0].checkout_state,late?'REVIEW':'READY')
      }
    })
    const enrollmentFor=()=>{
      const students=[],enrolled=[],access=[],studentCalls=[];let failAccess=20,failCreate=false,failEnroll=0
      return {me:async()=>({tenantId:'fixture'}),lectures:async()=>[10,11,20,21].map(id=>({id,opened:true,weeklyLectures:[{id:id*100}]})),
        students:async phone=>students.filter(s=>[s.studentPhoneNumber,s.parentPhoneNumber].includes(phone)),student:async id=>students.find(s=>s.id===id),
        createStudent:async input=>{studentCalls.push(input);const student={id:1000+students.length,name:input.name,studentPhoneNumber:input.studentPhone,parentPhoneNumber:input.guardianPhone,active:false};students.push(student);if(failCreate)throw Error('UNKNOWN_CREATE');return student},
        enroll:async(lectureId,studentId)=>{enrolled.push(lectureId);if(lectureId===failEnroll)throw Error('UNKNOWN_ENROLL');return {lectureId,studentId,enrolledWeeklyLectureIds:[lectureId*100],alreadyEnrolledWeeklyLectureIds:[]}},
        ensureContentAccess:async input=>{await input.beforeWrite();access.push(input.lectureId);if(failAccess===input.lectureId){failAccess=0;throw Error('UNKNOWN_ACCESS')}return {verified:true,lectureId:input.lectureId,studentId:input.studentId,weeklyLectureIds:input.weeklyLectureIds}},
        get enrolled(){return enrolled},get access(){return access},get creates(){return studentCalls.length},set failCreate(v){failCreate=v},set failEnroll(v){failEnroll=v}}
    }
    await t.test('partial permission failure preserves completed grants and retries only recorded content access',async()=>{
      const order=await workerOrder(),provider=providerFor(43500),billing={withClient:db.withClient,provider,preflight:async()=> 'READY'},api=enrollmentFor(),enrollment={withClient:db.withClient,tenantId:'fixture',daechion:api}
      await orderBilling.sendOrderBill(order.orderId,true,billing);provider.paid();await orderBilling.checkOrderPayment(order.orderId,true,billing)
      assert.equal(await orderEnrollment.runOrderGrant(order.orderId,true,enrollment),'VERIFIED')
      const before=(await db.query('SELECT verified_at FROM daechion_orders.grants WHERE order_id=$1 AND lecture_id=11',[order.orderId])).rows[0].verified_at
      assert.equal(await orderEnrollment.runOrderGrant(order.orderId,true,enrollment),'REVIEW')
      assert.equal(await orderEnrollment.runOrderGrant(order.orderId,true,enrollment),'VERIFIED')
      assert.equal((await db.query("SELECT count(*)::int AS n FROM daechion_orders.jobs WHERE order_id=$1 AND kind='READY_MESSAGE'",[order.orderId])).rows[0].n,0)
      const input={orderId:order.orderId,lectureId:20,expectedVersion:String((await db.query('SELECT version FROM daechion_orders.orders WHERE id=$1',[order.orderId])).rows[0].version)}
      assert.equal(await orderEnrollment.retryRecordedAccess(input,{withClient:db.withClient,authorise:async()=>false}),false)
      assert.equal(await orderEnrollment.retryRecordedAccess(input,{withClient:db.withClient,authorise:async()=>true}),true)
      assert.equal(await orderEnrollment.runOrderGrant(order.orderId,true,enrollment),'VERIFIED')
      assert.equal(await orderEnrollment.runOrderGrant(order.orderId,true,enrollment),'SKIPPED')
      assert.deepEqual(api.enrolled,[11,20,21]);assert.deepEqual(api.access,[11,20,21,20]);assert.equal(api.creates,1)
      assert.deepEqual((await db.query('SELECT verified_at FROM daechion_orders.grants WHERE order_id=$1 AND lecture_id=11',[order.orderId])).rows[0].verified_at,before)
      assert.equal((await db.query("SELECT count(*)::int AS n FROM daechion_orders.jobs WHERE order_id=$1 AND kind='READY_MESSAGE'",[order.orderId])).rows[0].n,1)
      await db.query("UPDATE daechion_orders.jobs SET state='RUNNING',lease_token=$2,lease_until=now()+interval '1 minute' WHERE order_id=$1 AND kind='READY_MESSAGE'",[order.orderId,randomUUID()])
      provider.observation={state:'C',billId:provider.bill.billId,amountWon:null,paidAt:null};await orderBilling.checkOrderPayment(order.orderId,true,billing)
      assert.equal((await db.query("SELECT count(*)::int AS n FROM daechion_orders.grants WHERE order_id=$1 AND state='VERIFIED'",[order.orderId])).rows[0].n,3)
      assert.equal((await db.query("SELECT state FROM daechion_orders.jobs WHERE order_id=$1 AND kind='READY_MESSAGE'",[order.orderId])).rows[0].state,'UNKNOWN')
      assert.equal((await db.query('SELECT notification_state FROM daechion_orders.orders WHERE id=$1',[order.orderId])).rows[0].notification_state,'UNKNOWN')
    })
    await t.test('unknown student creation or enrollment is held without automatic duplicate writes',async()=>{
      for(const stage of ['create','enroll']){
        const order=await workerOrder(['a']),provider=providerFor(12900),billing={withClient:db.withClient,provider,preflight:async()=> 'READY'},api=enrollmentFor(),enrollment={withClient:db.withClient,tenantId:'fixture',daechion:api}
        await orderBilling.sendOrderBill(order.orderId,true,billing);provider.paid();await orderBilling.checkOrderPayment(order.orderId,true,billing)
        api.failCreate=stage==='create';api.failEnroll=stage==='enroll'?10:0
        await orderEnrollment.runOrderGrant(order.orderId,true,enrollment);await orderEnrollment.runOrderGrant(order.orderId,true,enrollment)
        assert.equal(api.creates,1);assert.equal(api.enrolled.length,stage==='create'?0:1)
        assert.equal((await db.query("SELECT count(*)::int AS n FROM daechion_orders.jobs WHERE order_id=$1 AND kind='READY_MESSAGE'",[order.orderId])).rows[0].n,0)
        if(stage==='create')assert.ok((await db.query('SELECT phone FROM daechion_orders.phone_claims WHERE order_id=$1',[order.orderId])).rows.length)
      }
    })
    await t.test('the gated runner uses fresh approval and never performs writes with disabled or mixed legacy flags',async()=>{
      assert.deepEqual(orderRunner.orderWorkerSettings({}),{send:false,read:false,enroll:false})
      assert.throws(()=>orderRunner.orderWorkerSettings({DAECHION_ORDER_WORKER_ENABLED:'true',DAECHION_ENROLLMENT_ENABLED:'true'}),/LEGACY_WRITES/)
      assert.deepEqual(await orderRunner.processOrder('',{send:false,read:false,enroll:false},{}),{billing:'DISABLED',payment:'DISABLED',grants:[]})
      const order=await workerOrder(['a']),provider=providerFor(12900),api=enrollmentFor(),runtime={withClient:db.withClient,provider,preflight:async()=> 'READY',tenantId:'fixture',daechion:api}
      await orderBilling.sendOrderBill(order.orderId,true,runtime);provider.paid()
      const off=await orderRunner.processOrder(order.orderId,{send:false,read:false,enroll:true},runtime)
      assert.deepEqual(off.grants,[]);assert.equal(api.creates,0)
      const result=await orderRunner.processOrder(order.orderId,{send:true,read:true,enroll:true},runtime)
      assert.deepEqual(result.grants,['VERIFIED']);assert.equal(provider.sends,1);assert.equal(api.creates,1)
    })
    const completeReady=async({guardian=false}={})=>{
      const person=contact();if(guardian)person.guardianPhone='0108888'+String(sequence).padStart(4,'0')
      const q=await quote(['a'],{contact:person}),order=await checkout.receiveOrder(orderInput(q),ports),payment=providerFor(12900)
      const runtime={withClient:db.withClient,provider:payment,preflight:async()=> 'READY',tenantId:'fixture',daechion:enrollmentFor()}
      await orderBilling.sendOrderBill(order.orderId,true,runtime);payment.paid();await orderBilling.checkOrderPayment(order.orderId,true,runtime)
      assert.equal(await orderEnrollment.runOrderGrant(order.orderId,true,runtime),'VERIFIED')
      return {orderId:order.orderId,person,payment}
    }
    await t.test('completion messages go once to the student and login guardian, never to a separate payer',async()=>{
      const {orderId,person,payment}=await completeReady({guardian:true}),sent=[]
      const delivery={withClient:db.withClient,payment,message:{send:async job=>{sent.push(job);return {accepted:true,messageId:'fixture-'+sent.length}}}}
      assert.equal(await orderMessage.sendOrderReady(orderId,false,delivery),'DISABLED')
      const results=await Promise.all([orderMessage.sendOrderReady(orderId,true,delivery),orderMessage.sendOrderReady(orderId,true,delivery)])
      assert.equal(results.filter(r=>r==='SENT').length,1)
      assert.deepEqual(sent.map(s=>s.phone).sort(),[person.studentPhone,person.guardianPhone].sort())
      assert.ok(!sent.some(s=>s.phone===person.payerPhone))
      assert.ok(sent.every(s=>s.text.includes('https://parkkyojoon.daechion.com')&&s.text.includes('전화번호 끝 4자리')&&!/노션|디스코드|학생카드/.test(s.text)))
      assert.equal(await orderMessage.sendOrderReady(orderId,true,delivery),'SKIPPED');assert.equal(sent.length,2)
      const receipt=(await db.query('SELECT id FROM daechion_orders.ready_receipts WHERE order_id=$1 LIMIT 1',[orderId])).rows[0]
      await assert.rejects(db.query("UPDATE daechion_orders.ready_receipts SET state='PENDING' WHERE id=$1",[receipt.id]),/CANNOT_RESEND/)
    })
    await t.test('an unknown message response cannot resend accepted recipients or send remaining recipients blindly',async()=>{
      const {orderId,payment}=await completeReady({guardian:true});let calls=0
      const delivery={withClient:db.withClient,payment,message:{send:async()=>{calls++;return calls===1?{accepted:true,messageId:'accepted'}:{accepted:false}}}}
      assert.equal(await orderMessage.sendOrderReady(orderId,true,delivery),'UNKNOWN')
      assert.equal(await orderMessage.sendOrderReady(orderId,true,delivery),'SKIPPED');assert.equal(calls,2)
      const states=(await db.query('SELECT state FROM daechion_orders.ready_receipts WHERE order_id=$1 ORDER BY state',[orderId])).rows.map(r=>r.state)
      assert.deepEqual(states,['SENT','UNKNOWN'])
      const unknown=(await db.query("SELECT id FROM daechion_orders.ready_receipts WHERE order_id=$1 AND state='UNKNOWN'",[orderId])).rows[0]
      await assert.rejects(db.query("UPDATE daechion_orders.ready_receipts SET state='PENDING' WHERE id=$1",[unknown.id]),/CANNOT_RESEND/)
      const view=await db.withClient(c=>orderView.orderSheetView(c,orderId))
      assert.equal(view.values[orderView.ORDER_HEADERS.indexOf('처리 확인')],'확인 필요')
      assert.match(view.values[orderView.ORDER_HEADERS.indexOf('확인 필요 사유')],/문자.*확인 필요/)
    })
    await t.test('payment cancellation between recipients blocks remaining messages and keeps the send result uncertain',async()=>{
      const {orderId,payment}=await completeReady({guardian:true});let calls=0
      const delivery={withClient:db.withClient,payment,message:{send:async()=>{
        calls++;payment.observation={state:'C',billId:payment.bill.billId,amountWon:null,paidAt:null}
        await orderBilling.checkOrderPayment(orderId,true,{withClient:db.withClient,provider:payment})
        return {accepted:true,messageId:'before-cancel'}
      }}}
      assert.equal(await orderMessage.sendOrderReady(orderId,true,delivery),'UNKNOWN');assert.equal(calls,1)
      const states=(await db.query('SELECT state FROM daechion_orders.ready_receipts WHERE order_id=$1 ORDER BY state',[orderId])).rows.map(r=>r.state)
      assert.deepEqual(states,['BLOCKED','SENT'])
    })
    await t.test('a transient payment query may resume a known unattempted notice, but incomplete orders never send',async()=>{
      const {orderId,payment}=await completeReady();const paid=await payment.read();let calls=0
      const delivery={withClient:db.withClient,payment,message:{send:async()=>{calls++;return {accepted:true,messageId:'recovered'}}}}
      payment.observation={state:'UNKNOWN'}
      assert.equal(await orderMessage.sendOrderReady(orderId,true,delivery),'SKIPPED');assert.equal(calls,0)
      payment.observation=paid;assert.equal(await orderMessage.sendOrderReady(orderId,true,delivery),'SENT');assert.equal(calls,1)
      const incomplete=await workerOrder(['a'])
      assert.equal(await orderMessage.sendOrderReady(incomplete.orderId,true,delivery),'SKIPPED');assert.equal(calls,1)
    })
    const target={spreadsheetId:'new-order-sheet-fixture-only',legacySpreadsheetId:'legacy-sheet-fixture-only',sheetId:0,singleIntake:{spreadsheetId:'new-order-sheet-fixture-only',sheetId:7}}
    const sheetFixture=()=>{
      const state={headers:[],initialized:false,row:null,memo:'직원 메모 유지',inserts:0,updates:0,setup:0,failInsert:false,failRead:false,duplicate:false,beforeUpdate:null}
      const api={call:async(method,url,body)=>{
        assert.ok(url.startsWith('/spreadsheets/'+target.spreadsheetId))
        if(state.failRead){state.failRead=false;throw Error('SHEETS_HTTP_503')}
        if(url.endsWith('/developerMetadata:search')){
          const lookup=body.dataFilters[0].developerMetadataLookup
          if(lookup.metadataKey==='pkjmath_order_sheet_v1')return state.initialized?{matchedDeveloperMetadata:[{developerMetadata:{metadataId:1,location:{sheetId:0}}}]}:{}
          assert.equal(lookup.metadataKey,'pkjmath_order_id')
          const row={developerMetadata:{metadataId:45,location:{dimensionRange:{dimension:'ROWS',startIndex:1,endIndex:2}}}}
          return state.row?{matchedDeveloperMetadata:state.duplicate?[row,row]:[row]}:{}
        }
        if(method==='GET'&&url.includes('?fields='))return {sheets:[{properties:{sheetId:0,title:'일괄 주문',gridProperties:{columnCount:50}}}]}
        if(method==='GET')return {values:state.headers.length?url.endsWith('!1:1')?[state.headers]:[state.headers,...(state.row?[state.row]:[])]:[]}
        if(url.endsWith('/values:batchGetByDataFilter'))return {spreadsheetId:target.spreadsheetId,valueRanges:[{valueRange:{values:[[...state.row,state.memo]]}}]}
        if(url.endsWith('/values:batchUpdateByDataFilter')){
          assert.equal(body.valueInputOption,'RAW');assert.equal(body.data[0].values[0].length,orderView.ORDER_HEADERS.length)
          if(state.beforeUpdate){const fn=state.beforeUpdate;state.beforeUpdate=null;await fn()}
          state.row=[...body.data[0].values[0]];state.updates++;return {spreadsheetId:target.spreadsheetId,totalUpdatedRows:1}
        }
        assert.ok(url.endsWith(':batchUpdate'))
        const values=body.requests.find(r=>r.updateCells).updateCells.rows[0].values.map(c=>c.userEnteredValue.stringValue??c.userEnteredValue.numberValue)
        assert.ok(body.requests.find(r=>r.updateCells).updateCells.rows[0].values.every(c=>!c.userEnteredValue.formulaValue))
        if(body.requests.some(r=>r.updateSheetProperties)){state.headers=values;state.initialized=true;state.setup++}
        else{state.row=values;state.inserts++;if(state.failInsert){state.failInsert=false;throw Error('SHEETS_REQUEST_UNCONFIRMED')}}
        return {spreadsheetId:target.spreadsheetId,replies:body.requests.map(()=>({}))}
      }}
      return {state,api}
    }
    await t.test('order Sheets setup refuses existing/legacy targets and provides red/green checks',async()=>{
      const {state,api}=sheetFixture()
      await assert.rejects(orderPublisher.setupOrderSheet(api,{...target,sheetId:7}),/INVALID_ORDER_SHEET_TARGET/)
      await assert.rejects(orderPublisher.setupOrderSheet(api,{...target,spreadsheetId:target.legacySpreadsheetId}))
      state.headers=['기존 직원 데이터'];await assert.rejects(orderPublisher.setupOrderSheet(api,target),/NOT_EMPTY/)
      state.headers=[];await orderPublisher.setupOrderSheet(api,target);await orderPublisher.setupOrderSheet(api,target);assert.equal(state.setup,1)
      assert.equal(state.headers.at(-1),'직원 메모')
      const rules=orderView.orderFormatting(0);assert.equal(rules.length,3)
      assert.ok(rules.every(r=>r.addConditionalFormatRule.rule.ranges[0].startRowIndex===0))
      assert.ok(rules.some(r=>r.addConditionalFormatRule.rule.booleanRule.condition.values[0].userEnteredValue==='통과'))
    })
    await t.test('one order row includes all contacts and exact bill IDs; metadata updates preserve staff notes and newer work',async()=>{
      const {orderId,person,payment}=await completeReady({guardian:true}),{state,api}=sheetFixture()
      await orderPublisher.setupOrderSheet(api,target)
      const sheet={withClient:db.withClient,api,target}
      assert.equal(await orderSheets.syncOrderSheet(orderId,false,sheet),'DISABLED')
      assert.equal(await orderSheets.syncOrderSheet(orderId,true,sheet),'DONE');assert.equal(state.inserts,1)
      const value=label=>state.row[orderView.ORDER_HEADERS.indexOf(label)]
      assert.equal(value('학생 이름'),person.studentName);assert.equal(value('학부모 이름'),person.guardianName)
      assert.equal(value('보호자 로그인 전화번호'),person.guardianPhone);assert.equal(value('결제 전화번호'),person.payerPhone)
      assert.equal(value('현재 청구서 번호'),payment.bill.billId);assert.equal(value('총 청구 금액'),12900);assert.equal(value('중복 수강생 확인'),'통과')
      await db.withClient(c=>orderStore.orderTransaction(c,()=>orderStore.orderChanged(c,orderId,'fixture_update')))
      state.beforeUpdate=()=>db.withClient(c=>orderStore.orderTransaction(c,()=>orderStore.orderChanged(c,orderId,'fixture_newer')))
      assert.equal(await orderSheets.syncOrderSheet(orderId,true,sheet),'DONE')
      assert.ok((await db.query("SELECT id FROM daechion_orders.jobs WHERE order_id=$1 AND kind='SHEETS' AND state='PENDING'",[orderId])).rows.length)
      assert.equal(await orderSheets.syncOrderSheet(orderId,true,sheet),'DONE')
      assert.equal(state.inserts,1);assert.equal(state.updates,2);assert.equal(state.memo,'직원 메모 유지')
    })
    await t.test('a lost sheet insert response blocks duplicates and reconciles only an existing bound row',async()=>{
      const order=await workerOrder(['a']),{state,api}=sheetFixture();await orderPublisher.setupOrderSheet(api,target)
      const sheet={withClient:db.withClient,api,target,authorise:async()=>true};state.failInsert=true
      assert.equal(await orderSheets.syncOrderSheet(order.orderId,true,sheet),'UNKNOWN');assert.equal(state.inserts,1)
      assert.equal(await orderSheets.syncOrderSheet(order.orderId,true,sheet),'SKIPPED')
      assert.equal(await orderSheets.syncOrderSheet(order.orderId,true,{...sheet,authorise:async()=>false},true),'SKIPPED')
      assert.equal(await orderSheets.syncOrderSheet(order.orderId,true,sheet,true),'DONE')
      assert.equal(state.inserts,1);assert.equal(state.updates,1)
      await db.withClient(c=>orderStore.orderTransaction(c,()=>orderStore.orderChanged(c,order.orderId,'fixture_duplicate')))
      state.duplicate=true;assert.equal(await orderSheets.syncOrderSheet(order.orderId,true,sheet),'UNKNOWN');assert.equal(state.updates,1)
    })
    await t.test('a read failure can defer before writes, while changed headers block unsafe publication',async()=>{
      const order=await workerOrder(['a']),{state,api}=sheetFixture();await orderPublisher.setupOrderSheet(api,target)
      const sheet={withClient:db.withClient,api,target};state.failRead=true
      assert.equal(await orderSheets.syncOrderSheet(order.orderId,true,sheet),'DEFERRED');assert.equal(state.inserts,0)
      await db.query("UPDATE daechion_orders.jobs SET available_at=now() WHERE order_id=$1 AND kind='SHEETS'",[order.orderId])
      state.headers[0]='수정된 열';assert.equal(await orderSheets.syncOrderSheet(order.orderId,true,sheet),'UNKNOWN');assert.equal(state.inserts,0)
      assert.equal((await db.query("SELECT last_error FROM daechion_orders.jobs WHERE order_id=$1 AND kind='SHEETS'",[order.orderId])).rows[0].last_error,'sheet_headers_changed')
    })
    await t.test('literal applicant text is never a formula and identity review is highlighted without changing staff columns',async()=>{
      const literal={...products[0],productId:'literal',title:'=SUM(1,2)'}
      const scoped={...ports,catalog:async()=>[literal]},person={...contact(),studentName:'=1+1',guardianName:'보호자'}
      const q=await checkout.quoteCheckout({items:[{productId:'literal'}],contact:person,expectedTotalWon:12900},scoped)
      const order=await checkout.receiveOrder(orderInput(q),scoped),{state,api}=sheetFixture();await orderPublisher.setupOrderSheet(api,target)
      await db.query("UPDATE daechion_orders.orders SET checkout_state='REVIEW',review_code='identity_review' WHERE id=$1",[order.orderId])
      assert.equal(await orderSheets.syncOrderSheet(order.orderId,true,{withClient:db.withClient,api,target}),'DONE')
      assert.equal(state.row[orderView.ORDER_HEADERS.indexOf('학생 이름')],'=1+1')
      assert.equal(state.row[orderView.ORDER_HEADERS.indexOf('상품명')],'=SUM(1,2)')
      assert.equal(state.row[orderView.ORDER_HEADERS.indexOf('중복 수강생 확인')],'확인 필요')
      assert.match(state.row[orderView.ORDER_HEADERS.indexOf('중복 확인 사유')],/번호/)
      const verified=await completeReady()
      await db.withClient(c=>orderStore.orderTransaction(c,()=>orderStore.holdOrder(c,verified.orderId,'identity_review')))
      const changed=await db.withClient(c=>orderView.orderSheetView(c,verified.orderId))
      assert.equal(changed.values[orderView.ORDER_HEADERS.indexOf('중복 수강생 확인')],'확인 필요')
    })
    await t.test('the gated delivery coordinator projects the final message outcome and never enables legacy or disabled sends',async()=>{
      assert.deepEqual(orderDelivery.orderDeliverySettings({}),{message:false,sheets:false})
      assert.throws(()=>orderDelivery.orderDeliverySettings({DAECHION_ORDER_WORKER_ENABLED:'true',DAECHION_ORDER_READY_MESSAGE_ENABLED:'true'}),/REQUIRES_PAYMENT/)
      assert.throws(()=>orderDelivery.orderDeliverySettings({DAECHION_ORDER_WORKER_ENABLED:'true',DAECHION_ORDER_READY_MESSAGE_ENABLED:'true',DAECHION_READY_MESSAGE_ENABLED:'true',DAECHION_ORDER_PAYMENT_READ_ENABLED:'true'}),/LEGACY_MESSAGES/)
      assert.deepEqual(await orderDelivery.deliverOrder('',{message:false,sheets:false},{}),{message:'DISABLED',sheets:'DISABLED'})
      const {orderId,payment}=await completeReady(),{state,api}=sheetFixture();await orderPublisher.setupOrderSheet(api,target)
      const result=await orderDelivery.deliverOrder(orderId,{message:true,sheets:true},{withClient:db.withClient,payment,api,target,message:{send:async()=>({accepted:true,messageId:'coordinator'})}})
      assert.deepEqual(result,{message:'SENT',sheets:'DONE'})
      assert.equal(state.row[orderView.ORDER_HEADERS.indexOf('안내 발송 상태')],'발송 접수 완료')
    })
  }finally{await db.close()}
})

test('read-only ownership lookup never creates students, ignores payer identity, and fails closed for existing or ambiguous profiles',async()=>{
  const person=contact(),cart=cartPolicy.resolveCart({items:[{productId:'a'}]},products,'fixture'),key='b'.repeat(64)
  const calls=[],port={me:async()=>({tenantId:'fixture'}),students:async(p)=>{calls.push(p);return []}}
  assert.equal((await ownership.lookupOwnership(port,'fixture',cart,person,key)).lectures[0].state,'NOT_OWNED')
  assert.deepEqual(calls,[person.studentPhone])
  const existing={...person,studentHistory:'EXISTING'}
  assert.equal((await ownership.lookupOwnership(port,'fixture',cart,existing,key)).identity,'REVIEW')
  const student={id:1,name:person.studentName,active:false,studentPhoneNumber:person.studentPhone}
  const found=await ownership.lookupOwnership({...port,students:async()=>[student]},'fixture',cart,person,key)
  assert.equal(found.identity,'REVIEW');assert.equal(found.lectures[0].state,'UNKNOWN')
  assert.equal((await ownership.lookupOwnership({...port,me:async()=>({tenantId:'wrong'}),students:()=>{throw Error('MUST_NOT_QUERY')}},'fixture',cart,person,key)).identity,'REVIEW')
  const parent=contact();parent.guardianPhone='01000001234'
  const secondParent={id:2,name:'다른 학생',active:true,parentPhoneNumber2:parent.guardianPhone}
  assert.equal((await ownership.lookupOwnership({...port,students:async p=>p===parent.guardianPhone?[secondParent]:[]},'fixture',cart,parent,key)).identity,'REVIEW')
})

test('catalog does not migrate old multi-target sales or process1 into bundles',()=>{
  const base={id:'fixture',name:'개별',visible:true,purchaseProcess:'PROCESS_2',updatedAt:'r1',modes:{online:{enabled:true,price:900},offline:{enabled:false,price:0}},textbook:{included:false,price:0},daechionBinding:{tenantId:'fixture',verifiedAt:'fixture',lectures:[{id:10,name:'강의'}]}}
  assert.equal(catalogPolicy.checkoutCatalog([base],'fixture')[0].priceWon,900)
  assert.deepEqual(catalogPolicy.checkoutCatalog([{...base,daechionBinding:{...base.daechionBinding,lectures:[{id:10,name:'a'},{id:11,name:'b'}]}}],'fixture'),[])
  assert.deepEqual(catalogPolicy.checkoutCatalog([{...base,purchaseProcess:'PROCESS_1'}],'fixture'),[])
  assert.deepEqual(catalogPolicy.checkoutCatalog([{...base,saleKind:'BUNDLE',textbook:{included:true,price:300}}],'fixture'),[])
})
