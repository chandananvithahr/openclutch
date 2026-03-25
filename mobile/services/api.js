import AsyncStorage from '@react-native-async-storage/async-storage';
import BACKEND_URL from './config';

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
    body: JSON.stringify({ userId }),
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

  // If 401, token is expired — clear it
  if (res.status === 401) {
    await clearToken();
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
