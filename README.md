# OpenClutch

**The guide you never had — for your money, health, career, and life.**

A sound mind and a healthy body lead to clean discipline with money — and vice versa. Sleep, spending, fitness, and career aren't separate problems. They're one system. No app connects them today. OpenClutch does.

---

## Why I'm Building This

I'm a mechanical engineer at BEL, leading procurement on QRSAM — a multi-billion dollar defence missile program. No CS background. Taught myself to code specifically to build this.

- My father drives cars for a living. No one in my family knew about IITs, SIPs, or career planning. I found out IITs existed in my second year of college.
- Got my first salary at 23, started options trading, lost ₹15L, went into debt. Was sleeping at 3 AM watching US and Indian markets.
- Hit 80kg at 5'11". Went through a breakup that was a wake-up call.
- Spent 3 years recovering — got the money back, saved aggressively, cut 8kg in 12 months.
- Got admitted to Purdue, USC, Maryland at 29. If someone had guided me at 17, I'd have been there at 22.
- **Every setback was a guidance problem, not an intelligence problem.**

OpenClutch tells you what no one else will — "your Zomato habit = ₹1.8L/year" or "you spend 40% more after sleeping under 5 hours."

---

## What It Does

One AI assistant that connects 6 life domains:

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

- "You spend 2x more on days you sleep under 6 hours" *(health → money)*
- "Last 3 times markets dropped 2%+, you panic-sold within 48hrs" *(wealth → behavior)*
- "Every time you order food after 11pm, you skip morning walk" *(money → health)*
- "Starting a SIP at 23 = ₹47L more by 40" *(time → wealth)*

Nobody else can do this because nobody else has ALL the data.

---

## What's Built and Working

- [x] Node.js + Express backend, live on Railway
- [x] 4 broker integrations (Zerodha, Angel One, Fyers, Upstox) — tested with real portfolio data
- [x] 27 AI tools (GPT-4o-mini) — spending analysis, portfolio tracking, health correlation, career scoring
- [x] React Native Android app with chat-first interface
- [x] 11 Supabase tables, JWT auth, rate limiting, DeerFlow2 workflow engine
- [x] SSE streaming chat with markdown rendering
- [x] Gmail + Google Calendar OAuth2 integration
- [x] Bank SMS parsing → expense categorization (150+ Indian merchants)
- [x] Health Connect (Android) + HealthKit (iOS) sync
- [x] 3-tier memory system (conversation window + LLM summary + extracted facts)
- [x] Background workflows (email sync, portfolio sync, health sync, weekly review)
- [x] In-app notifications from workflow agents
- [x] Cleo-inspired onboarding (10-screen adaptive flow)
- [x] Mutual fund tracking via CAS PDF upload
- [x] Google Drive file analysis (PDF, Excel, CSV)
- [x] Inline connection prompts — AI suggests connecting services contextually

**Live backend:** [humble-blessing-production.up.railway.app](https://humble-blessing-production.up.railway.app)

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
  → 11 tables
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

## Market

- **TAM:** $793B Indian fintech market
- **Target:** 25M Indian professionals (28-35) managing money across multiple apps
- **Validation:** Cleo (US equivalent) hit $150M ARR proving chat-first finance works. No one is doing this for India.
- **Unit economics:** 91% gross margins, breakeven at 30 paying users
- **Why now:** Fi Money died (3.5M orphaned users), Indian broker APIs opened up, Health Connect on Android covers 95%+ Indian wearables

## What's Next

- [ ] Android device end-to-end testing
- [ ] Cross-domain pattern detection engine
- [ ] "Should I buy X?" purchase advisor with real financial context
- [ ] Account Aggregator (AA) integration for scale (Finvu/OneMoney)
- [ ] Play Store internal testing track

---

## License

MIT

## Built By

**Chandan** — Mechanical engineer at BEL. First-generation kid from Bangalore whose father drives cars for a living — who got tired of waiting for someone to build what he needed.
