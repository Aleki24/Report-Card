import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import crypto from 'crypto';
import { createInviteCode, notifyInviteCode } from '@/lib/invite-codes';

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { students, default_grade_stream_id } = body;

        if (!Array.isArray(students) || students.length === 0) {
            return NextResponse.json({ error: 'No students provided for import.' }, { status: 400 });
        }

        const supabaseAdmin = createSupabaseAdmin();

        // Verify the caller is an ADMIN or CLASS_TEACHER
        const { data: adminProfile } = await supabaseAdmin
            .from('users')
            .select('role, school_id')
            .eq('id', userId)
            .maybeSingle();

        if (!adminProfile || !adminProfile.school_id) {
            return NextResponse.json({ error: 'You must have a school to add students.' }, { status: 403 });
        }

        const isAdmin = adminProfile.role === 'ADMIN';
        const isClassTeacher = adminProfile.role === 'CLASS_TEACHER';

        if (!isAdmin && !isClassTeacher) {
            return NextResponse.json({ error: 'Only admins and class teachers can add students.' }, { status: 403 });
        }

        const effectiveSchoolId = adminProfile.school_id;

        // Get school name for username generation
        const { data: school } = await supabaseAdmin
            .from('schools')
            .select('name')
            .eq('id', effectiveSchoolId)
            .maybeSingle();

        if (!school) {
            return NextResponse.json({ error: 'School not found.' }, { status: 404 });
        }

        // Auto-detect academic levels for the school
        const { data: schoolLevels } = await supabaseAdmin
            .from('school_academic_levels')
            .select('academic_level_id')
            .eq('school_id', effectiveSchoolId);
        const defaultAcademicLevelId = schoolLevels && schoolLevels.length > 0 ? schoolLevels[0].academic_level_id : null;

        const { generateUsername } = await import('@/lib/generate-username');

        // Get existing usernames to avoid collision
        const { data: existingUsers } = await supabaseAdmin
            .from('users')
            .select('username');
        const existingUsernames = new Set((existingUsers || []).map(u => u.username));

        // Get existing admission numbers in the school
        const { data: existingStudents } = await supabaseAdmin
            .from('users')
            .select('students!inner(admission_number)')
            .eq('school_id', effectiveSchoolId);
        
        const takenAdmNos = new Set<string>();
        existingStudents?.forEach((u: any) => {
            if (u.students?.[0]?.admission_number) {
                takenAdmNos.add(u.students[0].admission_number.toLowerCase());
            }
        });

        const usersToInsert: any[] = [];
        const studentsToInsert: any[] = [];
        const skippedRows: { row: any; reason: string }[] = [];

        // Pre-fetch grade streams for matching class names from CSV
        const { data: allStreams } = await supabaseAdmin
            .from('grade_streams')
            .select('id, full_name, grades!inner(academic_level_id)')
            .eq('school_id', effectiveSchoolId);
        const streamMap = new Map((allStreams || []).map(s => [s.full_name.toLowerCase().trim(), s.id]));
        const streamLevelMap = new Map((allStreams || []).map(s => [s.id, (s as any).grades?.academic_level_id]));

        const createdCredentials: { first_name: string; last_name: string; username: string; invite_code: string }[] = [];
        // Track user IDs for invite code generation after insert
        const pendingInvites: {
            userId: string; username: string; firstName: string; lastName: string;
            guardianName: string | null; guardianPhone: string | null; guardianEmail: string | null;
        }[] = [];

        for (const student of students) {
            const { first_name, last_name, admission_number, grade_stream_id, academic_level_id, guardian_phone, guardian_name, guardian_email, gender, date_of_birth } = student;

            if (!first_name?.trim() || !last_name?.trim()) {
                skippedRows.push({ row: student, reason: 'Missing first or last name' });
                continue;
            }

            let finalAdmNo = admission_number?.trim() || null;
            
            if (!finalAdmNo) {
                let randomSequence = Math.floor(Math.random() * 90000) + 10000;
                finalAdmNo = `ADM-${new Date().getFullYear()}-${randomSequence}`;
                while (takenAdmNos.has(finalAdmNo.toLowerCase())) {
                    randomSequence = Math.floor(Math.random() * 90000) + 10000;
                    finalAdmNo = `ADM-${new Date().getFullYear()}-${randomSequence}`;
                }
            }

            if (takenAdmNos.has(finalAdmNo.toLowerCase())) {
                skippedRows.push({ row: student, reason: `Admission number ${finalAdmNo} is already in use` });
                continue;
            }
            takenAdmNos.add(finalAdmNo.toLowerCase());

            // Resolve grade stream
            let resolvedStreamId = grade_stream_id || default_grade_stream_id || null;
            if (!resolvedStreamId && student.class) {
                const classKey = student.class.toLowerCase().trim();
                resolvedStreamId = streamMap.get(classKey) || null;
            }
            if (!resolvedStreamId && student.stream) {
                const classKey = student.stream.toLowerCase().trim();
                resolvedStreamId = streamMap.get(classKey) || null;
            }

            if (!resolvedStreamId) {
                skippedRows.push({ row: student, reason: 'Could not resolve a class/stream for this student' });
                continue;
            }

            const effectiveAcademicLevelId = academic_level_id || streamLevelMap.get(resolvedStreamId) || defaultAcademicLevelId;
            if (!effectiveAcademicLevelId) {
                skippedRows.push({ row: student, reason: 'Could not resolve an academic level for this class' });
                continue;
            }

            const sequenceMatch = finalAdmNo?.match(/\d+/);
            const sequence_number = sequenceMatch ? parseInt(sequenceMatch[0], 10) : Math.floor(Math.random() * 900) + 100;

            const username = generateUsername(first_name, school.name, sequence_number);
            let uniqueUsername = username;
            
            while (existingUsernames.has(uniqueUsername)) {
                 uniqueUsername = `${username}${Math.floor(Math.random() * 1000)}`;
            }
            existingUsernames.add(uniqueUsername);

            const emailBase = (finalAdmNo || uniqueUsername).toLowerCase().replace(/[^a-z0-9]/g, '');
            const placeholderEmail = `${emailBase}@${school.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.school.local`;

            // Generate a temporary UUID (will be replaced with Clerk ID on activation)
            const tempUserId = crypto.randomUUID();

            usersToInsert.push({
                id: tempUserId,
                first_name: first_name.trim(),
                last_name: last_name.trim(),
                email: placeholderEmail,
                role: 'STUDENT',
                school_id: effectiveSchoolId,
                username: uniqueUsername,
                is_active: false // Will be activated when user sets their password
            });

            studentsToInsert.push({
                id: tempUserId,
                admission_number: finalAdmNo,
                current_grade_stream_id: resolvedStreamId,
                academic_level_id: effectiveAcademicLevelId,
                guardian_phone: guardian_phone?.trim() || null,
                guardian_name: guardian_name?.trim() || null,
                guardian_email: guardian_email?.trim() || null,
                gender: gender || null,
                date_of_birth: date_of_birth || null,
            });

            pendingInvites.push({
                userId: tempUserId,
                username: uniqueUsername,
                firstName: first_name.trim(),
                lastName: last_name.trim(),
                guardianName: guardian_name?.trim() || null,
                guardianPhone: guardian_phone?.trim() || null,
                guardianEmail: guardian_email?.trim() || null,
            });
        }

        if (usersToInsert.length === 0) {
             return NextResponse.json({ error: 'No valid students could be parsed from the batch. Make sure required fields are filled and admission numbers are unique.' }, { status: 400 });
        }

        // Insert into public.users
        const { error: userError } = await supabaseAdmin.from('users').insert(usersToInsert);

        if (userError) {
            return NextResponse.json({ error: `User record batch creation failed: ${userError.message}` }, { status: 400 });
        }

        // Insert into public.students
        const { error: studentError } = await supabaseAdmin.from('students').insert(studentsToInsert);

        if (studentError) {
            const idsToDelete = usersToInsert.map(u => u.id);
            await supabaseAdmin.from('users').delete().in('id', idsToDelete);
            return NextResponse.json({ error: `Student record batch creation failed: ${studentError.message}` }, { status: 400 });
        }

        // Generate invite codes for all successfully inserted students
        for (const invite of pendingInvites) {
            try {
                const code = await createInviteCode(supabaseAdmin, invite.userId, effectiveSchoolId, 'STUDENT');
                // Best-effort delivery to the guardian — the code is still
                // shown to the admin regardless of whether this succeeds.
                await notifyInviteCode({
                    phone: invite.guardianPhone,
                    email: invite.guardianEmail,
                    firstName: invite.guardianName || invite.firstName,
                    schoolName: school.name,
                    code,
                });
                createdCredentials.push({
                    first_name: invite.firstName,
                    last_name: invite.lastName,
                    username: invite.username,
                    invite_code: code
                });
            } catch (err) {
                console.error(`Failed to create invite code for ${invite.username}:`, err);
                createdCredentials.push({
                    first_name: invite.firstName,
                    last_name: invite.lastName,
                    username: invite.username,
                    invite_code: 'ERROR'
                });
            }
        }

        return NextResponse.json({
            success: true,
            imported: usersToInsert.length,
            skipped: skippedRows.length,
            skipped_rows: skippedRows,
            created_credentials: createdCredentials,
            message: `Successfully imported ${usersToInsert.length} students.`
        });

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
