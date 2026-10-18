export type AuditType = 'snapshot' | 'full';
export type AuditStatus = 'pending' | 'researching' | 'analyzing' | 'generating' | 'complete' | 'failed';
export type LeadStatus = 'new' | 'emailed' | 'contacted' | 'proposal' | 'client' | 'dead';
export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type Complexity = 'low' | 'medium' | 'high';

export interface SnapshotIntake {
  companyUrl: string;
  companyName: string;
  industry: string;
  employeeRange: '1-10' | '11-50' | '51-200' | '200+';
  biggestChallenge: string;
  contactName: string;
  contactEmail: string;
  /** Traffic source, e.g. "coldoutreach" — captured from ?utm_source= on landing. Blank for organic/direct. */
  utmSource?: string;
  /** Outreach-tool prospect id, from ?pid= — lets a completed audit be joined back to the exact send. */
  prospectId?: string;
  /** Hours a week they say the biggestChallenge task takes. Optional; only 0 < h <= 168 is kept. */
  hoursPerWeek?: number;
}

export interface BusinessClassification {
  businessModel: string;
  revenueModel: string;
  customerType: string;
  orgStructure: string;
  dataMature: string;
  techSophistication: string;
  inferredDepartments: string[];
  inferredEmployeeCount: string;
  keyTechSignals: string[];
  businessDescription: string;
}

export interface ScoreDimension {
  score: number;
  percentile: number;
  verdict: string;
  topFactors: string[];
}

export interface AuditScores {
  aiReadiness: ScoreDimension;
  automationOpportunity: ScoreDimension;
  dataVisibility: ScoreDimension;
  revenueAcceleration: ScoreDimension;
  overallMaturity: ScoreDimension;
}

export interface RecommendedTool {
  name: string;
  purpose: string;
  pricing: string;
}

/** Where an input to the savings math came from. Set in code, never by the model. */
export type InputSource = 'from you' | 'industry benchmark estimate';

export interface InputSources {
  hours: InputSource;
  rate: InputSource;
  automationShare: InputSource;
}

/** Model-supplied facts behind the worth-automating score (lib/ai/opportunity-math.ts). */
export interface WorthAutomating {
  minutesPerRun: number;
  runsPerMonth: number;
  /** 0-2 */
  skillGap: number;
  /** 0-2: 0 = a wrong output reaches a customer or the books unreviewed, 2 = a person approves before it ships */
  mistakeCost: number;
  /** 0-2: 0 = a $20/month ChatGPT seat already does this, 2 = needs their systems/data wired in */
  needsTheirData: number;
}

export interface OpportunityItem {
  id: string;
  department: string;
  title: string;
  workflowDescription: string;
  opportunityDescription: string;
  frequency: string;
  hoursPerMonth: number;
  fteCountAffected: number;
  fullyLoadedHourlyRate: number;
  annualLaborCost: number;
  automationCeilingPct: number;
  annualSavings: number;
  confidenceLevel: ConfidenceLevel;
  complexity: Complexity;
  implementationWeeks: number;
  implementationCostLow: number;
  implementationCostHigh: number;
  roiMonths: number;
  recommendedTools: RecommendedTool[];
  quickWin: boolean;
  // Fields below were added 2026-10-18. All optional: reports stored before
  // then do not have them and must still render with their stored numbers.
  /** Best case x 0.5 (half the estimated automatable share). Computed in code. */
  annualSavingsConservative?: number;
  inputSources?: InputSources;
  /** Model flag: this is the opportunity that matches their intake answer. */
  usesIntakeHours?: boolean;
  worthAutomating?: WorthAutomating;
  /** 0-10, computed in code from worthAutomating. */
  worthAutomatingScore?: number;
  /** Build hours at BUILD_RATE_USD. implementationCostLow/High are computed from these. */
  buildHoursLow?: number;
  buildHoursHigh?: number;
}

