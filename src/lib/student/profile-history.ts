import type { SupabaseClient } from '@supabase/supabase-js';
import { embedOne, fetchAllRows } from '@/lib/postgrest';
import type { AttendanceSummary, TermPerformance } from '@/lib/user-profile';

/**
 * A learner's term performance and attendance for the profile staff open
 * from People. Each is one read: the profile used to query marks once per
 * term, and took attendance from report_cards rows, which the daily register
 * never writes.
 */

interface TermRow {
    id: string;
    name: string;
    start_date: string | null;
    end_date: string | null;
    academic_year_id: string;
    academic_years: { name: string; start_date: string | null } | { name: string; start_date: string | null }[] | null;
}

interface MarkRow {
    percentage: number | string | null;
    grade_symbol: string | null;
    exams: { term_id: string; subject_id: string; subjects: { name: string } | { name: string }[] | null } | { term_id: string; subject_id: string; subjects: { name: string } | { name: string }[] | null }[] | null;
}

/** Days marked present (a late arrival was there) out of days on the register. */
const PRESENT = new Set(['present', 'late']);

async function schoolTerms(supabase: SupabaseClient, schoolId: string): Promise<TermRow[]> {
    const { data, error } = await supabase
        .from('terms')
        .select('id, name, start_date, end_date, academic_year_id, academic_years ( name, start_date )')
        .eq('school_id', schoolId)
        .order('start_date')
        .returns<TermRow[]>();
    if (error) throw new Error('Could not load terms');
    return data ?? [];
}

/**
 * This academic year's terms, each with the learner's subjects (one row per
 * subject: its average over the term's exams) and their mean. Staff see
 * marks not yet released, as everywhere else in the app.
 */
export async function termPerformance(supabase: SupabaseClient, schoolId: string, studentId: string, includeUnreleased: boolean): Promise<TermPerformance[]> {
    const terms = await schoolTerms(supabase, schoolId);
    // The current year: the one that started last.
    const yearStart = (t: TermRow) => embedOne(t.academic_years)?.start_date ?? t.start_date ?? '';
    const latest = terms.reduce<TermRow | null>((best, t) => (!best || yearStart(t) > yearStart(best) ? t : best), null);
    const yearTerms = latest ? terms.filter(t => t.academic_year_id === latest.academic_year_id) : [];
    if (yearTerms.length === 0) return [];

    const { rows, error } = await fetchAllRows<MarkRow>(() => {
        let q = supabase
            .from('exam_marks')
            .select('percentage, grade_symbol, exams!inner ( term_id, subject_id, status, subjects ( name ) )')
            .eq('student_id', studentId)
            .in('exams.term_id', yearTerms.map(t => t.id));
        if (!includeUnreleased) q = q.eq('exams.status', 'APPROVED');
        return q.order('id');
    });
    if (error) throw new Error('Could not load marks');

    // term → subject → percentages
    const byTerm = new Map<string, Map<string, { name: string; scores: number[]; grade: string | null }>>();
    for (const m of rows) {
        const exam = embedOne(m.exams);
        if (!exam || m.percentage === null) continue;
        const subjects = byTerm.get(exam.term_id) ?? new Map();
        const entry = subjects.get(exam.subject_id) ?? { name: embedOne(exam.subjects)?.name ?? 'Subject', scores: [], grade: m.grade_symbol };
        entry.scores.push(Number(m.percentage));
        subjects.set(exam.subject_id, entry);
        byTerm.set(exam.term_id, subjects);
    }

    return yearTerms.map(t => {
        const subjects = [...(byTerm.get(t.id)?.values() ?? [])]
            .map(s => ({
                subject_name: s.name,
                percentage: Math.round((s.scores.reduce((a, b) => a + b, 0) / s.scores.length) * 10) / 10,
                // One sitting's grade stands; an average over several has none of its own.
                grade_symbol: s.scores.length === 1 ? s.grade : null,
            }))
            .sort((a, b) => a.subject_name.localeCompare(b.subject_name));
        const average = subjects.length > 0 ? Math.round(subjects.reduce((sum, s) => sum + s.percentage, 0) / subjects.length) : 0;
        return { term_id: t.id, term_name: t.name, subjects, average };
    });
}

/** Attendance per term from the daily register, newest term first; terms with no register are left out. */
export async function termAttendance(supabase: SupabaseClient, schoolId: string, studentId: string): Promise<AttendanceSummary[]> {
    const [terms, { rows, error }] = await Promise.all([
        schoolTerms(supabase, schoolId),
        fetchAllRows<{ date: string; status: string }>(() => supabase
            .from('daily_attendance')
            .select('date, status')
            .eq('student_id', studentId)
            .eq('school_id', schoolId)
            .order('date')),
    ]);
    if (error) throw new Error('Could not load attendance');
    if (rows.length === 0) return [];

    const out: AttendanceSummary[] = [];
    for (const t of terms) {
        if (!t.start_date || !t.end_date) continue;
        const start = t.start_date.slice(0, 10);
        const end = t.end_date.slice(0, 10);
        const days = rows.filter(r => r.date >= start && r.date <= end);
        if (days.length === 0) continue;
        const present = days.filter(r => PRESENT.has(r.status.toLowerCase())).length;
        out.push({
            id: t.id,
            term: t.name,
            year: embedOne(t.academic_years)?.name ?? '—',
            present,
            total: days.length,
            percentage: Math.round((present / days.length) * 100),
        });
    }
    return out.reverse();
}
