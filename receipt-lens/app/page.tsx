'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CircleDollarSign, CheckCircle2, Clock, ExternalLink, Trash2, Zap } from 'lucide-react'
import type { Receipt } from '@/lib/types'
import { CATEGORIES } from '@/lib/categories'
import { useReceipts } from '@/hooks/useReceipts'
import { useDailyCount } from '@/hooks/useDailyCount'
import { SummaryCard } from '@/components/dashboard/SummaryCard'
import { ReceiptList } from '@/components/dashboard/ReceiptList'
import { ClearModal } from '@/components/dashboard/ClearModal'
import { PendingApprovalModal } from '@/components/dashboard/PendingApprovalModal'
import type { PendingSyncData } from '@/components/dashboard/PendingApprovalModal'
import { EditReceiptModal } from '@/components/dashboard/EditReceiptModal'
import { Button } from '@/components/ui/Button'

const SHEET_URL = process.env.NEXT_PUBLIC_GOOGLE_SHEET_URL

export default function DashboardPage() {
  const { receipts, totalSynced, syncedCount, pendingCount, isLoaded, updateReceipt, clearSynced, clearFailed } = useReceipts()
  const { todayCount, limit } = useDailyCount()
  const [showClearModal, setShowClearModal] = useState(false)
  const [selectedPendingId, setSelectedPendingId] = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<Receipt | null>(null)
  const [isBulkApproving, setIsBulkApproving] = useState(false)
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null)
  const [bulkResult, setBulkResult] = useState<{ success: number; failed: number } | null>(null)

  if (!isLoaded) return null

  const pendingReceipts = receipts.filter(r => r.status === 'pending')
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

        <Link href="/scanner" className="block">
          <Button className="w-full">새 영수증 스캔</Button>
        </Link>

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

        <ReceiptList
          receipts={receipts}
          onSelect={(receipt) => setSelectedPendingId(receipt.id)}
          isSelectable={(receipt) => receipt.status === 'pending'}
          onEdit={(receipt) => setEditTarget(receipt)}
          isEditable={(receipt) => receipt.status === 'synced'}
        />
      </div>

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
          onUpdate={(patch) => updateReceipt(editTarget.id, patch)}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  )
}
