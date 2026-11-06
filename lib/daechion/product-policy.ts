import { isOriginalProduct, type PurchaseProcess } from '../purchase-process'
export interface ProductBinding { productId: string; lectureIds: readonly number[] }

export function productBinding(productId: string, bindings: readonly ProductBinding[], process: PurchaseProcess = 'PROCESS_1'): ProductBinding | null {
  if (isOriginalProduct(productId) || process !== 'PROCESS_2') return null
  const matches = bindings.filter(binding => binding.productId === productId)
  if (matches.length === 0) return null // New products are not enrolled without an explicit mapping.
  if (matches.length !== 1 || !productId.trim() || matches[0].lectureIds.length === 0 ||
    matches[0].lectureIds.some(id => !Number.isSafeInteger(id) || id <= 0) ||
    new Set(matches[0].lectureIds).size !== matches[0].lectureIds.length) {
    throw new Error('Invalid Daechion product binding')
  }
  return { productId, lectureIds: [...matches[0].lectureIds] }
}
