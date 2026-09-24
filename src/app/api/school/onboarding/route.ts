import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { auth } from '@clerk/nextjs/server';
import { notifyOwnerOfSchoolRequest } from '@/lib/school-approval';
import { sendSchoolRequestReceivedEmail } from '@/lib/email';
import { getActiveUserProfile } from '@/lib/auth-server';
import { onboardingSchema, type Curriculum } from '@/lib/schemas';
import { ensureClasses } from '@/lib/classes';
import { catalogueLevelForGrade, compulsoryCodes, offerStandardSubjects } from '@/lib/standard-subjects';
import type { EducationLevel } from '@/lib/subject-definitions';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabaseAdmin = createSupabaseAdmin();

    const userData = await getActiveUserProfile(userId);

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (userData.role !== 'ADMIN' && userData.role !== 'PENDING') {
      return NextResponse.json({ error: 'Unauthorized role' }, { status: 403 });
    }

    // Parse payload
    const parsed = onboardingSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid setup details' }, { status: 400 });
    }
    const { schoolName, schoolEmail, schoolPhone, schoolAddress, academicYear, term, curricula, classes, offerCompulsorySubjects } = parsed.data;

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
    // Academic year (Kenyan school years run January to December) and the
    // current term with the dates the school gave — never invented ones.
    let academicYearId: string;
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
        .insert({ name: academicYear, school_id: schoolId, start_date: `${academicYear}-01-01`, end_date: `${academicYear}-12-31` })
        .select('id')
        .single();
      if (yrErr) throw new Error('Failed to set up the academic year: ' + yrErr.message);
      academicYearId = newYear.id;
    }

    // Exactly one current term.
    await supabaseAdmin.from('terms').update({ is_current: false }).eq('school_id', schoolId);
    const termRow = { start_date: term.start_date, end_date: term.end_date, is_current: true };
    const { data: existingTerm } = await supabaseAdmin
      .from('terms')
      .select('id')
      .eq('academic_year_id', academicYearId)
      .eq('name', term.name)
      .eq('school_id', schoolId)
      .maybeSingle();
    const { error: termErr } = existingTerm
      ? await supabaseAdmin.from('terms').update(termRow).eq('id', existingTerm.id)
      : await supabaseAdmin.from('terms').insert({ ...termRow, academic_year_id: academicYearId, school_id: schoolId, name: term.name });
    if (termErr) throw new Error('Failed to set up the term: ' + termErr.message);

    // Classes: standard grades only, from the curricula the school picked.
    const { data: gradeRows, error: gradeErr } = await supabaseAdmin
      .from('grades')
      .select('id, code, name_display, academic_levels ( code )')
      .in('id', classes.map(c => c.grade_id));
    if (gradeErr) throw new Error('Failed to read grades: ' + gradeErr.message);
    const gradeById = new Map((gradeRows ?? []).map(g => [g.id as string, g]));

    for (const cls of classes) {
      const grade = gradeById.get(cls.grade_id);
      const level = grade && (Array.isArray(grade.academic_levels) ? grade.academic_levels[0] : grade.academic_levels);
      if (!grade || !curricula.includes(level?.code as Curriculum)) {
        return NextResponse.json({ error: 'A class you picked is not part of the curriculum you chose.' }, { status: 400 });
      }
    }

    for (const cls of classes) {
      const grade = gradeById.get(cls.grade_id)!;
      await ensureClasses(supabaseAdmin, {
        schoolId,
        gradeId: cls.grade_id,
        gradeName: grade.name_display as string,
        streamNames: cls.streams,
      });
    }

    // Compulsory subjects for every level taught, so exams can be set on
    // day one. Electives and optional subjects are picked on the Subjects page.
    if (offerCompulsorySubjects) {
      const levels = new Set(
        [...gradeById.values()]
          .map(g => catalogueLevelForGrade({ code: g.code as string, name_display: g.name_display as string }))
          .filter((l): l is EducationLevel => l !== null),
      );
      for (const level of levels) {
        await offerStandardSubjects(supabaseAdmin, schoolId, level, compulsoryCodes(level));
      }
    }

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

  } catch (err: unknown) {
    console.error('Onboarding Error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Setup failed' }, { status: 500 });
  }
}

/** The standard grades a new school picks its classes from, by curriculum. */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await createSupabaseAdmin()
    .from('grades')
    .select('id, code, name_display, numeric_order, academic_levels ( code )')
    .order('numeric_order');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const grades = (data ?? []).flatMap(g => {
    const level = Array.isArray(g.academic_levels) ? g.academic_levels[0] : g.academic_levels;
    return level?.code === 'CBC' || level?.code === '844'
      ? [{ id: g.id as string, code: g.code as string, name: g.name_display as string, curriculum: level.code as 'CBC' | '844' }]
      : [];
  });
  return NextResponse.json({ grades });
}
