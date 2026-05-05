'use client'

import { useState, useEffect, useImperativeHandle, forwardRef } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'

export interface SheetPreviewHandle {
  refresh: () => void
}

const HEADERS = ['날짜', '상호명', '항목', '메모', '합계']

export const SheetPreview = forwardRef<SheetPreviewHandle>(function SheetPreview(_, ref) {
  const [rows, setRows] = useState<string[][]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchRows = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/sheets')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRows(data.rows)
    } catch {
      setError('데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useImperativeHandle(ref, () => ({ refresh: fetchRows }))

  useEffect(() => { fetchRows() }, [])

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">Sheet 미리보기</p>
        <Button
          variant="ghost"
          onClick={fetchRows}
          disabled={loading}
          className="h-8 px-2 text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
      </div>

      {loading && (
        <div className="flex justify-center py-4">
          <Spinner className="h-5 w-5" />
        </div>
      )}

      {!loading && error && (
        <p className="py-2 text-center text-sm text-red-500">{error}</p>
      )}

      {!loading && !error && rows.length === 0 && (
        <p className="py-2 text-center text-sm text-zinc-400">데이터가 없습니다.</p>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[400px] text-left">
            <thead>
              <tr>
                {HEADERS.map(h => (
                  <th key={h} className="pb-2 pr-3 text-xs font-medium text-zinc-500 last:pr-0 last:text-right">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className={i % 2 === 1 ? 'bg-zinc-50' : ''}>
                  {/* index 0 = UUID 제외, index 1~5 표시 */}
                  {[1, 2, 3, 4, 5].map((colIdx, j) => (
                    <td
                      key={j}
                      className={`py-1.5 pr-3 text-sm text-zinc-800 last:pr-0 ${j === 4 ? 'text-right font-semibold' : ''}`}
                    >
                      {j === 4 && row[colIdx]
                        ? Number(row[colIdx]).toLocaleString('ko-KR') + '원'
                        : (row[colIdx] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {process.env.NEXT_PUBLIC_GOOGLE_SHEET_URL && (
        <a
          href={process.env.NEXT_PUBLIC_GOOGLE_SHEET_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-sm text-blue-500 underline"
        >
          Google Sheets 열기 →
        </a>
      )}
    </div>
  )
})
