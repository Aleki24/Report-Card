import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { auth } from '@clerk/nextjs/server';
import { isSeniorRankGroup } from '@/lib/ranking';

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const user_id = userId;
        const body = await request.json();
        const { name, address, phone, email, school_id, logo_url, min_combination_group_size, overall_grading_system_id, cbc_ranking_enabled, senior_rank_group } = body;

        if (cbc_ranking_enabled !== undefined && typeof cbc_ranking_enabled !== 'boolean') {
            return NextResponse.json({ error: 'cbc_ranking_enabled must be true or false' }, { status: 400 });
        }
        if (senior_rank_group !== undefined && !isSeniorRankGroup(senior_rank_group)) {
            return NextResponse.json({ error: 'senior_rank_group must be GRADE, PATHWAY or COMBINATION' }, { status: 400 });
        }
        const rankingUpdate = {
            ...(cbc_ranking_enabled !== undefined ? { cbc_ranking_enabled } : {}),
            ...(senior_rank_group !== undefined ? { senior_rank_group } : {}),
        };

        // CBC ministry minimum learners per subject combination (optional)
        let minGroupSize: number | undefined;
        if (min_combination_group_size !== undefined && min_combination_group_size !== null) {
            const parsed = Number(min_combination_group_size);
            if (!Number.isInteger(parsed) || parsed < 1 || parsed > 200) {
                return NextResponse.json({ error: 'min_combination_group_size must be a whole number between 1 and 200' }, { status: 400 });
            }
            minGroupSize = parsed;
        }

        if (!name || !name.trim()) {
            return NextResponse.json({ error: 'School name is required' }, { status: 400 });
        }

        const supabaseAdmin = createSupabaseAdmin();

        // Verify the user is an ADMIN
        const { data: userProfile } = await supabaseAdmin
            .from('users')
            .select('role, school_id, is_active')
            .eq('id', user_id)
            .maybeSingle();

        if (!userProfile || userProfile.is_active === false) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (userProfile.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Only admins can manage schools' }, { status: 403 });
        }

        if (school_id) {
            // Guard against cross-tenant school updates. An admin with no school
            // used to skip this check entirely and could edit any school by id.
            if (userProfile.school_id !== school_id) {
                return NextResponse.json({ error: 'You can only update your own school profile.' }, { status: 403 });
            }

            // Update existing school
            const { error } = await supabaseAdmin.from('schools').update({
                name: name.trim(),
                address: address?.trim() || null,
                phone: phone?.trim() || null,
                email: email?.trim() || null,
                logo_url: logo_url || null,
                ...(minGroupSize !== undefined ? { min_combination_group_size: minGroupSize } : {}),
                ...(overall_grading_system_id !== undefined ? { overall_grading_system_id: overall_grading_system_id || null } : {}),
                ...rankingUpdate,
            }).eq('id', school_id);

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 400 });
            }

            return NextResponse.json({ success: true, school_id, message: 'School updated' });
        } else {
            // Creating a second school would silently detach this admin from
            // the one they run; new schools go through onboarding instead.
            if (userProfile.school_id) {
                return NextResponse.json({ error: 'Your account already belongs to a school.' }, { status: 409 });
            }

            // Create new school
            const { data, error } = await supabaseAdmin.from('schools').insert({
                name: name.trim(),
                address: address?.trim() || null,
                phone: phone?.trim() || null,
                email: email?.trim() || null,
                logo_url: logo_url || null,
                ...(minGroupSize !== undefined ? { min_combination_group_size: minGroupSize } : {}),
                ...rankingUpdate,
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
