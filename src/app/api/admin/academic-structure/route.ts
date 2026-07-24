// src/app/api/admin/academic-structure/route.ts (FIXED)
// ============================================================
// KEY FIX: When creating grade_streams, academic_years, and terms,
// we now always attach the admin's school_id to isolate data.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { getTeacherPermissions, isStreamVisibleToTeacher, isSubjectVisibleToTeacher } from '@/lib/teacher-utils';
import { ZodError, ZodIssue } from 'zod';
import {
    academicYearSchema,
    termSchema,
    academicLevelSchema,
    gradeSchema,
    streamSchema,
    gradingSystemSchema,
    gradingScaleSchema,
    subjectSchema,
    subjectCombinationSchema,
    subjectCombinationUpdateSchema,
} from '@/lib/schemas';
import { syncCombinationStudents } from '@/lib/pathway/sync-student-subjects';

type CreatePayload = Record<string, unknown>;

// These two tables are GLOBAL, seeded national-curriculum reference data
// shared by every school (there is no school_id column on them — every
// school shares the same academic levels / grade lists). A per-school admin
// editing them corrupts every other school's data, so they are read-only
// through this per-school API; they are managed centrally via seed migrations.
//
// Grading systems/scales used to be in this list too, but that blocked the
// "create your own grading system" feature entirely. They're now
// school-scoped: rows with school_id = NULL are the shared national-default
// templates (still read-only here), while rows with school_id set are owned
// by that school and fully editable/deletable by it — enforced per-record
// below rather than by type.
const GLOBAL_REFERENCE_TYPES = ['level', 'grade'];

async function getLatestSession() {
    const { userId } = await auth();
    if (!userId) return null;

    const supabaseAdmin = createSupabaseAdmin();
    const { data } = await supabaseAdmin.from('users').select('school_id, role, is_active').eq('id', userId).maybeSingle();

    // A missing or deactivated account is unauthorized.
    if (!data || data.is_active === false) return null;

    return {
        userId,
        schoolId: data.school_id as string | null,
        role: data.role,
    };
}

function handleDatabaseError(error: unknown, context: string): NextResponse {
    const err = error as { message?: string; code?: string };
    if (err.code === '23505' || err.message?.includes('duplicate')) {
        return NextResponse.json(
            { error: `A ${context} with this data already exists.` },
            { status: 400 }
        );
    }
    return NextResponse.json(
        { error: err.message || 'Database error' },
        { status: 400 }
    );
}

function handleZodError(error: ZodError): NextResponse {
    const messages = error.issues.map((issue: ZodIssue) => `${issue.path.join('.')}: ${issue.message}`);
    return NextResponse.json({ error: 'Validation failed', details: messages }, { status: 400 });
}

