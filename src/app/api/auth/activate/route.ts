import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { createClerkClient } from '@clerk/nextjs/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { code, password, email } = body;

        if (!code?.trim()) {
            return NextResponse.json({ error: 'Invite code is required.' }, { status: 400 });
        }

        if (!password || password.length < 8) {
            return NextResponse.json({ error: 'Password must be at least 8 characters long.' }, { status: 400 });
        }

        const supabaseAdmin = createSupabaseAdmin();

        // 1. Look up the invite code
        const { data: invite, error: inviteError } = await supabaseAdmin
            .from('invite_codes')
            .select('*')
            .eq('code', code.trim().toUpperCase())
            .maybeSingle();

        if (inviteError || !invite) {
            return NextResponse.json({ error: 'Invalid invite code. Please check and try again.' }, { status: 404 });
        }

        if (invite.is_used) {
            return NextResponse.json({ error: 'This invite code has already been used.' }, { status: 400 });
        }

        if (new Date(invite.expires_at) < new Date()) {
            return NextResponse.json({ error: 'This invite code has expired. Please ask your admin for a new one.' }, { status: 400 });
        }

        // 2. Get the user associated with this invite code
        const { data: user, error: userError } = await supabaseAdmin
            .from('users')
            .select('id, first_name, last_name, username, email, role, school_id')
            .eq('id', invite.user_id)
            .maybeSingle();

        if (userError || !user) {
            return NextResponse.json({ error: 'User account not found. Contact your administrator.' }, { status: 404 });
        }

        // 3. Get school name for the email
        const { data: school } = await supabaseAdmin
            .from('schools')
            .select('name')
            .eq('id', user.school_id)
            .maybeSingle();

        // Use provided email or keep the placeholder
        const userEmail = email?.trim() || user.email;

        // 4. Create the Clerk account with the user's chosen password
        const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

        let clerkUserId: string;
        try {
            const clerkUser = await clerkClient.users.createUser({
                username: user.username,
                emailAddress: [userEmail],
                password: password,
                firstName: user.first_name,
                lastName: user.last_name,
                publicMetadata: {
                    role: user.role,
                    school_id: user.school_id
                }
            });
            clerkUserId = clerkUser.id;
        } catch (clerkErr: any) {
            console.error('Clerk activation error:', clerkErr);
            const msg = clerkErr.errors?.[0]?.message || 'Failed to create account. Try a different password.';
            return NextResponse.json({ error: msg }, { status: 400 });
        }

        // 5. Update the user's ID to the Clerk user ID and activate
        const oldUserId = user.id;

        // We need to update all related tables that reference this user ID.
        // The order matters due to foreign key constraints.
        
        // First, update tables that reference users.id
        // Check which role-specific tables exist for this user
        if (user.role === 'STUDENT') {
            await supabaseAdmin.from('students').update({ id: clerkUserId }).eq('id', oldUserId);
        }
        
        // Update class_teachers if any
        await supabaseAdmin.from('class_teachers').update({ user_id: clerkUserId }).eq('user_id', oldUserId);
        
        // Update subject_teachers if any
        await supabaseAdmin.from('subject_teachers').update({ user_id: clerkUserId }).eq('user_id', oldUserId);

        // Update the invite code to point to new ID
        await supabaseAdmin.from('invite_codes').update({ 
            user_id: clerkUserId,
            is_used: true, 
            used_at: new Date().toISOString() 
        }).eq('id', invite.id);

        // Now update the main users table
        // We can't simply update the ID, so we need to delete old + insert new
        const { error: deleteOld } = await supabaseAdmin.from('users').delete().eq('id', oldUserId);
        if (deleteOld) {
            console.error('Failed to delete old user record:', deleteOld);
        }

        const { error: insertNew } = await supabaseAdmin.from('users').insert({
            id: clerkUserId,
            first_name: user.first_name,
            last_name: user.last_name,
            email: userEmail,
            username: user.username,
            role: user.role,
            school_id: user.school_id,
            is_active: true
        });

        if (insertNew) {
            console.error('Failed to insert new user record:', insertNew);
            return NextResponse.json({ error: 'Account created but failed to update records. Contact your administrator.' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'Account activated successfully! You can now log in.',
            username: user.username,
            role: user.role
        });

    } catch (err: unknown) {
        console.error('Activation error:', err);
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
