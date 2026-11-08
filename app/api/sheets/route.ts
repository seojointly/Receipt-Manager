import { NextRequest, NextResponse } from 'next/server'
import { SheetsBodySchema, ReceiptIdSchema, DateSchema } from '@/lib/validators'
import {
  checkDuplicate,
  appendReceiptToSheet,
  updateReceiptInSheet,
  getTodayRows,
  sheetNameOf,
  toSheetsErrorMessage,
} from '@/lib/google-sheets'
import { isAuthenticated } from '@/lib/auth'
import type { SheetRow } from '@/lib/types'

// 심층 방어: proxy.ts가 1차로 막지만, matcher 설정 실수에 대비해 route에서도 재확인
const unauthorized = () =>
  NextResponse.json({ error: '로그인이 필요합니다.', code: 'AUTH_REQUIRED' }, { status: 401 })

const invalidInput = () =>
  NextResponse.json({ error: '입력값이 올바르지 않습니다.', code: 'VALIDATION_ERROR' }, { status: 400 })

const sheetsError = (label: string, err: unknown) => {
  console.error(`[sheets ${label}]`, err)
  return NextResponse.json({ error: toSheetsErrorMessage(err), code: 'SHEETS_ERROR' }, { status: 500 })
}

const costGuard = () => {
  if (process.env.NODE_ENV === 'development') console.warn('⚠️ COST_GUARD: Sheets API called')
}

/** POST/PUT 공통: body → { id + 5필드 } 검증. 실패 시 null */
async function parseRow(req: NextRequest): Promise<{ row: SheetRow; raw: Record<string, unknown> } | null> {
  let raw: Record<string, unknown>
  try {
    raw = await req.json()
  } catch {
    return null
  }
  if (!raw || typeof raw !== 'object') return null
  const id = ReceiptIdSchema.safeParse(raw.id)
  const body = SheetsBodySchema.safeParse(raw)
  if (!id.success || !body.success) return null
  return { row: { id: id.data, ...body.data }, raw }
}

// ⚠️ COST_GUARD: GET 호출 1회당 Sheets API 1회. 자동 폴링 금지 — 수동 새로고침만 허용.
export async function GET(req: NextRequest) {
  if (!isAuthenticated(req)) return unauthorized()
  const { searchParams } = new URL(req.url)
  const checkId = searchParams.get('checkId')

  if (checkId) {
    const id = ReceiptIdSchema.safeParse(checkId)
    const date = DateSchema.safeParse(searchParams.get('date'))
    if (!id.success || !date.success) return invalidInput()
    try {
      costGuard()
      return NextResponse.json({ exists: await checkDuplicate(id.data, date.data) })
    } catch (err) {
      return sheetsError('GET checkId', err)
    }
  }

  try {
    costGuard()
    return NextResponse.json({ rows: await getTodayRows() })
  } catch (err) {
    console.error('[sheets GET]', err)
    return NextResponse.json({ error: toSheetsErrorMessage(err), rows: [] }, { status: 500 })
  }
}

// ⚠️ COST_GUARD: POST 1회당 Sheets API 5회 (checkDuplicate 1 + appendReceiptToSheet 4, 신규 시트면 +2)
// 서버 재시도 없음: 중간까지 반영된 요청을 다시 보내면 빈 행·중복 행이 생길 수 있다.
// 실패 시 사용자가 다시 누르면 checkDuplicate가 먼저 확인한다.
export async function POST(req: NextRequest) {
  if (!isAuthenticated(req)) return unauthorized()
  const parsed = await parseRow(req)
  if (!parsed) return invalidInput()
  const { row } = parsed

  try {
    costGuard()
    if (await checkDuplicate(row.id, row.date)) {
      return NextResponse.json({ error: '이미 전송된 영수증입니다.', code: 'SHEETS_ERROR' }, { status: 409 })
    }
    const rowIndex = await appendReceiptToSheet(row)
    return NextResponse.json({ success: true, rowIndex })
  } catch (err) {
    return sheetsError('POST', err)
  }
}

// ⚠️ COST_GUARD: PUT 1회당 Sheets API 2회 호출 (행 검색 + 덮어쓰기)
export async function PUT(req: NextRequest) {
  if (!isAuthenticated(req)) return unauthorized()
  const parsed = await parseRow(req)
  if (!parsed) return invalidInput()
  const { row, raw } = parsed

  // 행은 "원래 날짜"의 월 시트에 있다. 다른 달로 옮기는 것은 지원하지 않는다(시트 행 삭제 비활성화).
  const originalDate = DateSchema.safeParse(raw.originalDate)
  if (originalDate.success && sheetNameOf(originalDate.data) !== sheetNameOf(row.date)) {
    return NextResponse.json(
      {
        error: '다른 달로는 날짜를 옮길 수 없습니다. [생성]으로 새 항목을 만든 뒤 기존 행은 시트에서 직접 지워주세요.',
        code: 'VALIDATION_ERROR',
      },
      { status: 400 }
    )
  }

  try {
    costGuard()
    await updateReceiptInSheet(row)
    return NextResponse.json({ success: true })
  } catch (err) {
    return sheetsError('PUT', err)
  }
}

// DELETE 없음: 시트 행 삭제는 지원하지 않는다 (앱 목록에서만 삭제, 시트는 직접 정리).
