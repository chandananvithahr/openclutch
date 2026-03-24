import BACKEND_URL from './config';

export async function sendMessage(messages, tone = 'pro') {
  const res = await fetch(`${BACKEND_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, tone }),
  });
  if (!res.ok) throw new Error('Network response was not ok');
  return await res.json();
}

export async function getChatHistory(limit = 50) {
  const res = await fetch(`${BACKEND_URL}/api/chat/history?limit=${limit}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.messages || [];
}
