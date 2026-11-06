import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { daechionClient, DaechionError, normalizePhone, type DaechionStudent, type StudentPort } from '../lib/daechion/client'
import { resolveStudent } from '../lib/daechion/identity'
import { productBinding } from '../lib/daechion/product-policy'
import { parsePurchaseProcess, purchaseProcessOf } from '../lib/purchase-process'
import { prepareApplication, submitApplication, type IntakeProduct } from '../lib/daechion/intake'
import { withAutomationClient } from '../lib/daechion/database'

const key = 'unit-test-only-not-a-real-credential'
const input = { name: '검수학생', studentPhone: '01000000001' }
const existing: DaechionStudent = { id: 100, name: input.name, studentPhoneNumber: input.studentPhone, active: false }
function mock(respond: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = []
  const fetcher = (async (url: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(url), init }); return respond(String(url), init)
  }) as typeof fetch
  return { client: daechionClient({ apiKey: key, fetcher }), calls }
}
function port(overrides: Partial<StudentPort> = {}): StudentPort {
  return {
    students: async () => [], student: async () => { throw Error('Unexpected student read') },
    createStudent: async () => { throw Error('Unexpected student creation') }, ...overrides,
  }
}

test('both existing products are excluded even if an operator accidentally adds mappings', () => {
  for (const id of ['12course', 'chuweol']) assert.equal(productBinding(id, [{ productId: id, lectureIds: [10] }], 'PROCESS_2'), null)
})
test('unknown products never enroll; only explicit valid mappings work', () => {
  assert.equal(productBinding('new-course', [], 'PROCESS_2'), null)
  assert.deepEqual(productBinding('new-course', [{ productId: 'new-course', lectureIds: [10, 11] }], 'PROCESS_2'), { productId: 'new-course', lectureIds: [10, 11] })
  for (const ids of [[], [10, 10], [-1], [1.2]]) assert.throws(() => productBinding('new-course', [{ productId: 'new-course', lectureIds: ids }], 'PROCESS_2'))
  assert.throws(() => productBinding('new-course', [{ productId: 'new-course', lectureIds: [10] }, { productId: 'new-course', lectureIds: [11] }], 'PROCESS_2'))
})
test('newness alone never selects automatic registration; process 1 is the default', () => {
  const bindings = [{productId:'new-course',lectureIds:[10]}]
  assert.equal(productBinding('new-course',bindings),null)
  assert.equal(productBinding('new-course',bindings,'PROCESS_1'),null)
  assert.equal(parsePurchaseProcess(undefined),'PROCESS_1')
  assert.equal(purchaseProcessOf({id:'new-course'}),'PROCESS_1')
  assert.equal(purchaseProcessOf({id:'new-course',purchaseProcess:'PROCESS_2'}),'PROCESS_2')
  assert.equal(purchaseProcessOf({id:'12course',purchaseProcess:'PROCESS_2'}),'PROCESS_1')
  assert.throws(()=>parsePurchaseProcess(['PROCESS_1','PROCESS_2']))
})
test('phone normalization accepts formatting but does not silently discard arbitrary characters', () => {
  assert.equal(normalizePhone('010-0000-0001'), input.studentPhone)
  for (const phone of ['x01000000001', '0100000000', '+821000000001', '']) assert.throws(() => normalizePhone(phone))
})
test('requests use the fixed official origin, header authentication, and never redirects', async () => {
  const { client, calls } = mock(() => Response.json({ tenantId: 'tenant-test', keyId: 1, scopes: ['students:read'] }))
  assert.equal((await client.me()).tenantId, 'tenant-test')
  assert.equal(calls[0].url, 'https://api.daechion.com/v1/me')
  assert.equal(new Headers(calls[0].init.headers).get('X-Api-Key'), key)
  assert.equal(calls[0].init.redirect, 'error'); assert.equal(calls[0].init.method, 'GET')
})
test('phone/name lookup includes inactive students and encodes its query', async () => {
  const { client, calls } = mock(() => Response.json([existing]))
  assert.equal((await client.students('010-0000-0001', input.name))[0].active, false)
  const query = new URL(calls[0].url).searchParams
  assert.equal(query.get('phone'), input.studentPhone); assert.equal(query.get('name'), input.name)
  assert.equal(query.has('active'), false)
})
test('student creation maps only student/optional guardian phones, never the payer or a password', async () => {
  const { client, calls } = mock(() => Response.json(existing, { status: 201 }))
  const form = { ...input, guardianPhone: '01000000002', payerPhone: '01000000003' }
  await client.createStudent(form)
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { name: input.name, studentPhoneNumber: input.studentPhone, parentPhoneNumber: form.guardianPhone })
})
test('a student detail response must belong to the requested ID', async () => {
  await assert.rejects(mock(() => Response.json({ ...existing, id: 101 })).client.student(100), /student_result_mismatch/)
})
test('an existing inactive student is reused without creating or resetting an account', async () => {
  const result = await resolveStudent(port({ students: async () => [existing] }), input)
  assert.equal(result.student.id, 100); assert.equal(result.student.active, false); assert.equal(result.created, false)
})
test('a parent-only phone match does not enroll a different child', async () => {
  const wrong = { ...existing, studentPhoneNumber: '01000000009', parentPhoneNumber: input.studentPhone }
  await assert.rejects(resolveStudent(port({ students: async () => [wrong] }), input), e => e instanceof DaechionError && e.code === 'student_identity_review')
})
test('multiple matches or an unlinked requested guardian require review', async () => {
  await assert.rejects(resolveStudent(port({ students: async () => [existing, { ...existing, id: 101 }] }), input), /student_identity_review/)
  await assert.rejects(resolveStudent(port({ students: async () => [existing] }), { ...input, guardianPhone: '01000000002' }), /guardian_identity_review/)
})
test('a create conflict is re-read and checked before reuse', async () => {
  let readId = 0
  const result = await resolveStudent(port({ createStudent: async () => { throw new DaechionError('student_exists', 409, 100) },
    student: async id => { readId = id; return existing } }), input)
  assert.equal(readId, 100); assert.equal(result.created, false)
  await assert.rejects(resolveStudent(port({ createStudent: async () => { throw new DaechionError('student_exists', 409, 100) },
    student: async () => ({ ...existing, name: '다른학생' }) }), input), /student_identity_review/)
})
test('a newly created matching student is marked as newly created', async () => {
  assert.equal((await resolveStudent(port({ createStudent: async () => ({ ...existing, active: true }) }), input)).created, true)
})
test('registration uses current course sessions without dates or per-student permission changes', async () => {
  const { client, calls } = mock(() => Response.json({ lectureId: 10, studentId: 100, enrolledWeeklyLectureIds: [], alreadyEnrolledWeeklyLectureIds: [20] }))
  const result = await client.enroll(10, 100)
  assert.deepEqual(result.alreadyEnrolledWeeklyLectureIds, [20])
  assert.equal(calls[0].url, 'https://api.daechion.com/v1/lectures/10/enrollments')
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { studentId: 100 })
})
test('wrong student/course, empty registration, or duplicate sessions cannot be marked successful', async () => {
  const good = { lectureId: 10, studentId: 100, enrolledWeeklyLectureIds: [20], alreadyEnrolledWeeklyLectureIds: [] as number[] }
  for (const response of [{ ...good, studentId: 101 }, { ...good, lectureId: 11 }, { ...good, enrolledWeeklyLectureIds: [] },
    { ...good, alreadyEnrolledWeeklyLectureIds: [20] }]) {
    await assert.rejects(mock(() => Response.json(response)).client.enroll(10, 100), /enrollment_result_mismatch/)
  }
})
test('unknown write outcomes are surfaced once; the client does not blindly repeat a POST', async () => {
  const { client, calls } = mock(() => { throw Error(`upstream secret ${key}`) })
  await assert.rejects(client.createStudent(input), e => e instanceof DaechionError && e.code === 'transport_unknown' && !e.message.includes(key))
  assert.equal(calls.length, 1)
})
test('rate limits preserve retry timing and upstream details are not retained', async () => {
  const { client } = mock(() => Response.json({ error: { code: 'rate_limited', message: key, details: { secret: key } } }, { status: 429, headers: { 'Retry-After': '12' } }))
  await assert.rejects(client.me(), e => e instanceof DaechionError && e.status === 429 && e.retryAfterMs === 12000 && !JSON.stringify(e).includes(key) && !e.message.includes(key))
})
test('student conflict details expose only the recoverable ID; malformed responses fail closed', async () => {
  const { client } = mock(() => Response.json({ error: { code: 'student_exists', message: key, details: { studentId: 100, secret: key } } }, { status: 409 }))
  await assert.rejects(client.createStudent(input), e => e instanceof DaechionError && e.existingStudentId === 100 && !JSON.stringify(e).includes(key))
  await assert.rejects(mock(() => new Response('not json')).client.me(), /invalid_response/)
  await assert.rejects(mock(() => Response.json({})).client.me(), /invalid_response/)
})

