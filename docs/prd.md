# Clutch — Product Requirements Document (PRD)

> Version: 2.0
> Last updated: 2026-03-24
> Status: Beta — Core Build Complete

---

## 1. Product Overview

### What Is Clutch?
Clutch is a personal AI life assistant mobile app for Android (and later iOS) that connects to all your apps — stock brokers, Gmail, health apps, bank SMS — and lets you ask questions in plain language, like ChatGPT.

### The One-Line Value Prop
> "Your personal AI team — for your money, your career, your health, and your family. Zero setup. Just talk."

### Success Criteria for Launch
- User can connect Angel One / Zerodha in under 2 minutes
- User can ask "how is my portfolio today?" and get an accurate, useful answer
- User comes back the next day (Day 1 retention >40%)
- User tells at least 1 friend (NPS > 40)
- Morning check-in response rate > 30% (retention driver)

---

## 2. Users

### Primary User (MVP)
**The Aspirational Indian Investor**
- Age: 25–35
- Has Zerodha/Angel One account, checks it daily but doesn't understand it
- Uses Gmail for work, gets bank SMS on Android
- Android phone
- Earns ₹5L–₹20L/year
- Cannot afford a financial advisor
- Pain: overwhelmed by data, makes decisions based on gut, misses opportunities

### Secondary User (V2)
**The Anxious Job Seeker**
- Recently laid off or actively job hunting
- Applies to jobs manually, exhausted
- Needs a systematic approach

### Tertiary User (V3)
**The Overwhelmed Family Manager**
- Manages finances for spouse + kids + parents
- Insurance, school fees, EMIs, investments
- Too many apps, needs one central place

---

## 3. Core Features — MVP (Built)

### Feature 1: Onboarding (Conversation-Style)
**Priority:** P0 — ✅ Built
**Status:** OnboardingScreen.js — 5-step flow

**Flow:**
- Screen 1: Animated welcome + "What's your name?" text input
- Screen 2: "What would you like help with?" — checkboxes (Investments / Emails / Jobs / Health / All)
- Screen 3: Broker connect screen — Angel One, Zerodha logos
- Screen 4: OAuth flow opens in browser → returns to app
- Screen 5: "You're all set! Ask me anything." → Chat screen

**Acceptance Criteria:**
- [x] User can complete onboarding in < 2 minutes
- [x] OAuth tokens stored in Supabase (connected_apps table)
- [x] Works on Android API 26+ (Android 8.0+)
- [ ] Handles OAuth failure gracefully with retry option

---

### Feature 2: Chat Interface
**Priority:** P0 — ✅ Built
**Status:** ChatScreen.js + useChat.js

**Requirements:**
- Clean chat screen with message bubbles (user right, Clutch left)
- Text input at bottom with send button
- Typing indicator (animated dots) while AI is thinking
- Three AI personas: bhai (casual Hinglish), pro (data-first), mentor (patient)
- Timestamps on messages
- Keyboard doesn't cover input field (KeyboardAvoidingView)
- Character limit: 500 characters per message
- Financial advice disclaimer on every relevant response

**AI Behavior:**
- GPT-4o-mini with 21 tool definitions
- Tool calling with cache layer (executor.js)
- Response time target: < 5 seconds

**Acceptance Criteria:**
- [x] Messages send and receive correctly
- [x] Typing indicator shows while waiting
- [x] Chat history persists (Supabase messages table)
- [ ] Markdown rendering in MessageBubble
- [ ] Works offline: show "No internet connection" message

---

### Feature 3: Vriddhi — Investment Agent
**Priority:** P0 — ✅ Built
**Status:** brokers/index.js + routes/zerodha.js + routes/angelone.js

**Supported Brokers (by priority):**
- Angel One (P0 — free SmartAPI, TOTP auth) ✅
- Zerodha (P1 — OAuth, Kite Connect) ✅
- Groww — NO public API, not supported

**Tools Built:**
- `get_portfolio()` → unified holdings from all connected brokers
- `get_stock_price(symbol)` → live price + day change
- `get_portfolio_chart()` → 1yr historical portfolio value
- `get_financials(symbol)` → 3yr financials from screener.in
- `get_quarterly_results(symbol)` → 8 quarters
- `get_concalls(symbol)` → concall documents
- `get_mutual_funds()` → full MF portfolio via CASParser

**Questions Clutch Must Answer:**
- "How is my portfolio today?"
- "What's my biggest winner / loser?"
- "Should I sell [stock]?"
- "Why is [stock] falling?"
- "Show me [company]'s financials"
- "Compare my performance to Nifty 50"

