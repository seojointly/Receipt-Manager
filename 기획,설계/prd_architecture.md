# 영수증 스캐너 앱 — PRD & Architecture
> **Agent: Architect** | Version 1.0

---

## 1. 제품 개요 (Product Overview)

| 항목 | 내용 |
|------|------|
| 제품명 | ReceiptLens |
| 목적 | 영수증 사진 → AI 분석 → Google Sheets 자동 기록 |
| 사용자 | 개인 (1인) |
| 플랫폼 | 웹 (모바일 최적화 포함) |

---

## 2. 기술 스택

```
Frontend          Next.js 14+ (App Router) + TypeScript
Styling           Tailwind CSS + Lucide React
AI                OpenAI GPT-4o Vision API (Server-side)
Database          Google Sheets API v4 (Service Account)
State             React State + localStorage (임시 저장)
Deployment        Vercel (권장)
```

---

## 3. 시스템 아키텍처

```
┌─────────────────────────────────────────────────┐
│                  Browser (Client)                │
│                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │Dashboard │  │ Scanner  │  │  ResultCard  │  │
│  │Component │  │Component │  │  Component   │  │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│       │              │               │           │
│       └──────────────┼───────────────┘           │
│                      │ localStorage              │
│              ┌───────▼────────┐                 │
│              │  Custom Hooks  │                 │
│              │ useReceipts    │                 │
│              │ useLocalStore  │                 │
│              └───────┬────────┘                 │
└──────────────────────┼──────────────────────────┘
                       │ fetch (API Routes)
┌──────────────────────▼──────────────────────────┐
│                 Next.js Server                   │
│                                                 │
│  /api/analyze   →  OpenAI GPT-4o Vision         │
│  /api/sheets    →  Google Sheets API v4          │
│                                                 │
│  ┌──────────────────────────────────────────┐   │
│  │          lib/                            │   │
│  │  openai.ts    google-sheets.ts           │   │
│  │  validators.ts  types.ts                 │   │
│  └──────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
         │                        │
         ▼                        ▼
   OpenAI API              Google Sheets API
   (GPT-4o Vision)         (Service Account)
```

---

## 4. 디렉토리 구조

```
receipt-lens/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Dashboard (메인)
│   ├── scanner/
│   │   └── page.tsx            # 스캐너 페이지
│   └── api/
│       ├── analyze/
│       │   └── route.ts        # GPT-4o Vision 호출
│       └── sheets/
│           └── route.ts        # Google Sheets 기록
├── components/
│   ├── dashboard/
│   │   ├── SummaryCard.tsx     # 합계 금액 카드
│   │   ├── ReceiptList.tsx     # 영수증 목록
│   │   └── ReceiptRow.tsx      # 개별 행
│   ├── scanner/
│   │   ├── ImageUploader.tsx   # 업로드/카메라
│   │   ├── PreviewPanel.tsx    # 이미지 미리보기
│   │   └── ResultForm.tsx      # AI 추출 결과 편집
│   └── ui/
│       ├── Button.tsx
│       ├── Badge.tsx
│       └── Spinner.tsx
├── hooks/
│   ├── useReceipts.ts          # 영수증 CRUD + localStorage
│   └── useCamera.ts            # 카메라 접근
├── lib/
│   ├── openai.ts               # OpenAI 클라이언트
│   ├── google-sheets.ts        # Sheets 클라이언트
│   ├── validators.ts           # Zod 스키마
│   └── types.ts                # TypeScript 타입
├── .env.local                  # 환경변수 (gitignore)
└── .env.example                # 환경변수 템플릿
```

---

## 5. 데이터 모델

```typescript
interface Receipt {
  id: string;               // UUID
  date: string;             // "2025-01-15"
  storeName: string;        // "스타벅스 강남점"
  supplyAmount: number;     // 공급가액 (부가세 제외)
  taxAmount: number;        // 부가세
  totalAmount: number;      // 합계
  imageBase64?: string;     // 미리보기용 (선택)
  status: 'pending' | 'synced' | 'error';
  createdAt: string;        // ISO 8601
  sheetsRowIndex?: number;  // Sheets 행 번호
}
```

---

## 6. API 설계

### POST /api/analyze
```
Input:  { image: string (base64) }
Output: { date, storeName, supplyAmount, taxAmount, totalAmount }
Error:  { error: string, code: 'PARSE_FAILED' | 'API_ERROR' }
```

### POST /api/sheets
```
Input:  Receipt 객체
Output: { success: true, rowIndex: number }
Error:  { error: string, code: 'SHEETS_ERROR' }
```

---

## 7. Google Sheets 컬럼 구조

| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| ID | 날짜 | 상호명 | 공급가액 | 부가세 | 합계 | 기록일시 |

---

## 8. 보안 고려사항

- API 키 전체 `.env.local` 관리 (클라이언트 노출 없음)
- Service Account 키: JSON 직렬화 후 단일 env var로 관리
- API Routes: 서버 사이드 전용 (클라이언트 번들 포함 안됨)
- 이미지: base64를 서버로만 전송, 영구 저장 안 함
- Rate limiting: 향후 추가 권장 (개인용이므로 현재 생략)
