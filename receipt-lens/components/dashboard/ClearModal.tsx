'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { Receipt } from '@/lib/types'
import { Button } from '@/components/ui/Button'

type View = 'options' | 'failed-list'

interface ClearModalProps {
  receipts: Receipt[]
  onClearSynced: () => void
  onClearFailed: (id?: string) => void
  onClose: () => void
}

export function ClearModal({ receipts, onClearSynced, onClearFailed, onClose }: ClearModalProps) {
  const [view, setView] = useState<View>('options')

  const failedReceipts = receipts.filter(r => r.status === 'error' || r.status === 'pending')

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {view === 'options' && (
          <>
            <h2 className="mb-4 text-base font-semibold text-zinc-900">초기화 옵션을 선택하세요</h2>
            <div className="space-y-2">
              <Button
                variant="danger"
                className="w-full"
                onClick={() => { onClearSynced(); onClose() }}
              >
                전송 완료 항목 삭제
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setView('failed-list')}
                disabled={failedReceipts.length === 0}
              >
                전송 실패 항목 삭제 ({failedReceipts.length}건)
              </Button>
              <Button variant="ghost" className="w-full" onClick={onClose}>
                취소
              </Button>
            </div>
          </>
        )}

        {view === 'failed-list' && (
          <>
            <h2 className="mb-1 text-base font-semibold text-zinc-900">전송 실패 항목</h2>
            <p className="mb-4 text-sm text-zinc-400">Sheet에 저장되지 않은 항목 목록입니다.</p>

            {failedReceipts.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-400">삭제할 항목이 없습니다.</p>
            ) : (
              <div className="max-h-56 space-y-2 overflow-y-auto">
                {failedReceipts.map(r => (
                  <div key={r.id} className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
                    <div className="mb-2">
                      <p className="text-sm font-medium text-zinc-800">{r.storeName || '(이름 없음)'}</p>
                      <p className="text-xs text-zinc-400">{r.date || '날짜 없음'}</p>
                    </div>
                    <div className="flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>이 항목은 Sheet에 저장되지 않았습니다. 그래도 삭제하시겠습니까?</span>
                    </div>
                    <Button
                      variant="danger"
                      className="mt-2 w-full text-xs"
                      onClick={() => onClearFailed(r.id)}
                    >
                      삭제
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 space-y-2">
              {failedReceipts.length > 0 && (
                <Button
                  variant="danger"
                  className="w-full"
                  onClick={() => { onClearFailed(); onClose() }}
                >
                  전체 삭제 ({failedReceipts.length}건)
                </Button>
              )}
              <Button variant="ghost" className="w-full" onClick={onClose}>
                닫기
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
