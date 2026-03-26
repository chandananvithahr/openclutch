# OpenClutch — Combined Architecture + Code Review Report

Generated: 2026-03-26 | Branch: master | Status: **Session A + B COMPLETE — scale prep remaining**

## CRITICAL (Fix Before Production) — ✅ ALL FIXED

| # | Finding | Status |
|---|---------|--------|
| 1 | Auth bypass — JWT issued for any userId | ✅ Fixed (AUTH_BOOTSTRAP_SECRET + IP rate limit) |
| 2 | Upstox SDK singleton race condition | ✅ Fixed (per-request ApiClient) |
| 3 | Fyers CSRF bypass via query param | ✅ Fixed (removed query param fallback) |
| 4 | Drive/Files question field — no length cap | ✅ Fixed (500 char cap) |

---

## HIGH (Fix Soon) — ✅ MOSTLY FIXED

| # | Finding | Status |
|---|---------|--------|
| 5 | In-memory state — can't scale horizontally | ⏳ Future (Redis) — token caches now bounded |
| 6 | OAuth tokens stored as plaintext in Supabase | ⏳ Future (encrypt at rest) |
| 7 | Mass assignment in onboarding | ✅ Fixed (ALLOWED_FIELDS allowlist) |
| 8 | Rate limiter reads wrong userId | ✅ Fixed (reads req.userId from JWT) |
| 9 | Career resume — no file size limit + file leak | ✅ Fixed (5MB limit + finally cleanup) |
| 10 | Unbounded Yahoo Finance requests | ✅ Fixed (batch of 5 + 8s timeout) |
| 11 | No request timeout on chat endpoint | ✅ Fixed (30s timeout wrapper) |
| 12 | Three separate OpenAI client instances | ✅ Fixed (single export from ai.js) |
| 13 | Route files export business logic + router | ⏳ Future (service layer extraction) |
| 14 | Scheduler runs sequentially | ⏳ Future (concurrency limit) |

---

## MEDIUM (Fix When Convenient) — MOSTLY FIXED

| # | Finding | File | Status |
|---|---------|------|--------|
| 15 | Token caches grow unbounded | All tokenCache Maps | ✅ Fixed (BoundedMap 10K cap) |
| 16 | ReDoS-vulnerable regex in SMS parsing | `sms.js:170-178` | ⏳ Low risk (bounded input) |
| 17 | Message content not length-validated | `chat.js:40-50` | ✅ Fixed (4000 char cap) |
| 18 | `fs.readFileSync` in async route | `files.js:45` | ✅ Fixed (async readFile) |
| 19 | Drive downloads files without size check | `drive.js:199-238` | ✅ Fixed (20MB cap) |
| 20 | Health `days` param uncapped | `health.js:56-59` | ✅ Fixed (1-365 range) |
| 21 | Chat `limit` can be negative | `chat.js:279` | ✅ Fixed (positive clamp) |
| 22 | `isTokenExpired` too broad | `fyers.js:218-221` | ✅ Fixed (specific error codes) |
| 23 | Workflow graph only supports sequential | `engine.js` | ⏳ Future |
| 24 | executor.js is 465-line switch | `executor.js` | ⏳ Future |
| 25 | Screener.in scraping is fragile | `services/screener.js` | ⏳ Future |
| 26 | Rate limiter is fixed window | `rateLimit.js` | ⏳ Future |
| 27 | Duplicate portfolio formatting | `zerodha.js` vs `brokers/` | ⏳ Future |
| 28 | Unused deps (5paisa, dhanhq, mem0ai) | `package.json` | ✅ Fixed (removed) |

---

## Architecture Notes

**Good patterns:**
- Repository layer isolates DB access
- Broker adapter pattern (clean, easy to add brokers)
- Centralized config in `lib/config.js`
- DeerFlow2 workflow engine (well-structured)
- Graceful shutdown with SIGTERM/SIGINT
- BoundedMap prevents memory leaks in token caches
- Single OpenAI client shared across all modules

**Remaining scale blockers (for millions of users):**
1. In-memory state — need Redis for horizontal scaling (#5)
2. Single Supabase anon client — missing `.eq('user_id')` filter = data leak
3. Sequential scheduler (#14)
4. No test infrastructure (zero tests)
5. Token encryption at rest (#6)

---

## Fix History

**Session A (2026-03-26):** #1, #2, #3, #4, #7, #8, #9, #17, #20, #21, #22
**Session B (2026-03-26):** #10, #11, #12, #15, #18, #19, #28

**Session C (Scale prep — when needed):**
- Redis for state (#5)
- Token encryption (#6)
- Concurrent scheduler (#14)
- Service layer extraction (#13)
