import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as any;
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user_id } = await request.json();
    if (!user_id) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // Get the target user's role to determine password
    const { data: targetUser, error: userError } = await supabase
      .from('users')
      .select('role, first_name')
      .eq('id', user_id)
      .single();

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
