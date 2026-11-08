import { google } from 'googleapis'
import type { sheets_v4 } from 'googleapis'
import type { SheetRow } from './types'

/** 사용자에게 그대로 보여줘도 되는 (코드에서 직접 작성한) 에러 */
export class SheetsUserError extends Error {}

const getAuthClient = () => {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!keyJson) throw new SheetsUserError('GOOGLE_SERVICE_ACCOUNT_KEY가 설정되지 않았습니다.')

  let credentials: Record<string, unknown>
  try {
    credentials = JSON.parse(keyJson)
  } catch {
    throw new SheetsUserError('GOOGLE_SERVICE_ACCOUNT_KEY JSON 파싱 실패. 한 줄 직렬화 형식인지 확인하세요.')
  }

  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

const getClient = () => {
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID
  if (!spreadsheetId) throw new SheetsUserError('GOOGLE_SPREADSHEET_ID가 설정되지 않았습니다.')
  return { sheets: google.sheets({ version: 'v4', auth: getAuthClient() }), spreadsheetId }
}

/** YYYY-MM-DD → 월별 시트명 YYYY.MM */
export const sheetNameOf = (date: string): string => {
  const [year, month] = date.split('-')
  return `${year}.${month}`
}

/** 한국 시간 기준 오늘 (YYYY-MM-DD) */
export const kstToday = (): string =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })

/**
 * 수식 인젝션(CSV/Formula Injection) 방지.
 * USER_ENTERED 모드에서는 '=' '+' '-' '@'(및 탭/CR)로 시작하는 문자열이 수식으로 실행된다.
 * 앞에 작은따옴표(')를 붙이면 Sheets가 일반 텍스트로 저장하며, 셀에는 따옴표가 보이지 않는다.
 * (예: 영수증 사진에 인쇄된 =IMPORTXML(...) 문구를 Gemini가 그대로 읽어오는 경우)
 */
export const escapeFormula = (value: string): string =>
  /^[=+\-@\t\r]/.test(value) ? `'${value}` : value

/** Google API 에러를 사용자용 고정 메시지로 변환 (내부 에러 메시지 노출 방지) */
export const toSheetsErrorMessage = (err: unknown): string => {
  if (err instanceof SheetsUserError) return err.message
  const code = (err as { code?: number | string })?.code
  if (code === 401 || code === 403) {
    return 'Google Sheets 권한 오류. 서비스 계정 이메일이 스프레드시트에 공유되어 있는지 확인하세요.'
  }
  if (code === 404) {
    return '스프레드시트를 찾을 수 없습니다. GOOGLE_SPREADSHEET_ID를 확인하세요.'
  }
  if (code === 429) {
    return 'Google Sheets 요청 한도를 초과했습니다. 1분 뒤 다시 시도하세요.'
  }
  return 'Google Sheets 연결 오류. 잠시 후 다시 시도하세요.'
}

/** 범위에 지정한 월별 시트가 아직 없을 때 Sheets가 돌려주는 에러인지 */
const isMissingSheetError = (err: unknown): boolean => {
  const e = err as { code?: number | string; message?: string }
  return e?.code === 400 && /Unable to parse range/i.test(e.message ?? '')
}

// 정산 행 수식: 항상 "2행부터 바로 위 행까지" 합산 → 행을 삽입해도 다시 쓸 필요가 없다.
// 2행(헤더 텍스트)은 SUM이 무시하므로 데이터가 없을 때도 순환 참조 없이 0이 된다.
const SUMMARY_FORMULA_C = '=SUM(C$2:INDEX(C:C,ROW()-1))'
const SUMMARY_FORMULA_I = '=SUM(I$2:INDEX(I:I,ROW()-1))'

