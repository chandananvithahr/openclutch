# OpenClutch — Project Instructions

## gstack

gstack skills are installed at `.claude/skills/gstack`. Use these for all workflows:

- `/office-hours` — describe what you're building, get YC-style feedback
- `/plan-ceo-review` — review any feature idea before building
- `/plan-eng-review` — architecture + engineering review
- `/plan-design-review` — design audit
- `/review` — PR review (runs on any branch with changes)
- `/ship` — full ship workflow (review → merge → deploy)
- `/qa` — QA against staging URL
- `/qa-only` — report-only QA (no fixes)
- `/investigate` — systematic root-cause debugging
- `/retro` — retrospective across sessions
- `/cso` — OWASP + STRIDE security audit
- `/autoplan` — auto-review pipeline (CEO → design → eng)
- `/careful` — high-risk change checklist
- `/freeze` / `/unfreeze` — feature freeze management
- `/document-release` — post-ship doc updates
- `/gstack-upgrade` — upgrade gstack

**Note:** `/browse` skill requires bun (not available on this machine) — skip browser-based skills.
Never use `mcp__claude-in-chrome__*` tools.

## Automation (everything-claude-code hooks)

Hooks are active at `.claude/settings.json`:
- **PostToolUse Edit/Write** → auto-format
- **PreToolUse Bash** → git push reminder
- **Stop** → cost tracker + session end logging
- **UserPromptSubmit** → session start context load

## What This Is
A personal AI assistant mobile app for Indian users (28–35). Chat interface (like ChatGPT) connecting to Zerodha, Angel One, Gmail, financial data APIs, bank SMS, and mutual funds. Backend Node.js, mobile React Native + Expo (Android-first).

