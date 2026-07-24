import { StyleSheet } from '@react-pdf/renderer';

/* ── Colour constants ────────────────────────────────────── */
export const NAVY = '#1A365D';
export const SKY_BLUE = '#87CEEB';
export const ORANGE = '#FF8C00';
export const STEEL_BLUE = '#4682B4';
export const LIGHT_GRAY = '#F2F2F2';
export const GREEN = '#22A86B';
export const GRAY_200 = '#E2E6ED';
export const GRAY_400 = '#9CA3AF';
export const GRAY_700 = '#374151';
export const WHITE = '#FFFFFF';
export const BLACK = '#000000';
export const PHOTO_GRAY = '#E5E7EB';

/* ── Institutional palette (redesigned classic template) ─────
   One dominant (INK navy), one accent (GOLD), the national ribbon
   colours, and a muted competency set. Kept to a small, deliberate
   set so the page reads as one designed object rather than a
   collection of coloured boxes. */
export const INK = '#0C2340';          // header / table header navy
export const INK_SOFT = '#16386A';     // secondary navy for sub-headers
export const GOLD = '#E3B341';         // the single sharp accent
export const CREAM = '#FBFAF7';        // page-warm surface
export const SURFACE = '#F4F6FA';      // card / alt-row surface
export const HAIRLINE = '#DFE4EC';     // 1pt separators
export const KENYA_GREEN = '#177245';
export const KENYA_RED = '#BE0027';
export const INK_MUTED = '#5A6B82';    // secondary text on light

/* Competency bands (CBC) — muted, print-safe, never neon */
export const EE_GREEN = '#177245';
export const ME_BLUE = '#1D4ED8';
export const AE_ORANGE = '#C2700C';
export const BE_RED = '#B91C1C';

