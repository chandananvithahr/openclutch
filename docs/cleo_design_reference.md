# Clutch — Cleo AI Design Reference

> Last updated: 2026-03-25
> Primary UI/UX inspiration source for Clutch

---

## Cleo's Color Palette (Their Exact Values)

| Color | Hex | Usage |
|-------|-----|-------|
| Jacksons Purple | `#21248D` | Deep blue/purple — trust, grounding |
| Blue | `#341CFF` | Electric blue — primary accent, energy |
| Kournikova | `#FFE36D` | Warm yellow — CTAs, highlights, celebrations |
| Zircon | `#F2F6FF` | Light airy blue — backgrounds |

**Clutch diverges intentionally:** Cleo is light-mode dominant. Clutch is dark-mode-first with warm cocoa palette. We share the `#FFE36D` yellow accent. Our dark mode = premium Indian market feel (CRED validated dark mode works in India).

---

## Design System — "Cleonardo"

Four layers:
1. **Foundations** — colors, typography, spacing, grid
2. **Components** — cards, buttons, navigation, inputs
3. **Imagery** — custom emoji-like icons, hand-drawn illustration style (warm, not geometric)
4. **Patterns** — reusable layout patterns across screens

### Component Architecture
- **Card system** with modular variants: balance cards, advance cards, CTA cards, category cards
- **5-tab bottom navigation** with three-level hierarchy
- **"Super Type" screens** — full-screen typographic layouts for onboarding, modals, splash. Big bold text IS the design.
- Custom illustrated emoji system (brand-specific, not standard emoji)

### Three Creative Principles
1. **"BE FUN AND QUIRKY"** — vibrant, playful, alternative aesthetic
2. **"BE PERSONAL"** — conversational, approachable, real-life focused
3. **"BE BOLD"** — sharp, solid, casual rather than polished

---

## Onboarding Flow (Actual Steps)

1. Sign up (email/phone)
2. Bank sync via Plaid — trust messaging prominent ("We never store credentials")
3. Set monthly income
4. Add recurring bills
5. **First value delivery** — immediately shows spending overview

### Design Decisions
- Conversational — feels like chatting, not filling forms
- Trust messaging front and center during bank sync
- SMS notifications during slow operations: "Banks are a bit slow, we're on it"
- Progressive disclosure — one step per screen, never overwhelming
- **Super Type screens** — 32-40px headline, max 2 lines, centered, single input below
- **In-app stories** with animated visuals and sequence indicators
- Time to first value: under 2 minutes to bank connection

### Clutch Adaptation
Our 10-screen onboarding is more ambitious. Key change: **move broker/service connection from screen 10 to screen 3-4**. Get to first value faster. Add trust messaging: "Your data stays in India. Read-only. We never touch your money."

---

## Chat Interface

### How Messages Look
- Chat IS the app — type what you want ("wallet", "roast me", "spending")
- Informal language, emoji, slang, current internet speak
- Color/skin changes per personality mode
- GIFs embedded directly in chat (especially Roast mode)

### Financial Data in Chat
- **Cleo 3.0 renders graphs and trendlines directly inside messages**
- Spending breakdowns appear as in-chat cards
- Budget status shown conversationally: "You've spent $420 on food. That's 60% of your budget gone in 3 days."
- Balance cards, advance cards, CTA cards all inline

### Tool Results
- Never raw data dumps — always wrapped in personality
- Domain tools handle math; LLM interprets and presents with personality
- Multi-step tool chains (budget lookup + goal check + recommendation)

### Clutch Action Items
- Render charts INSIDE chat bubbles (spending pie, portfolio line chart, health trend)
- Each agent (Vriddhi, Artha, etc.) gets its own visual card style
- Never show raw JSON — personality wraps everything
- Build inline card components: portfolio card, spending card, health summary card

---

## Personality Modes — Deep Details

### Roast Mode ("Big Sister Energy")
- **Activation:** User types "roast me"
- **Consent-based:** You invite roast mode into your life
- **Format:** String of GIFs + brutal one-liners about spending
- **Real examples:**
  - "Congrats you've saved $0! Double that and you could save $0 by next month!"
  - Tells you Starbucks habit is why you still live with your parents
  - Points out Amazon spending contradicts your stated "support small business" values
  - Sometimes roasts essential expenses too (mortgage got roasted)
- **Visual:** Chat colors/skin transform. GIF-heavy.
- **Impact:** ~300K roasts/year. Screenshots shared virally. Doubled subscriber base YoY.

### Hype Mode
- Celebrates wins: "You're a financial genius for buying generic cereal"
- Positive reinforcement for good spending habits
- Visual skin transforms to celebratory mood
- Acts like "your best mate after three drinks"

### Brand Personality
- **"Big Sister Energy"** — "They care about you, but they'll slap you if you step out of line"
- Chatty, informal, emoji-heavy, current slang
- Bold, no-BS, radically honest. Wit + warmth + tough love.

### Clutch Bhai Mode Equivalents
- "Bro, tu Swiggy pe Rs 4,000 uda chuka hai is hafte. Ghar pe mummy ka khana kharab hai kya?"
- "Rs 3,200 Zomato pe. Tera khana Goa se aata hai kya?"
- Add GIF/meme support in bhai mode
- Make it screenshot-worthy and shareable

---

## Typography & Spacing

### Typography
- Large, expressive type as foundation (not small/dense)
- "Super Type" full-screen components where typography IS the design
- Fluid titles that scale with viewport
- Alternating alignment (left/center) for device-native feel
- **Heavier font weights for dark mode** — thin fonts underperform on dark backgrounds
- **More line spacing on dark backgrounds** for readability
- Geometric sans-serif with rounded, friendly characteristics (GT Walsheim-like)

