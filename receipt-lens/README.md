# ReceiptLens

영수증 사진을 Gemini Vision으로 분석하고 Google Sheets에 자동 기록하는 개인용 웹앱.

## 로컬 실행

```bash
cd receipt-lens
npm install
npm run dev
```

브라우저에서 http://localhost:3000 접속.

## 환경변수

`receipt-lens/.env.local` 파일을 만들고 아래 3개를 입력한다.

```bash
GEMINI_API_KEY=AIza...
GOOGLE_SPREADSHEET_ID=...
GOOGLE_SHEET_NAME=시트1
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

| 변수 | 설명 |
|------|------|
| `GEMINI_API_KEY` | Google AI Studio에서 발급한 Gemini API 키 |
| `GOOGLE_SPREADSHEET_ID` | 스프레드시트 URL의 `/d/` 뒤 문자열 |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Service Account JSON 키를 한 줄로 직렬화한 문자열 |

## Google Cloud 설정

**1. Service Account 생성**

Google Cloud Console → IAM 및 관리자 → 서비스 계정 → 새 서비스 계정 생성.
키 탭에서 JSON 키 파일 다운로드.

**2. JSON 키 한 줄 직렬화**

```powershell
(Get-Content receipt-lens-sa.json -Raw) -replace "`r`n|`n", "" | Set-Clipboard
```

클립보드 내용을 `GOOGLE_SERVICE_ACCOUNT_KEY=` 뒤에 붙여넣는다.

**3. Sheets에 서비스 계정 이메일 공유**

Google Sheets → 공유 → 서비스 계정 이메일(`...@....iam.gserviceaccount.com`) 추가 → 편집자 권한 부여.

## Gemini API 키 발급

1. [Google AI Studio](https://aistudio.google.com) 접속
2. 우측 상단 **Get API key** → **Create API key**
3. 발급된 키를 `GEMINI_API_KEY`에 입력

무료 한도: 일 250 RPD (예상 사용량: 하루 50회 미만).
