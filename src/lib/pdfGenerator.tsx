import React from 'react';
import { Document, Page, View, renderToBuffer, pdf } from '@react-pdf/renderer';
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
    }[];
    overallPercentage: number;
    overallGrade: string;
    totalPoints?: number;
    overallPointsGrade?: string;
    classRank: number;
    totalStudents: number;
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
            qrCodeDataUri = await QRCode.toDataURL(data.resultUrl, { margin: 1, width: 64 });
        } catch (e) {
            console.error("Failed to generate QR code", e);
        }
    }
    const buffer = await renderToBuffer(
        <ReportCardDocument data={data} qrCodeDataUri={qrCodeDataUri} template={template} />
    );
    return Buffer.from(buffer);
}

/* ── Generate bulk PDF for entire class ──────────────────── */
export async function generateBulkReportCardsPDF(reportCardsData: ReportCardData[], template?: ReportTemplateId): Promise<Uint8Array> {
    const pages: React.ReactElement[] = [];

    for (let i = 0; i < reportCardsData.length; i++) {
        const data = reportCardsData[i];
        let qrCodeDataUri: string | undefined = undefined;
        if (data.resultUrl) {
            try {
                qrCodeDataUri = await QRCode.toDataURL(data.resultUrl, { margin: 1, width: 64 });
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

    const doc = <Document>{pages}</Document>;
    const blob = await pdf(doc).toBlob();
    const arrayBuffer = await blob.arrayBuffer();
    return new Uint8Array(arrayBuffer);
}
