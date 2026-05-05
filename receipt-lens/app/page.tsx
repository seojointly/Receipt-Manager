'use client'

import Link from 'next/link'
import { CircleDollarSign, CheckCircle2, Clock } from 'lucide-react'
import { useReceipts } from '@/hooks/useReceipts'
import { SummaryCard } from '@/components/dashboard/SummaryCard'
import { ReceiptList } from '@/components/dashboard/ReceiptList'
import { Button } from '@/components/ui/Button'

export default function DashboardPage() {
  const { receipts, totalSynced, syncedCount, pendingCount, isLoaded } = useReceipts()

  if (!isLoaded) return null

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-lg space-y-6 p-4">
        <div>
          <p className="text-sm text-zinc-400">ReceiptLens</p>
          <h1 className="text-2xl font-bold text-zinc-900">영수증 대시보드</h1>
        </div>

        <div className="grid grid-cols-3 gap-3">
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
        </div>

        <Link href="/scanner" className="block">
          <Button className="w-full">새 영수증 스캔</Button>
        </Link>

        <ReceiptList receipts={receipts} />
      </div>
    </div>
  )
}
