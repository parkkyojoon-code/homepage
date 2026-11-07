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
