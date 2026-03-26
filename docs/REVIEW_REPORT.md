# OpenClutch — Combined Architecture + Code Review Report

Generated: 2026-03-26 | Branch: master | Status: **BLOCK — fix criticals before production users**

## CRITICAL (Fix Before Production)

### 1. Auth bypass — JWT issued for any userId
- **File:** `src/routes/auth.js:15-34`
- **Issue:** `POST /api/auth/token` issues 30-day JWT for any userId with zero verification. Live on Railway.
- **Fix:** Add credential verification (Supabase Auth or password hash). Add rate limiting by IP.

### 2. Upstox SDK singleton race condition
- **File:** `src/routes/upstox.js:48-51`, `src/brokers/index.js:93-94`
- **Issue:** `ApiClient.instance` is a global singleton. Concurrent users overwrite each other's tokens.
- **Fix:** Create new ApiClient instance per request.

### 3. Fyers CSRF bypass via query param
- **File:** `src/routes/fyers.js:75-83`
- **Issue:** Callback falls back to `req.query.userId` when state validation fails. Attacker crafts callback URL.
- **Fix:** Use server-side cookie or signed state token. Remove query param fallback.

### 4. Drive/Files question field — no length cap
- **File:** `src/routes/drive.js:186+`, `src/routes/files.js:132`
- **Issue:** User-controlled `question` field concatenated into AI prompt with no length limit. Inflates costs.
- **Fix:** Cap `question` to 500 chars before building prompt.

---

## HIGH (Fix Soon)

### 5. In-memory state — can't scale horizontally
- **Files:** `cache.js`, `rateLimit.js`, all `tokenCache` Maps in broker/gmail/calendar/drive routes
- **Issue:** Process restart loses all state. Multiple Railway instances = inconsistent state.
- **Future fix:** Move to Redis for token cache, rate limiting, and notifications cache.

### 6. OAuth tokens stored as plaintext in Supabase
- **File:** `src/repositories/index.js:163-168`
- **Issue:** Broker/Gmail tokens stored unencrypted. DB access = all user tokens.
- **Fix:** Encrypt with server-side key before storing. Decrypt on read.

### 7. Mass assignment in onboarding
- **File:** `src/routes/onboarding.js:49-72`
- **Issue:** `req.body` spread directly to DB. User can set `profile_completeness`, `created_at`, etc.
- **Fix:** Allowlist fields: `const { name, age, city, occupation, ... } = req.body;`

### 8. Rate limiter reads wrong userId
- **File:** `src/middleware/rateLimit.js:13-14`
- **Issue:** Reads `req.body?.userId` instead of `req.userId` (set by JWT middleware). Falls back to IP.
- **Fix:** Use `req.userId` from auth middleware.

### 9. Career resume — no file size limit + file leak
- **File:** `src/routes/career.js:14, 29-51`
- **Issue:** Multer has no `limits`. `readFileSync` blocks event loop. File not cleaned up if upsert fails.
- **Fix:** Add `limits: { fileSize: 5*1024*1024 }`. Use `finally` block for cleanup.

### 10. Unbounded Yahoo Finance requests
- **File:** `src/tools/executor.js:106-119`
- **Issue:** `Promise.all` fires one request per holding (30+ concurrent). No timeout.
- **Fix:** Add concurrency limit (p-limit at 5) and per-request timeout (5s).

### 11. No request timeout on chat endpoint
- **File:** `src/routes/chat.js`
- **Issue:** Chat chains multiple OpenAI + external API calls. No overall timeout.
- **Fix:** Add 30s timeout wrapper around the entire chat handler.

### 12. Three separate OpenAI client instances
- **Files:** `lib/ai.js:10`, `memory/window.js:7`, `memory/facts.js:18`
- **Issue:** Prevents shared rate limiting, cost tracking, retry logic.
- **Fix:** Export single client from `ai.js`. Import in window.js and facts.js.

### 13. Route files export business logic + router
- **Files:** All route files (zerodha, gmail, sms, journal, career, health)
- **Issue:** `executor.js` and `brokers/index.js` import routes for business functions. Circular dependency risk.
- **Future fix:** Extract business logic into `src/services/` modules.

### 14. Scheduler runs sequentially, no concurrency control
- **File:** `src/workflows/scheduler.js`
- **Issue:** 1000 users = hours per sync cycle. No user-level locking.
- **Future fix:** Add concurrency limit and skip-if-running logic.

---

## MEDIUM (Fix When Convenient)

| # | Finding | File |
|---|---------|------|
| 15 | Token caches grow unbounded (no eviction) | All tokenCache Maps |
| 16 | ReDoS-vulnerable regex in SMS parsing | `sms.js:170-178` |
| 17 | Message content not length-validated | `chat.js:40-50` |
| 18 | `fs.readFileSync` in async route | `files.js:45` |
| 19 | Drive downloads files without size check | `drive.js:199-238` |
| 20 | Health `days` param uncapped | `health.js:56-59` |
| 21 | Chat `limit` can be negative | `chat.js:279` |
| 22 | `isTokenExpired` too broad (matches "token" in any error) | `fyers.js:218-221` |
| 23 | Workflow graph only supports sequential, not fan-out | `engine.js` |
| 24 | executor.js is 465-line switch with inline business logic | `executor.js` |
| 25 | Screener.in scraping is fragile, no fallback | `services/screener.js` |
| 26 | Rate limiter is fixed window, not sliding (despite comment) | `rateLimit.js` |
| 27 | Duplicate portfolio formatting in zerodha.js and brokers/ | `zerodha.js` vs `brokers/index.js` |
| 28 | `mem0ai` unused dependency | `package.json` |

---

## Architecture Notes

**Good patterns:**
- Repository layer isolates DB access
- Broker adapter pattern (clean, easy to add brokers)
- Centralized config in `lib/config.js`
- DeerFlow2 workflow engine (well-structured)
- Graceful shutdown with SIGTERM/SIGINT

**Scalability blockers (for millions of users):**
1. All in-memory (can't run multiple instances)
2. Single Supabase anon client (any missing `.eq('user_id')` filter = data leak)
3. Sequential scheduler (1000 users = hours per cycle)
4. No test infrastructure (zero tests)

---

## Recommended Fix Order

**Session A (Security — do first):**
1. Auth bypass (#1)
2. Upstox singleton (#2)
3. Fyers CSRF (#3)
4. Mass assignment (#7)
5. Rate limiter fix (#8)

**Session B (Stability):**
6. Input validation (#4, #17, #20, #21)
7. Career file handling (#9)
8. Chat timeout (#11)
9. Single OpenAI client (#12)

**Session C (Scale prep — when needed):**
10. Redis for state (#5)
11. Token encryption (#6)
12. Concurrent scheduler (#14)
13. Service layer extraction (#13)
