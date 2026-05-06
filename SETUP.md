# ReceiptLens 인프라 설정 가이드

## 구현 항목
| # | 항목 | 상태 |
|---|------|------|
| 1 | localStorage → IndexedDB 이미지 저장 전환 | ✅ 완료 |
| 2 | Cloudflare Tunnel 설정 | ⏳ 대기 |

## 상세 로그

### 1. localStorage → IndexedDB 이미지 저장 전환 ✅
- `receipt-lens/lib/imageDB.ts` 생성: `openDB`, `saveImage`, `getImage`, `deleteImage`, `clearAllImages`
- `receipt-lens/hooks/useReceipts.ts` 수정:
  - `addReceipt`: imageBase64 → IndexedDB 저장, Receipt 객체에서 제거
  - `updateReceipt`: status=synced 시 자동 이미지 삭제
  - `removeReceipt`, `clearSynced`, `clearFailed`: IndexedDB 이미지 삭제 추가
  - 마운트 시 기존 `receipt_lens_images` localStorage → IndexedDB 1회 마이그레이션
- `CLAUDE.md` + `SETUP.md` 문서 추가
- 커밋: `feat: replace localStorage image storage with IndexedDB to remove 5MB limit`

### 1-1. 이미지 업로드 제한 상향 ✅
- `receipt-lens/components/scanner/ImageUploader.tsx` 수정:
  - `MAX_SIZE`: 5MB → 20MB
  - 에러 메시지: `'파일이 5MB를 초과합니다.'` → `'파일이 20MB를 초과합니다.'`
- 커밋: `fix: increase image upload limit from 5MB to 20MB`