## Folder Structure
```
D:\OPENCLAW CHANDAN\
├── backend/
│   ├── src/
│   │   ├── server.js              ← Express entry point. Graceful SIGTERM/SIGINT shutdown.
│   │   ├── lib/
│   │   │   ├── config.js          ← ALL magic numbers + tuneable values (TTLs, limits, etc.)
│   │   │   ├── logger.js          ← Structured logger. JSON in prod, readable in dev. No deps.
│   │   │   ├── ai.js              ← OpenAI GPT-4o-mini wrapper + 3 tone system prompts
│   │   │   ├── supabase.js        ← Supabase client + SupabaseError + unwrap helper
│   │   │   ├── cache.js           ← In-memory TTL cache (dns.toys pattern)
│   │   │   ├── retry.js           ← Exponential backoff (kiteconnectjs pattern)
│   │   │   └── broker-client.js   ← Axios with auth interceptors (kiteconnectjs pattern)
│   │   ├── repositories/
│   │   │   └── index.js           ← DB abstraction: messages, userFacts, transactions, connectedApps, healthData
│   │   ├── brokers/
│   │   │   └── index.js           ← Adapter pattern: Zerodha + Angel One → unified getPortfolio()
│   │   ├── memory/
│   │   │   ├── window.js          ← Tier 1+2: sliding window (8 verbatim) + LLM summarization
│   │   │   └── facts.js           ← Tier 3: GPT-extracted facts → user_facts table
│   │   ├── middleware/
│   │   │   ├── errors.js          ← HTTPError + asyncHandler + errorMiddleware (listmonk pattern)
│   │   │   └── rateLimit.js       ← Sliding window per-user limiter (20 req/min)
│   │   ├── routes/
│   │   │   ├── chat.js            ← POST /api/chat (tool loop + memory). GET /history. GET /facts
│   │   │   ├── zerodha.js         ← Zerodha OAuth + token storage. Token expiry → auto-clear.
│   │   │   ├── angelone.js        ← Angel One SmartAPI TOTP auth. Token expiry → auto-clear.
│   │   │   ├── gmail.js           ← Google OAuth2, fetchEmails(), searchEmails()
│   │   │   ├── cas.js             ← POST /api/cas/upload — CASParser MF integration
│   │   │   ├── sms.js             ← POST /api/sms/transactions, GET /api/sms/spending, sync-email
│   │   │   ├── journal.js         ← Daily journal, mood detection, insights
│   │   │   ├── career.js          ← Resume parse, job scoring (ApplyPilot pattern), tracker
│   │   │   ├── health.js          ← Health sync + spending correlation (Arogya agent)
│   │   │   ├── workflows.js       ← GET /api/workflows, POST /trigger/:name, notifications CRUD
│   │   │   └── whatsapp.js        ← DEFERRED — build last
│   │   ├── workflows/
│   │   │   ├── engine.js          ← WorkflowGraph (DeerFlow2 pattern): nodes, edges, state, retry
│   │   │   ├── index.js           ← Registers all workflows + exports runWorkflow, scheduler, notifications
│   │   │   ├── scheduler.js       ← setInterval cron: emailSync 30min, portfolioSync 15min, weeklyReview Sun 9am IST
│   │   │   ├── notifications.js   ← Supabase-backed notification store. Typed helpers per agent.
│   │   │   ├── smsIngestion.js    ← validate → categorize → store → crossVerify → notifyUser
│   │   │   ├── emailSync.js       ← checkConnection → searchEmails → parseTransactions → store → detectJobEmails → notifyUser
│   │   │   ├── portfolioSync.js   ← checkBrokers → fetchHoldings → detectChanges → storeSnapshot → notifyUser
│   │   │   ├── healthSync.js      ← validate → storeMetrics → analyzePatterns → notifyUser
│   │   │   └── weeklyReview.js    ← gatherSpending → gatherHealth → gatherCareer → compose → notifyUser
│   │   ├── tools/
│   │   │   ├── index.js           ← 21 OpenAI tool schema definitions
│   │   │   └── executor.js        ← Routes tool calls → real functions + cache layer
│   │   └── services/
│   │       ├── categorizer.js     ← 150+ Indian merchants → expense category
│   │       └── screener.js        ← Scrapes screener.in for financials/concalls
│   ├── sql/
│   │   ├── sms_transactions.sql   ← ✅ Run in Supabase
│   │   ├── notifications.sql      ← ⬜ Run in Supabase (notifications table + RLS)
│   │   ├── career_profiles.sql    ← ⬜ Run in Supabase
│   │   ├── journal_entries.sql    ← ⬜ Run in Supabase
│   │   ├── health_data.sql        ← ⬜ Run in Supabase
│   │   └── indexes_and_rls.sql    ← ⬜ Run AFTER all tables exist (performance + RLS)
│   └── package.json
├── mobile/
│   ├── android/                   ← Generated by expo prebuild ✅ (do not manually edit)
│   ├── screens/
│   │   ├── ChatScreen.js          ← Main chat UI. KeyboardAvoidingView fix. Animated send button.
│   │   └── OnboardingScreen.js    ← 5-step onboarding (name→goals→broker→SMS→ready)
│   ├── hooks/
│   │   └── useChat.js             ← Chat state + API logic extracted from ChatScreen (myChat pattern)
│   ├── services/
│   │   ├── api.js                 ← sendMessage() + getChatHistory()
│   │   ├── smsParser.js           ← Reads bank SMS, parses, syncs to backend (Artha agent)
│   │   ├── healthConnect.js       ← Health Connect integration: steps, sleep, HR → /api/health/sync
│   │   ├── config.js              ← BACKEND_URL (local vs Railway)
│   │   └── accessibility.js       ← STUB ONLY — never use for data reading
│   ├── components/
│   │   ├── MessageBubble.js
│   │   └── TypingIndicator.js
│   ├── modules/clutch-accessibility/  ← STUB ONLY — do not build out
│   └── app.json                   ← Expo config (READ_SMS + RECEIVE_SMS permissions declared)
├── docs/
│   └── ARCHITECTURE.md            ← Layer map, all design decisions, source repos, how to extend
├── .env                           ← NEVER commit this
├── plan.md
└── CLAUDE.md                      ← This file
```

## How to Run
```bash
# Backend
cd "D:\OPENCLAW CHANDAN\backend"
node src/server.js

# Mobile (after prebuild — use run:android not start)
cd "D:\OPENCLAW CHANDAN\mobile"
npx expo run:android
```

## Architecture — How It Works
```
User types message
  → ChatScreen.js / useChat.js calls sendMessage()
  → POST /api/chat with { messages, tone, userId }
  → chat.js: loads facts (Tier 3) + applies memory window (Tier 1+2)
  → Sends to OpenAI GPT-4o-mini with 21 tool definitions
  → If OpenAI calls a tool → executor.js runs real function (with cache)
  → Result sent back to OpenAI for final answer
  → Reply returned to mobile + saved to Supabase via repositories/index.js
```

