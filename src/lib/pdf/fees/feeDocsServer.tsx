import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { FeeStatementDocument, type FeeStatementData } from './FeeStatementDocument';

/** Server-only — must never be imported in client components. */
export async function generateFeeStatementPDF(data: FeeStatementData): Promise<Buffer> {
    return Buffer.from(await renderToBuffer(<FeeStatementDocument data={data} />));
}
