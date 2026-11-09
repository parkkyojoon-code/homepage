import {test} from 'node:test'
import assert from 'node:assert/strict'
import {resolveCart,reviewOwnership,type CheckoutProduct,type ResolvedCart} from '../lib/daechion/orders/cart'
import {saleKindForWrite,validateBundle,bundlePublishingReady} from '../lib/daechion/orders/sale-policy'
import {prepareApplication} from '../lib/daechion/intake'
import {preflightOrder} from '../lib/daechion/orders/preflight'
import type {BillingContext} from '../lib/daechion/orders/billing'
import {bundleSource,resolveBundleComponents,bundleCompositionIssue,type BundleProduct} from '../lib/daechion/orders/bundle-components'
import {checkoutCatalog} from '../lib/daechion/orders/catalog'
import {firstLessonTarget} from '../lib/daechion/first-lesson'
import {usesOrderCheckout,purchaseEntryHref} from '../lib/purchase-process'
import {validateDiscounts,discountSummary} from '../lib/daechion/orders/discounts'

test('one promotion code discounts only eligible products, preserves overlap guards and immutable snapshot totals',()=>{
  const product=(productId:string,priceWon:number,ids:number[],discountPrices?:{code:string;priceWon:number}[])=>({productId,title:productId,saleKind:ids.length>1?'BUNDLE':'SINGLE',priceWon,tenantId:'fixture',revision:'r1',purchaseProcess:'PROCESS_2',visible:true,lectures:ids.map(id=>({id,name:`강의 ${id}`})),...(discountPrices?{discountPrices}:{})})
  const catalog=[product('a',100000,[10],[{code:'LIVE2026',priceWon:80000},{code:'OTHER',priceWon:90000}]),product('b',70000,[11],[{code:'LIVE2026',priceWon:60000}]),product('c',50000,[12]),product('pack',150000,[10,11],[{code:'LIVE2026',priceWon:120000}])]
  const cart=resolveCart({items:[{productId:'a'},{productId:'b'},{productId:'c'}],discountCode:' live2026 '},catalog,'fixture')
  assert.equal(cart.totalWon,190000);assert.deepEqual(cart.items.map(i=>i.priceWon),[80000,60000,50000])
  assert.deepEqual(discountSummary(cart.items),{regularTotalWon:220000,discountWon:30000,discountCode:'LIVE2026'})
  assert.equal(resolveCart({items:cart.items.map(i=>({productId:i.productId}))},cart.items,'fixture').fingerprint,cart.fingerprint)
  assert.equal(resolveCart({items:[{productId:'a'}],discountCode:'OTHER'},catalog,'fixture').totalWon,90000)
  assert.equal(resolveCart({items:[{productId:'pack'},{productId:'a'}],discountCode:'LIVE2026'},catalog,'fixture').conflicts.length,1)
  assert.equal(resolveCart({items:[{productId:'pack'}],discountCode:'LIVE2026'},catalog,'fixture').totalWon,120000)
  assert.throws(()=>resolveCart({items:[{productId:'c'}],discountCode:'LIVE2026'},catalog,'fixture'),/DISCOUNT_NOT_APPLICABLE/)
  assert.throws(()=>resolveCart({items:[{productId:'a'}],discountCode:'NOPE'},catalog,'fixture'),/DISCOUNT_NOT_APPLICABLE/)
  assert.throws(()=>resolveCart({items:[{productId:'a'}],discountCode:'LIVE2026',priceWon:1},catalog,'fixture'),/INVALID_CART/)
  assert.throws(()=>resolveCart({items:[{productId:'a'}],discountCode:['LIVE2026','OTHER']},catalog,'fixture'),/INVALID_CART/)
  assert.equal(resolveCart({items:[{productId:'a'}]},catalog,'fixture').totalWon,100000)
  assert.ok(!JSON.stringify(cart.items).includes('OTHER'))
})

