import React from 'react';
import { Document, Page, View, renderToBuffer, pdf } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import { s } from './pdf/pdfStyles';
import { ReportCardLayout } from './pdf/ReportCardLayout';

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

/* ── React-PDF Document (single student) ─────────────────── */
export function ReportCardDocument({ data, qrCodeDataUri }: { data: ReportCardData; qrCodeDataUri?: string }) {
    return (
        <Document>
            <Page size="A4" style={[s.page, { display: 'flex', flexDirection: 'column' }]}>
                <View style={s.navyBar} />
                <View style={{ flex: 1 }}>
                    <ReportCardLayout data={data} qrCodeDataUri={qrCodeDataUri} />
                </View>
                <View style={s.navyBarBottom} />
            </Page>
        </Document>
    );
}

/* ── Report Card Content (for bulk PDF pages) ─────────────── */
export function ReportCardContent({ data, qrCodeDataUri }: { data: ReportCardData; qrCodeDataUri?: string }) {
    return <ReportCardLayout data={data} qrCodeDataUri={qrCodeDataUri} />;
}

/* ── Generate single student PDF ─────────────────────────── */
export async function generateStudentReportCardPDF(data: ReportCardData): Promise<Buffer> {
    let qrCodeDataUri = undefined;
    if (data.resultUrl) {
        try {
            qrCodeDataUri = await QRCode.toDataURL(data.resultUrl, { margin: 1, width: 64 });
        } catch (e) {
            console.error("Failed to generate QR code", e);
        }
    }
    const buffer = await renderToBuffer(
        <ReportCardDocument data={data} qrCodeDataUri={qrCodeDataUri} />
    );
    return Buffer.from(buffer);
}

/* ── Generate bulk PDF for entire class ──────────────────── */
export async function generateBulkReportCardsPDF(reportCardsData: ReportCardData[]): Promise<Uint8Array> {
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
            <Page key={`${data.enrollmentNumber || data.studentName}-${i}`} size="A4" orientation="portrait" style={s.page} fixed>
                <View style={s.navyBar} />
                <View style={{ flexGrow: 1 }}>
                    <ReportCardContent data={data} qrCodeDataUri={qrCodeDataUri} />
                </View>
                <View style={s.navyBarBottom} />
            </Page>
        );
    }

    const doc = <Document>{pages}</Document>;
    const blob = await pdf(doc).toBlob();
    const arrayBuffer = await blob.arrayBuffer();
    return new Uint8Array(arrayBuffer);
}
