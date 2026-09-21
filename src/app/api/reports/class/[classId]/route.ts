import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import type { ReportCardData, ReportTemplateId } from '@/lib/pdfGenerator';
import {
    aggregateStudentPerformance,
    calculateClassRanks,
    generateFeedback,
    getGradeFromScales,
    getPointsFromScales,
    getPointsFromGrade,
    getRubricFromScales,
    getCategoryOrder,
    getSubjectStudentCounts,
    isKCSEGradeLevel,
} from '@/lib/analytics';
import type { ExamMarkWithDetails } from '@/lib/analytics';
import type { GradingScale } from '@/types';
import { fetchPaperScores } from '@/lib/pdf/paperScores';
import { pathwayLabel } from '@/lib/pathway-definitions';
import { computeCombinationRanks } from '@/lib/pathway/combination-rank';
import { selectExamRound } from '@/lib/reports/exam-round';
import { buildVerifyUrl, resolveOverallGradingSystem } from '@/lib/reports/grading-context';
import {
    earliestExamCreatedAt,
    fetchPreviousRound,
    fetchSubjectTeachers,
    overallClassMean,
    subjectClassAverages,
} from '@/lib/reports/comparatives';
export const runtime = 'nodejs';

/*
  Rendering thirty-five report cards measured about nine seconds, which is
  past Vercel's default function timeout. The work is bounded by class size,
  not by anything unbounded, so a generous ceiling is the right shape here —
  a timed-out report is indistinguishable from a broken one to the teacher
  waiting on it.
*/
export const maxDuration = 60;

/** Keep a class or combination label usable as a filename. */
function safeName(value: string): string {
    return (value || 'Class').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'Class';
}

