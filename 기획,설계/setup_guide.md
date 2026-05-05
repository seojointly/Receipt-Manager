# 초기 설정 가이드
> **Agent: Engineer** | 환경 구성 단계

---

## Step 1. 프로젝트 생성

```bash
npx create-next-app@latest receipt-lens \
  --typescript --tailwind --app --src-dir=false \
  --import-alias="@/*"

cd receipt-lens
npm install lucide-react googleapis openai zod uuid
npm install -D @types/uuid
```

---

## Step 2. Google Cloud Console 설정

### 2-1. 프로젝트 생성
1. https://console.cloud.google.com 접속
2. 상단 프로젝트 선택 → **새 프로젝트** → 이름: `receipt-lens`

### 2-2. Google Sheets API 활성화
```
APIs & Services → 라이브러리 검색 →
"Google Sheets API" → 사용 설정
```

### 2-3. 서비스 계정(Service Account) 생성
```
IAM 및 관리자 → 서비스 계정 → 서비스 계정 만들기
  이름: receipt-lens-sa
  역할: (역할 없음 — Sheets는 공유로 권한 부여)
```

### 2-4. JSON 키 다운로드
```
서비스 계정 선택 → 키 탭 → 키 추가 → JSON
→ 파일 다운로드됨 (예: receipt-lens-sa-xxxx.json)
```

### 2-5. Google Sheets 생성 및 공유
1. Google Sheets 새 스프레드시트 생성
2. URL에서 스프레드시트 ID 복사:
   `https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit`
3. 공유 버튼 → 서비스 계정 이메일 추가 (편집자 권한)
   - 이메일: `receipt-lens-sa@receipt-lens.iam.gserviceaccount.com`
4. 시트 이름 확인 (기본값: "시트1" 또는 "Sheet1")

---

## Step 3. 환경변수 설정

### .env.local 파일 생성

```bash
# OpenAI
OPENAI_API_KEY=sk-proj-...

# Google Sheets
GOOGLE_SPREADSHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE3upms
GOOGLE_SHEET_NAME=시트1

# Service Account (JSON을 한 줄로 직렬화)
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n..."}
```

### JSON 키 한 줄 변환 방법 (macOS/Linux)
```bash
cat receipt-lens-sa-xxxx.json | tr -d '\n' | pbcopy
# 클립보드에 복사됨 → .env.local에 붙여넣기
```

### Windows PowerShell
```powershell
(Get-Content receipt-lens-sa-xxxx.json -Raw) -replace "`r`n|`n", "" | Set-Clipboard
```

---

## Step 4. 헤더 행 추가 (Sheets)

스프레드시트 첫 번째 행에 수동으로 입력:

| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| ID | 날짜 | 상호명 | 공급가액 | 부가세 | 합계 | 기록일시 |

---

## Step 5. .env.example (팀 공유용)

```bash
# .env.example
OPENAI_API_KEY=
GOOGLE_SPREADSHEET_ID=
GOOGLE_SHEET_NAME=시트1
GOOGLE_SERVICE_ACCOUNT_KEY=
```

---

## Step 6. .gitignore 확인

```gitignore
# .gitignore에 반드시 포함
.env.local
*.json  # service account 키 파일
```
