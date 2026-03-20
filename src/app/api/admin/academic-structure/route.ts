import { NextRequest, NextResponse } from 'next/server';
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
} from '@/lib/schemas';

type CreatePayload = Record<string, unknown>;

async function verifyAdmin(supabaseAdmin: ReturnType<typeof createSupabaseAdmin>, userId: string) {
    const { data: userProfile } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();

    return userProfile?.role === 'ADMIN';
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
    return NextResponse.json(
        { error: 'Validation failed', details: messages },
        { status: 400 }
    );
}

export async function GET() {
    try {
        const supabaseAdmin = createSupabaseAdmin();

        const [yearsRes, termsRes, gradesRes, streamsRes, subjectsRes, levelsRes, gsRes, gscRes] = await Promise.all([
            supabaseAdmin.from('academic_years').select('id, name').order('start_date', { ascending: false }),
            supabaseAdmin.from('terms').select('id, name, academic_year_id, start_date, end_date, is_current').order('start_date'),
            supabaseAdmin.from('grades').select('id, name_display, code, academic_level_id, numeric_order').order('numeric_order'),
            supabaseAdmin.from('grade_streams').select('id, name, full_name, grade_id').order('name'),
            supabaseAdmin.from('subjects').select('id, name, code, academic_level_id').order('display_order'),
            supabaseAdmin.from('academic_levels').select('id, code, name').order('code'),
            supabaseAdmin.from('grading_systems').select('*').order('name'),
            supabaseAdmin.from('grading_scales').select('*').order('order_index'),
        ]);

        return NextResponse.json({
            academic_years: yearsRes.data || [],
            terms: termsRes.data || [],
            grades: gradesRes.data || [],
            grade_streams: streamsRes.data || [],
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
        const { type, user_id, ...payload } = body as CreatePayload & { type: string; user_id?: string };

        if (!user_id) {
            return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
        }

        const supabaseAdmin = createSupabaseAdmin();

        const isAdmin = await verifyAdmin(supabaseAdmin, user_id);
        if (!isAdmin) {
            return NextResponse.json({ error: 'Only admins can manage academic structure' }, { status: 403 });
        }

        const handlers: Record<string, () => Promise<NextResponse>> = {
            level: async () => {
                const data = academicLevelSchema.parse(payload);
                const { data: result, error } = await supabaseAdmin
                    .from('academic_levels')
                    .insert({ code: data.code, name: data.name })
                    .select()
                    .single();

                if (error) return handleDatabaseError(error, 'academic level');
                return NextResponse.json({ success: true, data: result });
            },

            grade: async () => {
                const data = gradeSchema.parse(payload);
                const { data: result, error } = await supabaseAdmin
                    .from('grades')
                    .insert({
                        code: data.code,
                        name_display: data.name_display,
                        academic_level_id: data.academic_level_id,
                        numeric_order: data.numeric_order,
                    })
                    .select()
                    .single();

                if (error) return handleDatabaseError(error, 'grade');
                return NextResponse.json({ success: true, data: result });
            },

            grading_system: async () => {
                const data = gradingSystemSchema.parse(payload);
                const { data: result, error } = await supabaseAdmin
                    .from('grading_systems')
                    .insert({
                        name: data.name,
                        description: data.description || null,
                        academic_level_id: data.academic_level_id,
                    })
                    .select()
                    .single();

                if (error) return handleDatabaseError(error, 'grading system');
                return NextResponse.json({ success: true, data: result });
            },

            grading_scale: async () => {
                const data = gradingScaleSchema.parse(payload);
                const { data: result, error } = await supabaseAdmin
                    .from('grading_scales')
                    .insert({
                        grading_system_id: data.grading_system_id,
                        symbol: data.symbol,
                        label: data.label,
                        min_percentage: data.min_percentage,
                        max_percentage: data.max_percentage,
                        points: data.points ?? null,
                        order_index: data.order_index,
                    })
                    .select()
                    .single();

                if (error) return handleDatabaseError(error, 'grading scale');
                return NextResponse.json({ success: true, data: result });
            },

            academic_year: async () => {
                const data = academicYearSchema.parse(payload);
                const { data: result, error } = await supabaseAdmin
                    .from('academic_years')
                    .insert({
                        name: data.name,
                        start_date: data.start_date,
                        end_date: data.end_date,
                    })
                    .select()
                    .single();

                if (error) return handleDatabaseError(error, 'academic year');
                return NextResponse.json({ success: true, data: result });
            },

            term: async () => {
                const data = termSchema.parse(payload);
                const { data: result, error } = await supabaseAdmin
                    .from('terms')
                    .insert({
                        academic_year_id: data.academic_year_id,
                        name: data.name,
                        start_date: data.start_date,
                        end_date: data.end_date,
                        is_current: data.is_current ?? false,
                    })
                    .select()
                    .single();

                if (error) return handleDatabaseError(error, 'term');
                return NextResponse.json({ success: true, data: result });
            },

            stream: async () => {
                const data = streamSchema.parse(payload);
                const { data: result, error } = await supabaseAdmin
                    .from('grade_streams')
                    .insert({
                        grade_id: data.grade_id,
                        name: data.name,
                        full_name: data.full_name || data.name,
                    })
                    .select()
                    .single();

                if (error) return handleDatabaseError(error, 'stream');
                return NextResponse.json({ success: true, data: result });
            },
        };

        const handler = handlers[type];
        if (!handler) {
            return NextResponse.json(
                { error: `Invalid type. Use: ${Object.keys(handlers).join(', ')}` },
                { status: 400 }
            );
        }

        return await handler();
    } catch (err: unknown) {
        if (err instanceof ZodError) {
            return handleZodError(err);
        }
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');
        const id = searchParams.get('id');
        const user_id = searchParams.get('user_id');

        if (!type || !id || !user_id) {
            return NextResponse.json({ error: 'type, id, and user_id are required as query params' }, { status: 400 });
        }

        const supabaseAdmin = createSupabaseAdmin();

        const isAdmin = await verifyAdmin(supabaseAdmin, user_id);
        if (!isAdmin) {
            return NextResponse.json({ error: 'Only admins can delete academic structure' }, { status: 403 });
        }

        const tableMap: Record<string, string> = {
            level: 'academic_levels',
            grade: 'grades',
            grading_system: 'grading_systems',
            grading_scale: 'grading_scales',
            academic_year: 'academic_years',
            term: 'terms',
            stream: 'grade_streams',
        };

        const table = tableMap[type];
        if (!table) {
            return NextResponse.json(
                { error: `Invalid type "${type}". Use: ${Object.keys(tableMap).join(', ')}` },
                { status: 400 }
            );
        }

        const { error } = await supabaseAdmin.from(table).delete().eq('id', id);
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
