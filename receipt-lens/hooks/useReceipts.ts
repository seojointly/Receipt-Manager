'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Receipt } from '@/lib/types'

const STORAGE_KEY = 'receipt_lens_data'

function loadFromStorage(): Receipt[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Receipt[]) : []
  } catch {
    return []
  }
}

export function useReceipts() {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    setReceipts(loadFromStorage())
    setIsLoaded(true)
  }, [])

  useEffect(() => {
    if (!isLoaded) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts))
  }, [receipts, isLoaded])

  const addReceipt = useCallback((receipt: Receipt) => {
    setReceipts((prev) => [receipt, ...prev])
  }, [])

  const updateReceipt = useCallback((id: string, patch: Partial<Receipt>) => {
    setReceipts((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
    )
  }, [])

  const removeReceipt = useCallback((id: string) => {
    setReceipts((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const syncedReceipts = receipts.filter((r) => r.status === 'synced')
  const totalSynced = syncedReceipts.reduce((sum, r) => sum + r.totalAmount, 0)
  const syncedCount = syncedReceipts.length
  const pendingCount = receipts.filter((r) => r.status === 'pending').length

  return {
    receipts,
    addReceipt,
    updateReceipt,
    removeReceipt,
    totalSynced,
    syncedCount,
    pendingCount,
    isLoaded,
  }
}
