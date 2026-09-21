import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import { ReportCardDocument, buildBulkReportCardsDocument, type ReportCardData, type ReportTemplateId } from './pdfGenerator';

/**
 * Server-only PDF generation using renderToBuffer (Node.js API).
 * This file must NEVER be imported in client components.
 * Report cards are rendered here and served as a download; nothing renders a
 * report card in the browser any more.
 */

/* ── Generate single student PDF (server-only) ─────────────────────────── */
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

/* ── Generate one document for a whole class (server-only) ─────────────── */
/**
 * A class of thirty-five report cards is the heaviest thing this app
 * produces. It used to be built in the browser and handed over as a blob URL,
 * which on a phone is both the slowest way to make it and the least reliable
 * way to deliver it.
 */
export async function generateBulkReportCardsPDF(
    reportCardsData: ReportCardData[],
    template?: ReportTemplateId,
): Promise<Buffer> {
    const document = await buildBulkReportCardsDocument(reportCardsData, template);
    return Buffer.from(await renderToBuffer(document));
}
