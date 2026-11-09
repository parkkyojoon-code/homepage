import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {randomUUID,createHash} from 'node:crypto'
import {PGlite} from '@electric-sql/pglite'
import pg from 'pg'

const hash=()=>createHash('sha256').update(randomUUID()).digest('hex')
async function database(){
  if(!process.env.DAECHION_TEST_POSTGRES_URL)return new PGlite()
  const url=new URL(process.env.DAECHION_TEST_POSTGRES_URL)
  if(!['127.0.0.1','localhost'].includes(url.hostname)||url.pathname!=='/daechion_ci'||url.username!=='daechion_ci')throw Error('ISOLATED_ORDER_TEST_DATABASE_REQUIRED')
  const client=new pg.Client({connectionString:url.toString()});await client.connect()
  await client.query('DROP SCHEMA IF EXISTS daechion_orders CASCADE')
  return {query:(sql,values)=>client.query(sql,values),exec:sql=>client.query(sql),close:()=>client.end()}
}
const product=(productId,ids,priceWon)=>({productId,title:productId,saleKind:ids.length>1?'BUNDLE':'SINGLE',priceWon,tenantId:'fixture',revision:'r1',purchaseProcess:'PROCESS_2',visible:true,lectures:ids.map(id=>({id,name:`강의 ${id}`}))})

