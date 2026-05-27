'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const INDUSTRIES = [
  'Professional Services',
  'SaaS / Technology',
  'Real Estate',
  'Healthcare / Medical',
  'E-Commerce / Retail',
  'Marketing / Creative Agency',
  'Legal Services',
  'Finance / Accounting',
  'Construction / Contracting',
  'Hospitality / Restaurant',
  'Manufacturing',
  'Other',
];

const EMPLOYEE_RANGES = [
  { value: '1-10', label: '1–10 employees' },
  { value: '11-50', label: '11–50 employees' },
  { value: '51-200', label: '51–200 employees' },
  { value: '200+', label: '200+ employees' },
];

type Step = 1 | 2 | 3;

export default function AuditPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    companyUrl: '',
    companyName: '',
    industry: '',
    employeeRange: '11-50',
    biggestChallenge: '',
    contactName: '',
    contactEmail: '',
  });

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validateStep1() {
    if (!form.companyUrl.trim()) return 'Please enter your website URL';
    if (!form.companyName.trim()) return 'Please enter your company name';
    return '';
  }

  function validateStep2() {
    if (!form.industry) return 'Please select your industry';
    if (!form.biggestChallenge.trim()) return 'Please describe your biggest challenge';
    if (!form.contactName.trim()) return 'Please enter your name';
    if (!form.contactEmail.trim() || !form.contactEmail.includes('@')) return 'Please enter a valid email';
    return '';
  }

  function handleStep1() {
    const err = validateStep1();
    if (err) { setError(err); return; }
    setError('');
    setStep(2);
  }

  async function handleSubmit() {
    const err = validateStep2();
    if (err) { setError(err); return; }
    setError('');
    setLoading(true);
    setStep(3);

    try {
      const res = await fetch('/api/audit/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start audit');
      router.push(`/results/${data.auditId}`);
    } catch (e) {
      setLoading(false);
      setStep(2);
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <div className="min-h-screen bg-[#0A1628] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="text-[#C8A84B] text-sm font-semibold tracking-widest uppercase mb-2">Wex Advisory</div>
          <h1 className="text-white text-3xl font-bold">AI Opportunity Snapshot</h1>
          <p className="text-slate-400 mt-2 text-base">Free analysis · 2–3 minutes · No credit card</p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  step >= s
                    ? 'bg-[#C8A84B] text-[#0A1628]'
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                {s}
              </div>
              {s < 3 && <div className={`w-12 h-0.5 ${step > s ? 'bg-[#C8A84B]' : 'bg-slate-700'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8">
          {/* Step 1: Company URL */}
          {step === 1 && (
            <div>
              <h2 className="text-white text-xl font-semibold mb-1">Your website</h2>
              <p className="text-slate-400 text-sm mb-6">We&apos;ll analyze your business to identify AI opportunities</p>

              <div className="space-y-4">
                <div>
                  <label className="text-slate-300 text-sm font-medium block mb-1.5">Website URL</label>
                  <input
                    type="url"
                    placeholder="yourcompany.com"
                    value={form.companyUrl}
                    onChange={(e) => update('companyUrl', e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleStep1()}
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-[#C8A84B] transition-colors placeholder-slate-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 text-sm font-medium block mb-1.5">Company name</label>
                  <input
                    type="text"
                    placeholder="Acme Inc"
                    value={form.companyName}
                    onChange={(e) => update('companyName', e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleStep1()}
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-[#C8A84B] transition-colors placeholder-slate-500"
                  />
                </div>
              </div>

              {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

              <button
                onClick={handleStep1}
                className="w-full mt-6 bg-[#C8A84B] hover:bg-[#b8952e] text-[#0A1628] font-bold py-3.5 rounded-lg text-base transition-colors"
              >
                Analyze My Business →
              </button>
            </div>
          )}

          {/* Step 2: About your business */}
          {step === 2 && (
            <div>
              <h2 className="text-white text-xl font-semibold mb-1">Tell us about your business</h2>
              <p className="text-slate-400 text-sm mb-6">4 quick questions to calibrate your analysis</p>

              <div className="space-y-4">
                <div>
                  <label className="text-slate-300 text-sm font-medium block mb-1.5">Industry</label>
                  <select
                    value={form.industry}
                    onChange={(e) => update('industry', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-[#C8A84B] transition-colors"
                  >
                    <option value="">Select industry...</option>
                    {INDUSTRIES.map((i) => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 text-sm font-medium block mb-1.5">Team size</label>
                  <div className="grid grid-cols-2 gap-2">
                    {EMPLOYEE_RANGES.map((r) => (
                      <button
                        key={r.value}
                        onClick={() => update('employeeRange', r.value)}
                        className={`py-2.5 px-3 rounded-lg text-sm font-medium border transition-colors ${
                          form.employeeRange === r.value
                            ? 'bg-[#C8A84B] border-[#C8A84B] text-[#0A1628]'
                            : 'bg-slate-900 border-slate-600 text-slate-300 hover:border-slate-400'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-slate-300 text-sm font-medium block mb-1.5">
                    Biggest operational challenge right now
                  </label>
                  <textarea
                    placeholder="e.g. Manual reporting takes hours each week, proposals take too long, we lose track of follow-ups..."
                    value={form.biggestChallenge}
                    onChange={(e) => update('biggestChallenge', e.target.value)}
                    rows={3}
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-[#C8A84B] transition-colors placeholder-slate-500 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300 text-sm font-medium block mb-1.5">Your name</label>
                    <input
                      type="text"
                      placeholder="Jane Smith"
                      value={form.contactName}
                      onChange={(e) => update('contactName', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-[#C8A84B] transition-colors placeholder-slate-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 text-sm font-medium block mb-1.5">Work email</label>
                    <input
                      type="email"
                      placeholder="jane@company.com"
                      value={form.contactEmail}
                      onChange={(e) => update('contactEmail', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-[#C8A84B] transition-colors placeholder-slate-500"
                    />
                  </div>
                </div>
              </div>

              {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { setStep(1); setError(''); }}
                  className="px-5 py-3.5 border border-slate-600 text-slate-300 hover:text-white rounded-lg text-sm font-medium transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 bg-[#C8A84B] hover:bg-[#b8952e] text-[#0A1628] font-bold py-3.5 rounded-lg text-base transition-colors disabled:opacity-50"
                >
                  Generate My Snapshot →
                </button>
              </div>

              <p className="text-slate-500 text-xs text-center mt-3">
                Your email is only used to send your report. No spam.
              </p>
            </div>
          )}

          {/* Step 3: Processing */}
          {step === 3 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-6 relative">
                <div className="absolute inset-0 border-4 border-slate-700 rounded-full" />
                <div className="absolute inset-0 border-4 border-[#C8A84B] border-t-transparent rounded-full animate-spin" />
              </div>
              <h2 className="text-white text-xl font-semibold mb-2">Analyzing {form.companyName}...</h2>
              <p className="text-slate-400 text-sm">
                Researching your business, identifying workflows, and quantifying AI opportunities
              </p>
              <div className="mt-8 space-y-2 text-left max-w-xs mx-auto">
                {[
                  'Scraping website content...',
                  'Analyzing job signals & tech stack...',
                  'Benchmarking against industry peers...',
                  'Quantifying automation opportunities...',
                  'Generating your report...',
                ].map((msg, i) => (
                  <div key={i} className="flex items-center gap-2 text-slate-400 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#C8A84B] animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
                    {msg}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <p className="text-slate-600 text-xs text-center mt-4">
          Powered by Wex Advisory · AI analysis benchmarked against 12 industries
        </p>
      </div>
    </div>
  );
}
