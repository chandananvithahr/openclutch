'use strict';

// Onboarding — Cleo-style user profile collection
// POST /api/onboarding/profile  — create or update profile
// GET  /api/onboarding/profile/:userId — load profile
// GET  /api/onboarding/profile/:userId/completeness — get completeness score

const express        = require('express');
const { userProfiles } = require('../repositories');
const { asyncHandler, HTTPError } = require('../middleware/errors');

const router = express.Router();

// Fields required to reach 100% completeness
const PROFILE_FIELDS = [
  'name', 'age', 'city', 'occupation',
  'domain_priorities', 'savings_methods', 'tone',
];
const WORKING_FIELDS = ['annual_ctc', 'monthly_emi'];
const STUDENT_FIELDS = ['field_of_study'];

function calcCompleteness(profile) {
  let filled = 0;
  let total  = PROFILE_FIELDS.length;

  for (const f of PROFILE_FIELDS) {
    const val = profile[f];
    if (val !== null && val !== undefined && val !== '' &&
        !(Array.isArray(val) && val.length === 0)) filled++;
  }

  if (profile.occupation === 'working') {
    total += WORKING_FIELDS.length;
    for (const f of WORKING_FIELDS) {
      if (profile[f] !== null && profile[f] !== undefined) filled++;
    }
  } else if (profile.occupation === 'student') {
    total += STUDENT_FIELDS.length;
    for (const f of STUDENT_FIELDS) {
      if (profile[f] !== null && profile[f] !== undefined && profile[f] !== '') filled++;
    }
  }

  return Math.round((filled / total) * 100);
}

// POST /api/onboarding/profile
// Body: profile fields (partial or full — upsert pattern)
router.post('/profile', asyncHandler(async (req, res) => {
  const userId = req.userId;
  const fields = { ...req.body };
  delete fields.userId; // strip if sent — always use JWT userId

  if (!fields.name) throw new HTTPError(400, 'name is required');

  const completeness = calcCompleteness(fields);
  const isComplete   = completeness === 100;

  const profile = {
    user_id: userId,
    ...fields,
    profile_completeness: completeness,
    ...(isComplete && !fields.onboarding_completed_at
      ? { onboarding_completed_at: new Date().toISOString() }
      : {}),
  };

  const { data, error } = await userProfiles.upsert(profile);
  if (error) throw new HTTPError(500, `Failed to save profile: ${error.message}`);

  res.json({ success: true, profile: data, completeness });
}));

// GET /api/onboarding/profile/:userId
router.get('/profile', asyncHandler(async (req, res) => {
  const userId = req.userId;

  const { data, error } = await userProfiles.getByUserId(userId);

  // No profile yet — return empty (not an error)
  if (error?.code === 'PGRST116') {
    return res.json({ success: true, profile: null, completeness: 0 });
  }
  if (error) throw new HTTPError(500, `Failed to load profile: ${error.message}`);

  res.json({
    success: true,
    profile: data,
    completeness: data?.profile_completeness || 0,
  });
}));

// PATCH /api/onboarding/profile/:userId
// Update specific fields only (e.g., tone change, connect broker nudge dismissed)
router.patch('/profile', asyncHandler(async (req, res) => {
  const userId = req.userId;
  const fields = req.body;

  if (!Object.keys(fields).length) throw new HTTPError(400, 'No fields to update');

  // Recalculate completeness if meaningful fields changed
  const { data: existing } = await userProfiles.getByUserId(userId);
  const merged = { ...(existing || {}), ...fields };
  const completeness = calcCompleteness(merged);

  const { data, error } = await userProfiles.update(userId, {
    ...fields,
    profile_completeness: completeness,
  });
  if (error) throw new HTTPError(500, `Failed to update profile: ${error.message}`);

  res.json({ success: true, profile: data, completeness });
}));

module.exports = router;
