import React from 'react';
import QRCode from 'qrcode';
import { renderToBuffer } from '@react-pdf/renderer';
import { FeeReceiptDocument, type FeeReceiptData } from './FeeReceiptDocument';

/** Where a receipt's QR leads: the public check of that receipt. */
export const receiptVerifyUrl = (origin: string, paymentId: string) => `${origin.replace(/\/$/, '')}/verify/receipt/${paymentId}`;

/** Server-only — must never be imported in client components. */
export async function generateFeeReceiptPDF(data: Omit<FeeReceiptData, 'qrDataUri'>): Promise<Buffer> {
    // A receipt without its QR still prints; the address under it still works.
    const qrDataUri = await QRCode.toDataURL(data.verifyUrl, { width: 180, margin: 0 }).catch(() => null);
    return Buffer.from(await renderToBuffer(<FeeReceiptDocument data={{ ...data, qrDataUri }} />));
}
