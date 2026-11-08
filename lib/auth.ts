import { createHmac, timingSafeEqual } from 'node:crypto'
import type { NextRequest } from 'next/server'

// 개인용 단일 비밀번호 인증 (외부 서비스·비용 0원)
// - 비밀번호: APP_PASSWORD (.env.local / Vercel 환경변수에만 존재)
// - 세션 쿠키: HMAC(APP_PASSWORD, 고정 문자열) → 비밀번호를 바꾸면 기존 세션이 모두 무효화됨

export const SESSION_COOKIE = 'rl_session'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30일

const SESSION_MESSAGE = 'receipt-lens-session-v1'

const getPassword = (): string | null => {
  const pw = process.env.APP_PASSWORD
  return pw && pw.length >= 8 ? pw : null
}

const safeEqual = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/** APP_PASSWORD가 설정되어 있는지 (미설정 시 모든 요청 차단 = fail-closed) */
export const isAuthConfigured = (): boolean => getPassword() !== null

const sign = (pw: string, exp: number) =>
  createHmac('sha256', pw).update(`${SESSION_MESSAGE}.${exp}`).digest('hex')

/**
 * 세션 토큰 = "만료시각.서명". 만료시각까지 서명해서 서버가 만료를 직접 검사한다
 * (쿠키 maxAge는 브라우저 설정일 뿐이라, 탈취된 쿠키를 막지 못함).
 * shortcut: 로그아웃해도 이미 복사된 토큰은 만료 전까지 유효(서버 저장소 없음). 즉시 무효화가 필요하면 APP_PASSWORD 변경.
 */
export const createSessionToken = (now = Date.now()): string | null => {
  const pw = getPassword()
  if (!pw) return null
  const exp = now + SESSION_MAX_AGE * 1000
  return `${exp}.${sign(pw, exp)}`
}

export const verifyPassword = (input: unknown): boolean => {
  const pw = getPassword()
  if (!pw || typeof input !== 'string') return false
  return safeEqual(input, pw)
}

export const isAuthenticated = (req: Pick<NextRequest, 'cookies'>, now = Date.now()): boolean => {
  const pw = getPassword()
  const [expStr, sig] = req.cookies.get(SESSION_COOKIE)?.value.split('.') ?? []
  const exp = Number(expStr)
  if (!pw || !sig || !Number.isSafeInteger(exp) || exp <= now) return false
  return safeEqual(sig, sign(pw, exp))
}

/**
 * 상태 변경 요청(POST/PUT/DELETE)의 Origin 검사 — SameSite 쿠키와 함께 쓰는 CSRF 이중 방어.
 * Origin 헤더가 없으면(일부 구형 클라이언트) SameSite=Strict에 맡기고 통과.
 */
export const isSameOrigin = (req: NextRequest): boolean => {
  const origin = req.headers.get('origin')
  if (!origin) return true
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}
