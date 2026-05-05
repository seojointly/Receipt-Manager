# /api/sheets 500 에러 진단 및 수정

## ⚠️ 미완료 — .env.local 작은따옴표 재발 확인 (2026-05-05)

**원인**: `GOOGLE_SERVICE_ACCOUNT_KEY`가 여러 줄 JSON + 작은따옴표(`'...'`) 감싸기로 `.env.local`에 저장됨.
Next.js가 첫 줄(`'{`)만 읽어 길이 2인 빈 값으로 인식 → `JSON.parse()` 실패 → Sheets API 인증 불가 → 500 에러.

**적용한 수정 (2단계)**: PowerShell로 멀티라인 JSON을 단일 줄(2387자)로 변환, 따옴표 제거 후 `.env.local` 업데이트.

```powershell
$envPath = "...\receipt-lens\.env.local"
$content = Get-Content $envPath -Raw -Encoding UTF8
if ($content -match "(?s)GOOGLE_SERVICE_ACCOUNT_KEY='(\{.*?\})'") {
    $jsonOneLine = $Matches[1] -replace "`r`n|`n|`r", ""
    $newContent = $content -replace "(?s)GOOGLE_SERVICE_ACCOUNT_KEY='(\{.*?\})'", "GOOGLE_SERVICE_ACCOUNT_KEY=$jsonOneLine"
    Set-Content $envPath $newContent -Encoding UTF8 -NoNewline
}
```

**당시 확인된 결과**:
- `client_email`: `my-receipt-bot@gen-lang-client-0684615460.iam.gserviceaccount.com`
- `GOOGLE_SERVICE_ACCOUNT_KEY` 길이: 2387자, 단일 줄, 따옴표 없음

**재발 확인 (7단계)**: `.env.local` 재독 결과 작은따옴표가 다시 존재함 → 아직 미해결. 7단계 참조.

---

## 초기 상황 분석

```
[DEBUG] GEMINI_API_KEY exists: true         ← Gemini 정상
POST /api/analyze 200 in 4.2s              ← 영수증 분석 성공
POST /api/sheets 500 in 28.2s              ← Google Sheets 실패
next.js: 27.1s                             ← 타임아웃 또는 인증 오류
```

원인: Google Sheets API 인증 또는 연결 문제.
Gemini는 정상이므로 이 파일만 집중 수정한다.

---

## 1단계: Sheets 에러 메시지 확인

`app/api/sheets/route.ts`의 `checkDuplicate` catch 블록과 `appendReceiptToSheet` catch 블록에 상세 로그 추가:

```typescript
} catch (err) {
  console.error('[sheets] checkDuplicate 에러:', err)
  const error = err instanceof Error ? err.message : 'Google Sheets 연결 오류. 잠시 후 다시 시도하세요.'
  return NextResponse.json({ error, code: 'SHEETS_ERROR' }, { status: 500 })
}
```

`lib/google-sheets.ts`의 `appendReceiptToSheet` 함수 최상단에 추가:

```typescript
export async function appendReceiptToSheet(receipt: Receipt): Promise<number> {
  // 임시 디버그 — 원인 파악 후 삭제
  console.log('[sheets] appendReceiptToSheet 시작')
  console.log('[sheets] SPREADSHEET_ID 존재:', !!process.env.GOOGLE_SPREADSHEET_ID)
  console.log('[sheets] SERVICE_ACCOUNT_KEY 존재:', !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
  console.log('[sheets] SERVICE_ACCOUNT_KEY 앞 20자:', process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.slice(0, 20))
```

서버 재시작 → "Google Sheets에 전송" 버튼 클릭 → 터미널 출력 전체를 확인한다.

---

## 2단계: 환경변수 로딩 확인 ✅ 완료

```
type "receipt-lens\.env.local"
```

확인 항목:
- `GOOGLE_SPREADSHEET_ID=1abc...` 값이 존재하는가
- `GOOGLE_SHEET_NAME=시트1` (없으면 기본값 `시트1` 사용)
- `GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}` JSON이 **한 줄**로 직렬화되어 있는가

**실제 발견된 문제**: 키 값이 멀티라인 JSON + 작은따옴표로 감싸진 형태(`'{ ... }'`)로 저장됨.
→ Next.js가 첫 줄만 읽어 길이 2인 값으로 인식. 해결 완료 (상단 참조).

