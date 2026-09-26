import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';

/**
 * Stamps every page with who downloaded the paper and when, so a leaked
 * copy can be traced to the account it came from.
 */
export async function watermarkPdf(bytes: Uint8Array, line: string): Promise<Uint8Array> {
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const font = await pdf.embedFont(StandardFonts.HelveticaBold);
    for (const page of pdf.getPages()) {
        const { width, height } = page.getSize();
        const size = Math.max(10, Math.min(22, width / 30));
        const textWidth = font.widthOfTextAtSize(line, size);
        page.drawText(line, {
            x: (width - textWidth * Math.cos(Math.PI / 6)) / 2,
            y: height / 2 - (textWidth * Math.sin(Math.PI / 6)) / 2,
            size,
            font,
            color: rgb(0.75, 0.1, 0.1),
            opacity: 0.18,
            rotate: degrees(30),
        });
        page.drawText(line, { x: 24, y: 14, size: 7, font, color: rgb(0.4, 0.4, 0.4), opacity: 0.8 });
    }
    return pdf.save();
}
