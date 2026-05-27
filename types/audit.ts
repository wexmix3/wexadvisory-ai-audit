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
}

export interface RoadmapItem {
  title: string;
  description: string;
  weeks: number;
  estimatedCost: number;
  estimatedSavings: number;
}

export interface ImplementationPhase {
  name: string;
  durationWeeks: number;
  items: RoadmapItem[];
  totalInvestment: number;
  totalSavings: number;
}

export interface DashboardRecommendation {
  title: string;
  rationale: string;
  kpis: string[];
  estimatedBuildWeeks: number;
}

export interface CompetitiveInsight {
  observation: string;
  implication: string;
  opportunity: string;
}

export interface AuditReportData {
  executiveSummary: {
    headline: string;
    totalAnnualSavings: number;
    quickWinSavings: number;
    topOpportunity: string;
    urgencyNote: string;
    confidenceStatement: string;
  };
  companySnapshot: {
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
  dashboardRecommendations: DashboardRecommendation[];
  competitiveInsights: CompetitiveInsight[];
  nextSteps: {
    immediate: string[];
    shortTerm: string[];
    callToAction: string;
  };
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
