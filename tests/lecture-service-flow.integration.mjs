import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { postgresFixture } from './lecture-postgres-fixture.mjs'
import { createOrderWithinTransaction } from '../.test-build/lib/lectures/orders.js'
import { confirmWithinTransaction } from '../.test-build/lib/lectures/manual-payment.js'
import { revokeWithinTransaction } from '../.test-build/lib/lectures/manual-revocation.js'
import { classroom, lectureDestination } from '../.test-build/lib/lectures/classroom.js'
import { hashPassword, verifyPassword } from '../.test-build/lib/lectures/security.js'
const testDirectory = fileURLToPath(new URL('.',import.meta.url))

async function scenario(run) {
  const db = process.env.LECTURES_TEST_POSTGRES_URL?await postgresFixture(process.env.LECTURES_TEST_POSTGRES_URL):new PGlite()
  try {
    for (const file of ['001_initial.sql','020_manual_confirmations.sql','021_manual_revocations.sql','030_admin_access_controls.sql','031_admin_account_management.sql','032_buyer_password_recovery.sql','033_billing_queue.sql','034_billing_refresh.sql','035_catalog_history.sql']) await db.exec(readFileSync(join(testDirectory,'../db/lectures',file),'utf8'))
    const client = { query: async (sql,params) => {
      const result = await db.query(sql,params)
      return { ...result, rowCount: /^\s*SELECT/i.test(sql) ? result.rows.length : result.affectedRows ?? result.rows.length }
    } }
    const tx = async operation => {
      await db.exec('BEGIN')
      try { const result = await operation(client); await db.exec('COMMIT'); return result }
      catch (e) { await db.exec('ROLLBACK'); throw e }
    }
    const user = randomUUID(), other = randomUUID(), lecture = randomUUID()
    const hashed = await hashPassword('test-password-only')
    await db.query('INSERT INTO lecture_users(id,username,name,phone,password_hash) VALUES($1,$2,$3,$4,$5),($6,$7,$8,$9,$5)',[user,'fake_one','가상회원1','01012345678',hashed,other,'fake_two','가상회원2','01087654321'])
    await db.query("INSERT INTO lectures(id,title,price_won,sale_status,video_url) VALUES($1,$2,1000,'ON_SALE',$3)",[lecture,'가상 강의','https://youtu.be/abcdefghijk'])
    await run({ db, client, tx, user, other, lecture })
  } finally { await db.close() }
}
const evidence = { expectedTotalWon:1000, operatorName:'가상 관리자', note:'가상 납부 내역 확인', confirmed:true }

test('real SQL lifecycle: account data, order, approval, access, correction', () => scenario(async ({ db,client,tx,user,other,lecture }) => {
  const saved = (await db.query('SELECT password_hash FROM lecture_users WHERE id=$1',[user])).rows[0]
  assert.equal(await verifyPassword('test-password-only',saved.password_hash),true)
  assert.equal(await verifyPassword('wrong-password',saved.password_hash),false)
  await assert.rejects(tx(c => createOrderWithinTransaction(c,user,[lecture],randomUUID(),2000)))
  assert.equal((await db.query('SELECT count(*)::int AS n FROM lecture_orders')).rows[0].n,0)
  const key = randomUUID()
  const order = await tx(c => createOrderWithinTransaction(c,user,[lecture],key,1000))
  assert.equal((await tx(c => createOrderWithinTransaction(c,user,[lecture],key,1000))).id,order.id)
  await assert.rejects(tx(c => createOrderWithinTransaction(c,user,[lecture],randomUUID(),1000)))
  assert.deepEqual(await classroom(user,client),[])
  await assert.rejects(lectureDestination(user,lecture,client),e => e.status===404)
  await db.query('UPDATE lectures SET title=$2,price_won=2000 WHERE id=$1',[lecture,'변경 후 가상 강의'])
  const item = (await db.query('SELECT title_snapshot,price_won FROM lecture_order_items WHERE order_id=$1',[order.id])).rows[0]
  assert.equal(item.price_won,1000); assert.equal(item.title_snapshot,'가상 강의')
  assert.equal((await tx(c => confirmWithinTransaction(c,order.id,evidence))).alreadyConfirmed,false)
  assert.equal((await tx(c => confirmWithinTransaction(c,order.id,evidence))).alreadyConfirmed,true)
  assert.equal((await db.query('SELECT count(*)::int AS n FROM lecture_entitlements')).rows[0].n,1)
  const list = await classroom(user,client)
  assert.equal(list.length,1); assert.equal(list[0].video_ready,true); assert.equal('video_url' in list[0],false)
  assert.equal(await lectureDestination(user,lecture,client),'https://www.youtube.com/watch?v=abcdefghijk')
  assert.deepEqual(await classroom(other,client),[])
  await assert.rejects(lectureDestination(other,lecture,client),e => e.status===404)
  await db.query("UPDATE lectures SET sale_status='CLOSED' WHERE id=$1",[lecture])
  assert.equal((await classroom(user,client)).length,1)
  await db.query("UPDATE lectures SET video_url='https://invalid.example' WHERE id=$1",[lecture])
  assert.equal((await classroom(user,client))[0].video_ready,false)
  await assert.rejects(lectureDestination(user,lecture,client),e => e.status===409)
  await tx(c => revokeWithinTransaction(c,order.id,{ ...evidence,correctionOnly:true }))
  assert.deepEqual(await classroom(user,client),[])
  await assert.rejects(lectureDestination(user,lecture,client),e => e.status===404)
  assert.equal((await tx(c => revokeWithinTransaction(c,order.id,{ ...evidence,correctionOnly:true }))).alreadyRevoked,true)
  await assert.rejects(tx(c => confirmWithinTransaction(c,order.id,evidence)),e => e.status===409)
}))

test('approval failure rolls back confirmation, grants and order; retry succeeds', () => scenario(async ({db,tx,user,lecture}) => {
  const order = await tx(c => createOrderWithinTransaction(c,user,[lecture],randomUUID(),1000))
  await assert.rejects(tx(c => confirmWithinTransaction({ query: async (sql,params) => {
    if(sql.startsWith('UPDATE lecture_orders')) throw new Error('injected failure')
    return c.query(sql,params)
  } },order.id,evidence)))
  assert.equal((await db.query('SELECT status FROM lecture_orders WHERE id=$1',[order.id])).rows[0].status,'CREATED')
  assert.equal((await db.query('SELECT count(*)::int AS n FROM lecture_manual_confirmations')).rows[0].n,0)
  assert.equal((await db.query('SELECT count(*)::int AS n FROM lecture_entitlements')).rows[0].n,0)
  await tx(c => confirmWithinTransaction(c,order.id,evidence))
  assert.equal((await db.query('SELECT status FROM lecture_orders WHERE id=$1',[order.id])).rows[0].status,'PAID')
}))

