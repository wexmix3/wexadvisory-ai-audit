export interface IndustryBenchmark {
  code: string;
  name: string;
  avgAiReadiness: number;
  avgAutomationOpportunity: number;
  avgDataVisibility: number;
  avgRevenueAcceleration: number;
  commonRoles: { title: string; avgHourlyRate: number; pctOfWorkforce: number }[];
  departmentWorkflows: Record<string, { name: string; hoursPerWeekPerFte: number; automationCeilingPct: number }[]>;
  commonTechStack: string[];
  painPoints: string[];
}

const BENCHMARKS: Record<string, IndustryBenchmark> = {
  'professional-services': {
    code: 'professional-services',
    name: 'Professional Services',
    avgAiReadiness: 42,
    avgAutomationOpportunity: 61,
    avgDataVisibility: 38,
    avgRevenueAcceleration: 52,
    commonRoles: [
      { title: 'Consultant / Analyst', avgHourlyRate: 55, pctOfWorkforce: 40 },
      { title: 'Project Manager', avgHourlyRate: 48, pctOfWorkforce: 20 },
      { title: 'Admin / Operations', avgHourlyRate: 28, pctOfWorkforce: 15 },
      { title: 'Business Development', avgHourlyRate: 52, pctOfWorkforce: 15 },
    ],
    departmentWorkflows: {
      Sales: [
        { name: 'Lead qualification and outreach', hoursPerWeekPerFte: 8, automationCeilingPct: 60 },
        { name: 'Proposal creation', hoursPerWeekPerFte: 5, automationCeilingPct: 50 },
        { name: 'CRM data entry', hoursPerWeekPerFte: 3, automationCeilingPct: 85 },
        { name: 'Follow-up email sequences', hoursPerWeekPerFte: 4, automationCeilingPct: 80 },
      ],
      Operations: [
        { name: 'Client reporting and status updates', hoursPerWeekPerFte: 6, automationCeilingPct: 65 },
        { name: 'Meeting notes and action items', hoursPerWeekPerFte: 3, automationCeilingPct: 75 },
        { name: 'Project tracking and updates', hoursPerWeekPerFte: 4, automationCeilingPct: 55 },
      ],
      Finance: [
        { name: 'Invoice creation and sending', hoursPerWeekPerFte: 3, automationCeilingPct: 80 },
        { name: 'Payment follow-up', hoursPerWeekPerFte: 2, automationCeilingPct: 85 },
        { name: 'Expense tracking', hoursPerWeekPerFte: 2, automationCeilingPct: 70 },
        { name: 'Financial reporting', hoursPerWeekPerFte: 4, automationCeilingPct: 60 },
      ],
    },
    commonTechStack: ['email', 'excel', 'word', 'slack'],
    painPoints: ['Manual reporting', 'Proposal generation time', 'Lead follow-up inconsistency'],
  },

  'saas-tech': {
    code: 'saas-tech',
    name: 'SaaS / Technology',
    avgAiReadiness: 68,
    avgAutomationOpportunity: 55,
    avgDataVisibility: 65,
    avgRevenueAcceleration: 72,
    commonRoles: [
      { title: 'Software Engineer', avgHourlyRate: 75, pctOfWorkforce: 35 },
      { title: 'Sales / Account Executive', avgHourlyRate: 55, pctOfWorkforce: 20 },
      { title: 'Customer Success', avgHourlyRate: 42, pctOfWorkforce: 15 },
      { title: 'Marketing', avgHourlyRate: 48, pctOfWorkforce: 15 },
    ],
    departmentWorkflows: {
      Sales: [
        { name: 'Demo scheduling and follow-up', hoursPerWeekPerFte: 6, automationCeilingPct: 70 },
        { name: 'Trial-to-paid conversion emails', hoursPerWeekPerFte: 4, automationCeilingPct: 85 },
        { name: 'Prospect research', hoursPerWeekPerFte: 5, automationCeilingPct: 65 },
      ],
      'Customer Success': [
        { name: 'Onboarding check-ins', hoursPerWeekPerFte: 6, automationCeilingPct: 60 },
        { name: 'Health score monitoring', hoursPerWeekPerFte: 4, automationCeilingPct: 80 },
        { name: 'Renewal reminders', hoursPerWeekPerFte: 2, automationCeilingPct: 90 },
      ],
      Support: [
        { name: 'Tier-1 support ticket triage', hoursPerWeekPerFte: 10, automationCeilingPct: 65 },
        { name: 'Knowledge base updates', hoursPerWeekPerFte: 3, automationCeilingPct: 50 },
      ],
    },
    commonTechStack: ['slack', 'jira', 'hubspot', 'salesforce', 'intercom', 'stripe'],
    painPoints: ['Churn detection', 'Sales cycle length', 'Support ticket volume'],
  },

  'real-estate': {
    code: 'real-estate',
    name: 'Real Estate',
    avgAiReadiness: 35,
    avgAutomationOpportunity: 68,
    avgDataVisibility: 30,
    avgRevenueAcceleration: 60,
    commonRoles: [
      { title: 'Real Estate Agent / Broker', avgHourlyRate: 50, pctOfWorkforce: 45 },
      { title: 'Property Manager', avgHourlyRate: 35, pctOfWorkforce: 20 },
      { title: 'Admin / Coordinator', avgHourlyRate: 25, pctOfWorkforce: 20 },
      { title: 'Marketing', avgHourlyRate: 38, pctOfWorkforce: 10 },
    ],
    departmentWorkflows: {
      Sales: [
        { name: 'Lead follow-up and nurturing', hoursPerWeekPerFte: 10, automationCeilingPct: 70 },
        { name: 'Listing descriptions and marketing', hoursPerWeekPerFte: 5, automationCeilingPct: 75 },
        { name: 'CMA and property reports', hoursPerWeekPerFte: 4, automationCeilingPct: 65 },
      ],
      Operations: [
        { name: 'Showing scheduling', hoursPerWeekPerFte: 6, automationCeilingPct: 80 },
        { name: 'Document collection and review', hoursPerWeekPerFte: 5, automationCeilingPct: 60 },
        { name: 'Tenant communications', hoursPerWeekPerFte: 4, automationCeilingPct: 75 },
      ],
    },
    commonTechStack: ['mls', 'email', 'excel', 'docusign'],
    painPoints: ['Lead response time', 'Manual listing management', 'Document coordination'],
  },

  'ecommerce': {
    code: 'ecommerce',
    name: 'E-Commerce / Retail',
    avgAiReadiness: 50,
    avgAutomationOpportunity: 72,
    avgDataVisibility: 55,
    avgRevenueAcceleration: 68,
    commonRoles: [
      { title: 'Customer Service Rep', avgHourlyRate: 22, pctOfWorkforce: 30 },
      { title: 'Marketing / Email', avgHourlyRate: 38, pctOfWorkforce: 20 },
      { title: 'Operations / Fulfillment', avgHourlyRate: 20, pctOfWorkforce: 25 },
      { title: 'Merchandising / Buying', avgHourlyRate: 35, pctOfWorkforce: 15 },
    ],
    departmentWorkflows: {
      'Customer Service': [
        { name: 'Order status inquiries', hoursPerWeekPerFte: 15, automationCeilingPct: 80 },
        { name: 'Returns and refund processing', hoursPerWeekPerFte: 8, automationCeilingPct: 65 },
        { name: 'FAQ responses', hoursPerWeekPerFte: 6, automationCeilingPct: 85 },
      ],
      Marketing: [
        { name: 'Email campaign creation', hoursPerWeekPerFte: 6, automationCeilingPct: 60 },
        { name: 'Product description writing', hoursPerWeekPerFte: 8, automationCeilingPct: 80 },
        { name: 'Ad copy creation', hoursPerWeekPerFte: 4, automationCeilingPct: 70 },
      ],
      Operations: [
        { name: 'Inventory reconciliation', hoursPerWeekPerFte: 5, automationCeilingPct: 75 },
        { name: 'Order processing', hoursPerWeekPerFte: 10, automationCeilingPct: 70 },
      ],
    },
    commonTechStack: ['shopify', 'klaviyo', 'stripe', 'google analytics'],
    painPoints: ['CS ticket volume', 'Cart abandonment', 'Inventory accuracy'],
  },

  'healthcare': {
    code: 'healthcare',
    name: 'Healthcare / Medical',
    avgAiReadiness: 32,
    avgAutomationOpportunity: 65,
    avgDataVisibility: 28,
    avgRevenueAcceleration: 45,
    commonRoles: [
      { title: 'Clinical Staff (RN, MA, etc.)', avgHourlyRate: 42, pctOfWorkforce: 40 },
      { title: 'Front Office / Admin', avgHourlyRate: 22, pctOfWorkforce: 25 },
      { title: 'Billing / Coding', avgHourlyRate: 28, pctOfWorkforce: 15 },
    ],
    departmentWorkflows: {
      Administration: [
        { name: 'Patient scheduling and reminders', hoursPerWeekPerFte: 10, automationCeilingPct: 80 },
        { name: 'Insurance verification', hoursPerWeekPerFte: 8, automationCeilingPct: 65 },
        { name: 'Patient intake forms', hoursPerWeekPerFte: 5, automationCeilingPct: 75 },
      ],
      Billing: [
        { name: 'Claims submission follow-up', hoursPerWeekPerFte: 8, automationCeilingPct: 60 },
        { name: 'Patient billing reminders', hoursPerWeekPerFte: 4, automationCeilingPct: 85 },
        { name: 'EOB reconciliation', hoursPerWeekPerFte: 6, automationCeilingPct: 55 },
      ],
    },
    commonTechStack: ['ehr', 'email', 'phone', 'fax'],
    painPoints: ['Patient no-shows', 'Prior auth delays', 'Billing errors'],
  },

  'marketing-agency': {
    code: 'marketing-agency',
    name: 'Marketing / Creative Agency',
    avgAiReadiness: 55,
    avgAutomationOpportunity: 63,
    avgDataVisibility: 48,
    avgRevenueAcceleration: 58,
    commonRoles: [
      { title: 'Account Manager', avgHourlyRate: 42, pctOfWorkforce: 25 },
      { title: 'Copywriter / Designer', avgHourlyRate: 38, pctOfWorkforce: 30 },
      { title: 'Media Buyer / Analyst', avgHourlyRate: 45, pctOfWorkforce: 20 },
      { title: 'Project Manager', avgHourlyRate: 40, pctOfWorkforce: 15 },
    ],
    departmentWorkflows: {
      'Client Management': [
        { name: 'Client reporting (weekly/monthly)', hoursPerWeekPerFte: 8, automationCeilingPct: 70 },
        { name: 'Status updates and communications', hoursPerWeekPerFte: 5, automationCeilingPct: 60 },
        { name: 'Meeting notes and recaps', hoursPerWeekPerFte: 3, automationCeilingPct: 80 },
      ],
      Production: [
        { name: 'Ad copy and creative briefs', hoursPerWeekPerFte: 10, automationCeilingPct: 55 },
        { name: 'Social media scheduling', hoursPerWeekPerFte: 4, automationCeilingPct: 85 },
        { name: 'Performance report compilation', hoursPerWeekPerFte: 6, automationCeilingPct: 75 },
      ],
    },
    commonTechStack: ['google ads', 'facebook ads', 'asana', 'slack', 'hubspot'],
    painPoints: ['Reporting time', 'Content production scale', 'Client communication volume'],
  },

  'legal': {
    code: 'legal',
    name: 'Legal Services',
    avgAiReadiness: 28,
    avgAutomationOpportunity: 60,
    avgDataVisibility: 25,
    avgRevenueAcceleration: 42,
    commonRoles: [
      { title: 'Attorney / Partner', avgHourlyRate: 120, pctOfWorkforce: 40 },
      { title: 'Paralegal', avgHourlyRate: 38, pctOfWorkforce: 25 },
      { title: 'Legal Admin', avgHourlyRate: 25, pctOfWorkforce: 20 },
    ],
    departmentWorkflows: {
      Operations: [
        { name: 'Document review and summarization', hoursPerWeekPerFte: 12, automationCeilingPct: 55 },
        { name: 'Contract drafting (standard templates)', hoursPerWeekPerFte: 8, automationCeilingPct: 60 },
        { name: 'Client intake and conflict checks', hoursPerWeekPerFte: 4, automationCeilingPct: 70 },
        { name: 'Billing and time entry', hoursPerWeekPerFte: 4, automationCeilingPct: 65 },
      ],
    },
    commonTechStack: ['clio', 'email', 'word', 'excel'],
    painPoints: ['Document review time', 'Billing accuracy', 'Client communication'],
  },

  'finance-accounting': {
    code: 'finance-accounting',
    name: 'Finance / Accounting',
    avgAiReadiness: 40,
    avgAutomationOpportunity: 70,
    avgDataVisibility: 52,
    avgRevenueAcceleration: 48,
    commonRoles: [
      { title: 'Accountant / CPA', avgHourlyRate: 52, pctOfWorkforce: 40 },
      { title: 'Bookkeeper', avgHourlyRate: 30, pctOfWorkforce: 25 },
      { title: 'Tax Preparer', avgHourlyRate: 42, pctOfWorkforce: 20 },
    ],
    departmentWorkflows: {
      Accounting: [
        { name: 'Bank reconciliation', hoursPerWeekPerFte: 5, automationCeilingPct: 80 },
        { name: 'Accounts payable processing', hoursPerWeekPerFte: 8, automationCeilingPct: 75 },
        { name: 'Financial statement preparation', hoursPerWeekPerFte: 6, automationCeilingPct: 60 },
        { name: 'Document collection from clients', hoursPerWeekPerFte: 5, automationCeilingPct: 70 },
      ],
    },
    commonTechStack: ['quickbooks', 'xero', 'excel', 'email'],
    painPoints: ['Document collection', 'Manual data entry', 'Reconciliation time'],
  },

  'construction': {
    code: 'construction',
    name: 'Construction / Contracting',
    avgAiReadiness: 22,
    avgAutomationOpportunity: 64,
    avgDataVisibility: 20,
    avgRevenueAcceleration: 45,
    commonRoles: [
      { title: 'Project Manager', avgHourlyRate: 45, pctOfWorkforce: 20 },
      { title: 'Estimator', avgHourlyRate: 42, pctOfWorkforce: 15 },
      { title: 'Admin / Office Manager', avgHourlyRate: 25, pctOfWorkforce: 15 },
      { title: 'Field Supervisor', avgHourlyRate: 38, pctOfWorkforce: 20 },
    ],
    departmentWorkflows: {
      Operations: [
        { name: 'Project bid preparation', hoursPerWeekPerFte: 10, automationCeilingPct: 50 },
        { name: 'Subcontractor coordination', hoursPerWeekPerFte: 6, automationCeilingPct: 60 },
        { name: 'Safety and compliance documentation', hoursPerWeekPerFte: 4, automationCeilingPct: 65 },
        { name: 'Progress reporting', hoursPerWeekPerFte: 5, automationCeilingPct: 60 },
      ],
      Finance: [
        { name: 'Invoice processing and job costing', hoursPerWeekPerFte: 6, automationCeilingPct: 70 },
        { name: 'Payroll processing', hoursPerWeekPerFte: 4, automationCeilingPct: 75 },
      ],
    },
    commonTechStack: ['procore', 'excel', 'quickbooks', 'email'],
    painPoints: ['Bid win rate', 'Project cost overruns', 'Subcontractor communication'],
  },

  'hospitality': {
    code: 'hospitality',
    name: 'Hospitality / Restaurant',
    avgAiReadiness: 30,
    avgAutomationOpportunity: 66,
    avgDataVisibility: 35,
    avgRevenueAcceleration: 55,
    commonRoles: [
      { title: 'Front of House Staff', avgHourlyRate: 18, pctOfWorkforce: 40 },
      { title: 'Manager', avgHourlyRate: 32, pctOfWorkforce: 15 },
      { title: 'Kitchen / Back of House', avgHourlyRate: 20, pctOfWorkforce: 30 },
    ],
    departmentWorkflows: {
      Operations: [
        { name: 'Reservation management', hoursPerWeekPerFte: 5, automationCeilingPct: 80 },
        { name: 'Staff scheduling', hoursPerWeekPerFte: 6, automationCeilingPct: 70 },
        { name: 'Inventory ordering', hoursPerWeekPerFte: 4, automationCeilingPct: 65 },
        { name: 'Review response management', hoursPerWeekPerFte: 3, automationCeilingPct: 75 },
      ],
      Marketing: [
        { name: 'Social media posting', hoursPerWeekPerFte: 4, automationCeilingPct: 75 },
        { name: 'Email loyalty campaigns', hoursPerWeekPerFte: 3, automationCeilingPct: 80 },
      ],
    },
    commonTechStack: ['toast', 'yelp', 'opentable', 'instagram'],
    painPoints: ['Staff scheduling', 'Review management', 'No-show reservations'],
  },

  'other': {
    code: 'other',
    name: 'General Business',
    avgAiReadiness: 38,
    avgAutomationOpportunity: 58,
    avgDataVisibility: 35,
    avgRevenueAcceleration: 50,
    commonRoles: [
      { title: 'Manager / Director', avgHourlyRate: 48, pctOfWorkforce: 20 },
      { title: 'Operations Staff', avgHourlyRate: 28, pctOfWorkforce: 35 },
      { title: 'Sales / Customer-Facing', avgHourlyRate: 35, pctOfWorkforce: 25 },
      { title: 'Admin', avgHourlyRate: 22, pctOfWorkforce: 20 },
    ],
    departmentWorkflows: {
      Operations: [
        { name: 'Manual data entry and reporting', hoursPerWeekPerFte: 6, automationCeilingPct: 75 },
        { name: 'Email and communication management', hoursPerWeekPerFte: 8, automationCeilingPct: 50 },
        { name: 'Scheduling and coordination', hoursPerWeekPerFte: 4, automationCeilingPct: 70 },
      ],
      Finance: [
        { name: 'Invoicing and billing', hoursPerWeekPerFte: 3, automationCeilingPct: 80 },
        { name: 'Expense reporting', hoursPerWeekPerFte: 2, automationCeilingPct: 70 },
      ],
    },
    commonTechStack: ['email', 'excel'],
    painPoints: ['Manual processes', 'Reporting overhead', 'Communication gaps'],
  },
};