export interface RoadmapItem {
  title: string;
  description: string;
  weeks: number;
  estimatedCost: number;
  estimatedSavings: number;
  /** Added 2026-10-18. When present, estimatedCost = buildHours x BUILD_RATE_USD (computed in code). */
  buildHours?: number;
}

export interface ImplementationPhase {
  name: string;
  durationWeeks: number;
  items: RoadmapItem[];
  totalInvestment: number;
  totalSavings: number;
}

/** @deprecated not generated since 2026-10-18; kept for old stored reports */
export interface DashboardRecommendation {
  title: string;
  rationale: string;
  kpis: string[];
  estimatedBuildWeeks: number;
}

/** @deprecated not generated since 2026-10-18; kept for old stored reports */
export interface CompetitiveInsight {
  observation: string;
  implication: string;
  opportunity: string;
}

export interface AuditReportData {
  executiveSummary: {
    headline: string;
    /** Sum of best-case opportunity savings (kept for back-compat). */
    totalAnnualSavings: number;
    /** Sum of conservative opportunity savings. Added 2026-10-18; missing on older reports. */
    totalAnnualSavingsConservative?: number;
    quickWinSavings: number;
    topOpportunity: string;
    urgencyNote: string;
    confidenceStatement: string;
  };
  /** @deprecated not generated since 2026-10-18; kept for old stored reports */
  companySnapshot?: {
    inferredModel: string;
    inferredSize: string;
    keyStrengths: string[];
    keyGaps: string[];
    techStackDetected: string[];
    dataMaturityAssessment: string;
  };
  scores: AuditScores;
  opportunities: OpportunityItem[];
  implementationRoadmap: {
    phase1: ImplementationPhase;
    phase2: ImplementationPhase;
    phase3: ImplementationPhase;
  };
  /** @deprecated not generated since 2026-10-18; kept for old stored reports */
  dashboardRecommendations?: DashboardRecommendation[];
  /** @deprecated not generated since 2026-10-18; kept for old stored reports */
  competitiveInsights?: CompetitiveInsight[];
  nextSteps: {
    immediate: string[];
    /** @deprecated not generated since 2026-10-18; kept for old stored reports */
    shortTerm?: string[];
    /** @deprecated not generated since 2026-10-18; kept for old stored reports */
    callToAction?: string;
  };
}

export type ProposalStatus = 'pending' | 'generated' | 'failed' | 'sent';

export interface ProposalOpportunityFrame {
  title: string;
  currentState: string;
  proposedApproach: string;
  estimatedSavings: number;
  timelineWeeks: number;
  /** Copied in code from the audit opportunity (never model text). Added 2026-10-18. */
  buildHoursLow?: number;
  buildHoursHigh?: number;
}

export interface ProposalContent {
  contactFirstName: string;
  companyName: string;
  companyUrl: string;
  preparedDate: string;
  executiveSummary: string;
  opportunities: ProposalOpportunityFrame[];
  engagementScope: string;
  engagementTimeline: string;
  ongoingSupportDescription: string;
  nextStep: string;
  emailSubject: string;
  emailBody: string;
}

export interface DecompressedProblem {
  realProblem: string;
  keyAssumptions: string[];
  proposalFraming: string;
}

export interface ProposalData {
  id: string;
  auditId: string;
  status: ProposalStatus;
  content: ProposalContent | null;
  gmailDraftId: string | null;
  costUsd: number | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface Audit {
  id: string;
  auditType: AuditType;
  status: AuditStatus;
  companyName: string | null;
  companyUrl: string;
  industry: string | null;
  employeeCountEstimate: string | null;
  contactName: string | null;
  contactEmail: string | null;
  intakeData: SnapshotIntake | null;
  webContent: Record<string, string> | null;
  searchResults: unknown[] | null;
  techSignals: string[] | null;
  jobSignals: string[] | null;
  trafficData: unknown | null;
  businessClassification: BusinessClassification | null;
  scores: AuditScores | null;
  opportunities: OpportunityItem[] | null;
  reportData: AuditReportData | null;
  pdfUrl: string | null;
  leadStatus: LeadStatus;
  leadNotes: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}
