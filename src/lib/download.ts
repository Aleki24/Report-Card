/**
 * Hand a generated file to the browser.
 *
 * Every download in the app inlined the same handful of lines, ending in a
 * synchronous `URL.revokeObjectURL(url)` immediately after `anchor.click()`.
 * That click only *schedules* the download — the browser reads the blob
 * afterwards, on its own timeline — so revoking straight away is a race, and
 * one the browser loses more often the larger the file and the slower the
 * device. It surfaces as the browser's own "Download failed", with no error
 * anywhere in the app, because as far as the app is concerned it succeeded.
 *
 * Holding the URL open costs a little memory until the timer fires. Losing the
 * race costs the user their document.
 */

/** Generous enough for a slow phone to finish writing a large PDF. */
const REVOKE_DELAY_MS = 60_000;

/** Save a blob under `filename`. */
export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    // Attached but hidden: Firefox ignores a click on an anchor that was never
    // added to the document.
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}

/** Save PDF bytes that were rendered in the browser. */
export function downloadPdfBytes(bytes: ArrayBuffer | Uint8Array, filename: string): void {
    downloadBlob(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }), filename);
}

/**
 * The filename a download response asked for, falling back to `fallback`.
 * Three call sites parsed this header by hand with the same regex.
 */
export function filenameFromResponse(response: Response, fallback: string): string {
    const disposition = response.headers.get('Content-Disposition') ?? '';
    return disposition.match(/filename="?([^"]+)"?/)?.[1] ?? fallback;
}
