# Clutch — Breakeven Analysis

> Last updated: 2026-03-21
> All figures in Indian Rupees (₹)

---

## Monthly Cost Structure

### Phase 1 — MVP (0–100 users, ₹0 spend target)

| Cost Item | Monthly Cost | Notes |
|-----------|-------------|-------|
| Gemini Flash API | ₹0 | Free tier: 1000 req/day |
| Angel One API | ₹0 | Free |
| Upstox API | ₹0 | Free |
| Fyers API | ₹0 | Free |
| Supabase | ₹0 | Free tier: 500MB, 50k users |
| Render hosting | ₹0 | Free tier: 750 hrs/month |
| Firebase FCM | ₹0 | Free |
| Expo | ₹0 | Free tier |
| **Total Phase 1** | **₹0/month** | |

### Phase 2 — Growth (100–500 users)

| Cost Item | Monthly Cost | Notes |
|-----------|-------------|-------|
| OpenAI GPT-4o | ₹4,000 | ~500 users × 20 queries/day × ₹0.40/query |
| Groww API | ₹499 | Add when revenue covers it |
| Zerodha API | ₹500 | Add when revenue covers it |
| Supabase Pro | ₹2,100 ($25) | At 50k+ users |
| Railway/Render paid | ₹1,260 ($15) | When free tier exceeded |
| OpenAI Embeddings | ₹500 | Memory/RAG |
| **Total Phase 2** | **~₹8,859/month** | |

### Phase 3 — Scale (500–2000 users)

| Cost Item | Monthly Cost | Notes |
|-----------|-------------|-------|
| OpenAI GPT-4o | ₹16,000 | 2000 users × 20 queries × ₹0.40 |
| All broker APIs | ₹1,500 | Groww + Zerodha + others |
| Supabase Pro | ₹2,100 | |
| Hosting (Railway) | ₹2,500 | |
| Embeddings + Memory | ₹2,000 | |
| Misc (monitoring, etc) | ₹1,000 | |
| **Total Phase 3** | **~₹25,100/month** | |

---

## Revenue Model

### Pricing Tiers

| Plan | Price | What's Included |
|------|-------|----------------|
| Free | ₹0 | 2 brokers, 20 queries/day, 30-day memory |
| Pro | ₹299/month | Unlimited brokers + queries, 1-year memory, proactive alerts, voice |
| Family | ₹499/month | Pro × 5 family members |

### Annual pricing (20% discount)
- Pro Annual: ₹2,870/year (₹239/month equivalent)
- Family Annual: ₹4,790/year (₹399/month equivalent)

---

## Breakeven Calculations

### Phase 1 Breakeven (₹0 costs)
```
Cost:     ₹0/month
Revenue:  ₹0 needed
Status:   Already broken even — build and learn for free
```

### Phase 2 Breakeven (₹8,859/month costs)
```
Costs:          ₹8,859/month
Pro plan:       ₹299/month per user
Users needed:   ₹8,859 ÷ ₹299 = 30 Pro users

BREAKEVEN AT 30 PAYING USERS
```

### Phase 3 Breakeven (₹25,100/month costs)
```
Costs:          ₹25,100/month
Pro plan:       ₹299/month per user
Users needed:   ₹25,100 ÷ ₹299 = 84 Pro users

BREAKEVEN AT 84 PAYING USERS
```

---

## Revenue Projections

### Conservative Scenario (5% free-to-paid conversion)

| Month | Total Users | Paid Users (5%) | Monthly Revenue | Monthly Cost | Profit/Loss |
|-------|------------|-----------------|----------------|-------------|-------------|
| 1 | 50 | 0 (free MVP) | ₹0 | ₹0 | ₹0 |
| 2 | 150 | 0 (free MVP) | ₹0 | ₹0 | ₹0 |
| 3 | 300 | 15 | ₹4,485 | ₹8,859 | -₹4,374 |
| 4 | 500 | 25 | ₹7,475 | ₹8,859 | -₹1,384 |
| 5 | 800 | 40 | ₹11,960 | ₹8,859 | +₹3,101 ✅ |
| 6 | 1,200 | 60 | ₹17,940 | ₹12,000 | +₹5,940 |
| 9 | 3,000 | 150 | ₹44,850 | ₹20,000 | +₹24,850 |
| 12 | 6,000 | 300 | ₹89,700 | ₹35,000 | +₹54,700 |

**Break even: Month 5 at ~800 total users / 40 paying users**

### Realistic Scenario (10% conversion — good product)

| Month | Total Users | Paid (10%) | Monthly Revenue | Profit/Loss |
|-------|------------|-----------|----------------|-------------|
| 3 | 300 | 30 | ₹8,970 | +₹111 ✅ |
| 6 | 1,000 | 100 | ₹29,900 | +₹17,900 |
| 12 | 5,000 | 500 | ₹1,49,500 | +₹1,14,500 |

**Break even: Month 3 at 300 total users / 30 paying users**

---

## Unit Economics

```
Average Revenue Per User (ARPU):
  Free user:    ₹0/month
  Pro user:     ₹299/month
  Family user:  ₹499/month ÷ 5 = ₹100/member

Cost Per User (at scale):
  AI queries:   ~₹20/user/month (20 queries/day × 30 days × ₹0.033)
  Storage:      ~₹2/user/month
  Infra:        ~₹3/user/month
  Total:        ~₹25/user/month

Gross Margin (Pro user):
  Revenue:      ₹299
  Cost:         ₹25
  Margin:       ₹274 (91.6% gross margin) ✅ Excellent
```

---

## Funding Needs

### Option A — Bootstrap (Recommended to start)
```
Month 1-4:    ₹0 costs (free tiers)
Month 5+:     Revenue covers costs
Total needed: ₹0–₹5,000 (buffer for unexpected)
```

### Option B — Small Seed (if you want to move faster)
```
Hire 1 developer:     ₹50,000–₹80,000/month
Marketing:            ₹20,000/month
Infrastructure:       ₹10,000/month
3 months runway:      ₹2,40,000–₹3,30,000
```

### Option C — Angel Round (to scale fast)
```
Raise: ₹50L–₹1Cr
Use for: 2 developers + 1 designer + 6 months runway
Target: 10,000 users before raising Series A
```

---

## Key Insight

**This is one of the most capital-efficient AI products possible:**
- ₹0 to launch
- Break even at just 30 paying users
- 91%+ gross margins at scale
- No inventory, no delivery, no hardware

**The only thing you need to spend is time.**