const BORDER = { style: 'SOLID_MEDIUM', color: { red: 0.4, green: 0.4, blue: 0.4 } }
const OUTER_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER }
const GREEN_STYLE = {
  backgroundColor: { red: 182 / 255, green: 215 / 255, blue: 168 / 255 },
  textFormat: { bold: true },
}
const DATA_ROW_STYLE = {
  backgroundColor: { red: 1, green: 1, blue: 1 },
  textFormat: { bold: false },
}

/** 새 월별 시트의 서식 요청 목록 (시트 생성 시 1회만 적용) */
const newSheetFormatRequests = (sheetId: number): sheets_v4.Schema$Request[] => {
  const rows = (start: number, end: number, startCol: number, endCol: number) => ({
    sheetId, startRowIndex: start, endRowIndex: end, startColumnIndex: startCol, endColumnIndex: endCol,
  })
  const numberFormat = (range: sheets_v4.Schema$GridRange, format: sheets_v4.Schema$NumberFormat) => ({
    repeatCell: {
      range,
      cell: { userEnteredFormat: { numberFormat: format } },
      fields: 'userEnteredFormat.numberFormat',
    },
  })
  const rowStyle = (range: sheets_v4.Schema$GridRange, style: sheets_v4.Schema$CellFormat) => ({
    repeatCell: {
      range,
      cell: { userEnteredFormat: style },
      fields: 'userEnteredFormat(backgroundColor,textFormat)',
    },
  })

  return [
    // 1행: A1:C1(수입), D1:I1(지출) 병합 + 볼드 + 연파랑
    { mergeCells: { range: rows(0, 1, 0, 3), mergeType: 'MERGE_ALL' } },
    { mergeCells: { range: rows(0, 1, 3, 9), mergeType: 'MERGE_ALL' } },
    {
      repeatCell: {
        range: rows(0, 1, 0, 9),
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
    // 2행: 컬럼명 볼드 + 연회색 + 필터
    {
      repeatCell: {
        range: rows(1, 2, 0, 9),
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
    { setBasicFilter: { filter: { range: rows(1, 2, 0, 9) } } },
    // 헤더 영역 바깥쪽 테두리 (수입 A1:C2 / 지출 D1:I2)
    { updateBorders: { range: rows(0, 2, 0, 3), ...OUTER_BORDERS } },
    { updateBorders: { range: rows(0, 2, 3, 9), ...OUTER_BORDERS } },
    // 3~1000행: 높이 30, 열별 숫자 서식, 가운데 정렬(D열 UUID만 왼쪽), 영역 테두리
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex: 2, endIndex: 1000 },
        properties: { pixelSize: 30 },
        fields: 'pixelSize',
      },
    },
    numberFormat(rows(2, 1000, 0, 1), { type: 'DATE', pattern: 'yyyy-mm-dd' }), // A: 날짜
    numberFormat(rows(2, 1000, 1, 2), { type: 'TEXT' }),                         // B: 항목
    numberFormat(rows(2, 1000, 2, 3), { type: 'NUMBER', pattern: '#,##0' }),     // C: 운영비
    numberFormat(rows(2, 1000, 8, 9), { type: 'NUMBER', pattern: '#,##0' }),     // I: 합계
    {
      repeatCell: {
        range: rows(2, 1000, 0, 9),
        cell: { userEnteredFormat: { horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE' } },
        fields: 'userEnteredFormat(horizontalAlignment,verticalAlignment)',
      },
    },
    {
      repeatCell: {
        range: rows(2, 1000, 3, 4),
        cell: { userEnteredFormat: { horizontalAlignment: 'LEFT', verticalAlignment: 'MIDDLE' } },
        fields: 'userEnteredFormat(horizontalAlignment,verticalAlignment)',
      },
    },
    { updateBorders: { range: rows(2, 1000, 0, 3), ...OUTER_BORDERS } },
    { updateBorders: { range: rows(2, 1000, 3, 9), ...OUTER_BORDERS } },
    // 3행(정산)·4행(잔액) 초록 + 볼드
    rowStyle(rows(2, 4, 0, 9), GREEN_STYLE),
  ]
}

export const getOrCreateMonthlySheet = async (
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  date: string  // YYYY-MM-DD
): Promise<{ sheetName: string; sheetId: number }> => {
  // ⚠️ COST_GUARD: Sheets API 1회(기존 시트) / 3회(신규 시트)
  const sheetName = sheetNameOf(date)

  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties(sheetId,title)',
  })
  const existingSheet = meta.data.sheets?.find(s => s.properties?.title === sheetName)
  if (existingSheet) {
    return { sheetName, sheetId: existingSheet.properties!.sheetId! }
  }

  // 1. 새 시트 생성
  const addRes = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title: sheetName } } }] },
  })
  const sheetId = addRes.data.replies?.[0]?.addSheet?.properties?.sheetId
  if (sheetId === undefined || sheetId === null) throw new Error('addSheet 응답에 sheetId 없음')

  // 2. 1행: 수입/지출 병합 헤더 + 2행: 컬럼명 + 3행: 정산 + 4행: 잔액
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: `${sheetName}!A1:I1`, values: [['수입', '', '', '지출', '', '', '', '', '']] },
        { range: `${sheetName}!A2:I2`, values: [['날짜', '항목', '운영비', 'UUID', '일자', '상호명', '항목', '메모', '합계']] },
        { range: `${sheetName}!A3:I3`, values: [['정산', '', SUMMARY_FORMULA_C, '', '', '', '', '', SUMMARY_FORMULA_I]] },
        // 잔액은 정산 행을 참조 → 위에 행이 삽입되면 Sheets가 참조를 자동으로 옮긴다
        { range: `${sheetName}!A4:I4`, values: [['잔액', '', '=C3-I3', '', '', '', '', '', '']] },
      ],
    },
  })

  // 3. 서식 (병합, 테두리, 볼드, 필터, 숫자 서식, 정산·잔액 초록)
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: newSheetFormatRequests(sheetId) },
  })

  return { sheetName, sheetId }
}

