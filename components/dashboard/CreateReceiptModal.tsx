'use client'
import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { CATEGORIES } from '@/lib/categories'
import type { Receipt } from '@/lib/types'

interface Props {
  onClose: () => void
  onCreated: (receipt: Receipt) => void
}

export const CreateReceiptModal = ({ onClose, onCreated }: Props) => {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    date: today,
    storeName: '',
    category: CATEGORIES[0],
    memo: '',
    totalAmount: 0,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isValidTotal = form.totalAmount > 0 && form.totalAmount % 10 === 0

  const handleSubmit = async () => {
    if (!form.storeName.trim()) {
      setError('상호명을 입력하세요.')
      return
    }
    if (!isValidTotal) {
      setError('합계는 10원 단위 양수여야 합니다.')
      return
    }

    setLoading(true)
    setError('')

    const newReceipt: Receipt = {
      id: uuidv4(),
      ...form,
      supplyAmount: Math.round(form.totalAmount / 1.1),
      taxAmount: form.totalAmount - Math.round(form.totalAmount / 1.1),
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
      if (!res.ok) throw new Error(data.error)

      onCreated({ ...newReceipt, status: 'synced', sheetsRowIndex: data.rowIndex })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '생성 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-zinc-900">새 항목 추가</h2>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">날짜</label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-500 mb-1 block">상호명</label>
            <input
              type="text"
              value={form.storeName}
              onChange={e => setForm(p => ({ ...p, storeName: e.target.value }))}
              placeholder="상호명 입력"
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-500 mb-1 block">항목</label>
            <select
              value={form.category}
              onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm"
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-zinc-500 mb-1 block">메모</label>
            <textarea
              value={form.memo}
              onChange={e => setForm(p => ({ ...p, memo: e.target.value }))}
              placeholder="메모 입력 (선택)"
              rows={2}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm resize-none"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-500 mb-1 block">합계 (10원 단위)</label>
            <input
              type="number"
              value={form.totalAmount || ''}
              onChange={e => setForm(p => ({ ...p, totalAmount: Number(e.target.value) }))}
              step={10}
              placeholder="0"
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        {error && (
          <p className="text-red-500 text-xs">{error}</p>
        )}

        <div className="flex gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            취소
          </Button>
          <Button
            onClick={handleSubmit}
            loading={loading}
            disabled={!isValidTotal || !form.storeName.trim()}
            className="flex-1"
          >
            저장 및 전송
          </Button>
        </div>
      </div>
    </div>
  )
}
