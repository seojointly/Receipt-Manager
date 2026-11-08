import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isAuthenticated, isSameOrigin } from '@/lib/auth'

// Next.js 16: middleware → proxy (Node.js 런타임 기본)
// 1차 방어선. API route 내부에서도 isAuthenticated를 다시 확인한다(심층 방어).

const PUBLIC_PATHS = ['/login', '/api/auth']

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isApi = pathname.startsWith('/api/')

  // CSRF 이중 방어: 상태 변경 요청은 같은 출처에서만 허용
  if (req.method !== 'GET' && req.method !== 'HEAD' && !isSameOrigin(req)) {
    return NextResponse.json({ error: '허용되지 않은 요청입니다.', code: 'VALIDATION_ERROR' }, { status: 403 })
  }

  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next()
  }

  if (isAuthenticated(req)) {
    return NextResponse.next()
  }

  if (isApi) {
    return NextResponse.json({ error: '로그인이 필요합니다.', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const loginUrl = new URL('/login', req.url)
  loginUrl.searchParams.set('next', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  // 정적 리소스·이미지 최적화·파비콘·public 이미지 제외
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)'],
}
