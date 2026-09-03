import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer';
import type { AuditReportData } from '@/types/audit';

const NAVY   = '#0A1628';
const GOLD   = '#C8A84B';
const LGRAY  = '#F1F5F9';
const MGRAY  = '#94A3B8';
const DGRAY  = '#475569';
const WHITE  = '#FFFFFF';
const GREEN  = '#22C55E';
const RED    = '#EF4444';

// All strings in this file must use ASCII only — Helvetica in react-pdf
// does not support non-ASCII glyphs (arrows, ≤, ×, etc. all render as garbage).
// Use: -> instead of →, <= instead of ≤, x instead of ×.

const s = StyleSheet.create({
  // ── Base pages ──────────────────────────────────────────────
  // paddingTop on the Page (not on each section) so react-pdf applies it to
  // auto-generated continuation pages too. No justifyContent: content must be
  // top-anchored — 'center' produced blank bands above short pages.
  page:      { backgroundColor: WHITE, fontFamily: 'Helvetica', paddingTop: 36, paddingBottom: 44 },
  coverPage: { backgroundColor: NAVY, fontFamily: 'Helvetica' },

  // ── Cover ───────────────────────────────────────────────────
  coverBody:     { padding: '48 48 32 48', flex: 1 },
  coverEyebrow:  { color: GOLD, fontSize: 9, letterSpacing: 2, marginBottom: 28 },
  coverTitle:    { color: WHITE, fontSize: 30, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  coverCompany:  { color: GOLD, fontSize: 22, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  coverUrl:      { color: MGRAY, fontSize: 10, marginBottom: 32 },

  coverSavingsBox:   { backgroundColor: 'rgba(200,168,75,0.12)', borderRadius: 8, padding: '20 22', marginBottom: 16, borderLeftWidth: 3, borderLeftColor: GOLD },
  coverSavingsLabel: { color: MGRAY, fontSize: 8, letterSpacing: 1.5, marginBottom: 6 },
  coverSavingsNum:   { color: GOLD, fontSize: 52, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  coverHeadline:     { color: WHITE, fontSize: 12, lineHeight: 1.5 },

  coverConfidence: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: '10 14', marginBottom: 20 },
  coverConfText:   { color: MGRAY, fontSize: 9, lineHeight: 1.6 },

  coverOppsLabel:  { color: GOLD, fontSize: 8, letterSpacing: 1.5, marginBottom: 10 },
  coverOppRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  coverOppRank:    { width: 20, height: 20, borderRadius: 10, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  coverOppRankTxt: { color: NAVY, fontSize: 8, fontFamily: 'Helvetica-Bold' },
  coverOppText:    { flex: 1, color: WHITE, fontSize: 9.5, lineHeight: 1.4 },
  coverOppSavings: { color: GREEN, fontSize: 10, fontFamily: 'Helvetica-Bold', marginLeft: 8 },

  coverFooter:     { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', padding: '14 48', flexDirection: 'row', justifyContent: 'space-between' },
  coverFooterTxt:  { color: MGRAY, fontSize: 8.5 },

  // ── Shared layout ────────────────────────────────────────────
  sec:      { padding: '0 40' },
  secLast:  { padding: '0 40 28 40' },
  eyebrow:  { color: GOLD, fontSize: 8, letterSpacing: 2, marginBottom: 4 },
  heading:  { color: NAVY, fontSize: 17, fontFamily: 'Helvetica-Bold', marginBottom: 14 },
  divider:  { height: 1, backgroundColor: LGRAY, margin: '16 40' },

  // ── Executive summary ─────────────────────────────────────────
  summaryHero:     { backgroundColor: LGRAY, borderRadius: 6, padding: 16, marginBottom: 14, borderLeftWidth: 3, borderLeftColor: GOLD },
  summaryHeroText: { color: NAVY, fontSize: 12, fontFamily: 'Helvetica-Bold', lineHeight: 1.45 },
  metricsRow:      { flexDirection: 'row', gap: 8, marginBottom: 14 },
  metricBox:       { flex: 1, backgroundColor: NAVY, borderRadius: 6, padding: '12 10', alignItems: 'center' },
  metricVal:       { color: GOLD, fontSize: 18, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  metricLbl:       { color: MGRAY, fontSize: 7.5, textAlign: 'center', letterSpacing: 0.3 },
  infoBox:         { backgroundColor: LGRAY, borderRadius: 6, padding: 12, marginBottom: 10 },
  infoLbl:         { color: DGRAY, fontSize: 7.5, fontFamily: 'Helvetica-Bold', letterSpacing: 1, marginBottom: 4 },
  infoTxt:         { color: NAVY, fontSize: 9.5, lineHeight: 1.5 },

  // ── Scorecard ────────────────────────────────────────────────
  scoreRow:        { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  scoreLbl:        { width: 145, color: NAVY, fontSize: 10, fontFamily: 'Helvetica-Bold' },
  scoreBar:        { flex: 1, height: 8, backgroundColor: LGRAY, borderRadius: 4, marginHorizontal: 8 },
  scoreBarFill:    { height: 8, borderRadius: 4 },
  scoreNum:        { width: 28, color: NAVY, fontSize: 11, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  scorePct:        { width: 52, color: DGRAY, fontSize: 8, textAlign: 'right' },
  scoreVerdict:    { color: DGRAY, fontSize: 9, lineHeight: 1.4, marginLeft: 153, marginBottom: 4 },
  scoreFactors:    { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginLeft: 153, marginBottom: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: LGRAY },
  scoreFactor:     { backgroundColor: LGRAY, borderRadius: 3, paddingHorizontal: 6, paddingVertical: 2 },
  scoreFactorTxt:  { color: DGRAY, fontSize: 7.5 },

  // ── Opportunity card (compact — fits ~2 per page) ─────────────
  oppCard:     { marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 7, overflow: 'hidden' },
  oppHeader:   { backgroundColor: NAVY, padding: '9 12', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  oppTitle:    { color: WHITE, fontSize: 10, fontFamily: 'Helvetica-Bold', flex: 1, marginRight: 8, lineHeight: 1.35 },
  oppBadges:   { flexDirection: 'row', gap: 4, flexShrink: 0 },
  oppBadge:    { borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2 },
  oppBadgeTxt: { fontSize: 7, fontFamily: 'Helvetica-Bold' },
  oppBody:     { padding: '10 12' },

  oppCols:     { flexDirection: 'row', gap: 10, marginBottom: 10 },
  oppCol:      { flex: 1 },
  oppColLbl:   { color: DGRAY, fontSize: 7, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5, marginBottom: 3 },
  oppColTxt:   { color: NAVY, fontSize: 8.5, lineHeight: 1.45 },

  mathBox:     { backgroundColor: '#EFF6FF', borderRadius: 5, padding: '8 10', marginBottom: 9, borderLeftWidth: 2, borderLeftColor: '#3B82F6' },
  mathLbl:     { color: '#1E40AF', fontSize: 7, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5, marginBottom: 4 },
  mathFormula: { color: NAVY, fontSize: 8.5, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  mathResult:  { color: GREEN, fontSize: 10, fontFamily: 'Helvetica-Bold' },
  mathNote:    { color: DGRAY, fontSize: 7.5, marginTop: 3 },

  implRow:     { flexDirection: 'row', gap: 5, marginBottom: 8 },
  implPill:    { flex: 1, backgroundColor: LGRAY, borderRadius: 4, padding: '5 6', alignItems: 'center' },
  implLbl:     { color: DGRAY, fontSize: 6.5, letterSpacing: 0.2 },
  implVal:     { color: NAVY, fontSize: 9, fontFamily: 'Helvetica-Bold', marginTop: 1 },

  toolsRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  toolPill:    { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 3, paddingHorizontal: 6, paddingVertical: 2 },
  toolPillTxt: { color: '#1D4ED8', fontSize: 7 },

  // ── Roadmap ──────────────────────────────────────────────────
  phaseCols:    { flexDirection: 'row', width: '100%', alignItems: 'flex-start' },
  phaseBox:     { width: '32%', marginRight: '2%', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 6, overflow: 'hidden' },
  phaseHead:    { padding: '8 10', alignItems: 'center' },
  phaseTitle:   { color: WHITE, fontSize: 8.5, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },
  phaseDur:     { color: 'rgba(255,255,255,0.7)', fontSize: 7.5, marginTop: 1 },
  phaseBody:    { padding: '8 10' },
  phaseItem:    { marginBottom: 6, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: LGRAY },
  phaseItemLast:{ marginBottom: 0, paddingBottom: 0, borderBottomWidth: 0 },
  phaseItemTtl: { color: NAVY, fontSize: 8, fontFamily: 'Helvetica-Bold', marginBottom: 1 },
  phaseItemTxt: { color: DGRAY, fontSize: 7.5, lineHeight: 1.4 },
  phaseTotals:  { borderTopWidth: 1, borderTopColor: '#E2E8F0', padding: '7 10' },
  phaseTotRow:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  phaseTotLbl:  { color: DGRAY, fontSize: 7.5 },
  phaseTotVal:  { color: NAVY, fontSize: 8, fontFamily: 'Helvetica-Bold' },

  // ── Next steps + CTA ─────────────────────────────────────────
  stepItem:    { flexDirection: 'row', gap: 8, marginBottom: 7 },
  stepBullet:  { color: GOLD, fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: -2 },
  stepTxt:     { color: NAVY, fontSize: 9.5, flex: 1, lineHeight: 1.5 },
  ctaBox:      { backgroundColor: NAVY, borderRadius: 8, padding: '20 24', alignItems: 'center' },
  ctaTitle:    { color: WHITE, fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 6, textAlign: 'center' },
  ctaBody:     { color: MGRAY, fontSize: 9, textAlign: 'center', marginBottom: 14, lineHeight: 1.5 },
  ctaBtn:      { backgroundColor: GOLD, borderRadius: 5, paddingHorizontal: 18, paddingVertical: 9 },
  ctaBtnTxt:   { color: NAVY, fontSize: 10.5, fontFamily: 'Helvetica-Bold' },
  ctaMeta:     { color: MGRAY, fontSize: 7.5, marginTop: 8 },

  // ── Page footer (fixed) ──────────────────────────────────────
  footer:      { position: 'absolute', bottom: 16, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between' },
  footerTxt:   { color: MGRAY, fontSize: 7.5 },
  footerGold:  { color: GOLD, fontSize: 7.5, fontFamily: 'Helvetica-Bold' },
});

// ── Helpers ────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000)    return `$${Math.round(n / 1000)}K`;
  return `$${n.toLocaleString()}`;
}

function barColor(score: number) {
  if (score >= 65) return GREEN;
  if (score >= 40) return GOLD;
  return RED;
}

function confStyle(level: string) {
  if (level === 'high')   return { bg: '#DCFCE7', txt: '#15803D' };
  if (level === 'medium') return { bg: '#FEF9C3', txt: '#854D0E' };
  return { bg: '#FEE2E2', txt: '#991B1B' };
}

function phaseColor(n: number) {
  if (n === 1) return '#15803D';
  if (n === 2) return '#1D4ED8';
  return '#7C3AED';
}

function Footer({ company }: { company: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerTxt}>{company} — AI Opportunity Snapshot</Text>
      <Text style={s.footerGold}>Wex Advisory · wexadvisory.com</Text>
    </View>
  );
}

// ── Main component ─────────────────────────────────────────────

interface Props {
  companyName: string;
  companyUrl: string;
  report: AuditReportData;
  generatedDate: string;
}

function OpportunityCard({ opp, idx }: { opp: AuditReportData['opportunities'][number]; idx: number }) {
  const cs = confStyle(opp.confidenceLevel);
  const laborCost = opp.hoursPerMonth * opp.fullyLoadedHourlyRate * opp.fteCountAffected * 12;
  return (
    <View style={s.oppCard} wrap={false}>
      <View style={s.oppHeader}>
        <Text style={s.oppTitle}>
          {idx + 1}. {opp.title}
        </Text>
        <View style={s.oppBadges}>
          <View style={[s.oppBadge, { backgroundColor: cs.bg }]}>
            <Text style={[s.oppBadgeTxt, { color: cs.txt }]}>
              {opp.confidenceLevel === 'high' ? 'HIGH' : 'MED'} CONFIDENCE
            </Text>
          </View>
          {opp.quickWin && (
            <View style={[s.oppBadge, { backgroundColor: GOLD }]}>
              <Text style={[s.oppBadgeTxt, { color: NAVY }]}>QUICK WIN</Text>
            </View>
          )}
          <View style={[s.oppBadge, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
            <Text style={[s.oppBadgeTxt, { color: WHITE }]}>{opp.department}</Text>
          </View>
        </View>
      </View>

      <View style={s.oppBody}>
        <View style={s.oppCols}>
          <View style={s.oppCol}>
            <Text style={s.oppColLbl}>CURRENT MANUAL PROCESS</Text>
            <Text style={s.oppColTxt}>{opp.workflowDescription}</Text>
          </View>
          <View style={{ width: 1, backgroundColor: LGRAY }} />
          <View style={s.oppCol}>
            <Text style={s.oppColLbl}>AUTOMATED VERSION</Text>
            <Text style={s.oppColTxt}>{opp.opportunityDescription}</Text>
          </View>
        </View>

        <View style={s.mathBox}>
          <Text style={s.mathLbl}>SAVINGS CALCULATION</Text>
          <Text style={s.mathFormula}>
            {opp.hoursPerMonth} hrs/mo  x  ${opp.fullyLoadedHourlyRate}/hr  x  {opp.fteCountAffected} FTE{opp.fteCountAffected !== 1 ? 's' : ''}  x  {opp.automationCeilingPct}% automation  x  12 months
          </Text>
          <Text style={s.mathResult}>= {fmt(opp.annualSavings)} / year</Text>
          <Text style={s.mathNote}>
            Annual labor cost at risk: {fmt(laborCost)}  |  {opp.automationCeilingPct}% can be automated
          </Text>
        </View>

        <View style={s.implRow}>
          <View style={s.implPill}>
            <Text style={s.implLbl}>COMPLEXITY</Text>
            <Text style={s.implVal}>{opp.complexity.charAt(0).toUpperCase() + opp.complexity.slice(1)}</Text>
          </View>
          <View style={s.implPill}>
            <Text style={s.implLbl}>TIMELINE</Text>
            <Text style={s.implVal}>{opp.implementationWeeks} weeks</Text>
          </View>
          <View style={s.implPill}>
            <Text style={s.implLbl}>INVESTMENT</Text>
            <Text style={s.implVal}>${opp.implementationCostLow.toLocaleString()}–${opp.implementationCostHigh.toLocaleString()}</Text>
          </View>
          <View style={s.implPill}>
            <Text style={s.implLbl}>PAYBACK</Text>
            <Text style={[s.implVal, { color: GREEN }]}>{opp.roiMonths} months</Text>
          </View>
        </View>

        {(opp.recommendedTools?.length ?? 0) > 0 && (
          <View>
            <Text style={[s.oppColLbl, { marginBottom: 4 }]}>RECOMMENDED TOOLS</Text>
            <View style={s.toolsRow}>
              {opp.recommendedTools.map((t, i) => (
                <View key={i} style={s.toolPill}>
                  <Text style={s.toolPillTxt}>{t.name} — {t.purpose}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

function Roadmap({ implementationRoadmap }: { implementationRoadmap: AuditReportData['implementationRoadmap'] }) {
  return (
    <View style={s.phaseCols}>
      {([
        [1, 'Quick Wins',  implementationRoadmap.phase1],
        [2, 'Foundation', implementationRoadmap.phase2],
        [3, 'Scale',      implementationRoadmap.phase3],
      ] as [number, string, typeof implementationRoadmap.phase1][]).map(([num, label, phase], i) => (
        <View key={num} style={i === 2 ? [s.phaseBox, { marginRight: 0 }] : s.phaseBox}>
          <View style={[s.phaseHead, { backgroundColor: phaseColor(num) }]}>
            <Text style={s.phaseTitle}>{label.toUpperCase()}</Text>
            <Text style={s.phaseDur}>{phase.durationWeeks} weeks</Text>
          </View>
          <View style={s.phaseBody}>
            {(phase.items ?? []).map((item, i, arr) => (
              <View key={i} style={i === arr.length - 1 ? s.phaseItemLast : s.phaseItem}>
                <Text style={s.phaseItemTtl}>{item.title}</Text>
                <Text style={s.phaseItemTxt}>{item.description}</Text>
              </View>
            ))}
          </View>
          <View style={s.phaseTotals}>
            <View style={s.phaseTotRow}>
              <Text style={s.phaseTotLbl}>Investment</Text>
              <Text style={s.phaseTotVal}>{fmt(phase.totalInvestment)}</Text>
            </View>
            <View style={s.phaseTotRow}>
              <Text style={s.phaseTotLbl}>Annual Savings</Text>
              <Text style={[s.phaseTotVal, { color: GREEN }]}>{fmt(phase.totalSavings)}</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

function NextStepsCta({ nextSteps }: { nextSteps: AuditReportData['nextSteps'] }) {
  return (
    <View style={s.secLast}>
      <Text style={s.eyebrow}>NEXT STEPS</Text>
      <Text style={[s.heading, { marginBottom: 10 }]}>What to Do This Week</Text>

      <View style={{ marginBottom: 16 }}>
        {(nextSteps.immediate ?? []).map((step, i) => (
          <View key={i} style={s.stepItem}>
            <Text style={s.stepBullet}>-&gt;</Text>
            <Text style={s.stepTxt}>{step}</Text>
          </View>
        ))}
      </View>

      <View style={s.ctaBox}>
        <Text style={s.ctaTitle}>Ready to implement?</Text>
        <Text style={s.ctaBody}>
          Book a free 30-minute strategy call. We will walk through your results, prioritize
          the quick wins, and map out exactly what a Wex Advisory engagement would look like.
        </Text>
        <View style={s.ctaBtn}>
          <Text style={s.ctaBtnTxt}>calendly.com/maxwexley-wexadvisory/free-strategy-call</Text>
        </View>
        <Text style={s.ctaMeta}>No sales pressure  |  30 minutes  |  Walk through your results together</Text>
      </View>
    </View>
  );
}

function SnapshotPDF({ companyName, companyUrl, report, generatedDate }: Props) {
  const { executiveSummary, scores, opportunities, implementationRoadmap, nextSteps } = report;
  const top3 = opportunities.slice(0, 3);

  // Explicit pagination — 2 opportunity cards per page, then the roadmap and
  // next steps always start a fresh page. An earlier version folded the
  // roadmap onto the last opportunities page whenever that page held a lone
  // card; the roadmap's height depends on LLM output, and when it didn't fit
  // react-pdf split the 3-column row mid-column, leaving one column's totals
  // alone on an otherwise blank page. Folding only moves the tail whitespace
  // between pages anyway, so the deterministic layout wins.
  const oppPages: typeof opportunities[] = [];
  for (let i = 0; i < opportunities.length; i += 2) {
    oppPages.push(opportunities.slice(i, i + 2));
  }

  return (
    <Document
      title={`AI Opportunity Snapshot — ${companyName}`}
      author="Wex Advisory"
      subject="AI Automation Opportunity Analysis"
    >

      {/* ── PAGE 1: COVER ─────────────────────────────────────── */}
      <Page size="A4" style={s.coverPage}>
        <View style={s.coverBody}>
          <Text style={s.coverEyebrow}>WEX ADVISORY  |  CONFIDENTIAL</Text>
          <Text style={s.coverTitle}>AI Opportunity{'\n'}Snapshot</Text>
          <Text style={s.coverCompany}>{companyName}</Text>
          <Text style={s.coverUrl}>{companyUrl}</Text>

          {/* Big savings number */}
          <View style={s.coverSavingsBox}>
            <Text style={s.coverSavingsLabel}>ESTIMATED ANNUAL SAVINGS POTENTIAL</Text>
            <Text style={s.coverSavingsNum}>{fmt(executiveSummary.totalAnnualSavings)}</Text>
            <Text style={s.coverHeadline}>{executiveSummary.headline}</Text>
          </View>

          {/* Confidence statement */}
          <View style={s.coverConfidence}>
            <Text style={s.coverConfText}>{executiveSummary.confidenceStatement}</Text>
          </View>

          {/* Top 3 opportunities preview */}
          {top3.length > 0 && (
            <View>
              <Text style={s.coverOppsLabel}>TOP OPPORTUNITIES IDENTIFIED</Text>
              {top3.map((opp, i) => (
                <View key={opp.id} style={s.coverOppRow}>
                  <View style={s.coverOppRank}>
                    <Text style={s.coverOppRankTxt}>{i + 1}</Text>
                  </View>
                  <Text style={s.coverOppText}>{opp.title}</Text>
                  <Text style={s.coverOppSavings}>{fmt(opp.annualSavings)}/yr</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={s.coverFooter}>
          <Text style={s.coverFooterTxt}>Generated {generatedDate}</Text>
          <Text style={s.coverFooterTxt}>Prepared by Wex Advisory · wexadvisory.com</Text>
        </View>
      </Page>

      {/* ── PAGE 2: EXECUTIVE SUMMARY ─────────────────────────── */}
      <Page size="A4" style={s.page}>
        <View style={s.sec}>
          <Text style={s.eyebrow}>EXECUTIVE SUMMARY</Text>
          <Text style={s.heading}>What We Found</Text>

          <View style={s.summaryHero}>
            <Text style={s.summaryHeroText}>{executiveSummary.headline}</Text>
          </View>

          <View style={s.metricsRow}>
            <View style={s.metricBox}>
              <Text style={s.metricVal}>{fmt(executiveSummary.totalAnnualSavings)}</Text>
              <Text style={s.metricLbl}>TOTAL ANNUAL SAVINGS</Text>
            </View>
            <View style={s.metricBox}>
              <Text style={s.metricVal}>{fmt(executiveSummary.quickWinSavings)}</Text>
              <Text style={s.metricLbl}>QUICK WINS (&lt;= 4 WKS)</Text>
            </View>
            <View style={s.metricBox}>
              <Text style={s.metricVal}>{opportunities.filter(o => o.quickWin).length}</Text>
              <Text style={s.metricLbl}>QUICK WIN OPPORTUNITIES</Text>
            </View>
          </View>

          <View style={s.infoBox}>
            <Text style={s.infoLbl}>WHY ACT NOW</Text>
            <Text style={s.infoTxt}>{executiveSummary.urgencyNote}</Text>
          </View>

          <View style={s.infoBox}>
            <Text style={s.infoLbl}>METHODOLOGY</Text>
            <Text style={s.infoTxt}>
              This analysis was produced by scraping {companyUrl}, reviewing job postings and public signals,
              detecting your technology stack, and benchmarking against industry peers. Savings estimates use
              the formula: hours/month x fully-loaded hourly rate x affected FTEs x automation ceiling % x 12
              months. Confidence factors (High/Medium) are applied to reflect signal quality.
            </Text>
          </View>

          <View style={s.infoBox}>
            <Text style={s.infoLbl}>DATA SOURCES</Text>
            <Text style={s.infoTxt}>
              Website content  |  Job posting signals  |  Public review sites  |  Technology detection  |
              Industry wage benchmarks (BLS Occupational Outlook)  |  Peer-company performance benchmarks
            </Text>
          </View>
        </View>
        <Footer company={companyName} />
      </Page>

      {/* ── PAGE 3: AI MATURITY SCORECARD ─────────────────────── */}
      <Page size="A4" style={s.page}>
        <View style={s.sec}>
          <Text style={s.eyebrow}>AI MATURITY SCORECARD</Text>
          <Text style={s.heading}>How You Compare to Industry Peers</Text>

          {([
            ['AI Readiness',         scores.aiReadiness],
            ['Automation Opportunity',scores.automationOpportunity],
            ['Data Visibility',      scores.dataVisibility],
            ['Revenue Acceleration', scores.revenueAcceleration],
            ['Overall Maturity',     scores.overallMaturity],
          ] as [string, typeof scores.aiReadiness][]).map(([label, sc]) => (
            <View key={label}>
              <View style={s.scoreRow}>
                <Text style={s.scoreLbl}>{label}</Text>
                <View style={s.scoreBar}>
                  <View style={[s.scoreBarFill, { width: `${sc.score}%`, backgroundColor: barColor(sc.score) }]} />
                </View>
                <Text style={s.scoreNum}>{sc.score}</Text>
                <Text style={s.scorePct}>Top {100 - sc.percentile}%</Text>
              </View>
              <Text style={s.scoreVerdict}>{sc.verdict}</Text>
              {'topFactors' in sc && (
                <View style={s.scoreFactors}>
                  {(sc as { topFactors: string[] }).topFactors.map((f, i) => (
                    <View key={i} style={s.scoreFactor}>
                      <Text style={s.scoreFactorTxt}>{f}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
        <Footer company={companyName} />
      </Page>

      {/* ── PAGES 4+: OPPORTUNITIES (explicit pagination — 2 per page) ── */}
      {oppPages.map((group, pageIdx) => {
        return (
          <Page size="A4" style={s.page} key={pageIdx}>
            <View style={s.sec}>
              <Text style={s.eyebrow}>AI OPPORTUNITIES{pageIdx > 0 ? ' (CONTINUED)' : ''}</Text>
              <Text style={s.heading}>Ranked by Annual Savings</Text>
              {group.map((opp, i) => (
                <OpportunityCard key={opp.id} opp={opp} idx={pageIdx * 2 + i} />
              ))}
            </View>

            <Footer company={companyName} />
          </Page>
        );
      })}

      {/* ── ROADMAP + NEXT STEPS ──────────────────────────────── */}
      <Page size="A4" style={s.page}>
        <View style={s.sec}>
          <Text style={s.eyebrow}>IMPLEMENTATION PLAN</Text>
          <Text style={s.heading}>Your 3-Phase Roadmap</Text>
          <Roadmap implementationRoadmap={implementationRoadmap} />
        </View>
        <View style={s.divider} />
        {/* wrap={false}: if a tall roadmap leaves too little room, the whole
            CTA block moves to the next page instead of splitting. The divider
            trails the roadmap, so the moved block never starts with a rule. */}
        <View wrap={false}>
          <NextStepsCta nextSteps={nextSteps} />
        </View>
        <Footer company={companyName} />
      </Page>

    </Document>
  );
}

export async function generateSnapshotPDF(
  companyName: string,
  companyUrl: string,
  report: AuditReportData,
): Promise<Buffer> {
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const el = React.createElement(SnapshotPDF, { companyName, companyUrl, report, generatedDate: date }) as any;
  return renderToBuffer(el) as Promise<Buffer>;
}
