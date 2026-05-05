import type { Receipt } from '@/lib/types'

const statusConfig: Record<Receipt['status'], { label: string; className: string }> = {
  pending: { label: '대기중', className: 'bg-yellow-100 text-yellow-800' },
  synced: { label: '전송됨', className: 'bg-green-100 text-green-800' },
  error: { label: '오류', className: 'bg-red-100 text-red-800' },
}

export function Badge({ status }: { status: Receipt['status'] }) {
  const { label, className } = statusConfig[status]
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}