test('inconsistent order item amounts cannot receive approval or grants', () => scenario(async ({db,tx,user,lecture}) => {
  const order = await tx(c => createOrderWithinTransaction(c,user,[lecture],randomUUID(),1000))
  await db.query('UPDATE lecture_order_items SET price_won=500 WHERE order_id=$1',[order.id])
  await assert.rejects(tx(c => confirmWithinTransaction(c,order.id,evidence)),e => e.status===409)
  assert.equal((await db.query('SELECT count(*)::int AS n FROM lecture_manual_confirmations')).rows[0].n,0)
  assert.equal((await db.query('SELECT count(*)::int AS n FROM lecture_entitlements')).rows[0].n,0)
}))
import { changeAccessWithinTransaction } from '../.test-build/lib/lectures/admin-access.js'
import { manageAccountWithinTransaction, activateAdminWithinTransaction } from '../.test-build/lib/lectures/admin-accounts.js'
import { tokenHash } from '../.test-build/lib/lectures/security.js'
import { lockAdmin } from '../.test-build/lib/lectures/admin-domain.js'

async function administrator(db,role='OPERATOR',username='fake_admin') {
 const id=randomUUID(),sessionHash=tokenHash(randomUUID())
 await db.query('INSERT INTO lecture_admin_users(id,username,name,role,password_hash) VALUES($1,$2,$3,$4,$5)',[id,username,'가상 관리자',role,await hashPassword('fake-admin-password')])
 await db.query("INSERT INTO lecture_admin_sessions(token_hash,admin_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",[sessionHash,id])
 return {id,sessionHash}
}
function command(action,version=0){return {action,expectedVersion:version,expectedTotalWon:1000,requestKey:randomUUID(),reason:'가상 결제선생 내역 직접 대조',checkedAt:new Date().toISOString(),confirmed:true}}

test('personal admin: automatic paid orders can be closed/restored; retries and stale versions are safe',()=>scenario(async({db,tx,user,lecture,client})=>{
 const actor=await administrator(db)
 const order=await tx(c=>createOrderWithinTransaction(c,user,[lecture],randomUUID(),1000))
 // Simulate an existing automatically paid purchase without the legacy manual-confirmation row.
 await db.query("UPDATE lecture_orders SET status='PAID' WHERE id=$1",[order.id])
 await db.query('INSERT INTO lecture_entitlements(id,user_id,lecture_id,order_item_id) SELECT $1,$2,lecture_id,id FROM lecture_order_items WHERE order_id=$3',[randomUUID(),user,order.id])
 const close=command('CLOSE')
 await tx(c=>changeAccessWithinTransaction(c,actor,order.id,close))
 assert.deepEqual(await classroom(user,client),[])
 assert.equal((await db.query('SELECT status FROM lecture_orders WHERE id=$1',[order.id])).rows[0].status,'PAID')
 assert.equal((await tx(c=>changeAccessWithinTransaction(c,actor,order.id,close))).alreadyApplied,true)
 await assert.rejects(tx(c=>changeAccessWithinTransaction(c,actor,order.id,{...close,reason:'동일 키의 다른 처리 사유'})),e=>e.status===409)
 await assert.rejects(tx(c=>changeAccessWithinTransaction(c,actor,order.id,command('RESTORE',0))),e=>e.status===409)
 await tx(c=>changeAccessWithinTransaction(c,actor,order.id,command('RESTORE',1)))
 assert.equal((await classroom(user,client)).length,1)
 assert.equal((await db.query('SELECT count(*)::int AS n FROM lecture_entitlements')).rows[0].n,1)
 assert.equal((await db.query('SELECT count(*)::int AS n FROM lecture_admin_actions')).rows[0].n,2)
 assert.equal((await db.query('SELECT admin_id FROM lecture_admin_actions LIMIT 1')).rows[0].admin_id,actor.id)
}))

test('expired orders can be manually opened; audit failure rolls back all access changes',()=>scenario(async({db,tx,user,lecture,client})=>{
 const actor=await administrator(db)
 const order=await tx(c=>createOrderWithinTransaction(c,user,[lecture],randomUUID(),1000))
 await db.query("UPDATE lecture_orders SET status='EXPIRED' WHERE id=$1",[order.id])
 const open=command('OPEN')
 await assert.rejects(tx(c=>changeAccessWithinTransaction({query:async(sql,params)=>{
  if(sql.includes('INSERT INTO lecture_admin_actions'))throw new Error('injected audit failure')
  return c.query(sql,params)
 }},actor,order.id,open)))
 assert.deepEqual(await classroom(user,client),[])
 assert.equal((await db.query('SELECT status,version FROM lecture_orders WHERE id=$1',[order.id])).rows[0].status,'EXPIRED')
 await tx(c=>changeAccessWithinTransaction(c,actor,order.id,open))
 assert.equal((await classroom(user,client)).length,1)
 await db.query('DELETE FROM lecture_admin_sessions WHERE admin_id=$1',[actor.id])
 await assert.rejects(tx(c=>changeAccessWithinTransaction(c,actor,order.id,command('CLOSE',1))),e=>e.status===401)
}))

test('revoking one purchase preserves another purchase and closed flag blocks stale grants',()=>scenario(async({db,tx,user,lecture,client})=>{
 const actor=await administrator(db)
 const first=await tx(c=>createOrderWithinTransaction(c,user,[lecture],randomUUID(),1000))
 await tx(c=>changeAccessWithinTransaction(c,actor,first.id,command('OPEN')))
 await tx(c=>changeAccessWithinTransaction(c,actor,first.id,command('CLOSE',1)))
 const second=await tx(c=>createOrderWithinTransaction(c,user,[lecture],randomUUID(),1000))
 await tx(c=>changeAccessWithinTransaction(c,actor,second.id,command('OPEN')))
 assert.equal((await classroom(user,client)).length,1)
 await tx(c=>changeAccessWithinTransaction(c,actor,second.id,command('CLOSE',1)))
 // Even if an obsolete writer accidentally clears revoked_at, the source-order closed flag still denies access.
 await db.query('UPDATE lecture_entitlements SET revoked_at=NULL')
 assert.deepEqual(await classroom(user,client),[])
 await assert.rejects(lectureDestination(user,lecture,client),e=>e.status===404)
}))

