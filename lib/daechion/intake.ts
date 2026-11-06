import { z } from 'zod'
import { normalizePhone } from './client'
import { createApplication, LedgerError, type LedgerClient } from './ledger'
import { productBinding, type ProductBinding } from './product-policy'
import { purchaseProcessOf, type PurchaseProcess } from '../purchase-process'

const name = z.string().trim().min(1).max(80).regex(/^[^\u0000-\u001f\u007f]+$/).transform(value => value.normalize('NFC'))
function parsePhone(value: string, ctx: z.RefinementCtx) {
  try { return normalizePhone(value) }
  catch { ctx.addIssue({ code: 'custom', message: 'Invalid phone' }); return z.NEVER }
}
const phone = z.string().max(40).transform(parsePhone)
const optionalPhone = z.string().max(40).default('').transform((value, ctx) => value.trim() ? parsePhone(value, ctx) : '')
const money = z.number().int().min(0).max(2147483647)

// Only applicant input is accepted here. Product titles, prices, process selection,
// enrollment targets, payment status and consent version are always server-owned.
export const intakeRequestSchema = z.object({
  requestKey: z.string().uuid(), productId: z.string().trim().min(1).max(100),
  applicantType: z.enum(['STUDENT', 'GUARDIAN']), studentName: name,
  guardianName: z.union([z.literal(''), name]).default(''),
  studentPhone: phone, payerPhone: phone, guardianPhone: optionalPhone,
  mode: z.enum(['ONLINE', 'OFFLINE']), campus: z.string().trim().max(80).default(''),
  expectedTotalWon: money.positive(), confirmPayment: z.literal(true), agreePrivacy: z.literal(true),
}).strict()

export interface IntakeProduct {
  id: string; name: string; visible: boolean; purchaseProcess?: PurchaseProcess
  modes: { online: { enabled: boolean; price: number }; offline: { enabled: boolean; price: number; campuses?: string[] } }
  textbook: { included: boolean; price: number }
  subjectSelection?: unknown
}
export class IntakeError extends Error {
  constructor(public readonly code: 'INVALID_APPLICATION' | 'PRODUCT_UNAVAILABLE' | 'PRODUCT_NOT_CONFIGURED' | 'PRICE_CHANGED' | 'REQUEST_CONFLICT') {
    // Do not attach validation errors containing applicant data or upstream errors.
    super(code)
  }
}

export function prepareApplication(raw: unknown, product: IntakeProduct | null, bindings: readonly ProductBinding[]) {
  const parsed = intakeRequestSchema.safeParse(raw)
  if (!parsed.success) throw new IntakeError('INVALID_APPLICATION')
  const input = parsed.data
  if (!product || product.id !== input.productId || !product.visible || purchaseProcessOf(product) !== 'PROCESS_2') {
    throw new IntakeError('PRODUCT_UNAVAILABLE')
  }
  let binding: ProductBinding | null
  try { binding = productBinding(product.id, bindings, 'PROCESS_2') }
  catch { throw new IntakeError('PRODUCT_NOT_CONFIGURED') }
  // A product-level mapping must not grant unpurchased subjects. Subject-specific
  // products need a separate selection-to-lecture contract before being enabled.
  if (!binding || product.subjectSelection != null) throw new IntakeError('PRODUCT_NOT_CONFIGURED')
  const mode = input.mode === 'ONLINE' ? product.modes.online : product.modes.offline
  if (!mode.enabled) throw new IntakeError('PRODUCT_UNAVAILABLE')
  if (input.mode === 'ONLINE' ? Boolean(input.campus) : !product.modes.offline.campuses?.includes(input.campus)) {
    throw new IntakeError('INVALID_APPLICATION')
  }
  const tuition = money.safeParse(mode.price)
  const textbook = money.safeParse(product.textbook.included ? product.textbook.price : 0)
  if (!tuition.success || !textbook.success || !product.name.trim()) throw new IntakeError('PRODUCT_NOT_CONFIGURED')
  const total = money.positive().safeParse(tuition.data + textbook.data)
  if (!total.success) throw new IntakeError('PRODUCT_NOT_CONFIGURED')
  if (input.expectedTotalWon !== total.data) throw new IntakeError('PRICE_CHANGED')
  return {
    requestKey: input.requestKey, binding,
    snapshot: {
      productId: product.id, productTitle: product.name, purchaseProcess: 'PROCESS_2' as const,
      tuitionWon: tuition.data, textbookWon: textbook.data, totalWon: total.data,
      studentName: input.studentName, guardianName: input.guardianName,
      studentPhone: input.studentPhone, payerPhone: input.payerPhone, guardianPhone: input.guardianPhone,
      applicantType: input.applicantType, mode: input.mode, campus: input.campus,
      selectedSubjects: [], additionalInputs: [], confirmPayment: true as const, agreePrivacy: true as const,
      noticeVersion: 'process2-intake-v1',
    },
  }
}

export interface IntakePorts {
  loadProduct(id: string): Promise<IntakeProduct | null> | IntakeProduct | null
  bindings: readonly ProductBinding[]
  // Must acquire a dedicated connection and release it even when the transaction fails.
  withClient<T>(run: (client: LedgerClient) => Promise<T>): Promise<T>
}

// Internal service only: no public route is enabled until billing and its recovery
// path are connected. RECEIVED means durable intake, never invoice sent or paid.
export async function submitApplication(raw: unknown, ports: IntakePorts) {
  const parsed = intakeRequestSchema.safeParse(raw)
  if (!parsed.success) throw new IntakeError('INVALID_APPLICATION')
  const prepared = prepareApplication(parsed.data, await ports.loadProduct(parsed.data.productId), ports.bindings)
  try {
    const result = await ports.withClient(client => createApplication(client, prepared.requestKey,
      prepared.snapshot, [prepared.binding], 'PROCESS_2'))
    // A replay may occur after the asynchronous worker has sent a bill. Do not
    // describe the current invoice status from this intake-only acknowledgement.
    return { applicationId: result.id, created: result.created, status: 'RECEIVED' as const }
  } catch (error) {
    if (error instanceof LedgerError && error.code === 'request_key_conflict') throw new IntakeError('REQUEST_CONFLICT')
    throw error
  }
}
