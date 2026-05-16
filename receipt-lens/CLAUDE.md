# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> 전체 프로젝트 컨텍스트(제약, 아키텍처, 환경변수)는 상위 디렉토리의 `../CLAUDE.md`를 참조하라.

## ⚠️ This is NOT the Next.js you know

Next.js 16 / React 19는 훈련 데이터(Next.js 13–15)와 API가 다르다.
코드 작성 전 `node_modules/next/dist/docs/`의 관련 가이드를 확인하라. Deprecation 경고를 무시하지 말 것.

**Zod v4** — v3 대비 breaking change:
- `z.string().nonempty()` → `z.string().min(1)`
- import: `import { z } from 'zod'` (동일)

## Commands

모든 명령은 이 디렉토리(`receipt-lens/`)에서 실행한다.

```bash
npm run dev          # 개발 서버 (localhost:3000)
npx tsc --noEmit     # 타입 체크
npm run build        # 프로덕션 빌드
npm run lint         # ESLint
```

## 구현 현황

| 경로 | 상태 |
|------|------|
| `lib/` (types, validators, gemini, google-sheets) | ✅ 완료 |
| `app/api/analyze/route.ts` | ✅ 완료 |
| `app/api/sheets/route.ts` | ✅ 완료 |
| `hooks/useReceipts.ts` | ✅ 완료 |
| `hooks/useCamera.ts` | ✅ 완료 |
| `components/**` (ui, scanner, dashboard) | ✅ 완료 |
| `app/page.tsx` | ✅ 완료 (대시보드) |
| `app/scanner/page.tsx` | ✅ 완료 (스캐너) |

## 서버/클라이언트 경계

- `lib/` 전체는 서버 전용 — 단, `lib/types.ts`는 순수 인터페이스이므로 `import type`으로 클라이언트에서 사용 가능.
- Gemini 호출은 `/api/analyze`에서만. Google Sheets 호출은 `/api/sheets`에서만.
- `@google/generative-ai`, `googleapis`는 Node.js 런타임 전용 패키지.

## Sheets 행 구조

`[id, date, storeName, category, memo, totalAmount]` (A–F열)
`supplyAmount`, `taxAmount`는 Sheets에 기록하지 않는다.

`SheetsBodySchema` 검증 필드: `date, storeName, category, memo, totalAmount` (id는 별도 추출)

## `/api/sheets` 엔드포인트

| Method | 파라미터/Body | 역할 |
|--------|--------------|------|
| GET | `?checkId=<uuid>` | UUID 존재 여부 → `{ exists: boolean }` |
| POST | `id + SheetsBodySchema` | 행 추가 (중복 방지) |
| PUT | `id + SheetsBodySchema` | 기존 행 덮어쓰기 |
| DELETE | `{ ids: string[] }` | 행 삭제 |

## EditReceiptModal

`onEdit`은 `status === 'synced' || status === 'error'`인 영수증에 노출.
버튼 3개: [취소] [생성] [업데이트]
- [생성]: 새 UUID → POST → `onCreated(receipt)` 콜백
- [업데이트]: 기존 UUID → PUT → `onUpdated(patch)` 콜백
- 마운트 시 `GET ?checkId=` 로 Sheets 등록 여부 확인, 미등록이면 노란 경고 배너 표시
