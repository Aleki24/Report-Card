import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '@clerk/nextjs/server';
import { createClerkClient } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { createInviteCode, notifyInviteCode } from '@/lib/invite-codes';

export const runtime = 'nodejs';

// One-time migration: recreates every already-activated account in Clerk's
// Production instance (this app went live on Clerk Development and only
// later got a custom domain + Production environment) and re-points every
// table that references users(id)/students(id) to the new Clerk-issued ID.
//
// Clerk never exposes password hashes, even to the app that owns the
// account, so passwords cannot be carried over — every migrated user is
// created with skipPasswordRequirement and gets a fresh invite code to set
// one, reusing the existing invite-code activation flow.
//
// Safety: the OLD row (and its OLD id) is only deleted after every
// dependent table has been confirmed re-pointed to the NEW id, in the same
// insert-new -> repoint-children -> delete-old order src/app/api/auth/activate/route.ts
// already uses for first-time activation — a failure partway through
// leaves both old and new data intact (harmlessly duplicated) rather than
// losing anything, and is safe to retry.
export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabaseAdmin = createSupabaseAdmin();
        const { data: adminProfile } = await supabaseAdmin
            .from('users')
            .select('role, school_id, is_active')
            .eq('id', userId)
            .maybeSingle();

        if (!adminProfile || adminProfile.is_active === false) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (adminProfile.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Only admins can run this migration.' }, { status: 403 });
        }

        // This is a destructive one-off platform maintenance operation that
        // deletes and recreates user rows. It must NOT be reachable by an
        // ordinary logged-in admin: gate it behind a server-side operator
        // secret (set MIGRATION_SECRET in the environment and pass it as the
        // x-migration-secret header when running the migration). Without this,
        // any single school's admin could fire a platform-wide account
        // rebuild. Constant-time compare so the secret can't be probed.
        const migrationSecret = process.env.MIGRATION_SECRET;
        const providedSecret = request.headers.get('x-migration-secret') || '';
        const secretsMatch = !!migrationSecret
            && providedSecret.length === migrationSecret.length
            && require('crypto').timingSafeEqual(Buffer.from(providedSecret), Buffer.from(migrationSecret));
        if (!secretsMatch) {
            return NextResponse.json({ error: 'This maintenance endpoint requires an operator secret.' }, { status: 403 });
        }

        if (!process.env.CLERK_SECRET_KEY_PROD) {
            return NextResponse.json({ error: 'CLERK_SECRET_KEY_PROD is not configured in this environment.' }, { status: 500 });
        }

        const body = await request.json().catch(() => ({}));
        const dryRun: boolean = body.dryRun !== false; // default true — must explicitly opt out
        const targetUserId: string | undefined = body.targetUserId;
        const sendNotifications: boolean = body.sendNotifications === true;

        const clerkProd = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY_PROD });

        // is_active also covers students who are simply enrolled/graded without
        // ever personally logging in, so it's not a signal of "has a Clerk
        // account." A Clerk-issued id always looks like "user_...", unlike the
        // random UUID a pending/never-activated row keeps — that's the only
        // reliable way to find accounts that actually need migrating.
        let query = supabaseAdmin
            .from('users')
            .select('id, first_name, last_name, username, email, phone, role, school_id, is_active')
            .eq('is_active', true)
            .like('id', 'user\\_%');
        if (targetUserId) query = query.eq('id', targetUserId);

        const { data: users, error: usersErr } = await query;
        if (usersErr) return NextResponse.json({ error: usersErr.message }, { status: 500 });

        const results: Array<Record<string, unknown>> = [];

        for (const user of users || []) {
            if (dryRun) {
                results.push({ id: user.id, username: user.username, role: user.role, action: 'would-migrate' });
                continue;
            }

            try {
                const oldId = user.id;
                const hasRealEmail = !!user.email && !user.email.endsWith('.school.local');

                // Idempotent: if a Production user tagged with this old id
                // already exists, reuse it instead of creating a duplicate.
                const existing = await clerkProd.users.getUserList({ externalId: [oldId] });
                let clerkUserId: string;
                if (existing.data.length > 0) {
                    clerkUserId = existing.data[0].id;
                } else {
                    const created = await clerkProd.users.createUser({
                        externalId: oldId,
                        username: user.username,
                        emailAddress: hasRealEmail ? [user.email as string] : undefined,
                        firstName: user.first_name,
                        lastName: user.last_name,
                        skipPasswordRequirement: true,
                        publicMetadata: { role: user.role, school_id: user.school_id },
                    });
                    clerkUserId = created.id;
                }

                if (clerkUserId === oldId) {
                    results.push({ id: oldId, action: 'already-migrated' });
                    continue;
                }

                // 1. Free the unique email/username held by the old row so the
                // new row can be inserted while the old one still exists —
                // same reason src/app/api/auth/activate/route.ts does this.
                const { error: renameErr } = await supabaseAdmin.from('users').update({
                    email: `pending+${oldId}@migrating.local`,
                    username: null,
                }).eq('id', oldId);
                if (renameErr) throw new Error(`stage old row: ${renameErr.message}`);

                // 2. Insert the new users row.
                const { error: upsertErr } = await supabaseAdmin.from('users').upsert({
                    id: clerkUserId,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    email: user.email,
                    username: user.username,
                    phone: user.phone,
                    role: user.role,
                    school_id: user.school_id,
                    is_active: true,
                }, { onConflict: 'id' });
                if (upsertErr) throw new Error(`users upsert: ${upsertErr.message}`);

                if (user.role === 'STUDENT') {
                    const { data: oldStudent, error: fetchErr } = await supabaseAdmin
                        .from('students')
                        .select('*')
                        .eq('id', oldId)
                        .maybeSingle();
                    if (fetchErr) throw new Error(`students fetch: ${fetchErr.message}`);

                    if (oldStudent) {
                        const { id: _oldStudentId, ...studentFields } = oldStudent;
                        const { error: sErr } = await supabaseAdmin
                            .from('students')
                            .upsert({ id: clerkUserId, ...studentFields }, { onConflict: 'id' });
                        if (sErr) throw new Error(`students upsert: ${sErr.message}`);

                        // Every table hanging off a student's academic history.
                        for (const table of ['exam_marks', 'report_cards', 'performance_history', 'student_fees', 'exam_mark_components', 'student_subjects']) {
                            const { error } = await supabaseAdmin.from(table).update({ student_id: clerkUserId }).eq('student_id', oldId);
                            if (error) throw new Error(`${table} repoint: ${error.message}`);
                        }

                        const { error: delStudentErr } = await supabaseAdmin.from('students').delete().eq('id', oldId);
                        if (delStudentErr) throw new Error(`old students delete: ${delStudentErr.message}`);
                    }
                } else {
                    const { error: ctErr } = await supabaseAdmin.from('class_teachers').update({ user_id: clerkUserId }).eq('user_id', oldId);
                    if (ctErr) throw new Error(`class_teachers repoint: ${ctErr.message}`);
                    const { error: stErr } = await supabaseAdmin.from('subject_teachers').update({ user_id: clerkUserId }).eq('user_id', oldId);
                    if (stErr) throw new Error(`subject_teachers repoint: ${stErr.message}`);
                    const { error: exErr } = await supabaseAdmin.from('exams').update({ created_by_teacher_id: clerkUserId }).eq('created_by_teacher_id', oldId);
                    if (exErr) throw new Error(`exams repoint: ${exErr.message}`);
                    const { error: rc1Err } = await supabaseAdmin.from('report_cards').update({ class_teacher_id: clerkUserId }).eq('class_teacher_id', oldId);
                    if (rc1Err) throw new Error(`report_cards.class_teacher_id repoint: ${rc1Err.message}`);
                    const { error: rc2Err } = await supabaseAdmin.from('report_cards').update({ generated_by_user_id: clerkUserId }).eq('generated_by_user_id', oldId);
                    if (rc2Err) throw new Error(`report_cards.generated_by_user_id repoint: ${rc2Err.message}`);
                }

                await supabaseAdmin.from('invite_codes').update({ user_id: clerkUserId }).eq('user_id', oldId);

                // Everything that referenced the old id has been repointed —
                // safe to remove it now.
                const { error: delOldErr } = await supabaseAdmin.from('users').delete().eq('id', oldId);
                if (delOldErr) throw new Error(`old users delete: ${delOldErr.message}`);

                const { data: school } = await supabaseAdmin.from('schools').select('name').eq('id', user.school_id).maybeSingle();
                const code = await createInviteCode(supabaseAdmin, clerkUserId, user.school_id, user.role);
                let notified = { sms: false, email: false };
                if (sendNotifications) {
                    notified = await notifyInviteCode({
                        phone: user.phone,
                        email: hasRealEmail ? user.email : null,
                        firstName: user.first_name,
                        schoolName: school?.name || 'your school',
                        code,
                    });
                }

                results.push({ id: oldId, newId: clerkUserId, username: user.username, role: user.role, action: 'migrated', inviteCode: code, notified });
            } catch (err: unknown) {
                results.push({ id: user.id, username: user.username, action: 'error', error: err instanceof Error ? err.message : String(err) });
            }
        }

        return NextResponse.json({ dryRun, count: results.length, results });
    } catch (err: unknown) {
        console.error('migrate-clerk-production error:', err);
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Migration failed' }, { status: 500 });
    }
}
