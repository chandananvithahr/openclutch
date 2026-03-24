// Repository layer — StockSense pattern (AccountRepo / HoldingRepo)
// All Supabase table access goes through here.
// Business logic (routes, executor, memory) never calls supabase directly — it calls repos.
//
// Benefits:
//   1. Single place to change if table names or schema change
//   2. Easy to mock in tests
//   3. Query defaults are consistent (ordering, limits)
//
// Each repo is a plain object with async methods.
// Errors from Supabase are returned as-is — callers decide how to handle them.

'use strict';

const supabase = require('../lib/supabase');
const config   = require('../lib/config');

// ─── Messages ────────────────────────────────────────────────────────────────

const messages = {
  // Save one user + one assistant message together (always a pair)
  async save(userId, userContent, assistantContent, tone) {
    const { error } = await supabase.from('messages').insert([
      { user_id: userId, role: 'user',      content: userContent,      tone },
      { user_id: userId, role: 'assistant', content: assistantContent, tone },
    ]);
    return { error };
  },

  // Load chat history for a user
  async loadHistory(userId, limit = config.HISTORY.DEFAULT_LIMIT) {
    const safeLimit = Math.min(limit, config.HISTORY.MAX_LIMIT);
    const { data, error } = await supabase
      .from('messages')
      .select('role, content, tone, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(safeLimit);
    return { data: data || [], error };
  },
};

// ─── User Facts (Tier 3 Memory) ───────────────────────────────────────────────

const userFacts = {
  // Upsert a single extracted fact
  async upsert(userId, fact) {
    const { error } = await supabase.from('user_facts').upsert(
      {
        user_id:    userId,
        category:   fact.category,
        entity:     fact.entity,
        key:        fact.key,
        value:      fact.value,
        context:    fact.context,
        source:     fact.source || 'conversation',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,key' }
    );
    return { error };
  },

  // Upsert multiple facts in sequence (small batches — facts are rare)
  async upsertMany(userId, facts) {
    const errors = [];
    for (const fact of facts) {
      const { error } = await this.upsert(userId, fact);
      if (error) errors.push(error);
    }
    return { errors };
  },

  // Load all facts for injection into system prompt
  async loadAll(userId) {
    const { data, error } = await supabase
      .from('user_facts')
      .select('category, entity, key, value, context, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(config.MEMORY.FACTS_HISTORY_LIMIT);
    return { data: data || [], error };
  },
};

// ─── SMS Transactions ─────────────────────────────────────────────────────────

const transactions = {
  // Upsert a batch of transactions (dedup by user_id + txn_hash)
  async upsertBatch(rows) {
    const { error } = await supabase
      .from('sms_transactions')
      .upsert(rows, { onConflict: 'user_id,txn_hash', ignoreDuplicates: true });
    return { error };
  },

  // Mark transactions as cross-verified (seen in both SMS + email)
  async markCrossVerified(userId, hashes, crossSource) {
    if (!hashes.length) return { error: null };
    const { error } = await supabase
      .from('sms_transactions')
      .update({ source: 'both' })
      .eq('user_id', userId)
      .eq('source', crossSource)
      .in('txn_hash', hashes);
    return { error };
  },

  // Query transactions for spending summaries
  async querySpending(userId, { type = 'debit', startDate, endDate } = {}) {
    let query = supabase
      .from('sms_transactions')
      .select('amount, merchant, category, bank, type, txn_date, source')
      .eq('user_id', userId)
      .eq('type', type);

    if (startDate) query = query.gte('txn_date', startDate);
    if (endDate)   query = query.lt('txn_date', endDate);

    const { data, error } = await query.order('txn_date', { ascending: false });
    return { data: data || [], error };
  },

  // Count transactions for /status endpoint
  async count(userId) {
    const { count, error } = await supabase
      .from('sms_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    return { count: count || 0, error };
  },

  // Recent N transactions (debugging endpoint)
  async loadRecent(userId, limit = 20) {
    const { data, error } = await supabase
      .from('sms_transactions')
      .select('amount, merchant, category, bank, txn_date, source')
      .eq('user_id', userId)
      .order('txn_date', { ascending: false })
      .limit(limit);
    return { data: data || [], error };
  },
};

// ─── Connected Apps (OAuth tokens) ───────────────────────────────────────────

const connectedApps = {
  // Load stored token for a broker/service
  async loadToken(userId, appName) {
    const { data, error } = await supabase
      .from('connected_apps')
      .select('access_token, refresh_token, updated_at')
      .eq('user_id', userId)
      .eq('app_name', appName)
      .single();
    return { data, error };
  },

  // Save/update token (upsert on user_id + app_name)
  async saveToken(userId, appName, tokens) {
    const { error } = await supabase
      .from('connected_apps')
      .upsert(
        {
          user_id:       userId,
          app_name:      appName,
          access_token:  tokens.accessToken,
          refresh_token: tokens.refreshToken || null,
          updated_at:    new Date().toISOString(),
        },
        { onConflict: 'user_id,app_name' }
      );
    return { error };
  },

  // Store arbitrary JSON metadata (e.g., portfolio snapshot, sync cursors)
  // Uses access_token column as a JSON string — keep payloads small (<4KB).
  async saveMeta(userId, key, value) {
    const { error } = await supabase
      .from('connected_apps')
      .upsert(
        {
          user_id:      userId,
          app_name:     key,
          access_token: JSON.stringify(value),
          updated_at:   new Date().toISOString(),
        },
        { onConflict: 'user_id,app_name' }
      );
    return { error };
  },

  async loadMeta(userId, key) {
    const { data, error } = await supabase
      .from('connected_apps')
      .select('access_token')
      .eq('user_id', userId)
      .eq('app_name', key)
      .single();
    if (error || !data?.access_token) return { data: null, error };
    try {
      return { data: JSON.parse(data.access_token), error: null };
    } catch {
      return { data: null, error: new Error('Failed to parse meta JSON') };
    }
  },

  // Remove a token (disconnect)
  async deleteToken(userId, appName) {
    const { error } = await supabase
      .from('connected_apps')
      .delete()
      .eq('user_id', userId)
      .eq('app_name', appName);
    return { error };
  },
};

// ─── Health Data ─────────────────────────────────────────────────────────────

const healthData = {
  // Upsert one day of health metrics (dedup by user_id + date)
  async upsert(row) {
    const { error } = await supabase
      .from('health_data')
      .upsert(row, { onConflict: 'user_id,date' });
    return { error };
  },

  // Load a date range for weekly review / trend analysis
  async queryRange(userId, startDate, endDate) {
    const { data, error } = await supabase
      .from('health_data')
      .select('date, steps, sleep_hours, heart_rate_avg, calories_burned, active_calories')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });
    return { data: data || [], error };
  },

  // Latest N days (for chat tool get_health_summary)
  async loadRecent(userId, days = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const { data, error } = await supabase
      .from('health_data')
      .select('date, steps, sleep_hours, heart_rate_avg, calories_burned, active_calories')
      .eq('user_id', userId)
      .gte('date', since.toISOString().slice(0, 10))
      .order('date', { ascending: false });
    return { data: data || [], error };
  },
};

module.exports = { messages, userFacts, transactions, connectedApps, healthData };
