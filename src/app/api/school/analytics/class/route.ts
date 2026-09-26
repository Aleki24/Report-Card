import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { auth } from '@clerk/nextjs/server';
import { getSchoolPassMark } from '@/lib/pass-mark';
import { getExamType } from '@/lib/exam-types';
import { gradingSystemBySubject } from '@/lib/school-subjects';
import type { GradeBand } from '@/types';
import { getActiveUserProfile } from '@/lib/auth-server';

/**
 * Analytics for one class.
 *
 * The existing /api/school/analytics ships every mark in the school to the
 * browser and lets the page aggregate. That is how the page came to rank Grade
 * 1 learners against Form 4 candidates, average a Lower Primary "Mathematics"
 * with a Senior School one, and — until the previous change — compute all of it
 * from 1,000 of 1,819 rows.
 *
 * This asks the database three grouped questions instead, scoped to a single
 * class. A class is one grade on one curriculum, so everything inside it is
 * genuinely comparable, and there is no row cap to hit because the answers are
 * summaries rather than rows.
 */

export interface ClassSubjectRow {
    subject_id: string;
    subject_name: string;
    subject_code: string | null;
    band: string | null;
    student_count: number;
    mark_count: number;
    mean_percentage: number;
    pass_count: number;
    pass_rate: number;
    highest: number;
    lowest: number;
    /** The symbol the school's own scale gives this mean, or null if unset. */
    grade_symbol: string | null;
}

export interface MeritRow {
    student_id: string;
    admission_number: string | null;
    student_name: string;
    subjects_sat: number;
    mark_count: number;
    mean_percentage: number;
    papers_available: number;
    /** Sat fewer papers than the class did; ranked separately. */
    incomplete: boolean;
    rank: number | null;
}

export interface SeriesRow {
    term_id: string | null;
    term_name: string | null;
    exam_type: string;
    label: string;
    first_exam_date: string | null;
    subject_count: number;
    mark_count: number;
    mean_percentage: number;
}

const num = (v: unknown): number => (v == null ? 0 : Number(v));

/** Turn a percentage into the symbol the school grades that subject on. */
function symbolFor(pct: number, bands: GradeBand[] | undefined): string | null {
    if (!bands?.length) return null;
    const rounded = Math.round(pct);
    const hit = bands.find(
        b => rounded >= Number(b.min_percentage) && rounded <= Number(b.max_percentage),
    );
    return hit?.symbol ?? null;
}

