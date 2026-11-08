'use client'

import { useState, type FormEvent } from 'react'
import { Lock } from 'lucide-react'

// 리다이렉트 대상은 내부 경로만 허용 (오픈 리다이렉트 방지)
// '/\evil.com'처럼 브라우저가 '\'를 '/'로 바꿔 '//evil.com'이 되는 경우까지 막기 위해
// 현재 origin 기준으로 해석한 뒤 origin이 같은지 비교한다.
const safeNext = (value: string | null): string => {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /[\x00-\x1f]/.test(value)) {
    return '/'
  }
  try {
    const url = new URL(value, window.location.origin)
    return url.origin === window.location.origin ? url.pathname + url.search + url.hash : '/'
  } catch {
    return '/'
  }
}

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? '로그인에 실패했습니다.')
        return
      }
      const next = safeNext(new URLSearchParams(window.location.search).get('next'))
      window.location.replace(next)
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-lg mx-auto bg-white rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-zinc-900">
          <Lock className="w-5 h-5" />
          <h1 className="text-lg font-semibold">ReceiptLens 로그인</h1>
        </div>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="비밀번호"
          className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-zinc-900"
          autoFocus
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading || password.length === 0}
          className="w-full rounded-xl bg-zinc-900 text-white py-3 font-medium disabled:opacity-50"
        >
          {loading ? '확인 중…' : '로그인'}
        </button>
      </form>
    </main>
  )
}
