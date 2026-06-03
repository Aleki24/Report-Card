import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { auth, createClerkClient } from '@clerk/nextjs/server';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { role, inviteCode, admissionNumber } = body;

    if (!role || !inviteCode) {
      return NextResponse.json({ error: 'Role and invite code are required' }, { status: 400 });
    }

    if (role === 'STUDENT' && !admissionNumber) {
      return NextResponse.json({ error: 'Admission number is required for students' }, { status: 400 });
    }

    const supabaseAdmin = createSupabaseAdmin();

    // 1. Verify user exists and is PENDING
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, role')
      .eq('id', userId)
      .maybeSingle();

    if (userError || !userData || userData.role !== 'PENDING') {
      return NextResponse.json({ error: 'Invalid user state or already assigned a role' }, { status: 403 });
    }

    // 2. Find the school by invite code
    const inviteColumn = role === 'TEACHER' ? 'teacher_invite_code' : 'student_invite_code';
    
    const { data: schoolData, error: schoolError } = await supabaseAdmin
      .from('schools')
      .select('id')
      .eq(inviteColumn, inviteCode.trim())
      .maybeSingle();

    if (schoolError || !schoolData) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });
    }

    const schoolId = schoolData.id;

    // 3. Verify admission number uniqueness for students
    if (role === 'STUDENT') {
      const { data: existingStudent } = await supabaseAdmin
          .from('users')
          .select('id, students!inner(admission_number)')
          .eq('school_id', schoolId)
          .eq('students.admission_number', admissionNumber.trim())
          .maybeSingle();

      if (existingStudent) {
          return NextResponse.json({ error: 'A student with this admission number already exists in this school.' }, { status: 409 });
      }
    }

    // Map the generic 'TEACHER' role from onboarding to 'SUBJECT_TEACHER'
    // The system expects CLASS_TEACHER or SUBJECT_TEACHER — admin can reassign later
    const mappedRole = role === 'TEACHER' ? 'SUBJECT_TEACHER' : role;

    // 4. Create specific role record FIRST (before updating role, so failure keeps user PENDING)
    if (role === 'STUDENT') {
      // Find a default grade stream and its academic level for this school
      const { data: streamData } = await supabaseAdmin
        .from('grade_streams')
        .select(`
          id,
          grades!inner (
            academic_level_id
          )
        `)
        .eq('school_id', schoolId)
        .limit(1)
        .maybeSingle();

      const academicLevelId = (streamData?.grades as any)?.academic_level_id;
      const gradeStreamId = streamData?.id;

      if (!academicLevelId || !gradeStreamId) {
        return NextResponse.json({ 
          error: 'School has no classes configured yet. Please ask the administrator to set up class streams first.' 
        }, { status: 400 });
      }

      const { error: studentErr } = await supabaseAdmin.from('students').insert({
        id: userId,
        admission_number: admissionNumber.trim(),
        status: 'ACTIVE',
        current_grade_stream_id: gradeStreamId,
        academic_level_id: academicLevelId
      });

      if (studentErr) throw new Error('Failed to create student profile: ' + studentErr.message);
    } else if (role === 'TEACHER') {
      // Create a basic subject_teacher record
      const { error: teacherErr } = await supabaseAdmin.from('subject_teachers').insert({
        user_id: userId
      });
      if (teacherErr) throw new Error('Failed to create teacher profile: ' + teacherErr.message);
    }

    // 5. Update User Role and School ID (only after role-specific record succeeded)
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        role: mappedRole,
        school_id: schoolId
      })
      .eq('id', userId);

    if (updateError) throw new Error('Failed to update user profile: ' + updateError.message);

    // 6. Update Clerk Metadata
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    await clerk.users.updateUser(userId, {
        publicMetadata: { role: mappedRole, school_id: schoolId }
    });

    return NextResponse.json({ success: true, message: 'Successfully joined school' });

  } catch (err: any) {
    console.error('Join Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