test('account roles, last owner, invitations, token reuse and session invalidation',()=>scenario(async({db,tx})=>{
 const owner=await administrator(db,'OWNER','fake_owner')
 const operator=await administrator(db,'OPERATOR','fake_operator')
 await assert.rejects(tx(c=>manageAccountWithinTransaction(c,operator,{action:'CREATE',username:'blocked_admin',name:'차단',role:'OWNER'})),e=>e.status===403)
 await assert.rejects(tx(c=>manageAccountWithinTransaction(c,owner,{action:'UPDATE',id:owner.id,role:'OPERATOR',disabled:false,expectedVersion:0})),e=>e.status===409)
 const invite=await tx(c=>manageAccountWithinTransaction(c,owner,{action:'CREATE',username:'new_admin',name:'신규 관리자',role:'OWNER'}))
 assert.ok(invite.token)
 const stored=(await db.query('SELECT token_hash FROM lecture_admin_tokens WHERE admin_id=$1',[invite.id])).rows[0]
 assert.equal(stored.token_hash,tokenHash(invite.token));assert.notEqual(stored.token_hash,invite.token)
 // An invited owner cannot count as an available last-owner replacement.
 await assert.rejects(tx(c=>manageAccountWithinTransaction(c,owner,{action:'UPDATE',id:owner.id,role:'OWNER',disabled:true,expectedVersion:0})),e=>e.status===409)
 await tx(c=>activateAdminWithinTransaction(c,invite.token,'test-only-encoded-password'))
 await assert.rejects(tx(c=>activateAdminWithinTransaction(c,invite.token,'second-hash')),e=>e.status===400)
 await tx(c=>manageAccountWithinTransaction(c,owner,{action:'UPDATE',id:operator.id,role:'OPERATOR',disabled:true,expectedVersion:0}))
 await assert.rejects(tx(c=>lockAdmin(c,operator)),e=>e.status===401)
 assert.equal((await db.query('SELECT count(*)::int AS n FROM lecture_admin_sessions WHERE admin_id=$1',[operator.id])).rows[0].n,0)
 await assert.rejects(tx(c=>manageAccountWithinTransaction(c,owner,{action:'UPDATE',id:operator.id,role:'OPERATOR',disabled:false,expectedVersion:0})),e=>e.status===409)
}))
import { resetBuyerWithinTransaction, completeBuyerChangeWithinTransaction } from '../.test-build/lib/lectures/buyer-recovery.js'
import { buyerSession, issueBuyerSessionWithinTransaction } from '../.test-build/lib/lectures/buyer-auth-domain.js'

function recoveryInput(version=0){return {expectedCredentialVersion:version,requestKey:randomUUID(),reason:'가상 구매자 본인 확인 후 초기화',confirmed:true}}

test('buyer recovery: operator reset invalidates old login, restricts temporary login and completes once',()=>scenario(async({db,tx,user,lecture,client})=>{
 const admin=await administrator(db)
 const original=(await db.query('SELECT password_hash FROM lecture_users WHERE id=$1',[user])).rows[0].password_hash
 const oldSession=tokenHash(randomUUID())
 await tx(c=>issueBuyerSessionWithinTransaction(c,user,original,oldSession))
 const temporaryPassword='temporary-test-password',temporaryHash=await hashPassword(temporaryPassword)
 const input=recoveryInput()
 await tx(c=>resetBuyerWithinTransaction(c,admin,user,input,temporaryHash))
 await assert.rejects(buyerSession(client,oldSession),e=>e.status===401)
 // A login that verified the OLD password just before reset cannot create a new session afterward.
 await assert.rejects(tx(c=>issueBuyerSessionWithinTransaction(c,user,original,tokenHash(randomUUID()))),e=>e.status===401)
 const replay=await tx(c=>resetBuyerWithinTransaction(c,admin,user,input,'not-used-on-replay'))
 assert.equal(replay.alreadyApplied,true)
 assert.equal((await db.query('SELECT password_hash FROM lecture_users WHERE id=$1',[user])).rows[0].password_hash,temporaryHash)
 await assert.rejects(tx(c=>resetBuyerWithinTransaction(c,admin,user,{...input,reason:'같은 요청키의 다른 확인 사유'},temporaryHash)),e=>e.status===409)
 const tempSession=tokenHash(randomUUID())
 assert.equal((await tx(c=>issueBuyerSessionWithinTransaction(c,user,temporaryHash,tempSession))).mustChangePassword,true)
 assert.equal((await buyerSession(client,tempSession,true)).id,user)
 await assert.rejects(buyerSession(client,tempSession),e=>e.status===403&&e.code==='PASSWORD_CHANGE_REQUIRED')
 await assert.rejects(tx(c=>createOrderWithinTransaction(c,user,[lecture],randomUUID(),1000)),e=>e.status===403)
 await assert.rejects(tx(c=>completeBuyerChangeWithinTransaction(c,{id:user,sessionHash:tempSession},temporaryPassword,temporaryHash)),e=>e.status===400)
 const password='new-test-password-only',newHash=await hashPassword(password)
 await tx(c=>completeBuyerChangeWithinTransaction(c,{id:user,sessionHash:tempSession},password,newHash))
 await assert.rejects(buyerSession(client,tempSession,true),e=>e.status===401)
 const newSession=tokenHash(randomUUID())
 assert.equal((await tx(c=>issueBuyerSessionWithinTransaction(c,user,newHash,newSession))).mustChangePassword,false)
 assert.equal((await buyerSession(client,newSession)).id,user)
 const recovery=(await db.query('SELECT admin_id,completed_at FROM lecture_account_recoveries WHERE user_id=$1',[user])).rows[0]
 assert.equal(recovery.admin_id,admin.id);assert.ok(recovery.completed_at)
 await assert.rejects(tx(c=>createOrderWithinTransaction(c,user,[lecture],randomUUID(),1000,0)),e=>e.status===401)
 assert.equal((await db.query('SELECT count(*)::int AS n FROM lecture_account_recoveries')).rows[0].n,1)
 await tx(c=>createOrderWithinTransaction(c,user,[lecture],randomUUID(),1000))
}))