test('product promotion validation rejects duplicate codes, free/increased prices and legacy/variable products',()=>{
  const product={purchaseProcess:'PROCESS_2',modes:{online:{enabled:true,price:10000}},textbook:{included:true,price:1000}}
  assert.deepEqual(validateDiscounts([{code:' live_2026 ',priceWon:9000}],product),[{code:'LIVE_2026',priceWon:9000}])
  for(const rules of [[{code:'',priceWon:9000}],[{code:'A A',priceWon:9000}],[{code:'A',priceWon:0}],[{code:'A',priceWon:11000}],[{code:'A',priceWon:1.5}],[{code:'a',priceWon:9000},{code:'A',priceWon:8000}]])assert.throws(()=>validateDiscounts(rules,product))
  assert.throws(()=>validateDiscounts([{code:'A',priceWon:9000}],{...product,purchaseProcess:'PROCESS_1'}))
  assert.throws(()=>validateDiscounts([{code:'A',priceWon:9000}],{...product,subjectSelection:{}}))
  assert.deepEqual(validateDiscounts(undefined,{purchaseProcess:'PROCESS_1'}),[])
})

test('purchase entry routes bundles and enabled process2 singles to selected cart while preserving legacy and offline flows',()=>{
  const single={id:'new-course',purchaseProcess:'PROCESS_2'}
  assert.equal(usesOrderCheckout(single,false),false)
  assert.equal(usesOrderCheckout(single,true),true)
  assert.equal(usesOrderCheckout({...single,saleKind:'BUNDLE'},false),true)
  assert.equal(usesOrderCheckout({id:'legacy'},true),false)
  assert.equal(usesOrderCheckout({...single,id:'12course',saleKind:'BUNDLE'},true),false)
  assert.equal(purchaseEntryHref('묶음상품1','online','서울 대치',true),'/classes/cart?productId=%EB%AC%B6%EC%9D%8C%EC%83%81%ED%92%881')
  assert.equal(purchaseEntryHref('legacy','online','서울 대치',false),'/apply/legacy?option=online&campus=%EC%84%9C%EC%9A%B8%20%EB%8C%80%EC%B9%98')
  assert.equal(purchaseEntryHref('new-course','offline','서울 대치',true),'/apply/new-course?option=offline&campus=%EC%84%9C%EC%9A%B8%20%EB%8C%80%EC%B9%98')
})

test('bundle publishing requires explicit environment opt-in and the order service',()=>{
  assert.equal(bundlePublishingReady({}),false)
  assert.equal(bundlePublishingReady({DAECHION_BUNDLE_PUBLISH_ENABLED:'true'}),false)
  assert.equal(bundlePublishingReady({DAECHION_ORDERS_ENABLED:'true'}),false)
  assert.equal(bundlePublishingReady({DAECHION_BUNDLE_PUBLISH_ENABLED:'TRUE',DAECHION_ORDERS_ENABLED:'true'}),false)
  assert.equal(bundlePublishingReady({DAECHION_BUNDLE_PUBLISH_ENABLED:'true',DAECHION_ORDERS_ENABLED:'true'}),true)
})

test('first-lesson policy pins LMS sequence rather than numeric IDs and refuses changing targets',()=>{
  const course={id:10,opened:true,weeklyLectures:[{id:900},{id:100},{id:200}]}
  assert.equal(firstLessonTarget([course],10),900)
  assert.equal(firstLessonTarget([course],10,[900]),900)
  assert.throws(()=>firstLessonTarget([course],10,[100]))
  assert.throws(()=>firstLessonTarget([course],10,[900,100]))
  assert.throws(()=>firstLessonTarget([{...course,weeklyLectures:[{id:100},{id:900}]}],10,[900]))
  for(const courses of [[],[course,course],[{...course,opened:false}],[{...course,weeklyLectures:[]}],[{...course,weeklyLectures:[{id:900},{id:900}]}]])assert.throws(()=>firstLessonTarget(courses,10))
  assert.equal(firstLessonTarget([{...course,weeklyLectures:Array.from({length:50},(_,i)=>({id:900+i}))}],10),900)
})