export const findNextExpenseRow = async (
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string
): Promise<{ targetRow: number; needsInsert: boolean; needsFormulaMigration: boolean }> => {
  // ⚠️ COST_GUARD: Sheets API 1회 호출
  // FORMULA로 읽어서 정산 행 수식이 예전 형식(SUM(I3:I7) 같은 고정 범위)인지도 같이 확인한다.
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:I`,
    valueRenderOption: 'FORMULA',
  })
  const rows = res.data.values ?? []

  // 신형 구조: A열에서 정산 행 위치 탐색 → 그 행 앞에 삽입
  const summaryIdx = rows.findIndex(r => r[0] === '정산')
  if (summaryIdx !== -1) {
    const summaryFormula = String(rows[summaryIdx][8] ?? '')
    return {
      targetRow: summaryIdx + 1,
      needsInsert: true,
      needsFormulaMigration: !summaryFormula.includes('INDEX('),
    }
  }

  // 구형 구조 fallback: D열 기준 마지막 항목 다음 행에 추가
  const dFilled = rows.filter(r => r[3]).length
  return { targetRow: dFilled + 1, needsInsert: false, needsFormulaMigration: false }
}

export const checkDuplicate = async (id: string, date: string): Promise<boolean> => {
  // ⚠️ COST_GUARD: Sheets API 1회 호출
  const { sheets, spreadsheetId } = getClient()
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetNameOf(date)}!D:D`,
    })
    return (res.data.values ?? []).some(row => row[0] === id)
  } catch (err) {
    // 해당 월 시트가 아직 없으면 중복일 수 없다. 그 외 오류(네트워크 등)는 그대로 던져서
    // 중복 검사가 조용히 꺼진 채 전송되는 일을 막는다.
    if (isMissingSheetError(err)) return false
    throw err
  }
}