test('buyer recovery audit failure rolls back password and session deletion; reissue invalidates old temporary sessions',()=>scenario(async({db,tx,user,client})=>{
 const admin=await administrator(db,'OWNER','recovery_owner')
 const original=(await db.query('SELECT password_hash FROM lecture_users WHERE id=$1',[user])).rows[0].password_hash
 const oldSession=tokenHash(randomUUID())
 await tx(c=>issueBuyerSessionWithinTransaction(c,user,original,oldSession))
 const temporaryHash=await hashPassword('temporary-password-one')
 await assert.rejects(tx(c=>resetBuyerWithinTransaction({query:async(sql,params)=>{
  if(sql.includes('INSERT INTO lecture_account_recoveries'))throw new Error('injected recovery audit failure')
  return c.query(sql,params)
 }},admin,user,recoveryInput(),temporaryHash)))
 assert.equal((await buyerSession(client,oldSession)).id,user)
 assert.equal((await db.query('SELECT password_hash FROM lecture_users WHERE id=$1',[user])).rows[0].password_hash,original)
 await tx(c=>resetBuyerWithinTransaction(c,admin,user,recoveryInput(),temporaryHash))
 const tempSession=tokenHash(randomUUID())
 await tx(c=>issueBuyerSessionWithinTransaction(c,user,temporaryHash,tempSession))
 const secondHash=await hashPassword('temporary-password-two')
 await tx(c=>resetBuyerWithinTransaction(c,admin,user,recoveryInput(1),secondHash))
 await assert.rejects(buyerSession(client,tempSession,true),e=>e.status===401)
 await assert.rejects(tx(c=>completeBuyerChangeWithinTransaction(c,{id:user,sessionHash:tempSession},'new-very-long-password',secondHash)),e=>e.status===401)
 const saved=(await db.query('SELECT password_hash FROM lecture_users WHERE id=$1',[user])).rows[0].password_hash
 const fresh=tokenHash(randomUUID())
 await tx(c=>issueBuyerSessionWithinTransaction(c,user,saved,fresh))
 await db.query("UPDATE lecture_users SET password_expires_at=now()-interval '1 second' WHERE id=$1",[user])
 await assert.rejects(buyerSession(client,fresh,true),e=>e.status===401)
 await assert.rejects(tx(c=>issueBuyerSessionWithinTransaction(c,user,saved,tokenHash(randomUUID()))),e=>e.status===401)
}))
import { claimBillingWithinTransaction, recordBillingWithinTransaction } from '../.test-build/lib/lectures/billing-queue.js'
function billedDraft(lecture){return {items:[{lectureId:lecture,expectedPriceWon:1000}],requestKey:randomUUID(),expectedTotalWon:1000,billingRecipient:{type:'GUARDIAN',name:'가상 보호자',phone:'01011112222'}}}
async function billed(tx,user,lecture,draft=billedDraft(lecture)){
 return tx(c=>createOrderWithinTransaction(c,user,draft.items.map(i=>i.lectureId),draft.requestKey,draft.expectedTotalWon,0,draft))
}
function report(job,data){return {kind:job.kind,orderId:job.orderId,billId:job.billId,claimToken:job.claimToken,...data}}
async function readJob(db,tx,orderId){await db.query('UPDATE lecture_billing_requests SET next_check_at=now() WHERE order_id=$1',[orderId]);return tx(c=>claimBillingWithinTransaction(c,'READ'))}

test('billing checkout snapshots guardian, prices and one fixed bill; queue failure rolls back the whole order',()=>scenario(async({db,tx,user,lecture})=>{
 const draft=billedDraft(lecture),order=await billed(tx,user,lecture,draft)
 assert.equal((await billed(tx,user,lecture,draft)).id,order.id)
 const bill=(await db.query('SELECT * FROM lecture_billing_requests WHERE order_id=$1',[order.id])).rows[0]
 assert.match(bill.bill_id,/^L[0-9a-f]{19}$/);assert.equal(bill.amount_won,1000)
 assert.equal((await db.query('SELECT recipient_phone FROM lecture_orders WHERE id=$1',[order.id])).rows[0].recipient_phone,'01011112222')
 await assert.rejects(billed(tx,user,lecture,{...draft,billingRecipient:{...draft.billingRecipient,phone:'01033334444'}}),e=>e.status===409)
 assert.equal((await db.query('SELECT count(*)::int AS n FROM lecture_billing_requests')).rows[0].n,1)
 await db.query("UPDATE lecture_orders SET status='CANCELLED' WHERE id=$1",[order.id])
 const fresh=billedDraft(lecture)
 await assert.rejects(tx(c=>createOrderWithinTransaction({query:async(sql,params)=>{
  if(sql.includes('INSERT INTO lecture_billing_requests'))throw new Error('injected queue failure')
  return c.query(sql,params)
 }},user,[lecture],fresh.requestKey,1000,0,fresh)))
 assert.equal((await db.query('SELECT count(*)::int AS n FROM lecture_orders')).rows[0].n,1)
 assert.equal((await db.query('SELECT count(*)::int AS n FROM lecture_order_items')).rows[0].n,1)
}))

test('equal-total price swaps and forged self recipient are rejected before saving',()=>scenario(async({db,tx,user,lecture})=>{
 const second=randomUUID()
 await db.query("INSERT INTO lectures(id,title,price_won,sale_status) VALUES($1,'가격 비교 강의',1000,'ON_SALE')",[second])
 const draft={...billedDraft(lecture),items:[{lectureId:lecture,expectedPriceWon:500},{lectureId:second,expectedPriceWon:1500}],expectedTotalWon:2000}
 await assert.rejects(billed(tx,user,lecture,draft),e=>e.status===409)
 await assert.rejects(billed(tx,user,lecture,{...billedDraft(lecture),billingRecipient:{type:'SELF',name:'다른 이름',phone:'01011112222'}}),e=>e.status===409)
 assert.equal((await db.query('SELECT count(*)::int AS n FROM lecture_orders')).rows[0].n,0)
}))

