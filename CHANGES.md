# ReceiptLens — Change Log

---

## 2026-05-08 · Pending Approval Flow + Scanner UI Tweak

### 1. Scanner Page — Move Bulk Upload Button to Bottom (`app/scanner/page.tsx`)

**Before:** The "전체 Sheets 업로드" button was rendered above the scan result list.  
**After:** Moved to the bottom, after all scan result items. Scrolling down is now the natural flow: scan → review each item → bulk-upload at the end.

No logic changes; only render order changed.

---

### 2. Home Dashboard — Pending Item Approval (`app/page.tsx`)

Added the ability to review, edit, and approve pending receipts directly from the dashboard without going to the scanner.

**Individual approval:**
- Clicking a `pending` receipt opens `PendingApprovalModal`
- All fields are editable: date, store name, category, memo, total amount
- "Google Sheets에 전송" button syncs the item; button becomes "완료되었습니다." on success
- 3-second cooldown after submit (mirrors scanner behaviour)
- Closes by clicking the backdrop or the ✕ button

**Bulk approval:**
- Shown only when there are **2 or more** pending receipts
- Button label: "전체 승인 및 Sheets 전송 (N건)"
- Sends each receipt sequentially with live progress counter (`전송 중... 1/3`)
- On completion, shows "N건 모두 전송 완료" or "N건 성공 / N건 실패"
- Uses each receipt's stored category/memo; falls back to `CATEGORIES[0]` if blank

---

### 3. New Component — `PendingApprovalModal` (`components/dashboard/PendingApprovalModal.tsx`)

A bottom-sheet modal (slides up on mobile, centred on desktop) for reviewing and syncing a single pending receipt.

- Editable form identical in behaviour to the scanner's `ResultForm`
- Validates that total amount is a multiple of 10 before enabling submit
- Displays API error messages inline
- Exports `PendingSyncData` type (date, storeName, category, memo, totalAmount)

---

### 4. `ReceiptList` — `isSelectable` Prop (`components/dashboard/ReceiptList.tsx`)

Added an optional `isSelectable: (receipt: Receipt) => boolean` predicate.  
When provided, only rows for which the predicate returns `true` receive an `onClick` handler and the pointer-cursor style.

Usage on the dashboard: only `pending` items are clickable; `synced` items have no interaction.

---

### Files Changed

| File | Change |
|------|--------|
| `receipt-lens/app/scanner/page.tsx` | Move bulk-upload section below scan item list |
| `receipt-lens/app/page.tsx` | Add individual + bulk pending approval |
| `receipt-lens/components/dashboard/PendingApprovalModal.tsx` | **New** — pending receipt edit/sync modal |
| `receipt-lens/components/dashboard/ReceiptList.tsx` | Add `isSelectable` prop |
