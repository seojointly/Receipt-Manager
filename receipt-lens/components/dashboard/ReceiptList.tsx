'use client'

import { Receipt as ReceiptIcon } from 'lucide-react'
import type { Receipt } from '@/lib/types'
import { ReceiptRow } from './ReceiptRow'

interface ReceiptListProps {
  receipts: Receipt[]
  onSelect?: (receipt: Receipt) => void
}

export function ReceiptList({ receipts, onSelect }: ReceiptListProps) {
  if (receipts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 py-14">
        <ReceiptIcon className="h-10 w-10 text-zinc-300" />
        <p className="text-sm text-zinc-400">저장된 영수증이 없습니다</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {receipts.map((receipt) => (
        <ReceiptRow
          key={receipt.id}
          receipt={receipt}
          onClick={onSelect ? () => onSelect(receipt) : undefined}
        />
      ))}
    </div>
  )
}
