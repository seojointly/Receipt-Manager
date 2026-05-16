'use client'

import { useState } from 'react'
import { X, AlertCircle } from 'lucide-react'
import type { Receipt } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { CATEGORIES } from '@/lib/categories'

interface EditReceiptModalProps {
  receipt: Receipt
  onUpdate: (patch: Partial<Receipt>) => void
  onClose: () => void
}

const inputClass =
  'w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-800 focus:outline-none focus:border-zinc-400 disabled:cursor-not-allowed disabled:text-zinc-400'

export function EditReceiptModal({ receipt, onUpdate, onClose }: EditReceiptModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [date, setDate] = useState(receipt.date)
  const [storeName, setStoreName] = useState(receipt.storeName)
  const [category, setCategory] = useState(receipt.category || (CATEGORIES[0] ?? ''))
  const [memo, setMemo] = useState(receipt.memo || '')
  const [totalAmount, setTotalAmount] = useState(receipt.totalAmount)

  const isValidTotal = Number.isInteger(totalAmount) && totalAmount % 10 === 0

  async function handleUpdate() {
    if (loading || !isValidTotal) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/sheets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: receipt.id, date, storeName, category, memo, totalAmount }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '업데이트 실패')
      onUpdate({ date, storeName, category, memo, totalAmount })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '업데이트 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900">영수증 수정</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-zinc-500">날짜</span>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-zinc-500">상호명</span>
            <input
              type="text"
              value={storeName}
              onChange={e => setStoreName(e.target.value)}
              placeholder="상호명"
              className={inputClass}
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-zinc-500">항목</span>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
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
              className={`${inputClass} font-semibold text-zinc-900`}
            />
          </div>
        </div>

        {!isValidTotal && (
          <p className="mt-2 text-xs text-amber-600">합계는 10원 단위여야 합니다</p>
        )}

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={loading}>
            취소
          </Button>
          <Button
            className="flex-1"
            onClick={handleUpdate}
            loading={loading}
            disabled={!isValidTotal}
          >
            Sheets 업데이트
          </Button>
        </div>
      </div>
    </div>
  )
}
