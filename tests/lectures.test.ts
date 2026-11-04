import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hashPassword, verifyPassword, newSession, tokenHash } from '../lib/lectures/security'
import { credentials, registration, orderInput } from '../lib/lectures/input'
import { lectureEditor, youtubeUrl } from '../lib/lectures/catalog-input'
import { orderStatus } from '../lib/lectures/order-status'
import { hasLectureAccess, playableVideo, type AccessEvidence } from '../lib/lectures/access-policy'
import { payssamClient, PaySsamError, type PaySsamConfig, type VerifiedReceipt } from '../lib/lectures/payssam'
import { paymentTransition } from '../lib/lectures/payment-policy'
import { manualConfirmation, mayManuallyConfirm, manualRevocation, mayRevokeManualConfirmation } from '../lib/lectures/manual-input'
import { acceptsLectureOrigin } from '../lib/lectures/origin-policy'

test('lecture mutations accept only explicitly configured site origins, regardless of proxy headers', () => {
  const request = (origin?: string) => new Request('http://localhost:8080/api/lectures/orders', {
    headers: { host: 'attacker.example', 'x-forwarded-host': 'www.pkjmath.com', ...(origin === undefined ? {} : {origin}) },
  })
  const primary = {primary:'https://pkjmath.com'}
  const aliases = {...primary,additional:'https://www.pkjmath.com'}
  assert.equal(acceptsLectureOrigin(request('https://pkjmath.com'), primary), true)
  assert.equal(acceptsLectureOrigin(request('https://pkjmath.com'), {...primary,additional:''}), true)
  assert.equal(acceptsLectureOrigin(request('https://www.pkjmath.com'), primary), false)
  assert.equal(acceptsLectureOrigin(request('https://www.pkjmath.com'), aliases), true)
  for (const origin of [undefined, 'null', 'https://attacker.example', 'https://pkjmath.com.attacker.example', 'http://pkjmath.com', 'https://www.pkjmath.com:8443', 'https://pkjmath.com/path', 'https://user@pkjmath.com']) {
    assert.equal(acceptsLectureOrigin(request(origin), aliases), false)
  }
  for (const additional of ['*', 'https://www.pkjmath.com/', 'https://www.pkjmath.com/path', 'https://www.pkjmath.com,', 'https://www.pkjmath.com?x=1']) {
    assert.equal(acceptsLectureOrigin(request('https://pkjmath.com'), {...primary,additional}), false)
  }
  assert.equal(acceptsLectureOrigin(request('https://www.pkjmath.com'), {additional:aliases.additional}), false)
  const local = new Request('http://localhost:3100/api/lectures/orders', {headers:{host:'127.0.0.1:3100',origin:'http://127.0.0.1:3100'}})
  assert.equal(acceptsLectureOrigin(local, {}), true)
  assert.equal(acceptsLectureOrigin(local, primary), false)
})

test('approval corrections require an explicit correction flag and a manual paid source', () => {
  const input = { expectedTotalWon: 1000, operatorName: '관리자', note: '잘못된 승인 정정', confirmed: true, correctionOnly: true }
  assert.equal(manualRevocation.safeParse(input).success,true)
  assert.equal(manualRevocation.safeParse({ ...input, correctionOnly: false }).success,false)
  assert.equal(manualRevocation.safeParse({ ...input, confirmed: false }).success,false)
  assert.equal(mayRevokeManualConfirmation('PAID',true),true)
  assert.equal(mayRevokeManualConfirmation('PAID',false),false)
  for (const state of ['CREATED','CANCELLED','REFUNDED','EXPIRED']) assert.equal(mayRevokeManualConfirmation(state,true),false)
})
import { parseAdminOrderQuery } from '../lib/lectures/admin-order-query'

test('admin order search has bounded pages and literal, trimmed search text', () => {
  assert.deepEqual(parseAdminOrderQuery(new URLSearchParams()), { status: 'pending', q: '', page: 1 })
  assert.deepEqual(parseAdminOrderQuery(new URLSearchParams({ status: 'paid', q: "  %_' OR 1=1  ", page: '3' })), { status: 'paid', q: "%_' OR 1=1", page: 3 })
  for (const page of ['0','-1','1.5','NaN','100001','Infinity','']) assert.throws(() => parseAdminOrderQuery(new URLSearchParams({ page })))
  assert.throws(() => parseAdminOrderQuery(new URLSearchParams({ status: 'unknown' })))
  assert.throws(() => parseAdminOrderQuery(new URLSearchParams({ q: '가'.repeat(101) })))
})

