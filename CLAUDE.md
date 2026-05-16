# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**ReceiptLens** — 영수증 사진을 Gemini 2.5 Flash Vision으로 분석하고 Google Sheets에 자동 기록하는 개인용 웹앱.
실제 코드는 `receipt-lens/` 서브디렉토리에 있다. 서브디렉토리에는 `receipt-lens/CLAUDE.md`도 존재하며 동일한 내용을 참조한다.

## Hard Constraints (절대 불변)

- **Google Cloud 비용 0원**: Google Sheets API v4만 허용. Firebase, Cloud Run, BigQuery, Cloud Storage 등 일절 금지.
- **유료 서비스 금지**: Supabase, PlanetScale, Upstash, Docker 기반 서비스 등 외부 유료 인프라 금지.
- **API 키 격리**: `GEMINI_API_KEY`, `GOOGLE_SERVICE_ACCOUNT_KEY`, `GOOGLE_SPREADSHEET_ID`는 `receipt-lens/.env.local`에만 존재. 클라이언트 번들에 절대 포함 금지. Gemini 호출은 `/api/analyze` route에서만 수행.
- **인증 방식 고정**: Google Sheets는 Service Account + JSON 키(`GOOGLE_SERVICE_ACCOUNT_KEY` env var)로만 인증. OAuth flow 금지.

## Stack (실제 설치 버전)

```
Next.js 16.2.4 + React 19 — App Router, TypeScript
Tailwind CSS v4 + Lucide React
@google/generative-ai ^0.24.1 (서버 사이드 전용)
googleapis ^171.4.0
zod ^4.4.3
uuid ^14.0.0
```

## ⚠️ 버전 주의사항

**Next.js 16 / React 19**: 훈련 데이터(Next.js 13–15)와 API가 다르다. 코드 작성 전 `node_modules/next/dist/docs/`의 관련 가이드를 확인하라.

**Zod v4**: v3 대비 breaking change 다수.
- `z.string().nonempty()` → `z.string().min(1)`
- `schema.parse()` 에러 구조 변경
- import는 동일하게 `import { z } from 'zod'`

## Development Commands

모든 명령은 `receipt-lens/` 디렉토리에서 실행한다.

```bash
npm run dev          # 개발 서버 (localhost:3000)
npx tsc --noEmit     # 타입 체크
npm run build        # 프로덕션 빌드
npm run lint         # ESLint
```

## Architecture

### Data Flow

```
사용자 이미지 업로드 (5MB 이하, 클라이언트 단 차단)
  → (client) File → base64 data URL 변환 ("data:image/jpeg;base64,...")
  → stub Receipt(status:'pending') 즉시 localStorage에 저장 (새로고침 대비)
  → POST /api/analyze { image: "<data URL>" }
    → (server) data URL에서 mimeType 추출 + Gemini Vision 호출
    → parseCurrency + ReceiptSchema 검증
    → AnalyzeResult JSON 반환
  → (client) stub을 실제 데이터로 updateReceipt, ResultForm 표시
    → 분석 실패 시: stub removeReceipt, 에러 박스 표시
  → POST /api/sheets { id, date, storeName, category, memo, totalAmount }
    → ⚠️ SheetsBodySchema 5개 필드 + id 전송 (supplyAmount, taxAmount, createdAt 제외)
    → (server) checkDuplicate → appendReceiptToSheet (실패 시 1회 재시도)
    → { success: true, rowIndex } 반환
  → (client) localStorage 상태를 synced로 업데이트
    → 전송 실패 시: status: 'error' 업데이트
```

**Sheets 행 구조**: `[id, date, storeName, category, memo, totalAmount]` (A–F열)
`supplyAmount`, `taxAmount`는 Sheets에 기록하지 않는다 — 의도된 설계.

### 서버/클라이언트 경계

`lib/` 전체는 서버 전용 — 클라이언트 컴포넌트에서 import 금지.
`lib/types.ts`만 예외: 순수 TypeScript 인터페이스이므로 client 컴포넌트에서 `import type`으로 사용 가능.
`@google/generative-ai`, `googleapis`는 Node.js 런타임 전용 패키지.

### 핵심 타입 (`lib/types.ts`)

```typescript
Receipt       // localStorage 저장 단위. status: 'pending' | 'synced' | 'error'
AnalyzeResult // Gemini 분석 결과 5개 필드 (id/status/createdAt 없음)
ApiError      // { error: string, code: 'PARSE_FAILED' | 'API_ERROR' | 'SHEETS_ERROR' | 'VALIDATION_ERROR' }
```

`ReceiptSchema` (`lib/validators.ts`)는 두 라우트에서 공유된다:
- `/api/analyze`: Gemini 응답 JSON을 검증하는 **출력** 스키마
- `/api/sheets`: 클라이언트가 전송한 body를 검증하는 **입력** 스키마 (id 필드는 스키마 밖에서 별도 처리)

### API Routes

| Route | 역할 |
|-------|------|
| `POST /api/analyze` | base64 data URL → Gemini → `AnalyzeResult` JSON |
| `GET /api/sheets?checkId=<uuid>` | UUID Sheets 존재 여부 확인 → `{ exists: boolean }` |
| `POST /api/sheets` | `id + SheetsBodySchema 5필드` → Google Sheets 행 추가 + 중복 방지 |
| `PUT /api/sheets` | `id + SheetsBodySchema 5필드` → 기존 행 덮어쓰기 |
| `DELETE /api/sheets` | `{ ids: string[] }` → 해당 행 삭제 |

