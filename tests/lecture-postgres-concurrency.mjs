import {test} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readFileSync,readdirSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {join} from 'node:path'
import {setTimeout as delay} from 'node:timers/promises'
import {postgresFixture} from './lecture-postgres-fixture.mjs'
import {hashPassword,tokenHash} from '../.test-build/lib/lectures/security.js'
import {updateLectureWithinTransaction} from '../.test-build/lib/lectures/catalog-admin.js'
import {claimBillingWithinTransaction} from '../.test-build/lib/lectures/billing-queue.js'
import {manageAccountWithinTransaction} from '../.test-build/lib/lectures/admin-accounts.js'
const url=process.env.LECTURES_TEST_POSTGRES_URL
async function fixture(run){
 const db=await postgresFixture(url),clients=[]
 try{
  const directory=fileURLToPath(new URL('../db/lectures',import.meta.url))
  for(const file of readdirSync(directory).filter(f=>/^\d{3}_.*\.sql$/.test(f)).sort())await db.exec(readFileSync(join(directory,file),'utf8'))
  const hash=await hashPassword('fake-owner-password'),actors=[]
  for(let i=0;i<2;i++){const id=randomUUID(),sessionHash=tokenHash(randomUUID());await db.query("INSERT INTO lecture_admin_users(id,username,name,role,password_hash) VALUES($1,$2,'가상 관리자','OWNER',$3)",[id,'owner_'+i,hash]);await db.query("INSERT INTO lecture_admin_sessions(token_hash,admin_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",[sessionHash,id]);actors.push({id,sessionHash})}
  const lecture=randomUUID(),buyer=randomUUID()
  await db.query("INSERT INTO lectures(id,title,price_won,sale_status) VALUES($1,'가상 강의',1000,'ON_SALE')",[lecture])
  await db.query("INSERT INTO lecture_users(id,username,name,phone,password_hash) VALUES($1,'fake_buyer','가상 구매자','01011112222',$2)",[buyer,hash])
  const a=await db.connect(),b=await db.connect();clients.push(a,b)
  await run({db,a,b,actors,lecture,buyer})
 }finally{
  for(const c of clients){await c.query('ROLLBACK').catch(()=>{});await c.end()}
  await db.close()
 }
}
async function waitForLock(db,pid){
 const until=Date.now()+5000
 while(Date.now()<until){const r=await db.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[pid]);if(r.rows[0]?.wait_event_type==='Lock')return;await delay(20)}
 throw new Error('Expected the second database connection to wait on the first transaction')
}
test('PostgreSQL: concurrent lecture editors cannot overwrite the first commit',{skip:!url},()=>fixture(async({db,a,b,actors,lecture})=>{
 await a.query('BEGIN');await b.query('BEGIN')
 const input={title:'첫 관리자 변경',description:'',price_won:1200,sale_status:'ON_SALE',video_url:'',expectedVersion:0}
 await updateLectureWithinTransaction(a,actors[0],lecture,input)
 const pid=(await b.query('SELECT pg_backend_pid() AS id')).rows[0].id
 const waiting=updateLectureWithinTransaction(b,actors[1],lecture,{...input,title:'나중 관리자 변경'}).then(value=>({value}),error=>({error}))
 await waitForLock(db,pid);await a.query('COMMIT')
 const result=await waiting;assert.equal(result.error?.status,409);await b.query('ROLLBACK')
 assert.equal((await db.query('SELECT title FROM lectures WHERE id=$1',[lecture])).rows[0].title,input.title)
 assert.equal((await db.query('SELECT count(*)::int AS n FROM lecture_catalog_changes')).rows[0].n,1)
}))
test('PostgreSQL: two workers cannot claim the same send',{skip:!url},()=>fixture(async({db,a,b,lecture,buyer})=>{
 const order=randomUUID()
 await db.query("INSERT INTO lecture_orders(id,user_id,request_key,total_won,request_hash,recipient_type,recipient_name,recipient_phone) VALUES($1,$2,$3,1000,$4,'SELF','가상 구매자','01011112222')",[order,buyer,randomUUID(),'a'.repeat(64)])
 await db.query('INSERT INTO lecture_order_items(id,order_id,lecture_id,title_snapshot,price_won) VALUES($1,$2,$3,$4,1000)',[randomUUID(),order,lecture,'가상 강의'])
 await db.query('INSERT INTO lecture_billing_requests(order_id,bill_id,amount_won) VALUES($1,$2,1000)',[order,'L'+'b'.repeat(19)])
 await a.query('BEGIN');await b.query('BEGIN')
 assert.equal((await claimBillingWithinTransaction(a,'SEND')).orderId,order)
 assert.equal(await claimBillingWithinTransaction(b,'SEND'),null)
 await b.query('COMMIT');await a.query('COMMIT')
 assert.equal((await db.query('SELECT state FROM lecture_billing_requests WHERE order_id=$1',[order])).rows[0].state,'SENDING')
}))
test('PostgreSQL: simultaneous owner demotions retain the last active owner',{skip:!url},()=>fixture(async({db,a,b,actors})=>{
 await a.query('BEGIN');await b.query('BEGIN')
 await manageAccountWithinTransaction(a,actors[0],{action:'UPDATE',id:actors[0].id,role:'OPERATOR',disabled:false,expectedVersion:0})
 const pid=(await b.query('SELECT pg_backend_pid() AS id')).rows[0].id
 const waiting=manageAccountWithinTransaction(b,actors[1],{action:'UPDATE',id:actors[1].id,role:'OPERATOR',disabled:false,expectedVersion:0}).then(value=>({value}),error=>({error}))
 await waitForLock(db,pid);await a.query('COMMIT')
 assert.equal((await waiting).error?.status,409);await b.query('ROLLBACK')
 assert.equal((await db.query("SELECT count(*)::int AS n FROM lecture_admin_users WHERE role='OWNER' AND disabled_at IS NULL")).rows[0].n,1)
}))