test('manual approvals require explicit confirmation, evidence and an exact integral amount', () => {
  const valid = { expectedTotalWon: 20000, operatorName: '확인자', note: '청구서 납부 확인', confirmed: true }
  assert.equal(manualConfirmation.safeParse(valid).success, true)
  for (const change of [{ confirmed: false }, { confirmed: undefined }, { note: '' }, { operatorName: ' ' }, { expectedTotalWon: 0 }, { expectedTotalWon: 1.5 }, { status: 'PAID' }]) assert.equal(manualConfirmation.safeParse({ ...valid, ...change }).success, false)
  for (const state of ['CREATED','AWAITING_PAYMENT']) assert.equal(mayManuallyConfirm(state), true)
  for (const state of ['PAID','REFUNDED','CANCELLED','EXPIRED','UNKNOWN']) assert.equal(mayManuallyConfirm(state), false)
})
import { createHash } from 'node:crypto'

const config: PaySsamConfig = { apiKey: 'test-only', member: 'test-member', merchant: 'test-merchant', baseUrl: 'https://sandbox.paymint.co.kr/partner', callbackUrl: 'https://example.invalid/callback', enabled: true }
const mockTransport = (data: unknown): typeof fetch => async () => new Response(JSON.stringify({ code: '0000', data }))
test('provider calls are disabled by default configuration and never retry unknown sends', async () => {
  let calls = 0
  const transport: typeof fetch = async () => { calls++; throw new Error('timeout with sensitive payload') }
  const input = { billId: 'test-bill', amountWon: 20000, name: '가상회원', phone: '01012345678', productName: '테스트 강의' }
  await assert.rejects(payssamClient({ ...config, enabled: false }, transport).send(input), (e: unknown) => e instanceof PaySsamError && e.kind === 'DISABLED')
  assert.equal(calls, 0)
  await assert.rejects(payssamClient(config, transport).send(input), (e: unknown) => e instanceof PaySsamError && e.kind === 'UNKNOWN' && !e.message.includes('sensitive'))
  assert.equal(calls, 1)
})
test('V2 bill request uses exact price and validates echoed identity', async () => {
  const transport: typeof fetch = async (url, options) => {
    assert.equal(url, 'https://sandbox.paymint.co.kr/partner/bill')
    const request = JSON.parse(String(options?.body))
    assert.equal(request.bill.price, '20000'); assert.equal(request.bill.sendType, 'TALK')
    assert.equal(request.bill.hash, createHash('sha256').update('test-bill,01012345678,20000').digest('hex'))
    return new Response(JSON.stringify({ code: '0000', data: { ...request, billId: request.bill.billId, hash: request.bill.hash } }))
  }
  assert.deepEqual(await payssamClient(config, transport).send({ billId: 'test-bill', amountWon: 20000, name: '가상회원', phone: '01012345678', productName: '테스트 강의' }), { billId: 'test-bill' })
})
test('only verified exact provider readings can advance orders', async () => {
  const data = { apiKey: config.apiKey, billId: 'test-bill', apprPrice: '20000', apprState: 'F' }
  const receipt = await payssamClient(config, mockTransport(data)).read('test-bill')
  assert.equal(paymentTransition('CREATED', receipt, 'test-bill', 20000), 'PAID')
  assert.equal(paymentTransition('PAID', receipt, 'test-bill', 20000), 'PAID')
  assert.throws(() => paymentTransition('CREATED', receipt, 'other-bill', 20000))
  assert.throws(() => paymentTransition('CREATED', receipt, 'test-bill', 10000))
  assert.throws(() => paymentTransition('REFUNDED', receipt, 'test-bill', 20000))
  assert.throws(() => paymentTransition('CREATED', JSON.parse(JSON.stringify(receipt)) as VerifiedReceipt, 'test-bill', 20000))
  const pending = await payssamClient(config, mockTransport({ ...data, apprState: 'W' })).read('test-bill')
  assert.throws(() => paymentTransition('PAID', pending, 'test-bill', 20000))
  for (const invalid of [{ ...data, apiKey: 'wrong' }, { ...data, billId: 'wrong' }, { ...data, apprPrice: '20000.5' }]) await assert.rejects(payssamClient(config, mockTransport(invalid)).read('test-bill'))
})

