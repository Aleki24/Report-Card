import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

async function getSession() {
  const { userId } = await auth();
  if (!userId) return null;

  const supabase = createSupabaseAdmin();
  const { data: userProfile } = await supabase
    .from('users')
    .select('school_id, role')
    .eq('id', userId)
    .maybeSingle();

  if (!userProfile) return null;

  return {
    userId,
    schoolId: userProfile.school_id as string | null,
    role: userProfile.role,
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getSession();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { schoolId } = auth;
    if (!schoolId) return NextResponse.json({ data: [] });

    const supabase = createSupabaseAdmin();

    // Fetch all students with guardian data, scoped to school
    const { data: students, error } = await supabase
      .from('students')
      .select(`
        id, admission_number, guardian_name, guardian_phone, guardian_email, status,
        users!inner (first_name, last_name, school_id),
        grade_streams (full_name)
      `)
      .eq('users.school_id', schoolId)
      .not('guardian_name', 'is', null)
      .order('guardian_name');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Group by unique guardian (using phone as primary key, fallback to name)
    const parentMap: Record<string, {
      id: string;
      name: string;
      phone: string;
      email: string;
      students: { id: string; name: string; admission_number: string; class: string; status: string }[];
    }> = {};

    for (const s of (students || []) as any[]) {
      const guardianName = s.guardian_name?.trim();
      if (!guardianName) continue;

      // Use phone as grouping key if available, otherwise use name
      const key = s.guardian_phone?.trim() || guardianName;

      if (!parentMap[key]) {
        parentMap[key] = {
          id: key,
          name: guardianName,
          phone: s.guardian_phone?.trim() || '',
          email: s.guardian_email?.trim() || '',
          students: [],
        };
      }

      // Update email if current entry is empty but this student has one
      if (!parentMap[key].email && s.guardian_email?.trim()) {
        parentMap[key].email = s.guardian_email.trim();
      }

      parentMap[key].students.push({
        id: s.id,
        name: `${s.users?.first_name || ''} ${s.users?.last_name || ''}`.trim(),
        admission_number: s.admission_number || '',
        class: s.grade_streams?.full_name || '—',
        status: s.status || 'ACTIVE',
      });
    }

    const parents = Object.values(parentMap).sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ data: parents });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
