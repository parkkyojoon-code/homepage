import { test } from 'node:test'
import assert from 'node:assert/strict'
import verifier from '../scripts/daechion-sheets-verify.cjs'

const env = { DAECHION_SHEETS_ENABLED:'true', DAECHION_BILLING_SEND_ENABLED:'false',
  DAECHION_PAYMENT_READ_ENABLED:'false', DAECHION_ENROLLMENT_ENABLED:'false', DAECHION_READY_MESSAGE_ENABLED:'false',
  DAECHION_SHEETS_SPREADSHEET_ID:'separate-verification-sheet-id', GOOGLE_SHEET_ID:'legacy-verification-sheet-id' }

test('live Sheets verification refuses all real-action flags and disabled Sheets before any API call', async () => {
  const api = { call: async () => { throw Error('Unexpected API call') } }
  for (const key of ['DAECHION_BILLING_SEND_ENABLED','DAECHION_PAYMENT_READ_ENABLED','DAECHION_ENROLLMENT_ENABLED','DAECHION_READY_MESSAGE_ENABLED']) {
    for (const value of ['true', undefined]) await assert.rejects(verifier.verify({ env:{...env,[key]:value},api }), /REAL_ACTIONS_MUST_BE_DISABLED/)
  }
  await assert.rejects(verifier.verify({env:{...env,DAECHION_SHEETS_ENABLED:'false'},api}),/SHEETS_MUST_BE_ENABLED/)
})

test('live Sheets verification never overwrites an existing test tab', async () => {
  const calls = []
  await assert.rejects(verifier.verify({env,viewModule:{sheetsDestination:()=>{}},publisher:{},api:{call:async(method,path)=>{
    calls.push({method,path}); return {sheets:[{properties:{title:'연동 검수 (가상 데이터)'}}]}
  }}}), /VERIFICATION_TAB_ALREADY_EXISTS/)
  assert.deepEqual(calls.map(c=>c.method),['GET'])
})