export const updateReceiptInSheet = async (row: SheetRow): Promise<void> => {
  // ⚠️ COST_GUARD: Sheets API 2회 호출 (행 검색 + 덮어쓰기)
  const { sheets, spreadsheetId } = getClient()
  const sheetName = sheetNameOf(row.date)

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!D:D`,
  })

  const rowIndex = (res.data.values ?? []).findIndex(r => r[0] === row.id)
  if (rowIndex === -1) throw new SheetsUserError('수정할 행을 찾을 수 없습니다.')
  const sheetRowNumber = rowIndex + 1

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!D${sheetRowNumber}:I${sheetRowNumber}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        row.id,
        row.date,
        escapeFormula(row.storeName),
        escapeFormula(row.category),
        escapeFormula(row.memo),
        row.totalAmount,
      ]],
    },
  })
}

/** 현재 월 시트에서 오늘(KST) 날짜 행만 최신순으로 (D:I열) */
export const getTodayRows = async (): Promise<string[][]> => {
  // ⚠️ COST_GUARD: Sheets API 1회 호출
  const { sheets, spreadsheetId } = getClient()
  const today = kstToday()
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetNameOf(today)}!D:I`,
    })
    return (res.data.values ?? []).filter(row => row[1] === today).reverse()
  } catch (err) {
    if (isMissingSheetError(err)) return [] // 이번 달 첫 영수증 전
    throw err
  }
}

export const appendReceiptToSheet = async (row: SheetRow): Promise<number> => {
  // ⚠️ COST_GUARD: Sheets API 4회 호출 (신규 시트면 +2회)
  //   시트 조회 1 + 삽입 위치 조회 1 + 행 삽입·서식 1 + 값 기록 1
  const { sheets, spreadsheetId } = getClient()

  // 1. 월별 시트 가져오기 또는 생성
  const { sheetName, sheetId } = await getOrCreateMonthlySheet(sheets, spreadsheetId, row.date)

  // 2. 삽입 위치 탐색 (신형: 정산 행 앞 삽입 / 구형: 마지막 행 다음 추가)
  const { targetRow, needsInsert, needsFormulaMigration } =
    await findNextExpenseRow(sheets, spreadsheetId, sheetName)

  if (needsInsert) {
    // 정산 행 앞에 빈 행 삽입 → 정산·잔액이 자동으로 한 칸씩 밀림.
    // 새 행은 아래 정산 행의 서식(초록·볼드)을 물려받으므로 배경·글꼴만 데이터 행 기본값으로 되돌린다.
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            insertDimension: {
              range: { sheetId, dimension: 'ROWS', startIndex: targetRow - 1, endIndex: targetRow },
              inheritFromBefore: false,
            },
          },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: targetRow - 1, endRowIndex: targetRow, startColumnIndex: 0, endColumnIndex: 9 },
              cell: { userEnteredFormat: DATA_ROW_STYLE },
              fields: 'userEnteredFormat(backgroundColor,textFormat)',
            },
          },
        ],
      },
    })
  }

  // 3. 삽입된 행의 D~I열에 데이터 기록 (+ 예전 시트면 정산 수식을 새 형식으로 1회 교체)
  const data: sheets_v4.Schema$ValueRange[] = [{
    range: `${sheetName}!D${targetRow}:I${targetRow}`,
    values: [[
      row.id,                        // D: UUID
      row.date,                      // E: 일자
      escapeFormula(row.storeName),  // F: 상호명
      escapeFormula(row.category),   // G: 항목
      escapeFormula(row.memo),       // H: 메모
      row.totalAmount,               // I: 합계
    ]],
  }]
  if (needsFormulaMigration) {
    const summaryRow = targetRow + 1 // 삽입으로 한 칸 밀린 정산 행
    data.push(
      { range: `${sheetName}!C${summaryRow}`, values: [[SUMMARY_FORMULA_C]] },
      { range: `${sheetName}!I${summaryRow}`, values: [[SUMMARY_FORMULA_I]] },
    )
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: 'USER_ENTERED', data },
  })

  return targetRow
}
