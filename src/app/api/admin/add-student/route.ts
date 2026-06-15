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
        const { first_name, last_name, admission_number, grade_stream_id, academic_level_id, guardian_phone, guardian_name, guardian_email, gender, date_of_birth, avatar_url } = body;

        if (!first_name?.trim() || !last_name?.trim()) {
            return NextResponse.json({ error: 'First name and last name are required.' }, { status: 400 });
        }
        if (!academic_level_id) {
            return NextResponse.json({ error: 'Academic level is required.' }, { status: 400 });
        }

        const supabaseAdmin = createSupabaseAdmin();

        // Verify the caller is an ADMIN or CLASS_TEACHER
        const { data: adminProfile } = await supabaseAdmin
            .from('users')
            .select('role, school_id')
            .eq('id', user_id)
            .maybeSingle();

        if (!adminProfile || !adminProfile.school_id) {
            return NextResponse.json({ error: 'You must have a school to add students.' }, { status: 403 });
        }

        const isAdmin = adminProfile.role === 'ADMIN';
        const isClassTeacher = adminProfile.role === 'CLASS_TEACHER';

        if (!isAdmin && !isClassTeacher) {
            return NextResponse.json({ error: 'Only admins and class teachers can add students.' }, { status: 403 });
        }

        // If class teacher, verify they're adding a student to their assigned stream
        if (isClassTeacher && grade_stream_id) {
            const { data: teacherAssignment } = await supabaseAdmin
                .from('class_teachers')
                .select('current_grade_stream_id')
                .eq('user_id', user_id)
                .maybeSingle();
            
            if (!teacherAssignment || teacherAssignment.current_grade_stream_id !== grade_stream_id) {
                return NextResponse.json({ error: 'You can only add students to your assigned class stream.' }, { status: 403 });
            }
        }

        const effectiveSchoolId = adminProfile.school_id;

        // Check for duplicate admission number (only if provided)
        const admNo = admission_number?.trim() || null;
        if (admNo) {
            const { data: existingStudent } = await supabaseAdmin
                .from('users')
                .select('id, students!inner(admission_number)')
                .eq('school_id', effectiveSchoolId)
                .eq('students.admission_number', admNo)
                .maybeSingle();

            if (existingStudent) {
                return NextResponse.json({ error: `A student with admission number "${admNo}" already exists in your school.` }, { status: 409 });
            }
        }

        // Get school name for username generation
        const { data: school } = await supabaseAdmin
            .from('schools')
            .select('name')
            .eq('id', effectiveSchoolId)
            .maybeSingle();

        if (!school) {
            return NextResponse.json({ error: 'School not found.' }, { status: 404 });
        }

        // 1. Generate a UUID for the new student (temporary until activation)
        const studentUserId = crypto.randomUUID();
        const finalAdmNo = admNo || null;
        const emailBase = (finalAdmNo || studentUserId.substring(0, 8)).toLowerCase().replace(/[^a-z0-9]/g, '');
        const placeholderEmail = `${emailBase}@student.local`;

        const sequenceMatch = finalAdmNo?.match(/\d+/);
        const sequence_number = sequenceMatch ? parseInt(sequenceMatch[0], 10) : Math.floor(Math.random() * 900) + 100;

        const { generateUsername } = await import('@/lib/generate-username');
        const username = generateUsername(first_name, school.name, sequence_number);

        let uniqueUsername = username;
        const { data: existingUsername } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('username', uniqueUsername)
            .maybeSingle();

        if (existingUsername) {
             uniqueUsername = `${username}${Math.floor(Math.random() * 1000)}`;
        }

        // 2. Insert into public.users (PENDING ACTIVATION — no Clerk account yet)
        const { error: userError } = await supabaseAdmin.from('users').insert({
            id: studentUserId,
            first_name: first_name.trim(),
            last_name: last_name.trim(),
            email: placeholderEmail,
            role: 'STUDENT',
            school_id: effectiveSchoolId,
            username: uniqueUsername,
            is_active: false // Will be activated when user sets their password
        });

        if (userError) {
            return NextResponse.json({ error: `User record creation failed: ${userError.message}` }, { status: 400 });
        }

        // 3. Insert into public.students
        const studentInsert: Record<string, any> = {
            id: studentUserId,
            admission_number: finalAdmNo,
            current_grade_stream_id: grade_stream_id || null,
            academic_level_id: academic_level_id,
            guardian_phone: guardian_phone?.trim() || null,
            guardian_name: guardian_name?.trim() || null,
            guardian_email: guardian_email?.trim() || null,
            gender: gender || null,
            date_of_birth: date_of_birth || null,
        };
        if (avatar_url) studentInsert.avatar_url = avatar_url;

        const { error: studentError } = await supabaseAdmin.from('students').insert(studentInsert);

        if (studentError) {
            // Cleanup: delete user row
            await supabaseAdmin.from('users').delete().eq('id', studentUserId);
            return NextResponse.json({ error: `Student record creation failed: ${studentError.message}` }, { status: 400 });
        }

        // 4. Generate invite code (NOT a password)
        const inviteCode = await createInviteCode(supabaseAdmin, studentUserId, effectiveSchoolId, 'STUDENT');

        return NextResponse.json({
            success: true,
            student_id: studentUserId,
            username: uniqueUsername,
            invite_code: inviteCode,
            admission_number: finalAdmNo,
            message: `Student ${first_name.trim()} ${last_name.trim()} added successfully. Share the invite code for them to activate their account.`,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
