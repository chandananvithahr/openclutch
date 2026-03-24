# OpenClutch — Build Plan

> Built from: ideas_refined.md + market research
> Last updated: 2026-03-21
> Status: Pre-build — approved to start development

---

## The North Star

> Make every earning person's life predictable —
> their money, their health, their career, their family.
> Zero setup. Open app. Talk to AI. Life sorted.

---

## Target User (Data-Backed)

| Attribute | Profile |
|-----------|---------|
| Age | 28–35 years |
| Income | ₹5L – ₹30L/year |
| Location | Metro + Tier 2 Indian cities |
| Broker | Groww (27.7%), Zerodha (15.2%), Angel One (15%) |
| Pain | Invests but doesn't understand markets. Overwhelmed by data. No advisor. |
| Device | Android (primary market) |

---

## Product Architecture — 5 Agents, 1 Interface

```
┌─────────────────────────────────────┐
│         CLUTCH — Chat Interface     │
│         (One screen, like ChatGPT)  │
└──────────────┬──────────────────────┘
               │
    ┌──────────▼──────────┐
    │   OpenAI Tool Call  │ ← Brain that decides which agent to call
    └──┬──┬──┬──┬──┬──────┘
       │  │  │  │  │
   ┌───▼┐ │ ┌▼┐ │ ┌▼────┐
   │Artha│ │ │V│ │ │Karma│
   │Money│ │ │r│ │ │Jobs │
   └────┘ │ │i│ │ └─────┘
        ┌─▼┐│d│┌▼────┐
        │Ar││d││Kutu │
        │og││h││mb   │
        │ya││i││Famil│
        └──┘└─┘└─────┘

Artha   → Money & Expenses
Vriddhi → Stocks & Trading
Arogya  → Health & Fitness
Kutumb  → Family & Insurance
Karma   → Jobs & Career
```

---

## Phase 1 — MVP (Weeks 1–6)
### Goal: Prove the idea works. One magical flow.

**Build only these. Nothing else.**

### 1.1 Chat Interface
- [ ] React Native + Expo app (Android)
- [ ] Simple chat screen (message bubbles, input box, send button)
- [ ] Connects to backend API
- [ ] Shows typing indicator while AI thinks
- [ ] Stores chat history locally

### 1.2 User Onboarding (Conversation-Style)
- [ ] Screen 1: "Hi, I'm Clutch. What's your name?"
- [ ] Screen 2: "What do you want help with?" (checkboxes: Investments / Emails / Jobs / All)
- [ ] Screen 3: "Let's connect your broker" → show Groww / Zerodha / Angel One logos
- [ ] Screen 4: OAuth flow → broker connected → land on chat screen
- [ ] No forms. No settings pages. No manuals.

### 1.3 Vriddhi — Trading Agent (Launch Broker Priority)

**Groww first (27.7% market share — biggest)**
- [ ] Groww OAuth connect (₹499/month API cost)
- [ ] Pull: holdings, P&L, positions, order history
- [ ] AI answers: "How is my portfolio today?"

**Zerodha second (15.2% market share)**
- [ ] Zerodha Kite OAuth connect (₹500/month API cost)
- [ ] Pull: same data as Groww
- [ ] AI answers same questions

**Angel One third (15% market share — FREE API)**
- [ ] Angel One SmartAPI OAuth connect (FREE)
- [ ] Pull: same data

**Total Portfolio View (the killer feature)**
- [ ] Combine holdings across ALL connected brokers
- [ ] Show one unified number: "Your total portfolio = ₹X"
- [ ] "Your Groww mutual funds are outperforming your Zerodha stocks"

**AI capabilities for Vriddhi:**
- [ ] "How am I doing today?" → P&L summary across all brokers
- [ ] "What's my biggest winner / loser?"
- [ ] "Should I sell [stock]?" → buy price + current price + recent news + AI opinion
- [ ] "Why is [stock] falling?" → fetch news + give plain English explanation
- [ ] Proactive alert: "Your Infosys is down 5% today. Want me to check why?"

### 1.4 Gmail Agent (Basic)
- [ ] Google OAuth connect
- [ ] Pull last 50 unread emails
- [ ] AI answers: "Any important emails?"
- [ ] AI answers: "Summarize my inbox"
- [ ] AI drafts reply: "Draft a reply to [sender] saying I'll be there"

### 1.5 Backend + Database
- [ ] Node.js + Express API server
- [ ] Supabase database (India region)
- [ ] Tables: users, connected_apps, chat_history, oauth_tokens
- [ ] All tokens encrypted at rest
- [ ] OpenAI GPT-4o with tool calling wired up
- [ ] Each agent = a set of OpenAI tools

