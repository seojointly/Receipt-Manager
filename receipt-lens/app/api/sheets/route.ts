import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { SheetsBodySchema } from '@/lib/validators'
import { checkDuplicate, appendReceiptToSheet } from '@/lib/google-sheets'
import type { SheetRow } from '@/lib/types'

// ⚠️ COST_GUARD: GET 호출 1회당 Sheets API 1회. 자동 폴링 금지 — 수동 새로고침만 허용.
export async function GET() {
  try {
    const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
    if (!keyJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY가 설정되지 않았습니다.')
    const credentials = JSON.parse(keyJson)
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })
    const sheets = google.sheets({ version: 'v4', auth })
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID!
    const sheetName = process.env.GOOGLE_SHEET_NAME ?? 'Sheet1'

    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ COST_GUARD: Sheets API called')
    }

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:F`,
    })

    const rows = res.data.values ?? []
    // 오늘(KST) 날짜와 일치하는 행만 필터링 후 역순(최신순) 반환
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }) // YYYY-MM-DD
    const data = rows.slice(1).filter(row => row[1] === today).reverse()

    return NextResponse.json({ rows: data })
  } catch (err) {
    console.error('[sheets GET]', err)
    return NextResponse.json({ error: 'Sheets 불러오기 실패', rows: [] }, { status: 500 })
  }
}

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
