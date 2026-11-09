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
import orderExecutable from '../workers/daechion/orders.cjs'
import orderAdmin from '../.daechion-test-build/lib/daechion/orders/admin.js'
import orderAdminHttp from '../.daechion-test-build/lib/daechion/orders/admin-http.js'
import manualReview from '../.daechion-test-build/lib/daechion/orders/manual-review.js'
import orderPreflight from '../.daechion-test-build/lib/daechion/orders/preflight.js'
import paidRecovery from '../.daechion-test-build/lib/daechion/orders/paid-recovery.js'
import sheetRecovery from '../.daechion-test-build/lib/daechion/orders/sheet-recovery.js'
import manualAccess from '../.daechion-test-build/lib/daechion/orders/manual-access.js'
import intakeReview from '../.daechion-test-build/lib/daechion/orders/intake-review.js'
import scheduler from '../.daechion-test-build/lib/daechion/orders/scheduler.js'

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
    await db.exec(readFileSync(new URL('../db/daechion-orders/004_admin.sql',import.meta.url),'utf8'))
    await db.exec(readFileSync(new URL('../db/daechion-orders/005_manual_review.sql',import.meta.url),'utf8'))
    await db.exec(readFileSync(new URL('../db/daechion-orders/006_recovery.sql',import.meta.url),'utf8'))
    await db.exec(readFileSync(new URL('../db/daechion-orders/007_manual_access.sql',import.meta.url),'utf8'))
    await db.exec(readFileSync(new URL('../db/daechion-orders/008_identity_recovery.sql',import.meta.url),'utf8'))
    await db.exec(readFileSync(new URL('../db/daechion-orders/009_intake_review.sql',import.meta.url),'utf8'))
    await db.exec(readFileSync(new URL('../db/daechion-orders/010_scheduler.sql',import.meta.url),'utf8'))
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
    await t.test('discounted new-student orders are payable, snapshot prices survive code deletion, and Sheets flags rather than blocks',async()=>{
      let catalog=[{...product('promo-a',[101],10000),discountPrices:[{code:'LIVE2026',priceWon:7000},{code:'OTHER',priceWon:8000}]},product('promo-b',[102],5000)]
      const scoped={...ports,catalog:async()=>catalog,ownership:async(c,_p,k)=>({...report(c,k),existingStudent:'NEW'})}
      const input={items:[{productId:'promo-a'},{productId:'promo-b'}],discountCode:' live2026 ',contact:contact(),expectedTotalWon:12000}
      const publicCatalog=await (await http.orderCatalog({...scoped,settings:{origins:['https://fixture.invalid']},ready:async()=>{}})).json()
      assert.equal(publicCatalog.products.find(i=>i.productId==='promo-a').priceWon,10000)
      assert.ok(!JSON.stringify(publicCatalog).includes('LIVE2026'));assert.ok(!JSON.stringify(publicCatalog).includes('OTHER'))
      const stale=await checkout.quoteCheckout(input,scoped)
      catalog=catalog.map(({discountPrices,...p})=>p)
      await assert.rejects(checkout.receiveOrder(orderInput(stale),scoped),/PRICE_CHANGED/)
      catalog=[{...product('promo-a',[101],10000),discountPrices:[{code:'LIVE2026',priceWon:7000}]},product('promo-b',[102],5000)]
      const q=await checkout.quoteCheckout({...input,contact:contact()},scoped)
      assert.equal(q.status,'READY');assert.equal(q.discountWon,3000);assert.equal(q.regularTotalWon,15000)
      const order=await checkout.receiveOrder(orderInput(q),scoped)
      assert.equal(order.reviewRequired,false)
      const rows=(await db.query('SELECT price_won,snapshot FROM daechion_orders.items WHERE order_id=$1 ORDER BY product_id',[order.orderId])).rows
      assert.deepEqual(rows.map(r=>r.price_won),[7000,5000]);assert.equal(rows[0].snapshot.pricing.code,'LIVE2026')
      catalog=[] // An accepted order never reads the mutable catalog again.
      const view=await db.withClient(c=>orderView.orderSheetView(c,order.orderId)),value=h=>view.values[orderView.ORDER_HEADERS.indexOf(h)]
      assert.equal(value('총 청구 금액'),12000);assert.equal(value('정상가 합계'),15000);assert.equal(value('총 할인액'),3000)
      assert.equal(value('기존 수강생 조회 결과'),'신규');assert.equal(value('할인 사용 확인'),'신규 수강생 할인 사용')
      const snapshot=(await db.query('SELECT snapshot FROM daechion_orders.quotes WHERE id=$1',[q.quoteId])).rows[0].snapshot
      const context={orderId:order.orderId,version:'1',tenantId:'fixture',totalWon:12000,contact:snapshot.contact,items:snapshot.items}
      assert.equal(await orderPreflight.preflightOrder(context,{tenantId:'fixture',subjectSecret:scoped.subjectSecret,api:{me:async()=>({tenantId:'fixture'}),students:async()=>[],lectures:async()=>[101,102].map(id=>({id,opened:true,weeklyLectures:[{id:id+1000}]}))}}),'READY')
      const rawRules=orderView.orderFormatting(0)
      assert.ok(rawRules.some(r=>r.addConditionalFormatRule.rule.booleanRule.condition.values[0].userEnteredValue==='신규 수강생 할인 사용'&&r.addConditionalFormatRule.rule.booleanRule.format.backgroundColor.red>.5))
    })
    await t.test('targeted executable uses read-only preflight and sends one combined invoice without touching other orders',async()=>{
      const q=await quote(),received=await checkout.receiveOrder(orderInput(q),ports)
      const row=(await db.query('SELECT request_fingerprint FROM daechion_orders.orders WHERE id=$1',[received.orderId])).rows[0]
      const sent=[],lookups=[]
      const service=orderExecutable.runtime({DAECHION_ORDER_WORKER_ENABLED:'true',DAECHION_ORDER_SEND_ENABLED:'true',
        DAECHION_IDENTITY_LOOKUP_VERIFIED:'true',DAECHION_ORDER_ACCEPTANCE_ID:received.orderId,DAECHION_ORDER_ACCEPTANCE_FINGERPRINT:row.request_fingerprint,
        DAECHION_TENANT_ID:'fixture',DAECHION_API_KEY:'fixture-only',DAECHION_ORDERS_SUBJECT_SECRET:'s'.repeat(32)},
        {withClient:db.withClient,providers:{api:{me:async()=>({tenantId:'fixture'}),students:async phone=>{lookups.push(phone);return []},
          lectures:async()=>[10,11].map(id=>({id,opened:true,weeklyLectures:[{id:id+100}]}))},
          payment:{accountId:'executable-fixture',send:async job=>{sent.push(job);return 'SENT'}}}})
      assert.deepEqual(await service.once(received.orderId),{processed:true,processingFailed:false,deliveryFailed:false})
      assert.equal(sent.length,1);assert.equal(sent[0].amountWon,31400);assert.equal(sent[0].recipientPhone,'01000009999')
      assert.equal(lookups.length,1);assert.notEqual(lookups[0],sent[0].recipientPhone)
      assert.deepEqual(await service.once(received.orderId),{processed:true,processingFailed:false,deliveryFailed:false})
      assert.equal(sent.length,1)
      assert.equal((await db.query('SELECT count(*)::int AS n FROM daechion_orders.bills WHERE order_id=$1',[received.orderId])).rows[0].n,1)
      assert.equal((await db.query('SELECT student_id FROM daechion_orders.orders WHERE id=$1',[received.orderId])).rows[0].student_id,null)
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
        enroll:async()=>{throw Error('FULL_COURSE_ENROLLMENT_FORBIDDEN')},
        ensureFirstLessonAccess:async input=>{
          await input.beforeWrite()
          if(!input.enrollmentRecorded){enrolled.push(input.lectureId);if(input.lectureId===failEnroll)throw Error('UNKNOWN_ENROLL');await input.recordEnrollment()}
          access.push(input.lectureId);if(failAccess===input.lectureId){failAccess=0;throw Error('UNKNOWN_ACCESS')}
          return {verified:true,lectureId:input.lectureId,studentId:input.studentId,weeklyLectureIds:[input.weeklyLectureId]}
        },
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
    await t.test('multi-lesson courses grant only the pinned first lesson and complete without enrolling or waiting for later lessons',async()=>{
      const {orderId}=await workerOrder(['a']),payment=providerFor(12900),api=enrollmentFor(),calls=[]
      const billing={withClient:db.withClient,provider:payment,preflight:async()=> 'READY'}
      await orderBilling.sendOrderBill(orderId,true,billing);payment.paid();await orderBilling.checkOrderPayment(orderId,true,billing)
      api.lectures=async()=>[{id:10,opened:true,weeklyLectures:[{id:900},{id:100},{id:200}]}]
      api.ensureFirstLessonAccess=async input=>{
        const pinned=(await db.query('SELECT weekly_ids,enrollment_recorded FROM daechion_orders.grants WHERE order_id=$1',[orderId])).rows[0]
        assert.deepEqual(pinned.weekly_ids,[900]);assert.equal(pinned.enrollment_recorded,false)
        calls.push(input.weeklyLectureId);await input.beforeWrite();await input.recordEnrollment()
        return {verified:true,lectureId:input.lectureId,studentId:input.studentId,weeklyLectureIds:[input.weeklyLectureId]}
      }
      const ports={withClient:db.withClient,tenantId:'fixture',daechion:api}
      assert.equal(await orderEnrollment.runOrderGrant(orderId,true,ports),'VERIFIED')
      assert.equal(await orderEnrollment.runOrderGrant(orderId,true,ports),'SKIPPED')
      assert.deepEqual(calls,[900]);assert.deepEqual(api.enrolled,[])
      assert.deepEqual((await db.query('SELECT weekly_ids FROM daechion_orders.grants WHERE order_id=$1',[orderId])).rows[0].weekly_ids,[900])
      assert.equal((await db.query('SELECT notification_state FROM daechion_orders.orders WHERE id=$1',[orderId])).rows[0].notification_state,'PENDING')
    })
    await t.test('changed first lesson and unrecorded registration never grant another lesson or announce completion',async()=>{
      for(const mode of ['changed','unrecorded','missing-selective-provider']){
        const {orderId}=await workerOrder(['a']),payment=providerFor(12900),api=enrollmentFor();let calls=0,first=900
        const billing={withClient:db.withClient,provider:payment,preflight:async()=> 'READY'}
        await orderBilling.sendOrderBill(orderId,true,billing);payment.paid();await orderBilling.checkOrderPayment(orderId,true,billing)
        api.lectures=async()=>[{id:10,opened:true,weeklyLectures:[{id:first},{id:first===900?100:900}]}]
        api.ensureFirstLessonAccess=mode==='missing-selective-provider'?undefined:async input=>{
          calls++;await input.beforeWrite()
          if(mode==='changed'){await input.recordEnrollment();throw Error('Permission response lost')}
          return {verified:true,lectureId:input.lectureId,studentId:input.studentId,weeklyLectureIds:[input.weeklyLectureId]}
        }
        const ports={withClient:db.withClient,tenantId:'fixture',daechion:api}
        assert.equal(await orderEnrollment.runOrderGrant(orderId,true,ports),'REVIEW')
        if(mode==='changed'){
          first=100
          const version=String((await db.query('SELECT version FROM daechion_orders.orders WHERE id=$1',[orderId])).rows[0].version)
          assert.equal(await orderEnrollment.retryRecordedAccess({orderId,lectureId:10,expectedVersion:version},{withClient:db.withClient,authorise:async()=>true}),true)
          assert.equal(await orderEnrollment.runOrderGrant(orderId,true,ports),'REVIEW');assert.equal(calls,1)
          assert.deepEqual((await db.query('SELECT weekly_ids FROM daechion_orders.grants WHERE order_id=$1',[orderId])).rows[0].weekly_ids,[900])
        }
        assert.deepEqual(api.enrolled,[])
        assert.equal((await db.query("SELECT count(*)::int AS n FROM daechion_orders.jobs WHERE order_id=$1 AND kind='READY_MESSAGE'",[orderId])).rows[0].n,0)
      }
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
        if(body.requests.some(r=>r.insertDimension?.range.dimension==='COLUMNS')){
          const range=body.requests.find(r=>r.insertDimension)?.insertDimension.range
          if(state.row)state.row.splice(range.startIndex,0,...Array(range.endIndex-range.startIndex).fill(''))
          state.headers=values;state.setup++
        }
        else if(body.requests.some(r=>r.updateSheetProperties)){state.headers=values;state.initialized=true;state.setup++}
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
      const rules=orderView.orderFormatting(0);assert.equal(rules.length,5)
      assert.ok(rules.every(r=>r.addConditionalFormatRule.rule.ranges[0].startRowIndex===0))
      assert.ok(rules.some(r=>r.addConditionalFormatRule.rule.booleanRule.condition.values[0].userEnteredValue==='통과'))
    })
    await t.test('discount columns migrate once before staff notes without changing historical order cells',async()=>{
      const {state,api}=sheetFixture()
      state.initialized=true;state.headers=[...orderView.LEGACY_ORDER_HEADERS,'직원 메모'];state.row=orderView.LEGACY_ORDER_HEADERS.map((_,i)=>`old-${i}`)
      const original=[...state.row],memo=state.memo
      await orderPublisher.setupOrderSheet(api,target)
      assert.deepEqual(state.headers,[...orderView.ORDER_HEADERS,'직원 메모']);assert.deepEqual(state.row.slice(0,original.length),original)
      assert.equal(state.memo,memo);assert.equal(state.row.length,orderView.ORDER_HEADERS.length)
      await orderPublisher.setupOrderSheet(api,target);assert.equal(state.setup,1)
      const malformed=sheetFixture();malformed.state.initialized=true;malformed.state.headers=[...orderView.LEGACY_ORDER_HEADERS,'다른 메모']
      await assert.rejects(orderPublisher.setupOrderSheet(malformed.api,target),/NOT_EMPTY/)
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
    await t.test('single, multiple and mixed bundle purchases each project one row with one exact total and snapshot-linked grants',async()=>{
      for(const ids of [['a'],['a','b'],['a','pack']]){
        const q=await quote(ids),{orderId}=await checkout.receiveOrder(orderInput(q),ports),{state,api}=sheetFixture()
        await orderPublisher.setupOrderSheet(api,target)
        await orderSheets.syncOrderSheet(orderId,true,{withClient:db.withClient,api,target})
        const value=label=>state.row[orderView.ORDER_HEADERS.indexOf(label)]
        assert.equal(state.inserts,1)
        assert.equal(value('총 청구 금액'),ids.reduce((sum,id)=>sum+products.find(p=>p.productId===id).priceWon,0))
        assert.deepEqual(value('상품명').split('\n'),[...ids].sort())
        const expected=products.filter(p=>ids.includes(p.productId)).flatMap(p=>p.lectures.map(l=>`${p.title} / ${l.name} · ID ${l.id}: 대기`))
        assert.deepEqual(value('강의별 등록·권한 상태').split('\n'),expected)
        assert.equal(value('상품별 판매가').split('\n').length,ids.length)
        const again=await db.withClient(c=>orderView.orderSheetView(c,orderId))
        assert.equal(again.values[orderView.ORDER_HEADERS.indexOf('강의별 등록·권한 상태')],expected.join('\n'))
      }
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
    await t.test('order admin reads are authenticated, tenant-scoped and no-store; unsafe requests never reach the database',async()=>{
      const q=await quote(['a'],{contact:{...contact(),studentName:"가상 %'_검색"}}),order=await checkout.receiveOrder(orderInput(q),ports)
      let calls=0
      const admin={tenantId:'fixture',enabled:true,origins:['https://fixture.invalid'],authed:async()=>true,ready:async()=>{},withClient:async run=>{calls++;return db.withClient(run)}}
      const get=new Request('https://fixture.invalid/api/admin/daechion/orders?id='+order.orderId)
      assert.equal((await orderAdminHttp.orderAdminGet(get,{...admin,authed:async()=>false})).status,401)
      assert.equal((await orderAdminHttp.orderAdminPost(request({kind:'SEARCH'}),{...admin,authed:async()=>false})).status,401)
      assert.equal((await orderAdminHttp.orderAdminGet(get,{...admin,enabled:false})).status,503);assert.equal(calls,0)
      assert.equal((await orderAdminHttp.orderAdminPost(request({}, {origin:'https://wrong.invalid'}),admin)).status,403)
      assert.equal((await orderAdminHttp.orderAdminPost(request({}, {'content-type':'text/plain'}),admin)).status,415)
      assert.equal(calls,0)
      assert.equal((await orderAdminHttp.orderAdminPost(request('x'.repeat(9000)),admin)).status,413)
      const response=await orderAdminHttp.orderAdminGet(get,admin),detail=await response.json()
      assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(detail.order.id,order.orderId)
      const search=await orderAdminHttp.orderAdminPost(request({kind:'SEARCH',q:"%'_",reviewOnly:false,page:0}),admin)
      assert.equal(search.status,200);assert.deepEqual((await search.json()).rows.map(r=>r.id),[order.orderId])
      assert.equal((await orderAdminHttp.orderAdminGet(get,{...admin,tenantId:'other'})).status,404)
      const hidden=await orderAdminHttp.orderAdminPost(request({kind:'SEARCH'}),{...admin,tenantId:'other'})
      assert.deepEqual((await hidden.json()).rows,[])
      assert.equal((await orderAdminHttp.orderAdminGet(new Request(get.url+'&id='+order.orderId),admin)).status,400)
      const failed=await orderAdminHttp.orderAdminGet(get,{...admin,ready:async()=>{throw Error('private SQL credentials')}})
      assert.equal(failed.status,503);assert.equal((await failed.text()).includes('private'),false)
    })
    const adminAction=async(orderId,action='HOLD',extra={})=>({requestKey:randomUUID(),orderId,
      expectedVersion:String((await db.query('SELECT version FROM daechion_orders.orders WHERE id=$1',[orderId])).rows[0].version),
      action,operatorName:'검수 담당자',reason:'대치온 상태 직접 확인',confirmed:true,...extra})
    await t.test('manual holds and audit history are atomic, versioned and replay-safe across concurrent requests',async()=>{
      const {orderId}=await workerOrder(['a']),input=await adminAction(orderId)
      const results=await Promise.all([0,1].map(()=>db.withClient(c=>orderAdmin.applyOrderAdminAction(c,'fixture',input))))
      assert.deepEqual(results.map(r=>r.replayed).sort(),[false,true])
      assert.equal((await db.query('SELECT count(*)::int AS n FROM daechion_orders.admin_actions WHERE order_id=$1',[orderId])).rows[0].n,1)
      const row=(await db.query('SELECT checkout_state,review_code,version FROM daechion_orders.orders WHERE id=$1',[orderId])).rows[0]
      assert.equal(row.checkout_state,'REVIEW');assert.equal(row.review_code,'admin_hold');assert.equal(BigInt(row.version),BigInt(input.expectedVersion)+1n)
      await assert.rejects(db.withClient(c=>orderAdmin.applyOrderAdminAction(c,'fixture',{...input,reason:'다른 내용'})),/CONFLICT/)
      await assert.rejects(db.withClient(c=>orderAdmin.applyOrderAdminAction(c,'fixture',{...input,requestKey:randomUUID()})),/STALE/)
      await assert.rejects(db.withClient(c=>orderAdmin.applyOrderAdminAction(c,'other',input)),/CONFLICT/)
      await assert.rejects(db.query('DELETE FROM daechion_orders.admin_actions WHERE order_id=$1',[orderId]),/ORDER_ADMIN_HISTORY_IMMUTABLE/)
      await assert.rejects(db.query("UPDATE daechion_orders.admin_actions SET reason='changed' WHERE order_id=$1",[orderId]),/ORDER_ADMIN_HISTORY_IMMUTABLE/)
      const view=await db.withClient(c=>orderView.orderSheetView(c,orderId))
      assert.equal(view.values[orderView.ORDER_HEADERS.indexOf('처리 확인')],'확인 필요')
      assert.match(view.values[orderView.ORDER_HEADERS.indexOf('확인 필요 사유')],/관리자/)
      const rollback=await workerOrder(['b']),pending=await adminAction(rollback.orderId)
      await assert.rejects(db.withClient(c=>orderAdmin.applyOrderAdminAction({query:async(sql,args)=>{
        if(sql.startsWith('INSERT INTO daechion_orders.admin_actions'))throw Error('TEST_AUDIT_UNAVAILABLE')
        return c.query(sql,args)
      }},'fixture',pending)),/TEST_AUDIT_UNAVAILABLE/)
      const unchanged=(await db.query('SELECT checkout_state,version FROM daechion_orders.orders WHERE id=$1',[rollback.orderId])).rows[0]
      assert.equal(unchanged.checkout_state,'READY');assert.equal(String(unchanged.version),pending.expectedVersion)
    })
    await t.test('admin retry queues only recorded content access and rejects stale payment, cancellation, unknown enrollment and blind resume',async()=>{
      const {orderId}=await workerOrder(['pack']),provider=providerFor(25000),api=enrollmentFor(),enrollment={withClient:db.withClient,tenantId:'fixture',daechion:api}
      const billing={withClient:db.withClient,provider,preflight:async()=> 'READY'}
      await orderBilling.sendOrderBill(orderId,true,billing);provider.paid();await orderBilling.checkOrderPayment(orderId,true,billing)
      assert.equal(await orderEnrollment.runOrderGrant(orderId,true,enrollment),'REVIEW')
      const detail=await db.withClient(c=>orderAdmin.orderDetail(c,'fixture',orderId))
      assert.equal(detail.grants.find(g=>g.lecture_id==='20').can_retry,true)
      const input=await adminAction(orderId,'RETRY_ACCESS',{lectureId:20}),before=api.enrolled.length
      const admin={tenantId:'fixture',enabled:true,origins:['https://fixture.invalid'],authed:async()=>true,ready:async()=>{},withClient:db.withClient}
      for(const change of [{confirmed:false},{action:'RESUME'},{action:'CONFIRM_PAYMENT'},{lectureId:999}]){
        const response=await orderAdminHttp.orderAdminPost(request({...input,...change}),admin)
        assert.equal(response.status,change.lectureId?409:400)
      }
      assert.equal((await orderAdminHttp.orderAdminPost(request(input),admin)).status,200)
      assert.equal((await orderAdminHttp.orderAdminPost(request(input),admin)).status,200)
      assert.equal(api.enrolled.length,before)
      assert.equal((await db.query('SELECT state FROM daechion_orders.grants WHERE order_id=$1 AND lecture_id=20',[orderId])).rows[0].state,'PENDING')
      assert.equal(await orderEnrollment.runOrderGrant(orderId,true,enrollment),'VERIFIED');assert.equal(api.enrolled.length,before)
      const rejected=await adminAction(orderId,'RETRY_ACCESS',{lectureId:20})
      await assert.rejects(db.withClient(c=>orderAdmin.applyOrderAdminAction(c,'fixture',rejected)),/STATE/)
      for(const mode of ['old-payment','cancelled','unknown-enrollment']){
        const next=await workerOrder(['pack']),p=providerFor(25000),a=enrollmentFor(),bill={withClient:db.withClient,provider:p,preflight:async()=> 'READY'}
        if(mode==='unknown-enrollment')a.failEnroll=20
        await orderBilling.sendOrderBill(next.orderId,true,bill);p.paid();await orderBilling.checkOrderPayment(next.orderId,true,bill)
        await orderEnrollment.runOrderGrant(next.orderId,true,{withClient:db.withClient,tenantId:'fixture',daechion:a})
        if(mode==='old-payment')await db.query("UPDATE daechion_orders.bills SET checked_at=now()-interval '4 minutes' WHERE order_id=$1",[next.orderId])
        if(mode==='cancelled'){p.observation={state:'C',billId:p.bill.billId,amountWon:25000,paidAt:null};await orderBilling.checkOrderPayment(next.orderId,true,bill)}
        const action=await adminAction(next.orderId,'RETRY_ACCESS',{lectureId:20})
        await assert.rejects(db.withClient(c=>orderAdmin.applyOrderAdminAction(c,'fixture',action)),/STATE/)
        assert.equal((await db.query('SELECT count(*)::int AS n FROM daechion_orders.admin_actions WHERE order_id=$1',[next.orderId])).rows[0].n,0)
      }
    })
    await t.test('existing-student review authorises one exact student and full unowned cart before billing; payment then reuses the same inactive account',async()=>{
      const person={...contact(),guardianName:'가상 보호자',guardianPhone:'01000007890',studentHistory:'NEW'}
      const q=await checkout.quoteCheckout({items:[{productId:'pack'}],contact:person,expectedTotalWon:25000},{...ports,
        ownership:async(cart,_person,key)=>({...report(cart,key),identity:'REVIEW'})})
      const {orderId}=await checkout.receiveOrder(orderInput(q),ports)
      await assert.rejects(db.query("UPDATE daechion_orders.orders SET checkout_state='READY' WHERE id=$1",[orderId]),/ORDER_QUOTE_NOT_READY/)
      await assert.rejects(db.query("UPDATE daechion_orders.quotes SET state='CONSUMED' WHERE id=$1",[q.quoteId]),/ORDER_QUOTE_TRANSITION_INVALID/)
      let creates=0,inspections=0;const enrolments=[]
      const profile={id:9090,name:person.studentName,active:false,studentPhoneNumber:person.studentPhone,parentPhoneNumber:'01000001212',parentPhoneNumber2:person.guardianPhone}
      const api={me:async()=>({tenantId:'fixture'}),student:async id=>{assert.equal(id,9090);return {...profile}},
        students:async phone=>[profile].filter(s=>[s.studentPhoneNumber,s.parentPhoneNumber,s.parentPhoneNumber2].includes(phone)),
        lectures:async()=>[20,21].map(id=>({id,opened:true,weeklyLectures:[{id:id*100}]})),
        createStudent:async()=>{creates++;throw Error('Must not create another account')},
        enroll:async()=>{throw Error('FULL_COURSE_ENROLLMENT_FORBIDDEN')},
        ensureFirstLessonAccess:async input=>{await input.beforeWrite();if(!input.enrollmentRecorded){enrolments.push({lectureId:input.lectureId,studentId:input.studentId});await input.recordEnrollment()}
          return {verified:true,lectureId:input.lectureId,studentId:input.studentId,weeklyLectureIds:[input.weeklyLectureId]}},
        ensureContentAccess:async input=>{await input.beforeWrite();return {verified:true,lectureId:input.lectureId,studentId:input.studentId,weeklyLectureIds:input.weeklyLectureIds}}}
      const admin={tenantId:'fixture',enabled:true,origins:['https://fixture.invalid'],authed:async()=>true,ready:async()=>{},withClient:db.withClient,
        inspectExisting:async(ctx,id)=>{inspections++;return manualReview.inspectExisting(ctx,id,api)}}
      const input=await adminAction(orderId,'APPROVE_EXISTING',{studentId:9090,targetIds:[20,21],confirmNotOwned:true})
      assert.equal((await orderAdminHttp.orderAdminPost(request({...input,confirmNotOwned:false}),admin)).status,400)
      assert.equal((await orderAdminHttp.orderAdminPost(request({...input,evidence:{studentId:9090}}),admin)).status,400)
      assert.equal((await orderAdminHttp.orderAdminPost(request({...input,targetIds:[20]}),admin)).status,409)
      const context=await db.withClient(c=>manualReview.contextFromOrder(c,'fixture',orderId))
      const proof=await manualReview.inspectExisting(context,9090,api)
      await assert.rejects(db.withClient(c=>orderAdmin.applyOrderAdminAction(c,'fixture',input,{...proof,binding:'f'.repeat(64)})),/STATE/)
      assert.equal((await orderAdminHttp.orderAdminPost(request(input),admin)).status,200)
      const count=inspections
      assert.equal((await orderAdminHttp.orderAdminPost(request(input),admin)).status,200);assert.equal(inspections,count)
      const saved=(await db.query('SELECT checkout_state,student_id,contact_snapshot,total_won,confirmed_at FROM daechion_orders.orders WHERE id=$1',[orderId])).rows[0]
      assert.equal(saved.checkout_state,'READY');assert.equal(saved.student_id,null);assert.equal(saved.total_won,25000);assert.equal(saved.contact_snapshot.studentHistory,'NEW');assert.ok(saved.confirmed_at)
      assert.equal((await db.query('SELECT state FROM daechion_orders.quotes WHERE id=$1',[q.quoteId])).rows[0].state,'CONSUMED')
      const sheet=await db.withClient(c=>orderView.orderSheetView(c,orderId))
      assert.equal(sheet.values[orderView.ORDER_HEADERS.indexOf('중복 수강생 확인')],'통과')
      assert.match(sheet.values[orderView.ORDER_HEADERS.indexOf('중복 확인 사유')],/관리자 확인: 학생 ID 9090/)
      const manual=await db.withClient(c=>manualReview.latestReview(c,orderId)),preflight={tenantId:'fixture',subjectSecret:'s'.repeat(32),api,manualReview:async()=>manual}
      assert.equal(await orderPreflight.preflightOrder(context,preflight),'READY')
      assert.equal(await orderPreflight.preflightOrder(context,{...preflight,manualReview:async()=>({...manual,checkedAt:new Date(Date.now()-16*60000).toISOString()})}),'REVIEW')
      assert.equal(await orderPreflight.preflightOrder(context,{...preflight,api:{...api,student:async()=>({...profile,parentPhoneNumber2:'01000009998'})}}),'REVIEW')
      const payment=providerFor(25000),billing={withClient:db.withClient,provider:payment,preflight:ctx=>orderPreflight.preflightOrder(ctx,preflight)}
      assert.equal(await orderBilling.sendOrderBill(orderId,true,billing),'SENT');assert.equal(payment.sends,1)
      assert.equal((await db.withClient(c=>orderAdmin.orderDetail(c,'fixture',orderId))).canConfirmNewIntake,false)
      const awaiting=await db.withClient(c=>orderView.orderSheetView(c,orderId))
      assert.match(awaiting.values[orderView.ORDER_HEADERS.indexOf('중복 확인 사유')],/청구 시 확인한 학생으로 결제 후 재검사/)
      payment.paid();assert.equal(await orderBilling.checkOrderPayment(orderId,true,billing),'PAID')
      const enrollment={withClient:db.withClient,tenantId:'fixture',daechion:api}
      assert.equal(await orderEnrollment.runOrderGrant(orderId,true,enrollment),'VERIFIED')
      assert.equal(await orderEnrollment.runOrderGrant(orderId,true,enrollment),'VERIFIED')
      assert.equal(creates,0);assert.deepEqual(enrolments,[{lectureId:20,studentId:9090},{lectureId:21,studentId:9090}])
      assert.equal(Number((await db.query('SELECT student_id FROM daechion_orders.orders WHERE id=$1',[orderId])).rows[0].student_id),9090)
      const before=inspections;assert.equal((await orderAdminHttp.orderAdminPost(request(input),{...admin,inspectExisting:async()=>{throw Error('Should replay without API')}})).status,200);assert.equal(inspections,before)
    })
    await t.test('only an unbilled administrative hold can resume; incomplete audit commits and identity mismatches stay blocked',async()=>{
      const {orderId}=await workerOrder(['a'])
      const hold=await adminAction(orderId)
      await db.withClient(c=>orderAdmin.applyOrderAdminAction(c,'fixture',hold))
      assert.equal((await db.withClient(c=>orderAdmin.orderDetail(c,'fixture',orderId))).canResumeUnbilled,true)
      const resume=await adminAction(orderId,'RESUME_UNBILLED')
      await db.withClient(c=>orderAdmin.applyOrderAdminAction(c,'fixture',resume))
      assert.equal((await db.withClient(c=>orderAdmin.applyOrderAdminAction(c,'fixture',resume))).replayed,true)
      assert.equal((await db.query('SELECT checkout_state FROM daechion_orders.orders WHERE id=$1',[orderId])).rows[0].checkout_state,'READY')
      assert.equal((await db.query('SELECT count(*)::int AS n FROM daechion_orders.bills WHERE order_id=$1',[orderId])).rows[0].n,0)
      const version=String((await db.query('SELECT version FROM daechion_orders.orders WHERE id=$1',[orderId])).rows[0].version)
      await assert.rejects(db.query(`INSERT INTO daechion_orders.admin_actions(request_key,order_id,fingerprint,action,operator_name,reason,before_version,after_version)
        VALUES($1,$2,$3,'HOLD','검수','버전 증가 불일치',$4,$4)`,[randomUUID(),orderId,'a'.repeat(64),version]),/check constraint/)
      await assert.rejects(db.query(`INSERT INTO daechion_orders.admin_actions(request_key,order_id,fingerprint,action,operator_name,reason,before_version,after_version)
        VALUES($1,$2,$3,'HOLD','검수','미완료 감사 기록',$4,$5)`,[randomUUID(),orderId,'a'.repeat(64),version,(BigInt(version)+1n).toString()]),/ORDER_ADMIN_COMMIT_INCOMPLETE/)
      const next=await workerOrder(['b']),p=providerFor(18500)
      await orderBilling.sendOrderBill(next.orderId,true,{withClient:db.withClient,provider:{...p,send:async job=>{await p.send(job);return 'UNKNOWN'}},preflight:async()=> 'READY'})
      const denied=await adminAction(next.orderId,'RESUME_UNBILLED')
      await assert.rejects(db.withClient(c=>orderAdmin.applyOrderAdminAction(c,'fixture',denied)),/STATE/)
      const ctx=await db.withClient(c=>manualReview.contextFromOrder(c,'fixture',orderId))
      const wrong={id:55,name:'다른 학생',active:true,studentPhoneNumber:'01000005555'}
      await assert.rejects(manualReview.inspectExisting(ctx,55,{me:async()=>({tenantId:'fixture'}),student:async()=>wrong,students:async()=>[wrong]}))
      await assert.rejects(manualReview.inspectExisting(ctx,55,{me:async()=>({tenantId:'other'}),student:async()=>wrong,students:async()=>[wrong]}),/TENANT/)
    })
    await t.test('paid recovery uses a fresh exact provider read and atomically resumes only never-attempted notices',async()=>{
      const {orderId,payment}=await completeReady()
      const hold=await adminAction(orderId);await db.withClient(c=>orderAdmin.applyOrderAdminAction(c,'fixture',hold))
      const input=await adminAction(orderId,'RESUME_PAID',{billId:payment.bill.billId,confirmPaid:true})
      const context=await db.withClient(c=>paidRecovery.paidContext(c,'fixture',orderId,input.expectedVersion,input.billId))
      const stale=await paidRecovery.inspectPaid(context,payment);assert.ok(stale)
      await orderBilling.checkOrderPayment(orderId,true,{withClient:db.withClient,provider:payment})
      assert.equal(String((await db.query('SELECT version FROM daechion_orders.orders WHERE id=$1',[orderId])).rows[0].version),input.expectedVersion)
      await assert.rejects(db.withClient(c=>orderAdmin.applyOrderAdminAction(c,'fixture',input,undefined,stale)),/STATE/)
      let reads=0
      const admin={tenantId:'fixture',enabled:true,origins:['https://fixture.invalid'],authed:async()=>true,ready:async()=>{},withClient:db.withClient,
        inspectPaid:async value=>{reads++;return paidRecovery.inspectPaid(value,payment)}}
      assert.equal((await orderAdminHttp.orderAdminPost(request({...input,confirmPaid:false}),admin)).status,400)
      assert.equal((await orderAdminHttp.orderAdminPost(request({...input,billId:'90000000000000000099'}),admin)).status,409)
      assert.equal((await orderAdminHttp.orderAdminPost(request({...input,amountWon:1}),admin)).status,400)
      const result=await orderAdminHttp.orderAdminPost(request(input),admin);assert.equal(result.status,200)
      const row=(await db.query('SELECT checkout_state,payment_state,notification_state FROM daechion_orders.orders WHERE id=$1',[orderId])).rows[0]
      assert.deepEqual(row,{checkout_state:'READY',payment_state:'PAID',notification_state:'PENDING'})
      const job=(await db.query("SELECT state,attempts FROM daechion_orders.jobs WHERE order_id=$1 AND kind='READY_MESSAGE'",[orderId])).rows[0]
      assert.deepEqual(job,{state:'PENDING',attempts:0});assert.equal(payment.sends,1)
      const count=reads;assert.equal((await orderAdminHttp.orderAdminPost(request(input),{...admin,inspectPaid:async()=>{throw Error('Replay must not query payment')}})).status,200);assert.equal(reads,count)
      const audit=(await db.query("SELECT recovery_evidence FROM daechion_orders.admin_actions WHERE request_key=$1",[input.requestKey])).rows[0].recovery_evidence
      assert.equal(audit.billId,payment.bill.billId);assert.equal(audit.amountWon,12900)
      assert.equal((await db.query("SELECT count(*)::int AS n FROM daechion_orders.grants WHERE order_id=$1 AND state<>'VERIFIED'",[orderId])).rows[0].n,0)
    })
    await t.test('paid recovery rejects ambiguity, cancellations, late or changed evidence and keeps unknown notifications blocked',async()=>{
      const {orderId,payment}=await completeReady()
      let messages=0
      assert.equal(await orderMessage.sendOrderReady(orderId,true,{withClient:db.withClient,payment,message:{send:async()=>{messages++;return {outcome:'UNKNOWN'}}}}),'UNKNOWN')
      const hold=await adminAction(orderId);await db.withClient(c=>orderAdmin.applyOrderAdminAction(c,'fixture',hold))
      const input=await adminAction(orderId,'RESUME_PAID',{billId:payment.bill.billId,confirmPaid:true})
      const context=await db.withClient(c=>paidRecovery.paidContext(c,'fixture',orderId,input.expectedVersion,input.billId)),proof=await paidRecovery.inspectPaid(context,payment)
      assert.ok(proof)
      for(const changed of [{...proof,checkedAt:new Date(Date.now()-61000).toISOString()},{...proof,recordId:randomUUID()},{...proof,amountWon:1},{...proof,orderId:randomUUID()}])
        await assert.rejects(db.withClient(c=>orderAdmin.applyOrderAdminAction(c,'fixture',input,undefined,changed)),/STATE/)
      const paid=await payment.read()
      for(const observation of [{state:'UNKNOWN'},{...paid,state:'W'},{...paid,state:'C'}, {...paid,amountWon:1}, {...paid,paidAt:new Date(Date.now()+120000).toISOString()}])
        assert.equal(await paidRecovery.inspectPaid(context,{accountId:payment.accountId,read:async()=>observation}),null)
      assert.equal(await paidRecovery.inspectPaid({...context,bill:{...context.bill,state:'SEND_UNKNOWN'}},payment),null)
      assert.equal(await paidRecovery.inspectPaid({...context,paymentState:'CANCELLED'},payment),null)
      assert.equal(await paidRecovery.inspectPaid({...context,bill:{...context.bill,due_at:new Date(Date.now()-1000).toISOString()}},payment),null)
      assert.equal(await paidRecovery.inspectPaid(context,{accountId:'other-account',read:payment.read}),null)
      await db.withClient(c=>orderAdmin.applyOrderAdminAction(c,'fixture',input,undefined,proof))
      assert.equal((await db.query('SELECT notification_state FROM daechion_orders.orders WHERE id=$1',[orderId])).rows[0].notification_state,'UNKNOWN')
      assert.equal(await orderMessage.sendOrderReady(orderId,true,{withClient:db.withClient,payment,message:{send:async()=>{messages++;return {outcome:'UNKNOWN'}}}}),'SKIPPED');assert.equal(messages,1)
      const next=await workerOrder(['a']),p=providerFor(12900),bill={withClient:db.withClient,provider:p,preflight:async()=> 'READY'}
      await orderBilling.sendOrderBill(next.orderId,true,bill);p.paid();await orderBilling.checkOrderPayment(next.orderId,true,bill)
      await db.query("UPDATE daechion_orders.orders SET identity_state='REVIEW',identity_write_started=true WHERE id=$1",[next.orderId])
      await db.withClient(c=>orderStore.orderTransaction(c,async()=>{await orderStore.lockOrder(c,next.orderId);await orderStore.holdOrder(c,next.orderId,'identity_create_unknown')}))
      const denied=await adminAction(next.orderId,'RESUME_PAID',{billId:p.bill.billId,confirmPaid:true}),ctx=await db.withClient(c=>paidRecovery.paidContext(c,'fixture',next.orderId,denied.expectedVersion,denied.billId))
      await assert.rejects(db.withClient(async c=>orderAdmin.applyOrderAdminAction(c,'fixture',denied,undefined,await paidRecovery.inspectPaid(ctx,p))),/STATE/)
    })
    await t.test('a durable sheet recovery approval updates the bound existing row once and never inserts a duplicate',async()=>{
      const {orderId}=await workerOrder(['a']),{state,api}=sheetFixture(),sheet={withClient:db.withClient,api,target}
      await orderPublisher.setupOrderSheet(api,target);state.failInsert=true
      assert.equal(await orderSheets.syncOrderSheet(orderId,true,sheet),'UNKNOWN')
      const job=(await db.query("SELECT id FROM daechion_orders.jobs WHERE order_id=$1 AND state='UNKNOWN'",[orderId])).rows[0]
      const unrelated=await adminAction(orderId)
      await db.withClient(c=>orderAdmin.applyOrderAdminAction(c,'fixture',unrelated))
      await assert.rejects(db.query('INSERT INTO daechion_orders.sheet_recoveries(request_key,order_id,job_id) VALUES($1,$2,$3)',[unrelated.requestKey,orderId,job.id]),/APPROVAL_MISMATCH/)
      const input=await adminAction(orderId,'RECONCILE_SHEETS',{jobId:String(job.id),confirmExistingRow:true})
      const admin={tenantId:'fixture',enabled:true,origins:['https://fixture.invalid'],authed:async()=>true,ready:async()=>{},withClient:db.withClient}
      assert.equal((await orderAdminHttp.orderAdminPost(request({...input,confirmExistingRow:false}),admin)).status,400)
      assert.equal((await orderAdminHttp.orderAdminPost(request({...input,jobId:randomUUID()}),admin)).status,409)
      const replies=await Promise.all([0,1].map(()=>orderAdminHttp.orderAdminPost(request(input),admin)))
      assert.ok(replies.every(r=>r.status===200));assert.equal(state.inserts,1);assert.equal(state.updates,0)
      assert.equal((await db.query('SELECT count(*)::int AS n FROM daechion_orders.sheet_recoveries WHERE order_id=$1',[orderId])).rows[0].n,1)
      assert.equal(await orderSheets.syncOrderSheet(orderId,true,{...sheet,authorise:async()=>true,recovery:{requestKey:input.requestKey,jobId:input.jobId,leaseToken:randomUUID()}},true),'SKIPPED')
      assert.equal(await sheetRecovery.deliverOrderSheet(orderId,false,sheet),'DISABLED')
      assert.equal(await sheetRecovery.deliverOrderSheet(orderId,true,sheet),'DONE')
      assert.equal(state.inserts,1);assert.equal(state.updates,1);assert.equal(state.memo,'직원 메모 유지')
      assert.equal((await db.query('SELECT state FROM daechion_orders.sheet_recoveries WHERE request_key=$1',[input.requestKey])).rows[0].state,'DONE')
      assert.equal((await orderAdminHttp.orderAdminPost(request(input),admin)).status,200)
      assert.equal(await sheetRecovery.deliverOrderSheet(orderId,true,sheet),'SKIPPED');assert.equal(state.updates,1)
      await assert.rejects(db.query("UPDATE daechion_orders.sheet_recoveries SET state='PENDING' WHERE request_key=$1",[input.requestKey]),/CANNOT_REPLAY/)
      await assert.rejects(db.query('DELETE FROM daechion_orders.sheet_recoveries WHERE request_key=$1',[input.requestKey]),/CANNOT_DELETE/)
    })
    await t.test('missing rows or interrupted sheet recovery remain unknown until a new explicit approval',async()=>{
      const {orderId}=await workerOrder(['b']),{state,api}=sheetFixture(),sheet={withClient:db.withClient,api,target}
      await orderPublisher.setupOrderSheet(api,target);state.failInsert=true
      await orderSheets.syncOrderSheet(orderId,true,sheet)
      const original=[...state.row],job=(await db.query("SELECT id FROM daechion_orders.jobs WHERE order_id=$1 AND state='UNKNOWN'",[orderId])).rows[0]
      const input=await adminAction(orderId,'RECONCILE_SHEETS',{jobId:String(job.id),confirmExistingRow:true})
      await db.withClient(c=>orderAdmin.applyOrderAdminAction(c,'fixture',input));state.row=null
      assert.equal(await sheetRecovery.deliverOrderSheet(orderId,true,sheet),'UNKNOWN');assert.equal(state.inserts,1);assert.equal(state.updates,0)
      assert.equal(await sheetRecovery.deliverOrderSheet(orderId,true,sheet),'SKIPPED');assert.equal(state.inserts,1)
      state.row=original
      const next=await adminAction(orderId,'RECONCILE_SHEETS',{jobId:String(job.id),confirmExistingRow:true})
      await db.withClient(c=>orderAdmin.applyOrderAdminAction(c,'fixture',next))
      await db.query("UPDATE daechion_orders.sheet_recoveries SET state='RUNNING',lease_token=$2,lease_until=now()-interval '1 second' WHERE request_key=$1",[next.requestKey,randomUUID()])
      assert.equal(await sheetRecovery.deliverOrderSheet(orderId,true,sheet),'SKIPPED')
      assert.equal((await db.query('SELECT state FROM daechion_orders.sheet_recoveries WHERE request_key=$1',[next.requestKey])).rows[0].state,'UNKNOWN')
      assert.equal(state.updates,0)
      const final=await adminAction(orderId,'RECONCILE_SHEETS',{jobId:String(job.id),confirmExistingRow:true})
      await db.withClient(c=>orderAdmin.applyOrderAdminAction(c,'fixture',final))
      assert.equal(await sheetRecovery.deliverOrderSheet(orderId,true,sheet),'DONE');assert.equal(state.inserts,1);assert.equal(state.updates,1)
    })
    const schedulerEnv={DAECHION_ORDER_WORKER_ENABLED:'true',DAECHION_ORDER_LOOP_ENABLED:'true',DAECHION_TENANT_ID:'fixture',DAECHION_API_KEY:'fixture-only',
      DAECHION_ORDER_SEND_ENABLED:'true',DAECHION_ORDER_PAYMENT_READ_ENABLED:'true',DAECHION_ORDER_ENROLLMENT_ENABLED:'true',DAECHION_ORDER_READY_MESSAGE_ENABLED:'true',
      DAECHION_ORDER_SESSION_MAINTENANCE_ENABLED:'true',DAECHION_BROWSER_CHECK_LECTURE_ID:'10',DAECHION_ORDERS_SUBJECT_SECRET:'s'.repeat(32),
      DAECHION_IDENTITY_LOOKUP_VERIFIED:'true',DAECHION_ACCESS_POLICY_VERIFIED:'true'}
    const schedulerClient=process.env.DAECHION_TEST_POSTGRES_URL?db.withClient:async run=>run(db)
    const quietScheduler=()=>db.query(`INSERT INTO daechion_orders.scheduler_orders(order_id,last_version,next_run_at)
      SELECT id,version,now()+interval '1 day' FROM daechion_orders.orders
      ON CONFLICT(order_id) DO UPDATE SET last_version=EXCLUDED.last_version,next_run_at=EXCLUDED.next_run_at`)
    const makeDue=id=>db.query("UPDATE daechion_orders.scheduler_orders SET next_run_at=now()-interval '1 second' WHERE order_id=$1",[id])
    await t.test('periodic worker resumes across restarts with one invoice, one student and every purchased lecture before one notice',async()=>{
      await quietScheduler();await db.query('DELETE FROM daechion_orders.scheduler_sessions')
      const {orderId}=await workerOrder(),payment=providerFor(43500),api=enrollmentFor(),messages=[],granted=[];let refreshes=0
      const original=payment.send
      payment.send=async job=>{const result=await original(job);payment.observation={state:'W',billId:job.billId,amountWon:null,paidAt:null};return result}
      const options={withClient:db.withClient,withSchedulerClient:schedulerClient,providers:{api,payment,daechion:{...api,
        refreshSession:async id=>{assert.equal(id,10);refreshes++;return {refreshed:true}},
        ensureFirstLessonAccess:async input=>{await input.beforeWrite();if(!input.enrollmentRecorded)await input.recordEnrollment();granted.push(input.lectureId);return {verified:true,lectureId:input.lectureId,studentId:input.studentId,weeklyLectureIds:[input.weeklyLectureId]}}},
        message:{send:async job=>{messages.push(job);return {accepted:true,messageId:'scheduler-fixture'}}}}}
      const first=await orderExecutable.runtime(schedulerEnv,options).cycle()
      assert.equal(first.processed,1);assert.equal(first.failed,0);assert.equal(payment.sends,1);assert.equal(api.creates,0)
      payment.paid();await makeDue(orderId)
      const second=await orderExecutable.runtime(schedulerEnv,options).cycle()
      assert.equal(second.processed,1);assert.equal(second.failed,0);assert.equal(api.creates,1);assert.equal(payment.sends,1)
      assert.deepEqual(granted,[11,20,21]);assert.equal(messages.length,1);assert.equal(refreshes,1)
      assert.equal((await orderExecutable.runtime(schedulerEnv,options).cycle()).processed,0)
      await makeDue(orderId);await orderExecutable.runtime(schedulerEnv,options).cycle()
      assert.equal(api.creates,1);assert.equal(messages.length,1);assert.deepEqual(granted,[11,20,21])
      assert.equal((await db.query('SELECT result FROM daechion_orders.scheduler_orders WHERE order_id=$1',[orderId])).rows[0].result,'OK')
    })
    await t.test('failed browser maintenance blocks account and grant writes, persists a Sheets-visible issue and retries without resetting unknown work',async()=>{
      await quietScheduler();await db.query('DELETE FROM daechion_orders.scheduler_sessions')
      const {orderId}=await workerOrder(['a']),payment=providerFor(12900),api=enrollmentFor();let healthy=false,refreshes=0
      await orderBilling.sendOrderBill(orderId,true,{withClient:db.withClient,provider:payment,preflight:async()=> 'READY'});payment.paid()
      const options={withClient:db.withClient,withSchedulerClient:schedulerClient,providers:{api,payment,daechion:{...api,refreshSession:async()=>{refreshes++;if(!healthy)throw Error('private session credential');return {refreshed:true}}}}}
      const env={...schedulerEnv,DAECHION_ORDER_SEND_ENABLED:'false',DAECHION_ORDER_READY_MESSAGE_ENABLED:'false'}
      assert.equal((await orderExecutable.runtime(env,options).cycle()).sessionReady,false)
      assert.equal(api.creates,0);assert.deepEqual(api.enrolled,[])
      let view=await db.withClient(c=>orderView.orderSheetView(c,orderId))
      assert.match(view.values[orderView.ORDER_HEADERS.indexOf('확인 필요 사유')],/로그인 세션 확인 필요/)
      assert.equal(view.values[orderView.ORDER_HEADERS.indexOf('처리 확인')],'확인 필요')
      assert.equal((await db.withClient(c=>orderAdmin.orderDetail(c,'fixture',orderId))).workerStatus.session_issue,true)
      await makeDue(orderId);await orderExecutable.runtime(env,options).cycle();assert.equal(refreshes,1);assert.equal(api.creates,0)
      healthy=true;await db.query("UPDATE daechion_orders.scheduler_sessions SET next_check_at=now()-interval '1 second'");await makeDue(orderId)
      assert.equal((await orderExecutable.runtime(env,options).cycle()).sessionReady,true)
      assert.equal(refreshes,2);assert.equal(api.creates,1);assert.deepEqual(api.enrolled,[10])
      view=await db.withClient(c=>orderView.orderSheetView(c,orderId));assert.ok(!JSON.stringify(view).includes('private session credential'))
      assert.ok(!view.values[orderView.ORDER_HEADERS.indexOf('확인 필요 사유')].includes('로그인 세션'))
    })
    await t.test('bounded scheduler batches are fair and an uncertain invoice is never resent by later cycles',async()=>{
      await quietScheduler()
      const ids=[];for(let n=0;n<11;n++)ids.push((await workerOrder(['a'])).orderId)
      const payment=providerFor(12900),api=enrollmentFor()
      const env={...schedulerEnv,DAECHION_ORDER_PAYMENT_READ_ENABLED:'false',DAECHION_ORDER_ENROLLMENT_ENABLED:'false',DAECHION_ORDER_READY_MESSAGE_ENABLED:'false',DAECHION_ORDER_SESSION_MAINTENANCE_ENABLED:'false'}
      const options={withClient:db.withClient,withSchedulerClient:schedulerClient,providers:{api,payment}}
      const service=orderExecutable.runtime(env,options)
      assert.equal((await service.cycle()).processed,10);assert.equal((await service.cycle()).processed,1);assert.equal(payment.sends,11)
      assert.equal((await service.cycle()).processed,0)
      await makeDue(ids[0]);await workerOrder(['a'])
      const due=await db.withClient(c=>scheduler.selectScheduledOrders(c,'fixture',{send:true,read:true,enroll:false,message:false,sheets:false}))
      assert.equal(due[0].id,ids[0])
      assert.equal((await db.withClient(c=>scheduler.selectScheduledOrders(c,'other',{send:true,read:true,enroll:true,message:true,sheets:true}))).length,0)
      await quietScheduler()
      const next=await workerOrder(['a']),unknown=providerFor(12900)
      const bad={...options,providers:{api,payment:{...unknown,send:async job=>{await unknown.send(job);return 'UNKNOWN'}}}}
      await orderExecutable.runtime(env,bad).cycle();await makeDue(next.orderId);await orderExecutable.runtime(env,bad).cycle()
      assert.equal(unknown.sends,1);assert.equal(api.creates,0)
      assert.equal((await db.query('SELECT state FROM daechion_orders.bills WHERE order_id=$1',[next.orderId])).rows[0].state,'SEND_UNKNOWN')
    })
    await t.test('real PostgreSQL scheduler lock excludes a second connection and is released after completion',{skip:!process.env.DAECHION_TEST_POSTGRES_URL},async()=>{
      let started,release;const begun=new Promise(r=>{started=r}),wait=new Promise(r=>{release=r})
      const first=scheduler.withSchedulerLock(db.withClient,'fixture',async assert=>{await assert();started();await wait;return true})
      await begun
      try{assert.equal(await scheduler.withSchedulerLock(db.withClient,'fixture',async()=>assert.fail('Second replica')),null)}finally{release()}
      assert.equal(await first,true)
      assert.equal(await scheduler.withSchedulerLock(db.withClient,'fixture',async()=>true),true)
    })
    const newIntakeFixture=async(person=contact())=>{
      const q=await checkout.quoteCheckout({items:[{productId:'pack'}],contact:person,expectedTotalWon:25000},{...ports,
        ownership:async(cart,_person,key)=>({...report(cart,key),identity:'REVIEW'})})
      const {orderId}=await checkout.receiveOrder(orderInput(q),ports),api=enrollmentFor()
      const admin={tenantId:'fixture',enabled:true,origins:['https://fixture.invalid'],authed:async()=>true,ready:async()=>{},withClient:db.withClient,
        inspectNewIntake:context=>intakeReview.inspectNewIntake(context,api,'s'.repeat(32))}
      return {orderId,q,api,admin,person}
    }
    await t.test('a fresh read-only new-student check confirms the full reviewed intake and billing independently rechecks it',async()=>{
      const {orderId,q,api,admin}=await newIntakeFixture()
      const input=await adminAction(orderId,'CONFIRM_NEW_INTAKE',{confirmNewStudent:true})
      assert.equal((await db.withClient(c=>orderAdmin.orderDetail(c,'fixture',orderId))).canConfirmNewIntake,true)
      assert.equal((await orderAdminHttp.orderAdminPost(request({...input,confirmNewStudent:false}),admin)).status,400)
      const results=await Promise.all([0,1].map(()=>orderAdminHttp.orderAdminPost(request(input),admin)))
      assert.ok(results.every(r=>r.status===200));assert.equal(api.creates,0);assert.deepEqual(api.enrolled,[])
      const row=(await db.query('SELECT * FROM daechion_orders.orders WHERE id=$1',[orderId])).rows[0]
      assert.equal(row.checkout_state,'READY');assert.ok(row.confirmed_at);assert.equal(row.identity_state,'WAITING');assert.equal(row.student_id,null)
      assert.equal(row.intake_action_id,input.requestKey);assert.equal(row.total_won,25000)
      assert.equal((await db.query('SELECT state FROM daechion_orders.quotes WHERE id=$1',[q.quoteId])).rows[0].state,'CONSUMED')
      const audit=(await db.query('SELECT student_id,target_ids FROM daechion_orders.admin_actions WHERE request_key=$1',[input.requestKey])).rows[0]
      assert.equal(audit.student_id,null);assert.deepEqual(audit.target_ids,[20,21])
      assert.equal((await orderAdminHttp.orderAdminPost(request(input),{...admin,inspectNewIntake:async()=>{throw Error('Replay is local')}})).status,200)
      const view=await db.withClient(c=>orderView.orderSheetView(c,orderId))
      assert.equal(view.values[orderView.ORDER_HEADERS.indexOf('중복 수강생 확인')],'통과')
      assert.match(view.values[orderView.ORDER_HEADERS.indexOf('중복 확인 사유')],/신규 학생 번호 중복 재조회/)
      const payment=providerFor(25000)
      assert.equal(await orderBilling.sendOrderBill(orderId,true,{withClient:db.withClient,provider:payment,
        preflight:context=>orderPreflight.preflightOrder(context,{tenantId:'fixture',subjectSecret:'s'.repeat(32),api})}),'SENT')
      assert.equal(payment.sends,1);assert.equal(api.creates,0)
    })
    await t.test('new intake approval rejects existing guardian matches, old or different evidence, unavailable courses and false declarations',async()=>{
      const {orderId,admin,api,person}=await newIntakeFixture({...contact(),guardianName:'보호자',guardianPhone:'01000007654'})
      const input=await adminAction(orderId,'CONFIRM_NEW_INTAKE',{confirmNewStudent:true})
      const context=await db.withClient(c=>manualReview.contextFromOrder(c,'fixture',orderId)),proof=await intakeReview.inspectNewIntake(context,api,'s'.repeat(32))
      assert.ok(proof)
      for(const changed of [{...proof,checkedAt:new Date(Date.now()-61000).toISOString()},{...proof,targetIds:[20]},{...proof,binding:'a'.repeat(64)}])
        await assert.rejects(db.withClient(c=>orderAdmin.applyOrderAdminAction(c,'fixture',input,undefined,undefined,undefined,changed)),/STATE/)
      const old={id:999,name:'다른 학생',active:false,studentPhoneNumber:'01000007653',parentPhoneNumber2:person.guardianPhone}
      const duplicate={...api,students:async phone=>phone===person.guardianPhone?[old]:[]}
      assert.equal(await intakeReview.inspectNewIntake(context,duplicate,'s'.repeat(32)),null)
      assert.equal((await orderAdminHttp.orderAdminPost(request(input),{...admin,inspectNewIntake:ctx=>intakeReview.inspectNewIntake(ctx,duplicate,'s'.repeat(32))})).status,409)
      for(const changed of [{...api,me:async()=>({tenantId:'other'})},{...api,students:async()=>{throw Error('Unknown lookup')}},{...api,lectures:async()=>[]},
        {...api,lectures:async()=>[{id:20,opened:true,weeklyLectures:[]},{id:21,opened:true,weeklyLectures:[{id:2100}]}]}])
        assert.equal(await intakeReview.inspectNewIntake(context,changed,'s'.repeat(32)),null)
      assert.equal(await intakeReview.inspectNewIntake({...context,contact:{...context.contact,studentHistory:'EXISTING'}},api,'s'.repeat(32)),null)
      assert.equal((await db.query('SELECT count(*)::int AS n FROM daechion_orders.admin_actions WHERE order_id=$1',[orderId])).rows[0].n,0)
      assert.equal(api.creates,0)
      await assert.rejects(db.query("UPDATE daechion_orders.orders SET checkout_state='READY' WHERE id=$1",[orderId]),/ORDER_QUOTE_NOT_READY/)
    })
    await t.test('closing an untouched reviewed intake is audited, final and permits a new application without deleting history',async()=>{
      const {orderId,q,admin,person}=await newIntakeFixture()
      const input=await adminAction(orderId,'CLOSE_INTAKE',{confirmClose:true})
      assert.equal((await db.withClient(c=>orderAdmin.orderDetail(c,'fixture',orderId))).canCloseIntake,true)
      await assert.rejects(db.query("UPDATE daechion_orders.orders SET closed_action_id=$2,checkout_state='CLOSED',review_code='intake_closed' WHERE id=$1",[orderId,randomUUID()]),/CLOSURE_APPROVAL_REQUIRED/)
      const failed={...admin,withClient:run=>db.withClient(c=>run({query:(sql,values)=>{
        if(sql.startsWith('INSERT INTO daechion_orders.admin_actions'))throw Error('Synthetic audit unavailable')
        return c.query(sql,values)
      }}))}
      assert.equal((await orderAdminHttp.orderAdminPost(request(input),failed)).status,503)
      assert.equal((await db.query('SELECT checkout_state FROM daechion_orders.orders WHERE id=$1',[orderId])).rows[0].checkout_state,'REVIEW')

      assert.equal((await orderAdminHttp.orderAdminPost(request({...input,confirmClose:false}),admin)).status,400)
      const replies=await Promise.all([0,1].map(()=>orderAdminHttp.orderAdminPost(request(input),admin)))
      assert.ok(replies.every(r=>r.status===200))
      const row=(await db.query('SELECT * FROM daechion_orders.orders WHERE id=$1',[orderId])).rows[0]
      assert.equal(row.checkout_state,'CLOSED');assert.equal(row.closed_action_id,input.requestKey);assert.equal(row.payment_state,'PENDING');assert.equal(row.confirmed_at,null)
      assert.equal((await db.query('SELECT state FROM daechion_orders.quotes WHERE id=$1',[q.quoteId])).rows[0].state,'EXPIRED')
      assert.equal((await db.query('SELECT count(*)::int AS n FROM daechion_orders.items WHERE order_id=$1',[orderId])).rows[0].n,1)
      const detail=await db.withClient(c=>orderAdmin.orderDetail(c,'fixture',orderId))
      assert.equal(detail.canCloseIntake,false);assert.equal(detail.canConfirmNewIntake,false);assert.equal(detail.canHold,false)
      for(const action of ['HOLD','RESUME_UNBILLED'])await assert.rejects(db.withClient(async c=>orderAdmin.applyOrderAdminAction(c,'fixture',await adminAction(orderId,action))),/STATE/)
      await assert.rejects(db.query("UPDATE daechion_orders.orders SET checkout_state='REVIEW',review_code='admin_hold' WHERE id=$1",[orderId]),/CLOSED_INTAKE_FROZEN/)
      await assert.rejects(db.query(`INSERT INTO daechion_orders.bills(id,order_id,amount_won,provider_account,bill_id,revision) VALUES($1,$2,25000,'fixture','90000000000000000991',1)`,[randomUUID(),orderId]),/ORDER_(CLOSED_INTAKE_CANNOT_BILL|NOT_BILLABLE)/)
      const view=await db.withClient(c=>orderView.orderSheetView(c,orderId))
      assert.equal(view.values[orderView.ORDER_HEADERS.indexOf('중복 수강생 확인')],'접수 종료')
      assert.equal(view.values[orderView.ORDER_HEADERS.indexOf('처리 확인')],'접수 종료')
      const newer=await checkout.receiveOrder(orderInput(await quote(['pack'],{contact:person})),ports)
      assert.notEqual(newer.orderId,orderId)
      assert.ok(!(await db.withClient(c=>orderAdmin.listOrders(c,'fixture',{q:person.studentPhone,reviewOnly:true}))).rows.some(r=>r.id===orderId))
    })
    await t.test('closure fences an in-flight billing preflight and refuses attempted or financially ambiguous orders',async()=>{
      const {orderId}=await workerOrder(['a']),payment=providerFor(12900)
      let started,finish;const begun=new Promise(resolve=>{started=resolve}),wait=new Promise(resolve=>{finish=resolve})
      const sending=orderBilling.sendOrderBill(orderId,true,{withClient:db.withClient,provider:payment,preflight:async()=>{started();await wait;return 'READY'}})
      await begun
      await db.withClient(async c=>orderAdmin.applyOrderAdminAction(c,'fixture',await adminAction(orderId,'CLOSE_INTAKE',{confirmClose:true})))
      finish();assert.equal(await sending,'SKIPPED');assert.equal(payment.sends,0)
      for(const mode of ['bill','write','token','grant','unknown-payment']){
        const next=await workerOrder(['a'])
        if(mode==='bill')await orderBilling.sendOrderBill(next.orderId,true,{withClient:db.withClient,provider:providerFor(12900),preflight:async()=> 'READY'})
        if(mode==='write')await db.query('UPDATE daechion_orders.orders SET identity_write_started=true WHERE id=$1',[next.orderId])
        if(mode==='token')await db.query("UPDATE daechion_orders.orders SET identity_token=$2,identity_until=now()+interval '10 minutes' WHERE id=$1",[next.orderId,randomUUID()])
        if(mode==='grant')await db.query("UPDATE daechion_orders.grants SET state='REVIEW' WHERE order_id=$1",[next.orderId])
        if(mode==='unknown-payment')await db.query("UPDATE daechion_orders.orders SET payment_state='UNKNOWN' WHERE id=$1",[next.orderId])
        const action=await adminAction(next.orderId,'CLOSE_INTAKE',{confirmClose:true})
        await assert.rejects(db.withClient(c=>orderAdmin.applyOrderAdminAction(c,'fixture',action)),/STATE/)
        assert.equal((await db.query('SELECT count(*)::int AS n FROM daechion_orders.admin_actions WHERE order_id=$1',[next.orderId])).rows[0].n,0)
      }
    })
    const identityUnknownFixture=async()=>{
      const {orderId}=await workerOrder(['a']),payment=providerFor(12900),api=enrollmentFor()
      const billing={withClient:db.withClient,provider:payment,preflight:async()=> 'READY'}
      await orderBilling.sendOrderBill(orderId,true,billing);payment.paid();await orderBilling.checkOrderPayment(orderId,true,billing)
      api.failCreate=true
      assert.equal(await orderEnrollment.runOrderGrant(orderId,true,{withClient:db.withClient,tenantId:'fixture',daechion:api}),'SKIPPED')
      const row=(await db.query('SELECT * FROM daechion_orders.orders WHERE id=$1',[orderId])).rows[0]
      assert.equal(row.review_code,'identity_create_unknown');assert.equal(row.student_id,null);assert.equal(api.creates,1)
      const student=(await api.students(row.student_phone))[0]
      const admin={tenantId:'fixture',enabled:true,origins:['https://fixture.invalid'],authed:async()=>true,ready:async()=>{},withClient:db.withClient,
        inspectExisting:(context,id)=>manualReview.inspectExisting(context,id,api),inspectPaid:context=>paidRecovery.inspectPaid(context,payment)}
      const input=await adminAction(orderId,'RECONCILE_IDENTITY',{studentId:student.id,confirmCreatedAccount:true})
      return {orderId,payment,api,row,student,admin,input}
    }
    await t.test('unknown account creation is reconciled read-only to one exact profile, stays held and resumes only after a current payment read',async()=>{
      const {orderId,payment,api,student,admin,input}=await identityUnknownFixture()
      assert.equal((await db.withClient(c=>orderAdmin.orderDetail(c,'fixture',orderId))).canReconcileIdentity,true)
      // A stale payment read does not prevent recording identity, but must not allow a grant.
      await db.query("UPDATE daechion_orders.bills SET checked_at=now()-interval '5 minutes' WHERE order_id=$1",[orderId])
      assert.equal((await orderAdminHttp.orderAdminPost(request({...input,confirmCreatedAccount:false}),admin)).status,400)
      const results=await Promise.all([0,1].map(()=>orderAdminHttp.orderAdminPost(request(input),admin)))
      assert.ok(results.every(r=>r.status===200))
      const row=(await db.query('SELECT * FROM daechion_orders.orders WHERE id=$1',[orderId])).rows[0]
      assert.equal(row.identity_state,'PASSED');assert.equal(Number(row.student_id),student.id);assert.equal(row.identity_write_started,true)
      assert.equal(row.checkout_state,'REVIEW');assert.equal(row.review_code,'identity_reconciled');assert.equal(row.identity_recovery_action_id,input.requestKey)
      assert.equal((await db.query('SELECT count(*)::int AS n FROM daechion_orders.phone_claims WHERE order_id=$1',[orderId])).rows[0].n,0)
      assert.equal((await db.query('SELECT count(*)::int AS n FROM daechion_orders.admin_actions WHERE request_key=$1',[input.requestKey])).rows[0].n,1)
      const view=await db.withClient(c=>orderView.orderSheetView(c,orderId))
      assert.equal(view.values[orderView.ORDER_HEADERS.indexOf('중복 수강생 확인')],'통과')
      assert.match(view.values[orderView.ORDER_HEADERS.indexOf('확인 필요 사유')],/현재 결제 재조회/)
      assert.equal(await orderEnrollment.runOrderGrant(orderId,true,{withClient:db.withClient,tenantId:'fixture',daechion:api}),'SKIPPED')
      assert.equal(api.creates,1);assert.deepEqual(api.enrolled,[])
      assert.equal((await orderAdminHttp.orderAdminPost(request(input),{...admin,inspectExisting:async()=>{throw Error('Replay must not query')}})).status,200)
      const resume=await adminAction(orderId,'RESUME_PAID',{billId:payment.bill.billId,confirmPaid:true})
      assert.equal((await orderAdminHttp.orderAdminPost(request(resume),admin)).status,200)
      assert.equal(await orderEnrollment.runOrderGrant(orderId,true,{withClient:db.withClient,tenantId:'fixture',daechion:api}),'VERIFIED')
      assert.equal(api.creates,1);assert.deepEqual(api.enrolled,[10])
      assert.equal(Number((await db.query('SELECT student_id FROM daechion_orders.orders WHERE id=$1',[orderId])).rows[0].student_id),student.id)
      assert.equal((await db.query('SELECT count(*)::int AS n FROM daechion_orders.ready_receipts WHERE order_id=$1',[orderId])).rows[0].n,0)
    })
    await t.test('identity reconciliation rejects profile drift, stale evidence, active leases and a different known account without changing the audit or claims',async()=>{
      const {orderId,api,admin,input,student}=await identityUnknownFixture()
      const context=await db.withClient(c=>manualReview.contextFromOrder(c,'fixture',orderId)),proof=await manualReview.inspectExisting(context,student.id,api)
      for(const changed of [{...proof,checkedAt:new Date(Date.now()-61000).toISOString()},{...proof,studentId:9999},{...proof,targetIds:[11]},{...proof,binding:'f'.repeat(64)}])
        await assert.rejects(db.withClient(c=>orderAdmin.applyOrderAdminAction(c,'fixture',input,changed)),/STATE/)
      await assert.rejects(manualReview.inspectExisting(context,student.id,{...api,student:async()=>({...student,name:'동명이인 아님'})}))
      await db.query("UPDATE daechion_orders.orders SET identity_token=$2,identity_until=now()+interval '10 minutes' WHERE id=$1",[orderId,randomUUID()])
      assert.equal((await orderAdminHttp.orderAdminPost(request(input),admin)).status,409)
      await db.query('UPDATE daechion_orders.orders SET identity_token=NULL,identity_until=NULL,student_id=$2 WHERE id=$1',[orderId,student.id+1])
      assert.equal((await orderAdminHttp.orderAdminPost(request(input),admin)).status,409)
      await db.query('UPDATE daechion_orders.orders SET student_id=NULL WHERE id=$1',[orderId])
      await assert.rejects(db.query("UPDATE daechion_orders.orders SET identity_state='PASSED',student_id=$2 WHERE id=$1",[orderId,student.id]),/RECOVERY_APPROVAL_REQUIRED/)
      await assert.rejects(db.withClient(c=>orderStore.orderTransaction(c,async()=>{
        await orderStore.lockOrder(c,orderId)
        await c.query(`INSERT INTO daechion_orders.admin_actions(request_key,order_id,fingerprint,action,operator_name,reason,before_version,after_version,
          student_id,profile_fingerprint,context_fingerprint,order_request_fingerprint,target_ids,checked_at)
          VALUES($1,$2,$3,'RECONCILE_IDENTITY','검수','연결 누락 커밋 차단',$4,$5,$6,$7,$8,(SELECT request_fingerprint FROM daechion_orders.orders WHERE id=$2),'[10]'::jsonb,$9)`,
          [randomUUID(),orderId,'a'.repeat(64),input.expectedVersion,(BigInt(input.expectedVersion)+1n).toString(),student.id,proof.profileFingerprint,proof.binding,proof.checkedAt])
        await orderStore.orderChanged(c,orderId,'synthetic_incomplete_recovery')
      })),/ORDER_ADMIN_COMMIT_INCOMPLETE/)
      assert.equal((await db.query('SELECT count(*)::int AS n FROM daechion_orders.admin_actions WHERE order_id=$1',[orderId])).rows[0].n,0)
      assert.equal((await db.query('SELECT count(*)::int AS n FROM daechion_orders.phone_claims WHERE order_id=$1',[orderId])).rows[0].n,1)
      assert.equal(api.creates,1)
    })
    await t.test('reconciled identities keep their profile pin and failed audit writes leave unknown creation untouched',async()=>{
      const f=await identityUnknownFixture(),{orderId,input,admin,api,payment,student}=f
      const failed={...admin,withClient:run=>db.withClient(c=>run({query:(sql,values)=>{
        if(sql.startsWith('INSERT INTO daechion_orders.admin_actions'))throw Error('Synthetic audit unavailable')
        return c.query(sql,values)
      }}))}
      assert.equal((await orderAdminHttp.orderAdminPost(request(input),failed)).status,503)
      assert.equal((await db.query('SELECT identity_state FROM daechion_orders.orders WHERE id=$1',[orderId])).rows[0].identity_state,'REVIEW')
      assert.equal((await orderAdminHttp.orderAdminPost(request(input),admin)).status,200)
      await assert.rejects(db.query('UPDATE daechion_orders.orders SET identity_recovery_action_id=NULL WHERE id=$1',[orderId]),/RECOVERY_FROZEN/)
      const resume=await adminAction(orderId,'RESUME_PAID',{billId:payment.bill.billId,confirmPaid:true})
      assert.equal((await orderAdminHttp.orderAdminPost(request(resume),admin)).status,200)
      // Keep name/student phone matching, but mutate an unselected guardian: the immutable profile pin still detects drift.
      student.parentPhoneNumber='01000008888'
      assert.equal(await orderEnrollment.runOrderGrant(orderId,true,{withClient:db.withClient,tenantId:'fixture',daechion:api}),'SKIPPED')
      assert.equal(api.creates,1);assert.deepEqual(api.enrolled,[])
      assert.equal((await db.query('SELECT checkout_state FROM daechion_orders.orders WHERE id=$1',[orderId])).rows[0].checkout_state,'REVIEW')
    })
    const manualFixture=async()=>{
      const {orderId}=await workerOrder(['pack']),payment=providerFor(25000),api=enrollmentFor()
      api.failEnroll=20
      await orderBilling.sendOrderBill(orderId,true,{withClient:db.withClient,provider:payment,preflight:async()=> 'READY'})
      payment.paid();await orderBilling.checkOrderPayment(orderId,true,{withClient:db.withClient,provider:payment})
      assert.equal(await orderEnrollment.runOrderGrant(orderId,true,{withClient:db.withClient,tenantId:'fixture',daechion:api}),'REVIEW')
      const studentId=Number((await db.query('SELECT student_id FROM daechion_orders.orders WHERE id=$1',[orderId])).rows[0].student_id)
      let inspections=0
      const admin={tenantId:'fixture',enabled:true,origins:['https://fixture.invalid'],authed:async()=>true,ready:async()=>{},withClient:db.withClient,
        inspectAccess:async(ctx,sid,lid,revoke)=>{inspections++;return manualAccess.inspectManualAccess(ctx,sid,lid,revoke,api)}}
      return {orderId,payment,api,studentId,admin,get inspections(){return inspections}}
    }
    await t.test('manual access records human-confirmed permissions for the fixed account without fabricating API enrollment or replaying a message',async()=>{
      const f=await manualFixture(),{orderId,api,studentId,admin,payment}=f
      const action=await adminAction(orderId,'MANUAL_ACCESS',{studentId,lectureId:20,confirmVideo:true,confirmLessonMaterials:true,confirmCourseMaterials:true})
      for(const changed of [{confirmVideo:false},{confirmLessonMaterials:false},{confirmCourseMaterials:false}])assert.equal((await orderAdminHttp.orderAdminPost(request({...action,...changed}),admin)).status,400)
      assert.equal((await orderAdminHttp.orderAdminPost(request({...action,studentId:studentId+99}),admin)).status,409)
      assert.equal((await orderAdminHttp.orderAdminPost(request({...action,lectureId:999}),admin)).status,409)
      const context=await db.withClient(c=>manualReview.contextFromOrder(c,'fixture',orderId)),proof=await manualAccess.inspectManualAccess(context,studentId,20,false,api)
      for(const changed of [{...proof,checkedAt:new Date(Date.now()-61000).toISOString()},{...proof,binding:'f'.repeat(64)}])
        await assert.rejects(db.withClient(c=>orderAdmin.applyOrderAdminAction(c,'fixture',action,undefined,undefined,changed)),/STATE/)
      await assert.rejects(db.query("UPDATE daechion_orders.grants SET state='MANUAL',verified_at=now() WHERE order_id=$1 AND lecture_id=20",[orderId]),/APPROVAL_REQUIRED/)
      const writes={creates:api.creates,enrollments:api.enrolled.length,access:api.access.length,bills:payment.sends}
      assert.equal((await orderAdminHttp.orderAdminPost(request(action),admin)).status,200)
      const count=f.inspections;assert.equal((await orderAdminHttp.orderAdminPost(request(action),{...admin,inspectAccess:async()=>{throw Error('Replay must not query API')}})).status,200);assert.equal(f.inspections,count)
      let grant=(await db.query('SELECT state,enrollment_recorded,manual_action_id FROM daechion_orders.grants WHERE order_id=$1 AND lecture_id=20',[orderId])).rows[0]
      assert.equal(grant.state,'MANUAL');assert.equal(grant.enrollment_recorded,false);assert.equal(grant.manual_action_id,action.requestKey)
      assert.equal((await db.query("SELECT count(*)::int AS n FROM daechion_orders.jobs WHERE order_id=$1 AND kind='READY_MESSAGE'",[orderId])).rows[0].n,0)
      const second=await adminAction(orderId,'MANUAL_ACCESS',{studentId,lectureId:21,confirmVideo:true,confirmLessonMaterials:true,confirmCourseMaterials:true})
      assert.equal((await orderAdminHttp.orderAdminPost(request(second),admin)).status,200)
      assert.equal((await db.query('SELECT notification_state FROM daechion_orders.orders WHERE id=$1',[orderId])).rows[0].notification_state,'PENDING')
      assert.deepEqual({creates:api.creates,enrollments:api.enrolled.length,access:api.access.length,bills:payment.sends},writes)
      const view=await db.withClient(c=>orderView.orderSheetView(c,orderId));assert.match(view.values[orderView.ORDER_HEADERS.indexOf('강의별 등록·권한 상태')],/수동 권한 확인/)
      let messages=0
      await orderMessage.sendOrderReady(orderId,true,{withClient:db.withClient,payment,message:{send:async()=>{messages++;return {outcome:'UNKNOWN'}}}})
      await db.query("UPDATE daechion_orders.grants SET state='REVIEW',review_code='grant_unknown' WHERE order_id=$1 AND lecture_id=21",[orderId])
      const reconfirm=await adminAction(orderId,'MANUAL_ACCESS',{studentId,lectureId:21,confirmVideo:true,confirmLessonMaterials:true,confirmCourseMaterials:true})
      assert.equal((await orderAdminHttp.orderAdminPost(request(reconfirm),admin)).status,200)
      assert.equal((await db.query('SELECT notification_state FROM daechion_orders.orders WHERE id=$1',[orderId])).rows[0].notification_state,'UNKNOWN')
      assert.equal(messages,1)
    })
    await t.test('manual revocation is a permanent per-course record that blocks automatic reopening and permits recording after cancellation',async()=>{
      const {orderId,studentId,admin,api,payment}=await manualFixture()
      const action=await adminAction(orderId,'RECORD_REVOKED',{studentId,lectureId:20,confirmRevoked:true})
      assert.equal((await orderAdminHttp.orderAdminPost(request({...action,confirmRevoked:false}),admin)).status,400)
      const before={creates:api.creates,enrollments:api.enrolled.length,access:api.access.length,bills:payment.sends}
      assert.equal((await orderAdminHttp.orderAdminPost(request(action),admin)).status,200)
      assert.equal((await orderAdminHttp.orderAdminPost(request(action),admin)).status,200)
      const grant=(await db.query('SELECT state,revoked_at,manual_action_id FROM daechion_orders.grants WHERE order_id=$1 AND lecture_id=20',[orderId])).rows[0]
      assert.equal(grant.state,'REVOKED');assert.ok(grant.revoked_at);assert.equal(grant.manual_action_id,action.requestKey)
      assert.equal((await db.query('SELECT checkout_state FROM daechion_orders.orders WHERE id=$1',[orderId])).rows[0].checkout_state,'REVIEW')
      assert.equal((await db.query('SELECT state FROM daechion_orders.grants WHERE order_id=$1 AND lecture_id=21',[orderId])).rows[0].state,'PENDING')
      await assert.rejects(db.query("UPDATE daechion_orders.orders SET checkout_state='READY',review_code=NULL WHERE id=$1",[orderId]),/REVOKED_ACCESS_BLOCKS_READY/)
      await assert.rejects(db.query("UPDATE daechion_orders.grants SET state='PENDING' WHERE order_id=$1 AND lecture_id=20",[orderId]),/REVOKED_ACCESS_FROZEN/)
      assert.equal((await db.withClient(c=>orderAdmin.orderDetail(c,'fixture',orderId))).canResumePaid,false)
      const input=await adminAction(orderId,'RESUME_PAID',{billId:payment.bill.billId,confirmPaid:true})
      const context=await db.withClient(c=>paidRecovery.paidContext(c,'fixture',orderId,input.expectedVersion,input.billId)),proof=await paidRecovery.inspectPaid(context,payment)
      await assert.rejects(db.withClient(c=>orderAdmin.applyOrderAdminAction(c,'fixture',input,undefined,proof)),/STATE/)
      payment.observation={state:'C',billId:payment.bill.billId,amountWon:25000,paidAt:null};await orderBilling.checkOrderPayment(orderId,true,{withClient:db.withClient,provider:payment})
      const second=await adminAction(orderId,'RECORD_REVOKED',{studentId,lectureId:21,confirmRevoked:true})
      const closedCourse={...admin,inspectAccess:(ctx,sid,lid,revoke)=>manualAccess.inspectManualAccess(ctx,sid,lid,revoke,{...api,lectures:async()=>{throw Error('Closed course does not need a lecture lookup for revocation')}})}
      assert.equal((await orderAdminHttp.orderAdminPost(request(second),closedCourse)).status,200)
      assert.deepEqual({creates:api.creates,enrollments:api.enrolled.length,access:api.access.length,bills:payment.sends},before)
      const view=await db.withClient(c=>orderView.orderSheetView(c,orderId));assert.match(view.values[orderView.ORDER_HEADERS.indexOf('강의별 등록·권한 상태')],/수동 회수 확인/)
    })
    await t.test('manual access rejects old payment, active grants, different profiles and failed audit writes atomically',async()=>{
      const {orderId,studentId,admin,api}=await manualFixture()
      const input=await adminAction(orderId,'MANUAL_ACCESS',{studentId,lectureId:20,confirmVideo:true,confirmLessonMaterials:true,confirmCourseMaterials:true})
      const context=await db.withClient(c=>manualReview.contextFromOrder(c,'fixture',orderId)),proof=await manualAccess.inspectManualAccess(context,studentId,20,false,api)
      await db.query("UPDATE daechion_orders.grants SET state='RUNNING',lease_token=$2,lease_until=now()+interval '1 minute' WHERE order_id=$1 AND lecture_id=21",[orderId,randomUUID()])
      await assert.rejects(db.withClient(c=>orderAdmin.applyOrderAdminAction(c,'fixture',input,undefined,undefined,proof)),/STATE/)
      await db.query("UPDATE daechion_orders.grants SET state='PENDING',lease_token=NULL,lease_until=NULL WHERE order_id=$1 AND lecture_id=21",[orderId])
      await db.query("UPDATE daechion_orders.bills SET checked_at=now()-interval '4 minutes' WHERE order_id=$1",[orderId])
      await assert.rejects(db.withClient(c=>orderAdmin.applyOrderAdminAction(c,'fixture',input,undefined,undefined,proof)),/STATE/)
      await db.query('UPDATE daechion_orders.bills SET checked_at=now() WHERE order_id=$1',[orderId])
      assert.equal((await orderAdminHttp.orderAdminPost(request(input),{...admin,inspectAccess:async()=>{throw Error('private student lookup failure')}})).status,503)
      await assert.rejects(db.withClient(c=>orderAdmin.applyOrderAdminAction({query:async(sql,args)=>{
        if(sql.startsWith('INSERT INTO daechion_orders.admin_actions'))throw Error('TEST_AUDIT_UNAVAILABLE')
        return c.query(sql,args)
      }},'fixture',input,undefined,undefined,proof)),/TEST_AUDIT_UNAVAILABLE/)
      assert.equal((await db.query('SELECT state FROM daechion_orders.grants WHERE order_id=$1 AND lecture_id=20',[orderId])).rows[0].state,'REVIEW')
      assert.equal((await db.query('SELECT count(*)::int AS n FROM daechion_orders.admin_actions WHERE order_id=$1',[orderId])).rows[0].n,0)
      const wrong={...api,student:async()=>({...await api.student(studentId),studentPhoneNumber:'01000009998'})}
      await assert.rejects(manualAccess.inspectManualAccess(context,studentId,20,false,wrong))
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
  assert.equal(found.existingStudent,'EXISTING')
  assert.equal((await ownership.lookupOwnership(port,'fixture',cart,person,key)).existingStudent,'NEW')
  assert.equal((await ownership.lookupOwnership({...port,students:async()=>{throw Error('Lookup unavailable')}},'fixture',cart,person,key)).existingStudent,'UNKNOWN')
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
