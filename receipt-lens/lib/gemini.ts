import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: {
    responseMimeType: 'application/json',
  },
})

export const RECEIPT_SYSTEM_PROMPT = `영수증 이미지를 분석하여 반드시 아래 JSON만 출력하라.
마크다운 코드블록 없이 순수 JSON만 응답하라.
{
  "date": "YYYY-MM-DD",
  "storeName": "상호명",
  "supplyAmount": 숫자,
  "taxAmount": 숫자,
  "totalAmount": 숫자
}
규칙:
- 날짜 없으면 오늘 날짜 사용
- 공급가액/부가세 없으면 totalAmount 기준 10/11, 1/11 계산
- 모든 금액은 정수(원 단위)
- 영수증이 아닌 이미지: {"error": "영수증이 아닙니다"}`
