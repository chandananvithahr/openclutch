# OpenClutch — Full Audit Report & gstack Usage Plan

**Generated:** 2026-03-25 | **gstack v0.11.18** | **3 parallel agents (Security + Architecture + Product)**

---

## PART 1: AUDIT RESULTS

### Security Audit — 5 CRITICAL, 8 HIGH, 9 MEDIUM, 5 LOW

| ID | Sev | File | Issue |
|----|-----|------|-------|
| C-1 | CRITICAL | All routes | `userId` from req.body, not JWT — any user can read/write any other user's data |
| C-2 | CRITICAL | All broker routes | All tokens stored as `'default_user'` — multi-user token collision |
| C-3 | CRITICAL | angelone.js, dhan.js | Raw broker password in request body, potential log exposure |
| C-4 | CRITICAL | All OAuth callbacks | Unauthenticated callbacks with no user session binding |
| C-5 | CRITICAL | sms.js | IDOR on financial transaction write via user-supplied userId |
| H-1 | HIGH | rateLimit.js | Rate limiter uses client-supplied userId — bypassable |
| H-2 | HIGH | server.js | `/health` leaks DB error messages publicly |
| H-3 | HIGH | All broker routes | `err.message` returned raw on 500 — internal error leakage |
| H-4 | HIGH | files.js | Files written to disk — temp file persistence risk |
| H-5 | HIGH | onboarding.js | Mass assignment on POST profile — all req.body fields accepted |
| H-6 | HIGH | onboarding.js | Mass assignment + no ownership check on PATCH |
| H-7 | HIGH | onboarding.js, all routes | IDOR on profile GET — any user can read any profile |
| H-8 | HIGH | fivepaisa.js | Developer brokerage credentials embedded in SDK |

### Architecture Audit — 3 CRITICAL, 10 HIGH, 10 MEDIUM, 2 LOW

| ID | Sev | Issue |
|----|-----|-------|
| A-C1 | CRITICAL | **Zero tests** — not a single test file in entire codebase |
| A-C2 | CRITICAL | In-process broker tokens — lost on every Railway deploy |
| A-C3 | CRITICAL | `default_user` bypasses JWT auth in chat.js |
| A-H1 | HIGH | In-memory cache won't scale horizontally |
| A-H2 | HIGH | In-memory rate limiter won't scale |
| A-H3 | HIGH | Silent failures in chat stream route |
| A-H4 | HIGH | Duplicate rate limiting on chat (global + route = 10 req/min not 20) |
| A-H5 | HIGH | Route files export business logic (should be services) |
| A-H6 | HIGH | N+1 pattern in portfolio chart (30 sequential Yahoo calls) |
| A-H7 | HIGH | `memoriesTableExists` queries DB on every chat request |
| A-H8 | HIGH | Unvalidated tool arguments from LLM |
| A-H9 | HIGH | Unused dep `mem0ai` + duplicate 5paisa SDKs |
| A-H10 | HIGH | Full conversation + tool payloads sent to client (50-100KB/msg) |

### Product Audit — YC Office Hours Verdict

| Question | Answer |
|----------|--------|
| Target user | Too broad (6 domains = "everyone alive"). Narrow to: investor with 2+ brokers wanting unified view |
| 10x thing | "Should I?" engine + Sunday Briefing = genuinely 10x. But neither exists yet. |
| Real moat | Multi-broker view (brokers will never show competitor data) + memory + Hinglish personality |
| 10-day sprint | Unrealistic. 30-40 days compressed into 10. Cut to 3 things. |
| Kill risk | Day 7 retention cliff. If <20%, nothing else matters. |
| Build next | Weekly spending roast in Bhai Mode. Cleo's proven growth engine. Screenshot-worthy = viral. |
| Too much? | **Yes. Unambiguously.** 27 tools, 6 brokers, 6 agents = 50-person team roadmap, not solo dev MVP. |
| Ship with | Chat + Bhai/Pro mode + Zerodha/Angel One + SMS spending + Weekly review. That's it. |

---

## PART 2: PRIORITY FIX ORDER

### Phase 1: Security (do before ANY external traffic)
1. Replace every `req.body.userId` / `req.query.userId` with `req.userId` across ALL routes + rateLimit.js
2. Refactor broker token storage to per-user (embed userId in OAuth state)
3. Add field whitelist to onboarding profile endpoints
4. Sanitize all `err.message` from 500 responses — return generic messages
5. Switch multer to `memoryStorage()`

### Phase 2: Architecture (do before scaling)
1. Write tests for core path: auth, chat route, tool executor, workflow engine
2. Move broker tokens to database-only reads (eliminate in-process state)
3. Extract business logic from route files into services/
4. Add input validation to tool executor
5. Fix duplicate rate limiting on chat endpoint
6. Cache `memoriesTableExists` result
7. Add OpenAI timeouts (30s chat, 10s embeddings)
8. Remove unused deps (mem0ai, duplicate 5paisa SDK)

### Phase 3: Product (do to ship)
1. Build Weekly Spending Review with Bhai Mode roasts
2. Build "Should I?" purchase advisor
3. Build Sunday Briefing (money domain only first)
4. Get 100 real users on real devices
5. Measure Day 7 retention — if <20%, product is wrong

---

## PART 3: GSTACK USAGE PLAN — ALL 27 SKILLS MAPPED TO YOUR WORKFLOW

### When to Use Each Skill

#### PLANNING PHASE (before building any feature)

