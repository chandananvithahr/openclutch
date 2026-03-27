import AsyncStorage from '@react-native-async-storage/async-storage';
import BACKEND_URL from './config';

const TOKEN_KEY   = 'clutch_jwt_token';
const USER_ID_KEY = 'clutch_user_id';
const USER_NAME_KEY = 'clutch_user_name';

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

export async function getStoredUserId() {
  return AsyncStorage.getItem(USER_ID_KEY);
}

export async function getStoredUserName() {
  return AsyncStorage.getItem(USER_NAME_KEY);
}

// --- Real auth: signup / login ---

// Returns { token, userId, name } on success. Throws with message on failure.
export async function signup(name, email, password) {
  const res = await fetch(`${BACKEND_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Signup failed');
  await setToken(data.token);
  await AsyncStorage.setItem(USER_ID_KEY, data.userId);
  await AsyncStorage.setItem(USER_NAME_KEY, name);
  return data;
}

// Returns { token, userId, name } on success. Throws with message on failure.
export async function login(email, password) {
  const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  await setToken(data.token);
  await AsyncStorage.setItem(USER_ID_KEY, data.userId);
  if (data.name) await AsyncStorage.setItem(USER_NAME_KEY, data.name);
  return data;
}

export async function logout() {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_ID_KEY, USER_NAME_KEY]);
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

  // 401 = token expired — clear it so App.js re-routes to Login on next render
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

// Export for useChat and other modules that need authenticated requests
export { authFetch };
