// src/lib/student/queries.ts
// ============================================================
// Student-scoped Supabase queries. Every query resolves the
// current student first, then scopes data to that student_id.
// Uses admin client since NextAuth (not Supabase Auth) is used.
// ============================================================

import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { SCHOOL_SUBJECT_VIEW } from '@/lib/school-subjects';
import { BAND_BY_LEVEL, catalogueLevelForGrade } from '@/lib/standard-subjects';
import type { GradeLike } from '@/lib/curriculum-bands';
import { getCurrentStudent } from './get-current-student';
import { select844Subjects, getGradeFromPercentageSimple, type SubjectCategory } from '@/lib/analytics';
import type { CurrentStudent, StudentTermTrend } from '@/types';
import { findActiveTermId } from '@/lib/term-calendar';
import { embedOne } from '@/lib/postgrest';
import { STUDENT_ASSIGNMENT_LOOKBACK_DAYS, type StudentAssignment } from '@/lib/assignments';

// ── Profile ─────────────────────────────────────────────────

async function getStudentAvatarUrl(student: CurrentStudent): Promise<string | null> {
    try {
        const supabase = createSupabaseAdmin();
        const { data } = await supabase
            .from('students')
            .select('avatar_url')
            .eq('id', student.studentId)
            .maybeSingle();
        return (data as any)?.avatar_url ?? null;
    } catch {
        return null;
    }
}

export async function getCurrentStudentProfile(student: CurrentStudent) {
    const supabase = createSupabaseAdmin();

    const [avatarUrl, profileResult] = await Promise.all([
        getStudentAvatarUrl(student),
        supabase
            .from('students')
            .select(`
                id,
                admission_number,
                date_of_birth,
                gender,
                guardian_name,
                guardian_phone,
                guardian_email,
                date_enrolled,
                status,
                academic_level_id,
                current_grade_stream_id,
                users!inner (
                    id,
                    first_name,
                    last_name,
                    email,
                    phone,
                    role,
                    is_active
                ),
                academic_levels (
                    id,
                    code,
                    name
                ),
                grade_streams (
                    id,
                    name,
                    full_name,
                    grade_id,
                    grades (
                        id,
                        code,
                        name_display
                    )
                )
            `)
            .eq('id', student.studentId)
            .maybeSingle(),
    ]);

    if (profileResult.error) throw profileResult.error;
    return { ...profileResult.data, avatar_url: avatarUrl };
}

// ── Subjects ────────────────────────────────────────────────

export async function getStudentSubjects(student: CurrentStudent) {
    const supabase = createSupabaseAdmin();

    // A learner with enrolments sees exactly what they take: their
    // enrolments (CBC senior: combination electives, maths and cores; 8-4-4:
    // the electives they were put in) plus every CORE subject of the same
    // band. 8-4-4 enrolments only list electives, so without the cores a
    // student enrolled in CRE alone would see nothing but CRE.
    const { data: enrollments, error: enrollError } = await supabase
        .from('student_subjects')
        .select('role, subjects ( id, code, name, subject_type, display_order, category, band )')
        .eq('student_id', student.studentId);

    if (!enrollError && enrollments && enrollments.length > 0) {
        type EnrolledSubject = {
            id: string; code: string; name: string; subject_type: string | null;
            display_order: number | null; category: string | null; band: string | null;
            enrollment_role: 'CORE' | 'ELECTIVE';
        };
        const enrolled: EnrolledSubject[] = enrollments.flatMap(e => {
            const subject = Array.isArray(e.subjects) ? e.subjects[0] : e.subjects;
            return subject ? [{ ...(subject as Omit<EnrolledSubject, 'enrollment_role'>), enrollment_role: e.role as 'CORE' | 'ELECTIVE' }] : [];
        });

        const bands = [...new Set(enrolled.map(s => s.band).filter((b): b is string => Boolean(b)))];
        if (bands.length > 0) {
            const { data: cores } = await supabase
                .from(SCHOOL_SUBJECT_VIEW)
                .select('id, code, name, subject_type, display_order, category, band')
                .eq('school_id', student.schoolId)
                .eq('subject_type', 'CORE')
                .in('band', bands);
            const have = new Set(enrolled.map(s => s.id));
            for (const core of cores ?? []) {
                if (!have.has(core.id)) enrolled.push({ ...(core as Omit<EnrolledSubject, 'enrollment_role'>), enrollment_role: 'CORE' });
            }
        }

        if (enrolled.length > 0) {
            enrolled.sort((a, b) => {
                if (a.enrollment_role !== b.enrollment_role) return a.enrollment_role === 'CORE' ? -1 : 1;
                return (a.display_order ?? 0) - (b.display_order ?? 0);
            });
            return enrolled;
        }
    }

    // Default: the subjects of the learner's band. One CBC level spans
    // pre-primary to Senior School, so the level alone listed all of them.
    const { data: stream } = await supabase
        .from('grade_streams')
        .select('grades ( code, name_display )')
        .eq('id', student.gradeStreamId)
        .maybeSingle();
    const grade = embedOne<GradeLike>(stream?.grades);
    const level = grade ? catalogueLevelForGrade(grade) : null;
    let query = supabase
        .from(SCHOOL_SUBJECT_VIEW)
        .select('id, code, name, subject_type, display_order, category, band')
        .eq('academic_level_id', student.academicLevelId)
        .eq('school_id', student.schoolId);
    // A school's own subject without a band is offered to every class.
    if (level) query = query.or(`band.eq.${BAND_BY_LEVEL[level]},band.is.null`);
    const { data, error } = await query.order('display_order', { ascending: true });

    if (error) throw error;
    return data ?? [];
}

