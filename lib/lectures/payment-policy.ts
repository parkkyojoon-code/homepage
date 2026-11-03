import { assertPaymentMatch, type VerifiedReceipt } from './payssam'

export function paymentTransition(current: string, receipt: VerifiedReceipt, billId: string, amountWon: number) {
  assertPaymentMatch(receipt, billId, amountWon)
  if (receipt.state === 'F') {
    if (!['CREATED','AWAITING_PAYMENT','PAID'].includes(current)) throw new Error('Payment needs manual reconciliation')
    return 'PAID'
  }
  if (receipt.state === 'C') {
    if (!['CREATED','AWAITING_PAYMENT','PAID','REFUNDED'].includes(current)) throw new Error('Cancellation needs manual reconciliation')
    return 'REFUNDED'
  }
  if (receipt.state === 'D') {
    if (!['CREATED','AWAITING_PAYMENT','CANCELLED'].includes(current)) throw new Error('Destroyed bill conflicts with order')
    return 'CANCELLED'
  }
  if (!['CREATED','AWAITING_PAYMENT'].includes(current)) throw new Error('Pending bill cannot reset a terminal order')
  return 'AWAITING_PAYMENT'
}
