/**
 * Report card theme — the SkulBase design language, in PDF form.
 *
 * Colours are the project's own tokens from globals.css (authored in oklch)
 * converted to the sRGB hex that @react-pdf/renderer needs, so a printed
 * report reads as the same product as the dashboard.
 *
 * Fonts are the project's own too: Merriweather for body copy and Syne for
 * display, matching --font-sans / --font-display.
 *
 * This module is imported by BOTH the server (report API routes) and the
 * browser (the bulk-download page generates its PDFs client-side), so it must
 * stay free of `fs`/`path` — a Node built-in here breaks the client build.
 * Registration therefore feeds react-pdf a filesystem path on the server and a
 * public URL in the browser, and touches `process` only inside the server
 * branch so no bundler ever has to resolve it.
 */
import { Font } from '@react-pdf/renderer';

/* ── Project palette (globals.css → sRGB) ─────────────────── */
export const T = {
    /** --primary: the blue the whole product is built on. */
    primary: '#155DFC',
    primaryDark: '#0F47C4',
    primarySoft: '#E8F0FF',
    /** --sidebar: the deep indigo that anchors the app shell. */
    indigo: '#262A5A',
    /** --chart-3 — the violet the dashboard hero pairs with primary. */
    violet: '#615FFF',
    /** --foreground / --muted-foreground */
    ink: '#0F172B',
    muted: '#3D4E66',
    /** --border / --muted / --background */
    line: '#E2E8F0',
    surface: '#F1F5F9',
    surfaceSoft: '#F8FAFC',
    white: '#FFFFFF',
    /** Wordmark two-tone: --viz-info ("skul") and --viz-good ("base"). */
    brandBlue: '#2563EB',
    brandGreen: '#16A34A',
    /* Semantic — the project's chart tokens */
    green: '#00BC7D',
    cyan: '#00B8DB',
    amber: '#FE9A00',
    red: '#E7000B',
} as const;

/* ── Fonts ────────────────────────────────────────────────── */

/** Where the .ttf files live in each environment. */
const FONT_BASE = typeof window === 'undefined'
    // Server: a real path on disk. public/fonts/report is traced into the
    // serverless bundle by outputFileTracingIncludes in next.config.ts.
    ? `${process.cwd()}/public/fonts/report`
    // Browser: fetched over HTTP from the same folder, served statically.
    : '/fonts/report';

let registered = false;

function registerReportFonts(): void {
    if (registered) return;
    registered = true;
    try {
        Font.register({
            family: 'Merriweather',
            fonts: [
                { src: `${FONT_BASE}/merriweather-400.ttf`, fontWeight: 400 },
                { src: `${FONT_BASE}/merriweather-700.ttf`, fontWeight: 700 },
                { src: `${FONT_BASE}/merriweather-400i.ttf`, fontWeight: 400, fontStyle: 'italic' },
            ],
        });
        Font.register({ family: 'Syne', fonts: [{ src: `${FONT_BASE}/syne-800.ttf`, fontWeight: 800 }] });
        // Merriweather has generous sidebearings; without this react-pdf breaks
        // long subject names mid-word in narrow table cells.
        Font.registerHyphenationCallback(word => [word]);
    } catch {
        // Never let a font problem stop a report card from being produced.
    }
}

registerReportFonts();

/** The app logo, resolved the same way as the fonts. */
export const APP_LOGO = typeof window === 'undefined'
    ? `${process.cwd()}/public/images/logo.png`
    : '/images/logo.png';

export const FONT_BODY = 'Merriweather';
export const FONT_DISPLAY = 'Syne';

/** Bold and italic are weights/styles on the Merriweather family. */
export const boldFont = { fontFamily: 'Merriweather', fontWeight: 700 as const };
export const italicFont = { fontFamily: 'Merriweather', fontStyle: 'italic' as const };
export const displayFont = { fontFamily: 'Syne', fontWeight: 800 as const };

/** Attainment colour ramp, drawn from the project's chart tokens. */
export function attainmentColor(pct: number | null | undefined): string {
    if (pct == null) return T.muted;
    if (pct >= 75) return T.green;
    if (pct >= 50) return T.primary;
    if (pct >= 25) return T.amber;
    return T.red;
}
