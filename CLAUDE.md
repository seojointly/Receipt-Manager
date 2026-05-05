# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**ReceiptLens** — 영수증 사진을 Gemini 2.5 Flash Vision으로 분석하고 Google Sheets에 자동 기록하는 개인용 웹앱.
실제 코드는 `receipt-lens/` 서브디렉토리에 있다.

## Hard Constraints (절대 불변)

- **Google Cloud 비용 0원**: Google Sheets API v4만 허용. Firebase, Cloud Run, BigQuery, Cloud Storage 등 일절 금지.
- **유료 서비스 금지**: Supabase, PlanetScale, Upstash, Docker 기반 서비스 등 외부 유료 인프라 금지.
- **API 키 격리**: `GEMINI_API_KEY`, `GOOGLE_SERVICE_ACCOUNT_KEY`, `GOOGLE_SPREADSHEET_ID`는 `.env.local`에만 존재. 클라이언트 번들에 절대 포함 금지. Gemini 호출은 `/api/analyze` route에서만 수행.
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

**Zod v4**: v3 대비 breaking change 다수. 주요 차이점:
- `z.string().nonempty()` → `z.string().min(1)`
- `schema.parse()` 에러 구조 변경
- import는 동일하게 `import { z } from 'zod'`

## Development Commands

```bash
cd receipt-lens

# 개발 서버
npm run dev

# 타입 체크
npx tsc --noEmit

# 빌드
npm run build

# 린트
npm run lint
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
  → POST /api/sheets { <Receipt 객체> }
    → (server) checkDuplicate → appendReceiptToSheet (실패 시 1회 재시도)
    → { success: true, rowIndex } 반환
  → (client) localStorage 상태를 synced로 업데이트
    → 전송 실패 시: status: 'error' 업데이트
```

### 서버/클라이언트 경계

`lib/` 전체는 서버 전용 — 클라이언트 컴포넌트에서 import 금지.
`lib/types.ts`만 예외: 순수 TypeScript 인터페이스이므로 client 컴포넌트에서 `import type`으로 사용 가능.
`@google/generative-ai`, `googleapis`는 Node.js 런타임 전용 패키지.

### API Routes

| Route | 역할 |
|-------|------|
| `POST /api/analyze` | base64 data URL → Gemini → `AnalyzeResult` JSON |
| `POST /api/sheets` | `Receipt` 객체 → Google Sheets 행 추가 + 중복 방지 |

**`/api/analyze` 에러 응답:**
- 400: 이미지 없음
- 422 `PARSE_FAILED`: JSON 파싱 실패 (원본 응답 앞 100자 포함) 또는 영수증 아님
- 500 `API_ERROR`: Gemini API 오류

**`/api/sheets` 에러 응답:**
- 400: ReceiptSchema 검증 실패
- 409 `SHEETS_ERROR`: 중복 ID (`이미 전송된 영수증입니다.`)
- 500 `SHEETS_ERROR`: Sheets API 오류 (1회 재시도 후)

### 구현 상태

```
app/                    — ✅ 전부 구현 완료
  page.tsx              — 대시보드 (요약 카드 3개 + ReceiptList + 스캔 버튼)
  scanner/page.tsx      — 스캐너 (Phase 상태머신: upload→analyzing→result)
  api/analyze/route.ts  — base64 → Gemini → AnalyzeResult
  api/sheets/route.ts   — Receipt → Google Sheets (중복 방지)

lib/                    — ✅ 전부 구현 완료 (서버 전용)
  types.ts              — Receipt, AnalyzeResult, ApiError 타입
  validators.ts         — ReceiptSchema (5개 필드만 검증) + parseCurrency()
  gemini.ts             — Gemini 클라이언트 + RECEIPT_SYSTEM_PROMPT
  google-sheets.ts      — getAuthClient(), appendReceiptToSheet(), checkDuplicate()

hooks/                  — ✅ 전부 구현 완료
  useReceipts.ts        — localStorage CRUD + 상태 동기화
  useCamera.ts          — 카메라 스트림 제어

components/             — ✅ 전부 구현 완료
  ui/Button.tsx         — variant: primary|secondary|danger|ghost, loading prop
  ui/Badge.tsx          — Receipt.status 기반 색상 배지
  ui/Spinner.tsx        — animate-spin 스피너
  scanner/ImageUploader.tsx  — 드래그앤드롭 + 파일/카메라 버튼, 5MB 클라이언트 차단
  scanner/PreviewPanel.tsx   — 이미지 미리보기 + 재촬영 콜백
  scanner/ResultForm.tsx     — AI 결과 표시 + Sheets 전송 버튼 (3초 쿨다운 COST_GUARD)
  dashboard/SummaryCard.tsx  — LucideIcon + label + value 카드
  dashboard/ReceiptRow.tsx   — 상호명/날짜/금액/Badge 행
  dashboard/ReceiptList.tsx  — ReceiptRow 목록 + 빈 상태 처리
```

