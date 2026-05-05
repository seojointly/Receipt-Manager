# ReceiptLens 리팩토링 진행 현황

| # | 항목 | 상태 |
|---|------|------|
| 1 | Sheet 링크 버튼 | ✅ 완료 |
| 2 | 초기화 버튼 — 선택적 삭제 | ✅ 완료 |
| 3 | 오늘 사용한 횟수 | ✅ 완료 |
| 4 | 다중 이미지 업로드 | ⏳ 대기 |
| 5 | Google Sheets 양식 및 수동 편집 | ⏳ 대기 |
| 6 | 전송 완료 시 이미지 자동 삭제 | ⏳ 대기 |
| 7 | 스캐너 페이지 한 페이지 통합 | ⏳ 대기 |
| 8 | 문구 및 버튼 변경 | ⏳ 대기 |

## 상세 로그
- **[공통 전제]** Receipt 타입에 category/memo 추가, SheetRow 타입 분리, SheetsBodySchema 신규, google-sheets.ts 컬럼 구조 변경(A~F: uuid/날짜/상호명/항목/메모/합계), ResultForm에 항목 select + 메모 input 추가
- **[항목 1]** .env.local에 NEXT_PUBLIC_GOOGLE_SHEET_URL 추가, 대시보드 SummaryCard 2열 그리드로 변경, Sheet 링크 카드 클릭 시 새 탭으로 스프레드시트 열기
- **[항목 2]** localStorage를 DATA_KEY/IMAGE_KEY 두 키로 분리(QuotaExceededError 방지), clearSynced/clearFailed 추가, 초기화 버튼 + ClearModal(전송 완료/실패 선택 삭제) 구현
- **[항목 3]** useDailyCount 훅 신규(DAILY_COUNT_KEY, 날짜 바뀌면 자동 초기화), 대시보드에 "오늘 사용한 횟수 n/30 + 남은 횟수" 카드 추가, 스캐너 분석 성공 시 increment() 호출, 한도 초과 시 업로드 비활성화 + 경고 메시지
