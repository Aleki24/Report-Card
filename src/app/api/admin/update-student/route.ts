import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { canManageStream, canManageStudent, getCaller } from '@/lib/auth-server';
import { syncStudentSubjects } from '@/lib/pathway/sync-student-subjects';
import { CLASS_REQUIRED_MESSAGE, isSchoolClass } from '@/lib/classes';

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { 
            student_id, 
            first_name, 
            last_name, 
            admission_number, 
            guardian_phone, 
            guardian_name,
            guardian_email,
            gender,
            date_of_birth,
            grade_stream_id,
            status,
            avatar_url,
            pathway,
            track,
            subject_combination_id,
        } = body;

        if (!student_id) {
            return NextResponse.json({ error: 'student_id is required' }, { status: 400 });
        }

        const supabaseAdmin = createSupabaseAdmin();

        const caller = await getCaller();
        if (!caller) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Admins edit anyone; a class teacher edits their own class. Any teacher
        // used to be able to edit — and move — any student in the school.
        if ((caller.role !== 'ADMIN' && caller.role !== 'CLASS_TEACHER') || !caller.schoolId) {
            return NextResponse.json({ error: 'Only admins and class teachers can update students.' }, { status: 403 });
        }
        const profile = { school_id: caller.schoolId };

        // Verify the student belongs to this school
        const { data: student } = await supabaseAdmin
            .from('students')
            .select('id, status, users!inner(school_id)')
            .eq('id', student_id)
            .eq('users.school_id', profile.school_id)
            .maybeSingle();

        if (!student) {
            return NextResponse.json({ error: 'Student not found in your school.' }, { status: 404 });
        }
        if (!(await canManageStudent(caller, student_id))) {
            return NextResponse.json({ error: 'You can only update students in your own class.' }, { status: 403 });
        }
        // An active learner always sits in a class; only one who has left may be without.
        if (grade_stream_id !== undefined) {
            const staysActive = (status ?? student.status ?? 'ACTIVE') === 'ACTIVE';
            if (!grade_stream_id && staysActive) {
                return NextResponse.json({ error: CLASS_REQUIRED_MESSAGE }, { status: 400 });
            }
            if (grade_stream_id && !(await isSchoolClass(supabaseAdmin, profile.school_id, grade_stream_id))) {
                return NextResponse.json({ error: 'That class is not one of your school\'s.' }, { status: 400 });
            }
        }
        // Moving a student is only allowed into a class the caller also runs.
        if (grade_stream_id !== undefined && !canManageStream(caller, grade_stream_id || null)) {
            return NextResponse.json({ error: 'You can only move students into your own class.' }, { status: 403 });
        }

        // Build update object for student table
        const studentUpdates: Record<string, any> = {};
        if (guardian_phone !== undefined) studentUpdates.guardian_phone = guardian_phone?.trim() || null;
        if (guardian_name !== undefined) studentUpdates.guardian_name = guardian_name?.trim() || null;
        if (guardian_email !== undefined) studentUpdates.guardian_email = guardian_email?.trim() || null;
        if (gender !== undefined) studentUpdates.gender = gender || null;
        if (date_of_birth !== undefined) studentUpdates.date_of_birth = date_of_birth || null;
        if (grade_stream_id !== undefined) studentUpdates.current_grade_stream_id = grade_stream_id || null;
        if (status !== undefined) studentUpdates.status = status;
        if (avatar_url !== undefined) studentUpdates.avatar_url = avatar_url || null;
        if (pathway !== undefined) studentUpdates.pathway = pathway || null;
        if (track !== undefined) studentUpdates.track = track?.trim() || null;
        if (subject_combination_id !== undefined) {
            if (subject_combination_id) {
                // Combination must belong to the caller's school
                const { data: combination } = await supabaseAdmin
                    .from('subject_combinations')
                    .select('id, pathway, track')
                    .eq('id', subject_combination_id)
                    .eq('school_id', profile.school_id)
                    .maybeSingle();
                if (!combination) {
                    return NextResponse.json({ error: 'Subject combination not found in your school.' }, { status: 404 });
                }
                // Keep the three fields consistent when only the combination is sent
                if (pathway === undefined) studentUpdates.pathway = combination.pathway;
                if (track === undefined) studentUpdates.track = combination.track;
            }
            studentUpdates.subject_combination_id = subject_combination_id || null;
        }

        // Build update object for users table
        const userUpdates: Record<string, any> = {};
        if (first_name !== undefined) userUpdates.first_name = first_name?.trim() || null;
        if (last_name !== undefined) userUpdates.last_name = last_name?.trim() || null;
        if (admission_number !== undefined) {
            // Need to update the students table admission_number
            studentUpdates.admission_number = admission_number?.trim() || null;
        }

        // Combination changed (or cleared) — re-sync subject enrollments
        // BEFORE persisting the pointer, so a sync failure leaves the
        // student untouched instead of half-assigned
        if (subject_combination_id !== undefined) {
            try {
                await syncStudentSubjects(supabaseAdmin, {
                    studentId: student_id,
                    schoolId: profile.school_id,
                    combinationId: subject_combination_id || null,
                });
            } catch (syncErr) {
                const msg = syncErr instanceof Error ? syncErr.message : 'enrollment sync failed';
                return NextResponse.json({ error: `Subject enrollment sync failed: ${msg}` }, { status: 500 });
            }
        }

        // Update student record
        if (Object.keys(studentUpdates).length > 0) {
            const { error: studentError } = await supabaseAdmin
                .from('students')
                .update(studentUpdates)
                .eq('id', student_id);

            if (studentError) {
                return NextResponse.json({ error: `Update failed: ${studentError.message}` }, { status: 400 });
            }
        }

        // Update user record (name) — student_id IS the user_id (same UUID)
        if (Object.keys(userUpdates).length > 0) {
            const { error: userError } = await supabaseAdmin
                .from('users')
                .update(userUpdates)
                .eq('id', student_id);

            if (userError) {
                return NextResponse.json({ error: `Update failed: ${userError.message}` }, { status: 400 });
            }
        }

        return NextResponse.json({ success: true, message: 'Student updated successfully.' });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