/* ── Styles ─────────────────────────────────────────────── */
export const s = StyleSheet.create({
    page: { padding: 0, fontFamily: 'Helvetica', fontSize: 9, color: GRAY_700 },

    /* Top / bottom navy decorative bars */
    navyBar: { height: 6, backgroundColor: NAVY, marginBottom: 0 },
    navyBarBottom: { height: 6, backgroundColor: NAVY },

    /* Header – white background */
    headerBand: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: WHITE,
        paddingVertical: 12, paddingHorizontal: 24,
    },
    // Rounded-square frame with padding: any logo shape renders whole
    // (a circular mask clips the corners of square/rectangular logos)
    logoFrame: { width: 90, height: 90, borderRadius: 10, backgroundColor: WHITE, padding: 7, alignItems: 'center' as const, justifyContent: 'center' as const },
    logo: { width: 76, height: 76, objectFit: 'contain' },
    logoPlaceholder: { width: 90, height: 90, borderRadius: 45, backgroundColor: LIGHT_GRAY, alignItems: 'center', justifyContent: 'center' },
    headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 12 },
    schoolName: { fontSize: 16, fontWeight: 'bold', color: BLACK, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.8 },
    schoolAddress: { fontSize: 8, color: GRAY_400, marginTop: 3, textAlign: 'center' },
    photoPlaceholder: { width: 46, height: 52, borderRadius: 4, backgroundColor: PHOTO_GRAY, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    photoSilhouette: { fontSize: 26, color: GRAY_400 },

    /* Banner ribbon – sky blue with rounded corners */
    bannerRibbon: { backgroundColor: SKY_BLUE, paddingVertical: 6, paddingHorizontal: 16, marginHorizontal: 24, alignItems: 'center', marginBottom: 12, borderRadius: 6 },
    bannerText: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: WHITE, textTransform: 'uppercase', letterSpacing: 2 },

    /* Student info grid */
    infoGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 26 },
    infoItem: { flex: 1, marginHorizontal: 3 },
    infoLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: BLACK, textTransform: 'uppercase', marginBottom: 1 },
    infoValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: NAVY, borderBottom: `1pt solid ${GRAY_200}`, paddingBottom: 3 },

    /* Exam + Performance summary row */
    summaryStrip: { flexDirection: 'row', backgroundColor: LIGHT_GRAY, borderRadius: 4, padding: 8, marginBottom: 12, marginHorizontal: 24, borderLeft: `3pt solid ${NAVY}` },
    summaryLeft: { flex: 1, borderRight: `1pt solid ${GRAY_200}`, paddingRight: 8 },
    summaryRight: { flex: 1, paddingLeft: 8, flexDirection: 'row', justifyContent: 'space-around' },
    summaryLabel: { fontSize: 7, color: GRAY_400, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 2 },
    summaryVal: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: NAVY },

    /* Table */
    table: { marginBottom: 10, overflow: 'hidden', border: `1pt solid ${GRAY_200}`, marginHorizontal: 24 },
    tableHeader: { flexDirection: 'row', backgroundColor: NAVY, paddingVertical: 6, paddingHorizontal: 4 },
    thText: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: WHITE, textTransform: 'uppercase' },
    tableRow: { flexDirection: 'row', borderBottom: `0.5pt solid ${GRAY_200}`, paddingVertical: 5, paddingHorizontal: 4, backgroundColor: WHITE },
    tableRowAlt: { flexDirection: 'row', borderBottom: `0.5pt solid ${GRAY_200}`, paddingVertical: 5, paddingHorizontal: 4, backgroundColor: LIGHT_GRAY },

    /* Column widths — CBC */
    colNo: { width: '5%', textAlign: 'center' },
    colSubject: { width: '22%' },
    colMarks: { width: '10%', textAlign: 'center' },
    colGrade: { width: '10%', textAlign: 'center' },
    colRubric: { width: '10%', textAlign: 'center' },
    colRank: { width: '8%', textAlign: 'center' },
    colComment: { width: '30%' },

    /* Column widths — KCSE */
    colKcseSubject: { width: '22%' },
    colKcseScore: { width: '12%', textAlign: 'center' },
    colKcseRank: { width: '8%', textAlign: 'center' },
    colKcseGrade: { width: '8%', textAlign: 'center' },
    colKcsePoints: { width: '8%', textAlign: 'center' },
    colKcseComment: { width: '37%' },

    tdText: { fontSize: 8.5, color: BLACK },
    tdSmall: { fontSize: 7.5, color: GRAY_700 },
    tdBold: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: BLACK },

    /* Totals row – sky blue bg */
    totalsRow: { flexDirection: 'row', backgroundColor: SKY_BLUE, paddingVertical: 6, paddingHorizontal: 4, borderTop: `1.5pt solid ${NAVY}` },

    /* Bottom: Average badge + Grading key */
    bottomRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, gap: 12, paddingHorizontal: 24, alignItems: 'flex-start' },

    /* Average badge — circular */
    avgBadge: { width: 90, height: 90, borderRadius: 45, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', padding: 6 },
    avgLabel: { fontSize: 7, color: WHITE, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 1 },
    avgValue: { fontSize: 20, color: WHITE, fontFamily: 'Helvetica-Bold' },
    avgGrade: { fontSize: 9, color: WHITE, marginTop: 1 },

    /* Grading key — Steel Blue body */
    gradingKey: { flex: 1, backgroundColor: STEEL_BLUE, borderRadius: 4, padding: 0, overflow: 'hidden' },
    gradingKeyHeader: { backgroundColor: NAVY, paddingVertical: 4, paddingHorizontal: 6 },
    gradingKeyTitle: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: WHITE, textTransform: 'uppercase' },
    gradingContainer: { flexDirection: 'row', flexWrap: 'wrap', padding: 4 },
    gradingItem: { flexDirection: 'row', width: '25%', paddingVertical: 2, paddingHorizontal: 2, alignItems: 'center' },
    gradingSymbol: { width: 14, fontSize: 7, fontFamily: 'Helvetica-Bold', color: WHITE },
    gradingLabel: { flex: 1, fontSize: 6, color: WHITE, overflow: 'hidden', textOverflow: 'ellipsis' },
    gradingRange: { width: 34, fontSize: 6, color: '#D0E8F5', textAlign: 'right' },

    /* Comments */
    commentBox: { borderLeft: `3pt solid ${NAVY}`, padding: 10, marginBottom: 8, backgroundColor: WHITE, marginHorizontal: 24, border: `1pt solid ${GRAY_200}` },
    commentTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: NAVY, marginBottom: 6 },
    commentText: { fontSize: 9, fontStyle: 'italic', color: GRAY_700, lineHeight: 1.6 },
    commentLine: { borderBottom: `1pt dotted ${GRAY_400}`, height: 18, width: '100%', marginBottom: 2 },

    /* Signatures */
    signaturesRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, marginBottom: 6, paddingHorizontal: 28 },
    sigBlock: { width: '45%' },
    sigLabel: { fontSize: 8, color: GRAY_700, marginBottom: 2 },
    sigLine: { borderBottom: `1pt solid ${GRAY_700}`, height: 24 },

    /* Footer */
    footer: { textAlign: 'center', fontSize: 7, color: GRAY_400, paddingTop: 6, paddingBottom: 2 },
    footerLine: { marginBottom: 2 },
});

