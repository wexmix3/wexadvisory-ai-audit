import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer';
import type { ProposalContent } from '@/types/audit';

// All strings must use ASCII only -- Helvetica does not support non-ASCII glyphs.
// Use -> instead of ->, * instead of bullets, etc.

const NAVY  = '#0A1628';
const GOLD  = '#C8A84B';
const LGRAY = '#F1F5F9';
const MGRAY = '#94A3B8';
const DGRAY = '#475569';
const WHITE = '#FFFFFF';
const GREEN = '#16A34A';

const s = StyleSheet.create({
  page:     { backgroundColor: WHITE, fontFamily: 'Helvetica', paddingBottom: 48 },
  cover:    { backgroundColor: NAVY, fontFamily: 'Helvetica' },

  // Cover
  coverBody:    { padding: '56 48 40 48', flex: 1 },
  coverEyebrow: { color: GOLD, fontSize: 8, letterSpacing: 2, marginBottom: 32 },
  coverType:    { color: MGRAY, fontSize: 10, letterSpacing: 1, marginBottom: 8 },
  coverTitle:   { color: WHITE, fontSize: 28, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  coverCompany: { color: GOLD, fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  coverUrl:     { color: MGRAY, fontSize: 9, marginBottom: 40 },

  coverSavingsBox:   { backgroundColor: 'rgba(200,168,75,0.10)', borderRadius: 6, padding: '18 20', marginBottom: 20, borderLeftWidth: 3, borderLeftColor: GOLD },
  coverSavingsLabel: { color: MGRAY, fontSize: 8, letterSpacing: 1.5, marginBottom: 4 },
  coverSavingsNum:   { color: GOLD, fontSize: 44, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  coverSummary:      { color: WHITE, fontSize: 11, lineHeight: 1.6 },

  coverMeta:     { marginTop: 32 },
  coverMetaRow:  { flexDirection: 'row', marginBottom: 6 },
  coverMetaKey:  { color: MGRAY, fontSize: 9, width: 100 },
  coverMetaVal:  { color: WHITE, fontSize: 9 },

  coverFooter:    { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)', padding: '14 48', flexDirection: 'row', justifyContent: 'space-between' },
  coverFooterTxt: { color: MGRAY, fontSize: 8 },

  // Shared layout
  sec:     { padding: '32 44 0 44' },
  secLast: { padding: '28 44 36 44' },
  eyebrow: { color: GOLD, fontSize: 8, letterSpacing: 2, marginBottom: 6 },
  heading: { color: NAVY, fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 16 },
  divider: { height: 1, backgroundColor: LGRAY, margin: '20 44' },
  body:    { color: DGRAY, fontSize: 10, lineHeight: 1.7 },

  // Footer
  footer:     { position: 'absolute', bottom: 16, left: 44, right: 44, flexDirection: 'row', justifyContent: 'space-between' },
  footerTxt:  { color: MGRAY, fontSize: 8 },

  // Exec summary
  summaryBox: { backgroundColor: LGRAY, borderRadius: 6, padding: '16 20', marginBottom: 8 },

  // Opportunity cards
  oppCard:       { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 6, marginBottom: 14, overflow: 'hidden' },
  oppHeader:     { backgroundColor: NAVY, padding: '10 16', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  oppHeaderLeft: { flex: 1 },
  oppNum:        { color: GOLD, fontSize: 8, letterSpacing: 1.5, marginBottom: 2 },
  oppTitle:      { color: WHITE, fontSize: 11, fontFamily: 'Helvetica-Bold' },
  oppSavings:    { color: GREEN, fontSize: 13, fontFamily: 'Helvetica-Bold' },
  oppBody:       { padding: '12 16' },
  oppLabel:      { color: GOLD, fontSize: 7.5, letterSpacing: 1, marginBottom: 3, marginTop: 8 },
  oppText:       { color: DGRAY, fontSize: 9.5, lineHeight: 1.6 },
  oppMeta:       { flexDirection: 'row', marginTop: 10, gap: 16 },
  oppMetaItem:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  oppMetaKey:    { color: MGRAY, fontSize: 8.5 },
  oppMetaVal:    { color: NAVY, fontSize: 8.5, fontFamily: 'Helvetica-Bold' },

  // Engagement section
  engRow:     { flexDirection: 'row', marginBottom: 10, gap: 24 },
  engBox:     { flex: 1, backgroundColor: LGRAY, borderRadius: 6, padding: '14 16' },
  engLabel:   { color: GOLD, fontSize: 7.5, letterSpacing: 1, marginBottom: 4 },
  engValue:   { color: NAVY, fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  engSub:     { color: DGRAY, fontSize: 9 },
  scopeItem:  { flexDirection: 'row', marginBottom: 5 },
  scopeBullet:{ color: GOLD, fontSize: 10, marginRight: 6, marginTop: 1 },
  scopeText:  { color: DGRAY, fontSize: 10, flex: 1, lineHeight: 1.5 },
  timelineBox:{ backgroundColor: LGRAY, borderRadius: 6, padding: '12 16', marginTop: 10 },
  retainerBox:{ borderLeftWidth: 3, borderLeftColor: GOLD, paddingLeft: 12, marginTop: 14 },

  // CTA
  ctaBox:  { backgroundColor: NAVY, borderRadius: 6, padding: '20 24', marginTop: 8 },
  ctaHead: { color: GOLD, fontSize: 8, letterSpacing: 1.5, marginBottom: 6 },
  ctaText: { color: WHITE, fontSize: 11, lineHeight: 1.6, marginBottom: 12 },
  ctaLink: { color: GOLD, fontSize: 10, fontFamily: 'Helvetica-Bold' },
  ctaSig:  { color: MGRAY, fontSize: 9, marginTop: 14, lineHeight: 1.5 },
});

function Footer({ companyName, page }: { companyName: string; page: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerTxt}>Wex Advisory -- Confidential Proposal -- {companyName}</Text>
      <Text style={s.footerTxt}>{page}</Text>
    </View>
  );
}

function CoverPage({ content }: { content: ProposalContent }) {
  const totalSavings = content.opportunities.reduce((sum, o) => sum + o.estimatedSavings, 0);
  const savingsStr = totalSavings >= 1000000
    ? `$${(totalSavings / 1000000).toFixed(1)}M`
    : `$${Math.round(totalSavings / 1000)}K`;

  return (
    <Page size="LETTER" style={s.cover}>
      <View style={s.coverBody}>
        <Text style={s.coverEyebrow}>WEX ADVISORY</Text>
        <Text style={s.coverType}>CONSULTING PROPOSAL</Text>
        <Text style={s.coverTitle}>AI Automation{'\n'}Engagement</Text>
        <Text style={s.coverCompany}>{content.companyName}</Text>
        <Text style={s.coverUrl}>{content.companyUrl}</Text>

        <View style={s.coverSavingsBox}>
          <Text style={s.coverSavingsLabel}>IDENTIFIED ANNUAL SAVINGS</Text>
          <Text style={s.coverSavingsNum}>{savingsStr}</Text>
          <Text style={s.coverSummary}>{content.executiveSummary}</Text>
        </View>

        <View style={s.coverMeta}>
          <View style={s.coverMetaRow}>
            <Text style={s.coverMetaKey}>Prepared for</Text>
            <Text style={s.coverMetaVal}>{content.contactFirstName} -- {content.companyName}</Text>
          </View>
          <View style={s.coverMetaRow}>
            <Text style={s.coverMetaKey}>Prepared by</Text>
            <Text style={s.coverMetaVal}>Max Wexley, Wex Advisory</Text>
          </View>
          <View style={s.coverMetaRow}>
            <Text style={s.coverMetaKey}>Date</Text>
            <Text style={s.coverMetaVal}>{content.preparedDate}</Text>
          </View>
          <View style={s.coverMetaRow}>
            <Text style={s.coverMetaKey}>Opportunities</Text>
            <Text style={s.coverMetaVal}>{content.opportunities.length} identified</Text>
          </View>
        </View>
      </View>
      <View style={s.coverFooter}>
        <Text style={s.coverFooterTxt}>Confidential -- prepared exclusively for {content.companyName}</Text>
        <Text style={s.coverFooterTxt}>wexadvisory.com</Text>
      </View>
    </Page>
  );
}

function ExecutiveSummaryPage({ content }: { content: ProposalContent }) {
  return (
    <Page size="LETTER" style={s.page}>
      <View style={s.sec}>
        <Text style={s.eyebrow}>SECTION 01</Text>
        <Text style={s.heading}>Executive Summary</Text>
        <View style={s.summaryBox}>
          <Text style={s.body}>{content.executiveSummary}</Text>
        </View>
        <Text style={[s.body, { marginTop: 14 }]}>
          This proposal outlines a phased engagement to implement the {content.opportunities.length} highest-impact
          automation opportunities identified in your AI Opportunity Audit. Each opportunity has been
          scoped for implementation feasibility, cost-effectiveness, and measurable ROI within a 90-day
          window.
        </Text>
        <Text style={[s.body, { marginTop: 12 }]}>
          Wex Advisory will serve as your dedicated implementation partner -- handling tool selection,
          workflow design, build, and testing. Ongoing support is available via monthly retainer.
        </Text>
      </View>
      <Footer companyName={content.companyName} page="2" />
    </Page>
  );
}

function OpportunitiesPage({ content }: { content: ProposalContent }) {
  return (
    <Page size="LETTER" style={s.page}>
      <View style={s.sec}>
        <Text style={s.eyebrow}>SECTION 02</Text>
        <Text style={s.heading}>Priority Opportunities</Text>
        {content.opportunities.map((opp, i) => (
          <View key={i} style={s.oppCard}>
            <View style={s.oppHeader}>
              <View style={s.oppHeaderLeft}>
                <Text style={s.oppNum}>OPPORTUNITY {String(i + 1).padStart(2, '0')}</Text>
                <Text style={s.oppTitle}>{opp.title}</Text>
              </View>
              <Text style={s.oppSavings}>
                ${opp.estimatedSavings >= 1000
                  ? `${Math.round(opp.estimatedSavings / 1000)}K`
                  : opp.estimatedSavings.toLocaleString()}/yr
              </Text>
            </View>
            <View style={s.oppBody}>
              <Text style={s.oppLabel}>CURRENT STATE</Text>
              <Text style={s.oppText}>{opp.currentState}</Text>
              <Text style={s.oppLabel}>PROPOSED APPROACH</Text>
              <Text style={s.oppText}>{opp.proposedApproach}</Text>
              <View style={s.oppMeta}>
                <View style={s.oppMetaItem}>
                  <Text style={s.oppMetaKey}>Timeline:</Text>
                  <Text style={s.oppMetaVal}>{opp.timelineWeeks} weeks</Text>
                </View>
                <View style={s.oppMetaItem}>
                  <Text style={s.oppMetaKey}>Annual savings:</Text>
                  <Text style={s.oppMetaVal}>${opp.estimatedSavings.toLocaleString()}</Text>
                </View>
              </View>
            </View>
          </View>
        ))}
      </View>
      <Footer companyName={content.companyName} page="3" />
    </Page>
  );
}

function EngagementPage({ content }: { content: ProposalContent }) {
  const scopeLines = content.engagementScope.split('\n').filter(Boolean);
  return (
    <Page size="LETTER" style={s.page}>
      <View style={s.sec}>
        <Text style={s.eyebrow}>SECTION 03</Text>
        <Text style={s.heading}>Proposed Engagement</Text>

        <View style={s.engRow}>
          <View style={s.engBox}>
            <Text style={s.engLabel}>HOURLY BUILD RATE</Text>
            <Text style={s.engValue}>$150</Text>
            <Text style={s.engSub}>per hour</Text>
          </View>
          <View style={s.engBox}>
            <Text style={s.engLabel}>MONTHLY RETAINER</Text>
            <Text style={s.engValue}>$300</Text>
            <Text style={s.engSub}>per month (optional)</Text>
          </View>
        </View>

        <Text style={[s.eyebrow, { marginTop: 16, marginBottom: 8 }]}>SCOPE OF WORK (PHASE 1)</Text>
        {scopeLines.map((line, i) => (
          <View key={i} style={s.scopeItem}>
            <Text style={s.scopeBullet}>*</Text>
            <Text style={s.scopeText}>{line.replace(/^[\-\*\+]\s*/, '')}</Text>
          </View>
        ))}

        <View style={s.timelineBox}>
          <Text style={[s.eyebrow, { marginBottom: 6 }]}>TIMELINE</Text>
          <Text style={s.body}>{content.engagementTimeline}</Text>
        </View>

        <View style={s.retainerBox}>
          <Text style={[s.eyebrow, { marginBottom: 4 }]}>MONTHLY RETAINER (OPTIONAL)</Text>
          <Text style={s.body}>{content.monthlyRetainerDescription}</Text>
        </View>
      </View>
      <Footer companyName={content.companyName} page="4" />
    </Page>
  );
}

function NextStepsPage({ content }: { content: ProposalContent }) {
  return (
    <Page size="LETTER" style={s.page}>
      <View style={s.secLast}>
        <Text style={s.eyebrow}>SECTION 04</Text>
        <Text style={s.heading}>Next Steps</Text>
        <Text style={s.body}>
          To move forward, schedule a 30-minute strategy call. We will confirm scope, answer any
          questions, and define the implementation start date. There is no obligation.
        </Text>
        <View style={[s.ctaBox, { marginTop: 20 }]}>
          <Text style={s.ctaHead}>SCHEDULE A FREE STRATEGY CALL</Text>
          <Text style={s.ctaText}>{content.nextStep}</Text>
          <Text style={s.ctaLink}>calendly.com/maxwexley-wexadvisory/free-strategy-call</Text>
          <Text style={s.ctaSig}>
            Max Wexley{'\n'}
            Wex Advisory{'\n'}
            maxwexley@wexadvisory.com{'\n'}
            wexadvisory.com
          </Text>
        </View>
      </View>
      <Footer companyName={content.companyName} page="5" />
    </Page>
  );
}

export async function generateProposalPDF(content: ProposalContent): Promise<Buffer> {
  const doc = (
    <Document>
      <CoverPage content={content} />
      <ExecutiveSummaryPage content={content} />
      <OpportunitiesPage content={content} />
      <EngagementPage content={content} />
      <NextStepsPage content={content} />
    </Document>
  );
  return renderToBuffer(doc);
}
