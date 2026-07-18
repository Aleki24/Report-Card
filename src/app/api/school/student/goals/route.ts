// src/app/api/school/student/goals/route.ts
// Self-service study goals — a student sets a personal target (optionally
// tied to a subject and deadline) and tracks/marks it complete themselves.

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentStudent } from '@/lib/student/get-current-student';

export async function GET() {
    try {
        const student = await getCurrentStudent();
        if (!student) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const supabase = createSupabaseAdmin();
        const { data, error } = await supabase
            .from('student_goals')
            .select('id, title, target_value, deadline, completed, created_at, subjects ( id, name )')
            .eq('student_id', student.studentId)
            .order('completed', { ascending: true })
            .order('deadline', { ascending: true, nullsFirst: false });

        if (error) throw error;

        const mapped = (data ?? []).map((g) => ({
            id: g.id,
            title: g.title,
            targetValue: g.target_value != null ? Number(g.target_value) : null,
            deadline: g.deadline,
            completed: g.completed,
            createdAt: g.created_at,
            subjectName: (g.subjects as unknown as { name: string } | null)?.name ?? null,
        }));

        return NextResponse.json({ data: mapped });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const student = await getCurrentStudent();
        if (!student) {
            return NextResponse.json({ error: 'Only students can create goals' }, { status: 403 });
        }

        const body = await request.json();
        if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
            return NextResponse.json({ error: 'title is required' }, { status: 400 });
        }

        const supabase = createSupabaseAdmin();
        const { data, error } = await supabase
            .from('student_goals')
            .insert({
                school_id: student.schoolId,
                student_id: student.studentId,
                subject_id: body.subject_id || null,
                title: body.title.trim(),
                target_value: body.target_value || null,
                deadline: body.deadline || null,
            })
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ data });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const student = await getCurrentStudent();
        if (!student) {
            return NextResponse.json({ error: 'Only students can update goals' }, { status: 403 });
        }

        const body = await request.json();
        if (!body.id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        const supabase = createSupabaseAdmin();
        const { data, error } = await supabase
            .from('student_goals')
            .update({ completed: !!body.completed, updated_at: new Date().toISOString() })
            .eq('id', body.id)
            .eq('student_id', student.studentId)
            .select()
            .maybeSingle();

        if (error) throw error;
        if (!data) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
        return NextResponse.json({ data });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const student = await getCurrentStudent();
        if (!student) {
            return NextResponse.json({ error: 'Only students can delete goals' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        const supabase = createSupabaseAdmin();
        const { error } = await supabase
            .from('student_goals')
            .delete()
            .eq('id', id)
            .eq('student_id', student.studentId);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
