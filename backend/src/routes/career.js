// Karma Agent — Career Consultant
// Resume parsing, job tracking, interview prep, salary negotiation

const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const supabase = require('../lib/supabase');
const { chat } = require('../lib/ai');
const gmail = require('./gmail');

const upload = multer({ dest: 'uploads/' });

// POST /api/career/resume — upload and parse resume PDF
router.post('/resume', upload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No PDF file uploaded' });

  const { userId = 'default_user' } = req.body;

  try {
    // Read file as text (basic extraction — works for text-based PDFs)
    const fileBuffer = fs.readFileSync(req.file.path);
    const rawText = fileBuffer.toString('utf-8').replace(/[^\x20-\x7E\n\r]/g, ' ').replace(/\s+/g, ' ').trim();

    // AI-powered resume parsing
    const parsed = await parseResumeWithAI(rawText);

    // Save to DB
    const { error } = await supabase
      .from('career_profiles')
      .upsert({
        user_id: userId,
        full_name: parsed.full_name,
        role_title: parsed.role_title,
        experience_years: parsed.experience_years,
        skills: parsed.skills,
        education: parsed.education,
        work_history: parsed.work_history,
        raw_resume_text: rawText.slice(0, 5000),
        last_updated: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    // Clean up temp file
    fs.unlinkSync(req.file.path);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, profile: parsed });
  } catch (err) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: `Resume parse failed: ${err.message}` });
  }
});

