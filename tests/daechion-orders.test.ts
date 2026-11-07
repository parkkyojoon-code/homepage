import {test} from 'node:test'
import assert from 'node:assert/strict'
import {resolveCart,reviewOwnership,type CheckoutProduct,type ResolvedCart} from '../lib/daechion/orders/cart'

const single=(productId:string,id:number,priceWon=12900):CheckoutProduct=>({productId,title:'동일 강의명',saleKind:'SINGLE',purchaseProcess:'PROCESS_2',visible:true,priceWon,tenantId:'fixture',revision:'r1',lectures:[{id,name:'동일 강의명'}]})
const a=single('a',10), b=single('b',11,18500)
const pack:CheckoutProduct={...a,productId:'pack',title:'4강 묶음',saleKind:'BUNDLE',priceWon:90000,lectures:[10,11,12,13].map(id=>({id,name:`구성 ${id}`}))}
const resolve=(ids:string[],catalog:unknown[]=[a,b,pack])=>resolveCart({items:ids.map(productId=>({productId}))},catalog,'fixture')
const now=new Date('2026-11-08T01:00:00Z'),key='b'.repeat(64)
const report=(cart:ResolvedCart,states:Partial<Record<number,'OWNED'|'NOT_OWNED'|'UNKNOWN'>>={})=>({cartFingerprint:cart.fingerprint,subjectKey:key,checkedAt:now.toISOString(),identity:'PASSED',lectures:cart.items.flatMap(item=>item.lectures.map(target=>({id:target.id,state:states[target.id]??'NOT_OWNED'})))})

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
