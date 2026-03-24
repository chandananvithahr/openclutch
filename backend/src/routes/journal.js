// Chitta Agent — Daily Journaling
// Stores journal entries, detects mood, correlates with spending/health data

const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { chat } = require('../lib/ai');
const sms = require('./sms');

// POST /api/journal/entry — save or update today's journal
router.post('/entry', async (req, res) => {
  const { content, userId = 'default_user' } = req.body;

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ error: 'Journal content is required' });
  }

  try {
    // AI mood detection + tag extraction
    const analysis = await analyzeJournalEntry(content);

    // Get today's spending from SMS data
    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);
    const spending = await sms.getSpending(userId, month);
    const todaySpending = spending.total || 0;

    const entry = {
      user_id: userId,
      content: content.trim(),
      mood: analysis.mood,
      energy_level: analysis.energy_level,
      tags: analysis.tags,
      linked_spending: todaySpending,
      entry_date: today,
    };

    const { data, error } = await supabase
      .from('journal_entries')
      .upsert(entry, { onConflict: 'user_id,entry_date' })
      .select()
      .single();

    if (error) {
      console.error('Journal save error:', error.message);
      return res.status(500).json({ error: 'Failed to save journal entry' });
    }

    res.json({ success: true, entry: data });
  } catch (err) {
    console.error('Journal error:', err.message);
    res.status(500).json({ error: 'Something went wrong saving your journal' });
  }
});

// GET /api/journal/entries — get journal history
router.get('/entries', async (req, res) => {
  const { userId = 'default_user', limit = 30 } = req.query;

  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false })
    .limit(parseInt(limit));

  if (error) return res.status(500).json({ error: error.message });
  res.json({ entries: data || [] });
});

// GET /api/journal/insights — mood-money-health patterns
router.get('/insights', async (req, res) => {
  const { userId = 'default_user', days = 30 } = req.query;

  const since = new Date();
  since.setDate(since.getDate() - parseInt(days));

  const { data, error } = await supabase
    .from('journal_entries')
    .select('mood, energy_level, linked_spending, linked_sleep_hours, tags, entry_date')
    .eq('user_id', userId)
    .gte('entry_date', since.toISOString().slice(0, 10))
    .order('entry_date', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  const entries = data || [];
  if (entries.length === 0) {
    return res.json({ insights: null, message: 'No journal entries yet. Start journaling to see patterns!' });
  }

  res.json({ insights: buildInsights(entries), entry_count: entries.length });
});

// GET /api/journal/streak — current journaling streak
router.get('/streak', async (req, res) => {
  const { userId = 'default_user' } = req.query;

  const { data, error } = await supabase
    .from('journal_entries')
    .select('entry_date')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false })
    .limit(365);

  if (error) return res.status(500).json({ error: error.message });

  const dates = (data || []).map(d => d.entry_date);
  const streak = calculateStreak(dates);
  res.json(streak);
});

// --- AI mood detection ---
async function analyzeJournalEntry(content) {
  try {
    const response = await chat({
      messages: [
        {
          role: 'system',
          content: `You are a mood analyzer. Given a journal entry, extract:
1. mood: one of [happy, stressed, anxious, motivated, tired, neutral, sad, excited]
2. energy_level: 1 (very low) to 5 (very high)
3. tags: array of 1-5 relevant tags like ["work", "health", "money", "relationships", "fitness", "food", "travel", "career", "family", "self-care"]

Respond ONLY with valid JSON: {"mood": "...", "energy_level": N, "tags": ["..."]}`,
        },
        { role: 'user', content },
      ],
      tools: [],
      tone: 'pro',
    });

    const text = response.content || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    console.error('Mood analysis error:', err.message);
  }

  return { mood: 'neutral', energy_level: 3, tags: [] };
}

// --- Insights builder ---
function buildInsights(entries) {
  const moodCounts = {};
  let totalSpending = 0;
  let spendingDays = 0;
  const moodSpending = {};
  let totalEnergy = 0;
  let energyDays = 0;

  for (const e of entries) {
    // Mood frequency
    if (e.mood) {
      moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1;
    }

    // Energy average
    if (e.energy_level) {
      totalEnergy += e.energy_level;
      energyDays++;
    }

    // Spending by mood
    if (e.linked_spending > 0) {
      totalSpending += parseFloat(e.linked_spending);
      spendingDays++;
      if (e.mood) {
        if (!moodSpending[e.mood]) moodSpending[e.mood] = { total: 0, days: 0 };
        moodSpending[e.mood].total += parseFloat(e.linked_spending);
        moodSpending[e.mood].days++;
      }
    }
  }

  // Average spending per mood
  const avgSpendingByMood = {};
  for (const [mood, data] of Object.entries(moodSpending)) {
    avgSpendingByMood[mood] = parseFloat((data.total / data.days).toFixed(2));
  }

  // Find highest-spending mood
  const highSpendMood = Object.entries(avgSpendingByMood)
    .sort((a, b) => b[1] - a[1])[0];

  // Tag frequency
  const tagCounts = {};
  for (const e of entries) {
    if (e.tags) {
      for (const tag of e.tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }
  }

  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }));

  return {
    dominant_mood: Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral',
    mood_distribution: moodCounts,
    avg_energy: energyDays > 0 ? parseFloat((totalEnergy / energyDays).toFixed(1)) : null,
    avg_daily_spending: spendingDays > 0 ? parseFloat((totalSpending / spendingDays).toFixed(2)) : null,
    spending_by_mood: avgSpendingByMood,
    high_spend_mood: highSpendMood ? { mood: highSpendMood[0], avg_spend: highSpendMood[1] } : null,
    top_tags: topTags,
    total_entries: entries.length,
  };
}

