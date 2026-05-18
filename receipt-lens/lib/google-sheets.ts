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

  // 1. 새 시트 생성
  const addRes = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title: sheetName } } }],
    },
  })
  const sheetId = addRes.data.replies?.[0]?.addSheet?.properties?.sheetId!

  // 2. 1행: 수입/지출 병합 헤더 + 2행: 컬럼명 + 3행: 정산 + 4행: 잔액
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: [
        {
          range: `${sheetName}!A1:I1`,
          values: [['수입', '', '', '지출', '', '', '', '', '']],
        },
        {
          range: `${sheetName}!A2:I2`,
          values: [['날짜', '항목', '운영비', 'UUID', '일자', '상호명', '항목', '메모', '합계']],
        },
        {
          // SUM 종료 범위를 시작보다 작게 설정(C2<C3)해 초기값 0, 순환 참조 방지
          range: `${sheetName}!A3:I3`,
          values: [['정산', '', '=SUM(C$3:C2)', '', '', '', '', '', '=SUM(I$3:I2)']],
        },
        {
          range: `${sheetName}!A4:I4`,
          values: [['잔액', '', '=C3-I3', '', '', '', '', '', '']],
        },
      ],
    },
  })

  // 3. 서식 적용 (병합, 테두리, 볼드, 필터, 정렬)
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        // A1:C1 병합 (수입)
        {
          mergeCells: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 3 },
            mergeType: 'MERGE_ALL',
          },
        },
        // D1:I1 병합 (지출)
        {
          mergeCells: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 3, endColumnIndex: 9 },
            mergeType: 'MERGE_ALL',
          },
        },
        // 1행 스타일 (볼드 + 가운데 정렬 + 연파랑 배경)
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 9 },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true, fontSize: 11 },
                horizontalAlignment: 'CENTER',
                backgroundColor: { red: 0.85, green: 0.91, blue: 0.98 },
              },
            },
            fields: 'userEnteredFormat(textFormat,horizontalAlignment,backgroundColor)',
          },
        },
        // 2행 스타일 (볼드 + 가운데 정렬 + 연회색 배경)
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 9 },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true },
                horizontalAlignment: 'CENTER',
                backgroundColor: { red: 0.94, green: 0.94, blue: 0.94 },
              },
            },
            fields: 'userEnteredFormat(textFormat,horizontalAlignment,backgroundColor)',
          },
        },
        // 수입 영역 바깥쪽 테두리 (A1:C2)
        {
          updateBorders: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 3 },
            top:    { style: 'SOLID_MEDIUM', color: { red: 0.4, green: 0.4, blue: 0.4 } },
            bottom: { style: 'SOLID_MEDIUM', color: { red: 0.4, green: 0.4, blue: 0.4 } },
            left:   { style: 'SOLID_MEDIUM', color: { red: 0.4, green: 0.4, blue: 0.4 } },
            right:  { style: 'SOLID_MEDIUM', color: { red: 0.4, green: 0.4, blue: 0.4 } },
          },
        },
        // 지출 영역 바깥쪽 테두리 (D1:I2)
        {
          updateBorders: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 2, startColumnIndex: 3, endColumnIndex: 9 },
            top:    { style: 'SOLID_MEDIUM', color: { red: 0.4, green: 0.4, blue: 0.4 } },
            bottom: { style: 'SOLID_MEDIUM', color: { red: 0.4, green: 0.4, blue: 0.4 } },
            left:   { style: 'SOLID_MEDIUM', color: { red: 0.4, green: 0.4, blue: 0.4 } },
            right:  { style: 'SOLID_MEDIUM', color: { red: 0.4, green: 0.4, blue: 0.4 } },
          },
        },
        // 2행 필터
        {
          setBasicFilter: {
            filter: {
              range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 9 },
            },
          },
        },
        // E열(일자) 오름차순 초기 정렬
        {
          sortRange: {
            range: { sheetId, startRowIndex: 2, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: 9 },
            sortSpecs: [{ dimensionIndex: 4, sortOrder: 'ASCENDING' }],
          },
        },
      ],
    },
  })

  return { sheetName, sheetId }
}

export const findNextExpenseRow = async (
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string
): Promise<{ targetRow: number; needsInsert: boolean }> => {
  // ⚠️ COST_GUARD: Sheets API 1회 호출
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:D`,
  })

  const rows = res.data.values ?? []

  // 신형 구조: A열에서 정산 행 위치 탐색 → 그 행 앞에 삽입
  const summaryIdx = rows.findIndex(r => r[0] === '정산')
  if (summaryIdx !== -1) {
    return { targetRow: summaryIdx + 1, needsInsert: true }
  }

  // 구형 구조 fallback: D열 기준 마지막 항목 다음 행에 추가
  const dFilled = rows.filter(r => r[3]).length
  return { targetRow: dFilled + 1, needsInsert: false }
}

export const updateSummaryFormulas = async (
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string
): Promise<void> => {
  // ⚠️ COST_GUARD: Sheets API 2회 호출
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId })
    const exists = meta.data.sheets?.some(s => s.properties?.title === sheetName)
    if (!exists) return

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:A`,
    })
    const rows = res.data.values ?? []

    const summaryIdx = rows.findIndex(row => row[0] === '정산')
    const balanceIdx = rows.findIndex(row => row[0] === '잔액')
    if (summaryIdx === -1) return

    const dataStartRow = 3
    const dataEndRow = summaryIdx      // 0-based idx = 1-based row of last data row
    const summaryRow = summaryIdx + 1  // 1-based
    const balanceRow = balanceIdx + 1  // 1-based

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A${summaryRow}:I${summaryRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          '정산', '',
          `=SUM(C${dataStartRow}:C${dataEndRow})`,
          '', '', '', '', '',
          `=SUM(I${dataStartRow}:I${dataEndRow})`,
        ]],
      },
    })

    if (balanceIdx !== -1) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A${balanceRow}:I${balanceRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[
            '잔액', '',
            `=C${summaryRow}-I${summaryRow}`,
            '', '', '', '', '', '',
          ]],
        },
      })
    }
  } catch (err) {
    console.warn('[sheets] 정산 수식 업데이트 실패:', err)
  }
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

export const appendReceiptToSheet = async (row: SheetRow): Promise<number> => {
  // ⚠️ COST_GUARD: Sheets API 5~6회 호출 (시트 생성 시 추가)
  const auth = getAuthClient()
  const sheets = google.sheets({ version: 'v4', auth })
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID
  if (!spreadsheetId) throw new Error('GOOGLE_SPREADSHEET_ID가 설정되지 않았습니다.')

  // 1. 월별 시트 가져오기 또는 생성
  const { sheetName, sheetId } = await getOrCreateMonthlySheet(sheets, spreadsheetId, row.date)

  // 2. 삽입 위치 탐색 (신형: 정산 행 앞 삽입 / 구형: 마지막 행 다음 추가)
  const { targetRow, needsInsert } = await findNextExpenseRow(sheets, spreadsheetId, sheetName)

  if (needsInsert) {
    // 정산 행 앞에 빈 행 삽입 → 정산·잔액이 자동으로 한 칸씩 밀림
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          insertDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: targetRow - 1,  // 0-based
              endIndex: targetRow,
            },
            inheritFromBefore: false,
          },
        }],
      },
    })
  }

  // 3. 삽입된 행(또는 다음 빈 행)의 D~I열에 데이터 기록
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!D${targetRow}:I${targetRow}`,
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

  // 4. 정산·잔액 행 수식을 현재 데이터 범위로 업데이트
  await updateSummaryFormulas(sheets, spreadsheetId, sheetName)

  return targetRow
}
