# OpenClutch — Project Instructions

## gstack Quick Reference — Invoke These Every Session

| When | Command | What it does |
|------|---------|-------------|
| Starting a feature | `/plan-eng-review` | Architecture review before touching code |
| Done writing code | `/code-review` | Catch bugs, security issues, patterns |
| Before pushing to Railway | `/cso` | Security audit (OWASP + STRIDE) |
| After `/cso` passes | `/qa https://humble-blessing-production.up.railway.app` | QA the live app with headless browser |
| Ready to deploy | `/ship` | Tests → review → push → PR |
| Every Friday | `/retro` | What shipped, what stalled, what to fix |

**Other useful ones:**
- `/office-hours` — "Should I build this?" YC-style forcing questions
- `/investigate` — Stuck on a bug? Systematic root-cause debugging
- `/canary` — Watch Railway for errors after deploy
- `/careful` — Before any destructive command (rm, DROP, force-push)

> Claude will NOT auto-invoke these — you must type them. Build the habit.

## Current State (update this after every session)

**Last updated:** 2026-03-26 | **Last commit:** `b3a3565` — Angel One MPIN fix + timeout

### What's Built ✅
- Backend: Express server, all routes (chat, zerodha, angelone, upstox, fyers, gmail, calendar, sms, cas, journal, career, health, workflows, onboarding, files, drive)
- 3-tier memory system (sliding window + LLM summary + GPT facts)
- 29 AI tools defined + executor routing
- Workflow engine (DeerFlow2 pattern): emailSync, portfolioSync, healthSync, weeklyReview, smsIngestion
- Broker adapters: Zerodha ✅, Angel One ✅, Upstox ✅, Fyers ✅ (4 OAuth-scalable brokers)
- **Removed:** Groww, Dhan, 5paisa (non-scalable per-user API key model — not suitable for millions of users)
- **Removed:** WhatsApp integration (dropped from scope)
- Mobile: ChatScreen, useChat hook, smsParser, healthConnect (Android), healthKit (iOS), unified health.js
- Mobile onboarding: `OnboardingFlow.js` (10-screen adaptive Cleo-style) + `OnboardingCard.js` ✅
- Supabase tables: messages, connected_apps, user_facts, sms_transactions, journal_entries, career_profiles, job_applications, user_profiles, notifications, health_data, memories (pgvector) ✅ — ALL with RLS enabled
- **Railway deployment: backend is LIVE** — `humble-blessing-production.up.railway.app` ✅
- Railway now connected to GitHub — auto-deploys on every push ✅
- JWT auth enforced on all routes ✅
- File upload + AI analysis: `POST /api/files/analyze` — PDF, Excel, CSV → AI summary ✅
- Google Drive integration: OAuth2 + file listing + AI analysis (`/api/drive/*`) ✅

### Broker Live Test Results (session 10 — 2026-03-26)
| Broker | Status | Notes |
|--------|--------|-------|
| Zerodha | ✅ Working | Real portfolio data confirmed |
| Fyers | ✅ Working | ₹3.12L, 25 holdings confirmed |
| Angel One | ✅ Working | Connected, empty portfolio (no stocks in account) |
| Upstox | ❌ Blocked | User's Upstox account is deactivated |

### What's NOT Built Yet ❌
- Android device test with Railway backend end-to-end
- Fix critical security findings (see `docs/SECURITY_CRITICALS.md`)
- Account Aggregator (AA) integration for scale (Finvu/OneMoney — future)