test('website bundle components bind exact product and lecture IDs, permit hidden singles, and reject stale or invalid sources',()=>{
  const source=(id:string,lectureId:number):BundleProduct&{updatedAt:string}=>({id,name:'같은 상품명',visible:false,purchaseProcess:'PROCESS_2',saleKind:'SINGLE',
    modes:{online:{enabled:true,price:900}},textbook:{included:false,price:0},updatedAt:'r1',
    daechionBinding:{tenantId:'fixture',lectures:[{id:lectureId,name:'같은 강의명'}],verifiedAt:'2026-11-09T00:00:00Z'}})
  const first=source('first',10),second=source('second',11),sources=[first,second]
  const proof=sources.map(item=>bundleSource(item)!)
  const saved=resolveBundleComponents(['second','first'],proof,sources,'fixture')
  assert.deepEqual(saved,proof)
  const bundle={...first,id:'pack',name:'두 상품 묶음',saleKind:'BUNDLE' as const,visible:true,bundleComponents:saved,
    modes:{online:{enabled:true,price:1200},offline:{enabled:false,price:0}},updatedAt:'r1',
    daechionBinding:{tenantId:'fixture',lectures:[{id:10,name:'첫 강의'},{id:11,name:'둘째 강의'}],verifiedAt:'2026-11-09T00:00:00Z'}}
  const fullSources=sources.map(p=>({...p,modes:{...p.modes,offline:{enabled:false,price:0}}}))
  assert.equal(bundleCompositionIssue(bundle,sources),null)
  assert.equal(checkoutCatalog([...fullSources,bundle],'fixture').length,1)
  const changedNamePrice={...first,name:'새 상품명',modes:{online:{enabled:true,price:9999}},updatedAt:'r2'}
  assert.equal(bundleCompositionIssue(bundle,[changedNamePrice,second]),null)
  assert.equal((checkoutCatalog([...fullSources,bundle],'fixture')[0] as {priceWon:number}).priceWon,1200)
  for(const invalid of [{...first,purchaseProcess:'PROCESS_1' as const},{...first,id:'12course'},{...first,saleKind:'BUNDLE' as const},
    {...first,subjectSelection:{}},{...first,textbook:{included:true,price:500}},{...first,modes:{online:{enabled:false,price:900}}},
    {...first,daechionBinding:null},{...first,daechionBinding:{...first.daechionBinding!,tenantId:'other'}}]){
    assert.equal(bundleSource(invalid,'fixture'),null)
  }
  const reconnected={...first,daechionBinding:{...first.daechionBinding!,lectures:[{id:12,name:'새 강의'}]}}
  for(const changed of [[reconnected,second],[second],[{...first,purchaseProcess:'PROCESS_1' as const},second]]){
    assert.ok(bundleCompositionIssue(bundle,changed))
    assert.throws(()=>resolveBundleComponents(['first','second'],proof,changed,'fixture'))
  }
  assert.equal(checkoutCatalog([{...reconnected,modes:{...reconnected.modes,offline:{enabled:false,price:0}}},fullSources[1],bundle],'fixture').length,0)
  assert.throws(()=>resolveBundleComponents(['first','first'],proof,sources,'fixture'))
  assert.throws(()=>resolveBundleComponents(['first','second'],proof,[first,{...second,daechionBinding:first.daechionBinding}],'fixture'))
  assert.throws(()=>resolveBundleComponents(['first','second'],undefined,sources,'fixture'))
  assert.throws(()=>resolveBundleComponents(['first','second'],proof,[...sources,first],'fixture'))
  assert.ok(bundleCompositionIssue({...bundle,daechionBinding:{...bundle.daechionBinding,lectures:[{id:10,name:'첫 강의'},{id:12,name:'잘못된 강의'}]}},sources))
  const refreshed=resolveBundleComponents(['first','second'],[bundleSource(reconnected)!,bundleSource(second)!],[reconnected,second],'fixture')
  assert.equal(refreshed[0].lectureId,12)
  assert.equal(bundle.bundleComponents[0].lectureId,10)
  assert.equal(bundleCompositionIssue({...bundle,bundleComponents:undefined},[]),null)
})