### Information Density
- Low density — lots of whitespace
- One concept per screen on onboarding
- Card-based layouts prevent overload
- Chat-first = data delivered conversationally, not in dense dashboards

### Clutch Typography
- Use rounded geometric sans-serif: Inter, Plus Jakarta Sans, or Nunito (free)
- **Dark mode = heavier weights:** Medium/SemiBold for body, Bold/ExtraBold for headlines
- Line height: 1.5x-1.6x for body text
- Super Type screens: 32-40px headline, max 2 lines, centered
- Keep density low — one insight per message, not walls of text

---

## Spending Visualizations

### In-Chat (Cleo 3.0)
- Graphs and trendlines rendered directly in conversation
- No need to leave chat to see spending data

### Habits Section
- Visual display of past spending patterns
- Trend comparisons with past months
- Categories: bills, dining, entertainment, subscriptions, transport
- Custom categories on premium tier

### Budget Tracking
- Real-time percentage indicators
- Alerts when nearing limits
- Visual health indicators

### Clutch In-Chat Visualizations
- Spending donut chart (in chat bubble)
- Weekly trend bar chart
- Portfolio line chart
- Salary vs EMI ratio gauge
- Health trend sparkline
- Month-over-month comparison: "23% less on food delivery"

---

## Gamification

### Swear Jar
- User picks "guilty pleasure" stores
- Every purchase = a "fine" (pre-set amount)
- Fine money auto-moves to savings
- Weekly collection → "Your Zomato Fine Jar: Rs 3,200"
- **A "shopping tax" that builds savings automatically**

### Savings Challenges
- Set challenges: "No eating out for 7 days"
- Streak tracking (consecutive days)
- Accountability check-ins from Cleo

### Money IQ
- Weekly quiz game testing spending knowledge
- Cash prizes up to $4,000/week
- Gamifies financial literacy

### Clutch Gamification Plan
- **Swear Jar:** "Zomato Fine", "Amazon Fine" — Indian merchants
- **Spending Streaks:** Like Duolingo but for budgets
- **Cross-Domain Streaks:** "10K steps AND saved Rs 500 — double win!"
- **Financial IQ Quiz:** Indian finance questions (MF, tax saving, ELSS vs PPF)
- **Journal Streaks:** "5-day journal streak! Your mood improved 20%"

---

## Push Notifications

### Types
1. Weekly spending review — "Let's go over your expenses together"
2. Budget alerts — approaching spend limits
3. Bill due reminders
4. Behavioral nudges — data-driven, not random
5. Onboarding follow-ups — SMS during slow operations

### Weekly Review Format
- Push notification → opens chat → auto-populates spending review
- Playful commentary: "You spent $85 at Target... again"
- Celebrations for savings wins
- Conversational, never spreadsheet-like

### Notification Philosophy
- **AI + behavioral psychology** — awareness into action
- Conversational tone and timing, not intrusive
- Self-improving: measures engagement to improve timing
- Data-driven nudges, not scheduled spam
- **Never generic "Open the app"** — always include specific data insight

---

## Monetization UX

### Tiers
| Tier | Price | Key Features |
|------|-------|-------------|
| Free | $0 | Chat, budgeting, spending tracking, Roast/Hype mode |
| Plus | $5.99/mo | Cash advance, credit score, custom categories, 2.75% APY |
| Builder | $14.99/mo | $500 advance, credit building, priority support |

### Upsell Strategy
- **Free tier is genuinely useful** — core experience never gated
- Premium gates financial SERVICES (advance, credit building), not the AI
- Contextual prompts: "Want your credit score? Upgrade to Plus"
- AI itself suggests upgrades when relevant to conversation
- 12.5% conversion rate (1M paid / 8M total)

### Clutch Monetization
- Free: All 6 agents, basic spending tracking, portfolio view, chat
- Pro (Rs 149-199/mo): Cross-domain intelligence, full memory, proactive alerts
- **Gate the CROSS-DOMAIN magic, not basic features** — that's the moat
- Trigger: "Want sleep-vs-spending correlation? That's Clutch Pro."
- Annual: Rs 999/year vs Rs 199/month

---

## Cleo 3.0 Technical Architecture

From their engineering blog:
1. **Tool-calling:** LLM plans actions → invokes tools → integrates results into conversation
2. **Multi-step workflows:** Recursive tool chains for complex tasks
3. **Domain separation:** Math/categorization in tools; LLM handles intent + personality
4. **Memory:** After meaningful exchanges → dedicated summarization service → selective retrieval by context
5. **Background agent:** Watches transactions + history → detects changes → surfaces follow-ups proactively

**Clutch validation:** Our architecture mirrors this — tools/index.js + executor.js + memory/facts.js + workflows/. Architecturally aligned with a $250M ARR company.

---

## Sources

- [Cleo Brand Colors (Mobbin)](https://mobbin.com/colors/brand/cleo-ai)
- [Cleo Design Story (Official)](https://web.meetcleo.com/blog/from-just-blue-to-sweet-wrappers-shaped-like-eyeballs-the-design-story-of-cleo)
- [Cleonardo Design System](https://cleonardo.meetcleo.com/056bb4358/p/89e7ac-design-and-build-without-the-chaos)
- [Cleo 3.0 Launch](https://www.businesswire.com/news/home/20250729690058/en/)
- [Cleo Memory System](https://web.meetcleo.com/blog/memory-as-a-step-toward-more-human-ai)
- [Cleo Agent Architecture](https://web.meetcleo.com/blog/building-a-financial-agent-on-top-of-commodified-llms)
- [Cleo Roast Mode](https://web.meetcleo.com/blog/the-money-app-that-roasts-you)
- [Big Sis Energy](https://writer.com/blog/big-sis-energy/)
- [Ben Hartley - Meet Cleo](https://www.hartley.design/work/meet-cleo)
