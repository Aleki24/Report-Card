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
