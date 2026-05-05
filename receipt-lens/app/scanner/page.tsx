'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { v4 as uuidv4 } from 'uuid'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import type { AnalyzeResult, Receipt } from '@/lib/types'
import { useReceipts } from '@/hooks/useReceipts'
import { ImageUploader } from '@/components/scanner/ImageUploader'
import { PreviewPanel } from '@/components/scanner/PreviewPanel'
import { ResultForm } from '@/components/scanner/ResultForm'
import { Spinner } from '@/components/ui/Spinner'

type Phase = 'upload' | 'analyzing' | 'result'

export default function ScannerPage() {
  const { receipts, addReceipt, updateReceipt, removeReceipt } = useReceipts()
  const [phase, setPhase] = useState<Phase>('upload')
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  async function handleImage(dataUrl: string) {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setImageDataUrl(dataUrl)
    setAnalyzeError(null)

    const id = uuidv4()
    setCurrentId(id)

    const stub: Receipt = {
      id,
      date: '',
      storeName: '',
      supplyAmount: 0,
      taxAmount: 0,
      totalAmount: 0,
      category: '',
      memo: '',
      imageBase64: dataUrl,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
    addReceipt(stub)
    setPhase('analyzing')

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
        signal: controller.signal,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '분석에 실패했습니다.')

      const result: AnalyzeResult = data
      setAnalyzeResult(result)
      updateReceipt(id, {
        date: result.date,
        storeName: result.storeName,
        supplyAmount: result.supplyAmount,
        taxAmount: result.taxAmount,
        totalAmount: result.totalAmount,
      })
      setPhase('result')
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') return
      removeReceipt(id)
      setCurrentId(null)
      setAnalyzeError(
        err instanceof Error ? err.message : '영수증 분석에 실패했습니다. 다시 시도해 주세요.'
      )
      setPhase('upload')
    }
  }

  function handleReset() {
    abortRef.current?.abort()
    if (currentId) removeReceipt(currentId)
    setPhase('upload')
    setImageDataUrl(null)
    setAnalyzeResult(null)
    setCurrentId(null)
    setAnalyzeError(null)
  }

  async function handleSync(category: string, memo: string) {
    if (!currentId || !analyzeResult) return

    const res = await fetch('/api/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: currentId,
        date: analyzeResult.date,
        storeName: analyzeResult.storeName,
        category,
        memo,
        totalAmount: analyzeResult.totalAmount,
      }),
    })
    const data = await res.json()

    if (!res.ok) {
      updateReceipt(currentId, { status: 'error' })
      throw new Error(data.error || '전송에 실패했습니다.')
    }

    updateReceipt(currentId, {
      status: 'synced',
      sheetsRowIndex: data.rowIndex,
      category,
      memo,
    })
  }

  const currentReceipt = currentId ? (receipts.find((r) => r.id === currentId) ?? null) : null

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
            {analyzeError && (
              <div className="flex items-start gap-2 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{analyzeError}</span>
              </div>
            )}
            <ImageUploader onImage={handleImage} />
          </>
        )}

        {phase === 'analyzing' && imageDataUrl && (
          <>
            <PreviewPanel src={imageDataUrl} onReset={handleReset} />
            <div className="flex flex-col items-center gap-3 py-6">
              <Spinner className="h-8 w-8" />
              <p className="text-sm text-zinc-500">AI가 영수증을 분석하고 있습니다...</p>
            </div>
          </>
        )}

        {phase === 'result' && imageDataUrl && analyzeResult && currentReceipt && (
          <>
            <PreviewPanel src={imageDataUrl} onReset={handleReset} />
            <ResultForm result={analyzeResult} receipt={currentReceipt} onSync={handleSync} />
          </>
        )}
      </div>
    </div>
  )
}
