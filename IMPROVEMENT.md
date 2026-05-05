# ReceiptLens 리팩토링 진행 현황

| # | 항목 | 상태 |
|---|------|------|
| 1 | Sheet 링크 버튼 | ✅ 완료 |
| 2 | 초기화 버튼 — 선택적 삭제 | ✅ 완료 |
| 3 | 오늘 사용한 횟수 | ✅ 완료 |
| 4 | 다중 이미지 업로드 | ✅ 완료 |
| 5 | Google Sheets 양식 및 수동 편집 | ✅ 완료 |
| 6 | 전송 완료 시 이미지 자동 삭제 | ✅ 완료 |
| 7 | 스캐너 페이지 한 페이지 통합 | ✅ 완료 |
| 8 | 문구 및 버튼 변경 | ✅ 완료 |

## 상세 로그
- **[공통 전제]** Receipt 타입에 category/memo 추가, SheetRow 타입 분리, SheetsBodySchema 신규, google-sheets.ts 컬럼 구조 변경(A~F: uuid/날짜/상호명/항목/메모/합계), ResultForm에 항목 select + 메모 input 추가
- **[항목 1]** .env.local에 NEXT_PUBLIC_GOOGLE_SHEET_URL 추가, 대시보드 SummaryCard 2열 그리드로 변경, Sheet 링크 카드 클릭 시 새 탭으로 스프레드시트 열기
- **[항목 2]** localStorage를 DATA_KEY/IMAGE_KEY 두 키로 분리(QuotaExceededError 방지), clearSynced/clearFailed 추가, 초기화 버튼 + ClearModal(전송 완료/실패 선택 삭제) 구현
- **[항목 3]** useDailyCount 훅 신규(DAILY_COUNT_KEY, 날짜 바뀌면 자동 초기화), 대시보드에 "오늘 사용한 횟수 n/30 + 남은 횟수" 카드 추가, 스캐너 분석 성공 시 increment() 호출, 한도 초과 시 업로드 비활성화 + 경고 메시지
- **[항목 4]** ImageUploader 다중 선택(최대 3장, multiple 속성), 카메라 촬영 후 "추가 촬영|완료" 팝업 + 가로 썸네일 미리보기, scanner/page.tsx 전면 개편(ScanItem 배열 관리, 순차 분석, 이미지별 독립 ResultForm + 상태 표시)
- **[항목 5]** lib/categories.ts 신규(교회 예산 21개 항목, .sort() 정렬), ResultForm 전면 개편: 날짜/상호명/합계 수동 편집 가능(input type=date/text/number step=10), 항목 select(CATEGORIES), 메모 textarea rows=2, 공급가액/부가세 행 제거, 합계 10원 단위 유효성 검사 + 경고 + 버튼 비활성화
- **[항목 6]** 전송 성공 후 updateReceipt에 imageBase64: undefined 추가 → saveToStorage가 imageMap에서 제외하여 localStorage 이미지 자동 삭제
- **[항목 7]** scanner/page.tsx 스캔 결과 레이아웃: 이미지+ResultForm 세트 세로 배치(space-y-8), 세트 간 hr 구분선 추가
- **[항목 8]** onSync 시그니처 SyncData 객체로 변경(날짜/상호명/합계 편집값 전달), "다시 촬영"→"재촬영" + "처음으로" 버튼(handleHome: handleReset+router.push('/')), "이미 전송됨"→"완료되었습니다.", 페이지 하단 Sheet 미리보기 카드(NEXT_PUBLIC_GOOGLE_SHEET_URL)
