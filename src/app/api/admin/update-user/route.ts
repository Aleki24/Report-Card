import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export async function PUT(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions) as any;
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createSupabaseAdmin();

        // Verify admin
        const { data: adminProfile } = await supabase
            .from('users')
            .select('role, school_id')
            .eq('id', session.user.id)
            .single();

        if (!adminProfile || adminProfile.role !== 'ADMIN' || !adminProfile.school_id) {
            return NextResponse.json({ error: 'Only admins can update users.' }, { status: 403 });
        }

        const body = await request.json();
        const {
            user_id,
            first_name,
            last_name,
            phone,
            role,
            is_active,
            // New assignment fields
            class_teacher_grade_stream_id,   // string | null | undefined
            subject_teacher_subjects,         // { subject_id, grade_id }[] | undefined
            is_also_subject_teacher,          // boolean (for class teachers who also teach subjects)
            is_class_teacher,                 // boolean (for subject teachers who are also class teachers)
        } = body;

        if (!user_id) {
            return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
        }

        // Verify the target user belongs to the same school
        const { data: targetUser } = await supabase
            .from('users')
            .select('id, school_id, role')
            .eq('id', user_id)
            .single();

        if (!targetUser || targetUser.school_id !== adminProfile.school_id) {
            return NextResponse.json({ error: 'User not found in your school' }, { status: 404 });
        }

        // Build update payload (only include fields that were provided)
        const updates: Record<string, any> = {};
        if (first_name !== undefined) updates.first_name = first_name.trim();
        if (last_name !== undefined) updates.last_name = last_name.trim();
        if (phone !== undefined) updates.phone = phone.trim();
        if (role !== undefined) updates.role = role;
        if (is_active !== undefined) updates.is_active = is_active;

        // Update user profile if there are changes
        if (Object.keys(updates).length > 0) {
            const { error } = await supabase
                .from('users')
                .update(updates)
                .eq('id', user_id);

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 400 });
            }
        }

        // Get active academic year for this school
        const { data: currentYear } = await supabase
            .from('academic_years')
            .select('id')
            .eq('school_id', adminProfile.school_id)
            .order('start_date', { ascending: false })
            .limit(1)
            .single();

        const effectiveRole = role || targetUser.role;

        // ── Handle Class Teacher assignment ──
        if (class_teacher_grade_stream_id !== undefined) {
            if (class_teacher_grade_stream_id && currentYear) {
                // Upsert: check if record exists
                const { data: existing } = await supabase
                    .from('class_teachers')
                    .select('id')
                    .eq('user_id', user_id)
                    .maybeSingle();

                if (existing) {
                    await supabase
                        .from('class_teachers')
                        .update({
                            current_grade_stream_id: class_teacher_grade_stream_id,
                            academic_year_id: currentYear.id,
                        })
                        .eq('id', existing.id);
                } else {
                    await supabase.from('class_teachers').insert({
                        user_id,
                        current_grade_stream_id: class_teacher_grade_stream_id,
                        academic_year_id: currentYear.id,
                    });
                }
            } else if (class_teacher_grade_stream_id === null || class_teacher_grade_stream_id === '') {
                // Remove class teacher assignment
                await supabase
                    .from('class_teachers')
                    .delete()
                    .eq('user_id', user_id);
            }
        }

        // ── Handle Subject Teacher assignments ──
        if (subject_teacher_subjects !== undefined && currentYear) {
            const validSubjects = (subject_teacher_subjects || []).filter(
                (s: any) => s.subject_id && s.grade_id
            );

            // Get or create subject_teachers record
            let { data: stRecord } = await supabase
                .from('subject_teachers')
                .select('id')
                .eq('user_id', user_id)
                .maybeSingle();

            if (validSubjects.length > 0) {
                // Create subject_teachers record if it doesn't exist
                if (!stRecord) {
                    const { data: newSt } = await supabase
                        .from('subject_teachers')
                        .insert({ user_id })
                        .select('id')
                        .single();
                    stRecord = newSt;
                }

                if (stRecord) {
                    // Delete all existing assignments for this teacher
                    await supabase
                        .from('subject_teacher_assignments')
                        .delete()
                        .eq('subject_teacher_id', stRecord.id);

                    // Insert new assignments
                    const assignments = validSubjects.map((sub: any) => ({
                        subject_teacher_id: stRecord!.id,
                        subject_id: sub.subject_id,
                        grade_id: sub.grade_id,
                        grade_stream_id: sub.grade_stream_id || null,
                        academic_year_id: currentYear.id,
                    }));

                    await supabase.from('subject_teacher_assignments').insert(assignments);
                }
            } else if (stRecord && !is_also_subject_teacher) {
                // No subjects left and not flagged as "also subject teacher" — clean up
                await supabase
                    .from('subject_teacher_assignments')
                    .delete()
                    .eq('subject_teacher_id', stRecord.id);
                // Optionally remove the subject_teachers record too
                // (keeping it is harmless; removing keeps data clean)
                await supabase
                    .from('subject_teachers')
                    .delete()
                    .eq('id', stRecord.id);
            }
        }

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        console.error('Update user error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
