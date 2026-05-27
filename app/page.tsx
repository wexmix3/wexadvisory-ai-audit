import Link from 'next/link';

const SCORE_EXAMPLES = [
  { label: 'AI Readiness', score: 42, color: '#C8A84B' },
  { label: 'Automation Opp.', score: 71, color: '#22c55e' },
  { label: 'Data Visibility', score: 28, color: '#ef4444' },
  { label: 'Revenue Accel.', score: 55, color: '#C8A84B' },
  { label: 'Overall Maturity', score: 49, color: '#C8A84B' },
];

const WHAT_YOU_GET = [
  { icon: '📊', title: '5 AI Maturity Scores', desc: 'Benchmarked against your industry — AI Readiness, Automation Opportunity, Data Visibility, Revenue Acceleration, Overall Maturity' },
  { icon: '💰', title: 'Estimated Annual Savings', desc: 'Every opportunity backed by labor math: hours × hourly rate × automation ceiling — no generic guesses' },
  { icon: '🎯', title: 'Prioritized Quick Wins', desc: 'Opportunities ranked by ROI with implementation complexity and specific tool recommendations' },
  { icon: '🗺️', title: 'Implementation Roadmap', desc: 'Phase 1 (quick wins), Phase 2 (foundation), Phase 3 (scale) — realistic timelines and cost estimates' },
];

const INDUSTRIES = [
  'Professional Services', 'SaaS / Tech', 'Real Estate',
  'Healthcare', 'E-Commerce', 'Marketing Agency', 'Legal', 'Finance',
  'Construction', 'Hospitality', 'Manufacturing', 'Other',
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0A1628] text-white">
      {/* Nav */}
      <nav className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <div className="text-[#C8A84B] text-xs font-semibold tracking-widest uppercase">Wex Advisory</div>
            <div className="text-white text-sm font-bold">AI Opportunity Engine</div>
          </div>
          <a href="https://wexadvisory.com" className="text-slate-400 hover:text-white text-sm transition-colors">
            wexadvisory.com →
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-24 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-[#C8A84B]/10 border border-[#C8A84B]/30 rounded-full px-4 py-1.5 text-[#C8A84B] text-sm font-medium mb-8">
            <span className="w-2 h-2 rounded-full bg-[#C8A84B] animate-pulse" />
            Free · Instant · No credit card
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold leading-tight mb-6">
            See exactly where AI saves<br />
            <span className="text-[#C8A84B]">your business money</span>
          </h1>
          <p className="text-slate-300 text-xl max-w-2xl mx-auto mb-10">
            Enter your website URL. In 2–3 minutes, get a quantified AI opportunity analysis with real labor math — not generic advice.
          </p>
          <Link
            href="/audit"
            className="inline-block bg-[#C8A84B] hover:bg-[#b8952e] text-[#0A1628] font-bold text-lg px-10 py-4 rounded-xl transition-colors shadow-lg shadow-[#C8A84B]/20"
          >
            Get My Free AI Snapshot →
          </Link>
          <p className="text-slate-500 text-sm mt-4">
            Benchmarked against 12 industries · Powered by Claude AI
          </p>
        </div>
      </section>

      {/* Score preview */}
      <section className="px-6 pb-20">
        <div className="max-w-3xl mx-auto">
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-8">
            <div className="text-slate-400 text-sm font-medium uppercase tracking-wider text-center mb-6">
              Sample Output — Professional Services Firm, 25 Employees
            </div>
            <div className="text-center mb-8">
              <div className="text-slate-400 text-sm mb-1">Estimated Annual Savings Potential</div>
              <div className="text-[#C8A84B] text-5xl font-bold">$312K</div>
              <div className="text-slate-400 text-sm mt-1">across 6 identified automation opportunities</div>
            </div>
            <div className="flex justify-center gap-6 flex-wrap">
              {SCORE_EXAMPLES.map(({ label, score, color }) => (
                <div key={label} className="text-center">
                  <div className="relative w-16 h-16 mx-auto mb-1">
                    <svg className="transform -rotate-90" width="64" height="64">
                      <circle cx="32" cy="32" r="26" fill="none" stroke="#1e293b" strokeWidth="6" />
                      <circle
                        cx="32" cy="32" r="26" fill="none"
                        stroke={color} strokeWidth="6"
                        strokeDasharray={163}
                        strokeDashoffset={163 - (score / 100) * 163}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">{score}</span>
                    </div>
                  </div>
                  <div className="text-slate-400 text-xs">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className="px-6 py-20 border-t border-slate-800">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-3">What your Snapshot includes</h2>
          <p className="text-slate-400 text-center mb-12">Not generic AI advice. Specific workflows, real numbers, actionable roadmaps.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {WHAT_YOU_GET.map(({ icon, title, desc }) => (
              <div key={title} className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                <div className="text-2xl mb-3">{icon}</div>
                <h3 className="text-white font-semibold mb-2">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Differentiation table */}
      <section className="px-6 py-20 border-t border-slate-800">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">This is not a generic AI ideas list</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-red-400 font-semibold text-center pb-2 border-b border-red-900/40">Generic AI Advice</div>
            <div className="text-green-400 font-semibold text-center pb-2 border-b border-green-900/40">Wex AI Audit</div>
            {[
              ['"Automate customer service"', '"Your inbound CS volume (est. 200 tickets/mo) costs ~$4,200/mo. AI triage reduces tier-1 by 60% → saves $30K/year"'],
              ['Lists 10 vague ideas', 'Ranks by annual savings with confidence-weighted labor math'],
              ['No implementation plan', 'Phase 1/2/3 roadmap: specific tools, weeks, cost ranges'],
              ['"Use AI for marketing"', '"Deploy Jasper AI for product description writing — saves 32 hrs/mo at $38/hr = $14,592/year"'],
            ].map(([bad, good]) => (
              <div key={bad} className="contents">
                <div className="bg-red-900/15 border border-red-900/30 rounded-lg p-4 text-slate-300 text-sm">{bad}</div>
                <div className="bg-green-900/15 border border-green-900/30 rounded-lg p-4 text-slate-300 text-sm">{good}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Industries */}
      <section className="px-6 py-16 border-t border-slate-800">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-3">Benchmarked across 12 industries</h2>
          <p className="text-slate-400 text-sm mb-8">Your scores are compared against businesses in your specific industry and size</p>
          <div className="flex flex-wrap justify-center gap-2">
            {INDUSTRIES.map((ind) => (
              <span key={ind} className="bg-slate-800 border border-slate-700 text-slate-300 text-sm px-3 py-1.5 rounded-full">
                {ind}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24 border-t border-slate-800 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl font-bold mb-4">Ready to see your number?</h2>
          <p className="text-slate-400 mb-8">Free snapshot in 2–3 minutes. No credit card. Report emailed directly to you.</p>
          <Link
            href="/audit"
            className="inline-block bg-[#C8A84B] hover:bg-[#b8952e] text-[#0A1628] font-bold text-lg px-10 py-4 rounded-xl transition-colors"
          >
            Get My Free AI Snapshot →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 px-6 py-8 text-center">
        <div className="text-[#C8A84B] font-semibold mb-1">Wex Advisory</div>
        <a href="https://wexadvisory.com" className="text-slate-500 text-sm hover:text-slate-400 transition-colors">
          wexadvisory.com
        </a>
      </footer>
    </div>
  );
}