| Skill | When | Example for OpenClutch |
|-------|------|----------------------|
| `/office-hours` | Before building a new feature — get YC-style "is this worth building?" | "Should I build health-spending correlation or weekly roast first?" |
| `/plan-ceo-review` | Before committing to a feature direction | "Review the Sunday Briefing feature scope" |
| `/plan-eng-review` | Before writing code — architecture + edge cases | "Review the per-user broker token refactor plan" |
| `/plan-design-review` | Before building UI — rates design 0-10 | "Review the onboarding flow UX" |
| `/autoplan` | Run all 3 reviews automatically in sequence | Use for any major feature (runs CEO → Design → Eng) |
| `/design-consultation` | Building a new design system from scratch | "Build the Cleo-inspired dark mode design system" |

#### BUILDING PHASE (while writing code)

| Skill | When | Example for OpenClutch |
|-------|------|----------------------|
| `/plan` | Break feature into implementation steps | "Plan the security fix for userId across all routes" |
| `/tdd` | Write tests first, then implement | "TDD the auth middleware userId enforcement" |
| `/code-review` | After writing/modifying code | Run after every significant code change |
| `/build-fix` | When build fails | If `node src/server.js` crashes on startup |
| `/investigate` | Debugging a hard bug | "Why do broker tokens disappear after deploy?" |
| `/codex` | Get a second opinion from OpenAI Codex | "Is my rate limiter implementation correct?" |

#### QA PHASE (before shipping)

| Skill | When | Example for OpenClutch |
|-------|------|----------------------|
| `/qa` | Test the live app and fix bugs | `/qa https://humble-blessing-production.up.railway.app` |
| `/qa-only` | Test but only report — no code changes | Generate a QA report without auto-fixing |
| `/browse` | Raw headless browser commands | Navigate Railway app, fill forms, take screenshots |
| `/e2e` | Generate and run Playwright E2E tests | Test chat flow, broker OAuth, onboarding |
| `/benchmark` | Performance regression detection | Measure API response times before/after changes |
| `/responsive` | Test mobile/tablet/desktop layouts | Check Railway app at 375px, 768px, 1440px |

#### SECURITY PHASE (before any external traffic)

| Skill | When | Example for OpenClutch |
|-------|------|----------------------|
| `/cso` | Full OWASP + STRIDE security audit | Run before opening Railway to real users |
| `/security-scan` | Scan Claude Code config for injection risks | Check .claude/ directory for misconfigurations |

#### SHIPPING PHASE (when ready to deploy)

| Skill | When | Example for OpenClutch |
|-------|------|----------------------|
| `/review` | PR review before merging | Review the security fix PR |
| `/ship` | Full ship workflow: tests → review → push → PR | Ship the userId fix to master |
| `/land-and-deploy` | Merge → deploy → verify production | After PR approved, deploy to Railway |
| `/canary` | Post-deploy monitoring loop | Watch Railway for errors after deploy |
| `/document-release` | Update docs after shipping | Update CLAUDE.md, ARCHITECTURE.md after changes |

#### SAFETY & MAINTENANCE

| Skill | When | Example for OpenClutch |
|-------|------|----------------------|
| `/careful` | Before destructive commands | Warns before rm -rf, DROP TABLE, force-push |
| `/freeze` | Lock a directory from edits | Freeze `android/` to prevent accidental edits |
| `/guard` | Careful + freeze together | Use during sensitive refactors |
| `/unfreeze` | Remove freeze | After refactor is complete |
| `/retro` | Weekly retrospective | Review what shipped this week, what stalled |

---

### YOUR DAILY WORKFLOW WITH GSTACK

```
Morning:
  /retro              → What happened yesterday? What's blocked?
  /office-hours       → Am I building the right thing today?

Before coding:
  /plan-eng-review    → Is my approach architecturally sound?
  /plan               → Break feature into steps
  /freeze android/    → Protect generated code

While coding:
  /tdd                → Tests first, then implement
  /code-review        → After every significant change
  /investigate        → When stuck on a bug

Before shipping:
  /cso                → Security audit
  /qa                 → QA the Railway deployment
  /review             → PR review
  /ship               → Full ship workflow

After shipping:
  /canary             → Monitor production
  /document-release   → Update docs
  /retro              → What did I learn?
```

---

### IMMEDIATE ACTIONS (this session)

1. **Run `/cso`** — Full security audit against Railway deployment
2. **Fix C-1** — Replace all `req.body.userId` with `req.userId` (biggest security hole)
3. **Run `/qa`** — Test Railway app end-to-end with headless browser
4. **Commit** — All security fixes in one commit
5. **Run `/ship`** — Deploy fixes to Railway

---

### WHAT I SHOULD HAVE DONE IN PREVIOUS SESSIONS

| Session | What I Did | What gstack Would Have Caught |
|---------|-----------|------------------------------|
| Session 6 (refactor) | 8-phase cleanup | `/plan-eng-review` would have flagged the service layer missing |
| Session 7 (onboarding) | Built onboarding flow | `/plan-design-review` would have rated the UX. `/cso` would have caught mass assignment. |
| Session 8 (brokers) | Built 4 new broker adapters | `/plan-eng-review` would have caught the `default_user` hardcoding. `/code-review` would have caught error leakage. |
| Session 8 (security) | Fixed 5 critical issues | `/cso` would have found ALL of these + the ones we missed |
| Session 8 (Railway) | Deployed to Railway | `/qa` would have tested the live deployment. `/canary` would monitor it. |

**Going forward:** Every session uses gstack skills. No exceptions.
