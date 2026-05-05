import { NextRequest, NextResponse } from 'next/server'
import { model, RECEIPT_SYSTEM_PROMPT } from '@/lib/gemini'
import { ReceiptSchema, parseCurrency } from '@/lib/validators'

export async function POST(req: NextRequest) {
  let body: { image?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '이미지가 필요합니다.', code: 'PARSE_FAILED' }, { status: 400 })
  }

  const { image } = body
  if (!image) {
    return NextResponse.json({ error: '이미지가 필요합니다.', code: 'PARSE_FAILED' }, { status: 400 })
  }

  const [meta, data] = image.split(',')
  const mimeType = meta.match(/:(.*?);/)?.[1] ?? 'image/jpeg'

  let text: string
  try {
    const result = await model.generateContent([
      { inlineData: { mimeType, data } },
      RECEIPT_SYSTEM_PROMPT,
    ])
    text = result.response.text()
  } catch (err) {
    const error = err instanceof Error ? err.message : '알 수 없는 오류'
    return NextResponse.json({ error, code: 'API_ERROR' }, { status: 500 })
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(text)
  } catch {
    return NextResponse.json(
      { error: `응답 파싱 실패: ${text.slice(0, 100)}`, code: 'PARSE_FAILED' },
      { status: 422 }
    )
  }

  if (parsed.error) {
    return NextResponse.json({ error: String(parsed.error), code: 'PARSE_FAILED' }, { status: 422 })
  }

  const normalized = {
    ...parsed,
    supplyAmount: parseCurrency(parsed.supplyAmount as string | number),
    taxAmount: parseCurrency(parsed.taxAmount as string | number),
    totalAmount: parseCurrency(parsed.totalAmount as string | number),
  }

  const validation = ReceiptSchema.safeParse(normalized)
  if (!validation.success) {
    return NextResponse.json(
      { error: `스키마 검증 실패: ${text.slice(0, 100)}`, code: 'PARSE_FAILED' },
      { status: 422 }
    )
  }

  return NextResponse.json(validation.data)
}
