/**
 * Server side of learner placement: reading a class and its marks into
 * suggestions, and applying the placements an admin approved. Kept apart from
 * the route so it can be exercised against a database directly.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { SCHOOL_SUBJECT_VIEW } from '@/lib/school-subjects';
import type { PlacementApplyInput } from '@/lib/schemas';
import { MATHS_CODES, MINISTRY_COMBINATION_TEMPLATES, isMathsCode, type CbcPathway, type MathsCode } from '@/lib/pathway-definitions';
import { createSchoolCombination, CombinationError } from '@/lib/pathway/combinations';
import { syncStudentsSubjectsBulk } from '@/lib/pathway/sync-student-subjects';
import {
    customCombinationCode,
    setKey,
    suggestSeniorPlacement,
    type ElectivePlacementResponse,
    type PlacementMode,
    type PlacementResponse,
    type PlacementTarget,
    type SchoolCombinationOption,
    type SeniorPlacementResponse,
    type SubjectRef,
} from '@/lib/pathway/placement';

type Db = SupabaseClient;
type ClassStudent = { id: string; name: string; admissionNumber: string; combinationId: string | null };

/** PostgREST returns at most 1000 rows per request. */
const PAGE = 1000;

/** Thrown for requests that are well-formed but cannot be applied; the message is safe to show. */
export class PlacementError extends Error {}

/** Suggestions for one class, or null when the class isn't Senior School or 8-4-4. */
export async function getPlacement(supabase: Db, schoolId: string, streamId: string): Promise<PlacementResponse | null> {
    const mode = await placementModeFor(supabase, schoolId, streamId);
    if (!mode) return null;
    const students = await loadClass(supabase, schoolId, streamId);
    const marked = await loadMarkedSubjects(supabase, students.map(s => s.id));
    return mode === 'senior'
        ? seniorSuggestions(supabase, schoolId, students, marked)
        : electiveSuggestions(supabase, schoolId, students, marked);
}

/** Apply approved placements. Throws PlacementError or CombinationError for problems the admin can fix. */
export async function applyPlacement(supabase: Db, schoolId: string, input: PlacementApplyInput) {
    const mode = await placementModeFor(supabase, schoolId, input.grade_stream_id);
    if (mode !== input.mode) throw new PlacementError('That class does not use this kind of placement.');

    // Every learner must be in this class of this school.
    const classIds = new Set((await loadClass(supabase, schoolId, input.grade_stream_id)).map(s => s.id));
    const requested = input.mode === 'senior' ? input.placements.map(p => p.student_id) : input.enrolments.map(e => e.student_id);
    const outside = requested.filter(id => !classIds.has(id));
    if (outside.length > 0) throw new PlacementError(`${outside.length} learner(s) are not in this class.`);

    return input.mode === 'senior' ? applySenior(supabase, schoolId, input) : applyElectives(supabase, schoolId, input);
}

// ── Loading ─────────────────────────────────────────────────────────────

async function placementModeFor(supabase: Db, schoolId: string, streamId: string): Promise<PlacementMode | null> {
    const { data } = await supabase
        .from('grade_streams')
        .select('id, school_id, grades ( numeric_order, academic_levels ( code ) )')
        .eq('id', streamId)
        .maybeSingle();
    if (!data || data.school_id !== schoolId) return null;

    const grade = Array.isArray(data.grades) ? data.grades[0] : data.grades;
    const level = Array.isArray(grade?.academic_levels) ? grade?.academic_levels[0] : grade?.academic_levels;
    if (level?.code === '844') return '844';
    if (level?.code === 'CBC' && grade && grade.numeric_order >= 10 && grade.numeric_order <= 12) return 'senior';
    return null;
}

