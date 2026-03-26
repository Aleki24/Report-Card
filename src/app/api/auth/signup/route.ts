import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Public signup endpoint — multi-school support.
 * Any new admin can sign up and create their own school.
 * Each admin then invites their own users via /dashboard/users.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, password, first_name, last_name, school_name } = body;

        if (!email || !password || !first_name || !last_name || !school_name) {
            return NextResponse.json(
                { error: 'All fields are required: email, password, first_name, last_name, school_name' },
                { status: 400 }
            );
        }

        if (password.length < 6) {
            return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
        }

        const supabaseAdmin = createSupabaseAdmin();

        // Check if this email is already registered
        const { data: existingUser } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('email', email.trim())
            .maybeSingle();

        if (existingUser) {
            return NextResponse.json(
                { error: 'An account with this email already exists. Please sign in instead.' },
                { status: 409 }
            );
        }

        // Hash the password
        const passwordHash = await bcrypt.hash(password, 12);

        // Generate a UUID for the new user
        const userId = crypto.randomUUID();

        // Generate a UUID for the new school
        const schoolId = crypto.randomUUID();

        // 1. Create the school first
        const { error: schoolError } = await supabaseAdmin.from('schools').insert({
            id: schoolId,
            name: school_name.trim(),
        });

        if (schoolError) {
            return NextResponse.json({ error: `School error: ${schoolError.message}` }, { status: 400 });
        }

        // 2. Insert into public.users as ADMIN, linked to the new school
        const { error: profileError } = await supabaseAdmin.from('users').insert({
            id: userId,
            first_name,
            last_name,
            email,
            password_hash: passwordHash,
            role: 'ADMIN',
            is_active: true,
            school_id: schoolId,
        });

        if (profileError) {
            // Rollback: delete the orphan school we just created
            await supabaseAdmin.from('schools').delete().eq('id', schoolId);
            return NextResponse.json({ error: `Profile error: ${profileError.message}` }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            message: 'Admin account created! You can now sign in.',
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