### 1.6 The Proof-of-Concept Flow
This one flow, working perfectly = MVP done:
```
1. User opens app
2. Connects Groww (30 seconds)
3. Asks: "How is my portfolio doing?"
4. Clutch: "Total portfolio ₹2,34,500. Down ₹1,200 today.
            Biggest winner: Tata Motors +2.3%.
            Biggest loser: Infosys -1.8%."
5. User asks: "Should I be worried about Infosys?"
6. Clutch: "Infosys dropped due to weak Q3 guidance.
            You bought at ₹1,420, now ₹1,380 — down ₹2,000.
            Long-term target ₹1,600+. Don't panic sell."
```
**If this feels magical — ship it.**

---

## Phase 2 — V2 (Weeks 7–14)
### Goal: Add more agents. Make it sticky.

### 2.1 Artha — Money Agent
- [ ] Bank SMS parsing (read bank alert SMSs with permission)
- [ ] Manual expense entry + AI categorization
- [ ] Monthly spending summary: "You spent ₹8,400 on Swiggy this month"
- [ ] Cashflow prediction: "You'll be short ₹3,000 before your next salary"
- [ ] Subscription tracker: "You're paying ₹3,200/month on apps you might not use"
- [ ] Savings goal tracker: "At this rate, you'll hit ₹5L in 8 months"

### 2.2 Karma — Career Consultant Agent

> Not just a job board. A personal career consultant in your pocket.
> Like having a senior HR + career coach + job recruiter — all free, all yours.

**The insight:** Job hunting is a numbers game. 1000 applications = 50 interviews = 5 offers.
Most people apply to 20, get rejected, and give up. Karma makes 1000 applications possible.

#### Resume & Profile
- [ ] Resume upload once (PDF) → AI parses, stores, understands your full profile
- [ ] Resume health check: "Your resume has 3 problems. Here's how to fix them."
- [ ] ATS score: "This resume scores 42/100 for this job. Add these 5 keywords to score 85."
- [ ] LinkedIn profile review: "Your headline is weak. Here's a better one."
- [ ] Skills gap analysis: "For a senior product manager role, you're missing: SQL, A/B testing experience"

#### Job Search & Applications
- [ ] "Find me jobs in [role] in [city] with [salary]" → searches Naukri, LinkedIn, Indeed
- [ ] Resume auto-tailored per job (beats ATS filters)
- [ ] Cover letter written in the user's own tone — not robotic
- [ ] One-tap apply where APIs allow
- [ ] Application tracker: Applied → Replied → Interview → Offer → Rejected
- [ ] Daily stats: "You applied to 47 jobs. 3 replied. 6.3% response rate. Aim for 8%."

#### Career Consultant (The Deep Stuff)
- [ ] Career path advice: "You're a mechanical engineer. Here are 5 high-paying pivots in 2025."
- [ ] Market intelligence: "Java developers in Bangalore are getting 30% hikes right now."
- [ ] Salary negotiation coach: "They offered ₹12L. You should counter with ₹15L. Here's the script."
- [ ] Interview prep: "Infosys asks behavioral questions. Here are the top 10 with sample answers."
- [ ] Mock interview: Ask me questions, I'll answer, Karma gives feedback
- [ ] Referral strategy: "You have 3 LinkedIn connections at this company. Reach out to [Name]."

#### For Jobless Users (Emergency Mode)
- [ ] "I just lost my job. Help me." → Karma activates full support
- [ ] Immediate action plan: resume fix → 20 applications today → follow-ups
- [ ] Daily check-in: "Applied to 12 yesterday. 2 replied. Here's today's plan."
- [ ] Emotional support: calm, systematic, not panicky
- [ ] "At your pace, you'll have 3 interviews within 2 weeks."

### 2.3 More Brokers
- [ ] Upstox API integration
- [ ] ICICI Direct Breeze API
- [ ] Fyers API v3

### 2.4 Proactive Alerts
- [ ] Daily morning digest: "Good morning. Portfolio down ₹400. Salary due in 3 days."
- [ ] Stock alert: "HDFC Bank up 4% — you own 20 shares. Want to book profits?"
- [ ] Spending alert: "You've hit 80% of your food budget with 10 days left."
- [ ] Job alert: "3 new jobs matching your profile posted today."

### 2.5 Memory System — RAG + mem0

**Architecture:** Supabase pgvector (no extra database needed)

#### Memory Types Per User
- [ ] Episodic: things that happened ("sold Infosys at loss in March")
- [ ] Semantic: facts about user ("mechanical engineer, risk-averse, saving for house")
- [ ] Preference: communication style ("prefers short answers, Hinglish ok")
- [ ] Pattern: behaviours over time ("overspends every December")

#### RAG Pipeline
- [ ] OpenAI Embeddings API → convert memories to vectors
- [ ] Supabase pgvector → store and search vectors
- [ ] On every user message → retrieve top 5 relevant memories → feed to GPT-4o
- [ ] mem0 library → auto-extract new memories from every conversation
- [ ] Each agent has its own memory namespace (Artha, Vriddhi, Karma, etc.)

#### Memory as Paid Feature
- [ ] Free: 30 days memory retention
- [ ] Pro: Unlimited memory — AI remembers for years
- [ ] "In 2 years you've improved your savings rate by 34%"
- [ ] The longer they pay → smarter their AI → they never leave

