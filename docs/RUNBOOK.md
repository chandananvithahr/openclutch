# Runbook — Clutch Backend

Operational guide for running, deploying, and debugging the Clutch backend.

## Health Check

```bash
curl http://localhost:3000/health
# Expected: { "status": "ok", "app": "Clutch Backend", "db": "connected" }
# Degraded: { "status": "degraded", "db": "error: <message>" }
```

If `status: degraded` — Supabase connection is failing. Check `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

<!-- AUTO-GENERATED: routes from backend/src/server.js -->
## API Routes

| Route | Purpose |
|-------|---------|
| `GET /health` | Health check — pings Supabase |
| `POST /api/chat` | Main AI chat endpoint |
| `GET /api/chat/history` | Chat history for a user |
| `GET /api/chat/facts` | Long-term memory facts for a user |
| `POST /api/chat/stream` | SSE streaming chat (real-time token output) |
| `GET /api/zerodha/login` | Zerodha OAuth login URL |
| `GET /api/zerodha/callback` | Zerodha OAuth callback |
| `GET /api/zerodha/holdings` | Zerodha portfolio holdings |
| `POST /api/angelone/login` | Angel One TOTP login |
| `GET /api/angelone/holdings` | Angel One portfolio holdings |
| `GET /api/gmail/auth` | Gmail OAuth login URL |
| `GET /api/gmail/callback` | Gmail OAuth callback |
| `GET /api/gmail/emails` | Fetch unread Gmail emails |
| `GET /api/calendar/auth` | Google Calendar OAuth login URL |
| `GET /api/calendar/callback` | Google Calendar OAuth callback |
| `GET /api/calendar/today` | Today's schedule |
| `GET /api/calendar/upcoming` | Upcoming events (next N days) |
| `GET /api/calendar/free-slots` | Free time slots today |
| `POST /api/cas/upload` | Upload CAS PDF for mutual fund parsing |
| `POST /api/sms/transactions` | Sync SMS bank transactions |
| `GET /api/sms/spending` | Monthly spending from SMS |
| `POST /api/journal` | Save journal entry |
| `GET /api/journal/insights` | Mood + spending pattern insights |
| `POST /api/career/score` | Score resume vs job description |
| `GET /api/career/advice` | Personalized career advice |
| `POST /api/health/sync` | Sync health data (steps, sleep, HR) |
| `GET /api/health/summary` | Health summary |
| `GET /api/workflows` | List all workflows |
| `POST /api/workflows/trigger/:name` | Trigger a specific workflow |

<!-- END AUTO-GENERATED -->

## Deployment (Railway)

```bash
# 1. Install Railway CLI
npm install -g @railway/cli
railway login

# 2. Link to project
railway link

# 3. Set env vars (one-time)
railway variables set OPENAI_API_KEY=sk-...
railway variables set SUPABASE_URL=https://...
railway variables set SUPABASE_ANON_KEY=...
# ... all other keys from .env.example

# 4. Deploy
railway up
```

After deploy, update `GMAIL_REDIRECT_URI` and `CALENDAR_REDIRECT_URI` to use the Railway URL:
```
GMAIL_REDIRECT_URI=https://YOUR_RAILWAY_URL/api/gmail/callback
CALENDAR_REDIRECT_URI=https://YOUR_RAILWAY_URL/api/calendar/callback
```

## Background Scheduler

The scheduler runs 3 background jobs. It only activates if `SCHEDULER_USER_IDS` is set.

| Job | Schedule | What it does |
|-----|----------|-------------|
| `emailSync` | Every 30 min | Syncs Gmail bank alert emails → sms_transactions |
| `portfolioSync` | Every 15 min | Fetches broker holdings → connected_apps snapshot |
| `weeklyReview` | Sunday 9am IST | Generates cross-domain weekly briefing |

To enable: `SCHEDULER_USER_IDS=user-id-1,user-id-2`

## Common Issues

### Backend crashes on startup

```
[FATAL] Missing required env var: OPENAI_API_KEY
```
→ `.env` file missing or not in `backend/` folder. Copy `.env.example` to `.env` and fill in values.

### Supabase `relation does not exist` error

→ SQL tables not created yet. Run in Supabase SQL Editor in order:
1. `backend/sql/notifications.sql`
2. `backend/sql/health_data.sql`
3. `backend/sql/journal_entries.sql`
4. `backend/sql/career_profiles.sql`
5. `backend/sql/indexes_and_rls.sql`

### CORS error from mobile app

→ Add your Railway URL to `ALLOWED_ORIGINS`:
```
ALLOWED_ORIGINS=https://your-app.railway.app,http://localhost:3000
```

### Rate limit hit (429)

→ Limit is 20 AI requests/min per user. Wait 60 seconds. In dev, increase `RATE_LIMIT.MAX_REQUESTS` in `lib/config.js`.

### Zerodha token expired

→ Token auto-clears on expiry. User re-authenticates via `GET /api/zerodha/login`.

## Rollback

```bash
# Railway: redeploy previous version from dashboard
# Or locally: git revert + redeploy
git revert HEAD
railway up
```
