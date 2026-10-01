/**
 * A roster spreadsheet row as a student to import, accepting the column
 * names schools actually use. Platform-neutral: the web import dialog and
 * the mobile app share it.
 */
import { normalizeGender } from '../gender';
import { normalizeRowKeys } from './parse-tabular-file';

export interface ImportRow {
    first_name: string;
    last_name: string;
    admission_number: string;
    gender: string;
    date_of_birth: string;
    guardian_phone: string;
    guardian_name: string;
    guardian_email: string;
    class: string;
    stream: string;
    academic_level_id: string;
}

/** Sign-in details made for new students; shown once. */
export interface CreatedCredential { first_name: string; last_name: string; username: string; invite_code: string }

/** What the bulk import answers. */
export interface ImportResponse {
    imported?: number;
    message?: string;
    skipped_rows?: { row: ImportRow; reason: string }[];
    created_credentials?: CreatedCredential[];
}

/** Reads one spreadsheet row, accepting the column names schools actually use. */
export function toImportRow(raw: Record<string, string>, academicLevelId: string): ImportRow {
    const row = normalizeRowKeys(raw);
    let first = row.firstname || row.first || '';
    let last = row.lastname || row.last || row.surname || '';
    const full = row.name || row.fullname || row.studentname;
    if (!first && !last && full) {
        const parts = full.trim().split(/\s+/);
        first = parts[0];
        last = parts.slice(1).join(' ');
    }
    return {
        first_name: first,
        last_name: last,
        admission_number: row.admissionnumber || row.admissionno || row.admno || row.adm || '',
        gender: normalizeGender(row.gender || row.sex) ?? '',
        date_of_birth: row.dateofbirth || row.dob || row.birthdate || '',
        guardian_phone: row.guardianphone || row.phone || row.parentphone || row.contact || '',
        guardian_name: row.guardianname || row.parentname || row.guardian || row.parent || '',
        guardian_email: row.guardianemail || row.parentemail || row.email || '',
        class: row.class || row.grade || row.form || row.level || '',
        stream: row.stream || row.section || '',
        academic_level_id: academicLevelId,
    };
}

/** Rows with at least a name; blank lines are dropped. */
export const namedRows = (rows: readonly ImportRow[]) => rows.filter(r => r.first_name || r.last_name);
