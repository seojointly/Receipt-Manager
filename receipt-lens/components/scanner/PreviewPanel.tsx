'use client'

import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface PreviewPanelProps {
  src: string
  onReset: () => void
}

export function PreviewPanel({ src, onReset }: PreviewPanelProps) {
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-zinc-50">
        <img src={src} alt="영수증 미리보기" className="mx-auto max-h-64 w-full object-contain" />
      </div>
      <Button variant="secondary" onClick={onReset} className="w-full">
        <RotateCcw className="h-4 w-4" />
        재촬영
      </Button>
    </div>
  )
}
