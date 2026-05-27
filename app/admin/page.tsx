'use client';

import { useEffect, useState } from 'react';

interface AuditRow {
  id: string;
  company_name: string;
  contact_email: string;
  industry: string;
  employee_count_estimate: string;
  status: string;
  lead_status: string;
  report_data: { executiveSummary?: { totalAnnualSavings?: number } } | null;
  scores: { overallMaturity?: { score?: number } } | null;
  created_at: string;
}

const LEAD_STATUS_OPTIONS = ['new', 'emailed', 'contacted', 'proposal', 'client', 'dead'];
const LEAD_STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-900/40 text-blue-300',
  emailed: 'bg-slate-700 text-slate-300',
  contacted: 'bg-yellow-900/40 text-yellow-300',
  proposal: 'bg-purple-900/40 text-purple-300',
  client: 'bg-green-900/40 text-green-300',
  dead: 'bg-red-900/40 text-red-300',
};

export default function AdminPage() {
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState('');

  function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    if (password === (process.env.NEXT_PUBLIC_ADMIN_HINT ?? 'wexadmin2025')) {
      setAuthed(true);
      localStorage.setItem('admin_token', password);
    } else {
      setAuthError('Incorrect password');
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem('admin_token');
    if (saved) setAuthed(true);
  }, []);

  useEffect(() => {
    if (!authed) return;
    fetchAudits();
  }, [authed]);

  async function fetchAudits() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/audits');
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setAudits(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function updateLeadStatus(id: string, leadStatus: string) {
    const token = localStorage.getItem('admin_token') ?? '';
    await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ lead_status: leadStatus }),
    });
    setAudits((prev) =>
      prev.map((a) => (a.id === id ? { ...a, lead_status: leadStatus } : a))
    );
  }

  const filtered = filter === 'all' ? audits : audits.filter((a) => a.lead_status === filter);

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#0A1628] flex items-center justify-center">
        <form onSubmit={handleAuth} className="bg-slate-800 border border-slate-700 rounded-2xl p-8 w-80">
          <h2 className="text-white font-bold text-xl mb-6">Admin Access</h2>
          <input
            type="password"
            placeholder="Admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-4 py-3 mb-3"
          />
          {authError && <p className="text-red-400 text-sm mb-3">{authError}</p>}
          <button type="submit" className="w-full bg-[#C8A84B] text-[#0A1628] font-bold py-3 rounded-lg">
            Sign In
          </button>
        </form>
      </div>
    );
  }

  const totalSavings = audits
    .filter((a) => a.status === 'complete')
    .reduce((sum, a) => sum + (a.report_data?.executiveSummary?.totalAnnualSavings ?? 0), 0);

  const clients = audits.filter((a) => a.lead_status === 'client').length;
  const newLeads = audits.filter((a) => a.lead_status === 'new').length;

  return (
    <div className="min-h-screen bg-[#0A1628] px-6 py-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="text-[#C8A84B] text-sm font-semibold tracking-wider uppercase mb-1">Wex Advisory</div>
            <h1 className="text-white text-2xl font-bold">AI Audit Leads</h1>
          </div>
          <button
            onClick={fetchAudits}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Audits', value: audits.length },
            { label: 'New Leads', value: newLeads },
            { label: 'Clients', value: clients },
            { label: 'Total Savings Identified', value: `$${(totalSavings / 1000).toFixed(0)}K` },
          ].map((s) => (
            <div key={s.label} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <div className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-1">{s.label}</div>
              <div className="text-white text-2xl font-bold">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4">
          {['all', ...LEAD_STATUS_OPTIONS].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-[#C8A84B] text-[#0A1628]'
                  : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center text-slate-400 py-20">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-slate-400 py-20">No audits yet</div>
        ) : (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  {['Company', 'Contact', 'Industry', 'Size', 'Savings', 'Score', 'Status', 'Lead', 'Date'].map((h) => (
                    <th key={h} className="text-left text-slate-400 font-medium px-4 py-3 text-xs uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filtered.map((audit) => (
                  <tr key={audit.id} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-3 text-white font-medium">{audit.company_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <a href={`mailto:${audit.contact_email}`} className="text-[#C8A84B] hover:underline text-xs">
                        {audit.contact_email}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{audit.industry ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{audit.employee_count_estimate ?? '—'}</td>
                    <td className="px-4 py-3 text-green-400 font-semibold">
                      {audit.report_data?.executiveSummary?.totalAnnualSavings
                        ? `$${(audit.report_data.executiveSummary.totalAnnualSavings / 1000).toFixed(0)}K`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-white">
                      {audit.scores?.overallMaturity?.score ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        audit.status === 'complete' ? 'bg-green-900/40 text-green-300' :
                        audit.status === 'failed' ? 'bg-red-900/40 text-red-300' :
                        'bg-yellow-900/40 text-yellow-300'
                      }`}>
                        {audit.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={audit.lead_status}
                        onChange={(e) => updateLeadStatus(audit.id, e.target.value)}
                        className={`text-xs rounded px-2 py-1 border-0 cursor-pointer ${LEAD_STATUS_COLORS[audit.lead_status] ?? 'bg-slate-700 text-slate-300'}`}
                      >
                        {LEAD_STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s} className="bg-slate-900 text-white">{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {new Date(audit.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
