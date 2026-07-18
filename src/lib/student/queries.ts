// src/lib/student/queries.ts
// ============================================================
// Student-scoped Supabase queries. Every query resolves the
// current student first, then scopes data to that student_id.
// Uses admin client since NextAuth (not Supabase Auth) is used.
// ============================================================

import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentStudent } from './get-current-student';
import { select844Subjects, getGradeFromPercentageSimple, type SubjectCategory } from '@/lib/analytics';
import type { CurrentStudent } from '@/types';

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

    // CBC senior pathway: students with subject enrollments see only
    // their 7 subjects (4 compulsory cores + 3 combination electives)
    const { data: enrollments, error: enrollError } = await supabase
        .from('student_subjects')
        .select('role, subjects ( id, code, name, subject_type, display_order, category )')
        .eq('student_id', student.studentId);

    if (!enrollError && enrollments && enrollments.length > 0) {
        const enrolled = enrollments
            .map((e: any) => {
                const subject = Array.isArray(e.subjects) ? e.subjects[0] : e.subjects;
                return subject ? { ...subject, enrollment_role: e.role as 'CORE' | 'ELECTIVE' } : null;
            })
            .filter(Boolean) as any[];
        if (enrolled.length > 0) {
            enrolled.sort((a, b) => {
                if (a.enrollment_role !== b.enrollment_role) return a.enrollment_role === 'CORE' ? -1 : 1;
                return (a.display_order ?? 0) - (b.display_order ?? 0);
            });
            return enrolled;
        }
    }

    // Default: all subjects at the student's academic level
    const { data, error } = await supabase
        .from('subjects')
        .select('id, code, name, subject_type, display_order, category')
        .eq('academic_level_id', student.academicLevelId)
        .eq('school_id', student.schoolId)
        .order('display_order', { ascending: true });

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

export async function getStudentReportCards(student: CurrentStudent) {
    const supabase = createSupabaseAdmin();

    const { data, error } = await supabase
        .from('report_cards')
        .select(`
            id,
            overall_average,
            overall_position,
            comments_class_teacher,
            comments_principal,
            behaviour_summary,
            attendance_present,
            attendance_total,
            generated_at,
            academic_years ( id, name ),
            terms ( id, name ),
            grade_streams (
                id,
                name,
                full_name,
                grades ( id, code, name_display )
            ),
            report_card_subjects (
                id,
                total_score,
                total_max_score,
                percentage,
                grade_symbol,
                teacher_comment,
                subjects ( id, code, name )
            )
        `)
        .eq('student_id', student.studentId)
        .order('generated_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
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

export async function getStudentPerformanceTrends(student: CurrentStudent) {
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
                terms ( id, name ),
                academic_years ( id, name )
            )
        `)
        .eq('student_id', student.studentId)
        .eq('exams.school_id', student.schoolId);

    if (error) throw error;
    if (!marks || marks.length === 0) return [];

    // Group by term, then by subject
    const termMap: Record<string, {
        termName: string;
        yearName: string;
        termId: string;
        yearId: string;
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
    const trends = Object.values(termMap).map(term => {
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

export async function getStudentAssignments(student: CurrentStudent) {
    const supabase = createSupabaseAdmin();

    const { data, error } = await supabase
        .from('assignments')
        .select(`
            id, title, description, due_date, file_url, created_at,
            subjects!subject_id ( name )
        `)
        .eq('school_id', student.schoolId)
        .or(`grade_stream_id.eq.${student.gradeStreamId},grade_stream_id.is.null`)
        .order('due_date', { ascending: true })
        .limit(5);

    if (error) return [];
    return (data ?? []).map((a: any) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        dueDate: a.due_date,
        fileUrl: a.file_url,
        subjectName: a.subjects?.name || 'Unknown',
    }));
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

    const [profileRes, subjectsRes, resultsRes, reportsRes, attendanceRes, announcementsRes, assignmentsRes, materialsRes, trendsRes] = await Promise.allSettled([
        getCurrentStudentProfile(student),
        getStudentSubjects(student),
        getStudentResults(student),
        getStudentReportCards(student),
        getStudentAttendance(student),
        getSchoolAnnouncements(student),
        getStudentAssignments(student),
        getStudentMaterials(student),
        getStudentPerformanceTrends(student),
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

    // Current term & year
    const { data: currentTerm } = await supabase
        .from('terms')
        .select('id, name, academic_year_id, academic_years(id, name)')
        .eq('school_id', student.schoolId)
        .eq('is_current', true)
        .limit(1)
        .maybeSingle();

    // Upcoming exams (next 30 days)
    const today = new Date().toISOString().split('T')[0];
    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data: upcomingExams } = await supabase
        .from('exams')
        .select('id, name, exam_date, subjects(name)')
        .eq('school_id', student.schoolId)
        .eq('academic_level_id', student.academicLevelId)
        .gte('exam_date', today)
        .lte('exam_date', thirtyDays)
        .order('exam_date', { ascending: true })
        .limit(5);

    const latestResults = results.slice(0, 5);
    const latestReport = reports[0] ?? null;

    // Prefer the current term's KCSE-selection-aware average (best 7
    // subjects, matching the report card/marksheet) over a plain average of
    // every mark ever entered. Fall back to the plain average when the
    // current term has no marks yet (e.g. start of term).
    const currentTermTrend = currentTerm
        ? trends.find((t) => t.termId === currentTerm.id)
        : null;

    const avgScore = currentTermTrend
        ? currentTermTrend.overallAverage
        : results.length > 0
            ? Math.round((results.reduce((sum: number, item: any) => sum + Number(item.percentage || 0), 0) / results.length) * 10) / 10
            : 0;

    const attendancePresent = attendance.filter((a: any) => a.status === 'present').length;
    const attendanceRate = attendance.length > 0
        ? Math.round((attendancePresent / attendance.length) * 1000) / 10
        : 0;

    return {
        profile,
        stats: {
            subjectsCount: subjects.length,
            averageScore: avgScore,
            attendanceRate,
            hasReportCard: !!latestReport,
            examsTaken: results.length,
        },
        latestResults,
        latestReport,
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