**Acceptance Criteria:**
- [x] Angel One TOTP auth works end-to-end
- [x] Zerodha OAuth works end-to-end
- [x] Portfolio data fetches in < 3 seconds
- [x] All financial responses include disclaimer
- [x] Handles API rate limits gracefully
- [ ] Groww removed from onboarding broker screen

---

### Feature 4: Artha — Money Agent
**Priority:** P1 — ✅ Built
**Status:** routes/sms.js + workflows/smsIngestion.js + workflows/emailSync.js

**Data Sources:**
- Bank SMS via react-native-get-sms-android (READ_SMS permission)
- Gmail bank alert emails (auto-synced when Gmail connected)
- Cross-verified via content-based txn_hash (no double-counting)

**Tools Built:**
- `get_monthly_spending()` → categorized spend breakdown
- `get_weekly_review()` → weekly spending with comparisons
- `detect_salary()` → salary detection + daily budget calc
- `get_net_worth()` → stocks + MF + bank balance

**Expense Categories:** food_delivery, shopping, fuel, transport, subscriptions, health, bills, investments, emi_loan, dining_out, others

**Acceptance Criteria:**
- [x] SMS parsing works with 150+ Indian merchants
- [x] Email + SMS cross-verification (no duplicates)
- [ ] Monthly spending chart in chat
- [ ] Weekly review push notification (Sunday 9am IST)

---

### Feature 5: Gmail Agent
**Priority:** P1 — ✅ Built
**Status:** routes/gmail.js

**Tools Built:**
- `get_emails(count)` → fetch recent unread emails
- `search_emails(query)` → search by keyword/sender
- Auto-sync bank alert emails for Artha agent

**Acceptance Criteria:**
- [x] Google OAuth (Gmail scope) works
- [x] Email list loads in < 4 seconds
- [x] Draft replies marked as "Draft — review before sending"
- [x] Clutch never auto-sends email

---

### Feature 6: Memory System (3-Tier)
**Priority:** P1 — ✅ Built
**Status:** memory/window.js + memory/facts.js

**Architecture:**
- Tier 1: Sliding window — last 8 verbatim messages (instant context)
- Tier 2: LLM summarization — older messages compressed into summary
- Tier 3: mem0 self-hosted — GPT-extracted facts stored as vectors in Supabase pgvector

**Memory Stack:**
- mem0 library (self-hosted, NOT mem0.ai hosted service)
- Vector store: Supabase pgvector (ap-south-1 Mumbai — DPDP compliant)
- Embeddings: OpenAI text-embedding-3-small
- Reason: Indian user financial + health data must stay in India (DPDP Act 2023)

**What Gets Remembered:**
- Financial: "User bought HDFC at ₹1,420"
- Goals: "User saving for a house in 2027"
- Preferences: "User prefers short answers"
- Context: "User is a mechanical engineer at Pune"

**Acceptance Criteria:**
- [x] Facts extracted and stored in user_facts table
- [ ] mem0 pgvector integration complete (in progress)
- [ ] User can view stored memories in app
- [ ] User can delete individual memories or all memories

---

### Feature 7: Chitta — Journal Agent
**Priority:** P1 — ✅ Built
**Status:** routes/journal.js

**Tools Built:**
- `save_journal_entry()` → save with mood detection
- `get_journal_insights()` → mood-money-health patterns
- `get_daily_checkin()` → morning check-in with data summary

**Retention Driver:** Daily morning check-in notification → opens Clutch → drives DAU

---

### Feature 8: Karma — Career Agent
**Priority:** P1 — ✅ Built
**Status:** routes/career.js

**Tools Built:**
- `get_career_advice()` → personalized advice from resume
- `search_job_emails()` → job emails from Gmail
- `get_interview_prep()` → Q&A prep
- `get_salary_negotiation()` → counter-offer scripts
- `track_job_application()` → application status tracker
- `score_job_fit()` → resume vs JD score (1-10), ATS keywords

---

### Feature 9: Arogya — Health Agent
**Priority:** P1 — ✅ Built
**Status:** routes/health.js + mobile/services/healthConnect.js

**Data Source:** Android Health Connect (steps, sleep, heart rate, calories)

**Tools Built:**
- `get_health_summary()` → steps, sleep, HR, activity
- `get_health_spending_correlation()` → sleep→spending, activity→spending patterns

---

### Feature 10: Workflow Engine + Notifications
**Priority:** P1 — ✅ Built
**Status:** workflows/engine.js + workflows/scheduler.js + workflows/notifications.js

**Background Workflows:**
- emailSync — every 30 min
- portfolioSync — every 15 min
- weeklyReview — Sunday 9am IST
- smsIngestion — on SMS receive
- healthSync — on app foreground

---

## 4. Monetization (V2)

