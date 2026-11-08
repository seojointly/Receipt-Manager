import { NextRequest, NextResponse } from 'next/server'
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
  isAuthConfigured,
  verifyPassword,
} from '@/lib/auth'

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

// 로그인: 비밀번호 확인 → httpOnly + SameSite=Lax 세션 쿠키 발급
export async function POST(req: NextRequest) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      { error: '서버에 APP_PASSWORD(8자 이상)가 설정되지 않았습니다.', code: 'AUTH_REQUIRED' },
      { status: 500 }
    )
  }

  let password: unknown
  try {
    password = (await req.json())?.password
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  if (!verifyPassword(password)) {
    await delay(1000) // 무차별 대입 속도 제한 (무료)
    return NextResponse.json({ error: '비밀번호가 올바르지 않습니다.', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const res = NextResponse.json({ success: true })
  res.cookies.set(SESSION_COOKIE, createSessionToken()!, {
    httpOnly: true, // JS(document.cookie)로 읽기 불가 → XSS로 탈취 방지
    // Lax: 메일·다른 사이트 링크로 들어오는 GET에는 쿠키를 보내 로그인 유지(Strict는 매번 로그인됨).
    // 다른 사이트발 POST/PUT에는 여전히 미전송 → CSRF 방지. 데이터 변경 GET이 없어서 안전.
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production', // 운영(https)에서만 Secure. 로컬 http(192.168.x.x) 개발 허용
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
  return res
}

// 로그아웃: 쿠키 삭제
export async function DELETE() {
  const res = NextResponse.json({ success: true })
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 })
  return res
}
