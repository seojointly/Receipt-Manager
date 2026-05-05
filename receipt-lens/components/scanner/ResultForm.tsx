'use client'

import { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import type { Receipt, AnalyzeResult } from '@/lib/types'
import { Button } from '@/components/ui/Button'

interface ResultFormProps {
  result: AnalyzeResult
  receipt: Receipt
  onSync: () => Promise<void>
}

function formatKRW(amount: number) {
  return amount.toLocaleString('ko-KR') + '원'
}

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-zinc-500">{label}</span>
      <span className={bold ? 'font-semibold text-zinc-900' : 'text-zinc-800'}>{value}</span>
    </div>
  )
}

export function ResultForm({ result, receipt, onSync }: ResultFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(false)

  const isSynced = receipt.status === 'synced'

  async function handleSync() {
    if (isSynced || loading || cooldown) return
    setError(null)
    setLoading(true)
    setCooldown(true)
    try {
      await onSync()
    } catch (err) {
      setError(err instanceof Error ? err.message : '전송에 실패했습니다.')
    } finally {
      setLoading(false)
      setTimeout(() => setCooldown(false), 3000) // ⚠️ COST_GUARD: 3초 재클릭 방지
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-100 bg-white p-4">
      <div className="space-y-2 text-sm">
        <Row label="날짜" value={result.date} />
        <Row label="상호명" value={result.storeName} />
        <Row label="공급가액" value={formatKRW(result.supplyAmount)} />
        <Row label="부가세" value={formatKRW(result.taxAmount)} />
        <Row label="합계" value={formatKRW(result.totalAmount)} bold />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button onClick={handleSync} loading={loading} disabled={isSynced || cooldown} className="w-full">
        {isSynced ? '이미 전송됨' : 'Google Sheets에 전송'}
      </Button>
    </div>
  )
}
