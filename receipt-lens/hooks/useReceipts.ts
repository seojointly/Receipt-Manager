'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Receipt } from '@/lib/types'

const DATA_KEY = 'receipt_lens_data'
const IMAGE_KEY = 'receipt_lens_images'

type ReceiptData = Omit<Receipt, 'imageBase64'>
type ImageMap = Record<string, string>

function loadFromStorage(): Receipt[] {
  if (typeof window === 'undefined') return []
  try {
    const rawData = localStorage.getItem(DATA_KEY)
    const rawImages = localStorage.getItem(IMAGE_KEY)
    const dataArr: ReceiptData[] = rawData ? JSON.parse(rawData) : []
    const imageMap: ImageMap = rawImages ? JSON.parse(rawImages) : {}
    return dataArr.map(r => ({ ...r, imageBase64: imageMap[r.id] }))
  } catch {
    return []
  }
}

function saveToStorage(receipts: Receipt[]) {
  const dataArr: ReceiptData[] = receipts.map(r => ({
    id: r.id,
    date: r.date,
    storeName: r.storeName,
    supplyAmount: r.supplyAmount,
    taxAmount: r.taxAmount,
    totalAmount: r.totalAmount,
    category: r.category,
    memo: r.memo,
    status: r.status,
    createdAt: r.createdAt,
    ...(r.sheetsRowIndex !== undefined ? { sheetsRowIndex: r.sheetsRowIndex } : {}),
  }))
  const imageMap: ImageMap = {}
  receipts.forEach(r => {
    if (r.imageBase64) imageMap[r.id] = r.imageBase64
  })
  localStorage.setItem(DATA_KEY, JSON.stringify(dataArr))
  localStorage.setItem(IMAGE_KEY, JSON.stringify(imageMap))
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
    saveToStorage(receipts)
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

  const clearSynced = useCallback(() => {
    setReceipts(prev => prev.filter(r => r.status !== 'synced'))
  }, [])

  const clearFailed = useCallback((id?: string) => {
    if (id) {
      setReceipts(prev => prev.filter(r => r.id !== id))
    } else {
      setReceipts(prev => prev.filter(r => r.status === 'synced'))
    }
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
    clearSynced,
    clearFailed,
    totalSynced,
    syncedCount,
    pendingCount,
    isLoaded,
  }
}