test('billing send/read lifecycle grants atomically and manual revocation survives repeated F',()=>scenario(async({db,tx,user,lecture,client})=>{
 const order=await billed(tx,user,lecture)
 const send=await tx(c=>claimBillingWithinTransaction(c,'SEND'))
 assert.equal(send.orderId,order.id);assert.equal(send.recipientPhone,'01011112222')
 assert.equal(await tx(c=>claimBillingWithinTransaction(c,'SEND')),null)
 const sent=report(send,{outcome:'SENT'})
 await tx(c=>recordBillingWithinTransaction(c,sent))
 const deadline=(await db.query("SELECT extract(epoch FROM due_at-sent_at)::int AS seconds FROM lecture_billing_requests WHERE order_id=$1",[order.id])).rows[0].seconds
 assert.equal(deadline,7*24*3600)
 await assert.rejects(db.query('UPDATE lecture_billing_requests SET due_at=NULL WHERE order_id=$1',[order.id]))
 assert.equal((await tx(c=>recordBillingWithinTransaction(c,sent))).alreadyApplied,true)
 const read=await readJob(db,tx,order.id),paid=report(read,{state:'F',amountWon:1000,echoedBillId:read.billId})
 await assert.rejects(tx(c=>recordBillingWithinTransaction({query:async(sql,params)=>{
  if(sql.includes('INSERT INTO lecture_billing_events'))throw new Error('injected payment audit failure')
  return c.query(sql,params)
 }},paid)))
 assert.equal((await db.query('SELECT status FROM lecture_orders WHERE id=$1',[order.id])).rows[0].status,'AWAITING_PAYMENT')
 assert.deepEqual(await classroom(user,client),[])
 assert.equal((await tx(c=>recordBillingWithinTransaction(c,paid))).approved,true)
 assert.equal((await tx(c=>recordBillingWithinTransaction(c,paid))).alreadyApplied,true)
 assert.equal((await classroom(user,client)).length,1)
 const cancelled=await readJob(db,tx,order.id)
 await tx(c=>recordBillingWithinTransaction(c,report(cancelled,{state:'C',amountWon:null,echoedBillId:cancelled.billId})))
 assert.equal((await classroom(user,client)).length,1)
 const actor=await administrator(db)
 const version=(await db.query('SELECT version FROM lecture_orders WHERE id=$1',[order.id])).rows[0].version
 await tx(c=>changeAccessWithinTransaction(c,actor,order.id,command('CLOSE',version)))
 const next=await readJob(db,tx,order.id)
 const result=await tx(c=>recordBillingWithinTransaction(c,report(next,{state:'F',amountWon:1000,echoedBillId:next.billId})))
 assert.equal(result.approved,false);assert.equal(result.reviewReason,'PAYMENT_AFTER_MANUAL_CLOSE')
 assert.deepEqual(await classroom(user,client),[])
 assert.equal((await db.query('SELECT status FROM lecture_orders WHERE id=$1',[order.id])).rows[0].status,'PAID')
}))

test('unknown sends never resend; old leases, mismatched amounts and stale reads cannot open lectures',()=>scenario(async({db,tx,user,lecture,client})=>{
 const order=await billed(tx,user,lecture),send=await tx(c=>claimBillingWithinTransaction(c,'SEND'))
 await db.query("UPDATE lecture_billing_requests SET lease_until=now()-interval '1 second' WHERE order_id=$1",[order.id])
 const read=await tx(c=>claimBillingWithinTransaction(c,'READ'))
 await assert.rejects(tx(c=>recordBillingWithinTransaction(c,report(send,{outcome:'SENT'}))),e=>e.status===409)
 await tx(c=>recordBillingWithinTransaction(c,report(read,{state:'F',amountWon:2000,echoedBillId:read.billId})))
 assert.equal(await tx(c=>claimBillingWithinTransaction(c,'SEND')),null)
 assert.deepEqual(await classroom(user,client),[])
 assert.equal((await db.query('SELECT review_reason FROM lecture_billing_requests WHERE order_id=$1',[order.id])).rows[0].review_reason,'AMOUNT_MISMATCH')
 const stale=await readJob(db,tx,order.id),actor=await administrator(db)
 await tx(c=>changeAccessWithinTransaction(c,actor,order.id,command('OPEN',0)))
 const result=await tx(c=>recordBillingWithinTransaction(c,report(stale,{state:'W',amountWon:null,echoedBillId:stale.billId})))
 assert.equal(result.applied,false)
 assert.equal((await classroom(user,client)).length,1)
 assert.equal((await db.query('SELECT access_control FROM lecture_orders WHERE id=$1',[order.id])).rows[0].access_control,'MANUAL_OPEN')
}))

test('deadline waits for a real status: W requires review, C retains access, D expires only unpaid orders',()=>scenario(async({db,tx,user,lecture,client})=>{
 const order=await billed(tx,user,lecture),send=await tx(c=>claimBillingWithinTransaction(c,'SEND'))
 await tx(c=>recordBillingWithinTransaction(c,report(send,{outcome:'SENT'})))
 await db.query("UPDATE lecture_billing_requests SET sent_at=now()-interval '8 days',due_at=now()-interval '1 day' WHERE order_id=$1",[order.id])
 let read=await readJob(db,tx,order.id)
 await tx(c=>recordBillingWithinTransaction(c,report(read,{state:'W',amountWon:null,echoedBillId:read.billId})))
 assert.equal((await db.query('SELECT status FROM lecture_orders WHERE id=$1',[order.id])).rows[0].status,'AWAITING_PAYMENT')
 read=await readJob(db,tx,order.id)
 await tx(c=>recordBillingWithinTransaction(c,report(read,{state:'D',amountWon:null,echoedBillId:read.billId})))
 assert.equal((await db.query('SELECT status FROM lecture_orders WHERE id=$1',[order.id])).rows[0].status,'EXPIRED')
 read=await readJob(db,tx,order.id)
 const late=await tx(c=>recordBillingWithinTransaction(c,report(read,{state:'F',amountWon:1000,echoedBillId:read.billId})))
 assert.equal(late.reviewReason,'LATE_PAYMENT');assert.deepEqual(await classroom(user,client),[])
 const actor=await administrator(db),version=(await db.query('SELECT version FROM lecture_orders WHERE id=$1',[order.id])).rows[0].version
 await tx(c=>changeAccessWithinTransaction(c,actor,order.id,command('OPEN',version)))
 read=await readJob(db,tx,order.id)
 await tx(c=>recordBillingWithinTransaction(c,report(read,{state:'C',amountWon:null,echoedBillId:read.billId})))
 assert.equal((await classroom(user,client)).length,1)
}))