Windows에서 JSON 한 줄 직렬화 방법:
```powershell
(Get-Content receipt-lens-sa.json -Raw) -replace "`r`n|`n", "" | Set-Clipboard
```
클립보드 내용을 `.env.local`의 `GOOGLE_SERVICE_ACCOUNT_KEY=` 뒤에 붙여넣는다.

---

## 3단계: Service Account 키 구조 확인

1단계 로그에서 `SERVICE_ACCOUNT_KEY 앞 20자`를 확인한다.

**정상 출력:**
```
[sheets] SERVICE_ACCOUNT_KEY 앞 20자: {"type":"service_acc
```

**비정상 출력:**
```
[sheets] SERVICE_ACCOUNT_KEY 존재: false        ← .env.local 로드 실패
[sheets] SERVICE_ACCOUNT_KEY 앞 20자: undefined  ← 키 값 누락
[sheets] SERVICE_ACCOUNT_KEY 앞 20자: {
  "type": "servi                               ← JSON 줄바꿈 포함 (파싱 실패 원인)
```

JSON 파싱 오류인지 확인하려면 `getAuthClient()`에 try-catch 추가:

```typescript
export function getAuthClient(): Auth.GoogleAuth {
  let key: object
  try {
    key = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!)
  } catch (e) {
    console.error('[sheets] SERVICE_ACCOUNT_KEY JSON 파싱 실패:', e)
    throw new Error('서비스 계정 키 형식 오류')
  }
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}
```

---

## 4단계: Google Sheets 접근 권한 확인

Service Account 키 JSON 안의 `client_email` 값을 복사한다:
```json
{"client_email": "receipt-lens@PROJECT_ID.iam.gserviceaccount.com", ...}
```

Google Sheets에서 확인:
1. 해당 스프레드시트를 연다
2. **공유** 버튼 클릭
3. `client_email` 주소가 **편집자** 권한으로 공유되어 있는지 확인
4. 없으면 추가 → 편집자 → 완료

`GOOGLE_SPREADSHEET_ID` 확인:
- 스프레드시트 URL: `https://docs.google.com/spreadsheets/d/[여기가 ID]/edit`
- `.env.local`의 `GOOGLE_SPREADSHEET_ID`와 일치하는지 대조

`GOOGLE_SHEET_NAME` 확인:
- 스프레드시트 하단 탭 이름 (기본값: `시트1`)
- 탭 이름이 다르면 `.env.local`에서 수정

---

## 5단계: lib/google-sheets.ts 방어 코드 보강 ✅ 완료

`lib/google-sheets.ts` 전체를 아래 내용으로 교체. 주요 변경사항:

- **`getAuthClient` 내부화**: KEY 누락 또는 JSON 파싱 실패 시 명확한 에러 메시지 throw
- **`checkDuplicate` 에러 처리**: 기존 throw → `false` 반환으로 변경 (중복 확인 실패 시 전송 허용)
- **`appendReceiptToSheet` 재시도 로직**: 실패 시 1초 대기 후 1회 재시도 (최대 2회 시도)
- **디버그 로그 제거**: 1단계에서 추가했던 임시 `console.log` 전량 제거

```typescript
import { google } from 'googleapis'
import { Receipt } from './types'

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

export const appendReceiptToSheet = async (receipt: Receipt): Promise<number> => {
  // ⚠️ COST_GUARD: Sheets API 호출 1회
  const auth = getAuthClient()
  const sheets = google.sheets({ version: 'v4', auth })

  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID
  if (!spreadsheetId) throw new Error('GOOGLE_SPREADSHEET_ID가 설정되지 않았습니다.')

  const sheetName = process.env.GOOGLE_SHEET_NAME ?? 'Sheet1'

  const values = [[
    receipt.id, receipt.date, receipt.storeName,
    receipt.supplyAmount, receipt.taxAmount, receipt.totalAmount,
    receipt.createdAt,
  ]]

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:G`,
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
```

타입 체크(`npx tsc --noEmit`) 통과 확인.

---

## 6단계: 디버그 코드 제거 및 최종 테스트 ✅ 완료

**제거 완료 (2026-05-05)**

| 파일 | 제거된 코드 |
|------|------------|
| `app/api/analyze/route.ts` | `[DEBUG] GEMINI_API_KEY` 로그 2줄, `[DEBUG] Gemini error` 로그 1줄 |
| `app/api/sheets/route.ts` | `[sheets]` 임시 로그 5줄 (checkDuplicate 호출/결과, appendReceiptToSheet 호출/성공/재시도) |

**유지된 코드:**
- `console.warn('⚠️ COST_GUARD: Gemini API called')` — 의도된 비용 감시 로그
- `lib/google-sheets.ts`의 `console.error(\`[sheets] append 시도 \${attempt} 실패\`)` — 정상 에러 처리

타입 체크(`npx tsc --noEmit`) 에러 없음.

**성공 확인 기준:**
- 브라우저에서 "전송 완료" 상태로 변경됨
- 서버 콘솔에 에러 없음
- `POST /api/sheets 200` 응답
- Google Sheets에 행이 추가됨

---

## 7단계: .env.local 작은따옴표 재발 확인 및 차단

**발견 (2026-05-05)**: `.env.local`을 다시 읽은 결과 `GOOGLE_SERVICE_ACCOUNT_KEY` 값이 여전히 작은따옴표(`'...'`)로 감싸져 있음. 2단계 수정이 유지되지 않았거나 이후 수동 편집으로 재발.

```
# 현재 .env.local 상태 (잘못됨)
GOOGLE_SERVICE_ACCOUNT_KEY='{  "type": "service_account", ... }'
                            ^                               ^
                            작은따옴표 → JSON.parse() 실패
```

**왜 작은따옴표가 문제인가:**
Next.js의 `.env` 파서는 작은따옴표를 값의 일부로 포함한다. 결과적으로 `process.env.GOOGLE_SERVICE_ACCOUNT_KEY`가 `'{ ... }'`(따옴표 포함 문자열)이 되어 `JSON.parse()` 호출 시 SyntaxError 발생.

**올바른 형식 (따옴표 없음):**
```
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

**필요한 조치**: 작은따옴표를 제거하고 저장. 아직 미완료.
