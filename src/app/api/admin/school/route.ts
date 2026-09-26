import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { getCaller } from '@/lib/auth-server';
import { internalError } from '@/lib/api-errors';
import { SENIOR_RANK_GROUPS } from '@/lib/ranking';
import { PASS_MARK, PASS_MARK_MAX, PASS_MARK_MIN } from '@/lib/pass-mark';

/** Largest image kept, as a data URL: the settings page shrinks uploads well below this. */
const MAX_IMAGE_CHARS = 400_000;

const optionalText = (max: number) => z.string().trim().max(max).nullish().transform(v => v || null);

/** An inline image (as the settings page uploads) or an https URL; empty clears it. */
const optionalImage = (noun: string) => z.string().max(MAX_IMAGE_CHARS, `That ${noun} is too large; choose a smaller image`).nullish()
    .refine(v => !v || /^data:image\/(png|jpeg|webp|gif);base64,/.test(v) || /^https:\/\//.test(v), `The ${noun} must be an image`)
    .transform(v => v || null);

const schoolUpdateSchema = z.object({
    school_id: z.string().min(1).optional(),
    name: z.string().trim().min(1, 'School name is required').max(150),
    address: optionalText(300),
    phone: optionalText(30),
    email: z.string().trim().max(200).nullish().transform(v => v || null)
        .refine(v => v === null || z.string().email().safeParse(v).success, 'Enter a valid email address'),
    logo_url: optionalImage('logo'),
    motto: optionalText(120),
    principal_name: optionalText(100),
    principal_signature_url: optionalImage('signature'),
    /** Omitted leaves it as is; null resets it to the default. */
    pass_mark: z.number().min(PASS_MARK_MIN, `The pass mark must be ${PASS_MARK_MIN}–${PASS_MARK_MAX}`).max(PASS_MARK_MAX, `The pass mark must be ${PASS_MARK_MIN}–${PASS_MARK_MAX}`).nullish(),
    min_combination_group_size: z.number().int().min(1).max(200).nullish(),
    overall_grading_system_id: z.string().nullish(),
    cbc_ranking_enabled: z.boolean().optional(),
    senior_rank_group: z.enum(SENIOR_RANK_GROUPS).optional(),
});

/**
 * Updates the caller's school profile. Admin-only, and only their own school.
 *
 * This route used to create a school too, for an admin without one. That
 * skipped the platform owner's approval entirely; new schools are requested
 * through onboarding instead, which holds them until they are approved.
 */
export async function POST(request: NextRequest) {
    try {
        const caller = await getCaller();
        if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (caller.role !== 'ADMIN') return NextResponse.json({ error: 'Only admins can manage the school profile.' }, { status: 403 });
        if (!caller.schoolId) {
            return NextResponse.json({ error: 'Set up your school from the onboarding page first.' }, { status: 409 });
        }

        const parsed = schoolUpdateSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid school details.' }, { status: 400 });
        }
        const body = parsed.data;
        if (body.school_id && body.school_id !== caller.schoolId) {
            return NextResponse.json({ error: 'You can only update your own school profile.' }, { status: 403 });
        }

        const supabase = createSupabaseAdmin();
        const { error } = await supabase.from('schools').update({
            name: body.name,
            address: body.address,
            phone: body.phone,
            email: body.email,
            logo_url: body.logo_url,
            motto: body.motto,
            principal_name: body.principal_name,
            principal_signature_url: body.principal_signature_url,
            ...(body.pass_mark !== undefined ? { pass_mark: body.pass_mark ?? PASS_MARK } : {}),
            ...(body.min_combination_group_size != null ? { min_combination_group_size: body.min_combination_group_size } : {}),
            ...(body.overall_grading_system_id !== undefined ? { overall_grading_system_id: body.overall_grading_system_id || null } : {}),
            ...(body.cbc_ranking_enabled !== undefined ? { cbc_ranking_enabled: body.cbc_ranking_enabled } : {}),
            ...(body.senior_rank_group !== undefined ? { senior_rank_group: body.senior_rank_group } : {}),
        }).eq('id', caller.schoolId);
        if (error) return internalError('admin/school update', error);

        return NextResponse.json({ success: true, school_id: caller.schoolId, message: 'School updated' });
    } catch (err: unknown) {
        return internalError('admin/school', err);
    }
}
