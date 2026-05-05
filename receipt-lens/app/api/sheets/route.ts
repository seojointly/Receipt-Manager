import { NextRequest, NextResponse } from 'next/server'
import { SheetsBodySchema } from '@/lib/validators'
import { checkDuplicate, appendReceiptToSheet } from '@/lib/google-sheets'
import type { SheetRow } from '@/lib/types'

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

// ⚠️ COST_GUARD: POST 1회당 Sheets API 최대 2회 호출 (checkDuplicate + appendReceiptToSheet)
export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.', code: 'SHEETS_ERROR' }, { status: 400 })
  }

  const rawBody = body as Record<string, unknown>
  const id = rawBody.id

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: '입력값이 올바르지 않습니다.', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const validation = SheetsBodySchema.safeParse(rawBody)
  if (!validation.success) {
    return NextResponse.json({ error: '입력값이 올바르지 않습니다.', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  let isDuplicate: boolean
  try {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ COST_GUARD: Sheets API called')
    }
    isDuplicate = await checkDuplicate(id)
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Google Sheets 연결 오류. 잠시 후 다시 시도하세요.'
    return NextResponse.json({ error, code: 'SHEETS_ERROR' }, { status: 500 })
  }

  if (isDuplicate) {
    return NextResponse.json(
      { error: '이미 전송된 영수증입니다.', code: 'SHEETS_ERROR' },
      { status: 409 }
    )
  }

  const sheetRow: SheetRow = { id, ...validation.data }

  let rowIndex: number
  try {
    rowIndex = await appendReceiptToSheet(sheetRow)
  } catch {
    await delay(1000)
    try {
      rowIndex = await appendReceiptToSheet(sheetRow)
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Google Sheets 연결 오류. 잠시 후 다시 시도하세요.'
      return NextResponse.json({ error, code: 'SHEETS_ERROR' }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true, rowIndex })
}
