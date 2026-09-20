import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { auth } from '@clerk/nextjs/server';
import { notifyOwnerOfSchoolRequest } from '@/lib/school-approval';
import { sendSchoolRequestReceivedEmail } from '@/lib/email';

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
    const { schoolName, schoolEmail, schoolPhone, schoolAddress, academicYear, termName, curriculum, classes } = body;

    let schoolId = userData.school_id;

    // If PENDING, create the school and upgrade to ADMIN
    if (userData.role === 'PENDING' || !schoolId) {
      if (!schoolName) {
        return NextResponse.json({ error: 'School name is required' }, { status: 400 });
      }

      schoolId = crypto.randomUUID();
      const teacherInviteCode = crypto.randomUUID().substring(0, 6).toUpperCase();
      const studentInviteCode = crypto.randomUUID().substring(0, 6).toUpperCase();
      // Single-use secret for the owner's approve/reject links.
      const approvalToken = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');
      const { error: schoolError } = await supabaseAdmin.from('schools').insert({
          id: schoolId,
          name: schoolName.trim(),
          email: schoolEmail?.trim() || null,
          phone: schoolPhone?.trim() || null,
          address: schoolAddress?.trim() || null,
          onboarding_completed: false,
          teacher_invite_code: teacherInviteCode,
          student_invite_code: studentInviteCode,
          approval_status: 'PENDING_APPROVAL',
          approval_requested_at: new Date().toISOString(),
          approval_token: approvalToken,
          requested_by: userId,
      });

      if (schoolError) throw new Error('Failed to create school: ' + schoolError.message);

      // Deliberately NOT promoted to ADMIN here. The account stays PENDING
      // until the platform owner approves, and because every role check in the
      // app already rejects PENDING, that single fact is what keeps an
      // unapproved school unusable — no per-route gate to forget. Approval
      // (see /api/platform/schools/[schoolId]/decision) does the promotion.
      // The school_id is attached now so the requester can finish setting up
      // while they wait, and so they cannot open a second school request.
      await supabaseAdmin.from('users').update({
          school_id: schoolId
      }).eq('id', userId);

      // Acknowledge to the requester that the form worked and what happens
      // next — the school is held, so there is no dashboard to land on.
      if (userData.email) {
        sendSchoolRequestReceivedEmail(userData.email, userData.first_name, schoolName.trim())
          .catch(err => console.error('[onboarding] requester acknowledgement failed:', err));
      }

      notifyOwnerOfSchoolRequest({
          schoolId,
          schoolName: schoolName.trim(),
          schoolEmail: schoolEmail?.trim() || null,
          schoolPhone: schoolPhone?.trim() || null,
          schoolAddress: schoolAddress?.trim() || null,
          requesterName: userData.first_name,
          requesterEmail: userData.email,
          approvalToken,
      }).catch(err => console.error('[onboarding] owner notification failed:', err));
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

    // The curriculum the school picked during sign-up was read off the request
    // body and then ignored — every grade and every subject was created as CBC.
    // A school that signed up as 8-4-4 got a CBC academic level on all of it,
    // and since one CBC level spans Grade 1 to Grade 12, nothing downstream
    // could tell its classes apart afterwards.
    // The wizard sends the two checkboxes as an object, so a string test on it
    // only ever saw "[object Object]" and picked CBC every time. Read the flags.
    // Both ticked resolves to CBC: the grades typed in the wizard are one flat
    // list with nothing to say which curriculum each belongs to, and CBC is the
    // wider of the two, so a Form 1 typed by a dual-curriculum school is
    // re-levelled on the Classes page rather than silently mis-levelling the
    // primary grades that make up the rest of the list.
    const wants = (curriculum ?? {}) as { cbc?: boolean; '844'?: boolean };
    const chosenLevelCode = wants['844'] && !wants.cbc ? '844' : 'CBC';
    const schoolLevelId = getLevelId(chosenLevelCode) || fallbackLevelId;

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
        const levelId = schoolLevelId;
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

    // Subjects are deliberately not created here.
    //
    // This step took a comma-separated line of free text and invented a code
    // for each name ("Mathematics" -> MATH, clashing names -> MATH2). Nothing
    // in that matched the standard catalogue, so a school finished onboarding
    // with subjects that no grading scale, level rule or report template knew
    // about. Subjects are now chosen from the catalogue on the Subjects page,
    // per level, where the codes are the real ones.

    // 7. Mark Onboarding as Completed
    const { error: finalErr } = await supabaseAdmin
      .from('schools')
      .update({ onboarding_completed: true })
      .eq('id', schoolId);

    if (finalErr) throw new Error('Failed to update school onboarding status: ' + finalErr.message);

    // Tell the client whether this school is live yet, so a brand-new sign-up
    // sees "waiting for approval" instead of being sent to a dashboard its
    // PENDING role cannot load anything from.
    const { data: schoolRow } = await supabaseAdmin
      .from('schools')
      .select('approval_status')
      .eq('id', schoolId)
      .maybeSingle();

    const approvalStatus = schoolRow?.approval_status || 'APPROVED';
    return NextResponse.json({
      success: true,
      approvalStatus,
      awaitingApproval: approvalStatus === 'PENDING_APPROVAL',
    });

  } catch (err: any) {
    console.error('Onboarding Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
