import { NextRequest, NextResponse } from 'next/server'
import { model, buildReceiptPrompt } from '@/lib/gemini'
import { ReceiptSchema, parseCurrency } from '@/lib/validators'
import { isAuthenticated } from '@/lib/auth'

// 서버 측 이미지 제한 (클라이언트 검사는 우회 가능하므로 서버에서 재검증)
const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5MB (CLAUDE.md 기준)
const MAX_BASE64_LENGTH = Math.ceil(MAX_IMAGE_BYTES / 3) * 4
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
const DATA_URL_RE = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

const callGemini = async (mimeType: string, data: string, retry = 0): Promise<string> => {
  try {
    const result = await model.generateContent([
      { inlineData: { mimeType, data } },
      buildReceiptPrompt(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })),
    ])
    return result.response.text()
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status
    if (status === 503 && retry < 3) {
      await delay(2000 * Math.pow(2, retry)) // 2s → 4s → 8s
      return callGemini(mimeType, data, retry + 1)
    }
    throw err
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated(req)) {
    return NextResponse.json({ error: '로그인이 필요합니다.', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  let body: { image?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '이미지가 필요합니다.', code: 'PARSE_FAILED' }, { status: 400 })
  }

  const { image } = body
  if (!image || typeof image !== 'string') {
    return NextResponse.json({ error: '이미지가 필요합니다.', code: 'PARSE_FAILED' }, { status: 400 })
  }

  const match = DATA_URL_RE.exec(image)
  if (!match || !ALLOWED_MIME.has(match[1].toLowerCase())) {
    return NextResponse.json(
      { error: 'JPEG, PNG, WEBP, HEIC 이미지만 업로드할 수 있습니다.', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }
  const mimeType = match[1].toLowerCase()
  const data = match[2]
  if (data.length > MAX_BASE64_LENGTH) {
    return NextResponse.json(
      { error: '이미지 크기는 5MB 이하여야 합니다.', code: 'VALIDATION_ERROR' },
      { status: 413 }
    )
  }

  let text: string
  try {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ COST_GUARD: Gemini API called')
    }
    text = await callGemini(mimeType, data)
  } catch (err) {
    console.error('[/api/analyze] Gemini error:', err)
    return NextResponse.json(
      { error: 'AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', code: 'API_ERROR' },
      { status: 500 }
    )
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object')
  } catch {
    return NextResponse.json(
      { error: '영수증 정보를 인식하지 못했습니다. 더 선명한 사진으로 다시 시도해주세요.', code: 'PARSE_FAILED' },
      { status: 422 }
    )
  }

  if (parsed.error) {
    return NextResponse.json(
      { error: '영수증 이미지를 업로드해주세요.', code: 'PARSE_FAILED' },
      { status: 422 }
    )
  }

  const normalized = {
    ...parsed,
    supplyAmount: parseCurrency(parsed.supplyAmount),
    taxAmount: parseCurrency(parsed.taxAmount),
    totalAmount: parseCurrency(parsed.totalAmount),
  }

  const validation = ReceiptSchema.safeParse(normalized)
  if (!validation.success) {
    return NextResponse.json(
      { error: '영수증 정보를 인식하지 못했습니다. 더 선명한 사진으로 다시 시도해주세요.', code: 'PARSE_FAILED' },
      { status: 422 }
    )
  }

  return NextResponse.json(validation.data)
}