export function getBenchmark(industry: string): IndustryBenchmark {
  const normalizedIndustry = industry?.toLowerCase().replace(/\s+/g, '-') ?? '';

  // Try direct match
  if (BENCHMARKS[normalizedIndustry]) return BENCHMARKS[normalizedIndustry];

  // Fuzzy match
  const matches: Record<string, string[]> = {
    'saas-tech': ['software', 'tech', 'saas', 'app', 'platform', 'digital'],
    'professional-services': ['consulting', 'advisory', 'management', 'strategy', 'staffing'],
    'real-estate': ['real estate', 'property', 'realty', 'mortgage', 'brokerage'],
    'ecommerce': ['ecommerce', 'retail', 'shop', 'store', 'commerce', 'consumer goods'],
    'healthcare': ['health', 'medical', 'dental', 'clinic', 'hospital', 'pharma'],
    'marketing-agency': ['marketing', 'agency', 'advertising', 'pr', 'creative', 'media'],
    'legal': ['law', 'legal', 'attorney', 'lawyer'],
    'finance-accounting': ['finance', 'accounting', 'tax', 'bookkeep', 'audit', 'cpa'],
    'construction': ['construction', 'contractor', 'building', 'architecture', 'engineering'],
    'hospitality': ['restaurant', 'hotel', 'hospitality', 'food', 'beverage', 'catering'],
  };

  for (const [benchmarkKey, keywords] of Object.entries(matches)) {
    if (keywords.some((kw) => normalizedIndustry.includes(kw))) {
      return BENCHMARKS[benchmarkKey];
    }
  }

  return BENCHMARKS['other'];
}

export function formatBenchmarkForPrompt(benchmark: IndustryBenchmark): string {
  const lines = [
    `Industry: ${benchmark.name}`,
    `Industry Averages: AI Readiness ${benchmark.avgAiReadiness}/100, Automation Opportunity ${benchmark.avgAutomationOpportunity}/100, Data Visibility ${benchmark.avgDataVisibility}/100`,
    `Common Pain Points: ${benchmark.painPoints.join(', ')}`,
    `Typical Tech Stack: ${benchmark.commonTechStack.join(', ')}`,
    `Common Roles & Rates:`,
    ...benchmark.commonRoles.map((r) => `  - ${r.title}: $${r.avgHourlyRate}/hr fully-loaded`),
    `Typical Workflows by Department:`,
  ];

  for (const [dept, workflows] of Object.entries(benchmark.departmentWorkflows)) {
    lines.push(`  ${dept}:`);
    for (const wf of workflows) {
      lines.push(
        `    - ${wf.name}: ~${wf.hoursPerWeekPerFte} hrs/wk/FTE, ${wf.automationCeilingPct}% automatable`
      );
    }
  }

  return lines.join('\n');
}
