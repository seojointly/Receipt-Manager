import { google } from 'googleapis'
import type { SheetRow } from './types'

const getAuthClient = () => {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!keyJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY가 설정되지 않았습니다.')

  let credentials: Record<string, unknown>
  try {
    credentials = JSON.parse(keyJson)
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY JSON 파싱 실패. 한 줄 직렬화 형식인지 확인하세요.')
  }

  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export const checkDuplicate = async (id: string): Promise<boolean> => {
  // ⚠️ COST_GUARD: Sheets API 호출 1회
  try {
    const auth = getAuthClient()
    const sheets = google.sheets({ version: 'v4', auth })
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID!
    const sheetName = process.env.GOOGLE_SHEET_NAME ?? 'Sheet1'

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:A`,
    })
    const rows = res.data.values ?? []
    return rows.some(row => row[0] === id)
  } catch {
    return false // 중복 확인 실패 시 전송 허용
  }
}

export const updateReceiptInSheet = async (row: SheetRow): Promise<void> => {
  // ⚠️ COST_GUARD: Sheets API 2회 호출 (행 검색 + 덮어쓰기)
  const auth = getAuthClient()
  const sheets = google.sheets({ version: 'v4', auth })

  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID
  if (!spreadsheetId) throw new Error('GOOGLE_SPREADSHEET_ID가 설정되지 않았습니다.')

  const sheetName = process.env.GOOGLE_SHEET_NAME ?? 'Sheet1'

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:A`,
  })

  const rows = res.data.values ?? []
  const rowIndex = rows.findIndex(r => r[0] === row.id)

  if (rowIndex === -1) {
    throw new Error('수정할 행을 찾을 수 없습니다.')
  }

  const sheetRowNumber = rowIndex + 1

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A${sheetRowNumber}:F${sheetRowNumber}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        row.id,
        row.date,
        row.storeName,
        row.category,
        row.memo,
        row.totalAmount,
      ]],
    },
  })
}

export const deleteReceiptsFromSheet = async (ids: string[]): Promise<void> => {
  // ⚠️ COST_GUARD: Sheets API 1 + ids.length 회 호출
  const auth = getAuthClient()
  const sheets = google.sheets({ version: 'v4', auth })
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID!
  const sheetName = process.env.GOOGLE_SHEET_NAME ?? 'Sheet1'

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:A`,
  })
  const rows = res.data.values ?? []

  const rowIndices: number[] = []
  rows.forEach((row, i) => {
    if (ids.includes(row[0])) rowIndices.push(i)
  })

  if (rowIndices.length === 0) return

  const meta = await sheets.spreadsheets.get({ spreadsheetId })
  const sheet = meta.data.sheets?.find(s => s.properties?.title === sheetName)
  const sheetId = sheet?.properties?.sheetId ?? 0

  const sortedDesc = [...rowIndices].sort((a, b) => b - a)

  const requests = sortedDesc.map(rowIndex => ({
    deleteDimension: {
      range: {
        sheetId,
        dimension: 'ROWS',
        startIndex: rowIndex,
        endIndex: rowIndex + 1,
      },
    },
  }))

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  })
}

export const appendReceiptToSheet = async (row: SheetRow): Promise<number> => {
  // ⚠️ COST_GUARD: Sheets API 호출 1회
  const auth = getAuthClient()
  const sheets = google.sheets({ version: 'v4', auth })

  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID
  if (!spreadsheetId) throw new Error('GOOGLE_SPREADSHEET_ID가 설정되지 않았습니다.')

  const sheetName = process.env.GOOGLE_SHEET_NAME ?? 'Sheet1'

  // A: UUID | B: 날짜 | C: 상호명 | D: 항목(category) | E: 메모(memo) | F: 합계
  const values = [[
    row.id,
    row.date,
    row.storeName,
    row.category,
    row.memo,
    row.totalAmount,
  ]]

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:F`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values },
      })
      const updatedRange = response.data.updates?.updatedRange ?? ''
      const match = updatedRange.match(/(\d+)$/)
      return match ? parseInt(match[1], 10) : -1
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.error(`[sheets] append 시도 ${attempt} 실패:`, lastError.message)
      if (attempt < 2) await delay(1000)
    }
  }

  throw lastError ?? new Error('Google Sheets 기록 실패')
}
