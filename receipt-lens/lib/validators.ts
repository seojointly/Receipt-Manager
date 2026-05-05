import { z } from 'zod'

// Gemini 출력 검증용 스키마 (공급가액/부가세 포함)
export const ReceiptSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  storeName: z.string().min(1),
  supplyAmount: z.number().nonnegative(),
  taxAmount: z.number().nonnegative(),
  totalAmount: z.number().nonnegative(),
})

// /api/sheets 입력 검증용 스키마 (category/memo 포함, 공급가액/부가세 제외)
export const SheetsBodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  storeName: z.string().min(1),
  category: z.string(),
  memo: z.string(),
  totalAmount: z.number().nonnegative(),
})

export function parseCurrency(value: string | number): number {
  if (typeof value === 'number') return value
  const cleaned = value.replace(/[,₩원\s]/g, '')
  return parseFloat(cleaned)
}
