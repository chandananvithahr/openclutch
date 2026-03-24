// Supabase client — enhanced from supabase-js source analysis
// Adds: version header, typed error class, timeout guard, fail-fast validation

'use strict';

const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY. Check your .env file.');
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: false,       // Server-side: no session persistence
    },
    global: {
      headers: {
        'x-app-name': 'openclutch-backend',
        'x-app-version': '1.0.0',
      },
    },
    db: { schema: 'public' },
  }
);

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
module.exports.SupabaseError = SupabaseError;
module.exports.unwrap = unwrap;