## Adding a New Tool (THE PATTERN)
1. Define the tool schema in `backend/src/tools/index.js`
2. Add case to `backend/src/tools/executor.js` switch
3. Write the backing function (in the relevant route file)
4. Wrap with `withCache(key, TTL.X, fn)` if it calls external APIs

## Adding a New Broker (THE PATTERN)
1. Create `backend/src/routes/[broker].js` — OAuth + token storage
2. Add one adapter entry to `backend/src/brokers/index.js` (isConnected + getHoldings)
3. Register route in `server.js`
4. Mobile: add broker logo/connect button in ChatScreen status bar
> broker adapter auto-merges new broker into portfolio — no executor.js changes needed

## Tone System
Three AI personas, user switches in header:
- `bhai` — casual, Hinglish, brutally honest
- `pro` — data-first, no fluff (default)
- `mentor` — patient, explains why, reassuring

Defined in `backend/src/lib/ai.js` → `TONE_PROMPTS`

## Agent System (5 Agents)
| Agent | Name | Domain |
|-------|------|--------|
| Vriddhi | Investments | Portfolio, stocks, MFs, financials |
| Artha | Money | Spending, salary, net worth, weekly review |
| Chitta | Journaling | Daily check-in, mood tracking, insights |
| Karma | Career | Resume, jobs, interviews, salary negotiation |
| Arogya | Health | Steps, sleep, heart rate, health-spending correlation |

## Current Tools (21 total)
| Tool | Agent | What it does |
|------|-------|-------------|
| `get_portfolio` | Vriddhi | Zerodha + Angel One holdings merged (via brokers/index.js) |
| `get_stock_price` | Vriddhi | Live price + change (Yahoo Finance) |
| `get_portfolio_chart` | Vriddhi | 1yr historical portfolio value |
| `get_financials` | Vriddhi | 3yr financials from screener.in |
| `get_quarterly_results` | Vriddhi | 8 quarters from screener.in |
| `get_concalls` | Vriddhi | Concall docs from screener.in |
| `get_mutual_funds` | Vriddhi | Full MF portfolio via CASParser |
| `get_emails` | — | Gmail unread inbox |
| `search_emails` | — | Gmail search with operators |
| `get_monthly_spending` | Artha | Bank SMS + Gmail expense tracking |
| `get_weekly_review` | Artha | Weekly spending review with comparisons |
| `detect_salary` | Artha | Salary detection + daily budget calc |
| `get_net_worth` | Artha | Total net worth (stocks + MF + bank) |
| `save_journal_entry` | Chitta | Save journal with mood detection |
| `get_journal_insights` | Chitta | Mood-money-health patterns |
| `get_daily_checkin` | Chitta | Morning check-in with data summary |
| `get_career_advice` | Karma | Personalized career advice from resume |
| `search_job_emails` | Karma | Job emails from Gmail |
| `get_interview_prep` | Karma | Interview prep with Q&A |
| `get_salary_negotiation` | Karma | Counter-offer scripts + market rates |
| `track_job_application` | Karma | Track application status |
| `score_job_fit` | Karma | Score resume vs JD (1-10), ATS keywords, gap analysis |
| `get_health_summary` | Arogya | Steps, sleep, HR, activity summary |
| `get_health_spending_correlation` | Arogya | Sleep→spending, activity→spending patterns |

## Architecture Layers
| Layer | File | Purpose |
|-------|------|---------|
| Config | `lib/config.js` | All magic numbers + tuneable values |
| Logger | `lib/logger.js` | Structured logging, no deps |
| Repository | `repositories/index.js` | All DB access (messages, facts, transactions, apps, healthData) |
| Broker adapter | `brokers/index.js` | Unified portfolio from all connected brokers |
| Error middleware | `middleware/errors.js` | HTTPError + centralized handler |
| Rate limiter | `middleware/rateLimit.js` | 20 AI calls/min per user |
| Workflow engine | `workflows/engine.js` | DeerFlow2 graph: nodes → state → edges → retry |
| Notifications | `workflows/notifications.js` | Supabase-backed in-app notifications per agent |
| Scheduler | `workflows/scheduler.js` | Background cron: emailSync, portfolioSync, weeklyReview |

Full architecture doc: `docs/ARCHITECTURE.md`