### Next Up (in order)
1. Fix critical security: auth bypass (#1 in SECURITY_CRITICALS.md)
2. Fix Fyers OAuth state bypass, Upstox singleton race condition
3. Android device end-to-end test
4. Add ALLOWED_ORIGINS to Railway

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

**Note:** Never use `mcp__claude-in-chrome__*` tools.

## Automation (everything-claude-code hooks)

Hooks are active at `.claude/settings.json`:
- **PostToolUse Edit/Write** → auto-format
- **PreToolUse Bash** → git push reminder
- **Stop** → cost tracker + session end logging
- **UserPromptSubmit** → session start context load

## What This Is
> **Your life's control room — one AI that knows your money, career, health, and mood, and connects the dots between them.**

Personal AI assistant for Indian users (28–35). Chat-first interface. 6 life domains: Money, Wealth, Career, Health, Mind, Time. Connects to 4 brokers (Zerodha, Angel One, Upstox, Fyers), Gmail, bank SMS, health data, mutual funds. The moat is **cross-domain intelligence** — insights no single-domain app can provide.

Backend: Node.js + Express. Mobile: React Native + Expo (Android-first). AI: OpenAI GPT-4o-mini with 29 tools.

Full product vision, strategy, and 10-day sprint plan: **`docs/VISION.md`**

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
│   │   │   ├── upstox.js          ← ✅ Upstox OAuth2 + upstox-js-sdk + token storage
│   │   │   ├── fyers.js           ← ✅ Fyers OAuth2 + fyers-api-v3 + token storage
│   │   │   ├── gmail.js           ← Google OAuth2, fetchEmails(), searchEmails()
│   │   │   ├── calendar.js        ← Google Calendar OAuth2, schedule, free slots (Kaal agent)
│   │   │   ├── cas.js             ← POST /api/cas/upload — CASParser MF integration
│   │   │   ├── sms.js             ← POST /api/sms/transactions, GET /api/sms/spending, sync-email
│   │   │   ├── journal.js         ← Daily journal, mood detection, insights
│   │   │   ├── onboarding.js       ← POST /api/onboarding/profile — Cleo-style user profiling
│   │   │   ├── career.js          ← Resume parse, job scoring (ApplyPilot pattern), tracker
│   │   │   ├── health.js          ← Health sync + spending correlation (Arogya agent)
│   │   │   ├── workflows.js       ← GET /api/workflows, POST /trigger/:name, notifications CRUD
│   │   │   └── drive.js           ← Google Drive OAuth2 + file listing + AI analysis
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
│   │   ├── user_profiles.sql      ← ⬜ Run in Supabase (onboarding profile data)
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
│   │   ├── OnboardingFlow.js      ← Cleo-style 10-screen adaptive onboarding (REPLACES OnboardingScreen.js)
│   │   └── OnboardingScreen.js    ← OLD 5-step onboarding — TO BE DELETED after OnboardingFlow.js is built
│   ├── hooks/
│   │   └── useChat.js             ← Chat state + API logic extracted from ChatScreen (myChat pattern)
│   ├── services/
│   │   ├── api.js                 ← sendMessage() + getChatHistory()
│   │   ├── smsParser.js           ← Reads bank SMS, parses, syncs to backend (Artha agent)
│   │   ├── health.js              ← Unified health service — auto-picks Android/iOS
│   │   ├── healthConnect.js       ← Android: Health Connect (steps, sleep, HR → /api/health/sync)
│   │   ├── healthKit.js           ← iOS: Apple HealthKit (steps, sleep, HR → /api/health/sync)
│   │   ├── config.js              ← BACKEND_URL (local vs Railway)
│   │   └── accessibility.js       ← STUB ONLY — never use for data reading
│   ├── components/
│   │   ├── MessageBubble.js
│   │   ├── TypingIndicator.js
│   │   └── OnboardingCard.js      ← Reusable one-question card (skip, reaction text, haptics)
│   ├── modules/clutch-accessibility/  ← STUB ONLY — do not build out
│   └── app.json                   ← Expo config (READ_SMS + RECEIVE_SMS permissions declared)
├── docs/
│   ├── ARCHITECTURE.md            ← Layer map, all design decisions, source repos, how to extend
│   ├── VISION.md                  ← Product vision, strategy, monetization, 10-day sprint plan
│   ├── prd.md                     ← PRD v2 — feature status, acceptance criteria, launch checklist
│   ├── cleo_design_reference.md   ← Cleo AI UI/UX deep dive — colors, typography, chat, onboarding, gamification
│   ├── competitor_analysis.md     ← Strategic positioning map + threat levels
│   ├── competitor_deep_dive.md    ← Feature-level analysis of Cleo/CRED/Groww/Fi/Mint + killer features to build
│   ├── market_research.md         ← $793B TAM, SAM 25M users, Cleo $280M ARR validation
│   ├── breakeven_analysis.md      ← Unit economics — breakeven at 30 users, 91% margins
│   ├── gtm_strategy.md            ← 4-phase GTM: friends → YouTube creators → paid → scale
│   ├── tone_personas.md           ← 3 AI personas: Bhai/Pro/Mentor with voice rules + examples
│   ├── product_management.md      ← Sprint structure, roadmap, feature checklists
│   └── supabase-schema.sql        ← Combined SQL schema reference
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
1. Create `backend/src/routes/[broker].js` — OAuth/TOTP + token storage
2. Add one adapter entry to `backend/src/brokers/index.js` (isConnected + getHoldings)
3. Register route in `server.js`
4. Mobile: add broker logo/connect button in ChatScreen status bar
> broker adapter auto-merges new broker into portfolio — no executor.js changes needed

## Broker Integration Plan (4 OAuth-Scalable Brokers)
| # | Broker | API | Auth | Cost | Status |
|---|--------|-----|------|------|--------|
| 1 | **Zerodha** | KiteConnect | OAuth2 + request_token | Rs 2000/mo | ✅ Built + Tested |
| 2 | **Angel One** | SmartAPI | Client ID + MPIN + TOTP | Free | ✅ Built + Tested |
| 3 | **Upstox** | Upstox API v2 | OAuth2 | Free | ✅ Built (account deactivated) |
| 4 | **Fyers** | Fyers API v3 | OAuth2 | Free | ✅ Built + Tested |

**Removed brokers (non-scalable — require per-user API keys/subscriptions):**
- Groww (₹499/mo per user), Dhan (per-user token), 5paisa (per-user TOTP)
- For millions of users, plan to integrate **Account Aggregator (AA) framework** (Finvu/OneMoney/Perfios)

### API Docs & SDKs
| Broker | API Docs | npm/SDK | Auth Flow |
|--------|----------|---------|-----------|
| Zerodha | kite.trade | `kiteconnect` | OAuth2 → request_token → access_token |
| Angel One | smartapi.angelone.in | `smartapi-javascript` | Client ID + MPIN + TOTP → jwtToken |
| Upstox | developer.upstox.com | `upstox-js-sdk` | OAuth2 → access_token → REST/WebSocket |
| Fyers | myapi.fyers.in/docsv3 | `fyers-api-v3` | OAuth2 → access_token → REST/WebSocket |

### Angel One Auth Notes
- `generateSession(clientId, mpin, totp)` — password field = MPIN (4 digits), NOT login password
- TOTP must be from SmartAPI-specific authenticator entry (not regular Angel One login)
- Phone time must be synced (TOTP is time-sensitive ±30s)

### Per-Broker File Pattern
```
backend/src/routes/zerodha.js     ← OAuth + token storage + getHoldings()
backend/src/routes/angelone.js    ← SmartAPI TOTP + token storage + getHoldings()
backend/src/routes/upstox.js      ← OAuth + token storage + getHoldings()
backend/src/routes/fyers.js       ← OAuth + token storage + getHoldings()
```
Each route file: OAuth/auth flow → store tokens in `connected_apps` → export getHoldings().
Each broker gets ONE entry in `brokers/index.js` adapters array. That's it.

## Onboarding — Cleo AI-Inspired Experience

### Design Spec (For Builder)
Full spec in `docs/VISION.md` → "Onboarding — Cleo AI-Inspired Experience"

### Files to Create
```
mobile/screens/OnboardingFlow.js      ← REPLACES OnboardingScreen.js (delete old one)
mobile/components/OnboardingCard.js   ← Reusable one-question card with skip, reaction text
backend/src/routes/onboarding.js      ← POST /api/onboarding/profile, GET /api/onboarding/profile/:userId
backend/sql/user_profiles.sql         ← user_profiles table + RLS
```

### Color Palette (Use These Exact Values)
```
Primary BG:     #2D1B14  (deep cocoa — all backgrounds)
Card BG:        #3A2820  (warm dark brown — cards, inputs)
Accent/CTA:     #FFE36D  (warm yellow — buttons, highlights)
Success:        #4CAF50  (green — money positive)
Alert:          #FF6B6B  (soft red — warnings)
Text Primary:   #F5F0EB  (warm white)
Text Secondary: #B8A99A  (muted warm)
```
Dark mode default. No blues. No pure white/black.

### Onboarding Flow (Adaptive Branching)
10 screens max. Every screen has "Skip" except name. Every answer triggers an instant AI micro-insight.

1. Name (mandatory)
2. Age (slider)
3. City (autocomplete Indian cities)
4. Student or Working? (two big cards) → BRANCHING POINT
5. [Working] CTC slider → instant take-home calc | [Student] Field + year
6. [Working] EMI yes/no + amount → debt ratio shown | [Student] Enable Karma job agent
7. "What matters most?" multi-select → sets first agent greeting
8. "Into fitness? Got a tracker?" → Health Connect or skip
9. "How are you save?" MF/Stocks/Gold/FD/Nothing + assets (car/bike/house if working)
10. Connect services (Broker / Gmail / MF Statement / Skip all)

→ First chat message uses ALL collected data for personalized greeting.

### user_profiles Table Schema
```sql
CREATE TABLE user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  age INTEGER,
  city TEXT,
  mobile TEXT,
  email TEXT,
  height_cm NUMERIC,
  weight_kg NUMERIC,
  occupation TEXT CHECK (occupation IN ('student', 'working')),
  -- Student fields
  college TEXT,
  field_of_study TEXT,
  study_year INTEGER,
  job_feature_enabled BOOLEAN DEFAULT false,
  -- Working fields
  annual_ctc NUMERIC,
  monthly_emi NUMERIC,
  company TEXT,
  role TEXT,
  -- Lifestyle
  fitness_active BOOLEAN DEFAULT false,
  has_fitness_tracker BOOLEAN DEFAULT false,
  tracker_type TEXT,
  -- Savings & Assets
  savings_methods TEXT[] DEFAULT '{}',   -- ['mf', 'stocks', 'gold', 'fd']
  owns_car BOOLEAN DEFAULT false,
  owns_bike BOOLEAN DEFAULT false,
  owns_house BOOLEAN DEFAULT false,
  -- Priorities
  domain_priorities TEXT[] DEFAULT '{}', -- ['money', 'career', 'health', 'mind']
  -- Meta
  profile_completeness INTEGER DEFAULT 0,
  onboarding_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
```

### Repository Addition (repositories/index.js)
Add `userProfiles` repo with: `create(profile)`, `getByUserId(userId)`, `update(userId, fields)`

### Server.js Registration
```js
app.use('/api/onboarding', require('./routes/onboarding'));
```

### How Profile Data Feeds AI
In `routes/chat.js`, load user profile alongside facts (Tier 3). Inject into system prompt:
```
"User profile: {name}, {age}yo, {city}. {occupation}. CTC: {ctc}. EMI: {emi}.
Saves via: {methods}. Priorities: {priorities}. Fitness: {active}."
```
Every agent response is personalized from day one.

### Profile Completeness Nudging
Not a screen — the AI nudges naturally in chat when profile_completeness < 100%:
- Missing broker → "Connecting your broker takes 30 seconds. Want to?"
- Missing MF → "Upload CAS and I'll show your real XIRR"
- Missing health → "Connect Health Connect for sleep + step tracking"

### Micro-Interactions (Mobile)
- Haptic feedback on every card tap
- Slide-up animation between screens
- Progress dots at top (animated fill)
- AI reaction text appears with typing animation after each answer

## Tone System
Three AI personas with visual chat skins (Cleo-inspired mode switching):
- `bhai` — casual, Hinglish, brutally honest → **orange/yellow chat skin**
- `pro` — data-first, no fluff (default) → **clean brown/white skin**
- `mentor` — patient, explains why, reassuring → **soft purple/blue skin**

Defined in `backend/src/lib/ai.js` → `TONE_PROMPTS`

## Agent System (6 Agents — 6 Life Domains)
| Agent | Name | Domain |
|-------|------|--------|
| Vriddhi | Investments | Portfolio, stocks, MFs, financials |
| Artha | Money | Spending, salary, net worth, weekly review |
| Chitta | Journaling | Daily check-in, mood tracking, insights |
| Karma | Career | Resume, jobs, interviews, salary negotiation |
| Arogya | Health | Steps, sleep, heart rate, health-spending correlation |
| Kaal | Time | Calendar, meetings, free slots, schedule awareness |

## Current Tools (29 total)
| Tool | Agent | What it does |
|------|-------|-------------|
| `get_portfolio` | Vriddhi | All connected broker holdings merged (via brokers/index.js) |
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
| `get_today_schedule` | Kaal | Today's meetings, free hours, event list |
| `get_upcoming_events` | Kaal | Next N days calendar events grouped by day |
| `get_free_slots` | Kaal | Free time slots today (30min+ blocks, 9am-6pm) |
| `get_cross_domain_patterns` | Cross-Domain | THE MOAT — sleep→spending, mood→portfolio, activity→savings patterns |
| `can_i_afford` | Cross-Domain | "Can I afford X?" with real salary, spending, portfolio context |

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
| `user_profiles` | Onboarding profile: name, age, salary, EMI, fitness, savings, assets | ⬜ Run `user_profiles.sql` |
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

## Health Integration (Arogya Agent)
- **Unified API:** `mobile/services/health.js` — auto-picks Android or iOS, single import for the app
- **Android:** `healthConnect.js` — Health Connect (Steps, HeartRate, SleepSession, Calories). Requires `react-native-health-connect` + Android 9+
- **iOS:** `healthKit.js` — Apple HealthKit (StepCount, HeartRate, SleepAnalysis, ActiveEnergyBurned). Requires `react-native-health`
- Both sync to `POST /api/health/sync` → stored in `health_data` table
- Same data shape from both platforms — backend doesn't care about source
- `syncHealthData(userId, days)` — call on app foreground or morning check-in
- Covers 95%+ of Indian wearables: Noise, Fire-Boltt, boAt, Xiaomi, Samsung, Apple Watch, Amazfit all sync to Health Connect/HealthKit

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
- Do NOT integrate brokers outside the 4 planned (Zerodha, Angel One, Upstox, Fyers) — Groww/Dhan/5paisa removed (non-scalable per-user key model)
- Do NOT build WhatsApp integration — removed from scope
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
CALENDAR_REDIRECT_URI=http://127.0.0.1:3000/api/calendar/callback
SUPABASE_URL=https://awskiypdukdcugkzhsbt.supabase.co
SUPABASE_ANON_KEY=
ANGEL_ONE_API_KEY=
UPSTOX_API_KEY=
UPSTOX_API_SECRET=
FYERS_APP_ID=
FYERS_SECRET_ID=
CASPARSER_API_KEY=sandbox-with-json-responses
PORT=3000
JWT_SECRET=             ← generate with: node -e "require('crypto').randomBytes(32).toString('hex')" | copy to Railway too
LOG_LEVEL=info
ALLOWED_ORIGINS=
SCHEDULER_USER_IDS=   ← comma-separated user IDs to enable background workflow sync
```

## 10-Day Sprint (2026-03-25 → 2026-04-04)
Full plan in `docs/VISION.md`. Summary:

### Days 1-2: Foundation
1. Run ALL SQL in Supabase: `notifications.sql`, `health_data.sql`, `journal_entries.sql`, `career_profiles.sql`, `indexes_and_rls.sql`
2. Deploy backend to Railway with all env vars
3. Mobile build stable on real device + fix input bar
4. End-to-end test: message → AI response on phone

### Days 3-4: Security + Broker Polish
5. Fix critical auth bypass (SECURITY_CRITICALS.md #1) ← **BLOCKER**
6. Fix Fyers OAuth state bypass + Upstox singleton race condition
7. All 4 brokers tested end-to-end ✅ (Zerodha, Angel One, Fyers confirmed; Upstox blocked by deactivated account)
8. ~~Dhan, 5paisa, Groww~~ REMOVED — non-scalable per-user key model

### Days 5-6: Cross-Domain Intelligence (THE MAGIC)
9. Sunday Briefing — weekly report across all 6 life domains
10. Pattern detection — sleep→spending, mood→portfolio, stress→impulse-buying
11. Stealth insights — proactive notifications
12. "Should I?" purchase advisor with real financial context

### Days 7-8: Polish & UX
13. Simplify onboarding (2 steps max)
14. Markdown rendering in MessageBubble
15. Contextual connection prompts inline in chat
16. Notification bell + display

### Days 9-10: Ship
17. Test on 3+ real devices with 5 real users
18. Fix critical bugs
19. Play Store internal testing track
20. Landing page with demo videos
