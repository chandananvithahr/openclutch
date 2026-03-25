# OpenClutch — Product Vision & Strategy

## One-Line Identity

> **Your life's control room — one AI that knows your money, career, health, and mood, and connects the dots between them.**

No other app does this. Zerodha doesn't know you're stressed. Google Fit doesn't know you're broke. LinkedIn doesn't know your portfolio crashed and you should NOT quit your job right now.

**The moat is cross-domain intelligence.** Not any single feature.

---

## The 6 Life Domains

| Domain | Agent | What It Knows | The Real Value |
|--------|-------|---------------|----------------|
| **Money** | Artha | Spending, salary, bills, subscriptions | "You spent 40% more on dining this month" |
| **Wealth** | Vriddhi | Stocks, MFs, portfolio, market data | "Your SIPs are buying cheaper during this dip" |
| **Career** | Karma | Resume, jobs, interviews, salary | "This job pays 30% more but your expenses are Mumbai-level" |
| **Health** | Arogya | Steps, sleep, heart rate, activity | "You slept 4hrs — you historically make bad purchases on these days" |
| **Mind** | Chitta | Journal, mood, stress, patterns | "You've journaled 'anxious' 4x this week — all on market red days" |
| **Time** | Kaal | Calendar, meetings, free slots, schedule | "3 meetings today, 2 deadlines, haven't exercised in 5 days" |

---

## What Makes People Say "Holy Shit"

### 1. The Sunday Briefing (Weekly Intelligence Report)
Not a dashboard. A 60-second chat summary:
> "This week: earned 1.2L, spent 38K (12K food — way too much Swiggy). Portfolio up 2.3%. Avg sleep 5.8hrs — worst Wednesday when Nifty dropped 400pts. Journaled 'frustrated' twice. One reply from Flipkart — interview Tuesday. This week: sleep before 11pm, cut food delivery to 5K, prep for Flipkart round 2."

**This alone is a product.**

### 2. Cross-Domain Pattern Alerts
- "You spend 2x more on days you sleep under 6 hours" (health -> money)
- "Portfolio checking spikes when you journal about work stress" (mind -> wealth)
- "Every time you order food after 11pm, you skip morning walk" (money -> health)
- "Last 3 times markets dropped 2%+, you panic-sold within 48hrs" (wealth -> behavior)

Nobody else can do this because nobody else has ALL the data.

### 3. The "Should I?" Engine
User: "Should I buy an iPhone 16?"
> "You have 2.1L savings, 45K monthly expenses, next SIP in 4 days (15K). Emergency fund: 2.8 months (target: 6). Buying 1.2L phone drops it to 1.9 months. Wait 3 months — bonus cycle is June. Or go 128GB at 79K."

**Personal** financial context no generic AI can give.

### 4. Stealth Insights (Proactive, Unasked)
- "Uber spend tripled this month — did you move further from office?"
- "Haven't invested in 45 days — auto-SIP still running?"
- "3 subscription charges failed — check bank balance"
- "Salary was 4 days late vs usual pattern"

---

## What Makes It "Sexy"

### Currently NOT sexy:
- "Connect your broker" — sounds like work
- "Upload CAS PDF" — sounds like filing taxes
- "SMS parsing" — sounds like surveillance
- 5 agent names nobody will remember

### What IS sexy:
- "OpenClutch told me to stop ordering Zomato because my SIP is bouncing next week"
- "It noticed I sleep badly on days I check my portfolio 3+ times"
- "It prepped me for my interview AND told me the minimum salary based on my actual expenses"
- "Sunday morning I get a 30-second summary of my entire week"

**The magic is in the CONNECTIONS, not the individual features.**

---

## What Should NOT Be In The App

### Kill:
- **WhatsApp integration** — privacy nightmare, no API, Meta will break you
- **Visible agent names** — users don't care about internal architecture. One AI, invisible routing
- **CAS PDF upload UX** — make it contextual ("connect your MFs" when user asks about MFs)
- **Complex onboarding** — start with ZERO connections. AI says "I could answer better if you connected Zerodha" contextually
- **Dashboard/Charts in v1** — chat IS the interface. Charts come later

### Keep but simplify:
- **Tone switching** — one-time personality pick during onboarding, not a header toggle
- **Health data** — powerful for cross-domain, but don't feel like a fitness app

---

## India-First Strategy

### Why India-first is your ADVANTAGE:
- **No competitor** — India has no personal AI connecting money + health + career
- **UPI/SMS ecosystem** — uniquely Indian, uniquely parseable
- **Growing market** — 10Cr+ demat accounts, most opened in last 4 years
- **Cost advantage** — run for Rs 500/user/month infra, charge Rs 199/month

### Don't build for US/EU now:
- Broker APIs completely different (Alpaca, IBKR, no Robinhood API)
- No SMS banking — they use Plaid ($$$)
- SEC rules about "investment advice", GDPR kills SMS reading
- Competitors exist with VC backing (Copilot Money, Monarch, Wealthfront)