// ── Results ─────────────────────────────────────────────────

export async function getStudentResults(
    student: CurrentStudent,
    filters?: { academicYearId?: string; termId?: string; subjectId?: string }
) {
    const supabase = createSupabaseAdmin();

    let query = supabase
        .from('exam_marks')
        .select(`
            id,
            raw_score,
            percentage,
            grade_symbol,
            remarks,
            created_at,
            exams!inner (
                id,
                name,
                exam_type,
                exam_date,
                max_score,
                academic_year_id,
                term_id,
                subject_id,
                school_id,
                subjects ( id, code, name ),
                academic_years ( id, name ),
                terms ( id, name )
            )
        `)
        .eq('student_id', student.studentId)
        .eq('exams.school_id', student.schoolId)
        // Released results only — the release step is what the school signs
        // off; draft marks may still be corrected.
        .eq('exams.status', 'APPROVED')
        .order('created_at', { ascending: false });

    if (filters?.academicYearId) {
        query = query.eq('exams.academic_year_id', filters.academicYearId);
    }
    if (filters?.termId) {
        query = query.eq('exams.term_id', filters.termId);
    }
    if (filters?.subjectId) {
        query = query.eq('exams.subject_id', filters.subjectId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
}

// ── Report Cards ────────────────────────────────────────────

/** One subject on a report card in the learner's list: its average over the term's released exams. */
export interface StudentReportSubject {
    id: string;
    /** The list has the term average only; the PDF prints scores and grades. */
    total_score: null;
    total_max_score: null;
    percentage: number;
    grade_symbol: null;
    teacher_comment: null;
    subjects: { id: string; name: string };
}

/** A term's report card as the learner's and parent's lists show it. */
export interface StudentReportCardListItem {
    id: string;
    student_id: string;
    overall_average: number | null;
    /** On the PDF, which ranks the class; not worked out for the list. */
    overall_position: null;
    comments_class_teacher: string | null;
    comments_principal: string | null;
    behaviour_summary: string | null;
    attendance_present: number;
    attendance_total: number;
    generated_at: string | null;
    academic_years: { id: string; name: string };
    terms: { id: string; name: string };
    grade_streams: { id: string; name: string; full_name: string } | null;
    report_card_subjects: StudentReportSubject[];
}

/**
 * The learner's report cards, newest first: one for every term with released
 * results, the card /api/reports/student/[id]?term=&year= builds from those
 * marks, with the average the dashboard shows (best seven for 8-4-4). Comments
 * a teacher saved for the term ride along.
 *
 * The list used to be the report_cards rows, which only the comments screen
 * writes: a learner with released results but no saved comments had no card,
 * and so no way to download one, and those that existed showed no average.
 * Pass `trends` when they are already loaded.
 */
export async function getStudentReportCards(
    student: CurrentStudent,
    trends?: StudentTermTrend[],
): Promise<StudentReportCardListItem[]> {
    const supabase = createSupabaseAdmin();
    const [terms, commentsRes, streamRes] = await Promise.all([
        trends ?? getStudentPerformanceTrends(student),
        supabase
            .from('report_cards')
            .select('id, term_id, academic_year_id, comments_class_teacher, comments_principal, behaviour_summary, attendance_present, attendance_total, generated_at, grade_streams ( id, name, full_name )')
            .eq('student_id', student.studentId),
        supabase.from('grade_streams').select('id, name, full_name').eq('id', student.gradeStreamId).maybeSingle(),
    ]);
    if (commentsRes.error) throw commentsRes.error;
    type Stream = StudentReportCardListItem['grade_streams'];
    const saved = new Map((commentsRes.data ?? []).map(rc => [`${rc.term_id}_${rc.academic_year_id}`, rc]));

    return [...terms].reverse().filter(t => t.termId && t.yearId).map(t => {
        const rc = saved.get(`${t.termId}_${t.yearId}`);
        return {
            id: rc?.id ?? `${t.termId}_${t.yearId}`,
            student_id: student.studentId,
            overall_average: t.overallAverage,
            overall_position: null,
            comments_class_teacher: rc?.comments_class_teacher ?? null,
            comments_principal: rc?.comments_principal ?? null,
            behaviour_summary: rc?.behaviour_summary ?? null,
            attendance_present: rc?.attendance_present ?? 0,
            attendance_total: rc?.attendance_total ?? 0,
            generated_at: rc?.generated_at ?? null,
            academic_years: { id: t.yearId, name: t.yearName },
            terms: { id: t.termId, name: t.termName },
            // The class the comments were written for, else the learner's own.
            grade_streams: embedOne<NonNullable<Stream>>(rc?.grade_streams) ?? (streamRes.data as Stream) ?? null,
            report_card_subjects: t.subjects.map(sub => ({
                id: sub.id,
                total_score: null,
                total_max_score: null,
                percentage: sub.average,
                grade_symbol: null,
                teacher_comment: null,
                subjects: { id: sub.id, name: sub.name },
            })),
        };
    });
}

// ── Attendance ──────────────────────────────────────────────

export async function getStudentAttendance(
    student: CurrentStudent,
    params?: { from?: string; to?: string }
) {
    const supabase = createSupabaseAdmin();

    let query = supabase
        .from('daily_attendance')
        .select('id, date, status, notes, created_at')
        .eq('student_id', student.studentId)
        .order('date', { ascending: false });

    if (params?.from) query = query.gte('date', params.from);
    if (params?.to) query = query.lte('date', params.to);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
}

// ── Performance Trends ──────────────────────────────────────

export async function getStudentPerformanceTrends(student: CurrentStudent): Promise<StudentTermTrend[]> {
    const supabase = createSupabaseAdmin();

    // KCSE (8-4-4) grades only the best 7 of a student's subjects; CBC has no
    // such selection. Only apply the selection for KCSE-level students, same
    // as the report card / marksheet generation.
    const { data: academicLevel } = await supabase
        .from('academic_levels')
        .select('code')
        .eq('id', student.academicLevelId)
        .maybeSingle();
    const isKCSE = academicLevel?.code !== 'CBC';

    // Derive trends from exam_marks grouped by term and subject
    const { data: marks, error } = await supabase
        .from('exam_marks')
        .select(`
            percentage,
            raw_score,
            exams!inner (
                max_score,
                term_id,
                academic_year_id,
                subject_id,
                school_id,
                subjects ( id, name, category ),
                terms ( id, name, start_date ),
                academic_years ( id, name )
            )
        `)
        .eq('student_id', student.studentId)
        .eq('exams.school_id', student.schoolId)
        .eq('exams.status', 'APPROVED');

    if (error) throw error;
    if (!marks || marks.length === 0) return [];

    // Group by term, then by subject
    const termMap: Record<string, {
        termName: string;
        yearName: string;
        termId: string;
        yearId: string;
        startDate: string | null;
        subjects: Record<string, { name: string; category?: string; totalPct: number; count: number }>;
    }> = {};

    for (const mark of marks as any[]) {
        const ex = mark.exams;
        if (!ex) continue;

        const termKey = `${ex.term_id}_${ex.academic_year_id}`;
        const termName = ex.terms?.name || 'Unknown';
        const yearName = ex.academic_years?.name || '';
        const subjName = ex.subjects?.name || 'Unknown';
        const subjCategory = ex.subjects?.category;
        const subjId = ex.subject_id;

        if (!termMap[termKey]) {
            termMap[termKey] = {
                termName,
                yearName,
                termId: ex.term_id,
                yearId: ex.academic_year_id,
                startDate: ex.terms?.start_date ?? null,
                subjects: {},
            };
        }

        if (!termMap[termKey].subjects[subjId]) {
            termMap[termKey].subjects[subjId] = { name: subjName, category: subjCategory, totalPct: 0, count: 0 };
        }

        termMap[termKey].subjects[subjId].totalPct += Number(mark.percentage);
        termMap[termKey].subjects[subjId].count += 1;
    }

    // Convert to array and compute averages. `subjects` keeps every subject
    // the student took that term (so per-subject trend views still show all
    // of a student's own history), while `overallAverage` reflects only the
    // KCSE-selected 7 subjects, matching the report card / marksheet.
    // Oldest term first, so charts read left to right and the last two
    // entries are "last term" and "this term". Grouping preserved whatever
    // order the marks arrived in, which is not chronological.
    const orderedTerms = Object.values(termMap).sort((a, b) =>
        (a.startDate ?? '').localeCompare(b.startDate ?? '') || a.yearName.localeCompare(b.yearName) || a.termName.localeCompare(b.termName));
    const trends = orderedTerms.map(term => {
        const subjectEntries = Object.entries(term.subjects).map(([subjId, s]) => {
            const avgPct = s.totalPct / s.count;
            return {
                id: subjId,
                exam_id: '',
                student_id: student.studentId,
                subject_id: subjId,
                subjectName: s.name,
                category: s.category as SubjectCategory | undefined,
                raw_score: avgPct,
                percentage: avgPct,
                max_score: 100,
                grade_symbol: getGradeFromPercentageSimple(avgPct),
            };
        });

        const subjects = subjectEntries.map(s => ({
            id: s.subject_id,
            name: s.subjectName || '',
            average: Math.round(s.raw_score * 10) / 10,
        }));

        const selectedForOverall = isKCSE ? select844Subjects(subjectEntries, []) : subjectEntries;
        const overallAverage = selectedForOverall.length > 0
            ? Math.round((selectedForOverall.reduce((sum, s) => sum + s.raw_score, 0) / selectedForOverall.length) * 10) / 10
            : 0;

        return {
            termName: term.termName,
            yearName: term.yearName,
            termId: term.termId,
            yearId: term.yearId,
            startDate: term.startDate,
            subjects,
            overallAverage,
        };
    });

    return trends;
}

// ── Announcements ────────────────────────────────────────────

const ANNOUNCEMENT_ROLE_LABELS: Record<string, string> = {
    ADMIN: 'Admin',
    CLASS_TEACHER: 'Class Teacher',
    SUBJECT_TEACHER: 'Subject Teacher',
};

export async function getSchoolAnnouncements(student: CurrentStudent) {
    const supabase = createSupabaseAdmin();

    const { data, error } = await supabase
        .from('announcements')
        .select(`
            id, title, content, is_important, created_at,
            users!posted_by ( first_name, last_name, role )
        `)
        .eq('school_id', student.schoolId)
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) return [];
    return (data ?? []).map((a: any) => {
        const poster = a.users;
        const postedBy = poster
            ? `${ANNOUNCEMENT_ROLE_LABELS[poster.role] || poster.role} ${poster.first_name} ${poster.last_name}`.trim()
            : 'School';
        return {
            id: a.id,
            title: a.title,
            content: a.content,
            isImportant: a.is_important,
            createdAt: a.created_at,
            postedBy,
        };
    });
}

// ── Assignments ─────────────────────────────────────────────

/**
 * The learner's homework: everything due from three weeks ago onwards, with
 * their own hand-in and any grade.
 *
 * This used to take the five oldest assignments by due date, so once a class
 * had been set five pieces of work nothing new ever appeared, and it never
 * said which ones the learner had already handed in.
 */
export async function getStudentAssignments(student: CurrentStudent): Promise<StudentAssignment[]> {
    const supabase = createSupabaseAdmin();
    const since = new Date(Date.now() - STUDENT_ASSIGNMENT_LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10);

    let query = supabase
        .from('assignments')
        .select(`
            id, title, description, due_date, file_url,
            subjects!subject_id ( id, name ),
            assignment_submissions ( student_id, submitted_at, submission_text, file_url, grade, feedback, graded_at )
        `)
        .eq('school_id', student.schoolId)
        .eq('assignment_submissions.student_id', student.userId)
        .gte('due_date', since);
    query = student.gradeStreamId
        ? query.or(`grade_stream_id.eq.${student.gradeStreamId},grade_stream_id.is.null`)
        : query.is('grade_stream_id', null);

    const { data, error } = await query.order('due_date', { ascending: true }).limit(50);
    if (error) return [];

    type Row = {
        id: string; title: string; description: string | null; due_date: string; file_url: string | null;
        subjects: { id: string; name: string } | { id: string; name: string }[] | null;
        assignment_submissions: { submitted_at: string; submission_text: string | null; file_url: string | null; grade: number | null; feedback: string | null; graded_at: string | null }[] | null;
    };
    return ((data ?? []) as unknown as Row[]).map(a => {
        const mine = a.assignment_submissions?.[0];
        return {
            id: a.id,
            title: a.title,
            description: a.description,
            dueDate: a.due_date,
            fileUrl: a.file_url,
            subjectId: embedOne(a.subjects)?.id ?? null,
            subjectName: embedOne(a.subjects)?.name ?? 'Unknown subject',
            submission: mine
                ? { submittedAt: mine.submitted_at, text: mine.submission_text, fileUrl: mine.file_url, grade: mine.grade == null ? null : Number(mine.grade), feedback: mine.feedback, gradedAt: mine.graded_at }
                : null,
        };
    });
}

// ── Learning Materials ──────────────────────────────────────

export async function getStudentMaterials(student: CurrentStudent) {
    const supabase = createSupabaseAdmin();

    const { data, error } = await supabase
        .from('learning_materials')
        .select(`
            id, title, description, file_url, file_size_bytes, file_type, created_at,
            subjects!subject_id ( name )
        `)
        .eq('school_id', student.schoolId)
        .or(`grade_stream_id.eq.${student.gradeStreamId},grade_stream_id.is.null`)
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) return [];
    return (data ?? []).map((m: any) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        fileUrl: m.file_url,
        fileSizeBytes: m.file_size_bytes,
        fileType: m.file_type,
        subjectName: m.subjects?.name || 'Unknown',
        createdAt: m.created_at,
    }));
}

