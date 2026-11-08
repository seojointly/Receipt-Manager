import { z } from 'zod'

// 입력 길이 상한 — 과도하게 큰 페이로드로 인한 메모리/시트 오염 방지
export const LIMITS = {
  storeName: 100,
  category: 50,
  memo: 500,
  id: 64,
  maxAmount: 1_000_000_000_000, // 1조 원
} as const

// YYYY-MM-DD + 실제 존재하는 날짜만 (예: 2026-13-45 거부 → 엉뚱한 시트 생성 방지)
export const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD').refine(
  v => {
    const d = new Date(`${v}T00:00:00Z`)
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
  },
  'date must be a real calendar date'
)

// Gemini 출력 검증용 스키마 (공급가액/부가세 포함)
export const ReceiptSchema = z.object({
  date: DateSchema,
  storeName: z.string().min(1).max(LIMITS.storeName),
  supplyAmount: z.number().nonnegative().max(LIMITS.maxAmount),
  taxAmount: z.number().nonnegative().max(LIMITS.maxAmount),
  totalAmount: z.number().nonnegative().max(LIMITS.maxAmount),
})

// /api/sheets 입력 검증용 스키마 (category/memo 포함, 공급가액/부가세 제외)
export const SheetsBodySchema = z.object({
  date: DateSchema,
  storeName: z.string().min(1).max(LIMITS.storeName),
  category: z.string().max(LIMITS.category),
  memo: z.string().max(LIMITS.memo),
  totalAmount: z.number().nonnegative().max(LIMITS.maxAmount),
})

// 영수증 ID: UUID 형식만 허용 (시트 D열 오염 방지)
export const ReceiptIdSchema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  'id must be a UUID'
)

/** "12,000원" 같은 금액을 숫자로. 숫자/문자열이 아니면(null 등) NaN → 스키마 검증에서 422로 걸러진다. */
export function parseCurrency(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return NaN
  const cleaned = value.replace(/[,₩원\s]/g, '')
  return parseFloat(cleaned)
}