export async function GET(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const supabaseAdmin = createSupabaseAdmin();
        const profile = await getActiveUserProfile(userId);

        const schoolId = profile?.school_id;
        if (!schoolId) return NextResponse.json({ error: 'No school' }, { status: 400 });
        if (profile?.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const streamId = searchParams.get('stream_id');
        if (!streamId) {
            return NextResponse.json({ error: 'stream_id is required' }, { status: 400 });
        }

        // The class must be this school's. Without this an admin could read
        // another school's results by guessing an id.
        const { data: stream } = await supabaseAdmin
            .from('grade_streams')
            .select('id, full_name, school_id, grades ( name_display, academic_level_id, academic_levels ( code, name ) )')
            .eq('id', streamId)
            .maybeSingle();
        if (!stream || stream.school_id !== schoolId) {
            return NextResponse.json({ error: 'Class not found' }, { status: 404 });
        }

        /*
          Which term, and the ones to choose from.

          Defaulting to the current term is right, but only offering the
          current term is not: a school part-way through Term 3 still needs to
          look back at Term 2, and for a while after a term rolls over the
          previous one holds all the marks. The list goes to the client so it
          can offer a picker rather than stranding the reader on whichever term
          happens to be flagged.
        */
        const { data: allTerms } = await supabaseAdmin
            .from('terms')
            .select('id, name, start_date, is_current')
            .eq('school_id', schoolId)
            .order('start_date', { ascending: false });

        const terms = (allTerms ?? []) as { id: string; name: string; start_date: string; is_current: boolean }[];

        let termId = searchParams.get('term_id');
        if (!termId) {
            termId = terms.find(t => t.is_current)?.id ?? terms[0]?.id ?? null;
        }
        const termName = terms.find(t => t.id === termId)?.name ?? null;
        /*
          Which exam. "latest" means the term's most recent series that has
          marks, and is what the page opens on: a merit list over every exam of
          the term averages an Opener with an End Term, so a learner who missed
          one sitting is ranked on a different set of papers from everyone else.
        */
        const requestedExam = searchParams.get('exam_type');
        const seriesRes = await supabaseAdmin.rpc('class_exam_series', {
            p_school_id: schoolId,
            p_grade_stream_id: streamId,
            p_term_id: termId,
        });
        if (seriesRes.error) {
            console.error('Class analytics series error:', seriesRes.error);
            return NextResponse.json({ error: 'Failed to load class analytics' }, { status: 500 });
        }
        const series: SeriesRow[] = ((seriesRes.data || []) as Record<string, unknown>[])
            .map(r => {
                const type = (r.exam_type as string) || 'UNKNOWN';
                return {
                    term_id: (r.term_id as string) ?? null,
                    term_name: (r.term_name as string) ?? null,
                    exam_type: type,
                    // The term is already chosen, so the exam's own name is the label.
                    label: getExamType(type)?.shortName ?? type.charAt(0) + type.slice(1).toLowerCase(),
                    first_exam_date: (r.first_exam_date as string) ?? null,
                    subject_count: num(r.subject_count),
                    mark_count: num(r.mark_count),
                    mean_percentage: num(r.mean_percentage),
                };
            })
            .sort((a, b) => (a.first_exam_date || '').localeCompare(b.first_exam_date || ''));
        const examType = requestedExam === 'latest'
            ? [...series].reverse().find(s => s.mark_count > 0)?.exam_type ?? null
            : requestedExam;

        const passMark = await getSchoolPassMark(supabaseAdmin, schoolId);
        const [subjectsRes, meritRes, gradingBySubject] = await Promise.all([
            supabaseAdmin.rpc('class_subject_performance', {
                p_school_id: schoolId,
                p_grade_stream_id: streamId,
                p_term_id: termId,
                p_exam_type: examType,
                p_pass_mark: passMark,
            }),
            supabaseAdmin.rpc('class_merit_list', {
                p_school_id: schoolId,
                p_grade_stream_id: streamId,
                p_term_id: termId,
                p_exam_type: examType,
            }),
            gradingSystemBySubject(supabaseAdmin, schoolId),
        ]);

        if (subjectsRes.error || meritRes.error) {
            console.error('Class analytics error:', subjectsRes.error || meritRes.error);
            return NextResponse.json({ error: 'Failed to load class analytics' }, { status: 500 });
        }

        // Bands for the grading systems those subjects actually use.
        const systemIds = [...new Set([...gradingBySubject.values()].filter(Boolean))] as string[];
        const bandsBySystem = new Map<string, GradeBand[]>();
        if (systemIds.length > 0) {
            const { data: scales } = await supabaseAdmin
                .from('grading_scales')
                .select('grading_system_id, symbol, min_percentage, max_percentage')
                .in('grading_system_id', systemIds);
            for (const row of scales || []) {
                const key = row.grading_system_id as string;
                const list = bandsBySystem.get(key) ?? [];
                list.push({
                    symbol: row.symbol as string,
                    min_percentage: Number(row.min_percentage),
                    max_percentage: Number(row.max_percentage),
                });
                bandsBySystem.set(key, list);
            }
            for (const list of bandsBySystem.values()) {
                list.sort((a, b) => b.min_percentage - a.min_percentage);
            }
        }

        const subjects: ClassSubjectRow[] = ((subjectsRes.data || []) as Record<string, unknown>[])
            .map(r => {
                const markCount = num(r.mark_count);
                const mean = num(r.mean_percentage);
                const systemId = gradingBySubject.get(r.subject_id as string) ?? null;
                return {
                    subject_id: r.subject_id as string,
                    subject_name: ((r.subject_name as string) || '').trim() || 'Unknown',
                    subject_code: (r.subject_code as string) ?? null,
                    band: (r.band as string) ?? null,
                    student_count: num(r.student_count),
                    mark_count: markCount,
                    mean_percentage: mean,
                    pass_count: num(r.pass_count),
                    pass_rate: markCount > 0 ? Math.round((num(r.pass_count) / markCount) * 100) : 0,
                    highest: num(r.highest),
                    lowest: num(r.lowest),
                    // From the school's own scale, never a hardcoded threshold.
                    grade_symbol: systemId ? symbolFor(mean, bandsBySystem.get(systemId)) : null,
                };
            })
            .sort((a, b) => b.mean_percentage - a.mean_percentage);

        /**
         * Rank only those who sat the full set of papers.
         *
         * The old merit list pooled every term and exam and ranked on a plain
         * mean, so a learner with two marks at 94% took first place from one
         * with thirteen at 84%. Someone who missed papers still appears — their
         * absence is worth seeing — but with no rank, below those who sat
         * everything.
         */
        const meritRaw = ((meritRes.data || []) as Record<string, unknown>[]).map(r => {
            const sat = num(r.subjects_sat);
            const available = num(r.papers_available);
            const first = ((r.first_name as string) || '').trim();
            const last = ((r.last_name as string) || '').trim();
            return {
                student_id: r.student_id as string,
                admission_number: (r.admission_number as string) ?? null,
                student_name: `${first} ${last}`.trim() || 'Unknown',
                subjects_sat: sat,
                mark_count: num(r.mark_count),
                mean_percentage: num(r.mean_percentage),
                papers_available: available,
                incomplete: available > 0 && sat < available,
            };
        });

        const complete = meritRaw.filter(r => !r.incomplete)
            .sort((a, b) => b.mean_percentage - a.mean_percentage);

        // Competition ranking: equal means share a rank, the next one skips.
        const ranks = new Map<string, number>();
        complete.forEach((row, i) => {
            if (i > 0 && row.mean_percentage < complete[i - 1].mean_percentage) {
                ranks.set(row.student_id, i + 1);
            } else {
                ranks.set(row.student_id, i === 0 ? 1 : ranks.get(complete[i - 1].student_id)!);
            }
        });

        const merit: MeritRow[] = [
            ...complete.map(r => ({ ...r, rank: ranks.get(r.student_id) ?? null })),
            ...meritRaw.filter(r => r.incomplete)
                .sort((a, b) => b.mean_percentage - a.mean_percentage)
                .map(r => ({ ...r, rank: null })),
        ];


        const grade = (Array.isArray(stream.grades) ? stream.grades[0] : stream.grades) as
            | { name_display?: string; academic_levels?: { code?: string; name?: string } | { code?: string; name?: string }[] }
            | null;
        const level = Array.isArray(grade?.academic_levels) ? grade?.academic_levels[0] : grade?.academic_levels;

        const markCount = subjects.reduce((sum, s) => sum + s.mark_count, 0);
        const passCount = subjects.reduce((sum, s) => sum + s.pass_count, 0);
        const weightedMean = markCount > 0
            // Weighted by marks, so a subject with 25 entries counts for more
            // than one with 3. The page averaged subject means unweighted.
            ? Math.round(subjects.reduce((sum, s) => sum + s.mean_percentage * s.mark_count, 0) / markCount)
            : 0;

        return NextResponse.json({
            class: {
                id: stream.id,
                full_name: stream.full_name,
                grade_name: grade?.name_display ?? null,
                level_code: level?.code ?? null,
                level_name: level?.name ?? null,
            },
            scope: { term_id: termId, term_name: termName, exam_type: examType },
            terms: terms.map(t => ({ id: t.id, name: t.name, is_current: t.is_current })),
            summary: {
                pass_mark: passMark,
                mean_percentage: weightedMean,
                pass_rate: markCount > 0 ? Math.round((passCount / markCount) * 100) : 0,
                student_count: merit.length,
                subject_count: subjects.length,
                mark_count: markCount,
            },
            subjects,
            merit,
            series,
        });
    } catch (err) {
        console.error('Class analytics route error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