**`/api/analyze` 에러 응답:**
- 400: 이미지 없음
- 422 `PARSE_FAILED`: 영수증 아닌 이미지 → "영수증 이미지를 업로드해주세요." / JSON 파싱·스키마 검증 실패 → "더 선명한 사진으로 다시 시도해주세요."
- 500 `API_ERROR`: Gemini API 오류 → "AI 분석 중 오류가 발생했습니다."

**`/api/sheets` 에러 응답:**
- 400: SheetsBodySchema 검증 실패
- 409 `SHEETS_ERROR`: 중복 ID (`이미 전송된 영수증입니다.`)
- 500 `SHEETS_ERROR`: Sheets API 오류 (1회 재시도 후) — googleapis `err.code`로 분기:
  - 401/403 → "Google Sheets 권한 오류. 서비스 계정 이메일이 스프레드시트에 공유되어 있는지 확인하세요."
  - 404 → "스프레드시트를 찾을 수 없습니다. GOOGLE_SPREADSHEET_ID를 확인하세요."
  - 기타 → "Google Sheets 연결 오류. 잠시 후 다시 시도하세요."

### 대시보드 핵심 패턴 (`app/page.tsx`)

- `onEdit`은 `status === 'synced' || status === 'error'` 인 영수증에만 노출. `pending`은 `PendingApprovalModal`로 처리.
- **EditReceiptModal** props: `receipt`, `onUpdated(patch)`, `onCreated(receipt)`, `onClose`
  - [생성]: 새 UUID 생성 → POST `/api/sheets` → `onCreated` 호출 (localStorage에 추가)
  - [업데이트]: 기존 UUID 기반 PUT `/api/sheets` → `onUpdated` 호출 (localStorage 패치)
  - 마운트 시 `GET /api/sheets?checkId=<uuid>` 로 Sheets 존재 여부 확인 → 미등록 시 노란 경고 배너 표시

### 스캐너 페이지 핵심 패턴 (`app/scanner/page.tsx`)

**Phase 상태머신**: `'upload' → 'analyzing' → 'result'`

- 이미지 선택 즉시 stub receipt 생성 → `addReceipt` → 분석 실패 시 `removeReceipt`로 롤백
- `useReceipts()`의 `receipts` 배열에서 `currentId`로 조회해 receipt 상태 추적 (로컬 state 아님) — ResultForm의 전송 완료 감지에 사용
- `AbortController`로 분석 중 재촬영 시 fetch 취소

### useReceipts 훅 (`hooks/useReceipts.ts`)

localStorage를 단일 진실 공급원으로 사용하는 클라이언트 전용 훅. 반환값:

```typescript
receipts      // Receipt[] — 전체 목록 (최신순)
addReceipt    // (receipt: Receipt) => void
updateReceipt // (id: string, patch: Partial<Receipt>) => void
removeReceipt // (id: string) => void
totalSynced   // synced 영수증 totalAmount 합계 (대시보드 표시용)
syncedCount   // synced 영수증 수
pendingCount  // pending 영수증 수
isLoaded      // false인 동안 렌더링 보류 — SSR hydration mismatch 방지
```

localStorage는 `useEffect` 내에서만 읽는다. `isLoaded`가 `true`가 된 후부터 receipts 변경이 localStorage에 동기화된다.

### COST_GUARD 규칙

`google-sheets.ts`의 모든 Sheets API 호출 함수에 `// ⚠️ COST_GUARD` 주석이 있다.
`/api/sheets`는 반드시 `checkDuplicate(id)` → `appendReceiptToSheet()` 순서로 각 1회만 호출해야 한다 (재시도 포함 최대 2회).

`NODE_ENV === 'development'`일 때 각 API 호출 직전 경고를 출력한다:
- `console.warn('⚠️ COST_GUARD: Sheets API called')`
- `console.warn('⚠️ COST_GUARD: Gemini API called')`

전송 버튼은 `cooldown` state(3초)와 `isSynced` 조건 모두에서 비활성화 (`disabled={isSynced || cooldown}`).

### localStorage Schema

```
"receipt_lens_data"  →  Receipt[]
```

`Receipt.status`: `'pending'` (분석됨, 미전송) | `'synced'` (Sheets 전송 완료) | `'error'` (전송 실패)

## Environment Variables

```bash
# receipt-lens/.env.local
GEMINI_API_KEY=AIza...
GOOGLE_SPREADSHEET_ID=...
GOOGLE_SHEET_NAME=시트1
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}  # JSON 한 줄 직렬화
```

`GOOGLE_SERVICE_ACCOUNT_KEY` Windows 직렬화:
```powershell
(Get-Content receipt-lens-sa.json -Raw) -replace "`r`n|`n", "" | Set-Clipboard
```

## Gemini 프롬프트 계약

`RECEIPT_SYSTEM_PROMPT`는 `responseMimeType: 'application/json'`과 함께 순수 JSON만 반환하도록 강제한다.
마크다운 코드블록이 포함되면 `JSON.parse()` 실패 → `PARSE_FAILED` 에러. 프롬프트 수정 시 이 계약을 유지할 것.

영수증이 아닌 이미지 응답: `{"error": "영수증이 아닙니다"}` → 422 반환.

- 모델: `gemini-2.5-flash-preview-04-17`
- 무료 한도: 일 250 RPD / 예상 사용량: 하루 50회 미만

## 디자인 원칙

`bg-zinc-50` 배경, `bg-white` 카드, `rounded-2xl`, 모바일 우선 `max-w-lg mx-auto`.

## 참고 문서
- [SETUP.md](./SETUP.md): 인프라 설정 가이드 (IndexedDB, Cloudflare Tunnel)