test('manual approval stops a queued bill before any send claim',()=>scenario(async({db,tx,user,lecture})=>{
 const order=await billed(tx,user,lecture),actor=await administrator(db)
 await tx(c=>changeAccessWithinTransaction(c,actor,order.id,command('OPEN')))
 assert.equal((await db.query('SELECT state FROM lecture_billing_requests WHERE order_id=$1',[order.id])).rows[0].state,'STOPPED')
 assert.equal(await tx(c=>claimBillingWithinTransaction(c,'SEND')),null)
}))

test('an unresolved external cancellation stays in review even after another F result',()=>scenario(async({db,tx,user,lecture,client})=>{
 const order=await billed(tx,user,lecture),send=await tx(c=>claimBillingWithinTransaction(c,'SEND'))
 await tx(c=>recordBillingWithinTransaction(c,report(send,{outcome:'SENT'})))
 let read=await readJob(db,tx,order.id)
 await tx(c=>recordBillingWithinTransaction(c,report(read,{state:'C',amountWon:null,echoedBillId:read.billId})))
 read=await readJob(db,tx,order.id)
 const paid=await tx(c=>recordBillingWithinTransaction(c,report(read,{state:'F',amountWon:1000,echoedBillId:read.billId})))
 assert.equal(paid.reviewReason,'EXTERNAL_CANCEL');assert.equal(paid.approved,false)
 assert.deepEqual(await classroom(user,client),[])
 const admin=await administrator(db)
 await tx(c=>changeAccessWithinTransaction(c,admin,order.id,command('OPEN',1)))
 assert.equal((await classroom(user,client)).length,1)
 assert.equal((await db.query('SELECT needs_review FROM lecture_billing_requests WHERE order_id=$1',[order.id])).rows[0].needs_review,false)
}))

import { ADMIN_ORDERS_SQL } from '../.test-build/lib/lectures/admin-order-query.js'
test('admin order listing searches the fixed bill and returns recipient/status without worker secrets',()=>scenario(async({db,tx,user,lecture,client})=>{
 const order=await billed(tx,user,lecture)
 const bill=(await db.query('SELECT bill_id FROM lecture_billing_requests WHERE order_id=$1',[order.id])).rows[0].bill_id
 const response=await client.query(ADMIN_ORDERS_SQL,[['CREATED','AWAITING_PAYMENT','PAID','CANCELLED','EXPIRED','REFUNDED'],bill,'',20,0,false])
 assert.equal(response.rows[0].total,1)
 const listed=response.rows[0].orders[0]
 assert.equal(listed.id,order.id);assert.equal(listed.bill_id,bill)
 assert.equal(listed.recipient_phone,'01011112222')
 assert.equal('lease_hash' in listed,false);assert.equal('request_hash' in listed,false)
}))
import { refreshBillingWithinTransaction } from '../.test-build/lib/lectures/admin-billing.js'
async function sentOrder(db,tx,user,lecture){
 const order=await billed(tx,user,lecture),send=await tx(c=>claimBillingWithinTransaction(c,'SEND'))
 await tx(c=>recordBillingWithinTransaction(c,report(send,{outcome:'SENT'})))
 return order
}
async function orderVersion(db,id){return (await db.query('SELECT version FROM lecture_orders WHERE id=$1',[id])).rows[0].version}
function refreshInput(version){return {expectedVersion:version,requestKey:randomUUID()}}

test('administrator refresh is idempotent, audited and completed by a real worker result',()=>scenario(async({db,tx,user,lecture})=>{
 const order=await sentOrder(db,tx,user,lecture),admin=await administrator(db)
 const input=refreshInput(await orderVersion(db,order.id))
 const scheduled=await tx(c=>refreshBillingWithinTransaction(c,admin,order.id,input))
 assert.equal((await tx(c=>refreshBillingWithinTransaction(c,admin,order.id,input))).id,scheduled.id)
 assert.equal((await db.query('SELECT refresh_sequence FROM lecture_billing_requests WHERE order_id=$1',[order.id])).rows[0].refresh_sequence,1)
 await assert.rejects(tx(c=>refreshBillingWithinTransaction(c,admin,order.id,{...input,expectedVersion:99})),e=>e.status===409)
 const read=await tx(c=>claimBillingWithinTransaction(c,'READ'))
 await tx(c=>recordBillingWithinTransaction(c,report(read,{state:'W',amountWon:null,echoedBillId:read.billId})))
 const audit=(await db.query('SELECT admin_id,completed_at,result_event_id FROM lecture_billing_refreshes WHERE id=$1',[scheduled.id])).rows[0]
 assert.equal(audit.admin_id,admin.id);assert.ok(audit.completed_at);assert.ok(audit.result_event_id)
 assert.equal((await tx(c=>refreshBillingWithinTransaction(c,admin,order.id,input))).completed,true)
}))

test('refresh requested during a read waits for the next read instead of consuming the older result',()=>scenario(async({db,tx,user,lecture})=>{
 const order=await sentOrder(db,tx,user,lecture),admin=await administrator(db)
 const oldRead=await tx(c=>claimBillingWithinTransaction(c,'READ'))
 const beforeRefresh=await orderVersion(db,order.id)
 const refresh=await tx(c=>refreshBillingWithinTransaction(c,admin,order.id,refreshInput(beforeRefresh)))
 await tx(c=>recordBillingWithinTransaction(c,report(oldRead,{state:'W',amountWon:null,echoedBillId:oldRead.billId})))
 assert.equal((await db.query('SELECT completed_at FROM lecture_billing_refreshes WHERE id=$1',[refresh.id])).rows[0].completed_at,null)
 const next=await tx(c=>claimBillingWithinTransaction(c,'READ'))
 assert.ok(next)
 await tx(c=>recordBillingWithinTransaction(c,report(next,{state:'ERROR',amountWon:null,echoedBillId:null})))
 assert.ok((await db.query('SELECT completed_at FROM lecture_billing_refreshes WHERE id=$1',[refresh.id])).rows[0].completed_at)
 assert.equal((await db.query('SELECT review_reason FROM lecture_billing_requests WHERE order_id=$1',[order.id])).rows[0].review_reason,'LOOKUP_ERROR')
}))

