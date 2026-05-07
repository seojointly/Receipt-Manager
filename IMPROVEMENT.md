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
| 9 | Sheets 최근 데이터 미리보기 (beta) | ✅ 완료 |
| 10 | Gemini 503 재시도 로직 강화 | ✅ 완료 |
| 11 | 이미지 업로드 전 압축 (Canvas API) | ✅ 완료 |
| 12 | 카메라 연속 촬영 UI 멈춤 버그 수정 | ✅ 완료 |
| 13 | 분석 실패 시 재시도 버튼 추가 | ✅ 완료 |
| 14 | 최대 업로드 사진 수 3장 → 5장 | ✅ 완료 |
| 15 | 전체 Sheets 업로드 버튼 추가 | ✅ 완료 |

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
- **[항목 9 beta]** GET /api/sheets 추가(최근 5행 역순, COST_GUARD), SheetPreview 컴포넌트 신규(forwardRef+useImperativeHandle로 refresh 노출, 새로고침 버튼, 로딩/에러/빈데이터 처리, overflow-x-auto 테이블), 전송 성공 후 previewRef.current?.refresh() 자동 갱신, 기존 링크 전용 카드를 SheetPreview로 교체
- **[항목 10]** Gemini 503(서버 과부하) 재시도 로직 강화: 1회 고정 대기 → 최대 3회 + 지수 백오프(2s→4s→8s). `/api/analyze` catch 블록에 `console.error` 추가로 에러 원인 가시화. Gemini 모델명 변경 이력: `gemini-2.5-flash` → `gemini-1.5-flash` → `gemini-2.0-flash` → `gemini-2.5-flash-lite`
- **[항목 11]** `ImageUploader`에 `compressImage(File|Blob): Promise<Blob>` 추가(Canvas API, 라이브러리 없음). 최대 1920px 리사이즈(비율 유지) + JPEG 품질 0.8. `fileToBase64` 내부에서 호출하여 카메라 촬영·파일 업로드 두 경로 모두 자동 적용. `canvas.width/height = 0`으로 toBlob 완료 후 메모리 해제. 압축 전/후 용량 console.log 출력.
- **[항목 12]** 카메라 연속 촬영 UI 멈춤 2건 수정. ①2번째 멈춤: `isProcessing` state + `isProcessingRef` 추가, 압축 진행 중 버튼 비활성화("처리 중..." 표시), `finally`에서 해제. ②3번째 멈춤: async 함수 내 stale closure 방지를 위해 `capturedImagesRef` + `isProcessingRef` 도입, `updateCapturedImages`/`setProcessing` 헬퍼로 state와 ref 항상 동기화. debug 로그 유지(촬영 번호·배열 길이·메모리·Canvas 생성/해제 시점).
- **[항목 13]** 스캐너 분석 실패 에러 UI에 "재시도" 버튼 추가. `handleRetry(item)`: 동일 이미지로 `/api/analyze` 재호출, 성공 시 `increment()` + 결과 표시, 실패 시 에러 재표시. 재시도 중 상태는 `analyzing`으로 전환되어 스피너 표시(버튼 자연 소거). 한도 초과 시 버튼 비활성화. `Button variant="danger"` 사용으로 에러 UI 스타일 통일.
- **[항목 14]** `ImageUploader`의 `MAX_IMAGES` 상수를 3에서 5로 변경. 관련 에러 메시지·UI 텍스트·조건문은 상수 참조이므로 자동 반영.
- **[항목 15]** 스캐너 scanning phase에 "전체 Sheets 업로드 (N건)" 버튼 추가. 미전송 분석 완료 항목이 2건 이상일 때 표시. 순차 업로드 + "업로드 중... N/M" 진행 표시 + 완료 후 성공/실패 건수 표시. 전체 성공 시 emerald, 일부 실패 시 amber 텍스트. 재촬영 시 bulk 상태 초기화. 기존 개별 전송 버튼 동작 무변경.
