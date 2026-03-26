<div align="center">

# OpenClutch

**The guide you never had — for your money, health, career, and life.**

Sleep, spending, fitness, and career aren't separate problems. They're one system.
No app connects them. OpenClutch does.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![React Native](https://img.shields.io/badge/React_Native-Expo-61DAFB?style=flat-square&logo=react&logoColor=white)](https://reactnative.dev)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![Railway](https://img.shields.io/badge/Deploy-Railway-0B0D0E?style=flat-square&logo=railway&logoColor=white)](https://railway.app)
[![OpenAI](https://img.shields.io/badge/AI-GPT--4o--mini-412991?style=flat-square&logo=openai&logoColor=white)](https://openai.com)

[Live Backend](https://humble-blessing-production.up.railway.app) · [Architecture](docs/ARCHITECTURE.md) · [Contributing](docs/CONTRIBUTING.md) · [Vision](docs/VISION.md)

</div>

---

<!-- TODO: Replace with actual app screenshots
<div align="center">
  <img src="docs/assets/hero-chat.png" width="280" alt="Chat Interface" />
  <img src="docs/assets/hero-portfolio.png" width="280" alt="Portfolio View" />
  <img src="docs/assets/hero-briefing.png" width="280" alt="Sunday Briefing" />
</div>
-->

## The Problem

You manage your life across 10+ disconnected apps. Your broker doesn't know you slept 4 hours. Your health tracker doesn't know you're broke. Your career decisions happen without financial context.

**Every setback I've had was a guidance problem, not an intelligence problem.**

## What It Does

One AI assistant across **6 life domains** — connected:

| Domain | What It Knows | Example Insight |
|--------|---------------|-----------------|
| **Money** | Spending, salary, bills via bank SMS + email | "You spent 40% more on dining this month" |
| **Wealth** | Stocks, MFs via 4 broker APIs | "Your SIPs are buying cheaper during this dip" |
| **Career** | Resume, jobs, interview prep | "This job pays 30% more but your expenses are Mumbai-level" |
| **Health** | Steps, sleep, heart rate via Health Connect | "You slept 4hrs — you historically overspend on these days" |
| **Mind** | Journal entries, mood tracking | "You've journaled 'anxious' 4x this week — all on market red days" |
| **Time** | Calendar, meetings, free slots | "3 meetings today, haven't exercised in 5 days" |

### Cross-Domain Intelligence

The moat. No single-domain app can do this:

> *"You spend 2x more on days you sleep under 6 hours"* — health → money

> *"Last 3 times markets dropped 2%+, you panic-sold within 48hrs"* — wealth → behavior

> *"Every time you order food after 11pm, you skip morning walk"* — money → health

### The Sunday Briefing

A 60-second weekly report across all domains:

> *"This week: earned 1.2L, spent 38K (12K food — way too much Swiggy). Portfolio up 2.3%. Avg sleep 5.8hrs — worst Wednesday when Nifty dropped 400pts. Journaled 'frustrated' twice. One reply from Flipkart — interview Tuesday. This week: sleep before 11pm, cut food delivery to 5K, prep for Flipkart round 2."*

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Mobile (React Native + Expo)                               │
│  Chat UI · Bank SMS parsing · Health Connect · Dark theme   │
└──────────────────────┬──────────────────────────────────────┘
                       │ SSE streaming
┌──────────────────────▼──────────────────────────────────────┐
│  Backend (Node.js + Express)                                │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ 29 AI Tools │  │ 3-Tier Memory│  │ Workflow Engine    │  │
│  │ GPT-4o-mini │  │ Window+LLM   │  │ DeerFlow2 pattern │  │
│  │ Tool calling│  │ +Facts(pgvec)│  │ Email/Portfolio/   │  │
│  └─────────────┘  └──────────────┘  │ Health/Weekly sync │  │
│                                     └───────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Broker Adapters: Zerodha · Angel One · Upstox · Fyers│  │
│  │ Google: Gmail · Calendar · Drive                      │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│  Supabase (PostgreSQL) — 11 tables, RLS, pgvector           │
└─────────────────────────────────────────────────────────────┘
```

### How the AI Works

```
User types message
  → POST /api/chat/stream (SSE)
  → Load user facts (long-term memory) + conversation window
  → Send to GPT-4o-mini with 29 tool schemas
  → If tool called → executor routes to real function (cached)
  → Stream response back to mobile
  → Save to Supabase
```

The AI doesn't hallucinate about your finances — it calls real APIs and returns your actual data.

---

## Tech Stack

| Layer | Tech | Why |
|-------|------|-----|
| Mobile | React Native + Expo | Android-first, iOS later |
| Backend | Node.js + Express | Fast iteration, npm ecosystem for Indian broker SDKs |
| AI | OpenAI GPT-4o-mini | Best cost/quality for tool-calling |
| Database | Supabase (PostgreSQL) | RLS, pgvector, real-time |
| Hosting | Railway | Auto-deploy from GitHub |
| Brokers | Zerodha, Angel One, Upstox, Fyers | 4 OAuth APIs covering 90%+ of Indian retail traders |

## What's Built

- **4 broker integrations** — Zerodha, Angel One, Fyers, Upstox (tested with real portfolio data)
- **29 AI tools** — spending analysis, portfolio tracking, health correlation, career scoring, journal insights, cross-domain patterns, purchase advisor
- **3-tier memory** — sliding window + LLM summary + GPT-extracted facts (pgvector)
- **Workflow engine** — background email sync, portfolio sync, health sync, weekly review
- **Bank SMS parsing** — 150+ Indian merchants auto-categorized
- **Health Connect + HealthKit** — steps, sleep, heart rate sync
- **Gmail + Calendar + Drive** — OAuth2 integrations
- **Mutual fund tracking** — CAS PDF upload → XIRR per fund
- **SSE streaming chat** — real-time markdown rendering
- **Cleo-inspired onboarding** — 10-screen adaptive flow
- **JWT auth, rate limiting, RLS** on all 11 Supabase tables

---

## Quick Start

```bash
# Backend
cd backend
cp ../.env.example .env    # fill in API keys
npm install && node src/server.js

# Mobile
cd mobile
npm install && npx expo run:android
```

Required: `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `JWT_SECRET`

See [Contributing](docs/CONTRIBUTING.md) for the full setup guide.

---

## Market

| | |
|---|---|
| **TAM** | $793B Indian fintech market |
| **Target** | 25M Indian professionals (28-35) managing money across 10+ apps |
| **Validation** | Cleo hit $150M ARR proving chat-first finance. No one does this for India. |
| **Unit economics** | 91% gross margins, breakeven at 30 paying users |
| **Why now** | Fi Money died (3.5M orphaned users), broker APIs opened up, Health Connect covers 95%+ Indian wearables |

## Roadmap

- [x] Cross-domain pattern detection engine
- [x] "Should I buy X?" purchase advisor with real financial context
- [ ] Account Aggregator (AA) integration (Finvu/OneMoney)
- [ ] Play Store internal testing track

---

## Why I'm Building This

I'm a mechanical engineer at BEL, leading procurement on QRSAM — a multi-billion dollar defence missile program. No CS background. Taught myself to code specifically to build this.

- My father drives cars for a living. No one in my family knew about IITs, SIPs, or career planning
- Got my first salary at 23, started options trading, lost ₹15L, went into debt
- Spent 3 years recovering — got the money back, saved aggressively, cut 8kg in 12 months
- Got admitted to Purdue, USC, Maryland at 29. If someone had guided me at 17, I'd have been there at 22
- **Every setback was a guidance problem, not an intelligence problem**

OpenClutch tells you what no one else will — *"your Zomato habit = ₹1.8L/year"* or *"you spend 40% more after sleeping under 5 hours."*

---

<div align="center">

**MIT License**

Built by **[Chandan](https://github.com/chandananvithahr)** — first-generation kid from Bangalore who got tired of waiting for someone to build what he needed.

</div>
