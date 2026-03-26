'use strict';

// Centralized Zod schemas for all API routes.
// Every route that accepts user input MUST validate through these schemas.
// This is a 1000-user launch requirement — garbage data will break everything.

const { z } = require('zod');

// ─── Auth ───────────────────────────────────────────────────────────────────

const signupSchema = z.object({
  email: z.string().email('Invalid email address').max(255).trim().toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  name: z.string().min(1, 'Name is required').max(100).trim(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address').max(255).trim().toLowerCase(),
  password: z.string().min(1, 'Password is required').max(128),
});

// ─── Chat ───────────────────────────────────────────────────────────────────

const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().min(1).max(10_000),
  })).min(1).max(100),
  tone: z.enum(['bhai', 'pro', 'mentor']).default('pro'),
});

// ─── SMS Transactions ───────────────────────────────────────────────────────

const smsTransactionSchema = z.object({
  transactions: z.array(z.object({
    amount: z.number().positive().max(10_000_000),
    merchant: z.string().max(200).trim(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
    type: z.enum(['debit', 'credit']),
    source: z.enum(['sms', 'email', 'both']).default('sms'),
    bank: z.string().max(100).trim().optional(),
    category: z.string().max(50).trim().optional(),
  })).min(1).max(500),
});

// ─── Health Sync ────────────────────────────────────────────────────────────

const healthSyncSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  steps: z.number().int().min(0).max(200_000).optional(),
  sleep_hours: z.number().min(0).max(24).optional(),
  heart_rate_avg: z.number().int().min(20).max(250).optional(),
  heart_rate_min: z.number().int().min(20).max(250).optional(),
  heart_rate_max: z.number().int().min(20).max(250).optional(),
  calories_burned: z.number().min(0).max(20_000).optional(),
  active_minutes: z.number().int().min(0).max(1440).optional(),
  source: z.string().max(50).trim().optional(),
});

// ─── Journal Entry ──────────────────────────────────────────────────────────

const journalEntrySchema = z.object({
  content: z.string().min(1).max(10_000).trim(),
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  mood: z.enum(['great', 'good', 'okay', 'bad', 'terrible']).optional(),
  energy_level: z.number().int().min(1).max(10).optional(),
  tags: z.array(z.string().max(50).trim()).max(20).optional(),
});

// ─── Onboarding Profile ─────────────────────────────────────────────────────

const onboardingProfileSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  age: z.number().int().min(13).max(120).optional(),
  city: z.string().max(100).trim().optional(),
  mobile: z.string().max(15).trim().optional(),
  email: z.string().email().max(255).trim().toLowerCase().optional(),
  occupation: z.enum(['student', 'working']).optional(),
  college: z.string().max(200).trim().optional(),
  field_of_study: z.string().max(200).trim().optional(),
  study_year: z.number().int().min(1).max(8).optional(),
  job_feature_enabled: z.boolean().optional(),
  annual_ctc: z.number().min(0).max(100_000_000).optional(),
  monthly_emi: z.number().min(0).max(10_000_000).optional(),
  company: z.string().max(200).trim().optional(),
  role: z.string().max(200).trim().optional(),
  fitness_active: z.boolean().optional(),
  has_fitness_tracker: z.boolean().optional(),
  tracker_type: z.string().max(50).trim().optional(),
  savings_methods: z.array(z.enum(['mf', 'stocks', 'gold', 'fd', 'crypto', 'ppf', 'nps'])).optional(),
  owns_car: z.boolean().optional(),
  owns_bike: z.boolean().optional(),
  owns_house: z.boolean().optional(),
  domain_priorities: z.array(z.enum(['money', 'career', 'health', 'mind', 'wealth', 'time'])).optional(),
  height_cm: z.number().min(50).max(300).optional(),
  weight_kg: z.number().min(10).max(500).optional(),
});

// ─── Career ─────────────────────────────────────────────────────────────────

const resumeTextSchema = z.object({
  text: z.string().min(10).max(5000).trim(),
});

const jobFitSchema = z.object({
  job_description: z.string().min(10).max(2000).trim(),
});

const jobApplicationSchema = z.object({
  company: z.string().min(1).max(200).trim(),
  role: z.string().min(1).max(200).trim(),
  status: z.enum(['applied', 'interviewing', 'offered', 'rejected', 'accepted', 'withdrawn']).optional(),
  applied_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(2000).trim().optional(),
  salary_offered: z.number().min(0).max(100_000_000).optional(),
  source: z.string().max(100).trim().optional(),
});

// ─── File Upload ────────────────────────────────────────────────────────────

const fileAnalyzeQuerySchema = z.object({
  question: z.string().max(500).trim().optional(),
});

// ─── Workflow Trigger ───────────────────────────────────────────────────────

const workflowTriggerSchema = z.object({
  name: z.string().min(1).max(50).trim(),
});

// ─── Validate helper — returns { data, error } ─────────────────────────────

function validate(schema, body) {
  const result = schema.safeParse(body);
  if (result.success) {
    return { data: result.data, error: null };
  }
  const messages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
  return { data: null, error: messages.join('; ') };
}

// ─── Express middleware factory ──────────────────────────────────────────────

function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (result.success) {
      req.body = result.data; // Replace with cleaned/coerced data
      return next();
    }
    const messages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
    return res.status(400).json({ error: messages.join('; ') });
  };
}

module.exports = {
  // Schemas
  signupSchema,
  loginSchema,
  chatSchema,
  smsTransactionSchema,
  healthSyncSchema,
  journalEntrySchema,
  onboardingProfileSchema,
  resumeTextSchema,
  jobFitSchema,
  jobApplicationSchema,
  fileAnalyzeQuerySchema,
  workflowTriggerSchema,
  // Helpers
  validate,
  validateBody,
};