async function loadClass(supabase: Db, schoolId: string, streamId: string): Promise<ClassStudent[]> {
    const { data, error } = await supabase
        .from('students')
        .select('id, admission_number, subject_combination_id, users!inner ( first_name, last_name, school_id )')
        .eq('current_grade_stream_id', streamId)
        .eq('users.school_id', schoolId)
        .eq('status', 'ACTIVE')
        .order('admission_number');
    if (error) throw new Error(error.message);

    return (data ?? []).map(s => {
        const user = Array.isArray(s.users) ? s.users[0] : s.users;
        return {
            id: s.id as string,
            name: `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim(),
            admissionNumber: (s.admission_number as string | null) ?? '',
            combinationId: (s.subject_combination_id as string | null) ?? null,
        };
    });
}

/** Every subject each learner has at least one recorded mark in. */
async function loadMarkedSubjects(supabase: Db, studentIds: string[]): Promise<Map<string, SubjectRef[]>> {
    const subjectIdsByStudent = new Map<string, Set<string>>();
    if (studentIds.length === 0) return new Map();

    for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
            .from('exam_marks')
            .select('student_id, exams!inner ( subject_id )')
            .in('student_id', studentIds)
            .order('id')
            .range(from, from + PAGE - 1);
        if (error) throw new Error(error.message);
        for (const row of data ?? []) {
            const exam = Array.isArray(row.exams) ? row.exams[0] : row.exams;
            if (!exam?.subject_id) continue;
            const set = subjectIdsByStudent.get(row.student_id as string) ?? new Set<string>();
            set.add(exam.subject_id as string);
            subjectIdsByStudent.set(row.student_id as string, set);
        }
        if ((data ?? []).length < PAGE) break;
    }

    const allIds = [...new Set([...subjectIdsByStudent.values()].flatMap(s => [...s]))];
    const byId = new Map<string, SubjectRef>();
    if (allIds.length > 0) {
        const { data, error } = await supabase.from('subjects').select('id, code, name').in('id', allIds);
        if (error) throw new Error(error.message);
        for (const s of data ?? []) byId.set(s.id as string, { id: s.id as string, code: (s.code as string).trim().toUpperCase(), name: s.name as string });
    }

    return new Map([...subjectIdsByStudent].map(([studentId, ids]) => [
        studentId,
        [...ids].map(id => byId.get(id)).filter((s): s is SubjectRef => Boolean(s)).sort((a, b) => a.name.localeCompare(b.name)),
    ]));
}

async function loadSchoolCombinations(supabase: Db, schoolId: string): Promise<SchoolCombinationOption[]> {
    const { data, error } = await supabase
        .from('subject_combinations')
        .select('id, code, name, pathway, track, subject_combination_subjects ( subjects ( code ) )')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('code');
    if (error) throw new Error(error.message);

    return (data ?? []).map(c => ({
        id: c.id as string,
        code: c.code as string,
        name: c.name as string,
        pathway: c.pathway as CbcPathway,
        track: (c.track as string | null) ?? null,
        electiveCodes: (c.subject_combination_subjects ?? []).flatMap((row: { subjects: { code: string } | { code: string }[] | null }) => {
            const subject = Array.isArray(row.subjects) ? row.subjects[0] : row.subjects;
            return subject ? [subject.code.trim().toUpperCase()] : [];
        }),
    }));
}

// ── Suggestions ─────────────────────────────────────────────────────────

async function seniorSuggestions(
    supabase: Db,
    schoolId: string,
    students: ClassStudent[],
    marked: Map<string, SubjectRef[]>
): Promise<SeniorPlacementResponse> {
    const combinations = await loadSchoolCombinations(supabase, schoolId);
    const combinationBySet = new Map(combinations.map(c => [setKey(c.electiveCodes), c.id]));

    const currentMaths = new Map<string, MathsCode>();
    if (students.length > 0) {
        const { data } = await supabase
            .from('student_subjects')
            .select('student_id, subjects!inner ( code )')
            .in('student_id', students.map(s => s.id))
            .in('subjects.code', [...MATHS_CODES]);
        for (const row of data ?? []) {
            const subject = Array.isArray(row.subjects) ? row.subjects[0] : row.subjects;
            const code = (subject?.code as string | undefined)?.trim().toUpperCase();
            if (code && isMathsCode(code)) currentMaths.set(row.student_id as string, code);
        }
    }

    return {
        mode: 'senior',
        combinations,
        learners: students.map(s => {
            const markedSubjects = marked.get(s.id) ?? [];
            const suggestion = suggestSeniorPlacement(markedSubjects.map(m => m.code));
            const matchingCombinationId = suggestion.kind === 'official' || suggestion.kind === 'custom'
                ? combinationBySet.get(setKey(suggestion.electiveCodes)) ?? null
                : null;
            return {
                studentId: s.id,
                name: s.name,
                admissionNumber: s.admissionNumber,
                markedSubjects,
                currentCombinationId: s.combinationId,
                currentMaths: currentMaths.get(s.id) ?? null,
                suggestion,
                matchingCombinationId,
            };
        }),
    };
}

/** 8-4-4 electives: the school's non-core secondary subjects. */
async function loadElectives(supabase: Db, schoolId: string): Promise<SubjectRef[]> {
    const { data, error } = await supabase
        .from(SCHOOL_SUBJECT_VIEW)
        .select('id, code, name')
        .eq('school_id', schoolId)
        .eq('band', 'SEC')
        .neq('subject_type', 'CORE')
        .order('code');
    if (error) throw new Error(error.message);
    return (data ?? []).map(s => ({ id: s.id as string, code: s.code as string, name: s.name as string }));
}

async function electiveSuggestions(
    supabase: Db,
    schoolId: string,
    students: ClassStudent[],
    marked: Map<string, SubjectRef[]>
): Promise<ElectivePlacementResponse> {
    const electives = await loadElectives(supabase, schoolId);
    const electiveIds = new Set(electives.map(e => e.id));

    const enrolled = new Map<string, string[]>();
    if (students.length > 0 && electives.length > 0) {
        const { data, error } = await supabase
            .from('student_subjects')
            .select('student_id, subject_id')
            .in('student_id', students.map(s => s.id))
            .in('subject_id', [...electiveIds]);
        if (error) throw new Error(error.message);
        for (const row of data ?? []) {
            enrolled.set(row.student_id as string, [...(enrolled.get(row.student_id as string) ?? []), row.subject_id as string]);
        }
    }

    return {
        mode: '844',
        electives,
        learners: students.map(s => ({
            studentId: s.id,
            name: s.name,
            admissionNumber: s.admissionNumber,
            enrolledSubjectIds: enrolled.get(s.id) ?? [],
            markedSubjectIds: (marked.get(s.id) ?? []).map(m => m.id).filter(id => electiveIds.has(id)),
        })),
    };
}

// ── Applying ────────────────────────────────────────────────────────────

type SeniorInput = Extract<PlacementApplyInput, { mode: 'senior' }>;
type ElectiveInput = Extract<PlacementApplyInput, { mode: '844' }>;

async function applySenior(supabase: Db, schoolId: string, input: SeniorInput) {
    const existing = await loadSchoolCombinations(supabase, schoolId);
    const byId = new Map(existing.map(c => [c.id, c]));
    const byCode = new Map(existing.map(c => [c.code.trim().toUpperCase(), c]));
    let created = 0;

    /** Offered subject ids for catalogue codes, or an error naming what's missing. */
    const offeredIds = async (codes: readonly string[]): Promise<string[]> => {
        const { data, error } = await supabase
            .from(SCHOOL_SUBJECT_VIEW)
            .select('id, code')
            .eq('school_id', schoolId)
            .in('code', [...codes]);
        if (error) throw new Error(error.message);
        const idByCode = new Map((data ?? []).map(s => [(s.code as string).trim().toUpperCase(), s.id as string]));
        const missing = codes.filter(c => !idByCode.has(c.trim().toUpperCase()));
        if (missing.length > 0) throw new CombinationError(`Your school does not offer ${missing.join(', ')} yet — tick it on the Subjects tab first.`);
        return codes.map(c => idByCode.get(c.trim().toUpperCase()) as string);
    };

    /** Resolve a target to a school combination, creating it once if needed. */
    const resolve = async (target: PlacementTarget): Promise<SchoolCombinationOption> => {
        if (target.type === 'existing') {
            const found = byId.get(target.combinationId);
            if (!found) throw new CombinationError('That combination is not an active combination of your school.');
            return found;
        }

        const code = target.type === 'official' ? target.code.trim().toUpperCase() : customCombinationCode(target.electiveCodes);
        const reuse = byCode.get(code);
        if (reuse) return reuse;

        let spec: { name: string; pathway: CbcPathway; track: string | null; electiveCodes: string[] };
        if (target.type === 'official') {
            const template = MINISTRY_COMBINATION_TEMPLATES.find(t => t.code === code);
            if (!template) throw new CombinationError(`${code} is not an official combination.`);
            spec = { name: template.name, pathway: template.pathway, track: template.track, electiveCodes: [...template.subjectCodes] };
        } else {
            spec = { name: target.name, pathway: target.pathway, track: null, electiveCodes: target.electiveCodes.map(c => c.trim().toUpperCase()) };
        }

        const row = await createSchoolCombination(supabase, schoolId, {
            code,
            name: spec.name,
            pathway: spec.pathway,
            track: spec.track,
            subjectIds: await offeredIds(spec.electiveCodes),
        });
        const option: SchoolCombinationOption = { ...row, electiveCodes: spec.electiveCodes };
        byId.set(option.id, option);
        byCode.set(code, option);
        created++;
        return option;
    };

    // Group learners by resolved combination, so each group is one update + one sync.
    const groups = new Map<string, { combination: SchoolCombinationOption; studentIds: string[]; maths: Map<string, MathsCode> }>();
    for (const placement of input.placements) {
        const combination = await resolve(placement.target);
        const group = groups.get(combination.id) ?? { combination, studentIds: [], maths: new Map<string, MathsCode>() };
        group.studentIds.push(placement.student_id);
        if (placement.maths) group.maths.set(placement.student_id, placement.maths);
        groups.set(combination.id, group);
    }

    for (const { combination, studentIds, maths } of groups.values()) {
        const { error } = await supabase
            .from('students')
            .update({ pathway: combination.pathway, track: combination.track, subject_combination_id: combination.id })
            .in('id', studentIds);
        if (error) throw new Error(error.message);
        await syncStudentsSubjectsBulk(supabase, { studentIds, schoolId, combinationId: combination.id, mathsByStudent: maths });
    }

    return { placed: input.placements.length, combinationsCreated: created };
}

async function applyElectives(supabase: Db, schoolId: string, input: ElectiveInput) {
    const electiveIds = new Set((await loadElectives(supabase, schoolId)).map(e => e.id));
    const notElective = input.enrolments.flatMap(e => e.subject_ids).filter(id => !electiveIds.has(id));
    if (notElective.length > 0) throw new PlacementError('Only your school’s 8-4-4 electives can be set here.');

    const studentIds = input.enrolments.map(e => e.student_id);
    const { data: current, error } = await supabase
        .from('student_subjects')
        .select('student_id, subject_id')
        .in('student_id', studentIds)
        .in('subject_id', [...electiveIds]);
    if (error) throw new Error(error.message);

    const currentBy = new Map<string, Set<string>>();
    for (const row of current ?? []) {
        currentBy.set(row.student_id as string, (currentBy.get(row.student_id as string) ?? new Set()).add(row.subject_id as string));
    }

    const adds: { student_id: string; subject_id: string; role: 'ELECTIVE'; school_id: string }[] = [];
    let removed = 0;
    for (const { student_id, subject_ids } of input.enrolments) {
        const want = new Set(subject_ids);
        const have = currentBy.get(student_id) ?? new Set<string>();
        for (const id of want) if (!have.has(id)) adds.push({ student_id, subject_id: id, role: 'ELECTIVE', school_id: schoolId });

        const drop = [...have].filter(id => !want.has(id));
        if (drop.length > 0) {
            const { error: dropError } = await supabase.from('student_subjects').delete().eq('student_id', student_id).in('subject_id', drop);
            if (dropError) throw new Error(dropError.message);
            removed += drop.length;
        }
    }

    if (adds.length > 0) {
        const { error: addError } = await supabase.from('student_subjects').upsert(adds, { onConflict: 'student_id,subject_id' });
        if (addError) throw new Error(addError.message);
    }

    return { placed: input.enrolments.length, added: adds.length, removed };
}
