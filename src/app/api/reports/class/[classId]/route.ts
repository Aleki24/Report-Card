import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { ReportCardData } from '@/lib/pdfGenerator';
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
export const runtime = 'nodejs';

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

        if (targetSchoolId) {
            const { data: schoolData } = await supabase.from('schools').select('name, logo_url, address').eq('id', targetSchoolId).maybeSingle();
            if (schoolData) {
                schoolName = schoolData.name;
                schoolLogoUrl = schoolData.logo_url || undefined;
                schoolAddress = schoolData.address || undefined;
            }
        }

        // 3. Determine academic level and grading system from first student
        let gradingSystemType: 'KCSE' | 'CBC' = 'KCSE';
        let gradingScales: GradingScale[] = [];

        const firstAcademicLevelId = students[0].academic_level_id;
        const streamName = (students[0].grade_streams as any)?.full_name || '';
        const gradeId = (students[0].grade_streams as any)?.grade_id;
        
        // Fetch grade code from grades table
        let gradeLevelCode = '';
        if (gradeId) {
            const { data: gradeData } = await supabase.from('grades').select('code').eq('id', gradeId).maybeSingle();
            if (gradeData) gradeLevelCode = gradeData.code || '';
        }
        
        // Check if grade code indicates KCSE-style grading (G7-8, G11-12, F3-4)
        const isKCSEGrade = isKCSEGradeLevel(gradeLevelCode, streamName);

        if (firstAcademicLevelId) {
            const { data: academicLevel } = await supabase
                .from('academic_levels')
                .select('code')
                .eq('id', firstAcademicLevelId)
                .maybeSingle();

            // Use grade code to determine KCSE vs CBC, fallback to academic level
            if (isKCSEGrade) {
                gradingSystemType = 'KCSE';
            } else if (academicLevel) {
                gradingSystemType = academicLevel.code === 'CBC' ? 'CBC' : 'KCSE';
            }
            
            // Fetch grading systems for this academic level - get the one with scales
            const { data: allGradingSystems } = await supabase
                .from('grading_systems')
                .select('id, name')
                .eq('academic_level_id', firstAcademicLevelId);

            // Find the grading system with scales (prefer KCSE/8-4-4 letter grades)
            let gradingSystemId: string | null = null;
            if (allGradingSystems && allGradingSystems.length > 0) {
                for (const gs of allGradingSystems) {
                    const { count } = await supabase
                        .from('grading_scales')
                        .select('id', { count: 'exact', head: true })
                        .eq('grading_system_id', gs.id);
                    
                    if (count && count > 0) {
                        gradingSystemId = gs.id;
                        break; // Found one with scales
                    }
                }
                // Fallback: prefer system with "KCSE" or "Letter" in name
                if (!gradingSystemId && allGradingSystems.length > 0) {
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

        // 4. Build grade boundaries from scales
        const gradeBoundaries = gradingScales.map(s => ({
            symbol: s.symbol,
            label: s.label,
            min: Number(s.min_percentage),
            max: Number(s.max_percentage),
            points: s.points,
        }));

        // 5. Fetch term/year info
        let termTitle = 'Term Report';
        let academicYearName = 'Academic Year';
        let openingDate: string | undefined;
        if (termId) {
            const { data: termData } = await supabase.from('terms').select('name, opening_date').eq('id', termId).maybeSingle();
            if (termData) termTitle = termData.name;
            openingDate = termData?.opening_date || undefined;
        }
        
        const customTitle = searchParams.get('customTitle');
        if (customTitle) {
            termTitle = customTitle;
        }
        if (yearId) {
            const { data: yearData } = await supabase.from('academic_years').select('name').eq('id', yearId).maybeSingle();
            if (yearData) academicYearName = yearData.name;
        }

        // 6. Fetch all marks and also ALL exams for this term and class
        const studentIds = students.map(s => s.id);

        let marksQuery = supabase
            .from('exam_marks')
            .select(`
                id, student_id, percentage, raw_score, grade_symbol, rubric, remarks,
                exams!inner ( id, name, max_score, term_id, academic_year_id,
                    subjects ( id, name, code, category, display_order )
                )
            `)
            .in('student_id', studentIds)
            .eq('exams.term_id', termId);

        if (yearId) {
            marksQuery = marksQuery.eq('exams.academic_year_id', yearId);
        }

        const { data: allMarks, error: marksErr } = await marksQuery;

        if (marksErr) {
            console.error('Error fetching class marks:', marksErr);
            return NextResponse.json({ error: 'Failed to fetch marks' }, { status: 500 });
        }

        // Fetch all exams for this term and grade to ensure all subjects are shown even if missing from exam_marks
        let examsQ = supabase
            .from('exams')
            .select('id, max_score, subjects(id, name, code, category, display_order)')
            .eq('term_id', termId);
        if (yearId) examsQ = examsQ.eq('academic_year_id', yearId);
        if (gradeId) examsQ = examsQ.eq('grade_id', gradeId);

        const { data: termExams } = await examsQ;
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
                 (mapped.length > 0) ? aggregateStudentPerformance(mapped, gradingScales, gradingSystemType, subjectNamesMap, subjectCategoriesMap) : { percentage: 0, totalPoints: 0, grade: '-', overallGrade: '-', selectedSubjectIds: [] };

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
                const pct = Number(m.percentage);
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
                    score: Number(m.raw_score),
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
                classTeacherComment: classTeacherComment || undefined,
                principalComment: principalComment || undefined,
                gradeBoundaries,
                resultUrl: `${baseUrl}/student/${student.id}`,
                totalScore: computedTotalScore,
                totalPossible: computedTotalPossible,
                openingDate,
            };

            reportCardsData.push(reportData);
        }

        return NextResponse.json(reportCardsData, { status: 200 });

    } catch (error: any) {
        console.error('Batch Data Generation Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to generate class reports' }, { status: 500 });
    }
}
