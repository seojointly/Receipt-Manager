'use client'

import { useState, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { X, AlertCircle } from 'lucide-react'
import type { Receipt } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { CATEGORIES } from '@/lib/categories'

interface EditReceiptModalProps {
  receipt: Receipt
  onUpdated: (patch: Partial<Receipt>) => void
  onCreated: (receipt: Receipt) => void
  onClose: () => void
}

const inputClass =
  'w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-800 focus:outline-none focus:border-zinc-400 disabled:cursor-not-allowed disabled:text-zinc-400'

export function EditReceiptModal({ receipt, onUpdated, onCreated, onClose }: EditReceiptModalProps) {
  const [creating, setCreating] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uuidWarning, setUuidWarning] = useState<boolean | null>(null) // null = 체크 중

  useEffect(() => {
    if (!receipt.id) return
    const checkUuid = async () => {
      try {
        const res = await fetch(`/api/sheets?checkId=${receipt.id}`)
        const data = await res.json()
        setUuidWarning(!data.exists)
      } catch {
        setUuidWarning(null)
      }
    }
    checkUuid()
  }, [receipt.id])
  const [date, setDate] = useState(receipt.date)
  const [storeName, setStoreName] = useState(receipt.storeName)
  const [category, setCategory] = useState(receipt.category || (CATEGORIES[0] ?? ''))
  const [memo, setMemo] = useState(receipt.memo || '')
  const [totalAmount, setTotalAmount] = useState(receipt.totalAmount)

  const validateForm = (): boolean => {
    if (!storeName.trim()) {
      setError('상호명을 입력하세요.')
      return false
    }
    if (totalAmount <= 0 || totalAmount % 10 !== 0) {
      setError('합계는 10원 단위 양수여야 합니다.')
      return false
    }
    return true
  }

  const handleCreate = async () => {
    if (!validateForm()) return
    setCreating(true)
    setError(null)

    const newReceipt: Receipt = {
      id: uuidv4(),
      date,
      storeName,
      category,
      memo,
      totalAmount,
      supplyAmount: Math.round(totalAmount / 1.1),
      taxAmount: totalAmount - Math.round(totalAmount / 1.1),
      status: 'pending',
      createdAt: new Date().toISOString(),
    }

    try {
      const res = await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newReceipt),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '생성 실패')

      onCreated({ ...newReceipt, status: 'synced', sheetsRowIndex: data.rowIndex })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '생성 실패')
    } finally {
      setCreating(false)
    }
  }

  const handleUpdate = async () => {
    if (!validateForm()) return
    setUpdating(true)
    setError(null)
    try {
      const res = await fetch('/api/sheets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: receipt.id, date, storeName, category, memo, totalAmount }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '업데이트 실패')
      onUpdated({ date, storeName, category, memo, totalAmount })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '업데이트 실패')
    } finally {
      setUpdating(false)
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

        {uuidWarning === true && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-700">
            <span className="shrink-0">⚠️</span>
            <span>
              Google Sheets에 등록되지 않은 영수증입니다.
              <br />
              <span className="text-xs text-yellow-600">[업데이트] 대신 [생성]을 사용하세요.</span>
            </span>
          </div>
        )}

        {uuidWarning === false && receipt.status === 'synced' && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-2 text-xs text-green-700">
            <span>✅</span>
            <span>Google Sheets에 등록된 영수증입니다.</span>
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-4 flex gap-2 pt-2">
          <Button
            variant="secondary"
            onClick={onClose}
            className="flex-1 text-sm py-2.5"
            disabled={creating || updating}
          >
            취소
          </Button>

          <Button
            variant="secondary"
            onClick={handleCreate}
            loading={creating}
            disabled={updating}
            className="flex-1 text-sm py-2.5 border-blue-200 text-blue-600 hover:bg-blue-50"
          >
            생성
          </Button>

          <Button
            onClick={handleUpdate}
            loading={updating}
            disabled={creating}
            className="flex-1 text-sm py-2.5"
          >
            업데이트
          </Button>
        </div>
      </div>
    </div>
  )
}