test('lecture access requires an active paid purchase belonging to the same buyer and lecture', () => {
  const proof: AccessEvidence = { user_id: 'a', lecture_id: 'one', order_user_id: 'a', item_lecture_id: 'one', revoked_at: null, order_status: 'PAID' }
  assert.equal(hasLectureAccess('a', 'one', [proof]), true)
  assert.equal(hasLectureAccess('b', 'one', [proof]), false)
  assert.equal(hasLectureAccess('a', 'two', [proof]), false)
  assert.equal(hasLectureAccess('a', 'one', []), false)
  for (const change of [{ revoked_at: '2026-11-03' }, { order_user_id: 'b' }, { item_lecture_id: 'two' }, ...['CREATED','AWAITING_PAYMENT','REFUNDED','CANCELLED','EXPIRED','UNKNOWN'].map(order_status => ({ order_status }))]) {
    assert.equal(hasLectureAccess('a', 'one', [{ ...proof, ...change }]), false)
  }
  assert.equal(hasLectureAccess('a', 'one', [{ ...proof, revoked_at: '2026-11-03' }, proof]), true)
})
test('unavailable or unsafe videos never produce a playable destination', () => {
  for (const value of [null, '', 'javascript:alert(1)', 'https://evil.test/']) assert.equal(playableVideo(value), null)
  assert.equal(playableVideo('https://youtu.be/abcdefghijk'), 'https://www.youtube.com/watch?v=abcdefghijk')
})

test('unknown and pending order states never appear as paid', () => {
  assert.equal(orderStatus('PAID').label, '결제 완료')
  for (const state of ['CREATED','AWAITING_PAYMENT','CANCELLED','REFUNDED','unexpected']) assert.notEqual(orderStatus(state).label, '결제 완료')
})

test('video addresses reject scripts, lookalike domains and embedded credentials', () => {
  for (const url of ['javascript:alert(1)', 'http://youtu.be/abcdefghijk', 'https://youtube.com.evil.test/watch?v=abcdefghijk', 'https://evil.test', 'https://user:pass@youtube.com/watch?v=abcdefghijk']) assert.equal(youtubeUrl(url), undefined)
  assert.equal(youtubeUrl('https://youtu.be/abcdefghijk?t=10'), 'https://www.youtube.com/watch?v=abcdefghijk')
  assert.equal(youtubeUrl('https://www.youtube.com/shorts/abcdefghijk'), 'https://www.youtube.com/watch?v=abcdefghijk')
  assert.equal(youtubeUrl(''), null)
})
test('catalog edits require positive integral prices and known states', () => {
  const input = { title: '강의', description: '', price_won: 1000, sale_status: 'DRAFT', video_url: '' }
  assert.equal(lectureEditor.parse(input).video_url, null)
  for (const price_won of [0,-1,1.5,2147483648]) assert.equal(lectureEditor.safeParse({ ...input, price_won }).success, false)
  assert.equal(lectureEditor.safeParse({ ...input, sale_status: 'PAID' }).success, false)
  assert.equal(lectureEditor.safeParse({ ...input, id: 'cannot-overwrite-id' }).success, false)
})

