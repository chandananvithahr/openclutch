// Tier 1 + Tier 2: Working memory (sliding window) + Summarization
//
// Tier 1: Keep last KEEP_VERBATIM messages in full
// Tier 2: Summarize everything older into a single short summary

const OpenAI  = require('openai');
const config  = require('../lib/config');
const logger  = require('../lib/logger');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const { KEEP_VERBATIM, SUMMARIZE_AFTER, SUMMARY_MAX_TOKENS } = config.MEMORY;

// Returns a trimmed message array safe to send to OpenAI
async function applyMemoryWindow(messages) {
  // Filter to only user/assistant/tool messages (no system — that's added by ai.js)
  const history = messages.filter(m => ['user', 'assistant', 'tool'].includes(m.role));

  if (history.length <= SUMMARIZE_AFTER) {
    return history; // Short enough — send as-is
  }

  // Split: old messages to summarize, recent to keep verbatim
  const toSummarize = history.slice(0, history.length - KEEP_VERBATIM);
  const recent = history.slice(history.length - KEEP_VERBATIM);

  const summary = await summarize(toSummarize);

  return [
    {
      role: 'user',
      content: `[Earlier conversation summary]\n${summary}`,
    },
    {
      role: 'assistant',
      content: 'Got it, I have context from our earlier conversation.',
    },
    ...recent,
  ];
}

async function summarize(messages) {
  try {
    // Only include user/assistant text — skip tool call blobs
    const readable = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .filter(m => typeof m.content === 'string')
      .map(m => `${m.role === 'user' ? 'User' : 'Clutch'}: ${m.content}`)
      .join('\n');

    if (!readable.trim()) return 'Earlier conversation had tool data only.';

    const res = await openai.chat.completions.create({
      model: config.MODEL,
      max_tokens: SUMMARY_MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: `Summarize this conversation in 2-3 sentences. Preserve: names, amounts, decisions, key facts found. Be specific.\n\n${readable}`,
        },
      ],
    });

    return res.choices[0].message.content;
  } catch (err) {
    logger.warn('Summarization failed', { err: err.message });
    return 'Earlier conversation summarization failed.';
  }
}

module.exports = { applyMemoryWindow };
