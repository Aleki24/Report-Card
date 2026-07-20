import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { auth, createClerkClient } from '@clerk/nextjs/server';
import { sendWelcomeEmail } from '@/lib/email';
import { PREDEFINED_SUBJECTS, getCBCBandForGradeName, type EducationLevel } from '@/lib/subject-definitions';

// `subjects.code` is globally unique, but PREDEFINED_SUBJECTS codes (e.g.
// "MATH_LP") are shared across every school. Fall back to a school-suffixed
// code if another school already claimed it, and skip silently if this
// school already has the subject.
async function insertSubjectSafe(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  schoolId: string,
  base: { code: string; name: string; academic_level_id: string; category?: string; subject_type?: string }
) {
  const { data: existingForSchool } = await supabaseAdmin
    .from('subjects')
    .select('id')
    .eq('school_id', schoolId)
    .eq('code', base.code)
    .maybeSingle();
  if (existingForSchool) return;

  let code = base.code;
  const { data: codeTaken } = await supabaseAdmin
    .from('subjects')
    .select('id')
    .eq('code', code)
    .maybeSingle();
  if (codeTaken) {
    code = `${base.code}-${schoolId.replace(/-/g, '').slice(0, 5).toUpperCase()}`;
  }

  await supabaseAdmin
    .from('subjects')
    .insert({ ...base, code, school_id: schoolId })
    .select()
    .maybeSingle();
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabaseAdmin = createSupabaseAdmin();

    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('school_id, role, first_name, email')
      .eq('id', userId)
      .maybeSingle();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (userData.role !== 'ADMIN' && userData.role !== 'PENDING') {
      return NextResponse.json({ error: 'Unauthorized role' }, { status: 403 });
    }

    // Parse payload
    const body = await request.json();
    const { schoolName, schoolEmail, schoolPhone, schoolAddress, academicYear, termName, curriculum, classes, subjects, subjectsMode } = body;

    let schoolId = userData.school_id;

    // If PENDING, create the school and upgrade to ADMIN
    if (userData.role === 'PENDING' || !schoolId) {
      if (!schoolName) {
        return NextResponse.json({ error: 'School name is required' }, { status: 400 });
      }

      schoolId = crypto.randomUUID();
      const teacherInviteCode = crypto.randomUUID().substring(0, 6).toUpperCase();
      const studentInviteCode = crypto.randomUUID().substring(0, 6).toUpperCase();
      const { error: schoolError } = await supabaseAdmin.from('schools').insert({
          id: schoolId,
          name: schoolName.trim(),
          email: schoolEmail?.trim() || null,
          phone: schoolPhone?.trim() || null,
          address: schoolAddress?.trim() || null,
          onboarding_completed: false,
          teacher_invite_code: teacherInviteCode,
          student_invite_code: studentInviteCode,
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
      .eq('school_id', schoolId)
      .maybeSingle();

    if (existingYear) {
      academicYearId = existingYear.id;
    } else {
      const { data: newYear, error: yrErr } = await supabaseAdmin
        .from('academic_years')
        .insert({
          name: academicYear,
          school_id: schoolId,
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
      .eq('school_id', schoolId)
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
          school_id: schoolId,
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
    const { data: levels } = await supabaseAdmin.from('academic_levels').select('id, code');
    const getLevelId = (code: string) => levels?.find(l => l.code === code)?.id;
    const fallbackLevelId = levels?.[0]?.id;

    const touchedGradeNames: string[] = [];

    for (const cls of classes) {
      if (!cls.grade) continue;
      touchedGradeNames.push(cls.grade);

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
        const levelId = getLevelId('CBC') || fallbackLevelId;
        if (!levelId) continue;

        const { count: existingCount } = await supabaseAdmin
          .from('grades')
          .select('*', { count: 'exact', head: true });

        const { data: newGrade, error: grErr } = await supabaseAdmin
          .from('grades')
          .insert({
            academic_level_id: levelId,
            code: cls.grade.toUpperCase().replace(/\s+/g, '_'),
            name_display: cls.grade,
            numeric_order: (existingCount ?? 0) + 1
          })
          .select('id')
          .single();

        if (grErr) continue;
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
    if (subjectsMode === 'auto') {
      // Populate the standard subjects for every CBC/8-4-4 band the admin
      // actually created classes in, so e.g. Lower/Upper Primary aren't
      // left without subjects just because nobody added them manually.
      const bands = new Set<EducationLevel>();
      for (const name of touchedGradeNames) {
        const band = getCBCBandForGradeName(name);
        if (band) bands.add(band);
      }

      for (const band of bands) {
        const levelCode = band.startsWith('CBC') ? 'CBC' : '844';
        const levelId = getLevelId(levelCode) || fallbackLevelId;
        if (!levelId) continue;

        const predefined = PREDEFINED_SUBJECTS.filter(s => s.level === band);
        for (const subj of predefined) {
          await insertSubjectSafe(supabaseAdmin, schoolId, {
            code: subj.code,
            name: subj.name,
            academic_level_id: levelId,
            category: subj.category || 'TECHNICAL',
            subject_type: subj.isCore ? 'CORE' : 'OPTIONAL',
          });
        }
      }
    } else if (subjectsMode !== 'skip' && subjects) {
      // Custom/legacy free-text list — one generic subject per name.
      const subjectNames = subjects.split(',').map((s: string) => s.trim()).filter(Boolean);
      for (let i = 0; i < subjectNames.length; i++) {
        const sName = subjectNames[i];
        const code = sName.substring(0, 3).toUpperCase() + String(i + 1).padStart(2, '0');
        const levelId = getLevelId('CBC') || fallbackLevelId;
        if (!levelId) continue;

        await insertSubjectSafe(supabaseAdmin, schoolId, {
          code,
          name: sName,
          academic_level_id: levelId,
        });
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
