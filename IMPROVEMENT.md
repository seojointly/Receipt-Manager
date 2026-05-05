# ReceiptLens 리팩토링 진행 현황

| # | 항목 | 상태 |
|---|------|------|
| 1 | Sheet 링크 버튼 | ✅ 완료 |
| 2 | 초기화 버튼 — 선택적 삭제 | ⏳ 대기 |
| 3 | 오늘 사용한 횟수 | ⏳ 대기 |
| 4 | 다중 이미지 업로드 | ⏳ 대기 |
| 5 | Google Sheets 양식 및 수동 편집 | ⏳ 대기 |
| 6 | 전송 완료 시 이미지 자동 삭제 | ⏳ 대기 |
| 7 | 스캐너 페이지 한 페이지 통합 | ⏳ 대기 |
| 8 | 문구 및 버튼 변경 | ⏳ 대기 |

## 상세 로그
- **[공통 전제]** Receipt 타입에 category/memo 추가, SheetRow 타입 분리, SheetsBodySchema 신규, google-sheets.ts 컬럼 구조 변경(A~F: uuid/날짜/상호명/항목/메모/합계), ResultForm에 항목 select + 메모 input 추가
- **[항목 1]** .env.local에 NEXT_PUBLIC_GOOGLE_SHEET_URL 추가, 대시보드 SummaryCard 2열 그리드로 변경, Sheet 링크 카드 클릭 시 새 탭으로 스프레드시트 열기
