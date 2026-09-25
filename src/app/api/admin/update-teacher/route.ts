import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { internalError } from '@/lib/api-errors';

const requiredName = (label: string) => z.string().trim().min(1, `${label} can't be empty.`).max(100);

const updateTeacherSchema = z.object({
    teacher_id: z.string().min(1, 'teacher_id is required'),
    first_name: requiredName('First name').optional(),
    last_name: requiredName('Last name').optional(),
    phone: z.string().trim().max(20).optional(),
    avatar_url: z.string().url().or(z.literal('')).optional(),
});

export async function PATCH(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const parsed = updateTeacherSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request.' }, { status: 400 });
        }
        const { teacher_id, first_name, last_name, phone, avatar_url } = parsed.data;

        const supabaseAdmin = createSupabaseAdmin();

        // Verify the caller is an admin
        const { data: profile } = await supabaseAdmin
            .from('users')
            .select('role, school_id, is_active')
            .eq('id', userId)
            .maybeSingle();

        if (!profile || profile.is_active === false) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (profile.role !== 'ADMIN' || !profile.school_id) {
            return NextResponse.json({ error: 'Only admins can update teachers.' }, { status: 403 });
        }

        // Verify the teacher belongs to this school
        const { data: teacher } = await supabaseAdmin
            .from('users')
            .select('id, school_id')
            .eq('id', teacher_id)
            .eq('school_id', profile.school_id)
            .maybeSingle();

        if (!teacher) {
            return NextResponse.json({ error: 'Teacher not found in your school.' }, { status: 404 });
        }

        // Build update object for users table
        const userUpdates: { first_name?: string; last_name?: string; phone?: string | null; avatar_url?: string | null } = {};
        if (first_name !== undefined) userUpdates.first_name = first_name;
        if (last_name !== undefined) userUpdates.last_name = last_name;
        if (phone !== undefined) userUpdates.phone = phone || null;
        if (avatar_url !== undefined) userUpdates.avatar_url = avatar_url || null;

        if (Object.keys(userUpdates).length > 0) {
            const { error: userError } = await supabaseAdmin
                .from('users')
                .update(userUpdates)
                .eq('id', teacher_id);

            if (userError) return internalError('update-teacher', userError);
        }

        return NextResponse.json({ success: true, message: 'Teacher updated successfully.' });
    } catch (err: unknown) {
        return internalError('update-teacher', err);
    }
}