---

## Phase 3 — V3 (Months 4–6)
### Goal: Make it a life OS. Prepare for scale.

### 3.1 Arogya — Health Agent
- [ ] Google Fit integration
- [ ] Samsung Health integration
- [ ] Steps, sleep, heart rate tracking
- [ ] Spending vs health correlation: "You ordered food 9 times when you slept under 6 hours"
- [ ] Medicine reminders

### 3.2 Kutumb — Family Agent
- [ ] Family member profiles (spouse, parents, kids)
- [ ] Insurance policy upload + AI understands coverage
- [ ] Insurance renewal alerts
- [ ] School fee reminders
- [ ] Shared expense tracking

### 3.3 Voice Input
- [ ] Speak questions instead of typing
- [ ] "Hey Clutch, how am I doing today?"

### 3.4 Monetization
- [ ] Free tier: 2 brokers, 20 queries/day, 30 days history
- [ ] Pro (₹299/month): Unlimited brokers + queries + proactive alerts + years of history
- [ ] Family (₹499/month): Up to 5 members

### 3.5 iOS Launch
- [ ] Same codebase via React Native — minimal extra work
- [ ] Apple App Store submission

---

## Tech Stack — Final Decisions

| Layer | Technology | Why |
|-------|-----------|-----|
| Mobile | React Native + Expo | Android + iOS, fast development |
| AI Brain | OpenAI GPT-4o (tool calling) | Best tool calling. We write tools, OpenAI thinks. |
| Backup AI | Anthropic Claude | For complex analysis, user can switch |
| Backend | Node.js + Express | Fast to build, huge community |
| Database | Supabase (India region) | Free tier, no AWS, DPDP compliant |
| Auth | Supabase Auth | Built-in, handles Google OAuth |
| Broker APIs | Groww, Zerodha, Angel One | 58% of Indian traders covered |
| Email | Gmail API (Google OAuth) | 90%+ of Indian users use Gmail |

---

## Cost to Run (Per Month)

| Item | Free Tier | At 1000 Users |
|------|-----------|---------------|
| Supabase | ₹0 | ~₹2,000 |
| OpenAI API | Pay per use | ~₹8,000 |
| Groww API | ₹499 | ₹499 |
| Zerodha API | ₹500 | ₹500 |
| Angel One API | ₹0 | ₹0 |
| Server (Railway/Render) | ₹0 (free tier) | ~₹1,500 |
| **Total** | **~₹1,000** | **~₹12,500** |

Break even at 42 Pro users (₹299/month) = very achievable.

---

## What We Are NOT Building (Stay Focused)

- WhatsApp integration (no official personal API — skip)
- WhatsApp bot version (later)
- AR "can I afford this" mode (later)
- Clutch API for developers (later)
- Web version (mobile first)
- Custom AI model (we piggyback on OpenAI/Anthropic)
- Our own auth system (Supabase handles it)
- Our own database infrastructure (Supabase handles it)

---

## Risks & Mitigations

| Risk | Plan |
|------|------|
| AI gives wrong financial advice | Always show disclaimer. "This is analysis, not financial advice." |
| Groww/Zerodha API changes | Build adapter layer — swap API without changing AI logic |
| User data breach | Encrypt tokens. Never store raw financial data. Supabase RLS. |
| DPDP Act 2023 compliance | Store data in India (Supabase India region). Privacy policy before launch. |
| OpenAI costs spike at scale | Add cost cap per user. Switch heavy queries to Claude (cheaper). |
| Play Store rejection | Follow Google financial app policies from day 1. |

---

## Launch Checklist (Before First User)

- [ ] Privacy policy written
- [ ] "This is not financial advice" disclaimer on every AI response
- [ ] Data deletion flow (user can delete all their data)
- [ ] Basic rate limiting on API
- [ ] Error handling — graceful failures, not crashes
- [ ] Test on real Android device with real Groww/Zerodha account

---

## File Map

```
D:\OPENCLAW CHANDAN\
├── .env                  ← API keys (never share, never commit)
├── .gitignore            ← keeps .env out of git
├── ideas_raw.md          ← unfiltered brain dump
├── ideas.md              ← structured overview
├── ideas_refined.md      ← logical product vision
├── feedback.md           ← feedback tracker
├── plan.md               ← THIS FILE — build plan
├── mobile/               ← React Native app (Expo, already scaffolded)
└── backend/              ← Node.js API (partially scaffolded)
```

---

## Next Action

**Start with this. One file at a time:**

1. `backend/src/routes/chat.js` — wire up OpenAI tool calling
2. `backend/src/tools/zerodha.js` — Zerodha data fetcher
3. `backend/src/tools/groww.js` — Groww data fetcher
4. `mobile/screens/ChatScreen.js` — the chat UI
5. `mobile/screens/OnboardingScreen.js` — the 4-screen onboarding

**When step 1–5 works end to end = MVP done. Ship it.**
