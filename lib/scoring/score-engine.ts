import type { AuditScores, BusinessClassification } from '@/types/audit';
import type { IndustryBenchmark } from '@/lib/benchmarks/industry-data';

interface ScoringInput {
  classification: BusinessClassification;
  benchmark: IndustryBenchmark;
  techSignalsDetected: string[];
  manualProcessSignals: string[];
  employeeRange: string;
  hasTrafficData: boolean;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function toPercentile(score: number, benchmarkAvg: number): number {
  const diff = score - benchmarkAvg;
  // ~15 point spread = ~30 percentile points
  const percentile = 50 + (diff / 15) * 30;
  return clamp(percentile, 5, 95);
}

const TECH_SOPHISTICATION_SCORES: Record<string, number> = {
  'AI-Native': 85,
  'Modern Stack': 65,
  'Basic Digital Tools': 38,
  'Legacy/Paper': 15,
};

const DATA_MATURITY_SCORES: Record<string, number> = {
  'BI/Dashboards': 90,
  'Analytics Stack': 72,
  'Basic CRM/Tools': 50,
  'Spreadsheet-Based': 28,
  'None/Paper': 10,
};

export function computeScores(input: ScoringInput): AuditScores {
  const {
    classification,
    benchmark,
    techSignalsDetected,
    manualProcessSignals,
    hasTrafficData,
  } = input;

  // --- AI Readiness ---
  const techBase = TECH_SOPHISTICATION_SCORES[classification.techSophistication] ?? 38;
  const dataBase = DATA_MATURITY_SCORES[classification.dataMature] ?? 28;
  const techBonus = Math.min(techSignalsDetected.length * 4, 20);
  const aiReadinessRaw = techBase * 0.4 + dataBase * 0.4 + techBonus * 0.2;
  const aiReadiness = clamp(aiReadinessRaw);

  // --- Automation Opportunity ---
  // Higher manual signals = higher opportunity
  const manualBonus = Math.min(manualProcessSignals.length * 8, 30);
  const deptBonus = Math.min(classification.inferredDepartments.length * 5, 20);
  // Inverse of tech sophistication — less sophisticated = more opportunity
  const techOpportunityFactor = 100 - (TECH_SOPHISTICATION_SCORES[classification.techSophistication] ?? 38);
  const automationOpportunityRaw =
    benchmark.avgAutomationOpportunity * 0.5 +
    techOpportunityFactor * 0.2 +
    manualBonus * 0.2 +
    deptBonus * 0.1;
  const automationOpportunity = clamp(automationOpportunityRaw);

  // --- Data Visibility ---
  const dataVisRaw = dataBase * 0.7 + (hasTrafficData ? 15 : 0) + techBonus * 0.3;
  const dataVisibility = clamp(dataVisRaw);

  // --- Revenue Acceleration ---
  const hasMarketing =
    classification.inferredDepartments.includes('Marketing') ||
    techSignalsDetected.some((t) => ['mailchimp', 'klaviyo', 'marketo', 'hubspot'].includes(t));
  const hasSales =
    classification.inferredDepartments.includes('Sales') ||
    techSignalsDetected.some((t) => ['salesforce', 'hubspot', 'pipedrive'].includes(t));
  const revenueBase = benchmark.avgRevenueAcceleration;
  const revenueAccelerationRaw = revenueBase + (hasMarketing ? 10 : 0) + (hasSales ? 8 : 0);
  const revenueAcceleration = clamp(revenueAccelerationRaw);

  // --- Overall Maturity ---
  const overall = clamp(
    aiReadiness * 0.3 +
    automationOpportunity * 0.25 +
    dataVisibility * 0.25 +
    revenueAcceleration * 0.2
  );

  return {
    aiReadiness: {
      score: aiReadiness,
      percentile: toPercentile(aiReadiness, benchmark.avgAiReadiness),
      verdict:
        aiReadiness >= 70
          ? 'Well-positioned for AI adoption — strong tech foundation in place.'
          : aiReadiness >= 45
          ? 'Moderate AI readiness — some foundational gaps to address before scaling.'
          : 'Low AI readiness — significant infrastructure investment needed before advanced automation.',
      topFactors: [
        `Tech sophistication: ${classification.techSophistication}`,
        `Data maturity: ${classification.dataMature}`,
        techSignalsDetected.length > 0
          ? `${techSignalsDetected.length} tools detected (${techSignalsDetected.slice(0, 3).join(', ')})`
          : 'Limited tool usage detected',
      ],
    },
    automationOpportunity: {
      score: automationOpportunity,
      percentile: toPercentile(automationOpportunity, benchmark.avgAutomationOpportunity),
      verdict:
        automationOpportunity >= 70
          ? 'High automation potential — significant manual workflows identified that are immediately addressable.'
          : automationOpportunity >= 45
          ? 'Moderate automation opportunity — several workflows can be systematically improved.'
          : 'Lower automation ceiling — business already has some process efficiency in place.',
      topFactors: [
        `${manualProcessSignals.length} manual process signals detected`,
        `${classification.inferredDepartments.length} departments inferred (${classification.inferredDepartments.slice(0, 3).join(', ')})`,
        `Industry average automation opportunity: ${benchmark.avgAutomationOpportunity}/100`,
      ],
    },
    dataVisibility: {
      score: dataVisibility,
      percentile: toPercentile(dataVisibility, benchmark.avgDataVisibility),
      verdict:
        dataVisibility >= 65
          ? 'Good data visibility — leadership has meaningful insight into business performance.'
          : dataVisibility >= 35
          ? 'Partial visibility — some metrics tracked but key blind spots exist across departments.'
          : 'Very limited data visibility — most operational performance is invisible to leadership.',
      topFactors: [
        `Data infrastructure: ${classification.dataMature}`,
        hasTrafficData
          ? 'Web analytics/tracking detected'
          : 'Limited web analytics signals',
        `Industry average visibility: ${benchmark.avgDataVisibility}/100`,
      ],
    },
    revenueAcceleration: {
      score: revenueAcceleration,
      percentile: toPercentile(revenueAcceleration, benchmark.avgRevenueAcceleration),
      verdict:
        revenueAcceleration >= 65
          ? 'Strong revenue acceleration potential — sales and marketing infrastructure ready to leverage AI.'
          : revenueAcceleration >= 45
          ? 'Moderate revenue opportunity — targeted AI investments could meaningfully improve top-line growth.'
          : 'Foundational revenue infrastructure gaps — address CRM and pipeline visibility first.',
      topFactors: [
        hasSales ? 'Sales function detected' : 'Limited sales infrastructure signals',
        hasMarketing ? 'Marketing function detected' : 'Limited marketing infrastructure',
        `Revenue model: ${classification.revenueModel}`,
      ],
    },
    overallMaturity: {
      score: overall,
      percentile: toPercentile(overall, 45),
      verdict:
        overall >= 65
          ? `Ahead of most peers in ${benchmark.name} — ready to move from AI foundation to scale.`
          : overall >= 40
          ? `Roughly average for ${benchmark.name} — clear opportunities to pull ahead of competitors through targeted AI investments.`
          : `Below average for ${benchmark.name} — significant upside available with systematic investment.`,
      topFactors: [
        `AI Readiness: ${aiReadiness}/100`,
        `Automation Opportunity: ${automationOpportunity}/100`,
        `Data Visibility: ${dataVisibility}/100`,
      ],
    },
  };
}
