// src/app/api/school/student/profile/route.ts
// GET: full student profile | PATCH: update safe fields (phone, avatar_url)

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentStudent } from '@/lib/student/get-current-student';
import { getCurrentStudentProfile } from '@/lib/student/queries';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
    try {
        const student = await getCurrentStudent();
        if (!student) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const profile = await getCurrentStudentProfile(student);
        return NextResponse.json({ data: profile });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const student = await getCurrentStudent();
        if (!student) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const body = await request.json();
        const supabase = createSupabaseAdmin();

        // Update phone on users table
        if (body.phone !== undefined) {
            const { error } = await supabase
                .from('users')
                .update({ phone: body.phone })
                .eq('id', student.userId);

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 400 });
            }
        }

        // Update avatar_url on students table
        if (body.avatar_url !== undefined) {
            const { error } = await supabase
                .from('students')
                .update({ avatar_url: body.avatar_url || null })
                .eq('id', student.studentId);

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 400 });
            }
        }

        if (body.phone === undefined && body.avatar_url === undefined) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
