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
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ COST_GUARD: Gemini API called')
    }
    const result = await model.generateContent([
      { inlineData: { mimeType, data } },
      RECEIPT_SYSTEM_PROMPT,
    ])
    text = result.response.text()
  } catch {
    return NextResponse.json(
      { error: 'AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', code: 'API_ERROR' },
      { status: 500 }
    )
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(text)
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
    supplyAmount: parseCurrency(parsed.supplyAmount as string | number),
    taxAmount: parseCurrency(parsed.taxAmount as string | number),
    totalAmount: parseCurrency(parsed.totalAmount as string | number),
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
