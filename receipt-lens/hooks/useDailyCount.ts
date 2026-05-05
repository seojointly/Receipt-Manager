'use client'

import { useState, useEffect, useCallback } from 'react'

const DAILY_COUNT_KEY = 'receipt_lens_daily'
const LIMIT = 30

interface DailyCount {
  date: string
  count: number
}

function getTodayString() {
  return new Date().toISOString().slice(0, 10)
}

function loadCount(): number {
  if (typeof window === 'undefined') return 0
  try {
    const raw = localStorage.getItem(DAILY_COUNT_KEY)
    if (!raw) return 0
    const saved: DailyCount = JSON.parse(raw)
    return saved.date === getTodayString() ? saved.count : 0
  } catch {
    return 0
  }
}

export function useDailyCount() {
  const [todayCount, setTodayCount] = useState(0)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    setTodayCount(loadCount())
    setIsLoaded(true)
  }, [])

  const increment = useCallback(() => {
    setTodayCount(prev => {
      const next = prev + 1
      localStorage.setItem(DAILY_COUNT_KEY, JSON.stringify({ date: getTodayString(), count: next }))
      return next
    })
  }, [])

  return { todayCount, increment, limit: LIMIT, isLoaded }
}
