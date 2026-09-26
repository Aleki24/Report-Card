import type { ReportCardData } from '../pdfGenerator';

/** The `schools` columns a report card prints: header, motto and principal's sign-off. */
export const REPORT_SCHOOL_COLUMNS = 'name, logo_url, address, motto, principal_name, principal_signature_url';

interface ReportSchoolRow {
    name: string | null;
    logo_url: string | null;
    address: string | null;
    motto: string | null;
    principal_name: string | null;
    principal_signature_url: string | null;
}

export type ReportSchoolFields = Pick<
    ReportCardData,
    'schoolName' | 'schoolLogoUrl' | 'schoolAddress' | 'schoolMotto' | 'principalName' | 'principalSignatureUrl'
>;

/** Maps a `REPORT_SCHOOL_COLUMNS` row onto the report data; a missing row prints as "School". */
export function reportSchoolFields(row: ReportSchoolRow | null | undefined): ReportSchoolFields {
    return {
        schoolName: row?.name || 'School',
        schoolLogoUrl: row?.logo_url || undefined,
        schoolAddress: row?.address || undefined,
        schoolMotto: row?.motto || undefined,
        principalName: row?.principal_name || undefined,
        principalSignatureUrl: row?.principal_signature_url || undefined,
    };
}
