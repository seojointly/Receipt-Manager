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

// ⚠️ COST_GUARD: Sheets API 호출 1회 발생. 중복 호출 방지 필수.
export async function appendReceiptToSheet(receipt: Receipt): Promise<number> {
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

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:G`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  })

  const updatedRange = response.data.updates?.updatedRange ?? ''
  const match = updatedRange.match(/(\d+)$/)
  return match ? parseInt(match[1], 10) : -1
}

// ⚠️ COST_GUARD: Sheets API 호출 1회 발생.
export async function checkDuplicate(id: string): Promise<boolean> {
  const auth = getAuthClient()
  const sheets = google.sheets({ version: 'v4', auth })

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:A`,
  })

  const values = response.data.values ?? []
  return values.some((row) => row[0] === id)
}
