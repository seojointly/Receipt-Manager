'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Receipt } from '@/lib/types'
import { saveImage, deleteImage, clearAllImages } from '@/lib/imageDB'

const DATA_KEY = 'receipt_lens_data'

function loadFromStorage(): Receipt[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(DATA_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveToStorage(receipts: Receipt[]) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const dataArr = receipts.map(({ imageBase64: _, ...r }) => r)
  localStorage.setItem(DATA_KEY, JSON.stringify(dataArr))
}

export function useReceipts() {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    // 기존 localStorage 이미지 → IndexedDB 1회 마이그레이션
    const migrate = async () => {
      const old = localStorage.getItem('receipt_lens_images')
      if (!old) return
      try {
        const map: Record<string, string> = JSON.parse(old)
        for (const [id, base64] of Object.entries(map)) {
          await saveImage(id, base64)
        }
        localStorage.removeItem('receipt_lens_images')
      } catch {
        console.warn('[migration] IndexedDB 마이그레이션 실패')
      }
    }
    migrate()

    setReceipts(loadFromStorage())
    setIsLoaded(true)
  }, [])

  useEffect(() => {
    if (!isLoaded) return
    saveToStorage(receipts)
  }, [receipts, isLoaded])

  const addReceipt = useCallback((receipt: Receipt) => {
    const { imageBase64, ...receiptData } = receipt
    if (imageBase64) {
      saveImage(receipt.id, imageBase64).catch(() => {})
    }
    setReceipts(prev => [receiptData as Receipt, ...prev])
  }, [])

  const updateReceipt = useCallback((id: string, patch: Partial<Receipt>) => {
    if (patch.status === 'synced') {
      deleteImage(id).catch(() => {})
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { imageBase64: _, ...safePatch } = patch
    setReceipts(prev => prev.map(r => r.id === id ? { ...r, ...safePatch } : r))
  }, [])

  const removeReceipt = useCallback((id: string) => {
    deleteImage(id).catch(() => {})
    setReceipts(prev => prev.filter(r => r.id !== id))
  }, [])

  const removeReceipts = useCallback((ids: string[]) => {
    ids.forEach(id => deleteImage(id).catch(() => {}))
    setReceipts(prev => prev.filter(r => !ids.includes(r.id)))
  }, [])

  const clearSynced = useCallback(() => {
    setReceipts(prev => {
      prev.filter(r => r.status === 'synced').forEach(r => deleteImage(r.id).catch(() => {}))
      return prev.filter(r => r.status !== 'synced')
    })
  }, [])

  const clearFailed = useCallback((id?: string) => {
    if (id) {
      deleteImage(id).catch(() => {})
      setReceipts(prev => prev.filter(r => r.id !== id))
    } else {
      setReceipts(prev => {
        prev.filter(r => r.status !== 'synced').forEach(r => deleteImage(r.id).catch(() => {}))
        return prev.filter(r => r.status === 'synced')
      })
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
    removeReceipts,
    clearSynced,
    clearFailed,
    totalSynced,
    syncedCount,
    pendingCount,
    isLoaded,
  }
}
