import { route, HttpError } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { embedOne, fetchAllRows } from '@/lib/postgrest';
import { SCHOOL_SUBJECT_VIEW } from '@/lib/school-subjects';
import { ROLE_LABELS } from '@/lib/roles';
import { isLookupType, type LookupOption, type LookupType } from '@/lib/ops/lookups';
import type { UserRole } from '@/types';

interface Named { first_name: string | null; last_name: string | null }
const fullName = (u: Named | null) => `${u?.first_name ?? ''} ${u?.last_name ?? ''}`.trim() || 'Unnamed';

type Loader = (schoolId: string, params: URLSearchParams) => Promise<LookupOption[]>;

const db = () => createSupabaseAdmin();

function orThrow<T>(result: { data: T[] | null; error: unknown }): T[] {
    if (result.error) throw result.error;
    return result.data ?? [];
}

const LOADERS: Record<LookupType, Loader> = {
    async students(schoolId, params) {
        const stream = params.get('stream_id');
        const { rows, error } = await fetchAllRows<{
            id: string; admission_number: string | null; current_grade_stream_id: string;
            user: Named | Named[] | null; stream: { full_name: string } | { full_name: string }[] | null;
        }>(() => {
            let q = db().from('students')
                .select('id, admission_number, current_grade_stream_id, user:users(first_name, last_name), stream:grade_streams(full_name)')
                .eq('school_id', schoolId)
                .eq('status', 'ACTIVE');
            if (stream) q = q.eq('current_grade_stream_id', stream);
            return q.order('admission_number').order('id');
        });
        if (error) throw error;
        return rows.map(s => ({
            id: s.id,
            label: fullName(embedOne(s.user)),
            hint: [s.admission_number, embedOne(s.stream)?.full_name].filter(Boolean).join(' · '),
            group: s.current_grade_stream_id,
        })).sort((a, b) => a.label.localeCompare(b.label));
    },
    async staff(schoolId) {
        const rows = orThrow(await db().from('users')
            .select('id, first_name, last_name, role, job_title')
            .eq('school_id', schoolId)
            .in('role', ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER', 'STAFF'])
            .order('first_name'));
        return rows.map(u => ({
            id: u.id as string,
            label: fullName(u as Named),
            hint: (u.job_title as string | null) || ROLE_LABELS[u.role as UserRole] || String(u.role),
            group: u.role as string,
        }));
    },
    async streams(schoolId) {
        const rows = orThrow(await db().from('grade_streams')
            .select('id, full_name, grade_id, grade:grades(numeric_order)')
            .eq('school_id', schoolId));
        return rows
            .map(r => ({ id: r.id as string, label: r.full_name as string, group: r.grade_id as string, order: embedOne<{ numeric_order: number }>(r.grade)?.numeric_order ?? 0 }))
            .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
            .map(({ id, label, group }) => ({ id, label, group }));
    },
    async subjects(schoolId) {
        const rows = orThrow(await db().from(SCHOOL_SUBJECT_VIEW)
            .select('id, name, code, display_order')
            .eq('school_id', schoolId)
            .order('display_order').order('name'));
        return rows.map(r => ({ id: r.id as string, label: r.name as string, hint: r.code as string }));
    },
    async terms(schoolId) {
        const rows = orThrow(await db().from('terms')
            .select('id, name, start_date, end_date, is_current, academic_year_id, year:academic_years(name)')
            .eq('school_id', schoolId)
            .order('start_date', { ascending: false }));
        return rows.map(r => ({
            id: r.id as string,
            label: `${r.name} ${embedOne<{ name: string }>(r.year)?.name ?? ''}`.trim(),
            hint: r.is_current ? 'Current term' : `${r.start_date} – ${r.end_date}`,
            group: r.academic_year_id as string,
        }));
    },
    async years(schoolId) {
        const rows = orThrow(await db().from('academic_years')
            .select('id, name, start_date')
            .eq('school_id', schoolId)
            .order('start_date', { ascending: false }));
        return rows.map(r => ({ id: r.id as string, label: r.name as string }));
    },
    async grades(schoolId) {
        // Grades are a shared catalogue; offer those the school has classes in.
        const rows = orThrow(await db().from('grade_streams')
            .select('grade:grades(id, name_display, numeric_order)')
            .eq('school_id', schoolId));
        const seen = new Map<string, { id: string; label: string; order: number }>();
        for (const r of rows) {
            const g = embedOne<{ id: string; name_display: string; numeric_order: number }>(r.grade);
            if (g && !seen.has(g.id)) seen.set(g.id, { id: g.id, label: g.name_display, order: g.numeric_order });
        }
        return [...seen.values()].sort((a, b) => a.order - b.order).map(({ id, label }) => ({ id, label }));
    },
    async exams(schoolId) {
        const rows = orThrow(await db().from('exams')
            .select('id, name, exam_date, subject:subjects(name)')
            .eq('school_id', schoolId)
            .order('exam_date', { ascending: false })
            .limit(500));
        return rows.map(r => ({
            id: r.id as string,
            label: `${r.name} — ${embedOne<{ name: string }>(r.subject)?.name ?? ''}`,
            hint: r.exam_date as string,
        }));
    },
};

/**
 * Picker options for staff screens. Learners and parents are refused: the
 * lists name every learner and member of staff in the school.
 */
export const GET = route('ops lookups', {}, async ({ access, request }) => {
    if (access.role === 'STUDENT') throw new HttpError(403, 'You do not have permission to do this.');
    const type = request.nextUrl.searchParams.get('type');
    if (!isLookupType(type)) throw new HttpError(400, 'Unknown lookup type.');
    return LOADERS[type](access.schoolId, request.nextUrl.searchParams);
});
