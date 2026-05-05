'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CircleDollarSign, CheckCircle2, Clock, ExternalLink, Trash2, Zap } from 'lucide-react'
import { useReceipts } from '@/hooks/useReceipts'
import { useDailyCount } from '@/hooks/useDailyCount'
import { SummaryCard } from '@/components/dashboard/SummaryCard'
import { ReceiptList } from '@/components/dashboard/ReceiptList'
import { ClearModal } from '@/components/dashboard/ClearModal'
import { Button } from '@/components/ui/Button'

const SHEET_URL = process.env.NEXT_PUBLIC_GOOGLE_SHEET_URL

export default function DashboardPage() {
  const { receipts, totalSynced, syncedCount, pendingCount, isLoaded, clearSynced, clearFailed } = useReceipts()
  const { todayCount, limit } = useDailyCount()
  const [showClearModal, setShowClearModal] = useState(false)

  if (!isLoaded) return null

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

        <ReceiptList receipts={receipts} />
      </div>

      {showClearModal && (
        <ClearModal
          receipts={receipts}
          onClearSynced={clearSynced}
          onClearFailed={clearFailed}
          onClose={() => setShowClearModal(false)}
        />
      )}
    </div>
  )
}
