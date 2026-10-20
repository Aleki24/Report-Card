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
import './pdfFonts';

export { FONTS, FONT_STACKS } from './pdfFonts';

// Report cards print subject names in narrow cells, where react-pdf would
// otherwise break them mid-word with a hyphen. Only the report cards load
// this module; the plain documents import ./pdfFonts and keep the default.
try {
    Font.registerHyphenationCallback(word => [word]);
} catch {
    // Never let a font problem stop a report card from being produced.
}


/** The app logo, resolved the same way as the fonts. */
export const APP_LOGO = typeof window === 'undefined'
    ? `${process.cwd()}/public/images/logo.png`
    : '/images/logo.png';

/** The product's two-tone wordmark colours ("skul" blue, "base" green). */
export const BRAND = { blue: '#2563EB', green: '#16A34A' } as const;
