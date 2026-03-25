// Arogya Agent — Unified Health Service
// Auto-selects Health Connect (Android) or Apple HealthKit (iOS)
// Single API for the rest of the app — no platform checks needed elsewhere

import { Platform } from 'react-native';

// Lazy imports to avoid loading wrong platform's native module
let healthModule = null;

function getHealthModule() {
  if (healthModule) return healthModule;

  if (Platform.OS === 'android') {
    healthModule = require('./healthConnect');
  } else if (Platform.OS === 'ios') {
    healthModule = require('./healthKit');
  } else {
    // Web or unsupported — return no-op stubs
    healthModule = {
      checkHealthConnectAvailable: () => false,
      checkHealthKitAvailable: () => false,
      initHealthConnect: async () => false,
      initHealthKit: async () => false,
      syncHealthData: async () => ({ skipped: true, reason: 'Health not available on this platform' }),
      getTodayHealthSnapshot: async () => null,
    };
  }

  return healthModule;
}

// Check if health tracking is available on this device
export async function isHealthAvailable() {
  const mod = getHealthModule();
  if (Platform.OS === 'android') {
    return await mod.checkHealthConnectAvailable();
  }
  if (Platform.OS === 'ios') {
    return mod.checkHealthKitAvailable();
  }
  return false;
}

// Initialize + request permissions
export async function initHealth() {
  const mod = getHealthModule();
  if (Platform.OS === 'android') {
    return await mod.initHealthConnect();
  }
  if (Platform.OS === 'ios') {
    return await mod.initHealthKit();
  }
  return false;
}

// Sync health data to backend
export async function syncHealthData(userId = 'default_user', days = 7) {
  const mod = getHealthModule();
  return await mod.syncHealthData(userId, days);
}

// Get today's snapshot (no backend call)
export async function getTodayHealthSnapshot() {
  const mod = getHealthModule();
  return await mod.getTodayHealthSnapshot();
}

// Get platform-specific health source name
export function getHealthSourceName() {
  if (Platform.OS === 'android') return 'Health Connect';
  if (Platform.OS === 'ios') return 'Apple Health';
  return 'Not available';
}
