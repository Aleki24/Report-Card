import React from 'react';
import { Document, Page, View, renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import { s } from './pdf/pdfStyles';
import { getTemplateLayout, templateHasPageBars, type ReportTemplateId } from './pdf/templates';

/* ── Data Interface ─────────────────────────────────────── */

export interface ReportCardData {
    schoolName: string;
    schoolLogoUrl?: string;
    schoolAddress?: string;
    examTitle: string;
    academicYear: string;
    studentName: string;
    enrollmentNumber: string;
    className: string;
    gradingSystemType: 'KCSE' | 'CBC';
    subjectMarks: {
        subjectCode?: string;
        subjectName: string;
        category: string;
        score: number;
        totalPossible: number;
        percentage: number;
        grade: string;
        points?: number;
        rubric?: string;
        teacherComment: string;
        subjectRank?: number;
        totalStudents?: number;
        instructorName?: string;
        includedInPoints?: boolean;
        /** Per-paper scores for multi-paper subjects (display order). */
        paperScores?: { code: string; score: number; maxScore: number }[];
        /** Mean mark the whole ranking pool scored in this subject, this round. */
        classAverage?: number;
        /** The learner's mark in this subject at the previous round (deviation). */
        previousPercentage?: number;
    }[];
    overallPercentage: number;
    overallGrade: string;
    totalPoints?: number;
    overallPointsGrade?: string;
    /**
     * Whether this card prints positions at all. 8-4-4 always does; CBC only
     * when the school opts in (KNEC does not rank CBC learners).
     */
    showPositions: boolean;
    /** Position within the learner's stream. */
    classRank: number;
    totalStudents: number;
    /**
     * Position across every stream of the grade — or, for CBC Senior School,
     * within the learner's pathway or combination when the school ranks that
     * way. Absent when it would only repeat the stream position.
     */
    overallRank?: number;
    overallSize?: number;
    /** Who the overall position counts against, e.g. "Form 3, all streams". */
    overallRankLabel?: string;
    /** CBC senior pathway info (undefined for 8-4-4 / unassigned students) */
    pathwayName?: string;
    trackName?: string;
    combinationCode?: string;
    combinationName?: string;
    /** Mean percentage of every learner in the ranking pool, this round. */
    classMeanPercentage?: number;
    /* ── Comparison with the previous round ──────────────────
       All optional: a first-ever exam has nothing to compare against, and
       every layout treats a missing figure as "no deviation to show". */
    /** Human label for the round the deviation figures compare against. */
    previousExamLabel?: string;
    previousOverallPercentage?: number;
    previousTotalPoints?: number;
    previousClassRank?: number;
    classTeacherComment?: string;
    principalComment?: string;
    gradeBoundaries: { symbol: string; label: string; min: number; max: number; points?: number }[];
    resultUrl?: string;
    openingDate?: string;
    totalScore?: number;
    totalPossible?: number;
    subjectTrendData?: {
        subjectName: string;
        scores: { term: string; percentage: number }[];
    }[];
}

export type { ReportTemplateId };

/* ── One rendered report card page body ───────────────────── */
function ReportCardPageBody({ data, qrCodeDataUri, template }: { data: ReportCardData; qrCodeDataUri?: string; template?: ReportTemplateId }) {
    const Layout = getTemplateLayout(template);
    const withBars = templateHasPageBars(template);
    return (
        <>
            {withBars && <View style={s.navyBar} />}
            <View style={{ flex: 1 }}>
                <Layout data={data} qrCodeDataUri={qrCodeDataUri} />
            </View>
            {withBars && <View style={s.navyBarBottom} />}
        </>
    );
}

/* ── React-PDF Document (single student) ─────────────────── */
export function ReportCardDocument({ data, qrCodeDataUri, template }: { data: ReportCardData; qrCodeDataUri?: string; template?: ReportTemplateId }) {
    return (
        <Document>
            <Page size="A4" style={[s.page, { display: 'flex', flexDirection: 'column' }]}>
                <ReportCardPageBody data={data} qrCodeDataUri={qrCodeDataUri} template={template} />
            </Page>
        </Document>
    );
}

/* ── Report Card Content (for bulk PDF pages) ─────────────── */
export function ReportCardContent({ data, qrCodeDataUri, template }: { data: ReportCardData; qrCodeDataUri?: string; template?: ReportTemplateId }) {
    const Layout = getTemplateLayout(template);
    return <Layout data={data} qrCodeDataUri={qrCodeDataUri} />;
}

/* ── Generate single student PDF ─────────────────────────── */
export async function generateStudentReportCardPDF(data: ReportCardData, template?: ReportTemplateId): Promise<Buffer> {
    let qrCodeDataUri = undefined;
    if (data.resultUrl) {
        try {
            // margin omitted → library's spec-compliant 4-module quiet zone;
            // width raised so print doesn't upscale a blurry source image.
            qrCodeDataUri = await QRCode.toDataURL(data.resultUrl, { width: 180 });
        } catch (e) {
            console.error("Failed to generate QR code", e);
        }
    }
    const buffer = await renderToBuffer(
        <ReportCardDocument data={data} qrCodeDataUri={qrCodeDataUri} template={template} />
    );
    return Buffer.from(buffer);
}

/* ── Build the bulk document for an entire class ──────────── */
/**
 * The pages, assembled but not yet rendered.
 *
 * Rendering used to happen here, in the browser, via pdf().toBlob(). For a
 * class of thirty-five that is a lot of work to ask of a phone, and the blob
 * it produced then had to survive being handed to the download manager. Both
 * steps now happen on the server (see generateBulkReportCardsPDF in
 * pdfGeneratorServer.tsx); what stays here is the part that is neither client
 * nor server — the document itself.
 */
export async function buildBulkReportCardsDocument(reportCardsData: ReportCardData[], template?: ReportTemplateId): Promise<React.ReactElement<DocumentProps>> {
    const pages: React.ReactElement[] = [];

    for (let i = 0; i < reportCardsData.length; i++) {
        const data = reportCardsData[i];
        let qrCodeDataUri: string | undefined = undefined;
        if (data.resultUrl) {
            try {
                qrCodeDataUri = await QRCode.toDataURL(data.resultUrl, { width: 180 });
            } catch (e) {
                console.error("Failed to generate QR code", e);
            }
        }

        pages.push(
            <Page key={`${data.enrollmentNumber || data.studentName}-${i}`} size="A4" orientation="portrait" style={[s.page, { display: 'flex', flexDirection: 'column' }]} fixed>
                <ReportCardPageBody data={data} qrCodeDataUri={qrCodeDataUri} template={template} />
            </Page>
        );
    }

    return <Document>{pages}</Document>;
}