test('automatic resume requires a post-manual fresh F and explicitly restores closed access',()=>scenario(async({db,tx,user,lecture,client})=>{
 const order=await sentOrder(db,tx,user,lecture),admin=await administrator(db)
 let read=await readJob(db,tx,order.id)
 await tx(c=>recordBillingWithinTransaction(c,report(read,{state:'F',amountWon:1000,echoedBillId:read.billId})))
 const currentVersion=await orderVersion(db,order.id)
 await tx(c=>changeAccessWithinTransaction(c,admin,order.id,command('CLOSE',currentVersion)))
 const version=await orderVersion(db,order.id)
 // The old F before manual close must not count as proof for reopening.
 await assert.rejects(tx(c=>changeAccessWithinTransaction(c,admin,order.id,command('RESUME_AUTO',version))),e=>e.code==='FRESH_PAYMENT_LOOKUP_REQUIRED')
 const requested=await tx(c=>refreshBillingWithinTransaction(c,admin,order.id,refreshInput(version)))
 read=await tx(c=>claimBillingWithinTransaction(c,'READ'))
 await assert.rejects(tx(c=>changeAccessWithinTransaction(c,admin,order.id,command('RESUME_AUTO',version))),e=>e.status===409)
 await tx(c=>recordBillingWithinTransaction(c,report(read,{state:'F',amountWon:1000,echoedBillId:read.billId})))
 assert.ok((await db.query('SELECT completed_at FROM lecture_billing_refreshes WHERE id=$1',[requested.id])).rows[0].completed_at)
 assert.deepEqual(await classroom(user,client),[])
 const listing=await client.query(ADMIN_ORDERS_SQL,[['PAID'],'','',20,0,false])
 assert.equal(listing.rows[0].orders[0].can_resume_auto,true)
 const sourceEvent=(await db.query('SELECT checked_event_id FROM lecture_billing_requests WHERE order_id=$1',[order.id])).rows[0].checked_event_id
 const resume=command('RESUME_AUTO',version)
 const result=await tx(c=>changeAccessWithinTransaction(c,admin,order.id,resume))
 assert.equal(result.verificationEventId,sourceEvent)
 assert.equal((await db.query("SELECT after_state FROM lecture_admin_actions WHERE order_id=$1 AND action='RESUME_AUTO'",[order.id])).rows[0].after_state.verificationEventId,sourceEvent)
 assert.equal(result.access_control,'AUTO');assert.equal((await classroom(user,client)).length,1)
 assert.equal((await tx(c=>changeAccessWithinTransaction(c,admin,order.id,resume))).alreadyApplied,true)
 assert.equal((await db.query("SELECT count(*)::int AS n FROM lecture_admin_actions WHERE action='RESUME_AUTO'")).rows[0].n,1)
}))

test('failed, mismatched, expired or superseded readings cannot release manual protection',()=>scenario(async({db,tx,user,lecture,client})=>{
 const order=await sentOrder(db,tx,user,lecture),admin=await administrator(db)
 let currentVersion=await orderVersion(db,order.id)
 await tx(c=>changeAccessWithinTransaction(c,admin,order.id,command('OPEN',currentVersion)))
 const version=await orderVersion(db,order.id)
 for(const data of [{state:'ERROR',amountWon:null,echoedBillId:null},{state:'F',amountWon:1000,echoedBillId:'wrong'},{state:'F',amountWon:2000,echoedBillId:null}]){
  const read=await readJob(db,tx,order.id)
  await tx(c=>recordBillingWithinTransaction(c,report(read,data)))
  await assert.rejects(tx(c=>changeAccessWithinTransaction(c,admin,order.id,command('RESUME_AUTO',version))),e=>e.status===409)
 }
 let read=await readJob(db,tx,order.id)
 await tx(c=>recordBillingWithinTransaction(c,report(read,{state:'F',amountWon:1000,echoedBillId:read.billId})))
 await db.query("UPDATE lecture_billing_requests SET checked_at=now()-interval '6 minutes' WHERE order_id=$1",[order.id])
 await assert.rejects(tx(c=>changeAccessWithinTransaction(c,admin,order.id,command('RESUME_AUTO',version))),e=>e.status===409)
 read=await readJob(db,tx,order.id)
 await tx(c=>recordBillingWithinTransaction(c,report(read,{state:'F',amountWon:1000,echoedBillId:read.billId})))
 const stale=await readJob(db,tx,order.id)
 await db.query("UPDATE lecture_billing_requests SET lease_until=now()-interval '1 second' WHERE order_id=$1",[order.id])
 await tx(c=>recordBillingWithinTransaction(c,report(stale,{state:'F',amountWon:1000,echoedBillId:stale.billId})))
 await assert.rejects(tx(c=>changeAccessWithinTransaction(c,admin,order.id,command('RESUME_AUTO',version))),e=>e.status===409)
 assert.equal((await db.query('SELECT access_control FROM lecture_orders WHERE id=$1',[order.id])).rows[0].access_control,'MANUAL_OPEN')
 assert.equal((await classroom(user,client)).length,1)
}))

