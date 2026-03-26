import AsyncStorage from '@react-native-async-storage/async-storage';
import BACKEND_URL, { AUTH_BOOTSTRAP_SECRET } from './config';

const TOKEN_KEY = 'clutch_jwt_token';

// --- Token management ---

export async function getToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(token) {
  return AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken() {
  return AsyncStorage.removeItem(TOKEN_KEY);
}

// Bootstrap: get a JWT from the backend for a userId
// In production this will be replaced by proper auth (Supabase Auth / OTP)
export async function bootstrapAuth(userId) {
  const res = await fetch(`${BACKEND_URL}/api/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, secret: AUTH_BOOTSTRAP_SECRET }),
  });
  if (!res.ok) throw new Error('Failed to get auth token');
  const { token } = await res.json();
  await setToken(token);
  return token;
}

// --- Authenticated fetch wrapper ---

async function authFetch(endpoint, options = {}) {
  const token = await getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${BACKEND_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // If 401, token is expired — try re-bootstrap once
  if (res.status === 401) {
    await clearToken();
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const userId = await AsyncStorage.getItem('clutch_user_id');
      if (userId) {
        await bootstrapAuth(userId);
        // Retry the original request with fresh token
        const newToken = await getToken();
        const retryHeaders = {
          ...options.headers,
          'Content-Type': 'application/json',
          ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}),
        };
        return fetch(`${BACKEND_URL}${endpoint}`, { ...options, headers: retryHeaders });
      }
    } catch {
      // Re-bootstrap failed — return original 401
    }
  }

  return res;
}

// --- API methods ---

export async function sendMessage(messages, tone = 'pro') {
  const res = await authFetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ messages, tone }),
  });
  if (!res.ok) throw new Error('Network response was not ok');
  return await res.json();
}

export async function getChatHistory(limit = 50) {
  const res = await authFetch(`/api/chat/history?limit=${limit}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.messages || [];
}

// Export for useChat and other modules that need authenticated requests
export { authFetch };
