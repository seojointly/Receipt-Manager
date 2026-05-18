import { google } from 'googleapis'
import type { sheets_v4 } from 'googleapis'
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

export const getOrCreateMonthlySheet = async (
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  date: string  // YYYY-MM-DD
): Promise<{ sheetName: string; sheetId: number }> => {
  // ⚠️ COST_GUARD: Sheets API 1~2회 호출
  const [year, month] = date.split('-')
  const sheetName = `${year}.${month}`

  const meta = await sheets.spreadsheets.get({ spreadsheetId })
  const existingSheet = meta.data.sheets?.find(
    s => s.properties?.title === sheetName
  )

  if (existingSheet) {
    return {
      sheetName,
      sheetId: existingSheet.properties!.sheetId!,
    }
  }

  const addRes = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        addSheet: {
          properties: { title: sheetName },
        },
      }],
    },
  })

  const newSheetId = addRes.data.replies?.[0]?.addSheet?.properties?.sheetId!

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A1:I1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        '날짜', '항목', '운영비',
        'UUID', '일자', '상호명', '항목', '메모', '합계',
      ]],
    },
  })

  return { sheetName, sheetId: newSheetId }
}

export const findNextExpenseRow = async (
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string
): Promise<number> => {
  // ⚠️ COST_GUARD: Sheets API 1회 호출
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!D:D`,
  })

  const rows = res.data.values ?? []
  return rows.length + 1  // 1-based, 헤더 포함
}

export const checkDuplicate = async (id: string, date: string): Promise<boolean> => {
  // ⚠️ COST_GUARD: Sheets API 1회 호출
  try {
    const auth = getAuthClient()
    const sheets = google.sheets({ version: 'v4', auth })
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID!

    const [year, month] = date.split('-')
    const sheetName = `${year}.${month}`

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!D:D`,
    })

    const rows = res.data.values ?? []
    return rows.some(row => row[0] === id)
  } catch {
    return false
  }
}

