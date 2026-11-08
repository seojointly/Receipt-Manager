'use client'

import { Pencil } from 'lucide-react'
import type { Receipt } from '@/lib/types'
import { Badge } from '@/components/ui/Badge'

interface ReceiptRowProps {
  receipt: Receipt
  onClick?: () => void
  onEdit?: () => void
  selectionMode?: boolean
  isSelected?: boolean
  onToggleSelect?: () => void
  className?: string
}

export function ReceiptRow({ receipt, onClick, onEdit, selectionMode, isSelected, onToggleSelect, className = '' }: ReceiptRowProps) {
  function handleRowClick() {
    if (selectionMode) {
      onToggleSelect?.()
    } else {
      onClick?.()
    }
  }

  return (
    <div
      onClick={handleRowClick}
      className={`flex items-center justify-between rounded-2xl border bg-white px-4 py-3 text-sm transition-colors ${
        isSelected
          ? 'border-blue-300 bg-blue-50'
          : 'border-zinc-100 hover:bg-zinc-50'
      } ${selectionMode || onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {selectionMode && (
        <div className="mr-3 shrink-0">
          <input
            type="checkbox"
            checked={isSelected ?? false}
            onChange={onToggleSelect}
            onClick={e => e.stopPropagation()}
            className="h-4 w-4 rounded accent-blue-600"
          />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-zinc-900">{receipt.storeName}</p>
        <p className="text-xs text-zinc-400">{receipt.date}</p>
      </div>

      <div className="ml-3 flex shrink-0 items-center gap-3">
        <span className="font-semibold text-zinc-800">
          {receipt.totalAmount.toLocaleString('ko-KR')}원
        </span>
        <Badge status={receipt.status} />
        {!selectionMode && onEdit && (
          <button
            onClick={e => { e.stopPropagation(); onEdit() }}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            aria-label="영수증 수정"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
