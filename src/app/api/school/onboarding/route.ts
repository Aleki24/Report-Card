import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { auth, createClerkClient } from '@clerk/nextjs/server';
import { sendWelcomeEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabaseAdmin = createSupabaseAdmin();

    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('school_id, role, first_name, email')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (userData.role !== 'ADMIN' && userData.role !== 'PENDING') {
      return NextResponse.json({ error: 'Unauthorized role' }, { status: 403 });
    }

    // Parse payload
    const body = await request.json();
    const { schoolName, schoolEmail, schoolPhone, schoolAddress, academicYear, termName, curriculum, classes, subjects } = body;

    let schoolId = userData.school_id;

    // If PENDING, create the school and upgrade to ADMIN
    if (userData.role === 'PENDING' || !schoolId) {
      if (!schoolName) {
        return NextResponse.json({ error: 'School name is required' }, { status: 400 });
      }

      schoolId = crypto.randomUUID();
      const { error: schoolError } = await supabaseAdmin.from('schools').insert({
          id: schoolId,
          name: schoolName.trim(),
          email: schoolEmail?.trim() || null,
          phone: schoolPhone?.trim() || null,
          address: schoolAddress?.trim() || null,
          onboarding_completed: false // Will be set to true below
      });

      if (schoolError) throw new Error('Failed to create school: ' + schoolError.message);

      const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
      await clerk.users.updateUser(userId, {
          publicMetadata: { role: 'ADMIN', school_id: schoolId }
      });

      await supabaseAdmin.from('users').update({
          role: 'ADMIN',
          school_id: schoolId
      }).eq('id', userId);
      
      // Optionally send welcome email
      sendWelcomeEmail(userData.email, userData.first_name, schoolName.trim()).catch(() => {});
    }

    // 2. Insert Academic Year (Global)
    let academicYearId;
    const { data: existingYear } = await supabaseAdmin
      .from('academic_years')
      .select('id')
      .eq('name', academicYear)
      .maybeSingle();

    if (existingYear) {
      academicYearId = existingYear.id;
    } else {
      const { data: newYear, error: yrErr } = await supabaseAdmin
        .from('academic_years')
        .insert({
          name: academicYear,
          start_date: `${academicYear}-01-01`,
          end_date: `${academicYear}-12-31`
        })
        .select('id')
        .single();
      
      if (yrErr) throw new Error('Failed to setup academic year: ' + yrErr.message);
      academicYearId = newYear.id;
    }

    // 3. Insert Term (Global)
    let termId;
    const { data: existingTerm } = await supabaseAdmin
      .from('terms')
      .select('id')
      .eq('academic_year_id', academicYearId)
      .eq('name', termName)
      .maybeSingle();

    if (existingTerm) {
      termId = existingTerm.id;
      // Ensure it is current
      await supabaseAdmin.from('terms').update({ is_current: true }).eq('id', termId);
    } else {
      const { data: newTerm, error: termErr } = await supabaseAdmin
        .from('terms')
        .insert({
          academic_year_id: academicYearId,
          name: termName,
          start_date: `${academicYear}-01-01`,
          end_date: `${academicYear}-04-30`,
          is_current: true
        })
        .select('id')
        .single();
        
      if (termErr) throw new Error('Failed to setup term: ' + termErr.message);
      termId = newTerm.id;
    }

    // 4. Update School Curriculum
    // In a real app, you would dynamically find the grading_system IDs for CBC / 844
    // For now, we just update onboarding_completed.
    
    // 5. Insert Grades and Streams
    const cbcLevelId = '00000000-0000-0000-0000-000000000000'; // Fallback if no level
    const { data: levels } = await supabaseAdmin.from('academic_levels').select('id, code');
    const getLevelId = (code: string) => levels?.find(l => l.code === code)?.id;

    for (const cls of classes) {
      if (!cls.grade) continue;
      
      // Ensure Grade exists globally
      let gradeId;
      const { data: existingGrade } = await supabaseAdmin
        .from('grades')
        .select('id')
        .eq('name_display', cls.grade)
        .limit(1)
        .maybeSingle();
        
      if (existingGrade) {
        gradeId = existingGrade.id;
      } else {
        const levelId = getLevelId('CBC') || cbcLevelId;
        const { data: newGrade } = await supabaseAdmin
          .from('grades')
          .insert({
            academic_level_id: levelId,
            code: cls.grade.toUpperCase().replace(/\s+/g, '_'),
            name_display: cls.grade,
            numeric_order: 1
          })
          .select('id')
          .single();
        gradeId = newGrade?.id;
      }

      // Create Streams for this school
      if (gradeId && cls.streams) {
        const streamNames = cls.streams.split(',').map((s: string) => s.trim()).filter(Boolean);
        for (const sName of streamNames) {
          const fullName = `${cls.grade} ${sName}`;
          await supabaseAdmin
            .from('grade_streams')
            .insert({
              grade_id: gradeId,
              name: sName,
              full_name: fullName,
              school_id: schoolId
            })
            // Ignore conflicts
            .select()
            .maybeSingle();
        }
      }
    }

    // 6. Insert Subjects
    if (subjects) {
      const subjectNames = subjects.split(',').map((s: string) => s.trim()).filter(Boolean);
      for (let i = 0; i < subjectNames.length; i++) {
        const sName = subjectNames[i];
        const code = sName.substring(0, 3).toUpperCase() + i;
        const levelId = getLevelId('CBC') || cbcLevelId;
        
        await supabaseAdmin
          .from('subjects')
          .insert({
            code: code,
            name: sName,
            academic_level_id: levelId
          })
          // Ignore conflicts if subject exists
          .select()
          .maybeSingle();
      }
    }

    // 7. Mark Onboarding as Completed
    const { error: finalErr } = await supabaseAdmin
      .from('schools')
      .update({ onboarding_completed: true })
      .eq('id', schoolId);

    if (finalErr) throw new Error('Failed to update school onboarding status: ' + finalErr.message);

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('Onboarding Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
