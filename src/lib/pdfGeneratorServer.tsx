import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import { ReportCardDocument, type ReportCardData } from './pdfGenerator';

/**
 * Server-only PDF generation using renderToBuffer (Node.js API).
 * This file must NEVER be imported in client components.
 * For client-side PDF generation, use generateBulkReportCardsPDF from pdfGenerator.tsx.
 */

/* ── Generate single student PDF (server-only) ─────────────────────────── */
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
