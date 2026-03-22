import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * Create or update a school profile.
 * Uses the admin client to bypass RLS.
 * Verifies the caller is an authenticated ADMIN via their auth token.
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions) as any;
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const user_id = session.user.id;
        const body = await request.json();
        const { name, address, phone, email, school_id } = body;

        if (!name || !name.trim()) {
            return NextResponse.json({ error: 'School name is required' }, { status: 400 });
        }

        const supabaseAdmin = createSupabaseAdmin();

        // Verify the user is an ADMIN
        const { data: userProfile } = await supabaseAdmin
            .from('users')
            .select('role, school_id')
            .eq('id', user_id)
            .single();

        if (!userProfile || userProfile.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Only admins can manage schools' }, { status: 403 });
        }

        if (school_id) {
            // Guard against cross-tenant school updates
            if (userProfile.school_id && userProfile.school_id !== school_id) {
                return NextResponse.json({ error: 'You can only update your own school profile.' }, { status: 403 });
            }

            // Update existing school
            const { error } = await supabaseAdmin.from('schools').update({
                name: name.trim(),
                address: address?.trim() || null,
                phone: phone?.trim() || null,
                email: email?.trim() || null,
            }).eq('id', school_id);

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 400 });
            }

            return NextResponse.json({ success: true, school_id, message: 'School updated' });
        } else {
            // Create new school
            const { data, error } = await supabaseAdmin.from('schools').insert({
                name: name.trim(),
                address: address?.trim() || null,
                phone: phone?.trim() || null,
                email: email?.trim() || null,
            }).select('id').single();

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 400 });
            }

            // Link school to the current user
            await supabaseAdmin.from('users').update({ school_id: data.id }).eq('id', user_id);

            return NextResponse.json({ success: true, school_id: data.id, message: 'School created' });
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