## Supabase Tables
| Table | Purpose | Status |
|-------|---------|--------|
| `messages` | Chat history | ✅ Created |
| `connected_apps` | OAuth tokens + metadata snapshots (portfolio_snapshot) | ✅ Created |
| `user_facts` | Long-term memory facts (Tier 3) | ✅ Created |
| `sms_transactions` | Bank SMS + email parsed transactions (Artha) | ✅ Created |
| `notifications` | In-app notifications for all agents | ⬜ Run `notifications.sql` |
| `journal_entries` | Daily journal with mood + tags (Chitta) | ⬜ Run SQL |
| `career_profiles` | Parsed resume data (Karma) | ⬜ Run SQL |
| `job_applications` | Job application tracker (Karma) | ⬜ Run SQL |
| `health_data` | Daily health metrics (Arogya) | ⬜ Run SQL |

**After creating all tables:** Run `backend/sql/indexes_and_rls.sql` for indexes + RLS policies.

## SMS + Email Expense Tracking (Artha Agent)
- Mobile reads bank SMS via `react-native-get-sms-android` (READ_SMS permission)
- Backend auto-syncs Gmail bank alert emails when Gmail is connected
- Both sources use content-based `txn_hash` (amount+date+merchant) — same transaction never double-counted
- `source` field: `'sms'` | `'email'` | `'both'` (both = cross-verified, most reliable)
- Categories: food_delivery, shopping, fuel, transport, subscriptions, health, bills, investments, emi_loan, dining_out, others

## Health Connect (Arogya Agent)
- Mobile: `mobile/services/healthConnect.js` — reads Steps, HeartRate, SleepSession, Calories from Android Health Connect
- Syncs to `POST /api/health/sync` → stored in `health_data` table
- `syncHealthData(userId, days)` — call on app foreground or morning check-in
- Requires `react-native-health-connect` package + Android 9+

## Mutual Funds (CASParser)
- User uploads CAMS or KFintech CAS PDF → POST /api/cas/upload
- User asks "show my mutual funds" → `get_mutual_funds` tool → CASParser API
- Returns: total MF value, all folios, NAV, units, XIRR per fund
- Sandbox key for testing: `CASPARSER_API_KEY=sandbox-with-json-responses`

## What NOT to Do
- Do NOT use LangChain — we use OpenAI SDK directly
- Do NOT use AccessibilityService to read other apps' screens — Play Store ban + DPDP violation
- Do NOT store raw financial data in DB — fetch live every time
- Do NOT store raw SMS body — only parsed amount + merchant + date
- Do NOT hardcode API keys — always use `.env`
- Do NOT add Groww paid API until Angel One (free) is fully validated
- Do NOT edit `android/` folder manually — it's generated by `expo prebuild`
- Do NOT call Supabase directly in routes — use `repositories/index.js`
- Do NOT add broker logic to executor.js — use `brokers/index.js` adapter
- Do NOT write workflow logic in routes — use `workflows/` directory + `runWorkflow()`
- Do NOT import `workflows/notifications.js` from routes — notifications are workflow output only

## .env Keys Required
```
OPENAI_API_KEY=
ZERODHA_API_KEY=
ZERODHA_API_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GMAIL_REDIRECT_URI=http://127.0.0.1:3000/api/gmail/callback
SUPABASE_URL=https://awskiypdukdcugkzhsbt.supabase.co
SUPABASE_ANON_KEY=
ANGEL_ONE_API_KEY=
CASPARSER_API_KEY=sandbox-with-json-responses
PORT=3000
LOG_LEVEL=info
ALLOWED_ORIGINS=
SCHEDULER_USER_IDS=   ← comma-separated user IDs to enable background workflow sync
```

## Next Build Priorities
1. **Run SQL in Supabase** — in order: `notifications.sql`, `health_data.sql`, `journal_entries.sql`, `career_profiles.sql`, then `indexes_and_rls.sql`
2. **Test workflows via HTTP** — `POST /api/workflows/trigger/emailSync` + `GET /api/workflows/notifications`
3. **Run mobile** — `npx expo run:android`, test SMS permission + onboarding + input bar fix
4. **Health Connect install** — `npm install react-native-health-connect` in mobile, rebuild
5. **Deploy to Railway** — backend live URL, set `SCHEDULER_USER_IDS` in Railway env vars
6. **Mobile polish** — markdown rendering in MessageBubble, chart display, notification bell in header
