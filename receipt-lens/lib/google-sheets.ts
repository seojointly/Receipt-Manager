import { google, Auth } from 'googleapis'
import type { Receipt } from './types'

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!
const SHEET_NAME = process.env.GOOGLE_SHEET_NAME ?? '시트1'

export function getAuthClient(): Auth.GoogleAuth {
  const key = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!)
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

function getSheetsErrorMessage(err: unknown): string {
  const code = Number((err as { code?: number | string })?.code)
  if (code === 401 || code === 403) {
    return 'Google Sheets 권한 오류. 서비스 계정 이메일이 스프레드시트에 공유되어 있는지 확인하세요.'
  }
  if (code === 404) {
    return '스프레드시트를 찾을 수 없습니다. GOOGLE_SPREADSHEET_ID를 확인하세요.'
  }
  return 'Google Sheets 연결 오류. 잠시 후 다시 시도하세요.'
}

// ⚠️ COST_GUARD: Sheets API 호출 1회 발생. 중복 호출 방지 필수.
export async function appendReceiptToSheet(receipt: Receipt): Promise<number> {
  if (process.env.NODE_ENV === 'development') {
    console.warn('⚠️ COST_GUARD: Sheets API called')
  }
  const auth = getAuthClient()
  const sheets = google.sheets({ version: 'v4', auth })

  const row = [
    receipt.id,
    receipt.date,
    receipt.storeName,
    receipt.supplyAmount,
    receipt.taxAmount,
    receipt.totalAmount,
    receipt.createdAt,
  ]

  try {
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:G`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    })

    const updatedRange = response.data.updates?.updatedRange ?? ''
    const match = updatedRange.match(/(\d+)$/)
    return match ? parseInt(match[1], 10) : -1
  } catch (err) {
    throw new Error(getSheetsErrorMessage(err))
  }
}

// ⚠️ COST_GUARD: Sheets API 호출 1회 발생.
export async function checkDuplicate(id: string): Promise<boolean> {
  if (process.env.NODE_ENV === 'development') {
    console.warn('⚠️ COST_GUARD: Sheets API called')
  }
  const auth = getAuthClient()
  const sheets = google.sheets({ version: 'v4', auth })

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:A`,
    })

    const values = response.data.values ?? []
    return values.some((row) => row[0] === id)
  } catch (err) {
    throw new Error(getSheetsErrorMessage(err))
  }
}
