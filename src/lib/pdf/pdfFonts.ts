/**
 * The fonts every PDF can use, registered once. Imported by the report cards
 * (through ./pdfTheme) and by the plain documents (receipts, invite codes,
 * results, timetables, attendance), which need the font stacks but not the
 * report cards' layout settings. Like pdfTheme it runs on the server and in
 * the browser, so it must stay free of `fs`/`path`.
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

/**
 * Font stacks for families that cannot set every name. Kikuyu, Meru and Embu
 * names use ĩ and ũ (Wanjirũ, Mũthoni, Kĩmani): DM Serif and Instrument Serif
 * have neither, nor has the built-in Helvetica, which printed "K)mani". A
 * stack keeps its first family for every letter that family has and takes
 * only the missing ones from the next. react-pdf refuses a style one family
 * of the stack lacks, so italics get a stack of their own.
 */
export const FONT_STACKS = {
    dmSerif: [FONTS.dmSerif, FONTS.playfair],
    // A regular upright serif: Playfair is bundled bold only, and its ĩ and ũ
    // stood out heavy among Instrument's light letters.
    instrument: [FONTS.instrument, FONTS.sourceSerif],
    instrumentItalic: [FONTS.instrument, FONTS.sourceSerif],
    /** The plain documents (receipts, invite codes, results, timetables). Upright only: Inter has no italic. */
    helvetica: ['Helvetica', FONTS.inter],
} satisfies Record<string, string[]>;

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
    {
        family: FONTS.sourceSerif,
        fonts: [
            { file: 'sourceserif-400', fontWeight: 400 },
            { file: 'sourceserif-400i', fontWeight: 400, fontStyle: 'italic' },
        ],
    },
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

function registerPdfFonts(): void {
    if (registered) return;
    registered = true;
    try {
        for (const { family, fonts } of FAMILY_FILES) {
            Font.register({
                family,
                fonts: fonts.map(({ file, fontWeight, fontStyle }) => ({ src: `${FONT_BASE}/${file}.ttf`, fontWeight, fontStyle })),
            });
        }
    } catch {
        // Never let a font problem stop a report card from being produced.
    }
}

registerPdfFonts();
