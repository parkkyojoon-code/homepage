export type PurchaseProcess = 'PROCESS_1' | 'PROCESS_2'
const originalProducts = new Set(['12course', 'chuweol'])

export function isOriginalProduct(id: string): boolean { return originalProducts.has(id) }

export function parsePurchaseProcess(value: unknown, fallback: PurchaseProcess = 'PROCESS_1'): PurchaseProcess {
  if (value === undefined || value === null) return fallback
  if (value !== 'PROCESS_1' && value !== 'PROCESS_2') throw new Error('Invalid purchase process')
  return value
}

export function purchaseProcessOf(product: { id: string; purchaseProcess?: unknown }): PurchaseProcess {
  if (isOriginalProduct(product.id)) return 'PROCESS_1'
  return parsePurchaseProcess(product.purchaseProcess)
}
