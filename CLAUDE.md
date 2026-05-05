# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**ReceiptLens** — 영수증 사진을 Gemini 2.5 Flash Vision으로 분석하고 Google Sheets에 자동 기록하는 개인용 웹앱.

## Hard Constraints (절대 불변)

- **Google Cloud 비용 0원**: Google Sheets API v4만 허용. Firebase, Cloud Run, BigQuery, Cloud Storage 등 일절 금지.
- **유료 서비스 금지**: Supabase, PlanetScale, Upstash, Docker 기반 서비스 등 외부 유료 인프라 금지.
- **API 키 격리**: `GEMINI_API_KEY`, `GOOGLE_SERVICE_ACCOUNT_KEY`, `GOOGLE_SPREADSHEET_ID`는 `.env.local`에만 존재. 클라이언트 번들에 절대 포함 금지. Gemini 호출은 `/api/analyze` route에서만 수행.
- **인증 방식 고정**: Google Sheets는 Service Account + JSON 키(`GOOGLE_SERVICE_ACCOUNT_KEY` env var)로만 인증. OAuth flow 금지.

## Stack

```
Next.js 14+ App Router + TypeScript
Tailwind CSS + Lucide React
Google Gemini 2.5 Flash Vision (@google/generative-ai, 서버 사이드 전용, 무료 티어)
Google Sheets API v4 (googleapis 패키지)
State: React useState + localStorage (외부 DB 없음)
```

## Development Commands

```bash
# 프로젝트 생성 (최초 1회)
npx create-next-app@latest receipt-lens --typescript --tailwind --app --src-dir=false --import-alias="@/*"
cd receipt-lens
npm install lucide-react googleapis @google/generative-ai zod uuid
npm install -D @types/uuid

# 개발 서버
npm run dev

# 빌드 / 타입 체크
npm run build
npx tsc --noEmit
```

## Architecture

### Data Flow

```
사용자 이미지 업로드
  → (client) base64 변환
  → POST /api/analyze { image: base64, mimeType? }
    → (server) Gemini 2.5 Flash Vision → 구조화된 JSON 반환
  → (client) localStorage에 pending 상태로 저장
  → POST /api/sheets { receipt 객체 }
    → (server) Google Sheets appendRow
  → (client) localStorage 상태를 synced로 업데이트
```

### API Routes (서버 전용)

| Route | 역할 |
|-------|------|
| `POST /api/analyze` | base64 이미지 → Gemini 2.5 Flash → `AnalyzeResult` JSON |
| `POST /api/sheets` | `Receipt` 객체 → Google Sheets 행 추가 |

### Key Files

- `lib/gemini.ts` — Gemini 클라이언트 및 시스템 프롬프트 (서버 전용)
- `lib/google-sheets.ts` — Sheets 클라이언트 및 `appendReceiptToSheet()` (서버 전용)
- `lib/types.ts` — `Receipt`, `AnalyzeResult`, `ApiError` 타입 정의
- `lib/validators.ts` — Zod `ReceiptSchema` + `parseCurrency()` 유틸
- `hooks/useReceipts.ts` — localStorage CRUD + 상태 동기화 (클라이언트 전용)

### localStorage Schema

```
"receipt_lens_data"  →  Receipt[]   (전체 영수증 목록, status 포함)
```

`Receipt.status`: `'pending'` (분석됨, 미전송) | `'synced'` (Sheets 전송 완료) | `'error'` (전송 실패)

### Google Sheets 컬럼 (A~G, 1행 헤더)

`ID | 날짜 | 상호명 | 공급가액 | 부가세 | 합계 | 기록일시`

## Environment Variables

```bash
# .env.local
GEMINI_API_KEY=AIza...
GOOGLE_SPREADSHEET_ID=...
GOOGLE_SHEET_NAME=시트1
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}  # JSON 한 줄 직렬화
```

`GOOGLE_SERVICE_ACCOUNT_KEY` Windows 직렬화 방법:
```powershell
(Get-Content receipt-lens-sa.json -Raw) -replace "`r`n|`n", "" | Set-Clipboard
```

## Gemini 프롬프트 계약

`lib/gemini.ts`의 `RECEIPT_SYSTEM_PROMPT`는 `responseMimeType: 'application/json'`과 함께 순수 JSON만 반환하도록 강제한다.
마크다운 코드블록이 포함되면 `JSON.parse()` 실패 → `PARSE_FAILED` 에러. 프롬프트 수정 시 이 계약을 유지할 것.

영수증이 아닌 이미지 응답: `{"error": "영수증이 아닙니다"}` → 422 반환.

## Gemini 무료 티어 한도 (2025년 기준)

- 모델: `gemini-2.5-flash`
- 무료 한도: 일 250 RPD (requests per day)
- 예상 사용량: 하루 50회 미만 → 무료 한도 내 완전 포함