### International expansion path:
1. After 10K paying Indian users
2. UAE/Singapore first (Indian diaspora, similar products, less regulation)
3. Build "Plaid adapter" layer for US bank connections
4. US/EU only with proven cross-domain insight data

---

## Monetization

### Free tier:
- Chat with AI (limited messages/day)
- Connect 1 broker
- SMS expense tracking
- Weekly briefing (text only)

### Pro (Rs 199/month):
- Unlimited chat
- All broker connections
- Cross-domain pattern alerts
- "Should I?" engine
- Career tools
- Health correlation insights
- Stealth insights

### Why Rs 199:
- Less than Netflix (Rs 149-649)
- Less than one Swiggy order
- Enough to filter serious users
- Scales to Rs 499 with premium features later

---

## Onboarding — Cleo AI-Inspired Experience

### Design Philosophy (Inspired by Cleo AI)
- **Chat personality over corporate polish** — feels like texting a friend, not filling a form
- **One question per screen** — big text, lots of whitespace, no cognitive overload
- **Instant micro-insights after every answer** — user feels value immediately
- **Every question skippable except name** — "I'll do this later" always available
- **Adaptive branching** — students see different flow than working professionals
- **Trust-first messaging** — "Read-only. Your data stays in India. We can look, never touch."

### Color Palette (Warm, Not Corporate)
Cleo rejected blue (75% of fintech uses blue). We use warm cocoa tones:
```
Primary BG:     #2D1B14  (deep cocoa)
Card BG:        #3A2820  (warm dark brown)
Accent/CTA:     #FFE36D  (warm yellow — buttons, highlights)
Success:        #4CAF50  (green — money positive)
Alert:          #FF6B6B  (soft red — warnings)
Text Primary:   #F5F0EB  (warm white — not pure white)
Text Secondary: #B8A99A  (muted warm)
```
Dark mode default. Premium feel. Indian-market friendly.

### Typography & Spacing
- Headlines: 24-28px, bold
- Body: 16px, regular weight
- Generous whitespace — no cramming
- Semi-bold for actions, regular for body
- Casual language, zero financial jargon

### Chat Mode Visual Skins (Maps to Existing Tones)
| Cleo Mode | OpenClutch Tone | Visual Change |
|-----------|----------------|---------------|
| Roast Mode | `bhai` | Orange/yellow chat skin, Hinglish, brutally honest |
| Normal Mode | `pro` | Clean brown/white, data-first |
| Hype Mode | `mentor` | Soft purple/blue, encouraging, explains why |

Chat background color shifts when tone changes. User FEELS the personality switch.

### Onboarding Flow (10 Screens Max, Most Users See 7-8)

```
Screen 1:  "Hey! What should I call you?" [big input, warm bg]
Screen 2:  "How old are you?" [age slider, fun]
Screen 3:  "Where do you live?" [city autocomplete, Indian cities]
Screen 4:  "Student or hustling for a living?" [two big tappable cards]
           → instant AI reaction: "Ah, the corporate life 😤"
             or "Student life! Best years 🎓"

── If Working ──
Screen 5w: "What's your annual CTC?" [slider ₹3L → ₹1Cr]
           → instant: "₹12L? That's ₹83K take-home. Let's make sure
              it's not all going to Swiggy 🍕"
Screen 6w: "Any EMIs eating your salary?" [yes/no → amount]
           → instant: "₹25K EMI on ₹83K take-home... 30%. We'll watch this."

── If Student ──
Screen 5s: "What are you studying?" [field + year]
Screen 6s: "Want help finding jobs?" [yes → enables Karma agent]
           → "Your personal career agent, activated 💪"

Screen 7:  "What do you care about most?"
           [Money 💰] [Career 🎯] [Health 🏃] [Peace of mind 🧘]
           → multi-select, determines which agent greets first

Screen 8:  "Into fitness? Got a tracker?"
           → Yes: connect Health Connect / upload PDF
           → No: "No judgment. We'll start simple 😄"

Screen 9:  "How are you saving?"
           [MF] [Stocks] [Gold] [FD/Debt] [Nothing yet]
           → "Nothing yet? Perfect, that's literally why I exist"
           If working: "Own a car/bike/house? Any loans?"

Screen 10: "Last thing — connect what you want now"
           [Connect Broker] [Upload MF Statement] [Connect Gmail] [Skip all →]
           → "You can always do this later from chat"

→ DONE → First chat message uses EVERYTHING they told us
```

### First Chat = The Wow Moment
After onboarding, the AI's first message uses all collected profile data:
```
"Hey Chandan! Here's what I see:

💰 Take-home: ~₹83K/month, EMIs eating 30%
📊 You're into MFs — upload CAS and I'll show real returns
🏃 No tracker yet — I can still track if you log manually
🎯 You care most about Money & Career

What do you want to start with?"
```
User didn't ask for this. The AI just knew. That's retention.

