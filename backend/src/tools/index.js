// Tool definitions for OpenAI tool calling
// Each tool = one capability Clutch has
// Add new tools here as we build more integrations

const tools = [
  {
    type: 'function',
    function: {
      name: 'get_portfolio',
      description: 'Get the user\'s stock portfolio — holdings, P&L, current values across all connected brokers',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_stock_price',
      description: 'Get current price and today\'s change for a specific stock',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'NSE stock symbol e.g. INFY, HDFCBANK, TCS',
          },
        },
        required: ['symbol'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_emails',
      description: 'Get recent unread emails from the user\'s Gmail inbox',
      parameters: {
        type: 'object',
        properties: {
          count: {
            type: 'number',
            description: 'Number of emails to fetch (default 10, max 50)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_emails',
      description: `Search through ALL emails in Gmail. ALWAYS use Gmail search operators for precise results:
- Sender: from:sbi OR from:sbi@sbi.co.in
- Date range: after:2026/03/18 before:2026/03/19  (for a specific day)
- Subject: subject:scholarship
- Combine: from:SBI after:2026/03/18 before:2026/03/19
- Keyword: SBI transaction alert
When user mentions a date, ALWAYS use after:/before: operators. When user says "March 18", use after:2026/03/18 before:2026/03/19. If first search returns nothing, try broader query (remove date or sender filter).`,
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Gmail search query using operators. Examples: "from:SBI after:2026/03/18 before:2026/03/19", "subject:scholarship from:purdue.edu", "SBI transaction after:2026/03/18"',
          },
          count: {
            type: 'number',
            description: 'Number of results to return (default 10, increase to 20 if user says email exists)',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_portfolio_chart',
      description: 'Get 1-year historical portfolio value chart data. Use when user asks for portfolio chart, performance over time, how portfolio has done over past year, portfolio health chart.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_financials',
      description: 'Get 3 years of annual financial data for any Indian stock — P&L, Balance Sheet, Cash Flow, key ratios like PE, ROE, Debt. Use for questions about revenue, profit, growth, debt levels.',
      parameters: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'NSE stock symbol e.g. INFY, TATAMOTORS, HDFCBANK, RELIANCE' },
        },
        required: ['symbol'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_quarterly_results',
      description: 'Get last 8 quarters of results for any Indian stock — revenue, net profit, EPS, margins quarter by quarter. Use for quarterly trend analysis.',
      parameters: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'NSE stock symbol e.g. INFY, TATAMOTORS, HDFCBANK' },
        },
        required: ['symbol'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_concalls',
      description: 'Get management concall transcripts and documents for any Indian stock. Use when user asks about what management said, concall notes, management commentary.',
      parameters: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'NSE stock symbol e.g. INFY, TATAMOTORS, HDFCBANK' },
        },
        required: ['symbol'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_monthly_spending',
      description: 'Get the user\'s monthly spending breakdown from bank SMS transactions. Shows total spend, category-wise breakdown (food, shopping, fuel, bills, subscriptions), and top merchants. Use when user asks about expenses, spending, budget, where money went, Swiggy/Zomato spend, etc.',
      parameters: {
        type: 'object',
        properties: {
          month: {
            type: 'string',
            description: 'Month in YYYY-MM format e.g. 2026-03. Defaults to current month if not specified.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_mutual_funds',
      description: 'Get the user\'s complete mutual fund portfolio across ALL AMCs (HDFC, SBI, Mirae, etc.) via their CAS PDF. Use when user asks about mutual funds, SIPs, NAV, XIRR, or total MF portfolio value. Requires user to have uploaded their CAMS or KFintech CAS PDF.',
      parameters: {
        type: 'object',
        properties: {
          password: {
            type: 'string',
            description: 'PDF password — usually the user\'s PAN number in UPPERCASE e.g. ABCDE1234F. Ask the user if not known.',
          },
        },
        required: [],
      },
    },
  },
  // --- Chitta Agent: Journaling ---
  {
    type: 'function',
    function: {
      name: 'save_journal_entry',
      description: 'Save a daily journal entry for the user. Detects mood, energy level, and tags automatically. Use when user shares how they feel, reflects on their day, vents, or says anything personal/emotional. Also use when user says "journal", "check-in", "diary", or describes their day.',
      parameters: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'The journal entry text — what the user said about their day, feelings, thoughts',
          },
        },
        required: ['content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_journal_insights',
      description: 'Get mood patterns, spending-mood correlations, energy trends, and journaling streaks. Use when user asks about their mood patterns, journaling history, how they\'ve been feeling, or wants to see journal insights.',
      parameters: {
        type: 'object',
        properties: {
          days: {
            type: 'number',
            description: 'Number of days to analyze (default 30)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_daily_checkin',
      description: 'Get the daily check-in prompt with yesterday\'s data summary. Use when user says "good morning", "daily check-in", "how was my day", or starts a new day conversation. Shows spending, streak, and prompts for journaling.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  // --- Artha Agent: Weekly Review + Salary Detection ---
  {
    type: 'function',
    function: {
      name: 'get_weekly_review',
      description: 'Get a weekly spending review with category breakdown, comparison to previous week, top merchants, and spending streaks. Use when user asks "how did I spend this week", "weekly review", "weekly summary", "spending report", or at the start of a new week.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'detect_salary',
      description: 'Detect salary credits from bank SMS/email transactions. Use when user asks "did my salary come", "when is payday", "salary status", or to give proactive budget advice after salary day.',
      parameters: {
        type: 'object',
        properties: {
          month: {
            type: 'string',
            description: 'Month to check in YYYY-MM format. Defaults to current month.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_net_worth',
      description: 'Calculate total net worth across all connected accounts — portfolio value + mutual funds + bank balance estimate (from salary - spending). Use when user asks "what is my net worth", "total wealth", "how much do I have", "financial summary".',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  // --- Karma Agent: Career ---
  {
    type: 'function',
    function: {
      name: 'get_career_advice',
      description: 'Get personalized career advice based on the user\'s resume/profile. Use when user asks about career path, job switching, skill gaps, career growth, pivots, or "what should I do with my career".',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The career question or topic' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_job_emails',
      description: 'Search Gmail for job-related emails — interview invites, offers, rejections, job alerts from Naukri/LinkedIn/Indeed. Use when user asks about job applications, interview emails, or job search status.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_interview_prep',
      description: 'Generate interview preparation — likely questions, sample answers, what to ask, salary estimates. Use when user says "I have an interview at [company]", "prep me for interview", or asks about interview questions.',
      parameters: {
        type: 'object',
        properties: {
          company: { type: 'string', description: 'Company name e.g. Infosys, TCS, Google' },
          role: { type: 'string', description: 'Job role e.g. Software Engineer, Product Manager' },
        },
        required: ['company', 'role'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_salary_negotiation',
      description: 'Get salary negotiation coaching — market rates, counter-offer scripts, benefits to negotiate. Use when user says "they offered me X", "how to negotiate salary", "is this offer fair".',
      parameters: {
        type: 'object',
        properties: {
          current_salary: { type: 'number', description: 'Current annual salary in INR e.g. 800000' },
          offered_salary: { type: 'number', description: 'Offered annual salary in INR e.g. 1200000' },
          role: { type: 'string', description: 'Job role being offered' },
        },
        required: ['offered_salary', 'role'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'track_job_application',
      description: 'Track a job application — save company, role, and status. Use when user says "I applied to [company]", "got rejected from [company]", "interview at [company]", or wants to track applications.',
      parameters: {
        type: 'object',
        properties: {
          company: { type: 'string', description: 'Company name' },
          role: { type: 'string', description: 'Job role applied for' },
          status: { type: 'string', description: 'Application status: applied, replied, interview, offer, rejected' },
        },
        required: ['company', 'role'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'score_job_fit',
      description: 'Score how well the user\'s resume fits a job description (1-10). Use when user pastes a job description and asks "is this a good fit?", "should I apply?", "how do I match?", "ATS keywords", or "gap analysis". Returns score, matching keywords, reasoning, and what\'s missing.',
      parameters: {
        type: 'object',
        properties: {
          job_description: {
            type: 'string',
            description: 'The full job description text to evaluate against the user\'s resume',
          },
        },
        required: ['job_description'],
      },
    },
  },
  // --- Kaal Agent: Time/Productivity ---
  {
    type: 'function',
    function: {
      name: 'get_today_schedule',
      description: 'Get today\'s calendar events, meeting count, total meeting hours, and free hours. Use when user asks "what\'s my schedule", "meetings today", "am I busy today", "what do I have today".',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_upcoming_events',
      description: 'Get upcoming calendar events for the next N days, grouped by day. Use when user asks "what\'s coming up", "this week\'s schedule", "any meetings this week", "next few days".',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'number', description: 'Number of days to look ahead (default 7)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_free_slots',
      description: 'Find free time slots today between meetings (9am-6pm, minimum 30-min blocks). Use when user asks "when am I free", "do I have time for", "can I fit a meeting", "free slots today".',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  // --- Arogya Agent: Health ---
  {
    type: 'function',
    function: {
      name: 'get_health_summary',
      description: 'Get health summary — steps, sleep, heart rate, calories, activity level over recent days. Use when user asks "how is my health", "steps today", "sleep data", "fitness summary", "am I active enough".',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'number', description: 'Number of days to summarize (default 7)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_health_spending_correlation',
      description: 'Find patterns between health data and spending habits — does bad sleep lead to more Swiggy orders? Do active days save money? Use when user asks "how does sleep affect spending", "health vs money", "do I spend more when tired", or for weekly/monthly reviews.',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'number', description: 'Number of days to analyze (default 30)' },
        },
        required: [],
      },
    },
  },
];

module.exports = tools;
