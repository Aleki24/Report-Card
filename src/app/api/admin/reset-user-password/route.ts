import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user_id } = await request.json();
    if (!user_id) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // Verify the requester is an admin and get their school_id
    const { data: adminUser } = await supabase
      .from('users')
      .select('role, school_id')
      .eq('id', userId)
      .single();

    if (!adminUser || adminUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can reset passwords' }, { status: 403 });
    }

    // Get the target user's role and verify same school
    const { data: targetUser, error: userError } = await supabase
      .from('users')
      .select('role, first_name, school_id')
      .eq('id', user_id)
      .maybeSingle();

    if (userError || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (targetUser.school_id !== adminUser.school_id) {
      return NextResponse.json({ error: 'User not found in your school' }, { status: 404 });
    }

    if (userError || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Generate new password based on role
    let newPassword = 'password123';
    if (targetUser.role === 'STUDENT') {
      newPassword = 'student';
    } else if (targetUser.role === 'CLASS_TEACHER' || targetUser.role === 'SUBJECT_TEACHER') {
      newPassword = 'teacher';
    } else if (targetUser.role === 'ADMIN') {
      newPassword = 'admin123';
    }

    // Hash the new password
    const bcrypt = await import('bcryptjs');
    const password_hash = await bcrypt.hash(newPassword, 10);

    // Update user with new password
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        password_hash,
        plain_password: newPassword
      })
      .eq('id', user_id);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      password: newPassword,
      message: `Password reset to: ${newPassword}`
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
