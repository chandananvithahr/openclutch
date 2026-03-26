# OpenClutch

**Your life's control room — one AI that knows your money, career, health, and mood, and connects the dots between them.**

No other app does this. Zerodha doesn't know you're stressed. Google Fit doesn't know you're broke. LinkedIn doesn't know your portfolio crashed and you should NOT quit your job right now.

The moat is **cross-domain intelligence**. Not any single feature.

---

## The Problem

Indian professionals (28-35) manage their lives across 10+ disconnected apps. Your broker doesn't talk to your bank. Your health tracker doesn't know about your spending. Your career decisions happen in a vacuum without financial context.

Every "personal finance app" solves one slice. Nobody connects the dots.

## What OpenClutch Does

One AI assistant across 6 life domains:

| Domain | What It Knows | Example Insight |
|--------|---------------|-----------------|
| **Money** | Spending, salary, bills via bank SMS + email | "You spent 40% more on dining this month" |
| **Wealth** | Stocks, MFs via 4 broker APIs | "Your SIPs are buying cheaper during this dip" |
| **Career** | Resume, jobs, interview prep | "This job pays 30% more but your expenses are Mumbai-level" |
| **Health** | Steps, sleep, heart rate via Health Connect/HealthKit | "You slept 4hrs — you historically make bad purchases on these days" |
| **Mind** | Journal entries, mood tracking | "You've journaled 'anxious' 4x this week — all on market red days" |
| **Time** | Calendar, meetings, free slots | "3 meetings today, haven't exercised in 5 days" |

### The Sunday Briefing

A 60-second weekly intelligence report no single-domain app can produce:

> "This week: earned 1.2L, spent 38K (12K food — way too much Swiggy). Portfolio up 2.3%. Avg sleep 5.8hrs — worst Wednesday when Nifty dropped 400pts. Journaled 'frustrated' twice. One reply from Flipkart — interview Tuesday. This week: sleep before 11pm, cut food delivery to 5K, prep for Flipkart round 2."

### Cross-Domain Pattern Detection

- "You spend 2x more on days you sleep under 6 hours" *(health -> money)*
- "Last 3 times markets dropped 2%+, you panic-sold within 48hrs" *(wealth -> behavior)*
- "Every time you order food after 11pm, you skip morning walk" *(money -> health)*

Nobody else can do this because nobody else has ALL the data.

---

## Architecture

```
Mobile (React Native + Expo)
  → Chat UI with SSE streaming
  → Bank SMS parsing (READ_SMS)
  → Health Connect / HealthKit sync
  → Warm cocoa dark theme

Backend (Node.js + Express)
  → OpenAI GPT-4o-mini with 27 tool definitions
  → 3-tier memory (sliding window + LLM summary + fact extraction)
  → Workflow engine (DeerFlow2 pattern)
  → 4 broker adapters (Zerodha, Angel One, Upstox, Fyers)
  → Gmail + Google Calendar OAuth2
  → Google Drive file analysis

Database (Supabase + PostgreSQL)
  → RLS on all tables
  → pgvector for semantic memory
  → 11 tables (messages, connected_apps, user_facts, sms_transactions, etc.)
```

### How the AI Works

```
User types message
  → POST /api/chat/stream (SSE)
  → Load user facts (long-term memory) + conversation window
  → Send to GPT-4o-mini with 27 tool schemas
  → If tool called → executor routes to real function (with cache)
  → Stream response back to mobile
  → Save to Supabase
```

The AI doesn't hallucinate about your finances — it calls real APIs (Zerodha KiteConnect, Angel SmartAPI, Fyers API v3, Upstox API v2) and returns your actual portfolio data.

---

## Tech Stack

| Layer | Tech | Why |
|-------|------|-----|
| Mobile | React Native + Expo | Android-first, iOS later |
| Backend | Node.js + Express | Fast iteration, strong npm ecosystem for Indian broker SDKs |
| AI | OpenAI GPT-4o-mini | Best cost/quality ratio for tool-calling |
| Database | Supabase (PostgreSQL) | RLS, pgvector, real-time, free tier |
| Hosting | Railway | Auto-deploy from GitHub, $5/mo |
| Brokers | Zerodha, Angel One, Upstox, Fyers | 4 OAuth-based APIs covering 90%+ of Indian retail traders |

## Running Locally

```bash
# Backend
cd backend
cp ../.env.example .env  # fill in your API keys
npm install
node src/server.js       # runs on port 3000

# Mobile
cd mobile
npm install
npx expo run:android     # requires Android SDK
```

Required env vars: `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `JWT_SECRET`. See `.env.example` for the full list.

---

## What's Built

- [x] Chat UI with SSE streaming + markdown rendering
- [x] 27 AI tools (portfolio, spending, salary, journal, health, career, calendar)
- [x] 4 broker integrations (Zerodha, Angel One, Upstox, Fyers) — all tested with real accounts
- [x] Gmail + Google Calendar OAuth2
- [x] Bank SMS parsing → expense categorization (150+ Indian merchants)
- [x] Health Connect (Android) + HealthKit (iOS) sync
- [x] 3-tier memory system (conversation window + LLM summary + extracted facts)
- [x] Workflow engine with background sync (email, portfolio, health, weekly review)
- [x] In-app notifications from workflow agents
- [x] Cleo-inspired onboarding (10-screen adaptive flow)
- [x] Mutual fund tracking via CAS PDF upload
- [x] Google Drive file analysis (PDF, Excel, CSV)
- [x] JWT auth on all endpoints + RLS on all Supabase tables
- [x] Deployed on Railway (auto-deploy on push)

## What's Next

- [ ] Android device end-to-end testing
- [ ] Cross-domain pattern detection engine
- [ ] "Should I buy X?" purchase advisor with real financial context
- [ ] Account Aggregator (AA) integration for scale (Finvu/OneMoney)
- [ ] Play Store internal testing track

---

## Market

- **TAM:** $793B Indian fintech market
- **Target:** 25M Indian professionals (28-35) managing money across multiple apps
- **Validation:** Cleo (US equivalent) hit $150M ARR proving chat-first finance works. No one is doing this for India.
- **Unit economics:** 91% gross margins, breakeven at 30 paying users

## Why Now

1. **AI tool-calling matured** — GPT-4o-mini can reliably call 27 tools in sequence
2. **Indian broker APIs opened up** — Zerodha KiteConnect, Angel SmartAPI, Fyers v3 all launched in the last 2 years
3. **Health Connect on Android** — Google shipped Health Connect in 2023, covering 95%+ of Indian wearables (Noise, Fire-Boltt, boAt, Xiaomi)
4. **Fi Money died** — 3.5M orphaned users looking for a smart finance app

---

## License

MIT

## Contact

Built by Chandan — applying to YC S26.
