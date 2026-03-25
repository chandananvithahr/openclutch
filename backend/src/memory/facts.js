// Tier 3: Long-term vector memory
// Self-hosted mem0 equivalent — OpenAI embeddings + Supabase pgvector
// All data stays in ap-south-1 (Mumbai) — DPDP Act 2023 compliant.
//
// Flow:
//   extractAndStoreFacts → GPT extracts facts → embed → upsert into memories table
//   loadFacts            → embed query → cosine similarity search → top-5 memories
//
// Fallback: if memories table doesn't exist yet (SQL not run), falls back to user_facts table.

'use strict';

const OpenAI  = require('openai');
const repos   = require('../repositories');
const config  = require('../lib/config');
const logger  = require('../lib/logger');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const EMBED_MODEL          = config.EMBED_MODEL;
const SIMILARITY_THRESHOLD = config.SIMILARITY_THRESHOLD;
const TOP_K                = config.SIMILARITY_TOP_K;

// ─── Embed a string ──────────────────────────────────────────────────────────

async function embed(text) {
  const res = await openai.embeddings.create({ model: EMBED_MODEL, input: text });
  return res.data[0].embedding; // float[]
}

// ─── Extract facts from a conversation turn (same GPT logic as before) ───────

async function extractFacts(userMessage, aiReply) {
  const response = await openai.chat.completions.create({
    model: config.MODEL,
    messages: [
      {
        role: 'system',
        content: `Extract factual information about the user from this conversation turn.
Only extract concrete, verifiable facts — not guesses or opinions.
For each fact write a full context sentence capturing who, what, how much, which program, which year.

Examples:
- "User received $6,000 USD scholarship from Purdue University for Masters in Global Supply Chain Management"
- "User was rejected from MIT for Masters program application"
- "User's Zerodha portfolio is worth ₹2,34,500 as of the last fetch"
- "User's name is Chandan"

If no new concrete facts, return empty array.`,
      },
      {
        role: 'user',
        content: `User said: ${userMessage}\n\nAssistant replied: ${aiReply}`,
      },
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'store_facts',
          description: 'Store extracted facts about the user',
          parameters: {
            type: 'object',
            properties: {
              facts: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    category: {
                      type: 'string',
                      enum: ['education', 'finance', 'portfolio', 'email', 'personal', 'career', 'health'],
                    },
                    key:     { type: 'string', description: 'snake_case unique id e.g. purdue_scholarship' },
                    value:   { type: 'string', description: 'Core fact value' },
                    context: { type: 'string', description: 'Full context sentence' },
                  },
                  required: ['category', 'key', 'value', 'context'],
                },
              },
            },
            required: ['facts'],
          },
        },
      },
    ],
    tool_choice: { type: 'function', function: { name: 'store_facts' } },
  });

  const toolCall = response.choices[0].message.tool_calls?.[0];
  if (!toolCall) return [];

  const { facts } = JSON.parse(toolCall.function.arguments);
  return facts || [];
}

// ─── Check if memories table exists ──────────────────────────────────────────

async function memoriesTableExists() {
  return repos.memories.tableExists();
}

// ─── Store facts as vectors in memories table ─────────────────────────────────

async function storeInVectors(userId, facts) {
  for (const fact of facts) {
    const embedding = await embed(fact.context);
    const { error } = await repos.memories.upsert({
      user_id:   userId,
      content:   fact.context,
      embedding: JSON.stringify(embedding),
      metadata:  { category: fact.category, key: fact.key, value: fact.value },
      updated_at: new Date().toISOString(),
    });

    if (error) logger.warn('Failed to upsert memory vector', { key: fact.key, err: error.message });
  }
}

// ─── Public: extract + store ──────────────────────────────────────────────────

async function extractAndStoreFacts(userMessage, aiReply, userId) {
  try {
    const facts = await extractFacts(userMessage, aiReply);
    if (!facts.length) return;

    const useVectors = await memoriesTableExists();

    if (useVectors) {
      await storeInVectors(userId, facts);
    } else {
      // Fallback: store in user_facts table (existing schema)
      const { errors } = await repos.userFacts.upsertMany(userId, facts.map(f => ({
        ...f, entity: f.key,
      })));
      if (errors.length) logger.warn('Some facts failed (fallback)', { count: errors.length });
    }

    logger.info('Facts stored', { userId, count: facts.length, useVectors, keys: facts.map(f => f.key) });
  } catch (err) {
    logger.error('Fact extraction failed', { err: err.message });
  }
}

// ─── Public: load relevant memories for a query ───────────────────────────────

async function loadFacts(userId, queryText) {
  try {
    const useVectors = await memoriesTableExists();

    if (useVectors && queryText) {
      // Vector similarity search
      const queryEmbedding = await embed(queryText);
      const { data, error } = await repos.memories.search(
        queryEmbedding, userId, TOP_K, SIMILARITY_THRESHOLD
      );

      if (error) {
        logger.warn('Vector search failed, falling back', { err: error.message });
      } else if (data.length > 0) {
        return data.map(m => `• ${m.content}`).join('\n');
      }
    }

    // Fallback: load all from user_facts
    const { data, error } = await repos.userFacts.loadAll(userId);
    if (error || !data?.length) return null;

    const grouped = {};
    for (const f of data) {
      if (!grouped[f.category]) grouped[f.category] = [];
      grouped[f.category].push(f.context);
    }

    return Object.entries(grouped)
      .map(([cat, lines]) => `${cat.toUpperCase()}:\n${lines.map(l => `• ${l}`).join('\n')}`)
      .join('\n\n');
  } catch (err) {
    logger.error('loadFacts threw', { err: err.message });
    return null;
  }
}

module.exports = { extractAndStoreFacts, loadFacts };
