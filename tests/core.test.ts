// 실행: npm test  (Node 내장 테스트 러너 + 타입 제거 실행, 추가 패키지 없음)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseCurrency, ReceiptSchema, DateSchema, ReceiptIdSchema, SheetsBodySchema } from '../lib/validators.ts'
import { escapeFormula, sheetNameOf } from '../lib/google-sheets.ts'

test('parseCurrency: 영수증 금액 문자열을 숫자로', () => {
  assert.equal(parseCurrency('12,000원'), 12000)
  assert.equal(parseCurrency(' ₩1,500 '), 1500)
  assert.equal(parseCurrency(3500), 3500)
})

test('parseCurrency: null/undefined는 NaN → 스키마가 거부 (500이 아니라 422)', () => {
  assert.ok(Number.isNaN(parseCurrency(null)))
  assert.ok(Number.isNaN(parseCurrency(undefined)))
  const result = ReceiptSchema.safeParse({
    date: '2026-11-04', storeName: '편의점',
    supplyAmount: parseCurrency(null), taxAmount: 0, totalAmount: 1000,
  })
  assert.equal(result.success, false)
})

test('DateSchema: 존재하지 않는 날짜 거부', () => {
  assert.equal(DateSchema.safeParse('2026-11-04').success, true)
  assert.equal(DateSchema.safeParse('2028-02-29').success, true)
  assert.equal(DateSchema.safeParse('2026-02-30').success, false)
  assert.equal(DateSchema.safeParse('2026-13-01').success, false)
  assert.equal(DateSchema.safeParse('2026-11-04!A1').success, false)
})

test('escapeFormula: 수식으로 실행될 수 있는 값만 텍스트로', () => {
  assert.equal(escapeFormula('=IMPORTXML("x")'), `'=IMPORTXML("x")`)
  assert.equal(escapeFormula('+82-10'), `'+82-10`)
  assert.equal(escapeFormula('-1+2'), `'-1+2`)
  assert.equal(escapeFormula('@SUM(A1)'), `'@SUM(A1)`)
  assert.equal(escapeFormula('스타벅스'), '스타벅스')
  assert.equal(escapeFormula('편의점 =할인'), '편의점 =할인')
  assert.equal(escapeFormula(''), '')
})

test('입력 검증: UUID 아닌 id, 너무 긴 메모 거부', () => {
  assert.equal(ReceiptIdSchema.safeParse('11111111-1111-4111-8111-111111111111').success, true)
  assert.equal(ReceiptIdSchema.safeParse('=1+1').success, false)
  const base = { date: '2026-11-04', storeName: 'a', category: '', memo: '', totalAmount: 1 }
  assert.equal(SheetsBodySchema.safeParse(base).success, true)
  assert.equal(SheetsBodySchema.safeParse({ ...base, memo: 'x'.repeat(501) }).success, false)
  assert.equal(SheetsBodySchema.safeParse({ ...base, totalAmount: -1 }).success, false)
})

test('sheetNameOf: 날짜 → 월별 시트명', () => {
  assert.equal(sheetNameOf('2026-11-04'), '2026.11')
  assert.equal(sheetNameOf('2027-01-31'), '2027.01')
})
