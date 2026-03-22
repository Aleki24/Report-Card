import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Admin invite-user endpoint.
 * Admin sends phone + name + role → system inserts into `pending_invites` with an invite code.
 * No auth user or public.users row is created — that happens at /register.
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions) as any;
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user_id = session.user.id;
        const body = await request.json();
        const { first_name, last_name, phone, role, admission_number, grade_stream_id, academic_level_id } = body;

        // Validate required fields
        if (!first_name || !last_name || !phone || !role) {
            return NextResponse.json(
                { error: 'Missing required fields: first_name, last_name, phone, role' },
                { status: 400 }
            );
        }

        // Validate student-specific fields
        if (role === 'STUDENT' && (!admission_number || !grade_stream_id || !academic_level_id)) {
            return NextResponse.json(
                { error: 'Students require: admission_number, grade_stream_id, academic_level_id' },
                { status: 400 }
            );
        }

        const supabaseAdmin = createSupabaseAdmin();

        // Verify the user is an ADMIN and get their school_id
        const { data: adminProfile } = await supabaseAdmin
            .from('users')
            .select('role, school_id')
            .eq('id', user_id)
            .single();

        if (!adminProfile || adminProfile.role !== 'ADMIN' || !adminProfile.school_id) {
            return NextResponse.json({ error: 'Only admins with a school can create users.' }, { status: 403 });
        }

        const school_id = adminProfile.school_id;

        // Check if phone already has a pending invite for this school
        const { data: existingInvite } = await supabaseAdmin
            .from('pending_invites')
            .select('id')
            .eq('phone', phone.trim())
            .eq('school_id', school_id)
            .maybeSingle();

        if (existingInvite) {
            return NextResponse.json(
                { error: 'An invite for this phone number already exists in your school.' },
                { status: 409 }
            );
        }

        // Check if phone is already a registered user in this school
        const { data: existingUser } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('phone', phone.trim())
            .eq('school_id', school_id)
            .maybeSingle();

        if (existingUser) {
            return NextResponse.json(
                { error: 'A user with this phone number already exists in your school.' },
                { status: 409 }
            );
        }

        // Generate a 6-digit invite code
        const inviteCode = String(Math.floor(100000 + Math.random() * 900000));

        // Insert into pending_invites (no FK constraints — safe!)
        const insertData: Record<string, unknown> = {
            first_name: first_name.trim(),
            last_name: last_name.trim(),
            phone: phone.trim(),
            role,
            school_id,
            invite_code: inviteCode,
        };

        // Add student-specific fields if applicable
        if (role === 'STUDENT') {
            insertData.admission_number = admission_number;
            insertData.grade_stream_id = grade_stream_id;
            insertData.academic_level_id = academic_level_id;
        }

        const { error: insertError } = await supabaseAdmin.from('pending_invites').insert(insertData);

        if (insertError) {
            return NextResponse.json({ error: `Insert error: ${insertError.message}` }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            invite_code: inviteCode,
            user: { first_name, last_name, phone, role },
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