// ── Dashboard Summary ───────────────────────────────────────

export async function getStudentDashboardSummary(student: CurrentStudent) {
    const supabase = createSupabaseAdmin();

    // Loaded once: the report cards are built from the same term averages.
    const trendsLoad = getStudentPerformanceTrends(student);
    const [profileRes, subjectsRes, resultsRes, reportsRes, attendanceRes, announcementsRes, assignmentsRes, materialsRes, trendsRes] = await Promise.allSettled([
        getCurrentStudentProfile(student),
        getStudentSubjects(student),
        getStudentResults(student),
        trendsLoad.then(trends => getStudentReportCards(student, trends)),
        getStudentAttendance(student),
        getSchoolAnnouncements(student),
        getStudentAssignments(student),
        getStudentMaterials(student),
        trendsLoad,
    ]);

    const profile = profileRes.status === 'fulfilled' ? profileRes.value : null;
    const subjects = subjectsRes.status === 'fulfilled' ? subjectsRes.value : [];
    const results = resultsRes.status === 'fulfilled' ? resultsRes.value : [];
    const reports = reportsRes.status === 'fulfilled' ? reportsRes.value : [];
    const attendance = attendanceRes.status === 'fulfilled' ? attendanceRes.value : [];
    const announcements = announcementsRes.status === 'fulfilled' ? announcementsRes.value : [];
    const assignments = assignmentsRes.status === 'fulfilled' ? assignmentsRes.value : [];
    const materials = materialsRes.status === 'fulfilled' ? materialsRes.value : [];
    const trends = trendsRes.status === 'fulfilled' ? trendsRes.value : [];

    // Current term & year: the same pick as every staff page (today's dates,
    // then the school's flag). This used to need the "current" flag, so a
    // school that never set one showed its learners no current term at all.
    const { data: schoolTerms } = await supabase
        .from('terms')
        .select('id, name, start_date, end_date, is_current, academic_year_id, academic_years(id, name)')
        .eq('school_id', student.schoolId);
    const currentTermId = findActiveTermId(schoolTerms ?? []);
    const currentTerm = (schoolTerms ?? []).find(t => t.id === currentTermId) ?? null;

    // Upcoming exams (next 30 days)
    const today = new Date().toISOString().split('T')[0];
    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // The learner's own class: its papers, and the grade-wide ones for its
    // grade. (This filtered on exams.academic_level_id, a column exams does
    // not have, so the query failed and the list was always empty.)
    const { data: stream } = student.gradeStreamId
        ? await supabase.from('grade_streams').select('grade_id').eq('id', student.gradeStreamId).maybeSingle()
        : { data: null };
    const classFilter = !student.gradeStreamId
        ? null
        : stream?.grade_id
            ? `grade_stream_id.eq.${student.gradeStreamId},and(grade_id.eq.${stream.grade_id},grade_stream_id.is.null)`
            : `grade_stream_id.eq.${student.gradeStreamId}`;
    const { data: upcomingExams } = classFilter
        ? await supabase
            .from('exams')
            .select('id, name, exam_date, subjects(name)')
            .eq('school_id', student.schoolId)
            .or(classFilter)
            .gte('exam_date', today)
            .lte('exam_date', thirtyDays)
            .order('exam_date', { ascending: true })
            .limit(5)
        : { data: [] };

    const latestResults = results.slice(0, 5);
    const latestReport = reports[0] ?? null;

    // One term's average, as its report card has it (best seven for 8-4-4):
    // this term's, or before its results are out the latest term with some.
    // It used to fall back to a plain mean of every mark ever released, all
    // years and rounds together, under a label naming a single term.
    const averageTerm = (currentTerm && trends.find((t) => t.termId === currentTerm.id)) || trends.at(-1) || null;
    const avgScore = averageTerm?.overallAverage ?? 0;

    const attendancePresent = attendance.filter((a: any) => a.status === 'present').length;
    const attendanceRate = attendance.length > 0
        ? Math.round((attendancePresent / attendance.length) * 1000) / 10
        : 0;

    return {
        profile,
        stats: {
            subjectsCount: subjects.length,
            averageScore: avgScore,
            /** The term `averageScore` is for, to label it with. */
            averageTerm: averageTerm ? averageTerm.termName : null,
            attendanceRate,
            hasReportCard: !!latestReport,
            examsTaken: results.length,
            // How many attendance days are on record: 0 means the school does
            // not take registers, so a 0% rate is not information.
            attendanceRecords: attendance.length,
        },
        latestResults,
        latestReport,
        trends,
        upcomingExams: (upcomingExams ?? []).map((e: any) => ({
            id: e.id,
            name: e.name,
            exam_date: e.exam_date,
            subject_name: e.subjects?.name || 'Unknown',
        })),
        announcements,
        assignments,
        materials,
        currentTerm: currentTerm ? { id: currentTerm.id, name: currentTerm.name } : undefined,
        currentYear: currentTerm?.academic_years
            ? { id: (currentTerm.academic_years as any).id, name: (currentTerm.academic_years as any).name }
            : undefined,
    };
}