test('isolated multi-product ledger enforces exact quote, components, invoice and paid grant boundaries',async t=>{
  const db=await database()
  const create=async(items,{total=items.reduce((s,i)=>s+i.priceWon,0),expired=false,quoteState='READY',missingTarget=false}={})=>{
    const id=randomUUID(),quoteId=randomUUID(),cart=hash(),subject=hash()
    await db.query(`INSERT INTO daechion_orders.quotes(id,token_hash,cart_fingerprint,subject_key,snapshot,total_won,state,created_at,expires_at)
      VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,now()-$8::interval,now()-$8::interval+interval '10 minutes')`,[quoteId,hash(),cart,subject,JSON.stringify({items}),total,quoteState,expired?'20 minutes':'0 minutes'])
    await db.query(`INSERT INTO daechion_orders.orders(id,quote_id,request_key,request_fingerprint,cart_fingerprint,subject_key,tenant_id,student_phone,contact_snapshot,total_won)
      VALUES($1,$2,$3,$4,$5,$6,'fixture','01000000001','{}',$7)`,[id,quoteId,randomUUID(),hash(),cart,subject,total])
    const itemIds=[]
    for(const item of items){
      const itemId=randomUUID();itemIds.push(itemId)
      await db.query(`INSERT INTO daechion_orders.items(id,order_id,product_id,sale_kind,title,price_won,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)`,[itemId,id,item.productId,item.saleKind,item.title,item.priceWon,JSON.stringify(item)])
      for(const target of item.lectures.slice(missingTarget?1:0))await db.query('INSERT INTO daechion_orders.grants(order_id,item_id,lecture_id) VALUES($1,$2,$3)',[id,itemId,target.id])
    }
    return {id,quoteId,itemIds}
  }
  const ready=id=>db.query("UPDATE daechion_orders.orders SET checkout_state='READY' WHERE id=$1",[id])
  const bill=(order,amount,billId='90000000000000000001')=>db.query(`INSERT INTO daechion_orders.bills(id,order_id,amount_won,provider_account,bill_id,revision) VALUES($1,$2,$3,'fixture',$4,1)`,[randomUUID(),order.id,amount,billId])
  try{
    await db.exec('CREATE TABLE IF NOT EXISTS public.bundle_order_legacy_fixture(id integer PRIMARY KEY); INSERT INTO public.bundle_order_legacy_fixture VALUES(1) ON CONFLICT DO NOTHING;')
    await db.exec(readFileSync(new URL('../db/daechion-orders/001_initial.sql',import.meta.url),'utf8'))
    await t.test('new schema leaves the legacy fixture and V1 migration list untouched',async()=>{
      assert.deepEqual((await db.query('SELECT id FROM public.bundle_order_legacy_fixture')).rows,[{id:1}])
      const migrationRunner=readFileSync(new URL('../scripts/daechion-migrations.cjs',import.meta.url),'utf8')
      assert.ok(!migrationRunner.includes('daechion-orders'))
    })
    await t.test('a bundle and separate single produce one exact-sum invoice and frozen component snapshots',async()=>{
      const order=await create([product('pack',[10,11,12,13],90000),product('single',[99],20000)])
      await ready(order.id);await bill(order,110000)
      assert.equal((await db.query('SELECT count(*)::int AS n FROM daechion_orders.grants WHERE order_id=$1',[order.id])).rows[0].n,5)
      assert.equal((await db.query('SELECT state FROM daechion_orders.quotes WHERE id=$1',[order.quoteId])).rows[0].state,'CONSUMED')
      await assert.rejects(bill(order,100000,'90000000000000000002'))
      await assert.rejects(db.query('UPDATE daechion_orders.orders SET total_won=1 WHERE id=$1',[order.id]),/ORDER_SNAPSHOT_FROZEN/)
      await assert.rejects(db.query("UPDATE daechion_orders.orders SET checkout_state='DRAFT' WHERE id=$1",[order.id]),/ORDER_CANNOT_REOPEN_DRAFT/)
      await assert.rejects(db.query('UPDATE daechion_orders.items SET price_won=1 WHERE order_id=$1',[order.id]),/ORDER_COMPONENTS_FROZEN/)
      await assert.rejects(db.query('DELETE FROM daechion_orders.grants WHERE order_id=$1',[order.id]),/ORDER_COMPONENTS_FROZEN/)
      await assert.rejects(db.query("UPDATE daechion_orders.bills SET bill_id='90000000000000000003' WHERE order_id=$1",[order.id]),/ORDER_BILL_IDENTITY_FROZEN/)
      await assert.rejects(db.query("UPDATE daechion_orders.quotes SET snapshot='{}' WHERE id=$1",[order.quoteId]),/ORDER_QUOTE_SNAPSHOT_FROZEN/)
    })
    await t.test('wrong sums, missing grant targets, held and expired quotes never become billable',async()=>{
      for(const [options,error] of [[{total:1},'ORDER_SUM_MISMATCH'],[{missingTarget:true},'ORDER_TARGETS_MISMATCH'],[{quoteState:'REVIEW'},'ORDER_QUOTE_NOT_READY'],[{quoteState:'CONSUMED'},'ORDER_QUOTE_NOT_READY'],[{expired:true},'ORDER_QUOTE_NOT_READY']]){
        const order=await create([product('fixture',[20,21],2100)],options)
        await assert.rejects(ready(order.id),new RegExp(error))
        await assert.rejects(bill(order,options.total??2100),/ORDER_NOT_BILLABLE/)
        assert.equal((await db.query('SELECT state FROM daechion_orders.quotes WHERE id=$1',[order.quoteId])).rows[0].state,options.quoteState??'READY')
      }
    })
    await t.test('overlapping target IDs from different items cannot be inserted into one order',async()=>{
      await assert.rejects(create([product('pack-overlap',[30,31],5000),product('overlap',[30],900)]))
    })
    await t.test('READY cannot be inserted directly or reached through a review-state detour',async()=>{
      const draft=await create([product('not-ready',[55],900)],{missingTarget:true})
      await assert.rejects(db.query(`INSERT INTO daechion_orders.orders(id,quote_id,request_key,request_fingerprint,cart_fingerprint,subject_key,tenant_id,student_phone,contact_snapshot,total_won,checkout_state)
        SELECT $1,quote_id,$2,request_fingerprint,cart_fingerprint,subject_key,tenant_id,student_phone,contact_snapshot,total_won,'READY' FROM daechion_orders.orders WHERE id=$3`,[randomUUID(),randomUUID(),draft.id]),/ORDER_MUST_START_DRAFT/)
      await db.query("UPDATE daechion_orders.orders SET checkout_state='REVIEW' WHERE id=$1",[draft.id])
      await assert.rejects(ready(draft.id),/ORDER_TARGETS_MISMATCH/)
      await assert.rejects(db.query('UPDATE daechion_orders.orders SET confirmed_at=now() WHERE id=$1',[draft.id]),/ORDER_CONFIRMATION_FROZEN/)
    })
    await t.test('payment evidence and a resolved student are required before a grant can run',async()=>{
      const order=await create([product('paid-test',[40],900)])
      await ready(order.id);await bill(order,900,'90000000000000000004')
      await assert.rejects(db.query("UPDATE daechion_orders.orders SET payment_state='PAID' WHERE id=$1",[order.id]),/ORDER_PAYMENT_EVIDENCE_REQUIRED/)
      await assert.rejects(db.query("UPDATE daechion_orders.grants SET state='VERIFIED',verified_at=now() WHERE order_id=$1",[order.id]),/ORDER_PAID_IDENTITY_REQUIRED/)
      await db.query("UPDATE daechion_orders.bills SET state='SENT',last_payment_state='PAID',sent_at=now(),due_at=now()+interval '7 days' WHERE order_id=$1",[order.id])
      await db.query("UPDATE daechion_orders.orders SET payment_state='PAID',identity_state='PASSED',student_id=1 WHERE id=$1",[order.id])
      await db.query("UPDATE daechion_orders.grants SET state='VERIFIED',verified_at=now() WHERE order_id=$1",[order.id])
      assert.equal((await db.query('SELECT state FROM daechion_orders.grants WHERE order_id=$1',[order.id])).rows[0].state,'VERIFIED')
      await assert.rejects(db.query('UPDATE daechion_orders.orders SET student_id=2 WHERE id=$1',[order.id]),/ORDER_STUDENT_FROZEN/)
    })
  }finally{await db.close()}
})
