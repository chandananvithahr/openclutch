const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const repos = require('../repositories');
const logger = require('../lib/logger');

const REDIRECT_URI = process.env.CALENDAR_REDIRECT_URI || 'http://127.0.0.1:3000/api/calendar/callback';

function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    REDIRECT_URI,
  );
}

// Load tokens from Supabase on startup
let calendarTokens = null;

async function loadTokensFromDB() {
  const { data } = await repos.connectedApps.loadToken('default_user', 'google_calendar');
  if (data?.access_token) {
    calendarTokens = JSON.parse(data.access_token);
    logger.info('Google Calendar tokens loaded from Supabase');
  }
}

loadTokensFromDB().catch(err => logger.error('Calendar token load failed', { err: err.message }));

// GET /api/calendar/login
router.get('/login', (req, res) => {
  const oauth2Client = createOAuthClient();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.readonly'],
    prompt: 'consent',
  });
  if (req.query.json === 'true' || req.headers.accept?.includes('application/json')) {
    return res.json({ loginUrl: url });
  }
  res.redirect(url);
});

// GET /api/calendar/callback
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing code');

  try {
    const oauth2Client = createOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    calendarTokens = tokens;

    await repos.connectedApps.saveToken('default_user', 'google_calendar', {
      accessToken: JSON.stringify(tokens),
    });

    res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:40px">
        <h2>Calendar Connected!</h2>
        <p>Clutch can now see your schedule.</p>
        <p>Close this tab and go back to the chat.</p>
        <script>setTimeout(() => window.close(), 3000)</script>
      </body></html>
    `);
  } catch (err) {
    logger.error('Calendar OAuth error:', err.message);
    res.status(500).send(`Auth failed: ${err.message}`);
  }
});

// GET /api/calendar/status
router.get('/status', (req, res) => {
  res.json({ connected: !!calendarTokens });
});

// Shared OAuth client with auto-refresh
function getAuthenticatedClient() {
  const oauth2Client = createOAuthClient();
  oauth2Client.setCredentials(calendarTokens);

  oauth2Client.on('tokens', async (tokens) => {
    calendarTokens = { ...calendarTokens, ...tokens };
    await repos.connectedApps.saveToken('default_user', 'google_calendar', {
      accessToken: JSON.stringify(calendarTokens),
    });
  });

  return oauth2Client;
}

// Get today's events
async function getTodaySchedule() {
  if (!calendarTokens) return null;

  const oauth2Client = getAuthenticatedClient();
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 20,
  });

  const events = (response.data.items || []).map(event => ({
    title: event.summary || '(No title)',
    start: event.start.dateTime || event.start.date,
    end: event.end.dateTime || event.end.date,
    location: event.location || null,
    is_all_day: !event.start.dateTime,
    status: event.status,
    meet_link: event.hangoutLink || null,
  }));

  const meetingCount = events.filter(e => !e.is_all_day).length;
  const totalMeetingMinutes = events
    .filter(e => !e.is_all_day)
    .reduce((sum, e) => {
      const start = new Date(e.start);
      const end = new Date(e.end);
      return sum + (end - start) / 60000;
    }, 0);

  return {
    date: startOfDay.toISOString().slice(0, 10),
    events,
    meeting_count: meetingCount,
    total_meeting_hours: parseFloat((totalMeetingMinutes / 60).toFixed(1)),
    free_hours: parseFloat((8 - totalMeetingMinutes / 60).toFixed(1)), // assumes 8hr workday
  };
}

// Get upcoming events (next N days)
async function getUpcomingEvents(days = 7) {
  if (!calendarTokens) return null;

  const oauth2Client = getAuthenticatedClient();
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const now = new Date();
  const future = new Date(now);
  future.setDate(future.getDate() + days);

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: now.toISOString(),
    timeMax: future.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 50,
  });

  const events = (response.data.items || []).map(event => ({
    title: event.summary || '(No title)',
    start: event.start.dateTime || event.start.date,
    end: event.end.dateTime || event.end.date,
    location: event.location || null,
    is_all_day: !event.start.dateTime,
    meet_link: event.hangoutLink || null,
  }));

  // Group by day
  const byDay = {};
  for (const event of events) {
    const day = new Date(event.start).toISOString().slice(0, 10);
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(event);
  }

  // Calculate busiest day
  const busiestDay = Object.entries(byDay)
    .sort((a, b) => b[1].length - a[1].length)[0];

  return {
    period: `${now.toISOString().slice(0, 10)} to ${future.toISOString().slice(0, 10)}`,
    total_events: events.length,
    events_by_day: byDay,
    busiest_day: busiestDay ? { date: busiestDay[0], event_count: busiestDay[1].length } : null,
  };
}

// Check free slots today (for "when am I free?" queries)
async function getFreeSlots() {
  if (!calendarTokens) return null;

  const schedule = await getTodaySchedule();
  if (!schedule) return null;

  const busySlots = schedule.events
    .filter(e => !e.is_all_day)
    .map(e => ({ start: new Date(e.start), end: new Date(e.end) }))
    .sort((a, b) => a.start - b.start);

  // Work hours: 9am to 6pm
  const now = new Date();
  const workStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0);
  const workEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0);

  const freeSlots = [];
  let cursor = workStart > now ? workStart : now;

  for (const slot of busySlots) {
    if (cursor < slot.start) {
      const gapMinutes = (slot.start - cursor) / 60000;
      if (gapMinutes >= 30) { // Only show slots >= 30 min
        freeSlots.push({
          start: cursor.toTimeString().slice(0, 5),
          end: slot.start.toTimeString().slice(0, 5),
          duration_minutes: Math.round(gapMinutes),
        });
      }
    }
    if (slot.end > cursor) cursor = slot.end;
  }

  // After last meeting to end of work day
  if (cursor < workEnd) {
    const gapMinutes = (workEnd - cursor) / 60000;
    if (gapMinutes >= 30) {
      freeSlots.push({
        start: cursor.toTimeString().slice(0, 5),
        end: workEnd.toTimeString().slice(0, 5),
        duration_minutes: Math.round(gapMinutes),
      });
    }
  }

  return {
    date: now.toISOString().slice(0, 10),
    free_slots: freeSlots,
    total_free_hours: parseFloat((freeSlots.reduce((s, f) => s + f.duration_minutes, 0) / 60).toFixed(1)),
    meeting_count: schedule.meeting_count,
  };
}

module.exports = router;
module.exports.getTodaySchedule = getTodaySchedule;
module.exports.getUpcomingEvents = getUpcomingEvents;
module.exports.getFreeSlots = getFreeSlots;
module.exports.isConnected = () => !!calendarTokens;