test('password hashes use independent salts and reject wrong passwords', async () => {
  const a = await hashPassword('correct-password')
  const b = await hashPassword('correct-password')
  assert.notEqual(a, b)
  assert.equal(await verifyPassword('correct-password', a), true)
  assert.equal(await verifyPassword('wrong-password', a), false)
  assert.equal(await verifyPassword('correct-password', 'broken'), false)
})
test('session tokens are random and only their digest is stored', () => {
  const a = newSession(); const b = newSession()
  assert.notEqual(a, b); assert.equal(a.length, 64)
  assert.notEqual(tokenHash(a), a); assert.equal(tokenHash(a), tokenHash(a))
})
test('usernames normalize consistently and passwords are bounded', () => {
  assert.equal(credentials.parse({ username: ' Test_USER ', password: '1234567890' }).username, 'test_user')
  assert.equal(credentials.safeParse({ username: 'abcd', password: 'short' }).success, false)
  assert.equal(credentials.safeParse({ username: 'abcd', password: 'x'.repeat(129) }).success, false)
})
test('registration rejects missing or invalid contact information', () => {
  const body = { username: 'student', password: '1234567890', name: '학생', phone: '010-1234-5678' }
  assert.equal(registration.parse(body).phone, '01012345678')
  assert.equal(registration.safeParse({ ...body, phone: '123' }).success, false)
})
test('orders require recipient and individual prices; reject duplicates and the old contract', () => {
  const id = '20d5c80c-3043-4871-8f1e-5c0c1ed812a0'
  const valid={items:[{lectureId:id,expectedPriceWon:1000}],requestKey:id,expectedTotalWon:1000,billingRecipient:{type:'SELF',name:'가상 구매자',phone:'010-1234-5678'}}
  assert.equal(orderInput.parse(valid).billingRecipient.phone,'01012345678')
  for (const expectedTotalWon of [undefined,0,-1,1.5]) assert.equal(orderInput.safeParse({...valid,expectedTotalWon}).success,false)
  for (const items of [[],[valid.items[0],valid.items[0]],[{lectureId:'invalid',expectedPriceWon:1000}],[{lectureId:id,expectedPriceWon:undefined}]]) assert.equal(orderInput.safeParse({...valid,items}).success,false)
  assert.equal(orderInput.safeParse({...valid,requestKey:'invalid'}).success,false)
  assert.equal(orderInput.safeParse({...valid,billingRecipient:undefined}).success,false)
  assert.equal(orderInput.safeParse({lectureIds:[id],requestKey:id,expectedTotalWon:1000}).success,false)
})

import { requireWorker } from '../lib/lectures/worker-auth'
test('billing worker uses a separate machine credential and is disabled by default',()=>{
 const enabled=process.env.LECTURES_WORKER_ENABLED,secret=process.env.LECTURES_WORKER_TOKEN
 try{
  process.env.LECTURES_WORKER_ENABLED='false';process.env.LECTURES_WORKER_TOKEN='test-only-token'.repeat(4)
  const valid=new Request('https://web.invalid/api/lectures/internal/billing/claim',{headers:{authorization:`Bearer ${process.env.LECTURES_WORKER_TOKEN}`}})
  assert.throws(()=>requireWorker(valid),(e:unknown)=>e instanceof Error&&'status' in e&&e.status===503)
  process.env.LECTURES_WORKER_ENABLED='true'
  const rejectedHeaders:Record<string,string>[]=[{cookie:'admin_session=old'},{authorization:'Bearer wrong'}]
  for(const headers of rejectedHeaders)assert.throws(()=>requireWorker(new Request('https://web.invalid',{headers})),(e:unknown)=>e instanceof Error&&'status' in e&&e.status===401)
  assert.doesNotThrow(()=>requireWorker(valid))
 }finally{
  if(enabled===undefined)delete process.env.LECTURES_WORKER_ENABLED;else process.env.LECTURES_WORKER_ENABLED=enabled
  if(secret===undefined)delete process.env.LECTURES_WORKER_TOKEN;else process.env.LECTURES_WORKER_TOKEN=secret
 }
})
import { buyerOrderPage } from '../lib/lectures/buyer-order-query'
import { lectureUpdate } from '../lib/lectures/catalog-admin'
test('buyer pages are bounded and lecture updates require a version',()=>{
 assert.equal(buyerOrderPage(new URLSearchParams()),1)
 assert.equal(buyerOrderPage(new URLSearchParams({page:'8'})),8)
 for(const page of ['0','-1','1.5','NaN','100001',''])assert.throws(()=>buyerOrderPage(new URLSearchParams({page})))
 const valid={title:'강의',description:'',price_won:1000,sale_status:'DRAFT',video_url:'',expectedVersion:0}
 assert.equal(lectureUpdate.safeParse(valid).success,true)
 for(const expectedVersion of [undefined,-1,0.5])assert.equal(lectureUpdate.safeParse({...valid,expectedVersion}).success,false)
})
