import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { HttpError, type Access } from '@/lib/platform/access';
import { BAND_LABELS, bandForGrade, type CurriculumBand, type GradeLike } from '@/lib/curriculum-bands';
import { embedOne } from '@/lib/postgrest';
import type { ReportCardData } from '@/lib/pdfGenerator';
import type { SchoolBand, SchoolSection } from '@/lib/school-sections';

const BANDS = Object.keys(BAND_LABELS) as [CurriculumBand, ...CurriculumBand[]];

export const sectionInputSchema = z.object({
    name: z.string().trim().min(1, 'Name the section').max(60),
    bands: z.array(z.enum(BANDS)).max(BANDS.length).transform(b => [...new Set(b)]),
    head_title: z.string().trim().min(1, 'Give the head a title, e.g. Principal').max(40),
    head_name: z.string().trim().max(100).nullish().transform(v => v || null),
});

/** Section columns without the signature image, which is read only when printing. */
export const SECTION_COLUMNS = 'id, name, bands, head_title, head_name, sort_order, head_signature';

type SectionRow = Omit<SchoolSection, 'has_signature'> & { head_signature: string | null };

export const toSection = (row: SectionRow): SchoolSection => ({
    id: row.id,
    name: row.name,
    bands: row.bands,
    head_title: row.head_title,
    head_name: row.head_name,
    has_signature: !!row.head_signature,
    sort_order: row.sort_order,
});

/** Sections are set up by admins only, like the rest of school setup. */
export function assertAdmin(access: Access): void {
    if (access.baseRole !== 'ADMIN') throw new HttpError(403, 'Only admins can set up school sections.');
}

/** The school's sections, in order (with their signature images). */
export async function loadSections(db: SupabaseClient, schoolId: string): Promise<SectionRow[]> {
    const { data, error } = await db.from('school_sections').select(SECTION_COLUMNS).eq('school_id', schoolId).order('sort_order').order('created_at');
    if (error) throw error;
    return (data ?? []) as SectionRow[];
}

/**
 * Refuses bands another section already covers: a class must print one
 * head's signature, so a band belongs to one section only.
 */
export function assertBandsFree(sections: readonly Pick<SectionRow, 'id' | 'name' | 'bands'>[], bands: readonly CurriculumBand[], exceptId?: string): void {
    for (const band of bands) {
        const taken = sections.find(s => s.id !== exceptId && s.bands.includes(band));
        if (taken) throw new HttpError(400, `${BAND_LABELS[band]} is already in ${taken.name}. A class can be in one section only: take it out of ${taken.name} first.`);
    }
}

type GradeRow = GradeLike & { id: string };

/** The bands the school teaches, from its classes, with how many classes each. */
export async function schoolBands(db: SupabaseClient, schoolId: string): Promise<SchoolBand[]> {
    const { data, error } = await db.from('grade_streams').select('grades ( id, code, name_display )').eq('school_id', schoolId);
    if (error) throw error;
    const counts = new Map<CurriculumBand, number>();
    for (const row of data ?? []) {
        const band = bandForGrade(embedOne(row.grades as GradeRow | GradeRow[] | null));
        if (band) counts.set(band, (counts.get(band) ?? 0) + 1);
    }
    return BANDS.filter(b => counts.has(b)).map(band => ({ band, label: BAND_LABELS[band], classes: counts.get(band)! }));
}

/** What a report card or mark sheet prints on the head's line. */
export type SectionHeadFields = Pick<ReportCardData, 'principalName' | 'principalSignatureUrl' | 'principalTitle'>;

/**
 * The head who signs for a class: the head of the section its grade is in.
 * Null when the class is in no section, or its section has no head named or
 * signed yet; the school-wide principal then signs, as before sections.
 */
export async function sectionHeadForGrade(db: SupabaseClient, schoolId: string, gradeId: string | null | undefined): Promise<SectionHeadFields | null> {
    if (!gradeId) return null;
    const [{ data: grade, error: gradeError }, sections] = await Promise.all([
        db.from('grades').select('code, name_display').eq('id', gradeId).maybeSingle(),
        loadSections(db, schoolId),
    ]);
    if (gradeError) throw gradeError;
    const band = bandForGrade(grade as GradeLike | null);
    const section = band ? sections.find(s => s.bands.includes(band)) : undefined;
    if (!section || (!section.head_name && !section.head_signature)) return null;
    return {
        principalName: section.head_name || undefined,
        principalSignatureUrl: section.head_signature || undefined,
        principalTitle: section.head_title,
    };
}