// --- Streak calculator ---
function calculateStreak(dates) {
  if (!dates.length) return { current_streak: 0, longest_streak: 0, total_entries: 0 };

  const today = new Date().toISOString().slice(0, 10);
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 1;

  // Check if today or yesterday has an entry (streak is alive)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const streakAlive = dates[0] === today || dates[0] === yesterdayStr;

  for (let i = 0; i < dates.length - 1; i++) {
    const curr = new Date(dates[i]);
    const next = new Date(dates[i + 1]);
    const diffDays = (curr - next) / (1000 * 60 * 60 * 24);

    if (diffDays === 1) {
      tempStreak++;
    } else {
      if (i === 0 && streakAlive) currentStreak = tempStreak;
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }

  longestStreak = Math.max(longestStreak, tempStreak);
  if (currentStreak === 0 && streakAlive) currentStreak = tempStreak;

  return {
    current_streak: currentStreak,
    longest_streak: longestStreak,
    total_entries: dates.length,
    journaled_today: dates[0] === today,
  };
}

// --- Exported functions for executor.js ---
async function saveJournalEntry(content, userId) {
  const analysis = await analyzeJournalEntry(content);
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);

  let todaySpending = 0;
  try {
    const spending = await sms.getSpending(userId, month);
    todaySpending = spending.total || 0;
  } catch {}

  const entry = {
    user_id: userId,
    content: content.trim(),
    mood: analysis.mood,
    energy_level: analysis.energy_level,
    tags: analysis.tags,
    linked_spending: todaySpending,
    entry_date: today,
  };

  const { data, error } = await supabase
    .from('journal_entries')
    .upsert(entry, { onConflict: 'user_id,entry_date' })
    .select()
    .single();

  if (error) return { error: `Failed to save journal: ${error.message}` };

  return {
    saved: true,
    mood_detected: analysis.mood,
    energy_level: analysis.energy_level,
    tags: analysis.tags,
    streak_reminder: 'Journal saved! Keep the streak going.',
  };
}

async function getJournalInsights(userId, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - parseInt(days));

  const { data, error } = await supabase
    .from('journal_entries')
    .select('mood, energy_level, linked_spending, linked_sleep_hours, tags, entry_date, content')
    .eq('user_id', userId)
    .gte('entry_date', since.toISOString().slice(0, 10))
    .order('entry_date', { ascending: true });

  if (error) return { error: error.message };

  const entries = data || [];
  if (entries.length === 0) {
    return { message: 'No journal entries yet. Try saying "I want to journal" or "How was my day" to start!' };
  }

  const insights = buildInsights(entries);

  // Get streak
  const { data: streakData } = await supabase
    .from('journal_entries')
    .select('entry_date')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false })
    .limit(365);

  const streak = calculateStreak((streakData || []).map(d => d.entry_date));

  // Recent entries for context
  const recentEntries = entries.slice(-5).map(e => ({
    date: e.entry_date,
    mood: e.mood,
    energy: e.energy_level,
    spending: e.linked_spending,
    preview: e.content.slice(0, 100),
  }));

  return {
    ...insights,
    streak,
    recent_entries: recentEntries,
  };
}

async function getDailyCheckIn(userId) {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  const month = today.slice(0, 7);

  // Check if already journaled today
  const { data: todayEntry } = await supabase
    .from('journal_entries')
    .select('mood, energy_level')
    .eq('user_id', userId)
    .eq('entry_date', today)
    .single();

  // Yesterday's spending
  let yesterdaySpending = 0;
  try {
    const spending = await sms.getSpending(userId, month);
    yesterdaySpending = spending.total || 0;
  } catch {}

  // Streak info
  const { data: streakData } = await supabase
    .from('journal_entries')
    .select('entry_date')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false })
    .limit(365);

  const streak = calculateStreak((streakData || []).map(d => d.entry_date));

  return {
    already_journaled_today: !!todayEntry,
    today_mood: todayEntry?.mood || null,
    yesterday_spending: yesterdaySpending,
    current_streak: streak.current_streak,
    prompt: todayEntry
      ? `You already journaled today (mood: ${todayEntry.mood}). Want to add more thoughts?`
      : `Time for your daily check-in! Yesterday you spent ₹${yesterdaySpending.toLocaleString('en-IN')}. How are you feeling today?`,
  };
}

module.exports = router;
module.exports.saveJournalEntry = saveJournalEntry;
module.exports.getJournalInsights = getJournalInsights;
module.exports.getDailyCheckIn = getDailyCheckIn;
