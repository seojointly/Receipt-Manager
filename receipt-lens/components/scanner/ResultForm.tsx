'use client'

import { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import type { Receipt, AnalyzeResult } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { CATEGORIES } from '@/lib/categories'

export interface SyncData {
  date: string
  storeName: string
  category: string
  memo: string
  totalAmount: number
}

interface ResultFormProps {
  result: AnalyzeResult
  receipt: Receipt
  onSync: (data: SyncData) => Promise<void>
}

const inputClass =
  'w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-800 focus:outline-none focus:border-zinc-400 disabled:cursor-not-allowed disabled:text-zinc-400'

export function ResultForm({ result, receipt, onSync }: ResultFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(false)
  const [date, setDate] = useState(result.date)
  const [storeName, setStoreName] = useState(result.storeName)
  const [category, setCategory] = useState(CATEGORIES[0] ?? '')
  const [memo, setMemo] = useState('')
  const [totalAmount, setTotalAmount] = useState(result.totalAmount)

  const isSynced = receipt.status === 'synced'
  const isValidTotal = Number.isInteger(totalAmount) && totalAmount % 10 === 0

  async function handleSync() {
    if (isSynced || loading || cooldown || !isValidTotal) return
    setError(null)
    setLoading(true)
    setCooldown(true)
    try {
      await onSync({ date, storeName, category, memo, totalAmount })
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
        <div className="flex items-center gap-3">
          <span className="w-14 shrink-0 text-zinc-500">날짜</span>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            disabled={isSynced}
            className={inputClass}
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="w-14 shrink-0 text-zinc-500">상호명</span>
          <input
            type="text"
            value={storeName}
            onChange={e => setStoreName(e.target.value)}
            disabled={isSynced}
            placeholder="상호명"
            className={inputClass}
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="w-14 shrink-0 text-zinc-500">항목</span>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            disabled={isSynced}
            className={inputClass}
          >
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="flex items-start gap-3">
          <span className="w-14 shrink-0 pt-2 text-zinc-500">메모</span>
          <textarea
            rows={2}
            value={memo}
            onChange={e => setMemo(e.target.value)}
            disabled={isSynced}
            placeholder="메모 입력 (선택)"
            className={`${inputClass} resize-none`}
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="w-14 shrink-0 font-medium text-zinc-500">합계</span>
          <input
            type="number"
            step={10}
            value={totalAmount}
            onChange={e => setTotalAmount(Number(e.target.value))}
            disabled={isSynced}
            className={`${inputClass} font-semibold text-zinc-900`}
          />
        </div>
      </div>

      {!isValidTotal && !isSynced && (
        <p className="text-xs text-amber-600">합계는 10원 단위여야 합니다</p>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button
        onClick={handleSync}
        loading={loading}
        disabled={isSynced || cooldown || !isValidTotal}
        className="w-full"
      >
        {isSynced ? '완료되었습니다.' : 'Google Sheets에 전송'}
      </Button>
    </div>
  )
}
