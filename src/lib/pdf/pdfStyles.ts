import { StyleSheet } from '@react-pdf/renderer';
import { T, FONT_BODY, boldFont, italicFont, displayFont } from './pdfTheme';

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
   CLASSIC template — typeset in the SkulBase design language.

   Colour and type come from pdfTheme (the project's own tokens and
   fonts), so the printed report and the dashboard read as one product.
   Layout rules:
   • Primary blue carries every band; nothing else competes for it.
   • One horizontal rhythm — every band shares PAGE_X, so masthead,
     table and footer sit on the same two vertical lines.
   • Sections grow to fill the sheet (see `grow`), so a short subject
     list produces a well-filled page rather than a block of white.
   ═════════════════════════════════════════════════════════ */
const PAGE_X = 26;

export const c = StyleSheet.create({
    page: { padding: 0, fontFamily: FONT_BODY, fontSize: 8.5, color: T.ink, backgroundColor: T.white },

    /* ── Masthead ── */
    masthead: { backgroundColor: T.primary, paddingTop: 13, paddingBottom: 11, paddingHorizontal: PAGE_X, flexDirection: 'row', alignItems: 'center' },
    crestFrame: { width: 50, height: 50, borderRadius: 6, backgroundColor: T.white, padding: 4, alignItems: 'center', justifyContent: 'center' },
    crest: { width: 42, height: 42, objectFit: 'contain' },
    crestFallback: { width: 50, height: 50, borderRadius: 6, backgroundColor: T.primaryDark, alignItems: 'center', justifyContent: 'center' },
    crestFallbackText: { ...displayFont, fontSize: 19, color: T.white },
    mastheadCenter: { flex: 1, paddingHorizontal: 12 },
    mastheadSchool: { ...displayFont, fontSize: 13, color: T.white, textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: 1.2 },
    mastheadAddress: { fontSize: 6.5, color: '#CFE0FF', marginTop: 3 },
    mastheadDoc: { fontSize: 7, color: '#CFE0FF', textTransform: 'uppercase', letterSpacing: 1.4, marginTop: 4 },
    badge: { borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.16)', paddingVertical: 5, paddingHorizontal: 9, alignItems: 'center', minWidth: 54 },
    badgeLabel: { fontSize: 5.5, color: '#CFE0FF', textTransform: 'uppercase', letterSpacing: 0.6 },
    badgeValue: { ...boldFont, fontSize: 14, color: T.white, marginTop: 1 },
    // Sized for scanning, not for looks: the code is ~45 modules across, so
    // 56pt (~19.8mm) keeps each module ~0.44mm — comfortably above the ~0.33mm
    // floor where phone cameras start failing on printed paper. Don't shrink
    // this, and don't add padding: padding is subtracted from the drawn image,
    // and the PNG already carries its own 4-module white quiet zone.
    qrImg: { width: 56, height: 56, backgroundColor: T.white, borderRadius: 4, marginLeft: 8 },
    accentRule: { height: 3, backgroundColor: T.indigo },

    /* ── Info cards ── */
    infoRow: { flexDirection: 'row', gap: 9, paddingHorizontal: PAGE_X, marginTop: 10, marginBottom: 9 },
    infoCard: { flex: 1, borderRadius: 5, overflow: 'hidden', border: `0.8pt solid ${T.line}` },
    infoCardHead: { backgroundColor: T.surface, paddingVertical: 4, paddingHorizontal: 8, borderBottom: `0.8pt solid ${T.line}` },
    infoCardTitle: { ...boldFont, fontSize: 6.5, color: T.primary, textTransform: 'uppercase', letterSpacing: 1 },
    infoCardBody: { backgroundColor: T.white, paddingVertical: 6, paddingHorizontal: 8 },
    infoLine: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 3.5 },
    infoKey: { fontSize: 7, color: T.muted, width: '36%' },
    infoLeader: { flex: 1, borderBottom: `0.6pt dotted ${T.line}`, marginBottom: 2, marginHorizontal: 3 },
    infoVal: { ...boldFont, fontSize: 8, color: T.ink, maxWidth: '62%', textAlign: 'right' },

    /* ── Subject table ── */
    table: { marginHorizontal: PAGE_X, borderRadius: 5, overflow: 'hidden', border: `0.8pt solid ${T.line}` },
    thGroupRow: { flexDirection: 'row', backgroundColor: T.primary },
    thGroupCell: { paddingVertical: 4.5, alignItems: 'center', justifyContent: 'center' },
    thGroupText: { ...boldFont, fontSize: 6.5, color: T.white, textTransform: 'uppercase', letterSpacing: 0.8 },
    thSubRow: { flexDirection: 'row', backgroundColor: T.primaryDark },
    thSubCell: { paddingVertical: 3, alignItems: 'center', justifyContent: 'center' },
    thSubText: { ...boldFont, fontSize: 5.8, color: T.white, textAlign: 'center' },
    thSubNote: { fontSize: 5.2, color: '#CFE0FF', textAlign: 'center' },

    row: { flexDirection: 'row', alignItems: 'center', borderBottom: `0.5pt solid ${T.line}`, backgroundColor: T.white },
    rowAlt: { flexDirection: 'row', alignItems: 'center', borderBottom: `0.5pt solid ${T.line}`, backgroundColor: T.surfaceSoft },
    cellPad: { paddingVertical: 4.5, paddingHorizontal: 4 },
    subjectCell: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4.5, paddingLeft: 7, paddingRight: 4 },
    subjectDot: { width: 4, height: 4, borderRadius: 2, marginRight: 6 },
    subjectName: { fontSize: 7.8, color: T.ink },
    tdCenter: { fontSize: 7.8, color: T.ink, textAlign: 'center' },
    tdCenterBold: { ...boldFont, fontSize: 8.2, color: T.ink, textAlign: 'center' },
    tdMuted: { fontSize: 6.8, color: T.muted, textAlign: 'center' },
    tdComment: { fontSize: 6.5, color: T.muted, paddingVertical: 4.5, paddingHorizontal: 5, lineHeight: 1.25 },
    bandMark: { ...boldFont, fontSize: 8.2, textAlign: 'center' },
    bandDash: { fontSize: 7.5, color: '#C7D0DC', textAlign: 'center' },
    totalRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.primarySoft, borderTop: `1pt solid ${T.primary}` },
    totalLabel: { ...boldFont, fontSize: 7.5, color: T.primary, textTransform: 'uppercase', letterSpacing: 0.8, paddingVertical: 5, paddingLeft: 7 },

    /* ── Overall bar ── */
    averageBar: { flexDirection: 'row', marginHorizontal: PAGE_X, marginTop: 9, borderRadius: 5, overflow: 'hidden' },
    averageLabelWrap: { backgroundColor: T.indigo, paddingVertical: 8, paddingHorizontal: 12, justifyContent: 'center', width: '34%' },
    averageLabel: { ...boldFont, fontSize: 7.5, color: T.white, textTransform: 'uppercase', letterSpacing: 1 },
    averageSub: { fontSize: 5.8, color: '#B9BDE0', marginTop: 2 },
    averageValueWrap: { flex: 1, backgroundColor: T.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 6, paddingHorizontal: 8 },
    averageStat: { alignItems: 'center' },
    averageStatLabel: { fontSize: 5.5, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1.5 },
    averageStatValue: { ...boldFont, fontSize: 11, color: T.ink },
    averageHero: { ...boldFont, fontSize: 19, color: T.primary },

    /* ── Panels ── */
    grow: { flexGrow: 1, flexShrink: 1 },
    panelRow: { flexDirection: 'row', gap: 9, paddingHorizontal: PAGE_X, marginTop: 9 },
    panel: { borderRadius: 5, overflow: 'hidden', border: `0.8pt solid ${T.line}` },
    panelHead: { backgroundColor: T.surface, paddingVertical: 4, paddingHorizontal: 8, borderBottom: `0.8pt solid ${T.line}` },
    panelTitle: { ...boldFont, fontSize: 6.5, color: T.primary, textTransform: 'uppercase', letterSpacing: 1 },
    panelBody: { backgroundColor: T.white, paddingVertical: 9, paddingHorizontal: 9, flexGrow: 1, justifyContent: 'center' },

    chartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
    chartCol: { alignItems: 'center', flex: 1 },
    chartTrack: { width: 12, backgroundColor: T.surface, borderRadius: 2, justifyContent: 'flex-end', overflow: 'hidden' },
    chartFill: { width: 12, borderRadius: 2 },
    chartPct: { ...boldFont, fontSize: 5.5, color: T.ink, marginTop: 2.5 },
    chartLabel: { fontSize: 5, color: T.muted, textAlign: 'center', marginTop: 1 },

    statList: { justifyContent: 'space-around', flexGrow: 1 },
    statLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 3.5, borderBottom: `0.5pt solid ${T.line}` },
    statLineLast: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 3.5 },
    statKey: { fontSize: 6.5, color: T.muted },
    statVal: { ...boldFont, fontSize: 7.5, color: T.ink },

    /* ── Remarks ── */
    commentWrap: { marginHorizontal: PAGE_X, marginTop: 9, borderRadius: 5, overflow: 'hidden', border: `0.8pt solid ${T.line}` },
    commentHead: { backgroundColor: T.surface, paddingVertical: 4, paddingHorizontal: 8, borderBottom: `0.8pt solid ${T.line}` },
    commentHeadText: { ...boldFont, fontSize: 6.5, color: T.primary, textTransform: 'uppercase', letterSpacing: 1 },
    commentBody: { backgroundColor: T.white, paddingVertical: 8, paddingHorizontal: 10, flexGrow: 1, justifyContent: 'center' },
    commentRole: { ...boldFont, fontSize: 6, color: T.primary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2.5 },
    commentText: { ...italicFont, fontSize: 7.8, color: T.ink, lineHeight: 1.5 },
    commentDivider: { height: 0.6, backgroundColor: T.line, marginVertical: 7 },

    /* ── Signatures ── */
    signRow: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: PAGE_X, marginTop: 11, gap: 16 },
    signBlock: { flex: 1 },
    signLine: { borderBottom: `0.8pt solid ${T.muted}`, height: 14 },
    signLabel: { fontSize: 6.2, color: T.muted, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
});

/* ── Shared footer (every template) ─────────────────────────
   One hairline rule and one balanced line: the SkulBase mark on the
   left, report meta on the right. Replaces four stacked centred lines. */
export const f = StyleSheet.create({
    wrap: { marginTop: 'auto', paddingTop: 14 },
    /** The product gradient, as a hairline above the footer line. */
    gradientRule: { flexDirection: 'row', height: 2, marginHorizontal: PAGE_X, borderRadius: 1, overflow: 'hidden' },
    bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: PAGE_X, paddingTop: 7, paddingBottom: 9 },
    brand: { flexDirection: 'row', alignItems: 'center' },
    brandLogo: { width: 13, height: 13, objectFit: 'contain', marginRight: 5 },
    /** Wordmark is deliberately lowercase, as the product sets it. */
    brandName: { ...boldFont, fontSize: 8, letterSpacing: 0.2 },
    brandTag: { fontSize: 5.8, color: T.muted, marginLeft: 5 },
    meta: { fontSize: 5.8, color: T.muted },
});
