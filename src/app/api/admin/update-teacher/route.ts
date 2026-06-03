import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export async function PATCH(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { 
            teacher_id, 
            first_name, 
            last_name, 
            phone,
            avatar_url,
        } = body;

        if (!teacher_id) {
            return NextResponse.json({ error: 'teacher_id is required' }, { status: 400 });
        }

        const supabaseAdmin = createSupabaseAdmin();

        // Verify the caller is an admin
        const { data: profile } = await supabaseAdmin
            .from('users')
            .select('role, school_id')
            .eq('id', userId)
            .maybeSingle();

        if (!profile || profile.role !== 'ADMIN' || !profile.school_id) {
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
        const userUpdates: Record<string, any> = {};
        if (first_name !== undefined) userUpdates.first_name = first_name?.trim() || null;
        if (last_name !== undefined) userUpdates.last_name = last_name?.trim() || null;
        if (phone !== undefined) userUpdates.phone = phone?.trim() || null;
        if (avatar_url !== undefined) userUpdates.avatar_url = avatar_url || null;

        if (Object.keys(userUpdates).length > 0) {
            const { error: userError } = await supabaseAdmin
                .from('users')
                .update(userUpdates)
                .eq('id', teacher_id);

            if (userError) {
                return NextResponse.json({ error: `Update failed: ${userError.message}` }, { status: 400 });
            }
        }

        return NextResponse.json({ success: true, message: 'Teacher updated successfully.' });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