const single=(productId:string,id:number,priceWon=12900):CheckoutProduct=>({productId,title:'동일 강의명',saleKind:'SINGLE',purchaseProcess:'PROCESS_2',visible:true,priceWon,tenantId:'fixture',revision:'r1',lectures:[{id,name:'동일 강의명'}]})
const a=single('a',10), b=single('b',11,18500)
const pack:CheckoutProduct={...a,productId:'pack',title:'4강 묶음',saleKind:'BUNDLE',priceWon:90000,lectures:[10,11,12,13].map(id=>({id,name:`구성 ${id}`}))}
const resolve=(ids:string[],catalog:unknown[]=[a,b,pack])=>resolveCart({items:ids.map(productId=>({productId}))},catalog,'fixture')
const now=new Date('2026-11-08T01:00:00Z'),key='b'.repeat(64)
const report=(cart:ResolvedCart,states:Partial<Record<number,'OWNED'|'NOT_OWNED'|'UNKNOWN'>>={})=>({cartFingerprint:cart.fingerprint,subjectKey:key,checkedAt:now.toISOString(),identity:'PASSED',lectures:cart.items.flatMap(item=>item.lectures.map(target=>({id:target.id,state:states[target.id]??'NOT_OWNED'})))})

test('bundle editing preserves sale identity and rejects invalid prices, targets and legacy pricing',()=>{
  const record={saleKind:'BUNDLE' as const,purchaseProcess:'PROCESS_2' as const,name:'파이널 묶음',visible:false,
    modes:{online:{enabled:true,price:19900},offline:{enabled:false,price:0}},textbook:{included:false,price:0}}
  assert.equal(saleKindForWrite(undefined),undefined)
  assert.equal(saleKindForWrite('BUNDLE'),'BUNDLE')
  assert.equal(saleKindForWrite(undefined,record),'BUNDLE')
  assert.throws(()=>saleKindForWrite('SINGLE',record))
  assert.throws(()=>saleKindForWrite('BUNDLE',{...record,saleKind:undefined}))
  assert.throws(()=>saleKindForWrite('unknown'))
  assert.doesNotThrow(()=>validateBundle(record,[10,11],false))
  for(const ids of [[],[10],[10,10],['10',11],[-1,11],Array.from({length:31},(_,i)=>i+1)])assert.throws(()=>validateBundle(record,ids,false))
  for(const price of [0,-1,1.5,NaN,Infinity,2147483648,'900'])assert.throws(()=>validateBundle({...record,modes:{...record.modes,online:{enabled:true,price:price as number}}},[10,11],false))
  assert.throws(()=>validateBundle({...record,purchaseProcess:'PROCESS_1'},[10,11],false))
  assert.throws(()=>validateBundle({...record,textbook:{included:true,price:300}},[10,11],false))
  assert.throws(()=>validateBundle({...record,subjectSelection:{}},[10,11],false))
  assert.throws(()=>validateBundle({...record,modes:{...record.modes,offline:{enabled:true,price:300}}},[10,11],false))
  assert.throws(()=>validateBundle({...record,visible:true},[10,11],false))
  assert.doesNotThrow(()=>validateBundle({...record,saleKind:undefined,purchaseProcess:'PROCESS_1'},undefined,false))
  const legacyInput={requestKey:'f8b88473-efce-4d39-8767-c79a8cd7f811',productId:'bundle',studentName:'가상',studentPhone:'01000000001',payerPhone:'01000000001',studentHistory:'NEW',applicantType:'STUDENT',mode:'ONLINE',expectedTotalWon:19900,confirmPayment:true,agreePrivacy:true}
  assert.throws(()=>prepareApplication(legacyInput,{...record,id:'bundle',visible:true},[{productId:'bundle',lectureIds:[10,11]}],'fixture'),/PRODUCT_UNAVAILABLE/)
})

test('server-owned exact sums and fixed bundle price do not infer quantity discounts',()=>{
  assert.equal(resolve(['a','b']).totalWon,31400)
  assert.equal(resolve(['pack']).totalWon,90000)
  assert.equal(resolve(['pack','e'],[pack,single('e',99,20000)]).totalWon,110000)
  assert.equal(resolve(['a'],[single('a',10,900)]).totalWon,900)
  const cart=resolve(['a','b']);assert.equal(cart.fingerprint,resolve(['b','a']).fingerprint)
  assert.notEqual(cart.fingerprint,resolve(['a','b'],[{...a,priceWon:13000},b]).fingerprint)
  assert.notEqual(cart.fingerprint,resolve(['a','b'],[{...a,revision:'r2'},b]).fingerprint)
})

