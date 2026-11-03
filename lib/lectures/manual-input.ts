import { z } from 'zod'
export const manualConfirmation = z.object({
  expectedTotalWon: z.number().int().positive().max(2147483647),
  operatorName: z.string().trim().min(1, '확인자 이름을 입력해주세요.').max(50),
  note: z.string().trim().min(5, '납부 확인 근거를 5자 이상 입력해주세요.').max(500),
  confirmed: z.literal(true),
}).strict()
export function mayManuallyConfirm(status: string) { return status === 'CREATED' || status === 'AWAITING_PAYMENT' }
export const manualRevocation = manualConfirmation.extend({ correctionOnly: z.literal(true) }).strict()
export function mayRevokeManualConfirmation(status: string, hasConfirmation: boolean) { return status === 'PAID' && hasConfirmation }
