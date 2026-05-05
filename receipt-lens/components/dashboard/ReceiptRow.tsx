'use client'

import type { Receipt } from '@/lib/types'
import { Badge } from '@/components/ui/Badge'

interface ReceiptRowProps {
  receipt: Receipt
  onClick?: () => void
}

export function ReceiptRow({ receipt, onClick }: ReceiptRowProps) {
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
      </div>
    </div>
  )
}
