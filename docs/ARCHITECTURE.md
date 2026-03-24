# OpenClutch Backend — Architecture

## Overview

Personal AI assistant backend for Indian users. Node.js + Express API consumed by a React Native Android app. AI routing via OpenAI tool-calling. 5 domain agents (Vriddhi, Artha, Chitta, Karma, Arogya).

---

## Layer Map

```
server.js          ← HTTP entry, CORS, graceful shutdown
  │
  ├─ routes/       ← Thin HTTP handlers (validate, call services, respond)
  │   ├─ chat.js   ← Core AI loop: memory → OpenAI → tool dispatch → response
  │   ├─ zerodha.js / angelone.js  ← Broker OAuth + token storage
  │   ├─ gmail.js  ← Google OAuth + email fetch
  │   ├─ sms.js    ← Bank SMS + email transaction sync
  │   ├─ journal.js / career.js / health.js / cas.js
  │   └─ whatsapp.js (deferred)
  │
  ├─ tools/
  │   ├─ index.js     ← OpenAI tool schema definitions (20+ tools)
  │   └─ executor.js  ← Routes tool calls to real functions + cache layer
  │
  ├─ brokers/
  │   └─ index.js  ← Adapter pattern: Zerodha + Angel One → unified getPortfolio()
  │
  ├─ memory/
  │   ├─ window.js ← Tier 1+2: sliding window (8 verbatim) + LLM summarization
  │   └─ facts.js  ← Tier 3: GPT-extracted facts persisted to user_facts table
  │
  ├─ repositories/
  │   └─ index.js  ← All Supabase table access: messages, userFacts, transactions, connectedApps
  │
  ├─ middleware/
  │   ├─ errors.js    ← HTTPError class + asyncHandler + centralized errorMiddleware
  │   └─ rateLimit.js ← Sliding window per-user rate limiter (20 req/min)
  │
  ├─ services/
  │   ├─ categorizer.js ← Indian merchant → expense category (150+ merchants)
  │   └─ screener.js   ← Scrapes screener.in for financials + concalls
  │
  └─ lib/
      ├─ config.js    ← ALL magic numbers and tuneable values
      ├─ logger.js    ← Structured logging (JSON in prod, readable in dev)
      ├─ ai.js        ← OpenAI wrapper + 3 tone system prompts
      ├─ supabase.js  ← DB client + SupabaseError + unwrap helper
      ├─ cache.js     ← In-memory TTL cache (dns.toys pattern)
      ├─ retry.js     ← Exponential backoff (kiteconnectjs pattern)
      └─ broker-client.js ← Axios with auth interceptors (kiteconnectjs pattern)
```

---

## Architecture Decisions

### 1. Repository Pattern (StockSense)
**Problem:** Direct Supabase calls scattered across 9 route files.
**Solution:** `repositories/index.js` exports `messages`, `userFacts`, `transactions`, `connectedApps` — each with typed methods.
**Benefit:** Supabase is only imported in 2 places (repo + lib/supabase.js). Schema changes = 1 file.

### 2. Broker Adapter (kiteconnectjs)
**Problem:** 60-line `getPortfolio()` in executor.js duplicated Zerodha + Angel One merging logic.
**Solution:** `brokers/index.js` defines `adapters[]` with uniform `isConnected()` + `getHoldings()` interface. `normalizeHolding()` produces a consistent shape.
**Adding a new broker:** Add one entry to `adapters[]`. No other changes needed.

### 3. Centralized Config (dns.toys)
**Problem:** Magic numbers in 5 different files (`KEEP_VERBATIM=8` in window.js, `MAX_REQUESTS=20` in rateLimit.js, TTLs in cache.js, etc.)
**Solution:** `lib/config.js` is the single source of truth. All tuneable values live here.

### 4. Structured Logger (listmonk)
**Problem:** `console.error(...)` scattered throughout — no levels, no timestamps, no JSON in prod.
**Solution:** `lib/logger.js` — zero dependencies, reads `LOG_LEVEL` env var, outputs JSON in `NODE_ENV=production`.

### 5. Centralized Error Handling (listmonk)
**Pattern:** Routes `throw new HTTPError(400, 'reason')` → `errorMiddleware` catches and formats.
**asyncHandler** wraps every route so async errors propagate correctly.
**Per-tool isolation:** Each tool call is wrapped in try-catch — one tool failing never crashes the chat response.

