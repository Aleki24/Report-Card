import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Add or delete academic levels and grades.
 * Uses the admin client to bypass RLS.
 */

// ── CREATE ──
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { type, user_id, ...payload } = body;

        if (!user_id) {
            return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
        }

        const supabaseAdmin = createSupabaseAdmin();

        // Verify the user is an ADMIN
        const { data: userProfile } = await supabaseAdmin
            .from('users')
            .select('role')
            .eq('id', user_id)
            .single();

        if (!userProfile || userProfile.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Only admins can manage academic structure' }, { status: 403 });
        }

        if (type === 'level') {
            const { code, name } = payload;
            if (!code?.trim() || !name?.trim()) {
                return NextResponse.json({ error: 'Code and name are required' }, { status: 400 });
            }

            const { data, error } = await supabaseAdmin.from('academic_levels').insert({
                code: code.trim().toUpperCase(),
                name: name.trim(),
            }).select().single();

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 400 });
            }
            return NextResponse.json({ success: true, data });

        } else if (type === 'grade') {
            const { code, name_display, academic_level_id, numeric_order } = payload;
            if (!code?.trim() || !name_display?.trim() || !academic_level_id || !numeric_order) {
                return NextResponse.json({ error: 'Code, display name, academic level, and order are required' }, { status: 400 });
            }

            const { data, error } = await supabaseAdmin.from('grades').insert({
                code: code.trim(),
                name_display: name_display.trim(),
                academic_level_id,
                numeric_order: parseInt(numeric_order, 10),
            }).select().single();

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 400 });
            }
            return NextResponse.json({ success: true, data });

        } else if (type === 'grading_system') {
            const { name, description, academic_level_id } = payload;
            if (!name?.trim() || !academic_level_id) {
                return NextResponse.json({ error: 'Name and academic level are required' }, { status: 400 });
            }

            const { data, error } = await supabaseAdmin.from('grading_systems').insert({
                name: name.trim(),
                description: description?.trim() || null,
                academic_level_id,
            }).select().single();

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 400 });
            }
            return NextResponse.json({ success: true, data });

        } else if (type === 'grading_scale') {
            const { grading_system_id, symbol, label, min_percentage, max_percentage, points, order_index } = payload;
            if (!grading_system_id || !symbol?.trim() || !label?.trim() || min_percentage == null || max_percentage == null || order_index == null) {
                return NextResponse.json({ error: 'All scale fields are required' }, { status: 400 });
            }

            const { data, error } = await supabaseAdmin.from('grading_scales').insert({
                grading_system_id,
                symbol: symbol.trim(),
                label: label.trim(),
                min_percentage: parseFloat(min_percentage),
                max_percentage: parseFloat(max_percentage),
                points: points != null ? parseInt(points, 10) : null,
                order_index: parseInt(order_index, 10),
            }).select().single();

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 400 });
            }
            return NextResponse.json({ success: true, data });

        } else {
            return NextResponse.json({ error: 'Invalid type. Use "level", "grade", "grading_system", or "grading_scale".' }, { status: 400 });
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// ── DELETE ──
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

        // Verify the user is an ADMIN
        const { data: userProfile } = await supabaseAdmin
            .from('users')
            .select('role')
            .eq('id', user_id)
            .single();

        if (!userProfile || userProfile.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Only admins can delete academic structure' }, { status: 403 });
        }

        if (type === 'level') {
            const { error } = await supabaseAdmin.from('academic_levels').delete().eq('id', id);
            if (error) {
                return NextResponse.json({ error: error.message }, { status: 400 });
            }
            return NextResponse.json({ success: true });

        } else if (type === 'grade') {
            const { error } = await supabaseAdmin.from('grades').delete().eq('id', id);
            if (error) {
                return NextResponse.json({ error: error.message }, { status: 400 });
            }
            return NextResponse.json({ success: true });

        } else {
            return NextResponse.json({ error: 'Invalid type. Use "level" or "grade".' }, { status: 400 });
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
