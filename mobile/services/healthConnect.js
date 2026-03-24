// Arogya Agent — Health Connect integration
// expo-health-connect pattern: Initialize → RequestPermission → ReadRecords → Sync to backend
// Reads Steps, HeartRate, SleepSession, TotalCaloriesBurned, ActiveCaloriesBurned
// Daily aggregation: one row per day per user

import {
  initialize,
  requestPermission,
  readRecords,
  getSdkStatus,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import BACKEND_URL from './config';

// Permissions needed for Arogya agent
const HEALTH_PERMISSIONS = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'HeartRate' },
  { accessType: 'read', recordType: 'SleepSession' },
  { accessType: 'read', recordType: 'TotalCaloriesBurned' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
];

// Check if Health Connect is available on this device (Android 9+ required)
export async function checkHealthConnectAvailable() {
  try {
    const status = await getSdkStatus();
    return status === SdkAvailabilityStatus.SDK_AVAILABLE;
  } catch {
    return false;
  }
}

// Initialize + request permissions — call once on app load or settings screen
// Returns true if permissions granted
export async function initHealthConnect() {
  try {
    const initialized = await initialize();
    if (!initialized) return false;

    const granted = await requestPermission(HEALTH_PERMISSIONS);
    return granted && granted.length > 0;
  } catch (err) {
    console.error('[HealthConnect] Init error:', err.message);
    return false;
  }
}

// Read all health data for a given date (YYYY-MM-DD)
// Returns aggregated day summary
async function readDayHealth(dateStr) {
  const startDate = new Date(`${dateStr}T00:00:00.000Z`);
  const endDate = new Date(`${dateStr}T23:59:59.999Z`);
  const timeRangeFilter = { operator: 'between', startTime: startDate.toISOString(), endTime: endDate.toISOString() };

  const [steps, heartRate, sleep, calories, activeCalories] = await Promise.allSettled([
    readRecords('Steps', { timeRangeFilter }),
    readRecords('HeartRate', { timeRangeFilter }),
    readRecords('SleepSession', { timeRangeFilter }),
    readRecords('TotalCaloriesBurned', { timeRangeFilter }),
    readRecords('ActiveCaloriesBurned', { timeRangeFilter }),
  ]);

  // Aggregate steps (sum all records)
  const totalSteps = steps.status === 'fulfilled'
    ? steps.value.records.reduce((sum, r) => sum + (r.count || 0), 0)
    : null;

  // Aggregate calories
  const totalCalories = calories.status === 'fulfilled'
    ? calories.value.records.reduce((sum, r) => sum + (r.energy?.inKilocalories || 0), 0)
    : null;

  const totalActiveCalories = activeCalories.status === 'fulfilled'
    ? activeCalories.value.records.reduce((sum, r) => sum + (r.energy?.inKilocalories || 0), 0)
    : null;

  // Heart rate stats (min/avg/max across all samples)
  let hrMin = null, hrMax = null, hrAvg = null;
  if (heartRate.status === 'fulfilled' && heartRate.value.records.length > 0) {
    const allSamples = heartRate.value.records.flatMap(r => r.samples || []);
    if (allSamples.length > 0) {
      const bpms = allSamples.map(s => s.beatsPerMinute).filter(Boolean);
      hrMin = Math.min(...bpms);
      hrMax = Math.max(...bpms);
      hrAvg = Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length);
    }
  }

  // Sleep: total hours from all sleep sessions
  let sleepHours = null;
  if (sleep.status === 'fulfilled' && sleep.value.records.length > 0) {
    const totalMs = sleep.value.records.reduce((sum, r) => {
      const start = new Date(r.startTime).getTime();
      const end = new Date(r.endTime).getTime();
      return sum + (end - start);
    }, 0);
    sleepHours = parseFloat((totalMs / 3600000).toFixed(1)); // ms → hours
  }

  return {
    entry_date: dateStr,
    steps: totalSteps || null,
    sleep_hours: sleepHours,
    heart_rate_avg: hrAvg,
    heart_rate_min: hrMin,
    heart_rate_max: hrMax,
    calories_burned: totalCalories ? Math.round(totalCalories) : null,
    active_minutes: totalActiveCalories ? Math.round(totalActiveCalories / 4) : null, // rough estimate
    source: 'health_connect',
  };
}

// Sync last N days of health data to backend
// Called: on app foreground, morning check-in, or manually from settings
export async function syncHealthData(userId = 'default_user', days = 7) {
  const available = await checkHealthConnectAvailable();
  if (!available) {
    return { skipped: true, reason: 'Health Connect not available on this device' };
  }

  const synced = [];
  const errors = [];

  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().slice(0, 10);

    try {
      const dayData = await readDayHealth(dateStr);

      // Skip days with no data at all
      const hasData = dayData.steps || dayData.sleep_hours || dayData.heart_rate_avg || dayData.calories_burned;
      if (!hasData) continue;

      const res = await fetch(`${BACKEND_URL}/api/health/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, data: dayData }),
      });

      if (res.ok) {
        synced.push(dateStr);
      } else {
        errors.push({ date: dateStr, error: `HTTP ${res.status}` });
      }
    } catch (err) {
      errors.push({ date: dateStr, error: err.message });
    }
  }

  return {
    success: true,
    days_synced: synced.length,
    synced_dates: synced,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// Quick check: get today's health snapshot (no backend call — reads directly from Health Connect)
// Use for morning check-in card in ChatScreen
export async function getTodayHealthSnapshot() {
  const available = await checkHealthConnectAvailable();
  if (!available) return null;

  try {
    const today = new Date().toISOString().slice(0, 10);
    return await readDayHealth(today);
  } catch {
    return null;
  }
}
