'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CircleDollarSign, CheckCircle2, Clock, ExternalLink, Trash2, Zap, Receipt as ReceiptIcon, Plus } from 'lucide-react'
import type { Receipt } from '@/lib/types'
import { CATEGORIES } from '@/lib/categories'
import { useReceipts } from '@/hooks/useReceipts'
import { useDailyCount } from '@/hooks/useDailyCount'
import { SummaryCard } from '@/components/dashboard/SummaryCard'
import { ReceiptRow } from '@/components/dashboard/ReceiptRow'
import { ClearModal } from '@/components/dashboard/ClearModal'
import { PendingApprovalModal } from '@/components/dashboard/PendingApprovalModal'
import type { PendingSyncData } from '@/components/dashboard/PendingApprovalModal'
import { EditReceiptModal } from '@/components/dashboard/EditReceiptModal'
import { CreateReceiptModal } from '@/components/dashboard/CreateReceiptModal'
import { Toast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/hooks/useToast'

const SHEET_URL = process.env.NEXT_PUBLIC_GOOGLE_SHEET_URL

export default function DashboardPage() {
  const { receipts, totalSynced, syncedCount, pendingCount, isLoaded, addReceipt, updateReceipt, removeReceipt, clearSynced, clearFailed } = useReceipts()
  const { todayCount, limit } = useDailyCount()
  const [showClearModal, setShowClearModal] = useState(false)
  const [selectedPendingId, setSelectedPendingId] = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<Receipt | null>(null)
  const [isBulkApproving, setIsBulkApproving] = useState(false)
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null)
  const [bulkResult, setBulkResult] = useState<{ success: number; failed: number } | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const { toast, showToast, hideToast } = useToast()

  if (!isLoaded) return null

  const pendingReceipts = receipts.filter(r => r.status === 'pending')

  const handleCreated = (receipt: Receipt) => {
    addReceipt(receipt)
    showToast('새 항목이 추가되었습니다.', 'success')
  }
  const selectedReceipt = selectedPendingId ? receipts.find(r => r.id === selectedPendingId) ?? null : null

  function createSyncHandler(receiptId: string) {
    return async (data: PendingSyncData) => {
      const res = await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: receiptId, ...data }),
      })
      const resData = await res.json()
      if (!res.ok) {
        updateReceipt(receiptId, { status: 'error' })
        throw new Error(resData.error || '전송에 실패했습니다.')
      }
      updateReceipt(receiptId, {
        status: 'synced',
        sheetsRowIndex: resData.rowIndex,
        category: data.category,
        memo: data.memo,
      })
    }
  }

  async function handleBulkApprove() {
    if (isBulkApproving || pendingReceipts.length === 0) return

    setIsBulkApproving(true)
    setBulkResult(null)
    setBulkProgress({ current: 0, total: pendingReceipts.length })

    let successCount = 0
    let failCount = 0

    for (let i = 0; i < pendingReceipts.length; i++) {
      const receipt = pendingReceipts[i]
      setBulkProgress({ current: i + 1, total: pendingReceipts.length })

      try {
        const res = await fetch('/api/sheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: receipt.id,
            date: receipt.date,
            storeName: receipt.storeName,
            category: receipt.category || (CATEGORIES[0] ?? ''),
            memo: receipt.memo || '',
            totalAmount: receipt.totalAmount,
          }),
        })
        const resData = await res.json()
        if (!res.ok) throw new Error(resData.error || '전송에 실패했습니다.')

        updateReceipt(receipt.id, {
          status: 'synced',
          sheetsRowIndex: resData.rowIndex,
          category: receipt.category || (CATEGORIES[0] ?? ''),
        })
        successCount++
      } catch {
        updateReceipt(receipt.id, { status: 'error' })
        failCount++
      }
    }

    setIsBulkApproving(false)
    setBulkProgress(null)
    setBulkResult({ success: successCount, failed: failCount })
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIds.size === receipts.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(receipts.map(r => r.id)))
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return

    const ids = Array.from(selectedIds)
    const syncedIds = receipts
      .filter(r => ids.includes(r.id) && r.status === 'synced')
      .map(r => r.id)

    setDeleting(true)
    try {
      if (syncedIds.length > 0) {
        const res = await fetch('/api/sheets', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: syncedIds }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error)
        }
      }

      ids.forEach(id => removeReceipt(id))
      setSelectedIds(new Set())
      showToast(`${ids.length}개 항목이 삭제되었습니다.`, 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : '삭제 실패', 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-lg space-y-6 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-400">ReceiptLens</p>
            <h1 className="text-2xl font-bold text-zinc-900">영수증 대시보드</h1>
          </div>
          <Button variant="ghost" onClick={() => setShowClearModal(true)}>
            <Trash2 className="h-4 w-4" />
            초기화
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <SummaryCard
            icon={CircleDollarSign}
            label="총 지출"
            value={totalSynced.toLocaleString('ko-KR') + '원'}
          />
          <SummaryCard
            icon={CheckCircle2}
            label="동기화"
            value={syncedCount + '건'}
          />
          <SummaryCard
            icon={Clock}
            label="대기"
            value={pendingCount + '건'}
          />
          <SummaryCard
            icon={ExternalLink}
            label="Sheet 링크"
            value="스프레드시트"
            onClick={SHEET_URL ? () => window.open(SHEET_URL, '_blank', 'noopener,noreferrer') : undefined}
          />
          <SummaryCard
            icon={Zap}
            label="오늘 사용한 횟수"
            value={`${todayCount} / ${limit}`}
            subtext={`오늘 남은 횟수: ${limit - todayCount}회`}
          />
        </div>

        <div className="space-y-2">
          <Link href="/scanner" className="block">
            <Button className="w-full">새 영수증 스캔</Button>
          </Link>
          <Button variant="secondary" onClick={() => setShowCreate(true)} className="w-full">
            <Plus className="h-4 w-4" />
            새 항목 추가
          </Button>
        </div>

        {(pendingReceipts.length >= 2 || bulkResult) && (
          <div className="rounded-2xl border border-zinc-100 bg-white p-4 space-y-2">
            {pendingReceipts.length >= 2 && (
              <Button
                onClick={handleBulkApprove}
                disabled={isBulkApproving}
                className="w-full"
              >
                {isBulkApproving && bulkProgress
                  ? `전송 중... ${bulkProgress.current}/${bulkProgress.total}`
                  : `전체 승인 및 Sheets 전송 (${pendingReceipts.length}건)`}
              </Button>
            )}
            {bulkResult && (
              <p className={`text-sm text-center ${bulkResult.failed === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {bulkResult.failed === 0
                  ? `${bulkResult.success}건 모두 전송 완료`
                  : `${bulkResult.success}건 성공 / ${bulkResult.failed}건 실패`}
              </p>
            )}
          </div>
        )}

        {receipts.length > 0 && (
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-zinc-500 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedIds.size === receipts.length && receipts.length > 0}
                onChange={toggleAll}
                className="rounded"
              />
              전체 선택
            </label>
            {selectedIds.size > 0 && (
              <Button
                variant="danger"
                onClick={handleDeleteSelected}
                loading={deleting}
                className="text-xs px-3 py-1.5"
              >
                선택 삭제 ({selectedIds.size})
              </Button>
            )}
          </div>
        )}

        {receipts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 py-14">
            <ReceiptIcon className="h-10 w-10 text-zinc-300" />
            <p className="text-sm text-zinc-400">저장된 영수증이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-2">
            {receipts.map(r => (
              <div key={r.id} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedIds.has(r.id)}
                  onChange={() => toggleSelect(r.id)}
                  className="rounded shrink-0"
                />
                <ReceiptRow
                  receipt={r}
                  className="flex-1"
                  onClick={r.status === 'pending' ? () => setSelectedPendingId(r.id) : undefined}
                  onEdit={r.status === 'synced' || r.status === 'error' ? () => setEditTarget(r) : undefined}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      {showClearModal && (
        <ClearModal
          receipts={receipts}
          onClearSynced={clearSynced}
          onClearFailed={clearFailed}
          onClose={() => setShowClearModal(false)}
        />
      )}

      {selectedReceipt && (
        <PendingApprovalModal
          receipt={selectedReceipt}
          onSync={createSyncHandler(selectedReceipt.id)}
          onClose={() => setSelectedPendingId(null)}
        />
      )}

      {editTarget && (
        <EditReceiptModal
          receipt={editTarget}
          onUpdated={(patch) => updateReceipt(editTarget.id, patch)}
          onCreated={(receipt) => {
            addReceipt(receipt)
            showToast('새 항목이 추가되었습니다.', 'success')
          }}
          onClose={() => setEditTarget(null)}
        />
      )}

      {showCreate && (
        <CreateReceiptModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}
