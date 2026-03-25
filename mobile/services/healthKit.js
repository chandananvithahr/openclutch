// Arogya Agent — Apple HealthKit integration (iOS)
// react-native-health pattern: Initialize → RequestPermission → Query → Sync to backend
// Reads Steps, HeartRate, SleepAnalysis, ActiveEnergyBurned, BasalEnergyBurned
// Daily aggregation: one row per day per user
// Mirror of healthConnect.js — same API shape, same backend sync

import AppleHealthKit from 'react-native-health';
import { Platform } from 'react-native';
import BACKEND_URL from './config';

// HealthKit permissions
const HEALTHKIT_PERMISSIONS = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.StepCount,
      AppleHealthKit.Constants.Permissions.HeartRate,
      AppleHealthKit.Constants.Permissions.SleepAnalysis,
      AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
      AppleHealthKit.Constants.Permissions.BasalEnergyBurned,
    ],
  },
};

// Check if HealthKit is available (iOS only)
export function checkHealthKitAvailable() {
  if (Platform.OS !== 'ios') return false;
  return AppleHealthKit.isAvailable((err, available) => {
    if (err) return false;
    return available;
  });
}

// Initialize + request permissions — call once on app load
// Returns promise resolving to true/false
export function initHealthKit() {
  return new Promise((resolve) => {
    if (Platform.OS !== 'ios') {
      resolve(false);
      return;
    }

    AppleHealthKit.initHealthKit(HEALTHKIT_PERMISSIONS, (err) => {
      if (err) {
        console.error('[HealthKit] Init error:', err);
        resolve(false);
        return;
      }
      resolve(true);
    });
  });
}

// Promisify HealthKit callback-based API
function queryHealthKit(method, options) {
  return new Promise((resolve, reject) => {
    method(options, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
}

// Read all health data for a given date (YYYY-MM-DD)
// Returns same shape as healthConnect.js readDayHealth()
async function readDayHealth(dateStr) {
  const startDate = new Date(`${dateStr}T00:00:00`);
  const endDate = new Date(`${dateStr}T23:59:59`);

  const options = {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };

  const [steps, heartRate, sleep, activeEnergy, basalEnergy] = await Promise.allSettled([
    queryHealthKit(AppleHealthKit.getStepCount, options),
    queryHealthKit(AppleHealthKit.getHeartRateSamples, options),
    queryHealthKit(AppleHealthKit.getSleepSamples, options),
    queryHealthKit(AppleHealthKit.getActiveEnergyBurned, options),
    queryHealthKit(AppleHealthKit.getBasalEnergyBurned, options),
  ]);

  // Steps — HealthKit returns { value: N }
  const totalSteps = steps.status === 'fulfilled'
    ? Math.round(steps.value.value || 0)
    : null;

  // Heart rate — array of { value: bpm, startDate, endDate }
  let hrMin = null, hrMax = null, hrAvg = null;
  if (heartRate.status === 'fulfilled' && heartRate.value.length > 0) {
    const bpms = heartRate.value.map(s => s.value).filter(Boolean);
    if (bpms.length > 0) {
      hrMin = Math.min(...bpms);
      hrMax = Math.max(...bpms);
      hrAvg = Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length);
    }
  }

  // Sleep — filter for ASLEEP stages, sum duration
  let sleepHours = null;
  if (sleep.status === 'fulfilled' && sleep.value.length > 0) {
    const asleepSamples = sleep.value.filter(s =>
      s.value === 'ASLEEP' || s.value === 'INBED' || s.value === 'CORE' ||
      s.value === 'DEEP' || s.value === 'REM'
    );
    const totalMs = asleepSamples.reduce((sum, s) => {
      const start = new Date(s.startDate).getTime();
      const end = new Date(s.endDate).getTime();
      return sum + (end - start);
    }, 0);
    sleepHours = parseFloat((totalMs / 3600000).toFixed(1));
  }

  // Calories — active + basal
  const activeKcal = activeEnergy.status === 'fulfilled'
    ? activeEnergy.value.reduce((sum, s) => sum + (s.value || 0), 0)
    : 0;
  const basalKcal = basalEnergy.status === 'fulfilled'
    ? basalEnergy.value.reduce((sum, s) => sum + (s.value || 0), 0)
    : 0;
  const totalCalories = (activeKcal + basalKcal) > 0
    ? Math.round(activeKcal + basalKcal)
    : null;

  // Active minutes estimate (same rough calc as Android)
  const activeMinutes = activeKcal > 0 ? Math.round(activeKcal / 4) : null;

  return {
    entry_date: dateStr,
    steps: totalSteps || null,
    sleep_hours: sleepHours,
    heart_rate_avg: hrAvg,
    heart_rate_min: hrMin,
    heart_rate_max: hrMax,
    calories_burned: totalCalories,
    active_minutes: activeMinutes,
    source: 'apple_healthkit',
  };
}

// Sync last N days of health data to backend
// Same API as healthConnect.js syncHealthData()
export async function syncHealthData(userId = 'default_user', days = 7) {
  if (Platform.OS !== 'ios') {
    return { skipped: true, reason: 'HealthKit only available on iOS' };
  }

  const synced = [];
  const errors = [];

  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().slice(0, 10);

    try {
      const dayData = await readDayHealth(dateStr);

      // Skip days with no data
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

// Quick today snapshot (no backend call)
export async function getTodayHealthSnapshot() {
  if (Platform.OS !== 'ios') return null;

  try {
    const today = new Date().toISOString().slice(0, 10);
    return await readDayHealth(today);
  } catch {
    return null;
  }
}
