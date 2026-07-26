import Papa from 'papaparse';

/**
 * Reads an uploaded roster/marks file into plain rows.
 *
 * Schools keep their lists in Excel, not CSV — asking a secretary to
 * "Save As → CSV" before every import is a step that gets skipped or done
 * wrong, so imports accept .xlsx/.xls/.ods alongside .csv/.tsv and this is
 * the single place that knows the difference.
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

/** Excel gives dates, numbers and booleans; report/import code wants strings. */
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

async function parseSpreadsheet(file: File): Promise<SpreadsheetParseResult> {
    // Loaded on demand: SheetJS is large and most users never open a
    // spreadsheet, so it should not sit in the page's initial bundle.
    const XLSX = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const book = XLSX.read(buffer, { type: 'array', cellDates: true });

    const sheetName = book.SheetNames[0];
    if (!sheetName) return { rows: [], headers: [] };
    const sheet = book.Sheets[sheetName];

    // header: 1 yields an array-of-arrays, so the heading row is explicit
    // and column order is preserved even when later rows have blanks.
    const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', blankrows: false });
    if (grid.length === 0) return { rows: [], headers: [] };

    const headers = (grid[0] as unknown[]).map(h => toCellString(h));
    const rows: Record<string, string>[] = [];

    for (const line of grid.slice(1)) {
        const cells = line as unknown[];
        const row: Record<string, string> = {};
        let hasValue = false;
        headers.forEach((heading, i) => {
            if (!heading) return;
            const value = toCellString(cells[i]);
            row[heading] = value;
            if (value) hasValue = true;
        });
        if (hasValue) rows.push(row);
    }

    return { rows, headers: headers.filter(Boolean) };
}

function parseDelimited(file: File): Promise<SpreadsheetParseResult> {
    return new Promise((resolve, reject) => {
        Papa.parse<Record<string, string>>(file, {
            header: true,
            skipEmptyLines: true,
            complete: results => resolve({
                rows: (results.data || []).map(row => {
                    const clean: Record<string, string> = {};
                    for (const [key, value] of Object.entries(row)) {
                        if (key) clean[key] = toCellString(value);
                    }
                    return clean;
                }),
                headers: results.meta.fields?.filter(Boolean) ?? [],
            }),
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
        out[key.toLowerCase().replace(/[^a-z0-9]/g, '')] = value;
    }
    return out;
}
