import { NextRequest, NextResponse, after } from 'next/server';
import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { canManageStream, getCaller } from '@/lib/auth-server';
import { normalizeGender } from '@/lib/gender';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { createInviteCodes, notifyInviteCode } from '@/lib/invite-codes';
import { generateUsername } from '@/lib/generate-username';
import { embedOne, fetchAllRows } from '@/lib/postgrest';
import { internalError, writeErrorMessage } from '@/lib/api-errors';

/** One row of the import file, as the web and app send it. */
interface ImportRow {
    first_name?: string;
    last_name?: string;
    admission_number?: string | null;
    grade_stream_id?: string | null;
    academic_level_id?: string | null;
    class?: string | null;
    stream?: string | null;
    guardian_phone?: string | null;
    guardian_name?: string | null;
    guardian_email?: string | null;
    gender?: string | null;
    date_of_birth?: string | null;
}

/** A row that passed the checks, before its username is settled. */
interface AcceptedRow {
    id: string;
    firstName: string;
    lastName: string;
    baseUsername: string;
    admissionNumber: string | null;
    streamId: string;
    academicLevelId: string;
    guardianPhone: string | null;
    guardianName: string | null;
    guardianEmail: string | null;
    gender: ReturnType<typeof normalizeGender>;
    dateOfBirth: string | null;
}

/** Guardians texted/emailed at once after an import. */
const NOTIFY_CONCURRENCY = 5;
/** Usernames checked per query (they go in the request URL). */
const USERNAME_CHUNK = 200;

