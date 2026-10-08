import { z } from 'zod';
import { getCurrentAcademicYearId } from '@/lib/auth-server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { HttpError, parseBody, route, type Access } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';
import type { ClassTeacherCandidates } from '@/lib/class-teacher';
import {
    classTeacherCandidates,
    classTeacherReplaceQuestion,
    classTeacherReplaceResponse,
    setClassTeacher,
} from '@/lib/class-teacher-server';

/** Class setup stays with Admin accounts, as on the Classes and Users pages. */
function assertAdmin(access: Access): void {
    if (access.role !== 'ADMIN') throw new HttpError(403, 'Only admins can change class teachers.');
}

/** The school's teachers, each with the class they hold this year. */
export const GET = route('class-teacher GET', {}, async ({ access }): Promise<ClassTeacherCandidates> => {
    assertAdmin(access);
    const supabase = createSupabaseAdmin();
    const yearId = await getCurrentAcademicYearId(supabase, access.schoolId);
    return { teachers: await classTeacherCandidates(supabase, access.schoolId, yearId) };
});

const SetClassTeacherSchema = z.object({
    grade_stream_id: z.string().uuid(),
    user_id: z.string().min(1).nullable(),
    replace: z.boolean().optional(),
});

/**
 * Gives a class a new class teacher (or none) in one step. A change that
 * replaces someone answers 409 with the question to ask until it is sent
 * again with `replace: true`.
 */
export const PUT = route('class-teacher PUT', {}, async ({ access, request }) => {
    assertAdmin(access);
    const body = await parseBody(request, SetClassTeacherSchema);
    const supabase = createSupabaseAdmin();
    const yearId = await getCurrentAcademicYearId(supabase, access.schoolId);
    if (!yearId) throw new HttpError(400, 'Set up the academic year first.');

    const change = { schoolId: access.schoolId, yearId, streamId: body.grade_stream_id, userId: body.user_id };
    if (!body.replace) {
        const question = await classTeacherReplaceQuestion(supabase, change);
        if (question) return classTeacherReplaceResponse(question);
    }
    const result = await setClassTeacher(supabase, change);
    await audit(access, 'update', 'class_teachers', body.grade_stream_id, { user_id: body.user_id, ...result });
    return result;
});
