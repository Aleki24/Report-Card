/**
 * Sections of a school (Primary, Junior School, Senior School), each with its
 * own head who signs its report cards and mark sheets. A class belongs to the
 * section whose curriculum bands include its grade. Client-safe: the API, the
 * web settings and the mobile app share these.
 */
import { BAND_LABELS, type CurriculumBand } from './curriculum-bands';

export const SCHOOL_SECTIONS_URL = '/api/school/sections';

export interface SchoolSection {
    id: string;
    name: string;
    bands: CurriculumBand[];
    /** How the head is called on the cards: "Principal", "Head teacher". */
    head_title: string;
    head_name: string | null;
    has_signature: boolean;
    sort_order: number;
}

/** A band the school teaches, with how many of its classes are in it. */
export interface SchoolBand {
    band: CurriculumBand;
    label: string;
    classes: number;
}

export interface SchoolSectionsOverview {
    sections: SchoolSection[];
    bands: SchoolBand[];
}

/** Fields a section is saved with. */
export interface SchoolSectionInput {
    name: string;
    bands: CurriculumBand[];
    head_title: string;
    head_name: string | null;
}

/**
 * The usual split of a Kenyan school, offered as a starting point, each led
 * by its own principal; 8-4-4 Form 3–4 sit with Senior School. Only bands
 * the school teaches are kept, and every value (titles too) can be changed.
 */
export const DEFAULT_SECTIONS: readonly SchoolSectionInput[] = [
    { name: 'Primary', bands: ['CBC_PRE_PRIMARY', 'CBC_LOWER_PRIMARY', 'CBC_UPPER_PRIMARY', '844_PRIMARY'], head_title: 'Principal', head_name: null },
    { name: 'Junior School', bands: ['CBC_JUNIOR_SCHOOL'], head_title: 'Principal', head_name: null },
    { name: 'Senior School', bands: ['CBC_SENIOR_SCHOOL', '844_SECONDARY'], head_title: 'Principal', head_name: null },
];

export const bandLabel = (band: CurriculumBand): string => BAND_LABELS[band];

/** The section that covers a band, if any. */
export function sectionForBand<S extends Pick<SchoolSection, 'bands'>>(sections: readonly S[], band: CurriculumBand | null): S | null {
    return band ? sections.find(s => s.bands.includes(band)) ?? null : null;
}

/** The signature target for a section's head (see /api/signatures). */
export const sectionSignatureTarget = (sectionId: string) => `section:${sectionId}`;