const intakeProduct: IntakeProduct = {
  id: 'short-intake', name: '검수 단기 강의', visible: true, purchaseProcess: 'PROCESS_2',
  modes: { online: { enabled: true, price: 1000 }, offline: { enabled: true, price: 2000, campuses: ['서울 대치'] } },
  textbook: { included: true, price: 200 },
}
const intakeBindings = [{ productId: intakeProduct.id, lectureIds: [10] }]
const intakeInput = {
  requestKey: randomUUID(), productId: intakeProduct.id, applicantType: 'STUDENT',
  studentName: ' 검수학생 ', guardianName: '검수보호자', studentPhone: '010-0000-0001',
  guardianPhone: '010-0000-0002', payerPhone: '010-0000-0003', mode: 'ONLINE',
  expectedTotalWon: 1200, confirmPayment: true, agreePrivacy: true,
}

test('intake derives prices and targets from the server and keeps payer separate from login', () => {
  const { snapshot, binding } = prepareApplication(intakeInput, intakeProduct, intakeBindings)
  assert.equal(snapshot.productTitle, intakeProduct.name)
  assert.equal(snapshot.studentName, '검수학생')
  assert.equal(snapshot.totalWon, 1200)
  assert.equal(snapshot.payerPhone, '01000000003')
  assert.equal(snapshot.guardianPhone, '01000000002')
  assert.deepEqual(binding.lectureIds, [10])
  assert.equal(prepareApplication({ ...intakeInput, guardianPhone: undefined }, intakeProduct, intakeBindings).snapshot.guardianPhone, '')
})