/* ═══════════════════════════════════════════════════════════
   Redesigned CLASSIC template — "institutional premium".

   Layout rules that keep it from feeling generated:
   • ONE accent (gold) — used on the curriculum line, rules and the
     average figure, nowhere else.
   • A single horizontal rhythm: every band shares PAGE_X margins so
     the crest, table and footer all sit on the same two vertical lines.
   • Type scale is fixed (6 / 7 / 8 / 9 / 11 / 15 / 22) — no ad-hoc sizes.
   ═════════════════════════════════════════════════════════ */
const PAGE_X = 26;

export const c = StyleSheet.create({
    page: { padding: 0, fontFamily: 'Helvetica', fontSize: 9, color: GRAY_700, backgroundColor: WHITE },

    /* ── Masthead ── */
    masthead: { backgroundColor: INK, paddingTop: 14, paddingBottom: 10, paddingHorizontal: PAGE_X, flexDirection: 'row', alignItems: 'center' },
    crestFrame: { width: 54, height: 54, borderRadius: 6, backgroundColor: WHITE, padding: 4, alignItems: 'center', justifyContent: 'center' },
    crest: { width: 46, height: 46, objectFit: 'contain' },
    crestFallback: { width: 54, height: 54, borderRadius: 6, backgroundColor: '#1B3D6B', alignItems: 'center', justifyContent: 'center' },
    crestFallbackText: { fontSize: 18, color: GOLD, fontFamily: 'Helvetica-Bold' },
    mastheadCenter: { flex: 1, paddingHorizontal: 12 },
    mastheadSchool: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: WHITE, textTransform: 'uppercase', letterSpacing: 0.6, lineHeight: 1.15 },
    mastheadCurriculum: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: GOLD, textTransform: 'uppercase', letterSpacing: 1.1, marginTop: 3 },
    mastheadAddress: { fontSize: 6.5, color: '#9FB3CC', marginTop: 3 },
    photoFrame: { width: 52, height: 58, borderRadius: 4, backgroundColor: WHITE, padding: 2, alignItems: 'center', justifyContent: 'center' },
    photoImg: { width: 48, height: 54, objectFit: 'contain' },
    photoEmpty: { width: 52, height: 58, borderRadius: 4, backgroundColor: '#1B3D6B', alignItems: 'center', justifyContent: 'center' },

    /* ── Title strip under the ribbon ── */
    titleStrip: { alignItems: 'center', paddingTop: 8, paddingBottom: 6 },
    titleText: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: INK, textTransform: 'uppercase', letterSpacing: 2.2 },
    titleRule: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
    titleRuleBar: { width: 26, height: 1.6, backgroundColor: GOLD },
    titleRuleDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: GOLD },

    /* ── Paired info cards ── */
    infoRow: { flexDirection: 'row', gap: 10, paddingHorizontal: PAGE_X, marginBottom: 9 },
    infoCard: { flex: 1, borderRadius: 5, overflow: 'hidden', border: `0.8pt solid ${HAIRLINE}` },
    infoCardHead: { backgroundColor: INK, paddingVertical: 4, paddingHorizontal: 8 },
    infoCardTitle: { fontSize: 6.8, fontFamily: 'Helvetica-Bold', color: WHITE, textTransform: 'uppercase', letterSpacing: 1 },
    infoCardBody: { backgroundColor: CREAM, paddingVertical: 6, paddingHorizontal: 8 },
    infoLine: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 3.5 },
    infoKey: { fontSize: 7.5, color: INK_MUTED, width: '38%' },
    infoLeader: { flex: 1, borderBottom: `0.6pt dotted ${GRAY_400}`, marginBottom: 2, marginHorizontal: 3 },
    infoVal: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: INK, maxWidth: '60%', textAlign: 'right' },

    /* ── Subject table ── */
    table: { marginHorizontal: PAGE_X, borderRadius: 5, overflow: 'hidden', border: `0.8pt solid ${HAIRLINE}` },
    thGroupRow: { flexDirection: 'row', backgroundColor: INK },
    thGroupCell: { paddingVertical: 4, alignItems: 'center', justifyContent: 'center' },
    thGroupText: { fontSize: 6.8, fontFamily: 'Helvetica-Bold', color: WHITE, textTransform: 'uppercase', letterSpacing: 0.9 },
    thSubRow: { flexDirection: 'row' },
    thSubCell: { paddingVertical: 3.5, alignItems: 'center', justifyContent: 'center' },
    thSubText: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: WHITE, textAlign: 'center', lineHeight: 1.15 },
    thSubNote: { fontSize: 5, color: '#D9E2EF', textAlign: 'center' },

    row: { flexDirection: 'row', alignItems: 'center', borderBottom: `0.5pt solid ${HAIRLINE}`, minHeight: 17, backgroundColor: WHITE },
    rowAlt: { flexDirection: 'row', alignItems: 'center', borderBottom: `0.5pt solid ${HAIRLINE}`, minHeight: 17, backgroundColor: SURFACE },
    cellPad: { paddingVertical: 4, paddingHorizontal: 5 },

    subjectCell: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingLeft: 6, paddingRight: 4 },
    subjectDot: { width: 4, height: 4, borderRadius: 2, marginRight: 5 },
    // No flex here: this Text sits in a COLUMN beside the per-paper line, and
    // flex:1 would stretch it over its sibling so the two overlap.
    subjectName: { fontSize: 8, color: BLACK },
    subjectPapers: { fontSize: 5.5, color: INK_MUTED, marginTop: 1.5 },

    tdCenter: { fontSize: 8, color: BLACK, textAlign: 'center' },
    tdCenterBold: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: INK, textAlign: 'center' },
    tdMuted: { fontSize: 7, color: INK_MUTED, textAlign: 'center' },
    tdComment: { fontSize: 6.8, color: INK_MUTED, paddingVertical: 4, paddingHorizontal: 5, lineHeight: 1.25 },
    bandMark: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', textAlign: 'center' },
    bandDash: { fontSize: 8, color: '#C3CAD6', textAlign: 'center' },

    /* ── Overall average bar ── */
    averageBar: { flexDirection: 'row', marginHorizontal: PAGE_X, marginTop: 9, borderRadius: 5, overflow: 'hidden', border: `0.8pt solid ${HAIRLINE}` },
    averageLabelWrap: { backgroundColor: INK, paddingVertical: 7, paddingHorizontal: 12, justifyContent: 'center', width: '46%' },
    averageLabel: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: WHITE, textTransform: 'uppercase', letterSpacing: 1.2 },
    averageValueWrap: { flex: 1, backgroundColor: CREAM, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 5, paddingHorizontal: 8 },
    averageStat: { alignItems: 'center' },
    averageStatLabel: { fontSize: 5.8, color: INK_MUTED, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 1 },
    averageStatValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: INK },
    averageHero: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: INK },

    /* ── Analysis + key ── */
    panelRow: { flexDirection: 'row', gap: 10, paddingHorizontal: PAGE_X, marginTop: 9 },
    panel: { borderRadius: 5, overflow: 'hidden', border: `0.8pt solid ${HAIRLINE}` },
    panelHead: { backgroundColor: INK, paddingVertical: 4, paddingHorizontal: 8 },
    panelTitle: { fontSize: 6.8, fontFamily: 'Helvetica-Bold', color: WHITE, textTransform: 'uppercase', letterSpacing: 1 },
    panelBody: { backgroundColor: WHITE, padding: 8 },

    chartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 52 },
    chartCol: { alignItems: 'center', flex: 1 },
    chartTrack: { width: 11, height: 38, backgroundColor: '#EDF0F5', borderRadius: 2, justifyContent: 'flex-end', overflow: 'hidden' },
    chartFill: { width: 11, borderRadius: 2 },
    chartPct: { fontSize: 5.5, fontFamily: 'Helvetica-Bold', color: INK, marginTop: 2 },
    chartLabel: { fontSize: 5, color: INK_MUTED, textAlign: 'center', marginTop: 0.5 },

    calloutRow: { flexDirection: 'row', gap: 6, marginTop: 7 },
    callout: { flex: 1, borderRadius: 4, paddingVertical: 4, paddingHorizontal: 6, backgroundColor: SURFACE },
    calloutLabel: { fontSize: 5.5, color: INK_MUTED, textTransform: 'uppercase', letterSpacing: 0.6 },
    calloutValue: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: INK, marginTop: 1 },

    keyItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
    keyChip: { width: 20, paddingVertical: 1.5, borderRadius: 2, alignItems: 'center', marginRight: 5 },
    keyChipText: { fontSize: 5.8, fontFamily: 'Helvetica-Bold', color: WHITE },
    keyText: { flex: 1, fontSize: 6.2, color: INK_MUTED },
    keyRange: { fontSize: 6, color: INK, fontFamily: 'Helvetica-Bold' },

    /* ── Comments ── */
    commentWrap: { marginHorizontal: PAGE_X, marginTop: 9, borderRadius: 5, overflow: 'hidden', border: `0.8pt solid ${HAIRLINE}` },
    commentHead: { backgroundColor: INK, paddingVertical: 4, paddingHorizontal: 8 },
    commentHeadText: { fontSize: 6.8, fontFamily: 'Helvetica-Bold', color: WHITE, textTransform: 'uppercase', letterSpacing: 1 },
    commentBody: { backgroundColor: CREAM, paddingVertical: 7, paddingHorizontal: 10 },
    commentRole: { fontSize: 6.2, fontFamily: 'Helvetica-Bold', color: GOLD, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
    commentText: { fontSize: 8, fontFamily: 'Helvetica-Oblique', color: GRAY_700, lineHeight: 1.45 },
    commentDivider: { height: 0.6, backgroundColor: HAIRLINE, marginVertical: 6 },

    /* ── Signatures ── */
    signRow: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: PAGE_X, marginTop: 12, gap: 18 },
    signBlock: { flex: 1 },
    signLine: { borderBottom: `0.8pt solid ${INK}`, height: 15 },
    signLabel: { fontSize: 6.5, color: INK_MUTED, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.6 },
});

/* ── Shared footer (every template) ──────────────────────────
   Deliberately three short elements on ONE line plus a single
   meta line: the old footer stacked four centred lines and read
   as clutter at the bottom of the page. */
export const f = StyleSheet.create({
    wrap: { marginTop: 'auto', paddingTop: 8 },
    rule: { height: 0.8, backgroundColor: HAIRLINE, marginHorizontal: PAGE_X },
    bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: PAGE_X, paddingTop: 6, paddingBottom: 8 },
    brand: { flexDirection: 'row', alignItems: 'center' },
    brandMark: { width: 9, height: 9, borderRadius: 2, backgroundColor: INK, marginRight: 4, alignItems: 'center', justifyContent: 'center' },
    brandMarkText: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: GOLD },
    brandName: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: INK, letterSpacing: 0.4 },
    brandTag: { fontSize: 6, color: GRAY_400, marginLeft: 4 },
    meta: { fontSize: 6, color: GRAY_400 },
});
