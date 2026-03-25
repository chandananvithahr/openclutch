# Contributing to Clutch

## Prerequisites

- Node.js 18+
- Android Studio (for mobile builds)
- Expo CLI (`npm install -g expo-cli`)
- A Supabase account with the project set up
- An OpenAI API key

## Setup

```bash
# 1. Clone the repo
git clone https://github.com/chandananvithahr/openclutch.git
cd openclutch

# 2. Install backend dependencies
cd backend && npm install

# 3. Copy env file and fill in values
cp .env.example .env
# Edit .env — OPENAI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY are required

# 4. Run SQL tables in Supabase (in this order)
# Go to Supabase → SQL Editor and run:
# backend/sql/notifications.sql
# backend/sql/health_data.sql
# backend/sql/journal_entries.sql
# backend/sql/career_profiles.sql
# backend/sql/indexes_and_rls.sql  ← run last

# 5. Start the backend
npm start
```

<!-- AUTO-GENERATED: scripts from backend/package.json -->
## Available Commands

| Command | Description |
|---------|-------------|
| `npm start` | Start production server (`node src/server.js`) |
| `npm run dev` | Start dev server with hot reload (`nodemon`) |

<!-- END AUTO-GENERATED -->

## Mobile

```bash
cd mobile
npm install
npx expo run:android   # real device or emulator
```

> Always use `run:android`, not `expo start`. The app uses native modules (Health Connect, SMS) that don't work in Expo Go.

<!-- AUTO-GENERATED: env vars from backend/.env.example -->
## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key — GPT-4o-mini powers all AI |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `GOOGLE_CLIENT_ID` | For Gmail/Calendar | Google OAuth2 client ID |
| `GOOGLE_CLIENT_SECRET` | For Gmail/Calendar | Google OAuth2 client secret |
| `GMAIL_REDIRECT_URI` | For Gmail | OAuth callback URL |
| `ZERODHA_API_KEY` | For Zerodha | Kite Connect API key |
| `ZERODHA_API_SECRET` | For Zerodha | Kite Connect API secret |
| `ANGEL_ONE_API_KEY` | For Angel One | SmartAPI key |
| `CASPARSER_API_KEY` | For MF | Use `sandbox-with-json-responses` for testing |
| `PORT` | No | Server port (default: 3000) |
| `LOG_LEVEL` | No | `debug`, `info`, `warn`, `error` (default: info) |
| `ALLOWED_ORIGINS` | No | Comma-separated allowed CORS origins (default: localhost) |
| `SCHEDULER_USER_IDS` | No | Comma-separated user IDs for background workflow sync |

<!-- END AUTO-GENERATED -->

## Architecture Rules

Before adding anything, read these — they prevent common mistakes:

- **No direct Supabase calls in routes** — use `repositories/index.js`
- **No broker logic in executor.js** — use `brokers/index.js` adapter
- **No workflow logic in routes** — use `workflows/` + `runWorkflow()`
- **No notifications from routes** — notifications are workflow output only
- **No LangChain** — OpenAI SDK directly
- **No hardcoded values** — use `lib/config.js`

## Adding a New Tool

1. Define schema in `backend/src/tools/index.js`
2. Add case to `backend/src/tools/executor.js`
3. Write backing function in the relevant route file
4. Wrap with `withCache(key, TTL.X, fn)` if it calls external APIs

## Adding a New Broker

1. Create `backend/src/routes/[broker].js` — OAuth/auth + `getHoldings()`
2. Add one adapter entry to `backend/src/brokers/index.js`
3. Register route in `server.js`

## PR Checklist

- [ ] No hardcoded secrets or API keys
- [ ] All user input validated at the route level
- [ ] New routes use `asyncHandler` from `middleware/errors.js`
- [ ] External API calls wrapped with `withCache()` or `retry()`
- [ ] Conventional commit message: `feat:`, `fix:`, `refactor:`, `docs:`
