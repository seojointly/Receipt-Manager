import { NextRequest, NextResponse } from 'next/server'
import { ReceiptSchema } from '@/lib/validators'
import { checkDuplicate, appendReceiptToSheet } from '@/lib/google-sheets'
import type { Receipt } from '@/lib/types'

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

  const validation = ReceiptSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json({ error: '입력값이 올바르지 않습니다.', code: 'SHEETS_ERROR' }, { status: 400 })
  }

  const receipt = body as Receipt

  const isDuplicate = await checkDuplicate(receipt.id)
  if (isDuplicate) {
    return NextResponse.json(
      { error: '이미 전송된 영수증입니다.', code: 'SHEETS_ERROR' },
      { status: 409 }
    )
  }

  let rowIndex: number
  try {
    rowIndex = await appendReceiptToSheet(receipt)
  } catch {
    await delay(1000)
    try {
      rowIndex = await appendReceiptToSheet(receipt)
    } catch (err) {
      const error = err instanceof Error ? err.message : '알 수 없는 오류'
      return NextResponse.json({ error, code: 'SHEETS_ERROR' }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true, rowIndex })
}
