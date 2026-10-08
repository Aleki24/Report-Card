import type { SupabaseClient } from '@supabase/supabase-js';
import { getCurrentAcademicYearId } from '@/lib/auth-server';
import { embedOne } from '@/lib/postgrest';
import type { ReportCardData } from '../pdfGenerator';

/** What a report card prints on the class teacher's signature line. */
export type ClassTeacherFields = Pick<ReportCardData, 'classTeacherName' | 'classTeacherSignatureUrl'>;

type NameRow = { first_name: string | null; last_name: string | null };

/**
 * Each class's class teacher for the year a report covers (the school's
 * current year when none is given), with the signature they keep on file,
 * so their cards and mark sheets come out signed. Classes without a class
 * teacher are left out; their line prints empty.
 */
export async function classTeacherSignoffs(
    supabase: SupabaseClient,
    schoolId: string,
    streamIds: readonly string[],
    yearId: string | null | undefined,
): Promise<Map<string, ClassTeacherFields>> {
    const out = new Map<string, ClassTeacherFields>();
    const year = yearId || await getCurrentAcademicYearId(supabase, schoolId);
    if (!year || streamIds.length === 0) return out;

    const { data: holders, error } = await supabase
        .from('class_teachers')
        .select('user_id, current_grade_stream_id, users ( first_name, last_name )')
        .in('current_grade_stream_id', [...streamIds])
        .eq('academic_year_id', year);
    if (error) throw error;
    if (!holders?.length) return out;

    const { data: signatures, error: sigError } = await supabase
        .from('user_signatures')
        .select('user_id, image')
        .in('user_id', holders.map(h => h.user_id as string));
    if (sigError) throw sigError;
    const imageOf = new Map((signatures ?? []).map(s => [s.user_id as string, s.image as string]));

    for (const h of holders) {
        const u = embedOne(h.users as NameRow | NameRow[] | null);
        const name = `${u?.first_name ?? ''} ${u?.last_name ?? ''}`.trim();
        out.set(h.current_grade_stream_id as string, {
            classTeacherName: name || undefined,
            classTeacherSignatureUrl: imageOf.get(h.user_id as string) || undefined,
        });
    }
    return out;
}
