import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Self-registration endpoint for invited users.
 * User provides: phone + invite_code + email + password
 * System:
 *   1. Looks up pending_invites by phone + invite_code
 *   2. Hashes the password and generates a UUID
 *   3. Inserts into public.users
 *   4. If student, inserts into students table
 *   5. Deletes the pending invite
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { phone, invite_code, email, password } = body;

        if (!phone || !invite_code || !email || !password) {
            return NextResponse.json(
                { error: 'All fields are required: phone, invite_code, email, password' },
                { status: 400 }
            );
        }

        if (password.length < 6) {
            return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
        }

        const supabaseAdmin = createSupabaseAdmin();

        // 1. Find the pending invite by phone + invite_code
        const { data: invite, error: lookupError } = await supabaseAdmin
            .from('pending_invites')
            .select('*')
            .eq('phone', phone.trim())
            .eq('invite_code', invite_code.trim())
            .maybeSingle();

        if (lookupError || !invite) {
            return NextResponse.json(
                { error: 'Invalid phone number or invite code. Please check with your school administrator.' },
                { status: 404 }
            );
        }

        // 2. Check email isn't already taken in users table
        const { data: emailCheck } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('email', email.trim())
            .maybeSingle();

        if (emailCheck) {
            return NextResponse.json(
                { error: 'This email address is already in use.' },
                { status: 409 }
            );
        }

        // 3. Hash password and generate UUID
        const passwordHash = await bcrypt.hash(password, 12);
        const userId = crypto.randomUUID();

        // 4. Insert into public.users
        const { error: userInsertError } = await supabaseAdmin.from('users').insert({
            id: userId,
            first_name: invite.first_name,
            last_name: invite.last_name,
            email: email.trim(),
            phone: phone.trim(),
            password_hash: passwordHash,
            role: invite.role,
            school_id: invite.school_id,
            is_active: true,
        });

        if (userInsertError) {
            return NextResponse.json({ error: `Profile error: ${userInsertError.message}` }, { status: 400 });
        }

        // 5. If the invite was for a STUDENT, insert into students table
        if (invite.role === 'STUDENT' && invite.admission_number && invite.grade_stream_id && invite.academic_level_id) {
            const { error: studentError } = await supabaseAdmin.from('students').insert({
                id: userId,
                admission_number: invite.admission_number,
                current_grade_stream_id: invite.grade_stream_id,
                academic_level_id: invite.academic_level_id,
            });

            if (studentError) {
                // Rollback: delete users row
                await supabaseAdmin.from('users').delete().eq('id', userId);
                return NextResponse.json({ error: `Student error: ${studentError.message}` }, { status: 400 });
            }
        }

        // 6. Delete the pending invite (it's been consumed)
        await supabaseAdmin.from('pending_invites').delete().eq('id', invite.id);

        return NextResponse.json({
            success: true,
            message: `Welcome, ${invite.first_name}! Your account is ready. You can now sign in.`,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
