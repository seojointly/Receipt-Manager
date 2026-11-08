# ReceiptLens 보안 규칙 (security-guidance 플러그인 LLM 리뷰용)

- Every route under `app/api/` (except `api/auth`) MUST call `isAuthenticated(req)` from `@/lib/auth` and return 401 when false, even though `proxy.ts` also checks. Flag any new route that does not.
- Any string that originates from the user or from Gemini output and is written to Google Sheets with `valueInputOption: 'USER_ENTERED'` MUST pass through `escapeFormula()` from `lib/google-sheets.ts` (formula injection). Numeric and validated date values are exempt.
- API responses must not include raw googleapis/Gemini `err.message`; use `toSheetsErrorMessage(err)` or fixed Korean messages.
- `GEMINI_API_KEY`, `GOOGLE_SERVICE_ACCOUNT_KEY`, `GOOGLE_SPREADSHEET_ID`, `APP_PASSWORD` must never be referenced from client components or exposed via a `NEXT_PUBLIC_` variable.
- The session cookie `rl_session` must stay `httpOnly` and `sameSite: 'lax'` (or stricter), and its expiry must be checked server-side. Never add a GET route that changes data, because Lax cookies are sent on cross-site GET navigations. Do not add CORS headers (`Access-Control-Allow-Origin`) to API routes.
- `/api/analyze` must keep the server-side MIME whitelist and 5MB size limit; `/api/sheets` must validate `id` with `ReceiptIdSchema`.
- Redirect targets taken from query strings (e.g. `?next=`) must be restricted to same-site relative paths.
