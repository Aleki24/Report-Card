/**
 * Report card theme — the SkulBase design language, in PDF form.
 *
 * Colours are the project's own tokens from globals.css (authored in oklch)
 * converted to the sRGB hex that @react-pdf/renderer needs, so a printed
 * report reads as the same product as the dashboard rather than a separate
 * document with its own palette.
 *
 * Fonts are the project's own too: Merriweather for body copy and Syne for
 * display, matching --font-sans / --font-display. They are bundled with the
 * app (see next.config outputFileTracingIncludes) and registered here. If a
 * deployment ever fails to ship the files, registration falls back to the
 * built-in Times/Helvetica families so report cards still generate — a
 * slightly different typeface beats a 500 on a parent's report.
 */
import path from 'path';
import fs from 'fs';
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
    /* Semantic — the project's chart tokens */
    green: '#00BC7D',
    cyan: '#00B8DB',
    amber: '#FE9A00',
    red: '#E7000B',
} as const;

/* ── Fonts ────────────────────────────────────────────────── */
const FONT_DIR = path.join(process.cwd(), 'src', 'lib', 'pdf', 'fonts');

/** Absolute path to a bundled font, or null when it wasn't shipped. */
function ttf(file: string): string | null {
    try {
        const p = path.join(FONT_DIR, file);
        return fs.existsSync(p) ? p : null;
    } catch {
        return null;
    }
}

let registered = false;
let usingProjectFonts = false;

function register(): void {
    if (registered) return;
    registered = true;
    try {
        const body = ttf('merriweather-400.ttf');
        const bodyBold = ttf('merriweather-700.ttf');
        const bodyItalic = ttf('merriweather-400i.ttf');
        const display = ttf('syne-800.ttf');
        if (!body || !bodyBold || !display) return;

        Font.register({
            family: 'Merriweather',
            fonts: [
                { src: body, fontWeight: 400 },
                { src: bodyBold, fontWeight: 700 },
                ...(bodyItalic ? [{ src: bodyItalic, fontWeight: 400, fontStyle: 'italic' as const }] : []),
            ],
        });
        Font.register({ family: 'Syne', fonts: [{ src: display, fontWeight: 800 }] });

        // Merriweather has generous sidebearings; without this react-pdf breaks
        // long subject names mid-word in narrow table cells.
        Font.registerHyphenationCallback(word => [word]);

        usingProjectFonts = true;
    } catch {
        usingProjectFonts = false;
    }
}

register();

/** Body face — Merriweather when bundled, Times otherwise. */
export const FONT_BODY = usingProjectFonts ? 'Merriweather' : 'Times-Roman';
export const FONT_BODY_BOLD = usingProjectFonts ? 'Merriweather' : 'Times-Bold';
export const FONT_ITALIC = usingProjectFonts ? 'Merriweather' : 'Times-Italic';
/** Display face — Syne when bundled, Helvetica-Bold otherwise. */
export const FONT_DISPLAY = usingProjectFonts ? 'Syne' : 'Helvetica-Bold';

/** Bold is a weight on the Merriweather family but a separate built-in face. */
export const boldFont = usingProjectFonts
    ? { fontFamily: 'Merriweather', fontWeight: 700 as const }
    : { fontFamily: 'Times-Bold' };

export const italicFont = usingProjectFonts
    ? { fontFamily: 'Merriweather', fontStyle: 'italic' as const }
    : { fontFamily: 'Times-Italic' };

export const displayFont = usingProjectFonts
    ? { fontFamily: 'Syne', fontWeight: 800 as const }
    : { fontFamily: 'Helvetica-Bold' };

/** Attainment colour ramp, drawn from the project's chart tokens. */
export function attainmentColor(pct: number | null | undefined): string {
    if (pct == null) return T.muted;
    if (pct >= 75) return T.green;
    if (pct >= 50) return T.primary;
    if (pct >= 25) return T.amber;
    return T.red;
}
