// src/app/api/admin/academic-structure/route.ts (FIXED)
// ============================================================
// KEY FIX: When creating grade_streams, academic_years, and terms,
// we now always attach the admin's school_id to isolate data.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
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
} from '@/lib/schemas';

type CreatePayload = Record<string, unknown>;

// Get session and school_id from NextAuth (not from request body)
async function getAdminSession() {
    const session = await getServerSession(authOptions) as any;
    if (!session?.user?.id) return null;
    if (session.user.role !== 'ADMIN') return null;
    return {
        userId: session.user.id,
        schoolId: session.user.schoolId as string | null,
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
        const session = await getServerSession(authOptions) as any;
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const schoolId = session.user.schoolId as string | null;
        const supabaseAdmin = createSupabaseAdmin();

        // Global/shared data (curriculum) — no school filter needed
        const [levelsRes, gradesRes, subjectsRes, gsRes, gscRes] = await Promise.all([
            supabaseAdmin.from('academic_levels').select('id, code, name').order('code'),
            supabaseAdmin.from('grades').select('id, name_display, code, academic_level_id, numeric_order').order('numeric_order'),
            supabaseAdmin.from('subjects').select('id, name, code, academic_level_id').order('display_order'),
            supabaseAdmin.from('grading_systems').select('*').order('name'),
            supabaseAdmin.from('grading_scales').select('*').order('order_index'),
        ]);

        // School-scoped data — filter by school_id
        let yearsData: any[] = [];
        let termsData: any[] = [];
        let streamsData: any[] = [];

        if (schoolId) {
            const [yearsRes, termsRes, streamsRes] = await Promise.all([
                supabaseAdmin.from('academic_years').select('id, name, start_date, end_date').eq('school_id', schoolId).order('start_date', { ascending: false }),
                supabaseAdmin.from('terms').select('id, name, academic_year_id, start_date, end_date, is_current').eq('school_id', schoolId).order('start_date'),
                supabaseAdmin.from('grade_streams').select('id, name, full_name, grade_id, school_id').eq('school_id', schoolId).order('name'),
            ]);
            yearsData = yearsRes.data ?? [];
            termsData = termsRes.data ?? [];
            streamsData = streamsRes.data ?? [];
        }

        return NextResponse.json({
            academic_years: yearsData,
            terms: termsData,
            grades: gradesRes.data || [],
            grade_streams: streamsData,
            subjects: subjectsRes.data || [],
            academic_levels: levelsRes.data || [],
            grading_systems: gsRes.data || [],
            grading_scales: gscRes.data || [],
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

        const session = await getServerSession(authOptions) as any;
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = session.user.id;
        const schoolId = session.user.schoolId as string | null;
        const role = session.user.role;

        // Check role permissions: Teacher can ONLY add 'subject'. Admin can add anything.
        if (role !== 'ADMIN' && !(role === 'TEACHER' && type === 'subject')) {
            return NextResponse.json({ error: 'Unauthorized. Admins only.' }, { status: 403 });
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
                const data = gradingSystemSchema.parse(payload);
                const { data: result, error } = await supabaseAdmin
                    .from('grading_systems')
                    .insert({ name: data.name, description: data.description || null, academic_level_id: data.academic_level_id })
                    .select().single();
                if (error) return handleDatabaseError(error, 'grading system');
                return NextResponse.json({ success: true, data: result });
            },

            subject: async () => {
                const data = subjectSchema.parse(payload);
                const { data: result, error } = await supabaseAdmin
                    .from('subjects')
                    .insert({
                        code: data.code,
                        name: data.name,
                        academic_level_id: data.academic_level_id,
                        is_compulsory: data.is_compulsory ?? true,
                        display_order: data.display_order ?? 0,
                        category: data.category ?? 'OTHER'
                    })
                    .select().single();
                if (error) return handleDatabaseError(error, 'subject');
                return NextResponse.json({ success: true, data: result });
            },

            grading_scale: async () => {
                const data = gradingScaleSchema.parse(payload);
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

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');
        const id = searchParams.get('id');

        if (!type || !id) {
            return NextResponse.json({ error: 'type and id are required as query params' }, { status: 400 });
        }

        const adminSession = await getAdminSession();
        if (!adminSession) {
            return NextResponse.json({ error: 'Unauthorized or not an admin' }, { status: 403 });
        }

        const { schoolId } = adminSession;
        const supabaseAdmin = createSupabaseAdmin();

        // For school-scoped tables, verify ownership before deleting
        const schoolScopedTables: Record<string, string> = {
            academic_year: 'academic_years',
            term: 'terms',
            stream: 'grade_streams',
        };

        const globalTables: Record<string, string> = {
            level: 'academic_levels',
            grade: 'grades',
            subject: 'subjects',
            grading_system: 'grading_systems',
            grading_scale: 'grading_scales',
        };

        if (schoolScopedTables[type]) {
            const table = schoolScopedTables[type];
            // Verify this record belongs to the admin's school
            const { data: existing } = await supabaseAdmin
                .from(table)
                .select('school_id')
                .eq('id', id)
                .single();

            if (!existing || existing.school_id !== schoolId) {
                return NextResponse.json({ error: 'Not found or access denied' }, { status: 404 });
            }

            const { error } = await supabaseAdmin.from(table).delete().eq('id', id);
            if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        } else if (globalTables[type]) {
            const table = globalTables[type];
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