export const updateReceiptInSheet = async (row: SheetRow): Promise<void> => {
  // ⚠️ COST_GUARD: Sheets API 2~3회 호출
  const auth = getAuthClient()
  const sheets = google.sheets({ version: 'v4', auth })
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID!

  const [year, month] = row.date.split('-')
  const sheetName = `${year}.${month}`

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!D:D`,
  })

  const rows = res.data.values ?? []
  const rowIndex = rows.findIndex(r => r[0] === row.id)
  if (rowIndex === -1) throw new Error('수정할 행을 찾을 수 없습니다.')

  const sheetRowNumber = rowIndex + 1

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!D${sheetRowNumber}:I${sheetRowNumber}`,
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

// export const deleteReceiptsFromSheet = async (ids: string[], date: string): Promise<void> => {
//   // ⚠️ COST_GUARD: Sheets API 2회 호출 (메타조회 + batchUpdate 또는 D열 읽기)
//   const auth = getAuthClient()
//   const sheets = google.sheets({ version: 'v4', auth })
//   const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID!
//
//   const [year, month] = date.split('-')
//   const sheetName = `${year}.${month}`
//
//   const meta = await sheets.spreadsheets.get({ spreadsheetId })
//   const sheet = meta.data.sheets?.find(s => s.properties?.title === sheetName)
//   if (!sheet) return
//   const sheetId = sheet.properties!.sheetId!
//
//   const res = await sheets.spreadsheets.values.get({
//     spreadsheetId,
//     range: `${sheetName}!D:D`,
//   })
//   const rows = res.data.values ?? []
//
//   const rowIndices: number[] = []
//   rows.forEach((row, i) => {
//     if (ids.includes(row[0])) rowIndices.push(i)
//   })
//
//   if (rowIndices.length === 0) return
//
//   const sortedDesc = [...rowIndices].sort((a, b) => b - a)
//
//   const requests = sortedDesc.map(rowIndex => ({
//     deleteDimension: {
//       range: {
//         sheetId,
//         dimension: 'ROWS',
//         startIndex: rowIndex,
//         endIndex: rowIndex + 1,
//       },
//     },
//   }))
//
//   await sheets.spreadsheets.batchUpdate({
//     spreadsheetId,
//     requestBody: { requests },
//   })
// }

export const addSummaryRowIfMissing = async (
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string
): Promise<void> => {
  // ⚠️ COST_GUARD: Sheets API 2~3회 호출
  try {
    // 1. 해당 시트 존재 여부 확인
    const meta = await sheets.spreadsheets.get({ spreadsheetId })
    const exists = meta.data.sheets?.some(
      s => s.properties?.title === sheetName
    )
    if (!exists) return

    // 2. A:I 전체 조회
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:I`,
    })

    const rows = res.data.values ?? []

    // 3. 이미 정산 행 있는지 확인 (마지막 행 A열에 "합계" 또는 "정산" 텍스트)
    const lastRow = rows[rows.length - 1]
    if (lastRow && (lastRow[0] === '합계' || lastRow[0] === '정산')) return

    // 4. 데이터 행 범위 계산 (1행은 헤더)
    const dataStartRow = 2
    const lastDataRow = rows.length

    if (lastDataRow < dataStartRow) return

    const summaryRow = lastDataRow + 1

    // 5. 정산 행 추가
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A${summaryRow}:I${summaryRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          '정산',
          '',
          `=SUM(C${dataStartRow}:C${lastDataRow})`,
          '',
          '',
          '',
          '',
          '잔액',
          `=C${summaryRow}-I${summaryRow + 1}`,
        ]],
      },
    })

    const balanceRow = summaryRow + 1
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A${balanceRow}:I${balanceRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          '', '', '', '', '', '', '',
          '지출합계',
          `=SUM(I${dataStartRow}:I${lastDataRow})`,
        ]],
      },
    })

    const remainRow = balanceRow + 1
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A${remainRow}:I${remainRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          '', '', '', '', '', '', '',
          '잔액',
          `=C${summaryRow}-I${balanceRow}`,
        ]],
      },
    })
  } catch (err) {
    console.warn('[sheets] 전월 정산 행 추가 실패:', err)
  }
}

export const appendReceiptToSheet = async (row: SheetRow): Promise<number> => {
  // ⚠️ COST_GUARD: Sheets API 3~4회 호출 (전월 정산 발생 시 추가 2~3회)
  const auth = getAuthClient()
  const sheets = google.sheets({ version: 'v4', auth })
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID
  if (!spreadsheetId) throw new Error('GOOGLE_SPREADSHEET_ID가 설정되지 않았습니다.')

  // 전월 정산 체크
  const [year, month] = row.date.split('-')
  const prevMonth = parseInt(month) - 1
  const prevYear = prevMonth === 0 ? parseInt(year) - 1 : parseInt(year)
  const prevMonthStr = String(prevMonth === 0 ? 12 : prevMonth).padStart(2, '0')
  const prevSheetName = `${prevYear}.${prevMonthStr}`

  await addSummaryRowIfMissing(sheets, spreadsheetId, prevSheetName)

  // 1. 월별 시트 가져오기 또는 생성
  const { sheetName } = await getOrCreateMonthlySheet(sheets, spreadsheetId, row.date)

  // 2. 지출 영역 삽입 위치 탐색 (D열 기준)
  const targetRow = await findNextExpenseRow(sheets, spreadsheetId, sheetName)

  // 3. 해당 행의 D~I열에 데이터 삽입
  const range = `${sheetName}!D${targetRow}:I${targetRow}`

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        row.id,           // D: UUID
        row.date,         // E: 일자
        row.storeName,    // F: 상호명
        row.category,     // G: 항목
        row.memo,         // H: 메모
        row.totalAmount,  // I: 합계
      ]],
    },
  })

  return targetRow
}