test('refresh and resume audit failures roll back scheduling and reopening',()=>scenario(async({db,tx,user,lecture,client})=>{
 const order=await sentOrder(db,tx,user,lecture),admin=await administrator(db)
 await assert.rejects(tx(c=>refreshBillingWithinTransaction({query:async(sql,params)=>{
  if(sql.includes('INSERT INTO lecture_billing_refreshes'))throw new Error('injected refresh audit failure')
  return c.query(sql,params)
 }},admin,order.id,refreshInput(1))))
 assert.equal((await db.query('SELECT refresh_sequence FROM lecture_billing_requests WHERE order_id=$1',[order.id])).rows[0].refresh_sequence,0)
 let currentVersion=await orderVersion(db,order.id)
 await tx(c=>changeAccessWithinTransaction(c,admin,order.id,command('OPEN',currentVersion)))
 currentVersion=await orderVersion(db,order.id)
 await tx(c=>changeAccessWithinTransaction(c,admin,order.id,command('CLOSE',currentVersion)))
 const version=await orderVersion(db,order.id),read=await readJob(db,tx,order.id)
 await tx(c=>recordBillingWithinTransaction(c,report(read,{state:'F',amountWon:1000,echoedBillId:read.billId})))
 await assert.rejects(tx(c=>changeAccessWithinTransaction({query:async(sql,params)=>{
  if(sql.includes('INSERT INTO lecture_admin_actions'))throw new Error('injected resume audit failure')
  return c.query(sql,params)
 }},admin,order.id,command('RESUME_AUTO',version))))
 assert.deepEqual(await classroom(user,client),[])
 assert.equal((await db.query('SELECT access_control FROM lecture_orders WHERE id=$1',[order.id])).rows[0].access_control,'MANUAL_CLOSED')
}))
test('administrator refresh is claimed before overdue routine polling',()=>scenario(async({db,tx,user,other,lecture})=>{
 const routine=await sentOrder(db,tx,user,lecture)
 const urgent=await sentOrder(db,tx,other,lecture),admin=await administrator(db)
 await db.query("UPDATE lecture_billing_requests SET next_check_at=now()-interval '1 hour' WHERE order_id=$1",[routine.id])
 const version=await orderVersion(db,urgent.id)
 await tx(c=>refreshBillingWithinTransaction(c,admin,urgent.id,refreshInput(version)))
 const claimed=await tx(c=>claimBillingWithinTransaction(c,'READ'))
 assert.equal(claimed.orderId,urgent.id)
}))
import { createLectureWithinTransaction,updateLectureWithinTransaction } from '../.test-build/lib/lectures/catalog-admin.js'
import { buyerOrders,buyerOrderPage } from '../.test-build/lib/lectures/buyer-order-query.js'
function lectureEdit(changes={}){return {title:'가상 새 강의',description:'가상 강의 설명',price_won:1000,sale_status:'ON_SALE',video_url:'https://youtu.be/abcdefghijk',...changes}}

test('catalog edits reject stale writers and audit the real actor without changing old order prices',()=>scenario(async({db,tx,user,lecture})=>{
 const first=await administrator(db,'OWNER','catalog_owner'),second=await administrator(db,'OPERATOR','catalog_operator')
 const order=await tx(c=>createOrderWithinTransaction(c,user,[lecture],randomUUID(),1000))
 const updated=await tx(c=>updateLectureWithinTransaction(c,first,lecture,lectureEdit({expectedVersion:0,price_won:2000})))
 assert.equal(updated.version,1)
 await assert.rejects(tx(c=>updateLectureWithinTransaction(c,second,lecture,lectureEdit({expectedVersion:0,title:'덮어쓰면 안 되는 내용'}))),e=>e.status===409&&e.code==='LECTURE_VERSION_CONFLICT')
 const saved=(await db.query('SELECT title,price_won,version FROM lectures WHERE id=$1',[lecture])).rows[0]
 assert.equal(saved.title,'가상 새 강의');assert.equal(saved.price_won,2000);assert.equal(saved.version,1)
 const history=(await db.query('SELECT admin_id,before_state,after_state FROM lecture_catalog_changes WHERE lecture_id=$1',[lecture])).rows
 assert.equal(history.length,1);assert.equal(history[0].admin_id,first.id)
 assert.equal(history[0].before_state.price_won,1000);assert.equal(history[0].after_state.price_won,2000)
 assert.equal((await db.query('SELECT price_won FROM lecture_order_items WHERE order_id=$1',[order.id])).rows[0].price_won,1000)
}))

test('catalog audit failure rolls back create and update; disabled admin cannot edit',()=>scenario(async({db,tx,lecture})=>{
 const admin=await administrator(db)
 const failing=c=>({query:async(sql,params)=>{if(sql.includes('INSERT INTO lecture_catalog_changes'))throw new Error('injected catalog audit failure');return c.query(sql,params)}})
 await assert.rejects(tx(c=>createLectureWithinTransaction(failing(c),admin,lectureEdit())))
 assert.equal((await db.query('SELECT count(*)::int AS n FROM lectures')).rows[0].n,1)
 await assert.rejects(tx(c=>updateLectureWithinTransaction(failing(c),admin,lecture,lectureEdit({expectedVersion:0}))))
 assert.equal((await db.query('SELECT version FROM lectures WHERE id=$1',[lecture])).rows[0].version,0)
 const created=await tx(c=>createLectureWithinTransaction(c,admin,lectureEdit({video_url:'',sale_status:'DRAFT'})))
 assert.equal(created.video_url,null);assert.equal(created.version,0)
 assert.equal((await db.query("SELECT action FROM lecture_catalog_changes WHERE lecture_id=$1",[created.id])).rows[0].action,'CREATE')
 await db.query('UPDATE lecture_admin_users SET disabled_at=now() WHERE id=$1',[admin.id])
 await assert.rejects(tx(c=>updateLectureWithinTransaction(c,admin,lecture,lectureEdit({expectedVersion:0}))),e=>e.status===401)
}))

test('buyer order pages include records past 100 with deterministic ties and exclude other buyers',()=>scenario(async({db,client,user,other})=>{
 const ids=[]
 for(let i=0;i<147;i++){const id=randomUUID();ids.push(id);await db.query("INSERT INTO lecture_orders(id,user_id,request_key,total_won,created_at) VALUES($1,$2,$3,1000,'2026-01-01T00:00:00Z')",[id,user,randomUUID()])}
 await db.query("INSERT INTO lecture_orders(id,user_id,request_key,total_won,created_at) VALUES($1,$2,$3,1000,'2026-01-01T00:00:00Z')",[randomUUID(),other,randomUUID()])
 const all=[]
 for(let page=1;page<=8;page++){const result=await buyerOrders(client,user,page);assert.equal(result.total,147);assert.equal(result.page,page);assert.equal(result.pageSize,20);all.push(...result.orders.map(o=>o.id))}
 assert.deepEqual(all,ids.sort().reverse());assert.equal(new Set(all).size,147)
 assert.equal((await buyerOrders(client,other,1)).orders.length,1)
 assert.deepEqual((await buyerOrders(client,user,100)).orders,[])
 assert.equal(buyerOrderPage(new URLSearchParams()),1)
 await assert.rejects(buyerOrders(client,user,0))
}))
