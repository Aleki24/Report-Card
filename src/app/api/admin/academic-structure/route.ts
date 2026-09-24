// src/app/api/admin/academic-structure/route.ts (FIXED)
// ============================================================
// KEY FIX: When creating grade_streams, academic_years, and terms,
// we now always attach the admin's school_id to isolate data.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { offerStandardSubjects, StandardSubjectsError } from '@/lib/standard-subjects';
import { subjectsBulkSchema } from '@/lib/schemas';
import { createSchoolCombination, CombinationError } from '@/lib/pathway/combinations';
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
import {
    SCHOOL_SUBJECT_VIEW,
    allOffered,
    clearGradingSystemExcept,
    offerSubjects,
    setGradingSystem,
    stopOffering,
} from '@/lib/school-subjects';

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
                supabaseAdmin.from(SCHOOL_SUBJECT_VIEW).select('*').eq('school_id', schoolId).order('display_order'),
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
                const systemKind = data.system_kind ?? 'SUBJECT';

                // SUBJECT bands are percentages (0-100); OVERALL bands are total
                // points (must not sit inside the 0-100 percentage cap since a
                // best-7 total tops out at 84 but bigger totals are valid).
                if (systemKind === 'SUBJECT' && data.scales) {
                    const bad = data.scales.find(s => s.min_percentage > 100 || s.max_percentage > 100);
                    if (bad) return NextResponse.json({ error: 'Subject grade bands must be between 0 and 100%.' }, { status: 400 });
                }

                const { data: result, error } = await supabaseAdmin
                    .from('grading_systems')
                    .insert({ name: data.name, description: data.description || null, academic_level_id: data.academic_level_id, school_id: schoolId, system_kind: systemKind })
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
                    if (!(await allOffered(supabaseAdmin, schoolId, subjectIds))) {
                        await supabaseAdmin.from('grading_systems').delete().eq('id', result.id);
                        return NextResponse.json({ error: 'All subjects must be offered by your school.' }, { status: 400 });
                    }
                    const { error: assignError } = await setGradingSystem(
                        supabaseAdmin, schoolId, subjectIds, result.id,
                    );
                    if (assignError) {
                        await supabaseAdmin.from('grading_systems').delete().eq('id', result.id);
                        return handleDatabaseError(assignError, 'grading system');
                    }
                }

                return NextResponse.json({ success: true, data: result });
            },

            /**
             * Offer one subject.
             *
             * A school no longer writes its own copy of a subject that already
             * exists. If the catalogue has this code, the school starts
             * offering that row; only a code nothing in the catalogue carries
             * creates a new row, and that one is marked with origin_school_id
             * so it stays private to the school that invented it.
             *
             * This is what stops two schools ending up with two different
             * "Chemistry" rows, which is how an 8-4-4 class came to sit a CBC
             * paper in the first place.
             */
            subject: async () => {
                if (!schoolId) return NextResponse.json({ error: 'No school set up yet.' }, { status: 400 });
                const data = subjectSchema.parse(payload);
                const code = data.code.trim();

                // A standard subject with this code, or this school's own.
                const { data: candidates } = await supabaseAdmin
                    .from('subjects')
                    .select('id, code, origin_school_id')
                    .ilike('code', code)
                    .or(`origin_school_id.is.null,origin_school_id.eq.${schoolId}`);

                const existing = (candidates ?? []).find(
                    row => (row.code || '').trim().toUpperCase() === code.toUpperCase(),
                );

                let result = existing ?? null;
                if (!result) {
                    const { data: created, error: createError } = await supabaseAdmin
                        .from('subjects')
                        .insert({
                            code,
                            name: data.name,
                            academic_level_id: data.academic_level_id,
                            subject_type: data.subject_type ?? 'CORE',
                            display_order: data.display_order ?? 0,
                            category: data.category ?? 'TECHNICAL',
                            origin_school_id: schoolId,
                        })
                        .select().single();
                    if (createError) return handleDatabaseError(createError, 'subject');
                    result = created;
                }
                if (!result) {
                    return NextResponse.json({ error: 'Could not resolve the subject.' }, { status: 500 });
                }
                const subjectId = result.id;

                const { error } = await offerSubjects(supabaseAdmin, schoolId, [subjectId]);
                if (error) return handleDatabaseError(error, 'subject');
                if (data.grading_system_id !== undefined) {
                    await setGradingSystem(supabaseAdmin, schoolId, [subjectId], data.grading_system_id ?? null);
                }
                return NextResponse.json({ success: true, data: result });
            },

            /**
             * Standard subjects for one curriculum band, in one go: the whole
             * band, or just the `codes` ticked in the catalogue checklist.
             *
             * The official CBC and 8-4-4 subjects already live in
             * `subject-definitions` with their real codes, and the form above
             * offers them — one at a time. Most schools did not work through
             * that list; they typed their own names, which produced codes like
             * `MAT(ESSENTIAL)` and `AGRIC_UP` that no curriculum band
             * recognises, so the subject was then offered at every level from
             * Grade 1 to Grade 12.
             *
             * Matching is by code, never by name: `MATH_LP` and `MATH_UP` are
             * both called "Mathematics" and a school running both bands needs
             * both rows.
             */
            subjects_bulk: async () => {
                if (!schoolId) return NextResponse.json({ error: 'No school set up yet.' }, { status: 400 });
                const data = subjectsBulkSchema.parse(payload);
                try {
                    const result = await offerStandardSubjects(supabaseAdmin, schoolId, data.level, data.codes);
                    return NextResponse.json({ success: true, ...result });
                } catch (err) {
                    if (err instanceof StandardSubjectsError) return NextResponse.json({ error: err.message }, { status: 400 });
                    return handleDatabaseError(err, 'subject');
                }
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
                    .insert({ academic_year_id: data.academic_year_id, name: data.name, start_date: data.start_date, end_date: data.end_date, is_current: data.is_current ?? false, midterm_reopening_date: data.midterm_reopening_date || null, reopening_date: data.reopening_date || null, school_id: schoolId })
                    .select().single();
                if (error) return handleDatabaseError(error, 'term');
                return NextResponse.json({ success: true, data: result });
            },

            stream: async () => {
                if (!schoolId) return NextResponse.json({ error: 'No school set up yet.' }, { status: 400 });
                const data = streamSchema.parse(payload);
                // One class per name per grade: a second "East" makes two
                // rooms nobody can tell apart on a mark sheet.
                const { data: sameName } = await supabaseAdmin
                    .from('grade_streams')
                    .select('id')
                    .eq('school_id', schoolId)
                    .eq('grade_id', data.grade_id)
                    .ilike('name', data.name.trim());
                if (sameName && sameName.length > 0) {
                    return NextResponse.json({ error: `This grade already has a class named "${data.name.trim()}".` }, { status: 409 });
                }
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

                try {
                    const combination = await createSchoolCombination(supabaseAdmin, schoolId, {
                        code: data.code,
                        name: data.name,
                        pathway: data.pathway,
                        track: data.track ?? null,
                        subjectIds: data.subject_ids,
                        isActive: data.is_active ?? true,
                    });
                    return NextResponse.json({ success: true, data: combination });
                } catch (err) {
                    if (err instanceof CombinationError) return NextResponse.json({ error: err.message }, { status: 400 });
                    return handleDatabaseError(err, 'subject combination');
                }
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

            if (subjectIds.length > 0 && !(await allOffered(supabaseAdmin, schoolId, subjectIds))) {
                return NextResponse.json({ error: 'All subjects must be offered by your school.' }, { status: 400 });
            }

            const { error: clearError } = await clearGradingSystemExcept(
                supabaseAdmin, schoolId, id, subjectIds,
            );
            if (clearError) return handleDatabaseError(clearError, 'grading system group');

            const { error: assignError } = await setGradingSystem(
                supabaseAdmin, schoolId, subjectIds, id,
            );
            if (assignError) return handleDatabaseError(assignError, 'grading system group');

            return NextResponse.json({ success: true });
        }

        /**
         * Editing a subject.
         *
         * A subject row is shared now, so what a school may change depends on
         * whose row it is. How the school grades it is the school's own
         * business and lives on the offering. The subject's name, code and
         * category are the catalogue's, and changing them would rewrite the
         * subject for every school offering it — allowed only on a row this
         * school invented.
         *
         * subject_type and display_order are deliberately not editable per
         * school: they are catalogue facts now. Restoring a per-school
         * override means one nullable column on school_subjects and a COALESCE
         * in the view, not another migration.
         */
        if (type === 'subject') {
            const offering = await supabaseAdmin
                .from('school_subjects')
                .select('id')
                .eq('school_id', schoolId)
                .eq('subject_id', id)
                .maybeSingle();
            if (!offering.data) {
                return NextResponse.json({ error: 'Not found or access denied' }, { status: 404 });
            }

            if (payload.grading_system_id !== undefined) {
                const { error } = await setGradingSystem(
                    supabaseAdmin, schoolId, [id],
                    (payload.grading_system_id as string | null) || null,
                );
                if (error) return handleDatabaseError(error, 'subject');
            }

            const catalogueEdits: Record<string, unknown> = {};
            if (payload.name !== undefined) catalogueEdits.name = payload.name;
            if (payload.code !== undefined) catalogueEdits.code = payload.code;
            if (payload.category !== undefined) catalogueEdits.category = payload.category;

            if (Object.keys(catalogueEdits).length > 0) {
                const { data: subjectRow } = await supabaseAdmin
                    .from('subjects')
                    .select('origin_school_id')
                    .eq('id', id)
                    .maybeSingle();
                if (subjectRow?.origin_school_id !== schoolId) {
                    return NextResponse.json({
                        error: 'This is a standard subject shared with every school, so its name and code cannot be changed here.',
                    }, { status: 403 });
                }
                const { error } = await supabaseAdmin
                    .from('subjects')
                    .update(catalogueEdits)
                    .eq('id', id)
                    .eq('origin_school_id', schoolId);
                if (error) return handleDatabaseError(error, 'subject');
            }

            return NextResponse.json({ success: true });
        }

        // School-scoped tables that can be updated
        const schoolScopedTables: Record<string, string> = {
            academic_year: 'academic_years',
            term: 'terms',
            stream: 'grade_streams',
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
                if (new Set(data.subject_ids).size !== 3
                    || !(await allOffered(supabaseAdmin, schoolId, data.subject_ids))) {
                    return NextResponse.json({ error: 'All 3 elective subjects must be offered by your school.' }, { status: 400 });
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
            // Reopening dates print on report cards; empty clears them.
            if (payload.midterm_reopening_date !== undefined) updateData.midterm_reopening_date = payload.midterm_reopening_date || null;
            if (payload.reopening_date !== undefined) updateData.reopening_date = payload.reopening_date || null;
        } else if (type === 'stream') {
            if (payload.name !== undefined) updateData.name = payload.name;
            if (payload.full_name !== undefined) updateData.full_name = payload.full_name;
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

        /**
         * Removing a subject unlists it; it does not destroy it.
         *
         * This used to delete the subject row outright, and every FK pointing
         * at it cascades — so one click on "delete subject" silently took its
         * exams and every mark under them with it. A school's reason for the
         * click is almost always "we do not teach this", which is a statement
         * about the offering, not about the history.
         *
         * So: drop the school_subjects row and leave the catalogue, the exams
         * and the marks intact. Refuse outright while exams exist unless the
         * caller is explicit, because an unlisted subject with live exams is
         * confusing in a different way.
         */
        if (type === 'subject') {
            if (!schoolId) {
                return NextResponse.json({ error: 'No school set up yet.' }, { status: 400 });
            }
            const { data: offering } = await supabaseAdmin
                .from('school_subjects')
                .select('id')
                .eq('school_id', schoolId)
                .eq('subject_id', id)
                .maybeSingle();
            if (!offering) {
                return NextResponse.json({ error: 'Not found or access denied' }, { status: 404 });
            }

            const force = searchParams.get('force') === 'true';
            const { count: examCount } = await supabaseAdmin
                .from('exams')
                .select('*', { count: 'exact', head: true })
                .eq('school_id', schoolId)
                .eq('subject_id', id);

            if ((examCount ?? 0) > 0 && !force) {
                return NextResponse.json({
                    error: `This subject has ${examCount} exam(s) recorded. Removing it takes it off your subject list but keeps those results. Pass force=true to confirm.`,
                    examCount,
                }, { status: 409 });
            }

            const { error } = await stopOffering(supabaseAdmin, schoolId, id);
            if (error) return handleDatabaseError(error, 'subject');
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