test('legacy, hidden, missing, unmapped and subject-selection products cannot enter intake', () => {
  for (const product of [null, { ...intakeProduct, visible: false }, { ...intakeProduct, purchaseProcess: undefined },
    { ...intakeProduct, purchaseProcess: 'PROCESS_1' as const }]) {
    assert.throws(() => prepareApplication(intakeInput, product, intakeBindings), /PRODUCT_UNAVAILABLE/)
  }
  for (const id of ['12course', 'chuweol']) {
    assert.throws(() => prepareApplication({ ...intakeInput, productId: id }, { ...intakeProduct, id }, [{ productId: id, lectureIds: [10] }]), /PRODUCT_UNAVAILABLE/)
  }
  assert.throws(() => prepareApplication(intakeInput, intakeProduct, []), /PRODUCT_NOT_CONFIGURED/)
  assert.throws(() => prepareApplication(intakeInput, { ...intakeProduct, subjectSelection: {} }, intakeBindings), /PRODUCT_NOT_CONFIGURED/)
})

test('intake rejects stale amounts, forged server fields and malformed identity or consent', () => {
  assert.throws(() => prepareApplication({ ...intakeInput, expectedTotalWon: 1 }, intakeProduct, intakeBindings), /PRICE_CHANGED/)
  for (const extra of [{ totalWon: 1 }, { purchaseProcess: 'PROCESS_1' }, { lectureIds: [999] }, { paymentState: 'PAID' }, { noticeVersion: 'old' }]) {
    assert.throws(() => prepareApplication({ ...intakeInput, ...extra }, intakeProduct, intakeBindings), /INVALID_APPLICATION/)
  }
  for (const change of [{ studentPhone: '010-abcd-1234' }, { payerPhone: '' }, { guardianPhone: 'wrong' },
    { studentName: '\n' }, { studentName: '학생\u0000' }, { agreePrivacy: false }, { confirmPayment: false }, { requestKey: 'reuse' }]) {
    assert.throws(() => prepareApplication({ ...intakeInput, ...change }, intakeProduct, intakeBindings), /INVALID_APPLICATION/)
  }
})

