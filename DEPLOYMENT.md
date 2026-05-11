# Vercel 배포 가이드

## 프로젝트 구조

```
Receipt-Manager/          ← GitHub 저장소 루트 (.git 위치)
└── receipt-lens/         ← Next.js 앱 실제 위치 (Vercel Root Directory)
    ├── vercel.json       ← Vercel 빌드 설정
    ├── package.json
    ├── next.config.ts
    ├── app/
    ├── components/
    └── lib/
```

## Vercel 프로젝트 설정

Vercel 대시보드 → Settings → General에서 아래와 같이 설정한다.

| 항목 | 값 |
|------|----|
| Framework Preset | Next.js |
| Root Directory | `receipt-lens` |
| Build Command | `npm install && npm run build` |
| Output Directory | `.next` |
| Install Command | `npm install` |

> `receipt-lens/vercel.json`에 위 설정이 명시되어 있으므로 Vercel이 자동으로 읽는다.

## 환경 변수

Vercel 대시보드 → Settings → Environment Variables에 아래 4개를 등록한다.

| 변수명 | 설명 |
|--------|------|
| `GEMINI_API_KEY` | Google AI Studio에서 발급한 Gemini API 키 |
| `GOOGLE_SPREADSHEET_ID` | Google Sheets URL의 `/d/` 뒤 ID 문자열 |
| `GOOGLE_SHEET_NAME` | 시트 탭 이름 (기본값: `시트1`) |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | 서비스 계정 JSON을 한 줄로 직렬화한 문자열 |

`GOOGLE_SERVICE_ACCOUNT_KEY` 직렬화 (Windows PowerShell):
```powershell
(Get-Content receipt-lens-sa.json -Raw) -replace "`r`n|`n", "" | Set-Clipboard
```

## vercel.json

`receipt-lens/vercel.json` 내용:
```json
{
  "framework": "nextjs",
  "buildCommand": "npm install && npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install"
}
```

## 트러블슈팅 기록

### 증상: 배포 후 404
- **원인**: Vercel이 Framework를 `Other`로 잘못 감지 → Output Directory를 찾지 못함
- **해결**: `vercel.json`을 `receipt-lens/` 안에 배치하고 Vercel Root Directory를 `receipt-lens`로 지정

### 증상: vercel.json이 git에 추가 안 됨
- **원인**: `receipt-lens/.gitignore`의 `*.json` 패턴이 서비스 계정 키 파일을 차단하면서 `vercel.json`도 함께 차단
- **해결**: `.gitignore`에 `!vercel.json` 예외 추가

### 증상: npm install exited with 254
- **원인**: `receipt-lens/.gitignore`의 `*.json` 패턴이 `package.json`, `package-lock.json`, `tsconfig.json`까지 차단 → Vercel이 `package.json`을 받지 못해 설치 불가
- **해결**: `.gitignore`에 아래 예외 3개 추가
  ```
  !package.json
  !package-lock.json
  !tsconfig.json
  ```

## 재배포 방법

코드 변경 후 `main` 브랜치에 push하면 Vercel이 자동으로 재배포한다.

```bash
git push origin main
```
