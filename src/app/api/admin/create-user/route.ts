import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import crypto from 'crypto';
import { createInviteCode } from '@/lib/invite-codes';

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user_id = userId;
        const body = await request.json();
        const {
            first_name,
            last_name,
            phone,
            role,
            sequence_number,
            admission_number,
            grade_stream_id,
            academic_level_id,
            class_teacher_grade_stream_id, // For class teachers
            subject_teacher_subjects,      // Array of { subject_id, grade_id, grade_stream_id? } for subject teachers
            is_class_teacher               // For subject teachers who are also class teachers
        } = body;

        // Validate required fields
        if (!first_name || !last_name || !phone || !role || sequence_number === undefined) {
            return NextResponse.json(
                { error: 'Missing required fields: first_name, last_name, phone, role, sequence_number' },
                { status: 400 }
            );
        }

        // Validate role is one of the allowed values (prevents arbitrary role strings)
        const ALLOWED_ROLES = ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER', 'STUDENT'];
        if (!ALLOWED_ROLES.includes(role)) {
            return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });
        }

        // Validate student-specific fields
        if (role === 'STUDENT' && (!admission_number || !grade_stream_id || !academic_level_id)) {
            return NextResponse.json(
                { error: 'Students require: admission_number, grade_stream_id, academic_level_id' },
                { status: 400 }
            );
        }

        const supabaseAdmin = createSupabaseAdmin();

        // Verify the user is an ADMIN and get their school_id
        const { data: adminProfile } = await supabaseAdmin
            .from('users')
            .select('role, school_id')
            .eq('id', user_id)
            .maybeSingle();

        // Allow admins and class teachers to create users
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
                .eq('user_id', user_id)
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
        const { data: existingUserOptions } = await supabaseAdmin
            .from('users')
            .select('id, phone')
            .eq('school_id', school_id);

        if (existingUserOptions?.some(u => u.phone === phone.trim())) {
             return NextResponse.json({ error: 'A user with this phone number already exists in your school.' }, { status: 409 });
        }

        if (role === 'STUDENT') {
             const { data: existingStudent } = await supabaseAdmin
                .from('users')
                .select('id, students!inner(admission_number)')
                .eq('school_id', school_id)
                .eq('students.admission_number', admission_number.trim())
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

        // 2. CREATE USER IN DB (no Clerk account — deferred to activation)
        const newUserId = crypto.randomUUID();
        const fakeEmail = `${username}@${school.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.school.local`;

        const { data: newUser, error: insertError } = await supabaseAdmin
            .from('users')
            .insert({
                id: newUserId,
                first_name: first_name.trim(),
                last_name: last_name.trim(),
                phone: phone.trim(),
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
            return NextResponse.json({ error: `Database user creation failed: ${insertError?.message || 'Unknown error'}` }, { status: 500 });
        }

        // 3. CREATE ROLE-SPECIFIC RECORDS
        if (role === 'STUDENT') {
             await supabaseAdmin.from('students').insert({
                 id: newUser.id,
                 admission_number: admission_number.trim(),
                 current_grade_stream_id: grade_stream_id,
                 academic_level_id: academic_level_id,
                 status: 'ACTIVE'
             });
        }

        if (role === 'CLASS_TEACHER' && class_teacher_grade_stream_id) {
             const { data: currentYear } = await supabaseAdmin
                  .from('academic_years')
                  .select('id')
                  .eq('school_id', school_id)
                  .order('start_date', { ascending: false })
                  .limit(1)
                  .single();

             if (currentYear) {
                  await supabaseAdmin.from('class_teachers').insert({
                      user_id: newUser.id,
                      current_grade_stream_id: class_teacher_grade_stream_id,
                      academic_year_id: currentYear.id
                  });
             }
        }

        if ((role === 'SUBJECT_TEACHER' || role === 'CLASS_TEACHER') && subject_teacher_subjects?.length > 0) {
              const { data: tRecord } = await supabaseAdmin.from('subject_teachers').insert({ user_id: newUser.id }).select('id').single();
              if (tRecord) {
                   const currentYear = await supabaseAdmin.from('academic_years').select('id').eq('school_id', school_id).order('start_date', { ascending: false }).limit(1).single();
                   if (currentYear.data) {
                        const assignments = subject_teacher_subjects.map((sub: any) => ({
                             subject_teacher_id: tRecord.id,
                             subject_id: sub.subject_id,
                             grade_id: sub.grade_id,
                             grade_stream_id: sub.grade_stream_id || null,
                             academic_year_id: currentYear.data.id
                        }));
                        await supabaseAdmin.from('subject_teacher_assignments').insert(assignments);
                   }
               }
        }

        // Handle subject teacher who is also a class teacher
        if (role === 'SUBJECT_TEACHER' && is_class_teacher && class_teacher_grade_stream_id) {
             const { data: currentYear } = await supabaseAdmin
                  .from('academic_years')
                  .select('id')
                  .eq('school_id', school_id)
                  .order('start_date', { ascending: false })
                  .limit(1)
                  .single();

             if (currentYear) {
                  await supabaseAdmin.from('class_teachers').insert({
                      user_id: newUser.id,
                      current_grade_stream_id: class_teacher_grade_stream_id,
                      academic_year_id: currentYear.id
                  });
             }
        }

        // 4. Generate invite code (NOT a password)
        const inviteCode = await createInviteCode(supabaseAdmin, newUser.id, school_id, role);

        return NextResponse.json({
            success: true,
            user: { first_name, last_name, role, username },
            credentials: {
                username,
                invite_code: inviteCode
            }
        });
    } catch (err: unknown) {
        console.error('Server error:', err);
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
