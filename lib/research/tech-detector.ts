// Detects technology signals from scraped web content and job posting signals

const TECH_PATTERNS: Record<string, string[]> = {
  // CRM
  salesforce: ['salesforce', 'salesforce.com', 'sfdc'],
  hubspot: ['hubspot', 'hubspot.com'],
  pipedrive: ['pipedrive'],
  zoho: ['zoho crm', 'zoho.com'],
  // Accounting
  quickbooks: ['quickbooks', 'intuit'],
  xero: ['xero'],
  netsuite: ['netsuite', 'oracle netsuite'],
  // Support
  zendesk: ['zendesk'],
  intercom: ['intercom'],
  freshdesk: ['freshdesk'],
  // Marketing
  mailchimp: ['mailchimp'],
  klaviyo: ['klaviyo'],
  marketo: ['marketo'],
  // Analytics
  googleanalytics: ['google analytics', 'ga4', 'gtm', 'google tag manager'],
  mixpanel: ['mixpanel'],
  segment: ['segment.com'],
  // Project Mgmt
  asana: ['asana'],
  monday: ['monday.com'],
  jira: ['jira', 'atlassian'],
  notion: ['notion'],
  // Communication
  slack: ['slack'],
  teams: ['microsoft teams', 'ms teams'],
  // ERP
  sap: ['sap'],
  dynamics: ['microsoft dynamics', 'dynamics 365'],
  // Commerce
  shopify: ['shopify'],
  // Scheduling
  calendly: ['calendly'],
  // Finance / Payments
  stripe: ['stripe'],
};

export function detectTechFromContent(content: string): string[] {
  const lower = content.toLowerCase();
  const detected: string[] = [];
  for (const [tech, patterns] of Object.entries(TECH_PATTERNS)) {
    if (patterns.some((p) => lower.includes(p))) {
      detected.push(tech);
    }
  }
  return detected;
}

// Infers departments from job posting keywords
export function inferDepartmentsFromJobSignals(jobContent: string): string[] {
  const lower = jobContent.toLowerCase();
  const departments: string[] = [];

  const deptKeywords: Record<string, string[]> = {
    'Sales': ['account executive', 'sales rep', 'business development', 'sales manager', 'sdr', 'bdr'],
    'Marketing': ['marketing manager', 'content', 'seo', 'demand gen', 'growth', 'brand'],
    'Customer Success': ['customer success', 'customer support', 'account manager', 'cs manager'],
    'Operations': ['operations manager', 'ops', 'process', 'supply chain', 'logistics'],
    'Finance': ['finance', 'accounting', 'controller', 'cfo', 'bookkeeper', 'accounts payable'],
    'HR': ['recruiter', 'talent', 'hr manager', 'people ops', 'human resources'],
    'Engineering': ['engineer', 'developer', 'software', 'devops', 'qa'],
    'Product': ['product manager', 'product owner', 'pm ', 'ux', 'designer'],
    'Legal': ['legal', 'compliance', 'counsel', 'attorney', 'paralegal'],
    'Executive': ['ceo', 'coo', 'cto', 'vp ', 'director', 'chief'],
  };

  for (const [dept, keywords] of Object.entries(deptKeywords)) {
    if (keywords.some((k) => lower.includes(k))) {
      departments.push(dept);
    }
  }

  return departments;
}

// Extracts manual process signals from job descriptions
export function extractManualProcessSignals(content: string): string[] {
  const lower = content.toLowerCase();
  const signals: string[] = [];

  const manualIndicators = [
    { pattern: 'excel', signal: 'Heavy Excel usage — manual data work' },
    { pattern: 'google sheets', signal: 'Google Sheets — manual data workflows' },
    { pattern: 'data entry', signal: 'Manual data entry roles' },
    { pattern: 'manual reporting', signal: 'Manual reporting processes' },
    { pattern: 'copy and paste', signal: 'Copy-paste data workflows' },
    { pattern: 'spreadsheet', signal: 'Spreadsheet-based operations' },
    { pattern: 'email follow', signal: 'Manual email follow-up processes' },
    { pattern: 'paper', signal: 'Paper-based processes' },
    { pattern: 'fax', signal: 'Legacy communication (fax)' },
    { pattern: 'manual invoice', signal: 'Manual invoicing' },
    { pattern: 'word document', signal: 'Manual document creation' },
  ];

  for (const { pattern, signal } of manualIndicators) {
    if (lower.includes(pattern)) {
      signals.push(signal);
    }
  }

  return signals;
}
