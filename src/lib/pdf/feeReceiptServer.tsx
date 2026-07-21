import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { FeeReceiptDocument, type FeeReceiptData } from './FeeReceiptDocument';

/** Server-only — must never be imported in client components. */
export async function generateFeeReceiptPDF(data: FeeReceiptData): Promise<Buffer> {
    const buffer = await renderToBuffer(<FeeReceiptDocument data={data} />);
    return Buffer.from(buffer);
}