### 스캐너 페이지 아키텍처 (`app/scanner/page.tsx`)

**Phase 상태머신**: `'upload' → 'analyzing' → 'result'`

- **upload**: ImageUploader 표시. 분석 실패 시 이 단계로 복귀하며 에러 박스 표시.
- **analyzing**: PreviewPanel + Spinner. 재촬영 버튼으로 요청 중단 가능(AbortController).
- **result**: PreviewPanel + ResultForm. ResultForm의 `receipt` prop은 `receipts.find(id)`로 live 상태를 구독하여 전송 완료 즉시 버튼이 비활성화됨.

**핵심 패턴**:
- 이미지 선택 즉시 stub receipt(`date:''`, `storeName:''`, amounts 0) 추가 → 분석 실패 시 `removeReceipt`로 삭제
- `useReceipts()`의 `receipts` 배열에서 `currentId`로 조회하여 receipt 상태 추적 (로컬 state 아님)
- `AbortController`로 분석 중 재촬영 시 fetch 취소

### Components API (주요 props)

```ts
// scanner/ImageUploader
{ onImage: (base64DataURL: string) => void; disabled?: boolean }

// scanner/PreviewPanel
{ src: string; onReset: () => void }

// scanner/ResultForm
{ result: AnalyzeResult; receipt: Receipt; onSync: () => Promise<void> }
// onSync는 reject 시 에러 메시지를 컴포넌트가 직접 표시함

// dashboard/SummaryCard
{ icon: LucideIcon; label: string; value: string | number }

// dashboard/ReceiptList
{ receipts: Receipt[]; onSelect?: (receipt: Receipt) => void }
```

디자인 원칙: `bg-zinc-50` 배경, `bg-white` 카드, `rounded-2xl`, 모바일 우선 `max-w-lg mx-auto`.

### lib/ 핵심 동작

**`validators.ts`**: `ReceiptSchema`는 Gemini 응답 및 `/api/sheets` 입력 검증에 공용으로 사용된다. `date`, `storeName`, `supplyAmount`, `taxAmount`, `totalAmount` 5개 필드만 검증 (Receipt의 `id`, `status`, `createdAt` 등은 검증 대상 아님).

**`google-sheets.ts`**: 모든 API 호출 함수에 `// ⚠️ COST_GUARD` 주석. `/api/sheets`는 반드시 `checkDuplicate(id)` → `appendReceiptToSheet()` 순서로 각 1회만 호출해야 한다 (재시도 포함 최대 2회).

### Hooks API

**`useReceipts()`** — `'use client'`, localStorage 키: `'receipt_lens_data'`
```ts
{
  receipts: Receipt[]
  addReceipt(receipt: Receipt): void
  updateReceipt(id: string, patch: Partial<Receipt>): void
  removeReceipt(id: string): void
  totalSynced: number      // synced 상태 금액 합계
  syncedCount: number
  pendingCount: number
  isLoaded: boolean        // SSR hydration 완료 여부 — false일 때 렌더링 보류
}
```

**`useCamera()`** — `'use client'`
```ts
{
  stream: MediaStream | null
  error: string | null     // 한국어 메시지 (NotAllowedError, NotFoundError 구분)
  isActive: boolean
  startCamera(): Promise<void>
  stopCamera(): void
}
```
후면 카메라 우선(`facingMode: { ideal: 'environment' }`), 언마운트 시 자동 스트림 정리.

### localStorage Schema

```
"receipt_lens_data"  →  Receipt[]
```

`Receipt.status`: `'pending'` (분석됨, 미전송) | `'synced'` (Sheets 전송 완료) | `'error'` (전송 실패)

### Google Sheets 컬럼 (A~G, 1행 헤더)

`ID | 날짜 | 상호명 | 공급가액 | 부가세 | 합계 | 기록일시`

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

## Gemini 무료 티어 한도

- 모델: `gemini-2.5-flash-preview-04-17`
- 무료 한도: 일 250 RPD
- 예상 사용량: 하루 50회 미만
