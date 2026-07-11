import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { createClerkClient } from '@clerk/nextjs/server';
import { rateLimit } from '@/lib/rate-limit';

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
        // Unauthenticated endpoint: throttle invite-code guessing per IP
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
        const limit = rateLimit(`register:${ip}`, { maxRequests: 10, windowMs: 60_000 });
        if (!limit.allowed) {
            return NextResponse.json(
                { error: 'Too many attempts. Please wait a minute and try again.' },
                { status: 429 }
            );
        }

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

        // 3. Create user in Clerk
        const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
        let clerkUser;
        try {
            clerkUser = await clerk.users.createUser({
                emailAddress: [email.trim()],
                password,
                firstName: invite.first_name,
                lastName: invite.last_name,
                publicMetadata: { role: invite.role, school_id: invite.school_id },
                skipPasswordChecks: true,
            });
        } catch (clerkErr: any) {
            const msg = clerkErr.errors?.[0]?.longMessage || clerkErr.errors?.[0]?.message || clerkErr.message || 'Failed to create user in Clerk';
            return NextResponse.json({ error: `Clerk error: ${msg}` }, { status: 400 });
        }

        const userId = clerkUser.id;
        const passwordHash = await bcrypt.hash(password, 12);

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
            await clerk.users.deleteUser(userId).catch(() => {});
            return NextResponse.json({ error: `Profile error: ${userInsertError.message}` }, { status: 400 });
        }

        // 5. Create role-specific records
        if (invite.role === 'STUDENT') {
            let admissionNumber = invite.admission_number || `STUDENT-${userId.substring(0, 8)}`;
            let gradeStreamId = invite.grade_stream_id;
            let academicLevelId = invite.academic_level_id;

            if (!gradeStreamId || !academicLevelId) {
                // Find a default academic level and grade stream for this school so the NOT NULL constraints don't fail
                const { data: levelData } = await supabaseAdmin
                    .from('academic_levels')
                    .select('id')
                    .limit(1)
                    .maybeSingle();

                const { data: streamData } = await supabaseAdmin
                    .from('grade_streams')
                    .select(`
                        id,
                        grades!inner (
                            academic_level_id
                        )
                    `)
                    .eq('school_id', invite.school_id)
                    .limit(1)
                    .maybeSingle();

                academicLevelId = academicLevelId || (streamData?.grades as any)?.academic_level_id || levelData?.id;
                gradeStreamId = gradeStreamId || streamData?.id;
            }

            if (!academicLevelId || !gradeStreamId) {
                // Rollback: delete users row and Clerk user
                await supabaseAdmin.from('users').delete().eq('id', userId);
                await clerk.users.deleteUser(userId).catch(() => {});
                return NextResponse.json({ 
                    error: 'School has no classes configured yet. Please ask the administrator to set up class streams first.' 
                }, { status: 400 });
            }

            const { error: studentError } = await supabaseAdmin.from('students').insert({
                id: userId,
                admission_number: admissionNumber.trim(),
                current_grade_stream_id: gradeStreamId,
                academic_level_id: academicLevelId,
            });

            if (studentError) {
                // Rollback: delete users row
                await supabaseAdmin.from('users').delete().eq('id', userId);
                return NextResponse.json({ error: `Student error: ${studentError.message}` }, { status: 400 });
            }
        } else if (invite.role === 'SUBJECT_TEACHER') {
            await supabaseAdmin.from('subject_teachers').insert({
                user_id: userId
            });
        }

        // 6. Delete the pending invite (it's been consumed)
        await supabaseAdmin.from('pending_invites').delete().eq('id', invite.id);

        return NextResponse.json({
            success: true,
            message: `Welcome, ${invite.first_name}! Your account is ready. You can now sign in.`,
        });
    } catch (err: unknown) {
        console.error('Registration error:', err);
        return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 });
    }
}
