'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import type { AuditScores } from '@/types/audit';

type Status = 'pending' | 'researching' | 'analyzing' | 'generating' | 'complete' | 'failed';

const STATUS_LABELS: Record<Status, string> = {
  pending: 'Starting analysis...',
  researching: 'Researching your business...',
  analyzing: 'Classifying business model and workflows...',
  generating: 'Quantifying AI opportunities...',
  complete: 'Analysis complete',
  failed: 'Analysis failed',
};

const STATUS_PROGRESS: Record<Status, number> = {
  pending: 5,
  researching: 30,
  analyzing: 60,
  generating: 85,
  complete: 100,
  failed: 0,
};

interface AuditSummary {
  totalAnnualSavings: number;
  headline: string;
  scores: AuditScores;
}

function ScoreGauge({ label, score, percentile, verdict }: {
  label: string; score: number; percentile: number; verdict: string;
}) {
  const color = score >= 65 ? '#22c55e' : score >= 40 ? '#C8A84B' : '#ef4444';
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
      <div className="relative w-20 h-20 mb-2">
        <svg className="transform -rotate-90" width="80" height="80">
          <circle cx="40" cy="40" r="36" fill="none" stroke="#1e293b" strokeWidth="8" />
          <circle
            cx="40" cy="40" r="36" fill="none"
            stroke={color} strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-white font-bold text-lg">{score}</span>
        </div>
      </div>
      <div className="text-slate-300 text-xs font-semibold text-center mb-0.5">{label}</div>
      <div className="text-slate-500 text-xs text-center">Top {100 - percentile}%</div>
      <div className="text-slate-400 text-xs text-center mt-1 line-clamp-2">{verdict}</div>
    </div>
  );
}

export default function ResultsPage() {
  const { auditId } = useParams<{ auditId: string }>();
  const [status, setStatus] = useState<Status>('pending');
  const [companyName, setCompanyName] = useState('');
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [error, setError] = useState('');

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/audit/${auditId}/status`);
      const data = await res.json();
      setStatus(data.status as Status);
      if (data.companyName) setCompanyName(data.companyName);
      if (data.summary) setSummary(data.summary);
      if (data.errorMessage) setError(data.errorMessage);
    } catch {
      // ignore transient errors
    }
  }, [auditId]);

  useEffect(() => {
    poll();
    const interval = setInterval(() => {
      if (status === 'complete' || status === 'failed') return;
      poll();
    }, 2500);
    return () => clearInterval(interval);
  }, [poll, status]);

  const progress = STATUS_PROGRESS[status] ?? 5;
  const isComplete = status === 'complete';
  const isFailed = status === 'failed';

  return (
    <div className="min-h-screen bg-[#0A1628] px-4 py-16">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="text-[#C8A84B] text-sm font-semibold tracking-widest uppercase mb-2">Wex Advisory</div>
          <h1 className="text-white text-3xl font-bold">
            {companyName ? `AI Opportunity Snapshot — ${companyName}` : 'AI Opportunity Snapshot'}
          </h1>
        </div>

        {/* Failed state */}
        {isFailed && (
          <div className="bg-red-900/30 border border-red-800 rounded-xl p-6 text-center">
            <p className="text-red-300 font-semibold mb-2">Analysis failed</p>
            <p className="text-red-400 text-sm">{error || 'Something went wrong. Please try again.'}</p>
            <a href="/audit" className="mt-4 inline-block bg-[#C8A84B] text-[#0A1628] font-bold px-6 py-2.5 rounded-lg text-sm">
              Try Again
            </a>
          </div>
        )}

        {/* Loading state */}
        {!isComplete && !isFailed && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 text-center">
            <div className="mb-6">
              <div className="flex items-center justify-between text-sm text-slate-400 mb-2">
                <span>{STATUS_LABELS[status]}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#C8A84B] rounded-full transition-all duration-1000"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <p className="text-slate-400 text-sm">
              We&apos;re researching your business, benchmarking against industry peers, and quantifying each automation opportunity.
              This typically takes 60–90 seconds.
            </p>
          </div>
        )}

        {/* Complete state */}
        {isComplete && summary && (
          <div className="space-y-6">
            {/* Savings hero */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-8 text-center">
              <div className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-2">
                Estimated Annual Savings Potential
              </div>
              <div className="text-[#C8A84B] text-6xl font-bold mb-2">
                ${(summary.totalAnnualSavings / 1000).toFixed(0)}K
              </div>
              <p className="text-slate-300 text-base max-w-lg mx-auto">
                {summary.headline}
              </p>
            </div>

            {/* Score grid */}
            <div>
              <h2 className="text-white text-lg font-semibold mb-4">Your AI Maturity Scores</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <ScoreGauge
                  label="AI Readiness"
                  score={summary.scores.aiReadiness.score}
                  percentile={summary.scores.aiReadiness.percentile}
                  verdict={summary.scores.aiReadiness.verdict}
                />
                <ScoreGauge
                  label="Automation"
                  score={summary.scores.automationOpportunity.score}
                  percentile={summary.scores.automationOpportunity.percentile}
                  verdict={summary.scores.automationOpportunity.verdict}
                />
                <ScoreGauge
                  label="Data Visibility"
                  score={summary.scores.dataVisibility.score}
                  percentile={summary.scores.dataVisibility.percentile}
                  verdict={summary.scores.dataVisibility.verdict}
                />
                <ScoreGauge
                  label="Revenue"
                  score={summary.scores.revenueAcceleration.score}
                  percentile={summary.scores.revenueAcceleration.percentile}
                  verdict={summary.scores.revenueAcceleration.verdict}
                />
                <ScoreGauge
                  label="Overall Maturity"
                  score={summary.scores.overallMaturity.score}
                  percentile={summary.scores.overallMaturity.percentile}
                  verdict={summary.scores.overallMaturity.verdict}
                />
              </div>
            </div>

            {/* Teaser CTA */}
            <div className="bg-[#C8A84B]/10 border border-[#C8A84B]/30 rounded-2xl p-8">
              <div className="max-w-xl mx-auto text-center">
                <h2 className="text-white text-xl font-bold mb-2">
                  Your full report was sent to your inbox
                </h2>
                <p className="text-slate-300 text-sm mb-6">
                  The Snapshot shows your scores. A full audit reveals the specific workflows, labor math, implementation roadmap, and tool-by-tool recommendations that unlock this savings potential.
                </p>
                <a
                  href="https://calendly.com/maxwexley-wexadvisory/free-strategy-call"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-[#C8A84B] hover:bg-[#b8952e] text-[#0A1628] font-bold px-8 py-3.5 rounded-lg text-base transition-colors"
                >
                  Book a Free Strategy Call →
                </a>
                <p className="text-slate-500 text-xs mt-3">30 minutes · No sales pressure · Walk through your results together</p>
              </div>
            </div>

            {/* What's in the full audit */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-4">What the Full Audit includes</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  'Department-by-department workflow breakdown',
                  'Full labor math (hours × rate × automation ceiling)',
                  'Phase 1/2/3 implementation roadmap',
                  'Specific tool recommendations with costs',
                  'ROI calculator with payback periods',
                  'Competitive intelligence on AI adoption',
                  'Custom dashboard recommendations',
                  'Priority quick wins (implement in <4 weeks)',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2 text-slate-300 text-sm">
                    <span className="text-[#C8A84B] mt-0.5">✓</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8">
          <a href="https://wexadvisory.com" className="text-slate-500 text-xs hover:text-slate-400 transition-colors">
            Powered by Wex Advisory
          </a>
        </div>
      </div>
    </div>
  );
}
