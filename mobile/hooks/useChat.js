// useChat hook — SSE streaming version
// Backend: Crucix SSE pattern (text/event-stream, newline-delimited JSON)
// Frontend: myChat StreamProcessor pattern (chunk → delta → done events)
// Falls back to non-streaming /api/chat if stream fails

import { useState, useCallback } from 'react';
import BACKEND_URL from '../services/config';
import { getToken } from '../services/api';

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  content: "Hey! I'm **Clutch** — your personal AI assistant.\n\nI can help you with:\n- 📊 Portfolio & stocks\n- 💰 Spending & salary\n- 📧 Emails & career\n- 📝 Journaling & health\n\nTry: *\"How is my portfolio?\"*",
};

// Parse SSE line — Crucix codex.mjs LineDecoder pattern
function parseSseLine(line) {
  if (!line.startsWith('data: ')) return null;
  const payload = line.slice(6).trim();
  if (!payload) return null;
  try { return JSON.parse(payload); } catch { return null; }
}

export function useChat(tone) {
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [isTyping, setIsTyping] = useState(false);
  const [conversations, setConversations] = useState([]);

  const send = useCallback(async (text) => {
    if (!text.trim() || isTyping) return false;

    const userMsg = { id: Date.now().toString(), role: 'user', content: text.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsTyping(true);

    if (!conversations.length || conversations[0]?.title === 'Current chat') {
      setConversations([{ id: 'current', title: text.slice(0, 40) }]);
    }

    const apiMessages = updatedMessages
      .filter(m => m.id !== 'welcome')
      .map(({ role, content }) => ({ role, content }));

    // Add empty assistant bubble immediately — myChat addMessage pattern
    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', streaming: true }]);

    try {
      const token = await getToken();
      const authHeaders = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const response = await fetch(`${BACKEND_URL}/api/chat/stream`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ messages: apiMessages, tone }),
        // myChat reactNative textStreaming flag — enables ReadableStream on RN
        reactNative: { textStreaming: true },
      });

      if (!response.ok || !response.body) throw new Error('Stream unavailable');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let chartData = null;

      // myChat StreamProcessor loop
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const event = parseSseLine(line);
          if (!event) continue;

          if (event.type === 'delta') {
            // Append delta to assistant bubble — myChat updateMessage pattern
            setMessages(prev => prev.map(m =>
              m.id === assistantId
                ? { ...m, content: m.content + event.content }
                : m
            ));
          } else if (event.type === 'done') {
            chartData = event.chartData || null;
          } else if (event.type === 'error') {
            throw new Error(event.message || 'Stream error');
          }
        }
      }

      // Finalize message — remove streaming flag, attach chartData
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, streaming: false, chartData }
          : m
      ));

      return true;
    } catch (streamErr) {
      // Fallback to non-streaming /api/chat
      try {
        const fallbackToken = await getToken();
        const res = await fetch(`${BACKEND_URL}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(fallbackToken ? { Authorization: `Bearer ${fallbackToken}` } : {}),
          },
          body: JSON.stringify({ messages: apiMessages, tone }),
        });
        const data = await res.json();
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: data.reply, chartData: data.chartData || null, streaming: false }
            : m
        ));
        return true;
      } catch {
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: "Couldn't connect. Check your internet and try again.", streaming: false }
            : m
        ));
        return false;
      }
    } finally {
      setIsTyping(false);
    }
  }, [messages, isTyping, tone, conversations]);

  const reset = useCallback(() => {
    setMessages([WELCOME_MESSAGE]);
    setConversations([]);
  }, []);

  const loadHistory = useCallback((history) => {
    if (history.length === 0) return;
    const loaded = history.map((m, i) => ({
      id: `history_${i}`, role: m.role, content: m.content,
    }));
    setMessages(loaded);
    const firstUserMsg = loaded.find(m => m.role === 'user');
    setConversations([{
      id: 'current',
      title: firstUserMsg ? firstUserMsg.content.slice(0, 40) : 'Current chat',
    }]);
  }, []);

  return { messages, isTyping, conversations, send, reset, loadHistory };
}
