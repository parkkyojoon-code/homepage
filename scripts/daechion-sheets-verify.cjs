const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')

// Explicit, one-shot Google transport/publisher verification. No DB or payment,
// messaging or Daechion client is loaded. Keep evidence in a separate test tab.
async function verify({ env = process.env, api, publisher, viewModule } = {}) {
  for (const key of ['DAECHION_BILLING_SEND_ENABLED','DAECHION_PAYMENT_READ_ENABLED',
    'DAECHION_ENROLLMENT_ENABLED','DAECHION_READY_MESSAGE_ENABLED']) {
    if (env[key] !== 'false') throw Error('REAL_ACTIONS_MUST_BE_DISABLED')
  }
  if (env.DAECHION_SHEETS_ENABLED !== 'true') throw Error('SHEETS_MUST_BE_ENABLED')
  viewModule ??= require('../.daechion-worker-build/lib/daechion/sheets-view.js')
  publisher ??= require('../.daechion-worker-build/lib/daechion/sheets-publisher.js')
  viewModule.sheetsDestination(env.DAECHION_SHEETS_SPREADSHEET_ID, env.GOOGLE_SHEET_ID)
  if (env.DAECHION_SHEETS_SPREADSHEET_ID === '1jzwafX-L-QatwQUxlv5VnLqYZIZB3GQjRKmTEUp2L3g') throw Error('LEGACY_SHEET_FORBIDDEN')
  api ??= require('../.daechion-worker-build/lib/daechion/google-sheets.js').googleSheetsApi(env.GOOGLE_SERVICE_ACCOUNT_JSON ?? '')
  const base = `/spreadsheets/${env.DAECHION_SHEETS_SPREADSHEET_ID}`
  const title = '연동 검수 (가상 데이터)'
  const document = await api.call('GET', base + '?fields=sheets.properties')
  if (document.sheets?.some(s => s.properties.title === title)) throw Error('VERIFICATION_TAB_ALREADY_EXISTS')
  const added = await api.call('POST', base + ':batchUpdate', { requests: [{ addSheet: { properties: { title } } }] })
  const sheetId = added.replies?.[0]?.addSheet?.properties?.sheetId
  if (!Number.isSafeInteger(sheetId) || sheetId < 0 || String(sheetId) === env.DAECHION_SHEETS_SHEET_ID) throw Error('TEST_TAB_NOT_CONFIRMED')
  const target = { spreadsheetId: env.DAECHION_SHEETS_SPREADSHEET_ID, legacySpreadsheetId: env.GOOGLE_SHEET_ID, sheetId }
  await publisher.setupApplicationSheet(api, target)
  const snapshot = {
    productId: 'sheets-verification-only', productTitle: '[가상 검수] 실제 판매 상품 아님',
    studentHistory: 'EXISTING', studentName: '[가상] 학생', guardianName: '[가상] 보호자',
    studentPhone: '01000000001', guardianPhone: '01000000002', payerPhone: '01000000003',
    applicantType: 'GUARDIAN', tuitionWon: 1000, textbookWon: 200, totalWon: 1200,
    mode: 'ONLINE', campus: '', selectedSubjects: ['검수'], additionalInputs: [{ label: '검수 안내', value: '실제 청구·등록 없음' }],
    confirmPayment: true, agreePrivacy: true, noticeVersion: 'synthetic-verification-only',
  }
  const now = new Date().toISOString()
  const view = { id: randomUUID(), createdAt: now, updatedAt: now, snapshot,
    billingState: 'SENT', currentBillId: '202611070000000000000000000001', allBillIds: ['202611070000000000000000000001'],
    paymentState: 'PENDING', lectureIds: [1], registrationState: 'PENDING', notificationState: 'NOT_READY',
    identity: { status: 'WAITING', detected: 'UNKNOWN' } }
  const second = { ...view, id: randomUUID(), snapshot: { ...snapshot, studentName: '[가상] 비교학생' } }
  const readRows = async () => (await api.call('GET', base + '/values/' + encodeURIComponent(`'${title}'!A:AM`))).values ?? []
  await publisher.publishApplication(api, target, view)
  await publisher.publishApplication(api, target, second)
  await api.call('POST', base + ':batchUpdate', { requests: [
    { updateCells: { start: { sheetId, rowIndex: 2, columnIndex: 38 }, rows: [{ values: [{ userEnteredValue: { stringValue: '직원 메모 보존 검수' } }] }], fields: 'userEnteredValue' } },
    { sortRange: { range: { sheetId, startRowIndex: 1, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 39 }, sortSpecs: [{ dimensionIndex: 4, sortOrder: 'DESCENDING' }] } },
  ] })
  const before = await readRows()
  assert.equal(before.length, 3)
  const priorIndex = before.findIndex(row => row[0] === view.id)
  assert.ok(priorIndex > 0)
  assert.equal(before[priorIndex][38], '직원 메모 보존 검수')
  view.identity = { status: 'REVIEW', detected: 'EXISTING', reason: 'identity_declaration_mismatch' }
  await publisher.publishApplication(api, target, view)
  const after = await readRows()
  assert.equal(after.length, 3)
  assert.equal(after.filter(row => row[0] === view.id).length, 1)
  const row = after.find(row => row[0] === view.id)
  assert.equal(row[6], snapshot.studentPhone)
  assert.equal(row[7], snapshot.guardianPhone)
  assert.equal(row[8], snapshot.payerPhone)
  assert.equal(row[22], view.currentBillId)
  assert.equal(row[36], '확인 필요')
  assert.equal(row[38], '직원 메모 보존 검수')
  assert.equal(after.findIndex(row => row[0] === view.id), priorIndex)
  return { verified: true, sheetId, syntheticRows: 2, duplicateRows: false, phonesAndBillIdPreserved: true, sortedRowUpdated: true, staffMemoPreserved: true, sending: false }
}

if (require.main === module) {
  if (process.argv.slice(2).join(' ') !== '--run') { console.error('EXPLICIT_VERIFICATION_REQUIRED'); process.exit(1) }
  verify().then(result => { console.log(JSON.stringify(result)); process.exit(0) }).catch(() => {
    console.error('SHEETS_VERIFICATION_UNCONFIRMED'); process.exit(1)
  })
}
module.exports = { verify }