export async function GET(request: NextRequest) {
    try {
        const auth = await getLatestSession();
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const schoolId = auth.schoolId;
        const supabaseAdmin = createSupabaseAdmin();

        // Global/shared data (curriculum)
        const [levelsRes, gradesRes] = await Promise.all([
            supabaseAdmin.from('academic_levels').select('*').order('code'),
            supabaseAdmin.from('grades').select('*').order('numeric_order'),
        ]);

        // School-scoped data — filter by school_id
        let yearsData: any[] = [];
        let termsData: any[] = [];
        let streamsData: any[] = [];
        let subjectsData: any[] = [];
        let gsData: any[] = [];
        let gscData: any[] = [];
        let combinationsData: any[] = [];

        if (schoolId) {
            const [yearsRes, termsRes, streamsRes, subjectsRes, gsRes, combosRes] = await Promise.all([
                supabaseAdmin.from('academic_years').select('*').eq('school_id', schoolId).order('start_date', { ascending: false }),
                supabaseAdmin.from('terms').select('*').eq('school_id', schoolId).order('start_date'),
                supabaseAdmin.from('grade_streams').select('*').eq('school_id', schoolId).order('name'),
                supabaseAdmin.from('subjects').select('*').eq('school_id', schoolId).order('display_order'),
                // Global default templates (school_id IS NULL) + this school's own systems
                supabaseAdmin.from('grading_systems').select('*').or(`school_id.is.null,school_id.eq.${schoolId}`).order('name'),
                supabaseAdmin.from('subject_combinations')
                    .select('*, subject_combination_subjects ( subject_id, subjects ( id, name, code ) )')
                    .eq('school_id', schoolId)
                    .order('code'),
            ]);
            yearsData = yearsRes.data ?? [];
            termsData = termsRes.data ?? [];
            streamsData = streamsRes.data ?? [];
            subjectsData = subjectsRes.data ?? [];
            gsData = gsRes.data ?? [];
            if (gsData.length > 0) {
                const { data: scalesData } = await supabaseAdmin
                    .from('grading_scales')
                    .select('*')
                    .in('grading_system_id', gsData.map(g => g.id))
                    .order('order_index');
                gscData = scalesData ?? [];
            }

            const combos = combosRes.data ?? [];
            if (combos.length > 0) {
                const { data: comboStudents } = await supabaseAdmin
                    .from('students')
                    .select('subject_combination_id')
                    .in('subject_combination_id', combos.map(c => c.id));
                const counts = new Map<string, number>();
                (comboStudents ?? []).forEach(s => {
                    if (s.subject_combination_id) {
                        counts.set(s.subject_combination_id, (counts.get(s.subject_combination_id) ?? 0) + 1);
                    }
                });
                combinationsData = combos.map(c => ({
                    ...c,
                    subjects: (c.subject_combination_subjects ?? [])
                        .map((row: any) => row.subjects)
                        .filter(Boolean),
                    subject_combination_subjects: undefined,
                    student_count: counts.get(c.id) ?? 0,
                }));
            }

            if (auth.role !== 'ADMIN') {
                const perms = await getTeacherPermissions(auth.userId);
                streamsData = streamsData.filter(s => isStreamVisibleToTeacher(s, perms));
                // We no longer filter subjects so teachers can see newly created subjects in dropdowns
            }
        } else {
             subjectsData = [];
        }

        // Filter out unwanted grades (as per user request: Form 1-2, Standard X)
        // Keep CBC Grade 1-12, and 844 Form 3-4
        const filteredGrades = (gradesRes.data || []).filter(g => {
            const name = g.name_display || '';
            
            if (name.startsWith('Standard ')) return false;
            
            if (name.startsWith('Form ')) {
                // Keep only exactly Form 3 and Form 4
                return ['Form 3', 'Form 4'].includes(name.trim());
            }
            
            return true;
        });

        return NextResponse.json({
            academic_years: yearsData,
            terms: termsData,
            grades: filteredGrades,
            grade_streams: streamsData,
            subjects: subjectsData,
            academic_levels: levelsRes.data || [],
            grading_systems: gsData,
            grading_scales: gscData,
            subject_combinations: combinationsData,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { type, ...payload } = body as CreatePayload & { type: string };

        const auth = await getLatestSession();
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = auth.userId;
        const schoolId = auth.schoolId;
        const role = auth.role;

        const isTeacher = role === 'CLASS_TEACHER' || role === 'SUBJECT_TEACHER';

        // Check role permissions: Teachers can add basic exam-related structure. Admins can add anything.
        if (role !== 'ADMIN') {
            const allowedForTeachers = ['subject', 'stream', 'term', 'academic_year'];
            if (!isTeacher || !allowedForTeachers.includes(type)) {
                return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
            }
        }

        // Global reference data is shared across all schools and cannot be
        // created/altered from a single school's admin.
        if (GLOBAL_REFERENCE_TYPES.includes(type)) {
            return NextResponse.json({ error: 'Grading systems, grading scales, grade levels, and academic levels are centrally managed and cannot be modified here.' }, { status: 403 });
        }

        const supabaseAdmin = createSupabaseAdmin();

        const handlers: Record<string, () => Promise<NextResponse>> = {
            level: async () => {
                const data = academicLevelSchema.parse(payload);
                const { data: result, error } = await supabaseAdmin
                    .from('academic_levels')
                    .insert({ code: data.code, name: data.name })
                    .select().single();
                if (error) return handleDatabaseError(error, 'academic level');
                return NextResponse.json({ success: true, data: result });
            },

            grade: async () => {
                const data = gradeSchema.parse(payload);
                const { data: result, error } = await supabaseAdmin
                    .from('grades')
                    .insert({ code: data.code, name_display: data.name_display, academic_level_id: data.academic_level_id, numeric_order: data.numeric_order })
                    .select().single();
                if (error) return handleDatabaseError(error, 'grade');
                return NextResponse.json({ success: true, data: result });
            },

            grading_system: async () => {
                if (!schoolId) return NextResponse.json({ error: 'No school set up yet.' }, { status: 400 });
                const data = gradingSystemSchema.parse(payload);
                const rawSubjectIds = (payload as Record<string, unknown>).subject_ids;
                const subjectIds = Array.isArray(rawSubjectIds) ? (rawSubjectIds as string[]) : [];

                const { data: result, error } = await supabaseAdmin
                    .from('grading_systems')
                    .insert({ name: data.name, description: data.description || null, academic_level_id: data.academic_level_id, school_id: schoolId })
                    .select().single();
                if (error) return handleDatabaseError(error, 'grading system');

                if (data.scales && data.scales.length > 0) {
                    const scaleRows = data.scales.map((s, i) => ({
                        grading_system_id: result.id,
                        symbol: s.symbol,
                        label: s.label || s.symbol,
                        min_percentage: s.min_percentage,
                        max_percentage: s.max_percentage,
                        points: s.points ?? null,
                        order_index: i,
                    }));
                    const { error: scalesError } = await supabaseAdmin.from('grading_scales').insert(scaleRows);
                    if (scalesError) {
                        // Keep the system atomic: don't leave a grading system with no grid behind
                        await supabaseAdmin.from('grading_systems').delete().eq('id', result.id);
                        return handleDatabaseError(scalesError, 'grading scale');
                    }
                }

                // Link the group of subjects chosen at creation time, if any —
                // this is the "grading system linked to subjects" grouping.
                if (subjectIds.length > 0) {
                    const { data: validSubjects } = await supabaseAdmin
                        .from('subjects')
                        .select('id')
                        .eq('school_id', schoolId)
                        .in('id', subjectIds);
                    if ((validSubjects ?? []).length !== subjectIds.length) {
                        await supabaseAdmin.from('grading_systems').delete().eq('id', result.id);
                        return NextResponse.json({ error: 'All subjects must belong to your school.' }, { status: 400 });
                    }
                    const { error: assignError } = await supabaseAdmin
                        .from('subjects')
                        .update({ grading_system_id: result.id })
                        .eq('school_id', schoolId)
                        .in('id', subjectIds);
                    if (assignError) {
                        await supabaseAdmin.from('grading_systems').delete().eq('id', result.id);
                        return handleDatabaseError(assignError, 'grading system');
                    }
                }

                return NextResponse.json({ success: true, data: result });
            },

            subject: async () => {
                if (!schoolId) return NextResponse.json({ error: 'No school set up yet.' }, { status: 400 });
                const data = subjectSchema.parse(payload);
                const { data: result, error } = await supabaseAdmin
                    .from('subjects')
                    .insert({
                        code: data.code,
                        name: data.name,
                        academic_level_id: data.academic_level_id,
                        subject_type: data.subject_type ?? 'CORE',
                        display_order: data.display_order ?? 0,
                        category: data.category ?? 'TECHNICAL',
                        school_id: schoolId,
                        grading_system_id: data.grading_system_id ?? null
                    })
                    .select().single();
                if (error) return handleDatabaseError(error, 'subject');
                return NextResponse.json({ success: true, data: result });
            },

            grading_scale: async () => {
                if (!schoolId) return NextResponse.json({ error: 'No school set up yet.' }, { status: 400 });
                const data = gradingScaleSchema.parse(payload);

                // Only the owning school can add rows to its own grading system —
                // the shared national-default templates (school_id NULL) are read-only.
                const { data: system } = await supabaseAdmin
                    .from('grading_systems')
                    .select('school_id')
                    .eq('id', data.grading_system_id)
                    .maybeSingle();
                if (!system || system.school_id !== schoolId) {
                    return NextResponse.json({ error: 'Grading system not found or not editable.' }, { status: 404 });
                }

                const { data: result, error } = await supabaseAdmin
                    .from('grading_scales')
                    .insert({ grading_system_id: data.grading_system_id, symbol: data.symbol, label: data.label, min_percentage: data.min_percentage, max_percentage: data.max_percentage, points: data.points ?? null, order_index: data.order_index })
                    .select().single();
                if (error) return handleDatabaseError(error, 'grading scale');
                return NextResponse.json({ success: true, data: result });
            },

            // ── SCHOOL-SCOPED: always attach school_id ──────────────

            academic_year: async () => {
                if (!schoolId) return NextResponse.json({ error: 'No school set up yet. Create your school first in Settings.' }, { status: 400 });
                const data = academicYearSchema.parse(payload);
                const { data: result, error } = await supabaseAdmin
                    .from('academic_years')
                    .insert({ name: data.name, start_date: data.start_date, end_date: data.end_date, school_id: schoolId })
                    .select().single();
                if (error) return handleDatabaseError(error, 'academic year');
                return NextResponse.json({ success: true, data: result });
            },

            term: async () => {
                if (!schoolId) return NextResponse.json({ error: 'No school set up yet.' }, { status: 400 });
                const data = termSchema.parse(payload);
                const { data: result, error } = await supabaseAdmin
                    .from('terms')
                    .insert({ academic_year_id: data.academic_year_id, name: data.name, start_date: data.start_date, end_date: data.end_date, is_current: data.is_current ?? false, school_id: schoolId })
                    .select().single();
                if (error) return handleDatabaseError(error, 'term');
                return NextResponse.json({ success: true, data: result });
            },

            stream: async () => {
                if (!schoolId) return NextResponse.json({ error: 'No school set up yet.' }, { status: 400 });
                const data = streamSchema.parse(payload);
                const { data: result, error } = await supabaseAdmin
                    .from('grade_streams')
                    .insert({ grade_id: data.grade_id, name: data.name, full_name: data.full_name || data.name, school_id: schoolId })
                    .select().single();
                if (error) return handleDatabaseError(error, 'stream');
                return NextResponse.json({ success: true, data: result });
            },

            subject_combination: async () => {
                if (!schoolId) return NextResponse.json({ error: 'No school set up yet.' }, { status: 400 });
                const data = subjectCombinationSchema.parse(payload);

                // Electives must be real subjects of this school
                const { data: validSubjects } = await supabaseAdmin
                    .from('subjects')
                    .select('id')
                    .eq('school_id', schoolId)
                    .in('id', data.subject_ids);
                if ((validSubjects ?? []).length !== 3) {
                    return NextResponse.json({ error: 'All 3 elective subjects must belong to your school.' }, { status: 400 });
                }

                const { data: combination, error } = await supabaseAdmin
                    .from('subject_combinations')
                    .insert({
                        school_id: schoolId,
                        code: data.code,
                        name: data.name,
                        pathway: data.pathway,
                        track: data.track ?? null,
                        is_active: data.is_active ?? true,
                    })
                    .select().single();
                if (error) return handleDatabaseError(error, 'subject combination');

                const { error: junctionError } = await supabaseAdmin
                    .from('subject_combination_subjects')
                    .insert(data.subject_ids.map(subject_id => ({ combination_id: combination.id, subject_id })));
                if (junctionError) {
                    // Manual rollback — keep combination + electives atomic
                    await supabaseAdmin.from('subject_combinations').delete().eq('id', combination.id);
                    return handleDatabaseError(junctionError, 'subject combination');
                }

                return NextResponse.json({ success: true, data: combination });
            },
        };

        const handler = handlers[type];
        if (!handler) {
            return NextResponse.json({ error: `Invalid type. Use: ${Object.keys(handlers).join(', ')}` }, { status: 400 });
        }

        return await handler();
    } catch (err: unknown) {
        if (err instanceof ZodError) return handleZodError(err);
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { type, id, ...payload } = body as { type: string; id: string } & Record<string, unknown>;

        if (!type || !id) {
            return NextResponse.json({ error: 'type and id are required' }, { status: 400 });
        }

        const auth = await getLatestSession();
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (auth.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Only admins can update academic structure.' }, { status: 403 });
        }

        const { schoolId } = auth;
        if (!schoolId) {
            return NextResponse.json({ error: 'No school set up yet.' }, { status: 400 });
        }

        const supabaseAdmin = createSupabaseAdmin();

        // Global reference data (grade levels, academic levels) is shared across
        // all schools and must not be editable per-school.
        if (GLOBAL_REFERENCE_TYPES.includes(type)) {
            return NextResponse.json({ error: 'Grade levels and academic levels are centrally managed and cannot be modified here.' }, { status: 403 });
        }

        // grading_scale rows don't carry their own school_id — ownership is via
        // their parent grading_system, so it needs its own lookup rather than
        // the generic schoolScopedTables path below.
        if (type === 'grading_scale') {
            const { data: scaleRow } = await supabaseAdmin
                .from('grading_scales')
                .select('grading_system_id, grading_systems!inner(school_id)')
                .eq('id', id)
                .maybeSingle();
            const ownerSchoolId = (scaleRow as any)?.grading_systems?.school_id;
            if (!scaleRow || ownerSchoolId !== schoolId) {
                return NextResponse.json({ error: 'Not found or access denied' }, { status: 404 });
            }

            const updateData: Record<string, any> = {};
            if (payload.symbol !== undefined) updateData.symbol = payload.symbol;
            if (payload.label !== undefined) updateData.label = payload.label;
            if (payload.min_percentage !== undefined) updateData.min_percentage = payload.min_percentage;
            if (payload.max_percentage !== undefined) updateData.max_percentage = payload.max_percentage;
            if (payload.points !== undefined) updateData.points = payload.points;
            if (payload.order_index !== undefined) updateData.order_index = payload.order_index;
            if (Object.keys(updateData).length === 0) {
                return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
            }

            const { data: result, error } = await supabaseAdmin
                .from('grading_scales')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();
            if (error) return handleDatabaseError(error, 'grading scale');
            return NextResponse.json({ success: true, data: result });
        }

        // Sync which subjects belong to a grading system's group in one shot:
        // subjects in `subject_ids` get linked to it, subjects that were
        // linked but are no longer in the list get cleared back to no
        // grading system assigned.
        if (type === 'grading_system_subjects') {
            const { data: system } = await supabaseAdmin
                .from('grading_systems')
                .select('school_id')
                .eq('id', id)
                .maybeSingle();
            if (!system || system.school_id !== schoolId) {
                return NextResponse.json({ error: 'Grading system not found or not editable.' }, { status: 404 });
            }

            const subjectIds = Array.isArray(payload.subject_ids) ? (payload.subject_ids as string[]) : [];

            if (subjectIds.length > 0) {
                const { data: validSubjects } = await supabaseAdmin
                    .from('subjects')
                    .select('id')
                    .eq('school_id', schoolId)
                    .in('id', subjectIds);
                if ((validSubjects ?? []).length !== subjectIds.length) {
                    return NextResponse.json({ error: 'All subjects must belong to your school.' }, { status: 400 });
                }
            }

            const { error: clearError } = await supabaseAdmin
                .from('subjects')
                .update({ grading_system_id: null })
                .eq('school_id', schoolId)
                .eq('grading_system_id', id)
                .not('id', 'in', `(${subjectIds.length > 0 ? subjectIds.join(',') : '00000000-0000-0000-0000-000000000000'})`);
            if (clearError) return handleDatabaseError(clearError, 'grading system group');

            if (subjectIds.length > 0) {
                const { error: assignError } = await supabaseAdmin
                    .from('subjects')
                    .update({ grading_system_id: id })
                    .eq('school_id', schoolId)
                    .in('id', subjectIds);
                if (assignError) return handleDatabaseError(assignError, 'grading system group');
            }

            return NextResponse.json({ success: true });
        }

        // School-scoped tables that can be updated
        const schoolScopedTables: Record<string, string> = {
            academic_year: 'academic_years',
            term: 'terms',
            stream: 'grade_streams',
            subject: 'subjects',
            subject_combination: 'subject_combinations',
            grading_system: 'grading_systems',
        };

        const table = schoolScopedTables[type];
        if (!table) {
            return NextResponse.json({ error: `Cannot update type "${type}". Updatable types: ${Object.keys(schoolScopedTables).join(', ')}` }, { status: 400 });
        }

        // Verify this record belongs to the admin's school
        const { data: existing } = await supabaseAdmin
            .from(table)
            .select('school_id')
            .eq('id', id)
            .maybeSingle();

        if (!existing || existing.school_id !== schoolId) {
            return NextResponse.json({ error: 'Not found or access denied' }, { status: 404 });
        }

        // Subject combinations need dedicated handling (junction table
        // replacement + re-syncing every assigned student's enrollments)
        if (type === 'subject_combination') {
            const data = subjectCombinationUpdateSchema.parse(payload);
            const comboUpdate: Record<string, any> = {};
            if (data.code !== undefined) comboUpdate.code = data.code;
            if (data.name !== undefined) comboUpdate.name = data.name;
            if (data.pathway !== undefined) comboUpdate.pathway = data.pathway;
            if (data.track !== undefined) comboUpdate.track = data.track;
            if (data.is_active !== undefined) comboUpdate.is_active = data.is_active;

            if (Object.keys(comboUpdate).length === 0 && !data.subject_ids) {
                return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
            }

            let combination: any = null;
            if (Object.keys(comboUpdate).length > 0) {
                const { data: updated, error } = await supabaseAdmin
                    .from('subject_combinations')
                    .update(comboUpdate)
                    .eq('id', id)
                    .select()
                    .single();
                if (error) return handleDatabaseError(error, 'subject combination');
                combination = updated;

                // Keep the denormalized copies on assigned students in step
                if (comboUpdate.pathway !== undefined || comboUpdate.track !== undefined) {
                    const studentSync: Record<string, any> = {};
                    if (comboUpdate.pathway !== undefined) studentSync.pathway = comboUpdate.pathway;
                    if (comboUpdate.track !== undefined) studentSync.track = comboUpdate.track;
                    const { error: propagateError } = await supabaseAdmin
                        .from('students')
                        .update(studentSync)
                        .eq('subject_combination_id', id);
                    if (propagateError) {
                        return NextResponse.json({ error: `Combination updated but student pathway sync failed: ${propagateError.message}` }, { status: 500 });
                    }
                }
            }

            if (data.subject_ids) {
                const { data: validSubjects } = await supabaseAdmin
                    .from('subjects')
                    .select('id')
                    .eq('school_id', schoolId)
                    .in('id', data.subject_ids);
                if ((validSubjects ?? []).length !== 3) {
                    return NextResponse.json({ error: 'All 3 elective subjects must belong to your school.' }, { status: 400 });
                }

                const { error: deleteError } = await supabaseAdmin
                    .from('subject_combination_subjects')
                    .delete()
                    .eq('combination_id', id);
                if (deleteError) return handleDatabaseError(deleteError, 'subject combination');

                const { error: insertError } = await supabaseAdmin
                    .from('subject_combination_subjects')
                    .insert(data.subject_ids.map(subject_id => ({ combination_id: id, subject_id })));
                if (insertError) return handleDatabaseError(insertError, 'subject combination');

                // Electives changed — re-sync enrollments of every assigned student
                await syncCombinationStudents(supabaseAdmin, id, schoolId);
            }

            return NextResponse.json({ success: true, data: combination });
        }

        // Build the update payload based on type
        const updateData: Record<string, any> = {};

        if (type === 'academic_year') {
            if (payload.name !== undefined) updateData.name = payload.name;
            if (payload.start_date !== undefined) updateData.start_date = payload.start_date;
            if (payload.end_date !== undefined) updateData.end_date = payload.end_date;
        } else if (type === 'term') {
            if (payload.name !== undefined) updateData.name = payload.name;
            if (payload.start_date !== undefined) updateData.start_date = payload.start_date;
            if (payload.end_date !== undefined) updateData.end_date = payload.end_date;
            if (payload.is_current !== undefined) updateData.is_current = payload.is_current;
        } else if (type === 'stream') {
            if (payload.name !== undefined) updateData.name = payload.name;
            if (payload.full_name !== undefined) updateData.full_name = payload.full_name;
        } else if (type === 'subject') {
            if (payload.name !== undefined) updateData.name = payload.name;
            if (payload.code !== undefined) updateData.code = payload.code;
            if (payload.category !== undefined) updateData.category = payload.category;
            if (payload.subject_type !== undefined) updateData.subject_type = payload.subject_type;
            if (payload.display_order !== undefined) updateData.display_order = payload.display_order;
            if (payload.grading_system_id !== undefined) updateData.grading_system_id = payload.grading_system_id;
        } else if (type === 'grading_system') {
            if (payload.name !== undefined) updateData.name = payload.name;
            if (payload.description !== undefined) updateData.description = payload.description;
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        const { data: result, error } = await supabaseAdmin
            .from(table)
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) return handleDatabaseError(error, type.replace('_', ' '));

        return NextResponse.json({ success: true, data: result });
    } catch (err: unknown) {
        if (err instanceof ZodError) return handleZodError(err);
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');
        const id = searchParams.get('id');

        if (!type || !id) {
            return NextResponse.json({ error: 'type and id are required as query params' }, { status: 400 });
        }

        const auth = await getLatestSession();
        if (!auth || auth.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized or not an admin' }, { status: 403 });
        }

        const { schoolId } = auth;
        const supabaseAdmin = createSupabaseAdmin();

        // For school-scoped tables, verify ownership before deleting
        const schoolScopedTables: Record<string, string> = {
            academic_year: 'academic_years',
            term: 'terms',
            stream: 'grade_streams',
            subject: 'subjects',
            subject_combination: 'subject_combinations',
            grading_system: 'grading_systems',
        };

        // Global/shared curriculum tables — deletion is blocked for individual school admins
        const globalTypes = ['level', 'grade'];

        if (globalTypes.includes(type)) {
            return NextResponse.json(
                { error: 'Cannot delete shared curriculum data. Contact system administrator.' },
                { status: 403 }
            );
        }

        // grading_scale rows don't carry their own school_id — ownership is via
        // their parent grading_system.
        if (type === 'grading_scale') {
            const { data: scaleRow } = await supabaseAdmin
                .from('grading_scales')
                .select('id, grading_systems!inner(school_id)')
                .eq('id', id)
                .maybeSingle();
            const ownerSchoolId = (scaleRow as any)?.grading_systems?.school_id;
            if (!scaleRow || ownerSchoolId !== schoolId) {
                return NextResponse.json({ error: 'Not found or access denied' }, { status: 404 });
            }
            const { error } = await supabaseAdmin.from('grading_scales').delete().eq('id', id);
            if (error) return NextResponse.json({ error: error.message }, { status: 400 });
            return NextResponse.json({ success: true });
        }

        // Global default grading systems (school_id NULL) are shared national
        // templates — the check below (existing.school_id !== schoolId) already
        // rejects those, since school_id will be null there, not this school's id.

        if (schoolScopedTables[type]) {
            const table = schoolScopedTables[type];
            // Verify this record belongs to the admin's school
            const { data: existing } = await supabaseAdmin
                .from(table)
                .select('school_id')
                .eq('id', id)
                .maybeSingle();

            if (!existing || existing.school_id !== schoolId) {
                return NextResponse.json({ error: 'Not found or access denied' }, { status: 404 });
            }

            if (type === 'subject_combination') {
                // Deleting a combination detaches its students (FK SET NULL).
                // Require an explicit force flag when students are assigned.
                const force = searchParams.get('force') === 'true';
                const { data: assignedStudents } = await supabaseAdmin
                    .from('students')
                    .select('id')
                    .eq('subject_combination_id', id);
                const assignedIds = (assignedStudents ?? []).map(s => s.id);
                if (assignedIds.length > 0 && !force) {
                    return NextResponse.json(
                        {
                            error: `${assignedIds.length} student(s) are assigned to this combination. Reassign them first, or pass force=true to detach them.`,
                            student_count: assignedIds.length,
                        },
                        { status: 409 }
                    );
                }
                if (assignedIds.length > 0) {
                    // Fully detach: clear enrollments and the denormalized
                    // pathway/track so students revert to default behaviour
                    // (the FK only nulls subject_combination_id)
                    const { error: enrollError } = await supabaseAdmin
                        .from('student_subjects')
                        .delete()
                        .in('student_id', assignedIds);
                    if (enrollError) {
                        return NextResponse.json({ error: `Failed to clear student enrollments: ${enrollError.message}` }, { status: 400 });
                    }
                    const { error: detachError } = await supabaseAdmin
                        .from('students')
                        .update({ pathway: null, track: null, subject_combination_id: null })
                        .in('id', assignedIds);
                    if (detachError) {
                        return NextResponse.json({ error: `Failed to detach students: ${detachError.message}` }, { status: 400 });
                    }
                }
            }

            const { error } = await supabaseAdmin.from(table).delete().eq('id', id);
            if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        } else {
            return NextResponse.json({ error: `Invalid type "${type}"` }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}