/** Runs `work` over `items`, at most `limit` at a time; one failure does not stop the rest. */
async function forEachLimited<T>(items: readonly T[], limit: number, work: (item: T) => Promise<void>): Promise<void> {
    let next = 0;
    const worker = async () => {
        while (next < items.length) {
            const item = items[next++];
            await work(item).catch(err => console.error('[bulk-import] notify failed:', err));
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/**
 * Usernames for the batch, each free in the database and within the batch.
 * Only the candidates are looked up (not every user on the platform); a taken
 * one gets a random suffix and is checked again.
 */
async function uniqueUsernames(supabase: SupabaseClient, bases: readonly string[]): Promise<string[]> {
    const result = [...bases];
    for (let round = 0; round < 6; round++) {
        const seen = new Set<string>();
        const clashing = new Set<number>();
        result.forEach((name, i) => { if (seen.has(name)) clashing.add(i); seen.add(name); });
        const names = [...seen];
        for (let i = 0; i < names.length; i += USERNAME_CHUNK) {
            const { data, error } = await supabase.from('users').select('username').in('username', names.slice(i, i + USERNAME_CHUNK));
            if (error) throw error;
            const taken = new Set((data ?? []).map(u => u.username as string));
            result.forEach((name, j) => { if (taken.has(name)) clashing.add(j); });
        }
        if (clashing.size === 0) return result;
        clashing.forEach(i => { result[i] = `${bases[i]}${crypto.randomInt(10, 10000)}`; });
    }
    throw new Error('Could not find free usernames for the import. Please try again.');
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { students, default_grade_stream_id } = body;

        if (!Array.isArray(students) || students.length === 0) {
            return NextResponse.json({ error: 'No students provided for import.' }, { status: 400 });
        }

        const supabaseAdmin = createSupabaseAdmin();

        const caller = await getCaller();
        if (!caller) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!caller.schoolId) {
            return NextResponse.json({ error: 'You must have a school to add students.' }, { status: 403 });
        }

        if (caller.role !== 'ADMIN' && caller.role !== 'CLASS_TEACHER') {
            return NextResponse.json({ error: 'Only admins and class teachers can add students.' }, { status: 403 });
        }

        const effectiveSchoolId = caller.schoolId;

        // Class teachers may only import students into their own class.
        const isClassTeacher = caller.role === 'CLASS_TEACHER';
        if (isClassTeacher && caller.classStreamIds.length === 0) {
            return NextResponse.json({ error: 'You are not assigned to a class stream.' }, { status: 403 });
        }

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

        // This school's admission numbers, all of them (a students row is one
        // per user, so read it directly rather than through an embed).
        const { rows: existingStudents, error: admNoError } = await fetchAllRows(() => supabaseAdmin
            .from('students')
            .select('admission_number')
            .eq('school_id', effectiveSchoolId)
            .not('admission_number', 'is', null)
            .order('id'));
        if (admNoError) return internalError('bulk-import admission numbers', admNoError);
        const takenAdmNos = new Set(existingStudents.map(s => String(s.admission_number).toLowerCase()));

        const accepted: AcceptedRow[] = [];
        const skippedRows: { row: ImportRow; reason: string }[] = [];

        // Pre-fetch grade streams for matching class names from CSV
        const { data: allStreams } = await supabaseAdmin
            .from('grade_streams')
            .select('id, full_name, grades!inner(academic_level_id)')
            .eq('school_id', effectiveSchoolId);
        const streamMap = new Map((allStreams || []).map(s => [s.full_name.toLowerCase().trim(), s.id]));
        const streamLevelMap = new Map((allStreams || []).map(s => [s.id, embedOne<{ academic_level_id: string }>(s.grades)?.academic_level_id ?? null]));

        for (const student of students as ImportRow[]) {
            const { first_name, last_name, admission_number, grade_stream_id, academic_level_id, guardian_phone, guardian_name, guardian_email, gender, date_of_birth } = student;

            if (!first_name?.trim() || !last_name?.trim()) {
                skippedRows.push({ row: student, reason: 'Missing first or last name' });
                continue;
            }

            // Blank stays blank: a number is never invented for the school,
            // so a row without one imports with no admission number rather than
            // one guessed from the school's sequence. Only real numbers are
            // checked for collisions, and NULLs do not collide with each other.
            const finalAdmNo = admission_number?.trim() || null;

            if (finalAdmNo) {
                if (takenAdmNos.has(finalAdmNo.toLowerCase())) {
                    skippedRows.push({ row: student, reason: `Admission number ${finalAdmNo} is already in use` });
                    continue;
                }
                takenAdmNos.add(finalAdmNo.toLowerCase());
            }

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
            if (!streamLevelMap.has(resolvedStreamId)) {
                skippedRows.push({ row: student, reason: 'That class is not one of your school\'s' });
                continue;
            }

            // Class teachers can only import into their own assigned stream
            if (isClassTeacher && !canManageStream(caller, resolvedStreamId)) {
                skippedRows.push({ row: student, reason: 'You can only import students into your own class stream' });
                continue;
            }

            const effectiveAcademicLevelId = academic_level_id || streamLevelMap.get(resolvedStreamId) || defaultAcademicLevelId;
            if (!effectiveAcademicLevelId) {
                skippedRows.push({ row: student, reason: 'Could not resolve an academic level for this class' });
                continue;
            }

            const sequenceMatch = finalAdmNo?.match(/\d+/);
            const sequence_number = sequenceMatch ? parseInt(sequenceMatch[0], 10) : crypto.randomInt(100, 1000);

            accepted.push({
                id: crypto.randomUUID(), // replaced with the Clerk id on activation
                firstName: first_name.trim(),
                lastName: last_name.trim(),
                baseUsername: generateUsername(first_name, school.name, sequence_number),
                admissionNumber: finalAdmNo,
                streamId: resolvedStreamId,
                academicLevelId: effectiveAcademicLevelId,
                guardianPhone: guardian_phone?.trim() || null,
                guardianName: guardian_name?.trim() || null,
                guardianEmail: guardian_email?.trim() || null,
                gender: normalizeGender(gender),
                dateOfBirth: date_of_birth || null,
            });
        }

        if (accepted.length === 0) {
             return NextResponse.json({ error: 'No valid students could be parsed from the batch. Make sure required fields are filled and admission numbers are unique.' }, { status: 400 });
        }

        const usernames = await uniqueUsernames(supabaseAdmin, accepted.map(a => a.baseUsername));
        const schoolDomain = school.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const usersToInsert = accepted.map((a, i) => ({
            id: a.id,
            first_name: a.firstName,
            last_name: a.lastName,
            email: `${(a.admissionNumber || usernames[i]).toLowerCase().replace(/[^a-z0-9]/g, '')}@${schoolDomain}.school.local`,
            role: 'STUDENT',
            school_id: effectiveSchoolId,
            username: usernames[i],
            is_active: false, // activated when the learner sets their password
        }));
        const studentsToInsert = accepted.map(a => ({
            id: a.id,
            admission_number: a.admissionNumber,
            current_grade_stream_id: a.streamId,
            academic_level_id: a.academicLevelId,
            guardian_phone: a.guardianPhone,
            guardian_name: a.guardianName,
            guardian_email: a.guardianEmail,
            gender: a.gender,
            date_of_birth: a.dateOfBirth,
        }));

        // Insert into public.users
        const { error: userError } = await supabaseAdmin.from('users').insert(usersToInsert);

        if (userError) {
            return NextResponse.json({ error: writeErrorMessage(userError, 'Could not create the student accounts. Please try again.') }, { status: 400 });
        }

        // Insert into public.students
        const { error: studentError } = await supabaseAdmin.from('students').insert(studentsToInsert);

        if (studentError) {
            const idsToDelete = usersToInsert.map(u => u.id);
            await supabaseAdmin.from('users').delete().in('id', idsToDelete);
            return NextResponse.json({ error: writeErrorMessage(studentError, 'Could not import the student records. Please try again.') }, { status: 400 });
        }

        // One insert for every learner's invite code, so the admin gets the
        // list at once; texting and emailing guardians happens after the
        // response (one text per guardian takes seconds each).
        let codes = new Map<string, string>();
        try {
            codes = await createInviteCodes(supabaseAdmin, accepted.map(a => a.id), effectiveSchoolId, 'STUDENT');
        } catch (err) {
            console.error('[bulk-import] invite codes failed:', err);
        }
        const createdCredentials = accepted.map((a, i) => ({
            first_name: a.firstName,
            last_name: a.lastName,
            username: usernames[i],
            invite_code: codes.get(a.id) ?? 'ERROR',
        }));
        const toNotify = accepted.filter(a => codes.has(a.id) && (a.guardianPhone || a.guardianEmail));
        if (toNotify.length > 0) {
            after(() => forEachLimited(toNotify, NOTIFY_CONCURRENCY, a => notifyInviteCode({
                phone: a.guardianPhone,
                email: a.guardianEmail,
                firstName: a.guardianName || a.firstName,
                schoolName: school.name,
                code: codes.get(a.id) as string,
            }).then(() => undefined)));
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