function fileResponse(body: Uint8Array<ArrayBuffer>, contentType: string, filename: string): NextResponse {
    return new NextResponse(body, {
        status: 200,
        headers: {
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="${filename}"`,
            // Reports move as marks are entered; never serve a stale one.
            'Cache-Control': 'no-store',
        },
    });
}

interface ReportGroup {
    /** Appears in the filename, so it names the combination or the remainder. */
    label: string;
    reports: ReportCardData[];
}

/**
 * Ministry rule: a combination with at least `threshold` learners runs as its
 * own class group and gets its own document; smaller groups and unassigned
 * learners share one. Lifted verbatim from the page that used to do this in
 * the browser — the rule is unchanged, only where it runs.
 *
 * Returns a single unlabelled group when splitting does not apply, so the
 * caller can treat "one document" and "several" the same way.
 */
function splitReportsByCombination(
    reports: ReportCardData[],
    split: boolean,
    threshold: number,
): ReportGroup[] {
    if (!split || !reports.some(r => r.combinationCode)) {
        return [{ label: '', reports }];
    }

    const byCode = new Map<string, ReportCardData[]>();
    for (const report of reports) {
        const key = report.combinationCode || 'UNASSIGNED';
        const bucket = byCode.get(key);
        if (bucket) bucket.push(report);
        else byCode.set(key, [report]);
    }

    const groups: ReportGroup[] = [];
    const remainder: ReportCardData[] = [];
    for (const [code, members] of byCode) {
        if (code !== 'UNASSIGNED' && members.length >= threshold) {
            groups.push({ label: safeName(code), reports: members });
        } else {
            remainder.push(...members);
        }
    }

    remainder.sort((a, b) =>
        (a.combinationCode || 'zzz').localeCompare(b.combinationCode || 'zzz')
        || a.studentName.localeCompare(b.studentName));
    if (remainder.length > 0) groups.push({ label: 'Combined', reports: remainder });

    // Every learner landed in exactly one group, or splitting produced nothing
    // worth splitting; either way one document is the honest answer.
    return groups.length > 0 ? groups : [{ label: '', reports }];
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ classId: string }> }
) {
    try {
        const classId = (await params).classId;
        const { searchParams } = new URL(request.url);
        const baseUrl = new URL(request.url).origin;
        const termId = searchParams.get('termId');
        const yearId = searchParams.get('yearId');
        const rawExamType = searchParams.get('examType');
        const examType = rawExamType && rawExamType.trim() ? rawExamType : null;

        // format=pdf (or zip) returns the documents themselves; anything else
        // returns the data, which the term-comparison views still read.
        const wantsFile = ['pdf', 'zip'].includes((searchParams.get('format') || '').toLowerCase());
        const template = (searchParams.get('template') || undefined) as ReportTemplateId | undefined;
        const splitByCombination = searchParams.get('splitByCombination') === 'true';
        // Guard the threshold: a NaN or a zero from the query string would put
        // every learner in their own document.
        const parsedThreshold = Number(searchParams.get('groupThreshold'));
        const groupThreshold = Number.isFinite(parsedThreshold) && parsedThreshold > 0
            ? Math.floor(parsedThreshold)
            : 15;

        if (!termId) {
            return NextResponse.json({ error: 'termId is required for class reports' }, { status: 400 });
        }

        const supabase = createSupabaseAdmin();

        // 1. Fetch Students in the grade stream (classId = grade_stream_id)
        const { data: students, error: studentsErr } = await supabase
            .from('students')
            .select('id, admission_number, academic_level_id, current_grade_stream_id, pathway, track, subject_combination_id, users(first_name, last_name, school_id), grade_streams(full_name, grade_id), subject_combinations(id, code, name, pathway, track)')
            .eq('current_grade_stream_id', classId);

        if (studentsErr || !students || students.length === 0) {
            return NextResponse.json({ error: 'No students found in this class' }, { status: 404 });
        }

        // 2. Fetch school name, logo, and address
        let schoolName = 'School';
        let schoolLogoUrl: string | undefined;
        let schoolAddress: string | undefined;
        
        const targetSchoolId = (students[0].users as any)?.school_id;

        const { auth: clerkAuth } = await import('@clerk/nextjs/server');
        const { userId } = await clerkAuth();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: userProfile } = await supabase
            .from('users')
            .select('school_id, role')
            .eq('id', userId)
            .maybeSingle();

        const userSchoolId = userProfile?.school_id;
        if (!userSchoolId) {
            return NextResponse.json({ error: 'No school associated' }, { status: 403 });
        }

        if (targetSchoolId && targetSchoolId !== userSchoolId) {
            return NextResponse.json({ error: 'Cannot access data from another school' }, { status: 403 });
        }

        const role = userProfile?.role;
        if (role !== 'ADMIN') {
            const { getTeacherPermissions } = await import('@/lib/teacher-utils');
            const perms = await getTeacherPermissions(userId);
            if (!perms.isClassTeacher || !perms.classTeacherStreams.includes(classId)) {
                return NextResponse.json({ error: 'Only administrators and the designated class teacher can generate class reports.' }, { status: 403 });
            }
        }

        // 3. Determine academic level and grading system from first student
        let gradingSystemType: 'KCSE' | 'CBC' = 'KCSE';
        let gradingScales: GradingScale[] = [];

        const firstAcademicLevelId = students[0].academic_level_id;
        const streamName = (students[0].grade_streams as any)?.full_name || '';
        const gradeId = (students[0].grade_streams as any)?.grade_id;

        /*
          Staff see results as soon as they are entered.

          This used to refuse a non-admin the report outright — 403 — until
          every exam feeding the term had been approved. A teacher could not
          print their own class's report card while waiting on somebody else to
          click approve, which is the friction that made the whole approval step
          feel like an obstacle rather than a safeguard.

          The release flag still exists and still matters, but what it gates is
          the unauthenticated QR page a parent scans (see
          /api/verify/[studentId]), not what the school's own staff can see
          about their own learners.
        */


        // These lookups are all independent of each other — run them together
        // instead of six sequential round-trips on this batch-generation path.
        const [schoolRes, gradeRes, academicLevelRes, gradingSystemsRes, termRes, yearRes] = await Promise.all([
            targetSchoolId ? supabase.from('schools').select('name, logo_url, address').eq('id', targetSchoolId).maybeSingle() : Promise.resolve({ data: null }),
            gradeId ? supabase.from('grades').select('code').eq('id', gradeId).maybeSingle() : Promise.resolve({ data: null }),
            firstAcademicLevelId ? supabase.from('academic_levels').select('code').eq('id', firstAcademicLevelId).maybeSingle() : Promise.resolve({ data: null }),
            firstAcademicLevelId ? supabase.from('grading_systems').select('id, name').eq('academic_level_id', firstAcademicLevelId).neq('system_kind', 'OVERALL') : Promise.resolve({ data: [] as any[] }),
            termId ? supabase.from('terms').select('name, start_date, end_date, academic_year_id, midterm_reopening_date, reopening_date').eq('id', termId).maybeSingle() : Promise.resolve({ data: null }),
            yearId ? supabase.from('academic_years').select('name').eq('id', yearId).maybeSingle() : Promise.resolve({ data: null }),
        ]);

        if (schoolRes.data) {
            schoolName = schoolRes.data.name;
            schoolLogoUrl = schoolRes.data.logo_url || undefined;
            schoolAddress = schoolRes.data.address || undefined;
        }

        const gradeLevelCode = gradeRes.data?.code || '';
        // Check if grade code indicates KCSE-style grading (G7-8, G11-12, F3-4)
        const isKCSEGrade = isKCSEGradeLevel(gradeLevelCode, streamName);

        if (firstAcademicLevelId) {
            // Use grade code to determine KCSE vs CBC, fallback to academic level
            if (isKCSEGrade) {
                gradingSystemType = 'KCSE';
            } else if (academicLevelRes.data) {
                gradingSystemType = academicLevelRes.data.code === 'CBC' ? 'CBC' : 'KCSE';
            }

            // Pick the grading system for this level that actually has scales
            // (preferring the first in order), then a KCSE/Letter-named one, then
            // the first. One query for all systems' scale membership beats a
            // per-system count loop.
            const allGradingSystems = (gradingSystemsRes.data || []) as any[];
            let gradingSystemId: string | null = null;
            if (allGradingSystems.length > 0) {
                const systemIds = allGradingSystems.map(g => g.id);
                const { data: scaleRows } = await supabase
                    .from('grading_scales')
                    .select('grading_system_id')
                    .in('grading_system_id', systemIds);
                const systemsWithScales = new Set((scaleRows || []).map((r: any) => r.grading_system_id));
                gradingSystemId = allGradingSystems.find(g => systemsWithScales.has(g.id))?.id || null;
                if (!gradingSystemId) {
                    const preferred = allGradingSystems.find((gs: any) =>
                        gs.name?.toLowerCase().includes('kcse') ||
                        gs.name?.toLowerCase().includes('letter')
                    );
                    gradingSystemId = preferred?.id || allGradingSystems[0]?.id;
                }
            }

            if (gradingSystemId) {
                const { data: scales } = await supabase
                    .from('grading_scales')
                    .select('*')
                    .eq('grading_system_id', gradingSystemId)
                    .order('order_index', { ascending: true });

                if (scales) {
                    gradingScales = scales as GradingScale[];
                }
            }
        }

        // The school's opt-in Overall Grading System, resolved by the same
        // helper the single-student card and the verification page use — a
        // class report and one learner's card must never disagree about how
        // the overall grade is arrived at.
        const overall = await resolveOverallGradingSystem(
            supabase, targetSchoolId || userSchoolId, firstAcademicLevelId
        );
        const overallGradingScales = overall.scales;
        const overallGradingKind = overall.kind;

        // 4. Build grade boundaries from scales
        const gradeBoundaries = gradingScales.map(s => ({
            symbol: s.symbol,
            label: s.label,
            min: Number(s.min_percentage),
            max: Number(s.max_percentage),
            points: s.points,
        }));

        // 5. Term/year info (fetched in the batch above)
        let termTitle = termRes.data?.name || 'Term Report';
        const academicYearName = yearRes.data?.name || 'Academic Year';
        // Reopening day the admin set on the term (mid-term break vs end of
        // term), falling back to the next term's start — never this term's own
        // start_date, which is when the term began rather than when learners
        // come back. Mirrors resolveReopeningDate in the single-student route.
        let openingDate: string | undefined;
        {
            const t: any = termRes.data;
            if (t) {
                const isMidTerm = (examType || '').toUpperCase().includes('MID');
                openingDate = (isMidTerm ? (t.midterm_reopening_date || t.reopening_date) : t.reopening_date) || undefined;
                if (!openingDate && t.end_date && t.academic_year_id) {
                    const { data: nextTerm } = await supabase
                        .from('terms')
                        .select('start_date')
                        .eq('academic_year_id', t.academic_year_id)
                        .gt('start_date', t.end_date)
                        .order('start_date', { ascending: true })
                        .limit(1)
                        .maybeSingle();
                    openingDate = nextTerm?.start_date || undefined;
                }
            }
        }

        const customTitle = searchParams.get('customTitle');
        if (customTitle) {
            termTitle = customTitle;
        }

        // 6. Fetch all marks and also ALL exams for this term and class
        const studentIds = students.map(s => s.id);

        let marksQuery = supabase
            .from('exam_marks')
            .select(`
                id, student_id, percentage, raw_score, grade_symbol, rubric, remarks,
                exams!inner ( id, name, max_score, exam_type, term_id, academic_year_id, created_at,
                    subjects ( id, name, code, category, display_order )
                )
            `)
            .in('student_id', studentIds)
            .eq('exams.term_id', termId);

        if (yearId) {
            marksQuery = marksQuery.eq('exams.academic_year_id', yearId);
        }
        if (examType) {
            marksQuery = marksQuery.eq('exams.exam_type', examType);
        }

        // Fetch all exams for this term and grade to ensure all subjects are shown even if missing from exam_marks
        let examsQ = supabase
            .from('exams')
            .select('id, max_score, exam_type, subjects(id, name, code, category, display_order)')
            .eq('term_id', termId);
        if (yearId) examsQ = examsQ.eq('academic_year_id', yearId);
        if (gradeId) examsQ = examsQ.eq('grade_id', gradeId);
        if (examType) examsQ = examsQ.eq('exam_type', examType);

        // Independent of each other — fetch together.
        const [{ data: fetchedMarks, error: marksErr }, { data: termExams }] = await Promise.all([marksQuery, examsQ]);

        // Without an explicit round, narrow the whole class to ONE sitting.
        // Otherwise every round in the term (Mid Term, End Term, ...) would be
        // averaged together and each subject row would keep whichever mark the
        // DB happened to return last — a report of nothing in particular.
        const roundSelection = examType
            ? { round: examType, marks: fetchedMarks || [] }
            : selectExamRound(fetchedMarks || []);
        const allMarks = roundSelection.marks;

        if (marksErr) {
            console.error('Error fetching class marks:', marksErr);
            return NextResponse.json({ error: 'Failed to fetch marks' }, { status: 500 });
        }
        const examMap = new Map<string, any>();
        if (termExams) {
            termExams.forEach((ex: any) => {
                if (ex.subjects) {
                    examMap.set(ex.subjects.id, ex);
                }
            });
        }

        if (!allMarks || allMarks.length === 0) {
            // Wait, if no marks but we have exams? We should still generate empty reports!
            // Let's modify the check:
            if (!termExams || termExams.length === 0) {
                return NextResponse.json({ error: 'No marks and no exams found for this class and term' }, { status: 404 });
            }
        }

        // 6.5 Per-paper scores for multi-paper subjects (keyed examId|studentId)
        const markExamIds = [...new Set((allMarks || []).map((m: any) => m.exams?.id).filter(Boolean))] as string[];
        const paperScoreMap = await fetchPaperScores(supabase, markExamIds, studentIds);

        // 7. Group marks by student and calculate ranks + per-subject ranks
        const marksByStudent: Record<string, any[]> = {};
        // Per-subject aggregation: subjectId -> { studentId -> pct }[]
        const subjectAggs: Record<string, { studentId: string; pct: number }[]> = {};
        // Build subjectNamesMap/subjectCategoriesMap for 8-4-4 selection logic
        const subjectNamesMap: Record<string, string> = {};
        const subjectCategoriesMap: Record<string, string> = {};

        for (const m of allMarks || []) {
            if (!marksByStudent[m.student_id]) marksByStudent[m.student_id] = [];
            marksByStudent[m.student_id].push(m);

            // Accumulate per-subject scores for ranking
            const subjectId = (m as any).exams?.subjects?.id;
            if (subjectId) {
                if (!subjectAggs[subjectId]) subjectAggs[subjectId] = [];
                const maxScore = Number((m as any).exams.max_score);
                const pct = maxScore > 0 ? (Number(m.raw_score) / maxScore) * 100 : 0;
                subjectAggs[subjectId].push({ studentId: m.student_id, pct });

                // Build subjectNamesMap/subjectCategoriesMap
                const msubj = (m as any).exams?.subjects;
                if (msubj?.name && !subjectNamesMap[subjectId]) {
                    subjectNamesMap[subjectId] = msubj.name;
                }
                if (msubj?.category && !subjectCategoriesMap[subjectId]) {
                    subjectCategoriesMap[subjectId] = msubj.category;
                }
            }
        }

        // Aggregate each student for overall ranking
        const aggregates = students.map(student => {
            const marks = marksByStudent[student.id] || [];
            if (marks.length === 0) return { studentId: student.id, percentage: 0, totalPoints: 0 };
            
            const mapped: ExamMarkWithDetails[] = marks.map((m: any) => ({
                id: m.id,
                student_id: student.id,
                exam_id: m.exams.id || '',
                subject_id: m.exams.subjects?.id || '',
                raw_score: Number(m.raw_score),
                percentage: Number(m.percentage || 0),
                max_score: Number(m.exams.max_score),
                grade_symbol: m.grade_symbol,
                remarks: m.remarks,
            }));
            const perf = aggregateStudentPerformance(mapped, gradingScales, gradingSystemType, subjectNamesMap, subjectCategoriesMap);
            return { studentId: student.id, percentage: perf.percentage, totalPoints: perf.totalPoints };
        });

        // KCSE (8-4-4) ranks by total points; CBC ranks by percentage.
        const ranks = calculateClassRanks(aggregates, gradingSystemType === 'KCSE' ? 'points' : 'percentage');
        const rankedStudentCount = aggregates.length;

        // 7.5 CBC senior pathway ranking: rank each assigned student
        // within their grade-wide subject-combination group (all streams
        // of the same grade, same combination) — 8-4-4 is untouched.
        let combinationRankInfo = new Map<string, { rank: number; size: number }>();
        const streamCombinationIds = [...new Set(
            students.map((s: any) => s.subject_combination_id).filter(Boolean)
        )] as string[];

        if (gradingSystemType === 'CBC' && streamCombinationIds.length > 0 && gradeId && termId) {
            combinationRankInfo = await computeCombinationRanks(supabase, {
                schoolId: targetSchoolId || userSchoolId,
                gradeId,
                fallbackStreamId: classId,
                combinationIds: streamCombinationIds,
                termId,
                yearId,
                gradingScales,
            });
        }

        // Comparatives shared by every card in the batch: the class mean per
        // subject, the round before this one (deviation + change figures) and
        // who teaches each subject. Best-effort — a first-ever exam or a school
        // with no teacher assignments simply prints no comparison.
        const subjectClassAverageMap = subjectClassAverages(subjectAggs);
        const classMeanPercentage = overallClassMean(aggregates);
        const [previousRound, subjectTeacherNames] = await Promise.all([
            fetchPreviousRound(supabase, {
                studentIds,
                gradeId,
                before: earliestExamCreatedAt(allMarks || []),
                current: { termId, examType: roundSelection.round },
                gradingScales,
                gradingSystemType,
            }),
            fetchSubjectTeachers(supabase, { gradeId, gradeStreamId: classId, yearId }),
        ]);

        // Build per-subject rank maps: subjectId -> Map<studentId, rank>
        const subjectRankMaps: Record<string, Map<string, number>> = {};
        const subjectStudentCounts = getSubjectStudentCounts(subjectAggs);
        for (const [subjId, entries] of Object.entries(subjectAggs)) {
            subjectRankMaps[subjId] = calculateClassRanks(
                entries.map(e => ({ studentId: e.studentId, percentage: e.pct }))
            );
        }

        // 8. Generate raw data array instead of PDFs
        const reportCardsData: ReportCardData[] = [];

        // Batch-fetch every student's report-card comments in one query instead
        // of one per student inside the loop below (N+1 on the hottest endpoint).
        const commentsByStudent = new Map<string, { classTeacher: string; principal: string }>();
        if (termId && yearId) {
            const studentIds = students.map(s => s.id);
            const { data: reportCards } = await supabase
                .from('report_cards')
                .select('student_id, comments_class_teacher, comments_principal')
                .in('student_id', studentIds)
                .eq('term_id', termId)
                .eq('academic_year_id', yearId);
            for (const rc of reportCards || []) {
                commentsByStudent.set(rc.student_id, {
                    classTeacher: rc.comments_class_teacher || '',
                    principal: rc.comments_principal || '',
                });
            }
        }

        for (const student of students) {
            const studentMarks = marksByStudent[student.id] || [];
            // If student has no marks and there are no exams either, skip
            if (studentMarks.length === 0 && (!termExams || termExams.length === 0)) continue;

            const mapped: ExamMarkWithDetails[] = studentMarks.map((m: any) => ({
                id: m.id,
                student_id: student.id,
                exam_id: m.exams.id || '',
                subject_id: m.exams.subjects?.id || '',
                raw_score: Number(m.raw_score),
                percentage: Number(m.percentage || 0),
                max_score: Number(m.exams.max_score),
                grade_symbol: m.grade_symbol,
                remarks: m.remarks,
            }));

            const studentPerf = // only base on available marks
                 (mapped.length > 0) ? aggregateStudentPerformance(mapped, gradingScales, gradingSystemType, subjectNamesMap, subjectCategoriesMap, overallGradingScales, overallGradingKind) : { percentage: 0, totalPoints: 0, grade: '-', overallGrade: '-', selectedSubjectIds: [] };

            const selectedSubjectIds = new Set(studentPerf.selectedSubjectIds || []);

            // Resolve overall grade from total points (KCSE) or percentage (CBC)
            const isKCSE = gradingSystemType === 'KCSE';
            const overallGradeSymbol = isKCSE 
                ? studentPerf.overallGrade 
                : (gradingScales.length > 0 
                    ? getGradeFromScales(studentPerf.percentage, gradingScales) 
                    : studentPerf.grade);

            // Class teacher and principal comments (pre-fetched in one batch above)
            const studentComments = commentsByStudent.get(student.id);
            const classTeacherComment = studentComments?.classTeacher || '';
            const principalComment = studentComments?.principal || '';

            const firstName = (student.users as any)?.first_name || 'Student';
            const lastName = (student.users as any)?.last_name || '';
            const streamName = (student.grade_streams as any)?.full_name || 'N/A';

            // Build subject marks map by subject ID
            const subjMarksMap = new Map<string, any>();
            studentMarks.forEach((m: any) => {
                const subject = m.exams.subjects;
                if (!subject) return;
                // Whole-number marks on report cards — round at the source so the
                // printed mark, grade and points all come from the same value.
                const pct = Math.round(Number(m.percentage));
                // Prioritise manually-entered grade_symbol over auto-calculated
                const grade = m.grade_symbol
                    ? m.grade_symbol
                    : (gradingScales.length > 0
                        ? getGradeFromScales(pct, gradingScales)
                        : '-');
                // Points: KCSE uses grade-based, CBC uses scale-based
                let points: number | undefined;
                if (gradingScales.length > 0) {
                    if (gradingSystemType === 'KCSE') {
                        points = m.grade_symbol ? getPointsFromGrade(m.grade_symbol) : getPointsFromScales(pct, gradingScales);
                    } else {
                        points = getPointsFromScales(pct, gradingScales);
                    }
                }
                const rubric = m.rubric || ((gradingSystemType === 'CBC' && gradingScales.length > 0)
                    ? getRubricFromScales(pct, gradingScales)
                    : undefined);

                subjMarksMap.set(subject.id, {
                    subjectCode: subject.code || subject.name || 'Unknown',
                    subjectName: subject.name || 'Unknown Subject',
                    category: subject.category || 'TECHNICAL',
                    score: Math.round(Number(m.raw_score)),
                    totalPossible: Number(m.exams.max_score),
                    percentage: pct,
                    grade,
                    points,
                    rubric,
                    teacherComment: m.remarks || '',
                    subjectRank: subjectRankMaps[subject.id]?.get(student.id) ?? undefined,
                    totalStudents: subjectStudentCounts[subject.id] ?? undefined,
                    includedInPoints: selectedSubjectIds.has(subject.id),
                    paperScores: paperScoreMap.get(`${m.exams.id}|${student.id}`),
                    instructorName: subjectTeacherNames.get(subject.id),
                    classAverage: subjectClassAverageMap.get(subject.id),
                    previousPercentage: previousRound?.subjectPercentage.get(`${student.id}|${subject.id}`),
                });
            });

            const subjectMarks = Array.from(subjMarksMap.values())
                .filter((m: any) => m.score !== null && m.score !== undefined);

            // Sort by category then name
            subjectMarks.sort((a: any, b: any) => {
                const catDiff = getCategoryOrder(a.category) - getCategoryOrder(b.category);
                if (catDiff !== 0) return catDiff;
                return a.subjectName.localeCompare(b.subjectName);
            });

            // Calculate total score / total possible for the summary strip
            const computedTotalScore = subjectMarks.reduce((sum: number, m: any) => sum + (m.score || 0), 0);
            const computedTotalPossible = subjectMarks.reduce((sum: number, m: any) => sum + (m.totalPossible || 0), 0);

            const reportData: ReportCardData = {
                schoolName,
                schoolLogoUrl,
                schoolAddress,
                examTitle: termTitle,
                academicYear: academicYearName,
                studentName: `${firstName} ${lastName}`,
                enrollmentNumber: student.admission_number || '',
                className: streamName,
                gradingSystemType,
                subjectMarks,
                overallPercentage: studentPerf.percentage,
                overallGrade: overallGradeSymbol,
                totalPoints: studentPerf.totalPoints,
                overallPointsGrade: studentPerf.overallGrade,
                classRank: ranks.get(student.id) || 0,
                totalStudents: rankedStudentCount,
                pathwayName: (student as any).pathway ? pathwayLabel((student as any).pathway) : undefined,
                trackName: (student as any).track || undefined,
                combinationCode: ((student as any).subject_combinations as any)?.code || undefined,
                combinationName: ((student as any).subject_combinations as any)?.name || undefined,
                combinationRank: combinationRankInfo.get(student.id)?.rank,
                combinationSize: combinationRankInfo.get(student.id)?.size,
                classMeanPercentage,
                previousExamLabel: previousRound?.label,
                previousOverallPercentage: previousRound?.overall.get(student.id)?.percentage,
                previousTotalPoints: previousRound?.overall.get(student.id)?.totalPoints,
                previousClassRank: previousRound?.overall.get(student.id)?.rank || undefined,
                classTeacherComment: classTeacherComment || undefined,
                principalComment: principalComment || undefined,
                gradeBoundaries,
                resultUrl: buildVerifyUrl(baseUrl, student.id, termId, examType),
                totalScore: computedTotalScore,
                totalPossible: computedTotalPossible,
                openingDate,
            };

            reportCardsData.push(reportData);
        }

        const fileStem = `${safeName(streamName || 'Class')}_${safeName(termTitle)}`;

        if (!wantsFile) {
            return NextResponse.json(reportCardsData, { status: 200 });
        }

        if (reportCardsData.length === 0) {
            return NextResponse.json(
                { error: 'No students or grades found for this setup. Ensure marks are entered.' },
                { status: 404 },
            );
        }

        /*
          Render here rather than in the page.

          A class of thirty-five report cards is the heaviest document this app
          produces, and it was being built in the browser and handed over as a
          blob URL — the slowest way to make it and the least reliable way to
          deliver it, especially on a phone.

          Splitting by combination used to fire one browser download per group,
          spaced 500ms apart, with a note warning the reader that their browser
          might block the rest. Browsers block exactly that, and mobile ones
          almost always do. One zip is a single ordinary download instead.
        */
        const { generateBulkReportCardsPDF } = await import('@/lib/pdfGeneratorServer');
        const groups = splitReportsByCombination(reportCardsData, splitByCombination, groupThreshold);

        if (groups.length === 1) {
            const pdfBuffer = await generateBulkReportCardsPDF(groups[0].reports, template);
            return fileResponse(new Uint8Array(pdfBuffer), 'application/pdf', `${fileStem}_Reports.pdf`);
        }

        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        for (const group of groups) {
            const pdfBuffer = await generateBulkReportCardsPDF(group.reports, template);
            zip.file(`${fileStem}_${group.label}_Reports.pdf`, pdfBuffer);
        }
        const zipped = await zip.generateAsync({ type: 'arraybuffer' });
        return fileResponse(new Uint8Array(zipped), 'application/zip', `${fileStem}_Reports.zip`);

    } catch (error: any) {
        console.error('Batch Data Generation Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to generate class reports' }, { status: 500 });
    }
}
