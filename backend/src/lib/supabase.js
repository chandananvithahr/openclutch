// Supabase clients — enhanced from supabase-js source analysis
// Two clients:
//   supabase        — ANON key (default). RLS applies. Used for user-scoped queries.
//   supabaseAdmin   — SERVICE ROLE key. Bypasses RLS. Used ONLY for auth operations
//                     (signup, login) where there's no user JWT yet.
//
// NEVER expose supabaseAdmin to user-controlled input outside of auth routes.

'use strict';

const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY. Check your .env file.');
}

const clientOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,         // Server-side: no session persistence
  },
  global: {
    headers: {
      'x-app-name': 'openclutch-backend',
      'x-app-version': '1.0.0',
    },
  },
  db: { schema: 'public' },
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  clientOptions
);

// Service role client — bypasses RLS. Only use for auth operations with no user context.
// Requires SUPABASE_SERVICE_ROLE_KEY env var (from Supabase dashboard → Settings → API).
const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, clientOptions)
  : null;

// Typed Supabase error — mirrors supabase-js AuthError hierarchy
class SupabaseError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = 'SupabaseError';
    this.code = code;
    this.status = status || 500;
  }
}

// Unwrap { data, error } and throw typed error — eliminates repeated if(error) checks
function unwrap({ data, error }) {
  if (error) throw new SupabaseError(error.message, error.code, error.status);
  return data;
}

module.exports = supabase;
module.exports.supabaseAdmin = supabaseAdmin;
module.exports.SupabaseError = SupabaseError;
module.exports.unwrap = unwrap;