test('overlaps are exact lecture IDs, not names, and retain both selected products for an explicit choice',()=>{
  assert.deepEqual(resolve(['a','b']).conflicts,[])
  const cart=resolve(['pack','a'])
  assert.equal(cart.items.length,2);assert.equal(cart.totalWon,102900)
  assert.deepEqual(cart.conflicts,[{lectureId:10,lectureName:'구성 10',productIds:['pack','a'],productTitles:['4강 묶음','동일 강의명']}])
  assert.throws(()=>reviewOwnership(cart,report(cart),key,now),/CART_CONFLICT/)
  const q={...pack,productId:'q',lectures:[{id:13,name:'別名'},{id:20,name:'別名'}]}
  assert.equal(resolve(['pack','q'],[pack,q]).conflicts[0].lectureId,13)
})

test('forged prices, legacy products, unconfigured bundles and excessive totals fail before checkout',()=>{
  for(const raw of [{items:[{productId:'a',priceWon:1}]},{items:[{productId:'a',quantity:2}]},{items:[]},{items:[{productId:'a'}],paymentState:'PAID'}])
    assert.throws(()=>resolveCart(raw,[a],'fixture'),/INVALID_CART/)
  assert.throws(()=>resolve(['a','a']),/DUPLICATE_PRODUCT/)
  assert.throws(()=>resolve(['missing']),/PRODUCT_UNAVAILABLE/)
  for(const product of [{...a,productId:'12course'},{...a,purchaseProcess:'PROCESS_1'},{...a,visible:false},{...a,priceWon:0},{...a,priceWon:1.5},
    {...pack,lectures:[pack.lectures[0]]},{...pack,lectures:[pack.lectures[0],pack.lectures[0]]},{...a,lectures:pack.lectures}])
    assert.throws(()=>resolve([product.productId],[product]),/PRODUCT_NOT_CONFIGURED/)
  assert.throws(()=>resolve(['a'],[a,a]),/PRODUCT_NOT_CONFIGURED/)
  assert.throws(()=>resolve(['a'],[{...a,tenantId:'other'}]),/TENANT_MISMATCH/)
  assert.throws(()=>resolve(['a','b'],[{...a,priceWon:2147483647},b]),/TOTAL_OUT_OF_RANGE/)
  const p={...pack,lectures:Array.from({length:30},(_,i)=>({id:i+1,name:'강의'}))}
  assert.throws(()=>resolve(['pack','x'],[p,single('x',31)]),/CART_TOO_LARGE/)
})

test('owned singles require a revised confirmation; empty purchases do not produce a payable quote',()=>{
  const cart=resolve(['a','b'])
  const result=reviewOwnership(cart,report(cart,{10:'OWNED'}),key,now)
  assert.equal(result.status,'RECONFIRM');assert.equal(result.totalWon,18500)
  assert.deepEqual(result.items.map(item=>item.productId),['b']);assert.deepEqual(result.excluded.map(item=>item.productId),['a'])
  const all=reviewOwnership(cart,report(cart,{10:'OWNED',11:'OWNED'}),key,now)
  assert.equal(all.status,'NO_PURCHASE');assert.equal(all.totalWon,0)
  assert.equal(reviewOwnership(cart,report(cart),key,now).status,'READY')
})

test('any owned bundle component holds the whole bundle at the final price without automatic subtraction',()=>{
  const cart=resolve(['pack'])
  for(const states of [{10:'OWNED'},{10:'OWNED',11:'OWNED',12:'OWNED',13:'OWNED'}] as const){
    const result=reviewOwnership(cart,report(cart,states),key,now)
    assert.equal(result.status,'REVIEW');assert.equal(result.totalWon,90000);assert.deepEqual(result.excluded,[])
    assert.deepEqual(result.reasons,[{productId:'pack',code:'BUNDLE_ALREADY_OWNED'}])
  }
  assert.equal(reviewOwnership(cart,report(cart,{12:'UNKNOWN'}),key,now).status,'REVIEW')
  assert.equal(reviewOwnership(cart,{...report(cart),identity:'REVIEW'},key,now).status,'REVIEW')
})

