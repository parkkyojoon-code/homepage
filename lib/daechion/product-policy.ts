// Explicitly preserve both existing products, including their future purchases.
const excluded = new Set(['12course', 'chuweol'])
export interface ProductBinding { productId: string; lectureIds: readonly number[] }

export function productBinding(productId: string, bindings: readonly ProductBinding[]): ProductBinding | null {
  if (excluded.has(productId)) return null
  const matches = bindings.filter(binding => binding.productId === productId)
  if (matches.length === 0) return null // New products are not enrolled without an explicit mapping.
  if (matches.length !== 1 || !productId.trim() || matches[0].lectureIds.length === 0 ||
    matches[0].lectureIds.some(id => !Number.isSafeInteger(id) || id <= 0) ||
    new Set(matches[0].lectureIds).size !== matches[0].lectureIds.length) {
    throw new Error('Invalid Daechion product binding')
  }
  return { productId, lectureIds: [...matches[0].lectureIds] }
}
