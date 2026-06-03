import Anthropic from '@anthropic-ai/sdk';
import type { BusinessClassification } from '@/types/audit';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
    client = new Anthropic({ apiKey });
  }
  return client;
}

const CLASSIFY_SYSTEM = `You are a business analyst. Given company website content and search signals, classify the business. Output ONLY valid JSON — no markdown, no preamble.

Output this exact JSON:
{
  "businessModel": "B2B Services | B2B SaaS | B2C Ecommerce | B2B Ecommerce | Professional Services | Healthcare | Real Estate | Hospitality | Manufacturing | Legal | Marketing Agency | Finance/Accounting | Construction | Other",
  "revenueModel": "Recurring Subscription | Project-Based | Transaction/Commission | Retainer | Mixed | Unknown",
  "customerType": "SMB | Mid-Market | Enterprise | Consumer | Mixed",
  "orgStructure": "Founder-Led | Departmental | Distributed | Franchise | Unknown",
  "dataMature": "None/Paper | Spreadsheet-Based | Basic CRM/Tools | Analytics Stack | BI/Dashboards",
  "techSophistication": "Legacy/Paper | Basic Digital Tools | Modern Stack | AI-Native",
  "inferredDepartments": ["Sales", "Operations", "Finance"],
  "inferredEmployeeCount": "1-10 | 11-50 | 51-200 | 200+",
  "keyTechSignals": ["hubspot", "quickbooks"],
  "businessDescription": "One clear sentence describing what this business does and who it serves."
}`;

export async function classifyBusiness(input: {
  webContent: string;
  jobSignals: string;
  techSignals: string[];
  intake: { companyName: string; industry: string; employeeRange: string };
}): Promise<BusinessClassification> {
  const userMessage = `
Company: ${input.intake.companyName}
Industry (self-reported): ${input.intake.industry}
Employee range (self-reported): ${input.intake.employeeRange}
Detected tech: ${input.techSignals.join(', ') || 'none detected'}

Website content:
${input.webContent.slice(0, 5000)}

Job/review signals:
${input.jobSignals.slice(0, 2000)}

Classify this business.`.trim();

  const message = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    temperature: 0,
    system: CLASSIFY_SYSTEM,
    messages: [{ role: 'user', content: userMessage }],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text : '{}';
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Classification returned invalid JSON');

  const parsed = JSON.parse(match[0]);

  return {
    businessModel: parsed.businessModel ?? 'Other',
    revenueModel: parsed.revenueModel ?? 'Unknown',
    customerType: parsed.customerType ?? 'Mixed',
    orgStructure: parsed.orgStructure ?? 'Unknown',
    dataMature: parsed.dataMature ?? 'Spreadsheet-Based',
    techSophistication: parsed.techSophistication ?? 'Basic Digital Tools',
    inferredDepartments: parsed.inferredDepartments ?? [],
    inferredEmployeeCount: parsed.inferredEmployeeCount ?? input.intake.employeeRange,
    keyTechSignals: parsed.keyTechSignals ?? input.techSignals,
    businessDescription: parsed.businessDescription ?? '',
  };
}
