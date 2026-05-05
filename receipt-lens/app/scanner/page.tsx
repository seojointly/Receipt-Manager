'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import { ArrowLeft, AlertCircle, RotateCcw, Home } from 'lucide-react'
import type { AnalyzeResult, Receipt } from '@/lib/types'
import type { SyncData } from '@/components/scanner/ResultForm'
import { useReceipts } from '@/hooks/useReceipts'
import { useDailyCount } from '@/hooks/useDailyCount'
import { ImageUploader } from '@/components/scanner/ImageUploader'
import { ResultForm } from '@/components/scanner/ResultForm'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'

type ScanItemStatus = 'analyzing' | 'result' | 'error'

interface ScanItem {
  id: string
  imageDataUrl: string
  status: ScanItemStatus
  analyzeResult: AnalyzeResult | null
  error: string | null
}

export default function ScannerPage() {
  const router = useRouter()
  const { receipts, addReceipt, updateReceipt, removeReceipt } = useReceipts()
  const { todayCount, increment, limit } = useDailyCount()
  const [phase, setPhase] = useState<'upload' | 'scanning'>('upload')
  const [scanItems, setScanItems] = useState<ScanItem[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const isLimitReached = todayCount >= limit

  async function handleImages(images: string[]) {
    if (isLimitReached) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setUploadError(null)

    const newItems: ScanItem[] = images.map(img => ({
      id: uuidv4(),
      imageDataUrl: img,
      status: 'analyzing',
      analyzeResult: null,
      error: null,
    }))

    newItems.forEach(item => {
      addReceipt({
        id: item.id,
        date: '',
        storeName: '',
        supplyAmount: 0,
        taxAmount: 0,
        totalAmount: 0,
        category: '',
        memo: '',
        imageBase64: item.imageDataUrl,
        status: 'pending',
        createdAt: new Date().toISOString(),
      })
    })

    setScanItems(newItems)
    setPhase('scanning')

    let remaining = limit - todayCount

    for (const item of newItems) {
      if (controller.signal.aborted) break

      if (remaining <= 0) {
        setScanItems(prev =>
          prev.map(i => i.id === item.id
            ? { ...i, status: 'error', error: '오늘 사용 한도에 도달했습니다.' }
            : i
          )
        )
        removeReceipt(item.id)
        continue
      }

      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: item.imageDataUrl }),
          signal: controller.signal,
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || '분석에 실패했습니다.')

        increment()
        remaining--

        const result: AnalyzeResult = data
        setScanItems(prev =>
          prev.map(i => i.id === item.id
            ? { ...i, status: 'result', analyzeResult: result }
            : i
          )
        )
        updateReceipt(item.id, {
          date: result.date,
          storeName: result.storeName,
          supplyAmount: result.supplyAmount,
          taxAmount: result.taxAmount,
          totalAmount: result.totalAmount,
        })
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') break
        const message = err instanceof Error ? err.message : '분석에 실패했습니다.'
        setScanItems(prev =>
          prev.map(i => i.id === item.id
            ? { ...i, status: 'error', error: message }
            : i
          )
        )
        removeReceipt(item.id)
      }
    }
  }

  function handleReset() {
    abortRef.current?.abort()
    scanItems.forEach(item => {
      const receipt = receipts.find(r => r.id === item.id)
      if (!receipt || receipt.status !== 'synced') {
        removeReceipt(item.id)
      }
    })
    setScanItems([])
    setPhase('upload')
    setUploadError(null)
  }

  function handleHome() {
    handleReset()
    router.push('/')
  }

  function createSyncHandler(itemId: string) {
    return async (data: SyncData) => {
      const res = await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId, ...data }),
      })
      const resData = await res.json()

      if (!res.ok) {
        updateReceipt(itemId, { status: 'error' })
        throw new Error(resData.error || '전송에 실패했습니다.')
      }

      // 항목 6: 전송 성공 후 이미지 삭제 (imageBase64: undefined → saveToStorage에서 imageMap에서 제외)
      updateReceipt(itemId, {
        status: 'synced',
        sheetsRowIndex: resData.rowIndex,
        category: data.category,
        memo: data.memo,
        imageBase64: undefined,
      })
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-lg space-y-6 p-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <p className="text-sm text-zinc-400">ReceiptLens</p>
            <h1 className="text-xl font-bold text-zinc-900">영수증 스캐너</h1>
          </div>
        </div>

        {phase === 'upload' && (
          <>
            {isLimitReached && (
              <div className="flex items-start gap-2 rounded-2xl bg-amber-50 p-4 text-sm text-amber-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>오늘 사용 한도에 도달했습니다. (일 {limit}회)</span>
              </div>
            )}
            {uploadError && (
              <div className="flex items-start gap-2 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}
            <ImageUploader onImages={handleImages} disabled={isLimitReached} />
          </>
        )}

        {phase === 'scanning' && (
          <>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleReset} className="flex-1">
                <RotateCcw className="h-4 w-4" />
                재촬영
              </Button>
              <Button variant="secondary" onClick={handleHome} className="flex-1">
                <Home className="h-4 w-4" />
                처음으로
              </Button>
            </div>

            <div className="space-y-8">
              {scanItems.map((item, idx) => {
                const receipt = receipts.find(r => r.id === item.id)
                return (
                  <div key={item.id} className="space-y-3">
                    <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-zinc-50">
                      <img
                        src={item.imageDataUrl}
                        alt={`영수증 ${idx + 1}`}
                        className="mx-auto max-h-48 w-full object-contain"
                      />
                    </div>

                    {item.status === 'analyzing' && (
                      <div className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-white p-4">
                        <Spinner className="h-5 w-5" />
                        <p className="text-sm text-zinc-500">AI가 분석하고 있습니다...</p>
                      </div>
                    )}

                    {item.status === 'error' && (
                      <div className="flex items-start gap-2 rounded-2xl bg-red-50 p-4 text-sm text-red-600">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{item.error}</span>
                      </div>
                    )}

                    {item.status === 'result' && item.analyzeResult && receipt && (
                      <ResultForm
                        result={item.analyzeResult}
                        receipt={receipt}
                        onSync={createSyncHandler(item.id)}
                      />
                    )}

                    {idx < scanItems.length - 1 && (
                      <hr className="border-zinc-200" />
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {process.env.NEXT_PUBLIC_GOOGLE_SHEET_URL && (
          <div className="rounded-2xl border border-zinc-100 bg-white p-4">
            <p className="mb-2 text-sm text-zinc-500">Sheet 미리보기</p>
            <a
              href={process.env.NEXT_PUBLIC_GOOGLE_SHEET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-500 underline"
            >
              Google Sheets 열기 →
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
