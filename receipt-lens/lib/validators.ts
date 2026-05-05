import { z } from 'zod'

export const ReceiptSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  storeName: z.string().min(1),
  supplyAmount: z.number().nonnegative(),
  taxAmount: z.number().nonnegative(),
  totalAmount: z.number().nonnegative(),
})

export function parseCurrency(value: string | number): number {
  if (typeof value === 'number') return value
  const cleaned = value.replace(/[,₩원\s]/g, '')
  return parseFloat(cleaned)
}