| Tier | Price | Limits |
|------|-------|--------|
| Free | ₹0 | 20 AI messages/day, 30-day chat history, 1 broker |
| Pro | ₹199/month | Unlimited messages, 1yr history, all brokers, priority speed |
| Family | ₹349/month | 3 users, shared net worth view, family expense tracking |

**Monetization triggers:**
- Hit message limit → upgrade prompt in chat
- Try to connect 2nd broker → upgrade prompt
- Weekly review feature → Pro teaser

---

## 5. Retention Strategy

| Mechanism | How |
|-----------|-----|
| Morning check-in | Push notification 8am → "Good morning [name], your portfolio is ₹X today" |
| Weekly review | Sunday notification → spending vs last week |
| Portfolio alert | Alert when stock moves >5% |
| Streak | "You've checked in 5 days in a row 🔥" |
| Memory feel | AI remembers context → feels personal → users come back |

---

## 6. Non-Functional Requirements

### Performance
- App launch to chat screen: < 3 seconds
- AI response time: < 5 seconds (95th percentile)
- Portfolio data load: < 3 seconds
- App size: < 50MB

### Security
- All OAuth tokens encrypted at rest (AES-256)
- HTTPS for all API calls (no HTTP)
- No raw financial data stored (always fetch live)
- Row-Level Security in Supabase (users only see their own data)
- No API keys in mobile app (all server-side)
- Rate limiting: 20 AI calls/min per user

### Privacy & Compliance
- All data stored in Supabase ap-south-1 (Mumbai, India)
- DPDP Act 2023 compliant — no Indian user data leaves India
- mem0 self-hosted (NOT mem0.ai) — vectors stay in Supabase
- Privacy policy shown before onboarding
- User can delete all data at any time
- No data sold to third parties. Ever.
- Raw SMS body never stored — only parsed amount + merchant + date

### Reliability
- 99% uptime target
- Graceful degradation when broker API is down
- Background workflows resume on server restart

---

## 7. Out of Scope (Still)

- WhatsApp integration (deferred — Play Store risk)
- iOS version
- AccessibilityService screen reading (DPDP + Play Store ban risk)
- Insurance document analysis
- Family accounts (V3)
- Voice input (V2)
- Web version
- Multiple languages (English only in MVP)
- Groww API (no public API exists)

---

## 8. Technical Specifications

### Mobile
- Framework: React Native + Expo SDK 50+
- Min Android version: API 26 (Android 8.0)
- Navigation: Expo Router
- HTTP client: Axios
- Health: react-native-health-connect
- SMS: react-native-get-sms-android

### Backend
- Runtime: Node.js 20+
- Framework: Express 4.x
- AI: OpenAI GPT-4o-mini (tool calling, 21 tools)
- Memory: mem0 self-hosted + Supabase pgvector
- Workflow: DeerFlow2-style graph engine
- Deployment: Railway

### Database
- Provider: Supabase (PostgreSQL)
- Region: ap-south-1 (Mumbai, India)
- Extensions: pgvector (mem0 memory vectors)
- RLS: enabled on all tables

### Tables Built
| Table | Status |
|-------|--------|
| messages | ✅ |
| connected_apps | ✅ |
| user_facts | ✅ |
| sms_transactions | ✅ |
| notifications | ⬜ run SQL |
| journal_entries | ⬜ run SQL |
| career_profiles | ⬜ run SQL |
| health_data | ⬜ run SQL |
| memories (pgvector) | ⬜ run SQL for mem0 |

---

## 9. Design Principles

1. **Conversation first** — if it needs a settings screen, redesign it
2. **One action per screen** — never overwhelm the user
3. **Show the data, explain it** — don't just show numbers, explain what they mean
4. **Always attribute source** — "From your Angel One account as of 9:42 AM"
5. **Never auto-act** — Clutch advises, user decides. Never auto-trade, auto-reply, auto-anything.
6. **Errors in plain English** — "Angel One is taking too long. Try again in a minute." Not "Error 503"
7. **India-first privacy** — all data stays in India, always

---

## 10. Launch Criteria

Before first public user:
- [ ] Onboarding works end-to-end on real Android device
- [ ] Angel One + Zerodha connect and fetch real data
- [ ] Chat works with real AI responses
- [ ] Memory persists across sessions (mem0 + pgvector)
- [ ] All errors handled gracefully (no crashes)
- [ ] Privacy policy published
- [ ] Financial advice disclaimer on every relevant response
- [ ] User data deletion flow works
- [ ] All pending SQL run in Supabase
- [ ] Backend deployed on Railway
- [ ] Tested on minimum 3 different Android devices
- [ ] Morning check-in notification working
