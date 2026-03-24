# Clutch — Product Management Guide

> Last updated: 2026-03-21
> For: Founder (Chandan) to manage the product build

---

## Roadmap

```
NOW          MONTH 1-2        MONTH 3-4        MONTH 5-6        MONTH 7-12
──────────────────────────────────────────────────────────────────────────
Plan ✅   →  MVP Build    →   MVP Launch   →   V2 Build     →   Scale
             - Chat UI         - 100 users       - Artha          - 5,000+ users
             - Groww API        - Feedback        - Karma          - Paid tier
             - Zerodha API      - Fix bugs        - Alerts         - Angel round
             - Basic memory     - 30 paying       - More brokers   - Series A prep
```

---

## Sprint Structure (2-Week Sprints)

### Sprint 1 (Weeks 1–2): Foundation
**Goal:** Backend running, AI talking, chat working

| Task | Priority | Done? |
|------|----------|-------|
| Node.js + Express server setup | P0 | [ ] |
| Supabase database setup + tables | P0 | [ ] |
| OpenAI tool calling working (hello world) | P0 | [ ] |
| React Native + Expo project running on phone | P0 | [ ] |
| Basic chat screen (no AI yet, just UI) | P0 | [ ] |
| Chat UI connected to backend | P0 | [ ] |
| AI responds in chat | P0 | [ ] |

**Sprint 1 Done When:** You can open the app, type a message, get an AI response.

---

### Sprint 2 (Weeks 3–4): Zerodha + Angel One
**Goal:** First broker connected, real data flowing

| Task | Priority | Done? |
|------|----------|-------|
| Angel One OAuth flow (mobile → backend → Angel One) | P0 | [ ] |
| get_portfolio() tool — fetches Angel One data | P0 | [ ] |
| "How is my portfolio today?" works with real data | P0 | [ ] |
| Zerodha OAuth flow | P0 | [ ] |
| Zerodha portfolio fetch | P0 | [ ] |
| Onboarding screens (4 screens) | P1 | [ ] |
| Financial disclaimer on all responses | P0 | [ ] |

**Sprint 2 Done When:** You ask "how is my portfolio?" and see your real Angel One data.

---

### Sprint 3 (Weeks 5–6): Groww + Gmail + Memory
**Goal:** Top broker connected, email working, memory working

| Task | Priority | Done? |
|------|----------|-------|
| Groww OAuth + portfolio fetch | P0 | [ ] |
| Combined portfolio view (Groww + Zerodha + Angel One) | P0 | [ ] |
| Gmail OAuth + email fetch | P1 | [ ] |
| "Summarize my inbox" works | P1 | [ ] |
| mem0 memory extraction from chat | P1 | [ ] |
| pgvector memory retrieval | P1 | [ ] |
| Chat history persistent across sessions | P0 | [ ] |

**Sprint 3 Done When:** MVP is feature-complete. Give to 10 friends.

---

### Sprint 4 (Weeks 7–8): Fix & Polish
**Goal:** 10 friends using it, all feedback addressed

| Task | Priority | Done? |
|------|----------|-------|
| Fix all bugs from friend testing | P0 | [ ] |
| Improve AI response quality | P0 | [ ] |
| Error handling — all failures show clear messages | P0 | [ ] |
| Performance: AI response < 5 seconds | P0 | [ ] |
| Privacy policy published | P0 | [ ] |
| Data deletion flow | P0 | [ ] |
| Test on 5 different Android phones | P0 | [ ] |

**Sprint 4 Done When:** 10 friends using it, no crashes, NPS > 30.

---

## Decision Log

Track every major decision made. Future-you will thank present-you.

| Date | Decision | Why | Alternatives Rejected |
|------|---------|-----|----------------------|
| 2026-03-21 | Gemini Flash for MVP AI | Free tier, good enough for MVP | GPT-4o (costs money), Claude (costs money) |
| 2026-03-21 | Groww first (not Zerodha) | 27.7% market share vs 15.2% | Zerodha (second priority) |
| 2026-03-21 | Supabase for DB + pgvector | Free, no AWS, India region, one tool for everything | MongoDB (no vector), Pinecone (extra service) |
| 2026-03-21 | React Native + Expo | Android + iOS one codebase, Expo Go for testing | Flutter (less community), Native (too complex) |
| 2026-03-21 | Skip WhatsApp | No official personal API, legal risk | Build it (rejected: too risky) |
| 2026-03-21 | Free for first 3 months | Need feedback before charging. Fix > Monetize. | Charge from day 1 (rejected: too early) |

---

## Feature Prioritization Framework

Use this before adding ANY feature:

```
Ask these 4 questions:

1. Does it help the PRIMARY user (aspirational Indian investor, 25-35)?
   No → Don't build yet.

2. Does it make the CORE flow better?
   (Core flow = connect broker → ask question → get answer)
   No → Backlog.

3. Can we build it in < 1 week?
   No → Break it into smaller pieces.

4. Do we have user evidence it's needed?
   (At least 3 users asked for it)
   No → Idea board, not sprint.
```

---

## Bug Severity Levels

| Level | Definition | Response Time |
|-------|-----------|---------------|
| P0 — Critical | App crashes, data wrong, security issue | Fix today |
| P1 — High | Feature broken, user can't complete core flow | Fix this sprint |
| P2 — Medium | Minor bug, workaround exists | Fix next sprint |
| P3 — Low | Cosmetic, edge case | Backlog |

---

## User Feedback Process

1. **Week 1–6:** Talk to every user personally. Call them if possible.
2. **Week 7+:** Use feedback.md to log all issues
3. **Monthly:** Review patterns — what do 3+ users ask for? Build it.
4. **NPS survey:** Every month. Target >40.

**The Golden Rule:** Never add features based on what you think users want. Only add based on what they actually ask for, repeatedly.

---

## Metrics Dashboard (Check Weekly)

| Metric | How To Measure | Target |
|--------|---------------|--------|
| Daily Active Users | Supabase analytics | Growing week-over-week |
| Day 1 Retention | % users who return next day | >40% |
| Day 7 Retention | % users who return after a week | >20% |
| Queries per DAU | Total queries ÷ DAU | >5 (they're engaged) |
| Broker connect rate | % users who connect a broker | >70% |
| Free → Paid conversion | Paid users ÷ Total users | >5% |
| Churn | % paid users who cancel/month | <10% |
| NPS | Monthly survey | >40 |

---

## What To Do When Growth Stalls

**If Day 7 retention < 20%:** Product problem. Stop all growth. Fix the product.
**If broker connect rate < 50%:** Onboarding problem. Simplify the connect flow.
**If queries/DAU < 3:** Value problem. The AI answers aren't good enough.
**If free→paid < 3%:** Pricing problem OR product not valuable enough for money.
**If churn > 15%:** Product doesn't deliver long-term value. Add memory/proactive features.

---

## The PM's Job (Your Job)

As the founder-PM, your job every week:
1. Talk to 3 users
2. Review last week's metrics
3. Decide what Sprint focuses on
4. Remove blockers for development (even if you're building it yourself)
5. Write down every decision in the Decision Log

**You are not building features. You are solving user problems.**
Every feature is a bet that it solves a problem. Validate the problem first.
