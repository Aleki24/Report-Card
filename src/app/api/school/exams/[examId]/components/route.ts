import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { fetchExamComponentScheme } from '@/lib/multi-paper-server';
import { AGGREGATION_METHODS } from '@/lib/multi-paper';

const VALID_METHODS = new Set(AGGREGATION_METHODS.map(m => m.value));
const MAX_COMPONENTS = 6;

async function getSessionAndExam(examId: string) {
    const { userId } = await auth();
    if (!userId) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

    const supabase = createSupabaseAdmin();
    const { data: userProfile } = await supabase
        .from('users')
        .select('role, school_id')
        .eq('id', userId)
        .maybeSingle();

    if (!userProfile?.school_id) {
        return { error: NextResponse.json({ error: 'No school associated' }, { status: 403 }) };
    }

    const { data: exam } = await supabase
        .from('exams')
        .select('*')
        .eq('id', examId)
        .maybeSingle();

    if (!exam || exam.school_id !== userProfile.school_id) {
        return { error: NextResponse.json({ error: 'Exam not found' }, { status: 404 }) };
    }

    return { supabase, userId, role: userProfile.role as string, schoolId: userProfile.school_id as string, exam };
}

// GET — fetch the component scheme (papers config) for an exam
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ examId: string }> }
) {
    try {
        const { examId } = await params;
        const ctx = await getSessionAndExam(examId);
        if ('error' in ctx) return ctx.error;
        const { supabase, userId, role, exam } = ctx;

        if (role === 'STUDENT') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        if (role === 'CLASS_TEACHER' || role === 'SUBJECT_TEACHER') {
            const { getTeacherPermissions, isExamVisibleToTeacher } = await import('@/lib/teacher-utils');
            const perms = await getTeacherPermissions(userId);
            if (!isExamVisibleToTeacher(exam, perms, userId)) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        const scheme = await fetchExamComponentScheme(supabase, examId);
        return NextResponse.json({ data: scheme });
    } catch (err: unknown) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
    }
}

// PUT — create/update the component scheme for an exam
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ examId: string }> }
) {
    try {
        const { examId } = await params;
        const ctx = await getSessionAndExam(examId);
        if ('error' in ctx) return ctx.error;
        const { supabase, userId, role, schoolId, exam } = ctx;

        // Admins always; teachers only for exams they can enter marks for
        if (role === 'CLASS_TEACHER' || role === 'SUBJECT_TEACHER') {
            const { getTeacherPermissions, isExamVisibleToTeacher } = await import('@/lib/teacher-utils');
            const perms = await getTeacherPermissions(userId);
            if (!isExamVisibleToTeacher(exam, perms, userId)) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        } else if (role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const assessmentMode = body.assessment_mode === 'multi_paper' ? 'multi_paper' : 'single_paper';
        const aggregationMethod = VALID_METHODS.has(body.aggregation_method)
            ? body.aggregation_method
            : 'sum_then_percentage';
        const isEnabled = body.is_enabled !== false;
        const components: any[] = Array.isArray(body.components) ? body.components : [];

        if (assessmentMode === 'multi_paper' && isEnabled) {
            if (components.length < 2 || components.length > MAX_COMPONENTS) {
                return NextResponse.json(
                    { error: `Multi-paper subjects need between 2 and ${MAX_COMPONENTS} papers` },
                    { status: 400 }
                );
            }
            const codes = new Set<string>();
            for (const c of components) {
                const code = String(c.component_code || '').trim().toUpperCase();
                const max = Number(c.max_score);
                if (!code) return NextResponse.json({ error: 'Every paper needs a code (e.g. P1)' }, { status: 400 });
                if (codes.has(code)) return NextResponse.json({ error: `Duplicate paper code: ${code}` }, { status: 400 });
                codes.add(code);
                if (!max || max <= 0) {
                    return NextResponse.json({ error: `Paper ${code} needs a max score greater than 0` }, { status: 400 });
                }
            }
        }

        // Upsert scheme (one per exam)
        const { data: scheme, error: schemeError } = await supabase
            .from('exam_subject_component_schemes')
            .upsert(
                {
                    exam_id: examId,
                    subject_id: exam.subject_id,
                    school_id: schoolId,
                    assessment_mode: assessmentMode,
                    aggregation_method: aggregationMethod,
                    is_enabled: isEnabled,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'exam_id' }
            )
            .select('id')
            .single();

        if (schemeError || !scheme) {
            return NextResponse.json({ error: schemeError?.message || 'Failed to save scheme' }, { status: 400 });
        }

        // Reconcile components by code so existing per-paper marks survive
        // edits to names/max scores (removed papers cascade-delete their marks).
        if (assessmentMode === 'multi_paper') {
            const { data: existing } = await supabase
                .from('exam_subject_components')
                .select('id, component_code')
                .eq('scheme_id', scheme.id);

            const existingByCode = new Map((existing || []).map(c => [c.component_code, c.id]));
            const incomingCodes = new Set<string>();

            for (let i = 0; i < components.length; i++) {
                const c = components[i];
                const code = String(c.component_code).trim().toUpperCase();
                incomingCodes.add(code);
                const payload = {
                    scheme_id: scheme.id,
                    component_code: code,
                    component_name: String(c.component_name || code).trim(),
                    max_score: Number(c.max_score),
                    weight: c.weight != null ? Number(c.weight) : null,
                    display_order: i + 1,
                };
                const existingId = existingByCode.get(code);
                const { error: compError } = existingId
                    ? await supabase.from('exam_subject_components').update(payload).eq('id', existingId)
                    : await supabase.from('exam_subject_components').insert(payload);
                if (compError) {
                    return NextResponse.json({ error: compError.message }, { status: 400 });
                }
            }

            const removedIds = (existing || [])
                .filter(c => !incomingCodes.has(c.component_code))
                .map(c => c.id);
            if (removedIds.length > 0) {
                await supabase.from('exam_subject_components').delete().in('id', removedIds);
            }
        }

        const saved = await fetchExamComponentScheme(supabase, examId);
        return NextResponse.json({ success: true, data: saved });
    } catch (err: unknown) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
    }
}
