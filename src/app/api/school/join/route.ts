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
      .single();

    if (userError || !userData || userData.role !== 'PENDING') {
      return NextResponse.json({ error: 'Invalid user state or already assigned a role' }, { status: 403 });
    }

    // 2. Find the school by invite code
    const inviteColumn = role === 'TEACHER' ? 'teacher_invite_code' : 'student_invite_code';
    
    const { data: schoolData, error: schoolError } = await supabaseAdmin
      .from('schools')
      .select('id')
      .eq(inviteColumn, inviteCode.trim())
      .single();

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

    // 4. Update User Role and School ID
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        role: role,
        school_id: schoolId
      })
      .eq('id', userId);

    if (updateError) throw new Error('Failed to update user profile: ' + updateError.message);

    // 5. Create specific role record
    if (role === 'STUDENT') {
      await supabaseAdmin.from('students').insert({
        id: userId,
        admission_number: admissionNumber.trim(),
        status: 'ACTIVE'
        // Note: current_grade_stream_id and academic_level_id would need to be set by an admin later,
        // or we could allow them to select their class during onboarding. For now, they are unassigned.
      });
    } else if (role === 'TEACHER') {
      // Create a basic subject_teacher record (if they are a subject teacher)
      // They will be unassigned initially. The admin can assign classes to them.
    }

    // 6. Update Clerk Metadata
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    await clerk.users.updateUser(userId, {
        publicMetadata: { role: role, school_id: schoolId }
    });

    return NextResponse.json({ success: true, message: 'Successfully joined school' });

  } catch (err: any) {
    console.error('Join Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
