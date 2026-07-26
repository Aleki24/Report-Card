import Papa from 'papaparse';

/**
 * Reads an uploaded roster/marks file into plain rows.
 *
 * Schools keep their lists in Excel, not CSV — asking a secretary to
 * "Save As → CSV" before every import is a step that gets skipped or done
 * wrong, so imports accept .xlsx/.xls/.ods alongside .csv/.tsv and this is
 * the single place that knows the difference.
 *
 * It also copes with how school files are actually shaped rather than how an
 * importer wishes they were: a title line above the headings, a totals line
 * at the bottom, and columns the system has no use for.
 *
 * Every value comes back as a trimmed string so downstream mapping code
 * doesn't have to care which format it came from: Excel dates become
 * `YYYY-MM-DD` (rather than the 45000-style serial number a raw read gives)
 * and numeric admission numbers become their digits (rather than `1.23e+4`).
 */

export interface SpreadsheetParseResult {
    /** Data rows keyed by the file's own column headings. */
    rows: Record<string, string>[];
    /** Column headings in file order, as written. */
    headers: string[];
}

/** File extensions handled by the spreadsheet reader rather than the CSV reader. */
const SPREADSHEET_EXTENSIONS = ['xlsx', 'xlsm', 'xlsb', 'xls', 'ods'];

/** The `accept` attribute every import file input should use. */
export const IMPORT_FILE_ACCEPT = '.csv,.tsv,.xlsx,.xlsm,.xlsb,.xls,.ods';

export function isSpreadsheetFile(file: File): boolean {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    return SPREADSHEET_EXTENSIONS.includes(ext);
}

const normalizeKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Headings the importers know how to read, across both students and marks.
 * Used only to *locate* the heading row — the importers still do their own
 * mapping, so an unlisted heading is passed through untouched.
 */
const KNOWN_HEADINGS = new Set([
    // student identity
    'firstname', 'first', 'lastname', 'last', 'surname', 'name', 'fullname', 'studentname', 'student',
    'admissionnumber', 'admissionno', 'admno', 'adm',
    // student detail
    'gender', 'sex', 'dateofbirth', 'dob', 'birthdate',
    'guardianphone', 'guardianname', 'guardianemail', 'parentname', 'parentphone', 'parentemail',
    'phone', 'contact', 'email', 'guardian', 'parent',
    'class', 'grade', 'form', 'level', 'stream', 'section',
    // marks
    'score', 'marks', 'mark', 'rawscore', 'symbol', 'points',
]);

/**
 * Labels that mark a summary line rather than a person. School lists commonly
 * end with a totals or averages row; without this it would import as a learner
 * named "TOTAL".
 */
const SUMMARY_LABELS = new Set([
    'total', 'totals', 'subtotal', 'grandtotal', 'count', 'average', 'averages',
    'mean', 'summary', 'classaverage', 'meanscore',
]);

/** Excel gives dates, numbers and booleans; import code wants strings. */
function toCellString(value: unknown): string {
    if (value == null) return '';
    if (value instanceof Date) {
        // Local parts, not toISOString(): a date-only cell read as UTC midnight
        // shifts to the previous day for anyone east of Greenwich.
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
    }
    if (typeof value === 'number') {
        // Never let a long admission number render in exponential notation.
        return Number.isInteger(value) ? value.toFixed(0) : String(value);
    }
    return String(value).trim();
}

/**
 * Find the heading row. School exports routinely open with a title line
 * ("MATOKEO SECONDARY — FORM 3 CLASS LIST") or a blank spacer, so assuming
 * row 0 read the title as the only heading and produced zero students.
 * Scans the first handful of rows and takes the one containing the most
 * recognisable headings, falling back to the first non-empty row.
 */
function findHeaderRow(grid: unknown[][]): number {
    const limit = Math.min(grid.length, 10);
    let bestIndex = -1;
    let bestScore = 0;

    for (let i = 0; i < limit; i++) {
        const cells = (grid[i] || []).map(c => normalizeKey(toCellString(c)));
        const score = cells.filter(c => c && KNOWN_HEADINGS.has(c)).length;
        if (score > bestScore) {
            bestScore = score;
            bestIndex = i;
        }
    }
    if (bestIndex >= 0) return bestIndex;

    // Nothing recognisable — use the first row that has any content at all, so
    // a file with unusual headings still imports via manual column mapping.
    for (let i = 0; i < limit; i++) {
        if ((grid[i] || []).some(c => toCellString(c))) return i;
    }
    return 0;
}

/** A totals/averages line, not a person. */
function isSummaryRow(values: string[]): boolean {
    const firstFilled = values.find(v => v !== '');
    if (!firstFilled) return false;
    return SUMMARY_LABELS.has(normalizeKey(firstFilled));
}

/** Shared shaping for both formats: locate headings, then build rows. */
function gridToRows(grid: unknown[][]): SpreadsheetParseResult {
    if (grid.length === 0) return { rows: [], headers: [] };

    const headerIndex = findHeaderRow(grid);
    const headers = (grid[headerIndex] || []).map(h => toCellString(h));
    const rows: Record<string, string>[] = [];

    for (const line of grid.slice(headerIndex + 1)) {
        const cells = (line || []) as unknown[];
        const values = headers.map((_, i) => toCellString(cells[i]));
        if (values.every(v => v === '')) continue;   // blank spacer row
        if (isSummaryRow(values)) continue;          // totals / averages line

        const row: Record<string, string> = {};
        headers.forEach((heading, i) => {
            if (heading) row[heading] = values[i];
        });
        rows.push(row);
    }

    return { rows, headers: headers.filter(Boolean) };
}

async function parseSpreadsheet(file: File): Promise<SpreadsheetParseResult> {
    // Loaded on demand: SheetJS is large and most users never open a
    // spreadsheet, so it should not sit in the page's initial bundle.
    const XLSX = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const book = XLSX.read(buffer, { type: 'array', cellDates: true });

    const sheetName = book.SheetNames[0];
    if (!sheetName) return { rows: [], headers: [] };

    // header: 1 yields an array-of-arrays, so the heading row is explicit and
    // column order is preserved even when later rows have blanks.
    const grid = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[sheetName], {
        header: 1, defval: '', blankrows: false,
    });
    return gridToRows(grid);
}

function parseDelimited(file: File): Promise<SpreadsheetParseResult> {
    return new Promise((resolve, reject) => {
        // Parsed without headers so CSV goes through the same heading-row
        // detection as Excel — a titled CSV used to fail the same way.
        Papa.parse<string[]>(file, {
            header: false,
            skipEmptyLines: true,
            complete: results => resolve(gridToRows((results.data || []) as unknown[][])),
            error: err => reject(err),
        });
    });
}

/** Parse a CSV/TSV or Excel upload into rows keyed by column heading. */
export function parseTabularFile(file: File): Promise<SpreadsheetParseResult> {
    return isSpreadsheetFile(file) ? parseSpreadsheet(file) : parseDelimited(file);
}

/**
 * Lower-cased, punctuation-stripped copy of each row so importers can look up
 * `admissionnumber` regardless of whether the file said "Admission Number",
 * "ADMISSION_NO" or "adm no".
 */
export function normalizeRowKeys(row: Record<string, string>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
        out[normalizeKey(key)] = value;
    }
    return out;
}