// GET /api/career/profile
router.get('/profile', async (req, res) => {
  const { userId = 'default_user' } = req.query;
  const { data, error } = await supabase
    .from('career_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) return res.json({ profile: null });
  res.json({ profile: data });
});

// GET /api/career/applications
router.get('/applications', async (req, res) => {
  const { userId = 'default_user' } = req.query;
  const { data } = await supabase
    .from('job_applications')
    .select('*')
    .eq('user_id', userId)
    .order('applied_date', { ascending: false })
    .limit(50);

  res.json({ applications: data || [] });
});

// --- AI Resume Parser ---
async function parseResumeWithAI(rawText) {
  try {
    const response = await chat({
      messages: [
        {
          role: 'system',
          content: `You are a resume parser. Extract structured data from resume text.
Return ONLY valid JSON:
{
  "full_name": "string",
  "role_title": "string",
  "experience_years": number,
  "skills": ["skill1", "skill2"],
  "education": ["degree - institution - year"],
  "work_history": [{"company": "string", "role": "string", "duration": "string", "highlights": ["string"]}]
}
If data is unclear, make reasonable inferences. Never return null for required fields.`,
        },
        { role: 'user', content: `Parse this resume:\n${rawText.slice(0, 3000)}` },
      ],
      tools: [],
      tone: 'pro',
    });

    const text = response.content || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('Resume parse AI error:', err.message);
  }

  return {
    full_name: 'Unknown',
    role_title: 'Not detected',
    experience_years: 0,
    skills: [],
    education: [],
    work_history: [],
  };
}

// --- Exported functions for executor.js ---

async function getCareerAdvice(query, userId) {
  // Load user's profile
  const { data: profile } = await supabase
    .from('career_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!profile) {
    return {
      error: 'No resume uploaded yet',
      action: 'Ask the user to upload their resume PDF first. They can do this in the app settings.',
    };
  }

  return {
    profile_summary: {
      name: profile.full_name,
      role_title: profile.role_title,
      experience: `${profile.experience_years} years`,
      skills: profile.skills,
      education: profile.education,
    },
    work_history: profile.work_history,
    query: query,
    instruction: 'Use the profile data above to give personalized career advice for the user query. Be specific, actionable, and encouraging.',
  };
}

async function searchJobEmails(userId) {
  if (!gmail.isConnected()) {
    return { error: 'Gmail not connected. Connect Gmail to find job-related emails.' };
  }

  try {
    // Search for job-related emails
    const jobQueries = [
      'subject:(interview OR "job opportunity" OR "application" OR "shortlisted" OR "selected")',
      'from:(naukri.com OR linkedin.com OR indeed.com OR internshala.com OR instahyre.com)',
    ];

    const results = await gmail.searchEmails(jobQueries.join(' OR '), 20);
    if (!results?.emails?.length) {
      return { emails: [], message: 'No job-related emails found in your inbox.' };
    }

    const jobEmails = results.emails.map(e => ({
      from: e.from,
      subject: e.subject,
      date: e.date,
      preview: e.preview,
      type: detectJobEmailType(e.subject, e.from),
    }));

    // Stats
    const types = {};
    for (const e of jobEmails) {
      types[e.type] = (types[e.type] || 0) + 1;
    }

    return {
      total_job_emails: jobEmails.length,
      by_type: types,
      emails: jobEmails.slice(0, 10),
    };
  } catch (err) {
    return { error: `Failed to search job emails: ${err.message}` };
  }
}

function detectJobEmailType(subject, from) {
  const s = (subject || '').toLowerCase();
  const f = (from || '').toLowerCase();
  if (/interview|schedule|round/.test(s)) return 'interview';
  if (/offer|selected|congratul/.test(s)) return 'offer';
  if (/reject|unfortunately|regret/.test(s)) return 'rejection';
  if (/shortlist|next step/.test(s)) return 'shortlisted';
  if (/naukri|linkedin|indeed|internshala/.test(f)) return 'job_alert';
  return 'application';
}

async function getInterviewPrep(company, role, userId) {
  const { data: profile } = await supabase
    .from('career_profiles')
    .select('skills, experience_years, work_history')
    .eq('user_id', userId)
    .single();

  return {
    company,
    role,
    user_skills: profile?.skills || [],
    user_experience: profile?.experience_years || 0,
    instruction: `Generate interview prep for ${role} at ${company}. Include:
1. Top 10 likely questions (mix of behavioral + technical)
2. Sample answers tailored to the user's background
3. Questions the user should ask the interviewer
4. Red flags to watch for
5. Salary range estimate for this role in India`,
  };
}

async function getSalaryNegotiation(currentSalary, offeredSalary, role, userId) {
  return {
    current_salary: currentSalary,
    offered_salary: offeredSalary,
    role,
    instruction: `Help negotiate salary. Current: ₹${currentSalary}. Offered: ₹${offeredSalary} for ${role}.
Provide:
1. Market rate for this role in India (2025-2026)
2. Whether the offer is fair/low/good
3. Counter-offer script (exact words to say)
4. Benefits to negotiate beyond salary (WFH, joining bonus, stocks)
5. Walk-away number`,
  };
}

async function trackJobApplication(company, role, status, userId) {
  const { data, error } = await supabase
    .from('job_applications')
    .upsert({
      user_id: userId,
      company,
      role,
      status: status || 'applied',
      applied_date: new Date().toISOString().slice(0, 10),
    }, { onConflict: 'user_id,company,role' })
    .select()
    .single();

  if (error) return { error: error.message };

  // Get all apps for stats
  const { data: allApps } = await supabase
    .from('job_applications')
    .select('status')
    .eq('user_id', userId);

  const stats = {};
  for (const app of (allApps || [])) {
    stats[app.status] = (stats[app.status] || 0) + 1;
  }

  return {
    saved: true,
    application: { company, role, status },
    total_stats: stats,
    response_rate: stats.replied ? parseFloat((((stats.replied || 0) + (stats.interview || 0) + (stats.offer || 0)) / (allApps || []).length * 100).toFixed(1)) : 0,
  };
}

// --- Job Fit Scorer — ApplyPilot scorer.py pattern ---
// Structured prompt forces consistent output: SCORE / KEYWORDS / REASONING / GAP_ANALYSIS
// Regex parser extracts fields — never trust LLM to return JSON unprompted

// ApplyPilot scorer.py scoring criteria — ported to Indian job market context
const JOB_SCORE_PROMPT = `You are a job fit evaluator for the Indian job market. Compare a candidate's resume against a job description.

SCORING CRITERIA:
- 9-10: Perfect match. Candidate has direct experience in nearly all required skills and qualifications.
- 7-8: Strong match. Candidate has most required skills, minor gaps easily bridged.
- 5-6: Moderate match. Candidate has some relevant skills but missing key requirements.
- 3-4: Weak match. Significant skill gaps, would need substantial ramp-up.
- 1-2: Poor match. Completely different field or experience level.

IMPORTANT FACTORS (ApplyPilot weighting):
- Weight technical skills heavily (languages, frameworks, tools)
- Consider transferable experience (automation, scripting, API integrations)
- Factor in the candidate's project experience and personal projects
- Be realistic about experience level vs job requirements (years, seniority)
- For Indian market: consider tier-1/tier-2 college bias, notice period, CTC expectations

RESPOND IN EXACTLY THIS FORMAT (no other text):
SCORE: [1-10]
KEYWORDS: [comma-separated ATS keywords from job that match candidate]
REASONING: [2-3 sentences explaining the score]
GAP_ANALYSIS: [what candidate is missing to improve their score]`;

function parseScoreResponse(text) {
  const score = parseInt((text.match(/SCORE:\s*(\d+)/i) || [])[1] || '0');
  const keywords = (text.match(/KEYWORDS:\s*(.+)/i) || [])[1]?.trim() || '';
  const reasoning = (text.match(/REASONING:\s*(.+)/i) || [])[1]?.trim() || text;
  const gaps = (text.match(/GAP_ANALYSIS:\s*(.+)/i) || [])[1]?.trim() || '';
  return {
    score: Math.max(1, Math.min(10, score)),
    keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
    reasoning,
    gap_analysis: gaps,
  };
}

async function scoreJobFit(jobDescription, userId) {
  const { data: profile } = await supabase
    .from('career_profiles')
    .select('role_title, experience_years, skills, work_history, raw_resume_text')
    .eq('user_id', userId)
    .single();

  if (!profile) {
    return { error: 'No resume uploaded. Upload resume first.' };
  }

  // ApplyPilot pattern: prefer raw resume text for accuracy, fall back to structured summary
  const resumeText = profile.raw_resume_text
    ? profile.raw_resume_text.slice(0, 3000)
    : `Role: ${profile.role_title}\nExperience: ${profile.experience_years} years\nSkills: ${(profile.skills || []).join(', ')}\nWork History: ${(profile.work_history || []).map(w => `${w.role} at ${w.company}`).join('; ')}`;

  try {
    const response = await chat({
      messages: [
        { role: 'system', content: JOB_SCORE_PROMPT },
        { role: 'user', content: `RESUME:\n${resumeText}\n\nJOB DESCRIPTION:\n${jobDescription.slice(0, 2000)}` },
      ],
      tools: [],
      tone: 'pro',
    });

    return parseScoreResponse(response.content || '');
  } catch (err) {
    return { error: `Scoring failed: ${err.message}` };
  }
}

module.exports = router;
module.exports.getCareerAdvice = getCareerAdvice;
module.exports.searchJobEmails = searchJobEmails;
module.exports.getInterviewPrep = getInterviewPrep;
module.exports.getSalaryNegotiation = getSalaryNegotiation;
module.exports.scoreJobFit = scoreJobFit;
module.exports.trackJobApplication = trackJobApplication;
module.exports.trackJobApplication = trackJobApplication;