### 6. 3-Tier Memory
| Tier | What | Where |
|------|------|-------|
| 1 | Last 8 messages verbatim | In-request (no DB) |
| 2 | LLM summary of older messages | In-request (OpenAI call) |
| 3 | Extracted facts (names, amounts, decisions) | `user_facts` Supabase table |

Tier 3 is fire-and-forget — never blocks the response.

### 7. Tool-Calling Pattern (openai-agents-python)
`tools/index.js` = schema only. `tools/executor.js` = routing + implementation.
OpenAI decides which tool to call. Executor runs it, returns result, OpenAI writes the final reply.
Cache wraps expensive calls (portfolio, financials) to avoid redundant broker API calls.

### 8. Graceful Shutdown
`server.js` listens for `SIGTERM`/`SIGINT`, closes HTTP server, exits cleanly after 10s max.
Required for Railway/Heroku zero-downtime deploys.

---

## Source Repos & Patterns Applied

| Pattern | Source | File(s) |
|---------|--------|---------|
| Adapter/interface | kiteconnectjs | `brokers/index.js` |
| Repository | StockSense | `repositories/index.js` |
| Centralized error middleware | listmonk | `middleware/errors.js` |
| Sliding window rate limiter | listmonk | `middleware/rateLimit.js` |
| Fail-fast env validation | dns.toys | `server.js`, `lib/supabase.js` |
| In-memory TTL cache | dns.toys | `lib/cache.js` |
| Content-based dedup hash | expense-tracker | `routes/sms.js` |
| Exponential backoff retry | kiteconnectjs | `lib/retry.js` |
| Structured scoring prompt | ApplyPilot | `routes/career.js` |
| Indian merchant map | expense-tracker | `services/categorizer.js` |
| Per-tool error isolation | openai-agents-python | `routes/chat.js`, `tools/executor.js` |
| Concurrent broker fetch | StockSense | `brokers/index.js` |
| 3-tier memory system | LangGraph checkpoints | `memory/window.js`, `memory/facts.js` |

---

## Adding a New Feature

### New Tool (AI capability)
1. Add schema to `tools/index.js`
2. Add case to `tools/executor.js`
3. Write implementation function (in the appropriate route file)
4. Wrap expensive calls with `withCache(key, TTL.X, fn)` from `lib/cache.js`

### New Broker
1. Create `routes/newbroker.js` with OAuth + `getHoldings()` function
2. Add adapter entry to `brokers/index.js`
3. Register route in `server.js`

### New Agent Domain
1. Create `routes/agentname.js` with backing functions
2. Add tools to `tools/index.js` + cases to `tools/executor.js`
3. Run SQL to create any new Supabase tables
4. Add repo methods to `repositories/index.js` if new table access needed

---

## Database Tables

| Table | Purpose | Status |
|-------|---------|--------|
| `messages` | Chat history | ✅ |
| `user_facts` | Tier 3 memory | ✅ |
| `connected_apps` | OAuth tokens | ✅ |
| `sms_transactions` | Bank transactions | ✅ |
| `journal_entries` | Daily journal + mood | ⬜ Run SQL |
| `career_profiles` | Parsed resume | ⬜ Run SQL |
| `job_applications` | Application tracker | ⬜ Run SQL |
| `health_data` | Health metrics | ⬜ Run SQL |

Run `backend/sql/indexes_and_rls.sql` in Supabase for performance indexes.

---

## Environment Variables

```env
OPENAI_API_KEY=          # Required — gpt-4o-mini
SUPABASE_URL=            # Required — your project URL
SUPABASE_ANON_KEY=       # Required — anon key (backend uses service_role implicitly)
ZERODHA_API_KEY=         # Broker
ZERODHA_API_SECRET=      # Broker
GOOGLE_CLIENT_ID=        # Gmail OAuth
GOOGLE_CLIENT_SECRET=    # Gmail OAuth
GMAIL_REDIRECT_URI=      # Gmail OAuth callback
ANGEL_ONE_API_KEY=       # Broker
CASPARSER_API_KEY=       # MF portfolio
PORT=3000                # Default 3000
LOG_LEVEL=info           # error|warn|info|debug
ALLOWED_ORIGINS=         # Comma-separated (defaults to localhost)
```
