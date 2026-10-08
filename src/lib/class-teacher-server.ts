import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { HttpError } from '@/lib/platform/access';
import { embedOne } from '@/lib/postgrest';
import { CLASS_TEACHER_REPLACE, type ClassTeacherCandidate } from '@/lib/class-teacher';

interface NameParts { first_name: string | null; last_name: string | null }
type Embed<T> = T | T[] | null;

const nameOf = (u: NameParts | null): string => `${u?.first_name ?? ''} ${u?.last_name ?? ''}`.trim() || 'A teacher';

/** One class's class teacher change this year; `userId` null releases the class. */
export interface ClassTeacherChange {
    schoolId: string;
    yearId: string;
    streamId: string;
    userId: string | null;
}

/** The school's active teachers, each with the class they hold this year. */
export async function classTeacherCandidates(supabase: SupabaseClient, schoolId: string, yearId: string | null): Promise<ClassTeacherCandidate[]> {
    const [teachersRes, heldRes] = await Promise.all([
        supabase.from('users').select('id, first_name, last_name')
            .eq('school_id', schoolId).eq('is_active', true).in('role', ['CLASS_TEACHER', 'SUBJECT_TEACHER'])
            .order('first_name').order('last_name'),
        yearId
            ? supabase.from('class_teachers').select('user_id, current_grade_stream_id, grade_streams ( full_name )').eq('academic_year_id', yearId)
            : Promise.resolve({ data: [], error: null }),
    ]);
    if (teachersRes.error) throw teachersRes.error;
    if (heldRes.error) throw heldRes.error;

    const held = new Map((heldRes.data ?? []).map(row => [row.user_id as string, {
        id: row.current_grade_stream_id as string,
        name: embedOne(row.grade_streams as Embed<{ full_name: string }>)?.full_name ?? null,
    }]));
    return (teachersRes.data ?? []).map(u => ({
        id: u.id as string,
        name: nameOf(u),
        class_id: held.get(u.id)?.id ?? null,
        class_name: held.get(u.id)?.name ?? null,
    }));
}

/**
 * What the change would undo, as the question to put to the admin, or null
 * when it replaces nobody: the class has no other class teacher and the new
 * one holds no other class.
 */
export async function classTeacherReplaceQuestion(supabase: SupabaseClient, change: ClassTeacherChange): Promise<string | null> {
    if (!change.userId) return null;
    const held = () => supabase
        .from('class_teachers')
        .select('user_id, current_grade_stream_id, users ( first_name, last_name ), grade_streams ( full_name )')
        .eq('academic_year_id', change.yearId);
    const [byClass, byTeacher] = await Promise.all([
        held().eq('current_grade_stream_id', change.streamId),
        held().eq('user_id', change.userId),
    ]);
    if (byClass.error) throw byClass.error;
    if (byTeacher.error) throw byTeacher.error;

    const rows = [...(byClass.data ?? []), ...(byTeacher.data ?? [])].map(row => ({
        userId: row.user_id as string,
        streamId: row.current_grade_stream_id as string,
        teacher: nameOf(embedOne(row.users as Embed<NameParts>)),
        className: embedOne(row.grade_streams as Embed<{ full_name: string }>)?.full_name ?? 'another class',
    }));
    const holder = rows.find(r => r.streamId === change.streamId && r.userId !== change.userId);
    const leaving = rows.find(r => r.userId === change.userId && r.streamId !== change.streamId);
    if (!holder && !leaving) return null;

    const [{ data: newTeacher }, { data: stream }] = await Promise.all([
        supabase.from('users').select('first_name, last_name').eq('id', change.userId).maybeSingle(),
        supabase.from('grade_streams').select('full_name').eq('id', change.streamId).maybeSingle(),
    ]);
    const name = nameOf(newTeacher);
    const className = (stream?.full_name as string | undefined) ?? 'this class';
    const parts = [
        holder && `${holder.teacher} is ${className}'s class teacher and will stay on as a subject teacher.`,
        leaving && `${name} is class teacher of ${leaving.className}, which will be left without one.`,
        `Make ${name} class teacher of ${className}?`,
    ];
    return parts.filter(Boolean).join(' ');
}

/** The 409 that asks the admin to confirm a replacing change. */
export const classTeacherReplaceResponse = (question: string): NextResponse =>
    NextResponse.json({ error: question, code: CLASS_TEACHER_REPLACE }, { status: 409 });

/**
 * Makes the change in one transaction (set_class_teacher): the class's old
 * class teacher is released, the new one leaves any other class, and both
 * roles follow. Throws an HttpError the admin can act on for a refused change.
 */
export async function setClassTeacher(supabase: SupabaseClient, change: ClassTeacherChange): Promise<{ previousTeacherId: string | null; movedFromStreamId: string | null }> {
    const { data, error } = await supabase.rpc('set_class_teacher', {
        p_school_id: change.schoolId,
        p_stream_id: change.streamId,
        p_user_id: change.userId,
        p_year_id: change.yearId,
    });
    if (error) {
        if (error.code === 'P0002') throw new HttpError(404, error.message);
        if (error.code === 'P0001') throw new HttpError(400, error.message);
        throw error;
    }
    const row = (data as { previous_teacher_id: string | null; moved_from_stream_id: string | null }[] | null)?.[0];
    return { previousTeacherId: row?.previous_teacher_id ?? null, movedFromStreamId: row?.moved_from_stream_id ?? null };
}
