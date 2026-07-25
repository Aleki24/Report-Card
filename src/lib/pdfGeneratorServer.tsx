import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { ReportCardDocument, type ReportCardData, type ReportTemplateId } from './pdfGenerator';
import { renderQrDataUri } from './pdf/qr';

/**
 * Server-only PDF generation using renderToBuffer (Node.js API).
 * This file must NEVER be imported in client components.
 * For client-side PDF generation, use generateBulkReportCardsPDF from pdfGenerator.tsx.
 */

/* ── Generate single student PDF (server-only) ─────────────────────────── */
export async function generateStudentReportCardPDF(data: ReportCardData, template?: ReportTemplateId): Promise<Buffer> {
    const qrCodeDataUri = data.resultUrl ? await renderQrDataUri(data.resultUrl) : undefined;
    const buffer = await renderToBuffer(
        <ReportCardDocument data={data} qrCodeDataUri={qrCodeDataUri} template={template} />
    );
    return Buffer.from(buffer);
}
