import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import crypto from 'crypto';
import { createInviteCode, notifyInviteCode } from '@/lib/invite-codes';
import { inviteUserSchema } from '@/lib/schemas';

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const parsed = inviteUserSchema.safeParse(await request.json());
        if (!parsed.success) {
            const message = parsed.error.issues[0]?.message || 'Invalid request body';
            return NextResponse.json({ error: message }, { status: 400 });
        }
        const {
            first_name,
            last_name,
            phone,
            role,
            sequence_number,
            admission_number,
            grade_stream_id,
            academic_level_id,
            class_teacher_grade_stream_id,
            subject_teacher_subjects,
            is_class_teacher,
        } = parsed.data;

        // Validate role is one of the allowed values (prevents arbitrary role strings)
        const ALLOWED_ROLES = ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER', 'STUDENT'];
        if (!ALLOWED_ROLES.includes(role)) {
            return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });
        }

        // Validate student-specific fields
        if (role === 'STUDENT' && (!admission_number || !grade_stream_id || !academic_level_id)) {
            return NextResponse.json(
                { error: 'Admission number, class stream, and academic level are required for students.' },
                { status: 400 }
            );
        }

        const supabaseAdmin = createSupabaseAdmin();

        // Verify the caller can create users and get their school_id
        const { data: adminProfile } = await supabaseAdmin
            .from('users')
            .select('role, school_id')
            .eq('id', userId)
            .maybeSingle();

        if (!adminProfile || !adminProfile.school_id) {
            return NextResponse.json({ error: 'User must have a school to create users.' }, { status: 403 });
        }

        const canCreateUsers = adminProfile.role === 'ADMIN' || adminProfile.role === 'CLASS_TEACHER';
        if (!canCreateUsers) {
            return NextResponse.json({ error: 'Only admins and class teachers can create users.' }, { status: 403 });
        }

        // Class teachers may only create STUDENT accounts — never teachers or admins.
        // (Only ADMINs can create privileged accounts.) Prevents privilege escalation.
        if (adminProfile.role === 'CLASS_TEACHER' && role !== 'STUDENT') {
            return NextResponse.json({ error: 'Class teachers can only add students.' }, { status: 403 });
        }

        // If class teacher, verify they're creating a student for their assigned stream
        if (adminProfile.role === 'CLASS_TEACHER' && role === 'STUDENT') {
            const { data: teacherAssignment } = await supabaseAdmin
                .from('class_teachers')
                .select('current_grade_stream_id')
                .eq('user_id', userId)
                .maybeSingle();

            if (!teacherAssignment || teacherAssignment.current_grade_stream_id !== grade_stream_id) {
                return NextResponse.json({ error: 'You can only add students to your assigned class stream.' }, { status: 403 });
            }
        }

        const school_id = adminProfile.school_id;

        // Get school name for username generation
        const { data: school } = await supabaseAdmin
            .from('schools')
            .select('name')
            .eq('id', school_id)
            .maybeSingle();

        if (!school) {
            return NextResponse.json({ error: 'School not found.' }, { status: 404 });
        }

        // Check if phone is already registered in this school
        const { data: existingPhone } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('school_id', school_id)
            .eq('phone', phone)
            .maybeSingle();

        if (existingPhone) {
            return NextResponse.json({ error: 'A user with this phone number already exists in your school.' }, { status: 409 });
        }

        if (role === 'STUDENT') {
            const { data: existingStudent } = await supabaseAdmin
                .from('users')
                .select('id, students!inner(admission_number)')
                .eq('school_id', school_id)
                .eq('students.admission_number', admission_number!)
                .maybeSingle();
            if (existingStudent) {
                return NextResponse.json({ error: 'A student with this admission number already exists in your school.' }, { status: 409 });
            }
        }

        // 1. GENERATE USERNAME
        const { generateUsername } = await import('@/lib/generate-username');
        const username = generateUsername(first_name, school.name, sequence_number);

        // Check uniqueness
        const { data: existingUsername } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('username', username)
            .maybeSingle();

        if (existingUsername) {
            return NextResponse.json({ error: 'Generated username already exists. Please use a different sequence number.' }, { status: 409 });
        }

        // Fetch the current academic year once — needed for teacher assignments
        const needsAcademicYear = role === 'CLASS_TEACHER'
            || role === 'SUBJECT_TEACHER'
            || (subject_teacher_subjects?.length ?? 0) > 0;
        let currentYearId: string | null = null;
        if (needsAcademicYear) {
            const { data: currentYear } = await supabaseAdmin
                .from('academic_years')
                .select('id')
                .eq('school_id', school_id)
                .order('start_date', { ascending: false })
                .limit(1)
                .maybeSingle();
            currentYearId = currentYear?.id ?? null;
            if (!currentYearId && (class_teacher_grade_stream_id || (subject_teacher_subjects?.length ?? 0) > 0)) {
                return NextResponse.json({ error: 'No academic year configured. Set up an academic year in Settings before assigning teachers.' }, { status: 400 });
            }
        }

        // 2. CREATE USER IN DB (no Clerk account — deferred to activation)
        const newUserId = crypto.randomUUID();
        const fakeEmail = `${username}@${school.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.school.local`;

        const { data: newUser, error: insertError } = await supabaseAdmin
            .from('users')
            .insert({
                id: newUserId,
                first_name,
                last_name,
                phone,
                role,
                school_id,
                username,
                is_active: false, // Will be activated when user sets their password
                email: fakeEmail,
            })
            .select('id')
            .single();

        if (insertError || !newUser) {
            console.error('Insert error:', insertError);
            return NextResponse.json({ error: 'Failed to create user. Please try again.' }, { status: 500 });
        }

        // Remove the user row and any role records if a later step fails,
        // so we never leave a half-created account behind
        const rollback = async () => {
            const { data: teacherRecord } = await supabaseAdmin
                .from('subject_teachers').select('id').eq('user_id', newUserId).maybeSingle();
            if (teacherRecord) {
                await supabaseAdmin.from('subject_teacher_assignments').delete().eq('subject_teacher_id', teacherRecord.id);
                await supabaseAdmin.from('subject_teachers').delete().eq('id', teacherRecord.id);
            }
            await supabaseAdmin.from('class_teachers').delete().eq('user_id', newUserId);
            await supabaseAdmin.from('students').delete().eq('id', newUserId);
            await supabaseAdmin.from('users').delete().eq('id', newUserId);
        };

        // 3. CREATE ROLE-SPECIFIC RECORDS (every insert checked)
        if (role === 'STUDENT') {
            const { error } = await supabaseAdmin.from('students').insert({
                id: newUser.id,
                admission_number: admission_number!,
                current_grade_stream_id: grade_stream_id,
                academic_level_id: academic_level_id,
                status: 'ACTIVE',
            });
            if (error) {
                console.error('Student record error:', error);
                await rollback();
                return NextResponse.json({ error: 'Failed to create the student record. Please try again.' }, { status: 500 });
            }
        }

        const wantsClassAssignment = class_teacher_grade_stream_id
            && (role === 'CLASS_TEACHER' || (role === 'SUBJECT_TEACHER' && is_class_teacher));
        if (wantsClassAssignment) {
            const { data: existingAssignment } = await supabaseAdmin
                .from('class_teachers')
                .select('id')
                .eq('current_grade_stream_id', class_teacher_grade_stream_id)
                .eq('academic_year_id', currentYearId)
                .maybeSingle();
            if (existingAssignment) {
                await rollback();
                return NextResponse.json({ error: 'This class already has a class teacher assigned for the current academic year. Remove the existing assignment first.' }, { status: 409 });
            }

            const { error } = await supabaseAdmin.from('class_teachers').insert({
                user_id: newUser.id,
                current_grade_stream_id: class_teacher_grade_stream_id,
                academic_year_id: currentYearId,
            });
            if (error) {
                console.error('Class teacher record error:', error);
                await rollback();
                const message = error.code === '23505'
                    ? 'This class already has a class teacher assigned for the current academic year.'
                    : 'Failed to assign the class. Please try again.';
                return NextResponse.json({ error: message }, { status: error.code === '23505' ? 409 : 500 });
            }
        }

        if ((role === 'SUBJECT_TEACHER' || role === 'CLASS_TEACHER') && (subject_teacher_subjects?.length ?? 0) > 0) {
            const { data: tRecord, error: teacherError } = await supabaseAdmin
                .from('subject_teachers')
                .insert({ user_id: newUser.id })
                .select('id')
                .single();
            if (teacherError || !tRecord) {
                console.error('Subject teacher record error:', teacherError);
                await rollback();
                return NextResponse.json({ error: 'Failed to create the teacher record. Please try again.' }, { status: 500 });
            }

            const assignments = subject_teacher_subjects!.map(sub => ({
                subject_teacher_id: tRecord.id,
                subject_id: sub.subject_id,
                grade_id: sub.grade_id,
                grade_stream_id: sub.grade_stream_id || null,
                academic_year_id: currentYearId,
            }));
            const { error: assignError } = await supabaseAdmin.from('subject_teacher_assignments').insert(assignments);
            if (assignError) {
                console.error('Subject assignment error:', assignError);
                await rollback();
                return NextResponse.json({ error: 'Failed to assign subjects. Please try again.' }, { status: 500 });
            }
        }

        // 4. Generate invite code (NOT a password)
        const inviteCode = await createInviteCode(supabaseAdmin, newUser.id, school_id, role);

        // Best-effort delivery — the code is still shown to the admin below
        // regardless of whether this succeeds.
        const notified = await notifyInviteCode({
            phone,
            email: null, // no real email is collected for staff/admin here
            firstName: first_name,
            schoolName: school.name,
            code: inviteCode,
        });

        return NextResponse.json({
            success: true,
            user: { first_name, last_name, role, username },
            credentials: {
                username,
                invite_code: inviteCode,
            },
            notified,
        });
    } catch (err: unknown) {
        console.error('create-user error:', err);
        return NextResponse.json({ error: 'Failed to create user. Please try again.' }, { status: 500 });
    }
}
