/**
 * Report card fonts and shared assets.
 *
 * Each template owns its palette (see ./templates/*); what they share is the
 * type library below and the app logo. Every family is bundled as .ttf under
 * public/fonts/report and licensed under the SIL Open Font License 1.1.
 *
 * This module is imported by BOTH the server (report API routes) and the
 * browser, so it must stay free of `fs`/`path` — a Node built-in here breaks
 * the client build. Registration therefore feeds react-pdf a filesystem path
 * on the server and a public URL in the browser, and touches `process` only
 * inside the server branch so no bundler ever has to resolve it.
 */
import { Font } from '@react-pdf/renderer';

/** Where the .ttf files live in each environment. */
const FONT_BASE = typeof window === 'undefined'
    // Server: a real path on disk. public/fonts/report is traced into the
    // serverless bundle by outputFileTracingIncludes in next.config.ts.
    ? `${process.cwd()}/public/fonts/report`
    // Browser: fetched over HTTP from the same folder, served statically.
    : '/fonts/report';

/** The families the templates are typeset in, by the name react-pdf knows them. */
export const FONTS = {
    /** Heritage display serif and the mark sheet's school name. */
    playfair: 'Playfair Display',
    /** Heritage body. */
    sourceSans: 'Source Sans 3',
    /** Heritage remarks. */
    sourceSerif: 'Source Serif 4',
    /** Aurora. */
    jakarta: 'Plus Jakarta Sans',
    /** Editorial display. */
    instrument: 'Instrument Serif',
    /** Editorial body and the mark sheet. */
    inter: 'Inter',
    /** Growth body. */
    manrope: 'Manrope',
    /** Growth display. */
    dmSerif: 'DM Serif Display',
} as const;

type Weight = 400 | 600 | 700 | 800;

const FAMILY_FILES: { family: string; fonts: { file: string; fontWeight: Weight; fontStyle?: 'italic' }[] }[] = [
    { family: FONTS.playfair, fonts: [{ file: 'playfair-700', fontWeight: 700 }] },
    {
        family: FONTS.sourceSans,
        fonts: [
            { file: 'sourcesans-400', fontWeight: 400 },
            { file: 'sourcesans-600', fontWeight: 600 },
            { file: 'sourcesans-700', fontWeight: 700 },
        ],
    },
    { family: FONTS.sourceSerif, fonts: [{ file: 'sourceserif-400i', fontWeight: 400, fontStyle: 'italic' }] },
    {
        family: FONTS.jakarta,
        fonts: [
            { file: 'jakarta-400', fontWeight: 400 },
            { file: 'jakarta-600', fontWeight: 600 },
            { file: 'jakarta-700', fontWeight: 700 },
            { file: 'jakarta-800', fontWeight: 800 },
        ],
    },
    {
        family: FONTS.instrument,
        fonts: [
            { file: 'instrumentserif-400', fontWeight: 400 },
            { file: 'instrumentserif-400i', fontWeight: 400, fontStyle: 'italic' },
        ],
    },
    {
        family: FONTS.inter,
        fonts: [
            { file: 'inter-400', fontWeight: 400 },
            { file: 'inter-600', fontWeight: 600 },
            { file: 'inter-700', fontWeight: 700 },
            { file: 'inter-800', fontWeight: 800 },
        ],
    },
    {
        family: FONTS.manrope,
        fonts: [
            { file: 'manrope-400', fontWeight: 400 },
            { file: 'manrope-600', fontWeight: 600 },
            { file: 'manrope-700', fontWeight: 700 },
            { file: 'manrope-800', fontWeight: 800 },
        ],
    },
    { family: FONTS.dmSerif, fonts: [{ file: 'dmserif-400', fontWeight: 400 }] },
];

let registered = false;

function registerReportFonts(): void {
    if (registered) return;
    registered = true;
    try {
        for (const { family, fonts } of FAMILY_FILES) {
            Font.register({
                family,
                fonts: fonts.map(({ file, fontWeight, fontStyle }) => ({ src: `${FONT_BASE}/${file}.ttf`, fontWeight, fontStyle })),
            });
        }
        // Without this react-pdf breaks long subject names mid-word in narrow cells.
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

/** The product's two-tone wordmark colours ("skul" blue, "base" green). */
export const BRAND = { blue: '#2563EB', green: '#16A34A' } as const;
