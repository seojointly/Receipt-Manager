'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Receipt, SyncData } from '@/lib/types'

const DATA_KEY = 'receipt_lens_data'

function loadFromStorage(): Receipt[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(DATA_KEY)
    const list: Receipt[] = raw ? JSON.parse(raw) : []
    // 분석 도중 페이지를 떠나면(뒤로가기·새로고침·탭 닫기) 내용이 빈 stub이 남는다.
    // 새로 불러올 때는 그 분석이 이미 끝난 상태이므로 버린다.
    return list.filter(r => !(r.status === 'pending' && !r.date))
  } catch {
    return []
  }
}

export function useReceipts() {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    // 예전 버전이 남긴 이미지 저장소 정리 (읽는 곳이 없던 데이터)
    try {
      localStorage.removeItem('receipt_lens_images')
      indexedDB?.deleteDatabase('receipt_lens_db')
    } catch {}

    setReceipts(loadFromStorage())
    setIsLoaded(true)
  }, [])

  useEffect(() => {
    if (!isLoaded) return
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(receipts))
    } catch {
      console.warn('[useReceipts] localStorage 저장 실패')
    }
  }, [receipts, isLoaded])

  const addReceipt = useCallback((receipt: Receipt) => {
    setReceipts(prev => [receipt, ...prev])
  }, [])

  const updateReceipt = useCallback((id: string, patch: Partial<Receipt>) => {
    setReceipts(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
  }, [])

  const removeReceipt = useCallback((id: string) => {
    setReceipts(prev => prev.filter(r => r.id !== id))
  }, [])

  /** 시트 전송 + 로컬 상태 반영. 화면에서 고친 값(날짜·상호·금액 포함)을 그대로 저장한다. */
  const syncReceipt = useCallback(async (id: string, data: SyncData) => {
    const res = await fetch('/api/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...data }),
    })
    const resData = await res.json().catch(() => ({}))
    if (!res.ok) {
      updateReceipt(id, { status: 'error' })
      throw new Error(resData.error || '전송에 실패했습니다.')
    }
    updateReceipt(id, { ...data, status: 'synced', sheetsRowIndex: resData.rowIndex })
  }, [updateReceipt])

  const clearSynced = useCallback(() => {
    setReceipts(prev => prev.filter(r => r.status !== 'synced'))
  }, [])

  const clearFailed = useCallback((id?: string) => {
    setReceipts(prev => id
      ? prev.filter(r => r.id !== id)
      : prev.filter(r => r.status === 'synced'))
  }, [])

  const syncedReceipts = receipts.filter(r => r.status === 'synced')
  const totalSynced = syncedReceipts.reduce((sum, r) => sum + r.totalAmount, 0)
  const syncedCount = syncedReceipts.length
  const pendingCount = receipts.filter(r => r.status === 'pending').length

  return {
    receipts,
    addReceipt,
    updateReceipt,
    removeReceipt,
    syncReceipt,
    clearSynced,
    clearFailed,
    totalSynced,
    syncedCount,
    pendingCount,
    isLoaded,
  }
}
