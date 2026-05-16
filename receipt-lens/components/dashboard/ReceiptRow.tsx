'use client'

import { Pencil } from 'lucide-react'
import type { Receipt } from '@/lib/types'
import { Badge } from '@/components/ui/Badge'

interface ReceiptRowProps {
  receipt: Receipt
  onClick?: () => void
  onEdit?: () => void
}

export function ReceiptRow({ receipt, onClick, onEdit }: ReceiptRowProps) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center justify-between rounded-2xl border border-zinc-100 bg-white px-4 py-3 text-sm ${
        onClick ? 'cursor-pointer hover:bg-zinc-50' : ''
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-zinc-900">{receipt.storeName}</p>
        <p className="text-xs text-zinc-400">{receipt.date}</p>
      </div>
      <div className="ml-3 flex shrink-0 items-center gap-3">
        <span className="font-semibold text-zinc-800">
          {receipt.totalAmount.toLocaleString('ko-KR')}원
        </span>
        <Badge status={receipt.status} />
        {onEdit && (
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