### Profile Completeness (Passive Nudging in Chat)
No progress bar screen. The AI nudges naturally:
```
Day 2: "BTW, connecting your broker takes 30 seconds. Want to?"
Day 4: "You mentioned MFs but haven't uploaded CAS yet. Want your real XIRR?"
```
Smart context-aware nudges inside conversation, not notification spam.

### Gamification — Streaks & Micro-Rewards
```
🔥 5-day journal streak! Keep going.
💰 You saved ₹3,200 more than last month.
🏃 10K steps 3 days in a row — your best week.
```
Streaks for: journaling, step goals, savings, daily check-ins.

### In-Chat Visualizations (Cleo Pattern)
Render charts INSIDE the chat bubble — no tab switching:
- Spending bar charts
- Portfolio pie charts
- Health trend lines
- Salary vs EMI ratio gauges

### Micro-Interactions
- Haptic feedback on every selection
- Slide-up transitions between onboarding screens
- Typing indicator with personality (already built)
- Chat skin color shift on tone change
- Emoji reactions on messages (double-tap)

### 5-Tab Navigation (Chat Centered)
```
[Home]  [Money]  [💬 Chat]  [Health]  [Profile]
                    ↑
              center, primary
```
Chat is the heart. Other tabs deep-link back to chat for actions.

### Data Collected → How It's Used
| Data Point | Stored In | Used By |
|------------|-----------|---------|
| Name, age, city | `user_profiles` | All agents — personalization |
| Mobile, email | `user_profiles` | Account identity |
| Height, weight | `user_profiles` | Arogya — BMI, health context |
| Student/Working | `user_profiles` | Karma — enable/disable job features |
| Salary (CTC) | `user_profiles` | Artha — budget, take-home calc |
| EMI amount | `user_profiles` | Artha — debt-to-income ratio |
| Fitness tracker | `user_profiles` | Arogya — Health Connect sync |
| Savings style | `user_profiles` | Vriddhi — MF/stocks/gold context |
| Assets (car/bike/house) | `user_profiles` | Artha — net worth, loan tracking |
| Domain priorities | `user_profiles` | First chat greeting, agent priority |

---

## 10-Day Sprint Plan (2026-03-25 to 2026-04-04)

### Days 1-2: Foundation (Make It Run)
- [ ] Run ALL pending SQL in Supabase (notifications, health_data, journal_entries, career_profiles, user_profiles, indexes_and_rls)
- [ ] Deploy backend to Railway with all env vars
- [ ] Mobile build stable on real device
- [ ] Fix input bar issue from Session 3
- [ ] Test end-to-end: type message -> get AI response on real phone

### Days 3-4: Onboarding + Broker Blitz
- [ ] Build Cleo-style onboarding flow (OnboardingFlow.js — replaces OnboardingScreen.js)
- [ ] Backend POST /api/onboarding/profile + user_profiles table
- [ ] Upstox OAuth2 + adapter (P0)
- [ ] Fyers OAuth2 + adapter (P1)
- [ ] Dhan token auth + adapter (P1)
- [ ] 5paisa OAuth + TOTP + adapter (P2)
- [ ] All 6 brokers merging into single `get_portfolio`

### Days 5-6: The Magic Layer (Cross-Domain Intelligence)
- [ ] Sunday Briefing — weekly intelligence report (spending + health + mood + career + portfolio)
- [ ] Pattern detection engine — correlate sleep/spending, mood/portfolio, stress/impulse-buying
- [ ] Stealth insights — proactive notifications when patterns detected
- [ ] "Should I?" purchase advisor — contextual spending decisions with real financial data

### Days 7-8: Polish & UX
- [ ] In-chat visualizations (spending charts, portfolio pie in message bubbles)
- [ ] Markdown rendering in MessageBubble
- [ ] Chat mode visual skins (bhai=orange, pro=brown, mentor=purple)
- [ ] Profile completeness nudging in chat
- [ ] 5-tab navigation (Home, Money, Chat, Health, Profile)
- [ ] Gamification streaks (journal, steps, savings)

### Days 9-10: Ship & Test
- [ ] End-to-end testing all 27 tools on real device
- [ ] Test with 3-5 real users (friends/family)
- [ ] Fix critical bugs from user testing
- [ ] Play Store internal testing track upload
- [ ] Landing page with 3 demo screenshots/videos

---

## Success Metrics (Day 10)

- [ ] App runs on 3+ real Android devices without crashes
- [ ] 6 brokers connectable (even if not all tested with real accounts)
- [ ] Sunday Briefing generates meaningful cross-domain summary
- [ ] At least 1 cross-domain insight working (e.g., sleep -> spending)
- [ ] 5 real humans have used it and given feedback
- [ ] Backend live on Railway, not just localhost
