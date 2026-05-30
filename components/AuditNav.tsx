'use client';

export default function AuditNav() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0A1628]/95 backdrop-blur border-b border-white/10">
      <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between">
        <a
          href="https://wexadvisory.com"
          className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          wexadvisory.com
        </a>

        <a href="/" className="flex items-center gap-2.5">
          {/* Double-V monogram: outer ∨ = W (white), inner ∧ = A (gold) */}
          <svg width="36" height="39" viewBox="0 0 110 115" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polyline points="5,12 55,95 105,12"
              stroke="white" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points="22,103 55,20 88,103"
              stroke="#C8A84B" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div className="flex flex-col leading-none gap-1">
            <span className="text-white font-bold text-base tracking-wide" style={{ fontFamily: 'Georgia, serif' }}>Wex</span>
            <span className="text-[#C8A84B] text-[8px] font-light tracking-[0.35em] uppercase">Advisory</span>
          </div>
        </a>

        <a
          href="https://calendly.com/maxwexley-wexadvisory/free-strategy-call"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-[#C8A84B] hover:bg-[#b8952e] text-[#0A1628] font-bold text-sm px-4 py-2 rounded-lg transition-colors"
        >
          Book a Call
        </a>
      </div>
    </header>
  );
}
