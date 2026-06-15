import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { createClerkClient } from '@clerk/nextjs/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { code, clerk_user_id, username: customUsername } = body;

        if (!code?.trim() || !clerk_user_id) {
            return NextResponse.json({ error: 'Invite code and Clerk user ID are required.' }, { status: 400 });
        }

        const supabaseAdmin = createSupabaseAdmin();

        // 1. Look up the invite code
        const { data: invite, error: inviteError } = await supabaseAdmin
            .from('invite_codes')
            .select('*')
            .eq('code', code.trim().toUpperCase())
            .maybeSingle();

        if (inviteError || !invite) {
            return NextResponse.json({ error: 'Invalid invite code.' }, { status: 404 });
        }

        if (invite.is_used) {
            return NextResponse.json({ error: 'This invite code has already been used.' }, { status: 400 });
        }

        if (new Date(invite.expires_at) < new Date()) {
            return NextResponse.json({ error: 'This invite code has expired.' }, { status: 400 });
        }

        // 2. Get the pending user
        const { data: user, error: userError } = await supabaseAdmin
            .from('users')
            .select('id, first_name, last_name, username, email, role, school_id')
            .eq('id', invite.user_id)
            .maybeSingle();

        if (userError || !user) {
            return NextResponse.json({ error: 'User account not found.' }, { status: 404 });
        }

        const finalUsername = customUsername?.trim() || user.username;

        // 3. Update the Clerk user's metadata to include role and school
        const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

        try {
            await clerkClient.users.updateUser(clerk_user_id, {
                username: finalUsername,
                publicMetadata: {
                    role: user.role,
                    school_id: user.school_id
                }
            });
        } catch (clerkErr: any) {
            console.error('Failed to update Clerk user:', clerkErr);
            const msg = clerkErr.errors?.[0]?.message || 'Failed to update account metadata.';
            return NextResponse.json({ error: msg }, { status: 400 });
        }

        // 4. Get the email from Clerk user
        let clerkEmail = user.email;
        try {
            const clerkUser = await clerkClient.users.getUser(clerk_user_id);
            clerkEmail = clerkUser.emailAddresses?.[0]?.emailAddress || user.email;
        } catch { /* use existing email */ }

        // 5. Swap user IDs in database
        const oldUserId = user.id;

        if (user.role === 'STUDENT') {
            await supabaseAdmin.from('students').update({ id: clerk_user_id }).eq('id', oldUserId);
        }
        await supabaseAdmin.from('class_teachers').update({ user_id: clerk_user_id }).eq('user_id', oldUserId);
        await supabaseAdmin.from('subject_teachers').update({ user_id: clerk_user_id }).eq('user_id', oldUserId);

        // Update invite code
        await supabaseAdmin.from('invite_codes').update({
            user_id: clerk_user_id,
            is_used: true,
            used_at: new Date().toISOString()
        }).eq('id', invite.id);

        // Delete old + insert new user
        await supabaseAdmin.from('users').delete().eq('id', oldUserId);

        const { error: insertErr } = await supabaseAdmin.from('users').insert({
            id: clerk_user_id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: clerkEmail,
            username: finalUsername,
            role: user.role,
            school_id: user.school_id,
            is_active: true
        });

        if (insertErr) {
            console.error('Failed to insert new user record:', insertErr);
            return NextResponse.json({ error: 'Account linked but failed to update records.' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'Account activated with Google successfully!',
            role: user.role
        });

    } catch (err: unknown) {
        console.error('Google activation error:', err);
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
