import QRCode from 'qrcode';

/**
 * Renders the report-card QR code as a PNG data URI.
 *
 * The layouts draw this at 40–48pt (~14–17mm) on paper. At the 64px it used
 * to be generated at, a portal URL lands around two pixels per QR module —
 * enough on screen, but it prints as a smudge that phone cameras struggle to
 * lock onto. Rasterising at 512px costs a few KB per page and leaves the
 * printed modules crisp at any of the template sizes.
 */
export async function renderQrDataUri(url: string): Promise<string | undefined> {
    try {
        return await QRCode.toDataURL(url, { margin: 1, width: 512 });
    } catch (e) {
        console.error('Failed to generate QR code', e);
        return undefined;
    }
}