test('ownership evidence is bound to one cart and student, complete, unique and fresh',()=>{
  const cart=resolve(['a','b']),valid=report(cart)
  for(const changed of [{...valid,subjectKey:'c'.repeat(64)},{...valid,cartFingerprint:'d'.repeat(64)},
    {...valid,checkedAt:'2026-11-08T00:58:59Z'},{...valid,checkedAt:'2026-11-08T01:00:01Z'},
    {...valid,lectures:[valid.lectures[0]]},{...valid,lectures:[valid.lectures[0],valid.lectures[0]]},
    {...valid,lectures:[...valid.lectures,{id:99,state:'OWNED'}]},{...valid,lectures:[{id:10,state:'UNVERIFIED'},valid.lectures[1]]}])
    assert.throws(()=>reviewOwnership(cart,changed,key,now),/INVALID_OWNERSHIP_REPORT/)
  assert.throws(()=>reviewOwnership({...cart,totalWon:1},valid,key,now),/CART_CONFLICT/)
  assert.throws(()=>reviewOwnership({...cart,items:[{...a,priceWon:1},b]},valid,key,now),/CART_CONFLICT/)
})

test('invoice preflight reads current tenant, exact course IDs and identity without creating accounts or repricing',async()=>{
  const context:BillingContext={orderId:'10000000-0000-4000-8000-000000000001',version:'1',tenantId:'fixture',totalWon:a.priceWon+b.priceWon,items:[a,b],
    contact:{studentName:'검수',studentPhone:'01000001234',guardianName:'',guardianPhone:'',payerPhone:'01000009999',applicantType:'STUDENT',studentHistory:'NEW',agreePrivacy:true,confirmPayment:true}}
  const reads:string[]=[]
  const api={me:async()=>({tenantId:'fixture'}),students:async(phone:string)=>{reads.push(phone);return []},
    lectures:async()=>[10,11].map(id=>({id,opened:true,weeklyLectures:[{id:id+100}]}))}
  const ports={tenantId:'fixture',subjectSecret:'s'.repeat(32),api}
  assert.equal(await preflightOrder(context,ports),'READY')
  assert.deepEqual(reads,['01000001234']) // Payer never grants or decides identity.
  for(const changed of [{...context,totalWon:1},{...context,tenantId:'other'},{...context,items:[a,{...b,lectures:a.lectures}]},
    {...context,items:[{...a,productId:'12course'}]}, {...context,contact:{...context.contact,studentHistory:'EXISTING' as const}}])
    assert.equal(await preflightOrder(changed,ports),'REVIEW')
  for(const lectures of [[{id:10,opened:false,weeklyLectures:[{id:110}]}],[],
    [10,11].map(id=>({id,opened:true,weeklyLectures:[]})),
    [10,11].map(id=>({id,opened:true,weeklyLectures:[{id:110},{id:110}]})),
    [10,10,11].map(id=>({id,opened:true,weeklyLectures:[{id:id+100}]}))])
    assert.equal(await preflightOrder(context,{...ports,api:{...api,lectures:async()=>lectures}}),'REVIEW')
  assert.equal(await preflightOrder(context,{...ports,api:{...api,me:async()=>({tenantId:'wrong'})}}),'REVIEW')
  assert.equal(await preflightOrder(context,{...ports,api:{...api,students:async()=>[{id:1,name:'동명이인',active:false,studentPhoneNumber:context.contact.studentPhone}]}}),'REVIEW')
  assert.equal(await preflightOrder(context,{...ports,api:{...api,students:async()=>{throw Error('private provider details')}}}),'REVIEW')
  assert.equal(await preflightOrder({...context,contact:{...context.contact,guardianPhone:'01000005678'}},ports),'READY')
  assert.deepEqual(reads.slice(-2),['01000001234','01000005678'])
})