test('disabled modes and unlisted campuses are rejected; valid offline prices are resolved exactly', () => {
  assert.throws(() => prepareApplication(intakeInput, { ...intakeProduct, modes: { ...intakeProduct.modes, online: { enabled: false, price: 1000 } } }, intakeBindings), /PRODUCT_UNAVAILABLE/)
  assert.throws(() => prepareApplication({ ...intakeInput, campus: '서울 대치' }, intakeProduct, intakeBindings), /INVALID_APPLICATION/)
  assert.throws(() => prepareApplication({ ...intakeInput, mode: 'OFFLINE', campus: '다른 지점' }, intakeProduct, intakeBindings), /INVALID_APPLICATION/)
  const offline = prepareApplication({ ...intakeInput, mode: 'OFFLINE', campus: '서울 대치', expectedTotalWon: 2200 }, intakeProduct, intakeBindings)
  assert.equal(offline.snapshot.totalWon, 2200)
  for (const price of [-1, 1.5, NaN, 2147483647]) {
    assert.throws(() => prepareApplication(intakeInput, { ...intakeProduct, modes: { ...intakeProduct.modes, online: { enabled: true, price } } }, intakeBindings), /PRODUCT_NOT_CONFIGURED/)
  }
})

test('invalid intake is rejected before acquiring a database connection', async () => {
  let connections = 0
  const ports = { loadProduct: () => intakeProduct, bindings: intakeBindings,
    withClient: async <T>(run: (client: import('../lib/daechion/ledger').LedgerClient) => Promise<T>): Promise<T> => { void run; connections++; throw Error('Unexpected database access') } }
  await assert.rejects(submitApplication({ ...intakeInput, expectedTotalWon: 1 }, ports), /PRICE_CHANGED/)
  await assert.rejects(submitApplication({ ...intakeInput, agreePrivacy: false }, ports), /INVALID_APPLICATION/)
  assert.equal(connections, 0)
})

test('automation database never falls back to the retired account database', async () => {
  const original = process.env.DAECHION_DATABASE_URL
  const retired = process.env.LECTURES_DATABASE_URL
  delete process.env.DAECHION_DATABASE_URL
  process.env.LECTURES_DATABASE_URL = 'postgresql://unused-test-only.invalid/retired'
  try {
    await assert.rejects(withAutomationClient(async () => 'unreachable'), /DAECHION_DATABASE_NOT_CONFIGURED/)
  } finally {
    if (original === undefined) delete process.env.DAECHION_DATABASE_URL
    else process.env.DAECHION_DATABASE_URL = original
    if (retired === undefined) delete process.env.LECTURES_DATABASE_URL
    else process.env.LECTURES_DATABASE_URL = retired
  }
})
