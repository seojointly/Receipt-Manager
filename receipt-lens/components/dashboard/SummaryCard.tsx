import type { LucideIcon } from 'lucide-react'

interface SummaryCardProps {
  icon: LucideIcon
  label: string
  value: string | number
}

export function SummaryCard({ icon: Icon, label, value }: SummaryCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-white p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-50">
        <Icon className="h-5 w-5 text-zinc-500" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-zinc-400">{label}</p>
        <p className="truncate text-sm font-semibold text-zinc-900">{value}</p>
      </div>
    </div>
  )
}
