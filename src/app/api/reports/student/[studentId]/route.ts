import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { generateStudentReportCardPDF, ReportCardData } from '@/lib/pdfGenerator';
import {
    aggregateStudentPerformance,
    calculateClassRanks,
    generateFeedback,
    getGradeFromScales,
    getPointsFromScales,
    getRubricFromScales,
    getCategoryOrder,
    getSubjectStudentCounts,
} from '@/lib/analytics';
import type { ExamMarkWithDetails } from '@/lib/analytics';
import type { GradingScale } from '@/types';

export const runtime = 'nodejs';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ studentId: string }> }
) {
    try {
        const studentId = (await params).studentId;
        const { searchParams } = new URL(request.url);
        const baseUrl = new URL(request.url).origin;
        const termId = searchParams.get('termId') || searchParams.get('term');
        const yearId = searchParams.get('yearId') || searchParams.get('year');

        const supabase = createSupabaseAdmin();

        // 1. Fetch Student Data
        const { data: student, error: studentErr } = await supabase
            .from('students')
            .select(`
                *,
                users(first_name, last_name, school_id),
                grade_streams(full_name, grade_id)
            `)
            .eq('id', studentId)
            .single();

        if (studentErr || !student) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        // 2. Fetch school name, logo, and address
        let schoolName = 'School';
        let schoolLogoUrl: string | undefined;
        let schoolAddress: string | undefined;
        
        // Try getting school_id from the student's user relation first (if exists)
        const targetSchoolId = student.users?.school_id;
        
        const { getServerSession } = await import('next-auth');
        const { authOptions } = await import('@/lib/auth');
        const session = await getServerSession(authOptions) as any;

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userSchoolId = session.user.schoolId;
        if (!userSchoolId) {
            return NextResponse.json({ error: 'No school associated' }, { status: 403 });
        }

        if (targetSchoolId && targetSchoolId !== userSchoolId) {
            return NextResponse.json({ error: 'Cannot access data from another school' }, { status: 403 });
        }

        const role = session.user.role;
        const userId = session.user.id;

        if (role === 'STUDENT') {
            if (userId !== studentId) {
                 return NextResponse.json({ error: 'Unauthorized to view this student report' }, { status: 403 });
            }
        } else if (role !== 'ADMIN') {
            const { getTeacherPermissions } = await import('@/lib/teacher-utils');
            const perms = await getTeacherPermissions(userId);
            if (!perms.isClassTeacher || !perms.classTeacherStreams.includes(student.current_grade_stream_id)) {
                return NextResponse.json({ error: 'Only administrators and the designated class teacher can generate student reports.' }, { status: 403 });
            }
        }

        if (targetSchoolId) {
            const { data: schoolData } = await supabase
                .from('schools')
                .select('name, logo_url, address')
                .eq('id', targetSchoolId)
                .single();
            if (schoolData) {
                schoolName = schoolData.name;
                schoolLogoUrl = schoolData.logo_url || undefined;
                schoolAddress = schoolData.address || undefined;
            }
        }

        // 3. Determine academic level and grading system
        let gradingSystemType: 'KCSE' | 'CBC' = 'KCSE';
        let gradingScales: GradingScale[] = [];

        // Determine grading system by grade code - G7-8, G11-12, F3-4 use KCSE style
        // Grade 9 and 10 are CBC
        const gradeCode = student.grade_streams?.full_name || '';
        const isKCSEGrade = /^(G[78]|G1[12]|F[34])/.test(gradeCode);

        if (student.academic_level_id) {
            // Fetch the academic level code to determine KCSE vs CBC
            const { data: academicLevel } = await supabase
                .from('academic_levels')
                .select('code')
                .eq('id', student.academic_level_id)
                .single();

            // Use grade code to determine KCSE vs CBC, fallback to academic level
            if (isKCSEGrade) {
                gradingSystemType = 'KCSE';
            } else if (academicLevel) {
                gradingSystemType = academicLevel.code === 'CBC' ? 'CBC' : 'KCSE';
            }

            // Fetch grading scales for this academic level
            const { data: gradingSystem } = await supabase
                .from('grading_systems')
                .select('id')
                .eq('academic_level_id', student.academic_level_id)
                .limit(1)
                .single();

            if (gradingSystem) {
                const { data: scales } = await supabase
                    .from('grading_scales')
                    .select('*')
                    .eq('grading_system_id', gradingSystem.id)
                    .order('order_index', { ascending: true });

                if (scales) {
                    gradingScales = scales as GradingScale[];
                }
            }
        }

        // 3.5 Fetch all term exams to ensure empty subjects are displayed
        const gradeId = student.grade_streams?.grade_id;

        let examsQ = supabase
            .from('exams')
            .select('id, max_score, terms(name), academic_years(name), subjects(id, name, code, category, display_order, grading_system_id)')
            .eq('term_id', termId);
        
        if (yearId) examsQ = examsQ.eq('academic_year_id', yearId);
        if (gradeId) examsQ = examsQ.eq('grade_id', gradeId);

        const { data: termExams } = await examsQ;

        // 4. Fetch Marks with subject details including grading_system_id
        let marksQuery = supabase
            .from('exam_marks')
            .select(`
                id, percentage, raw_score, grade_symbol, rubric, remarks,
                exams!inner ( id, name, max_score, term_id, academic_year_id,
                    terms ( name ),
                    academic_years ( name ),
                    subjects ( id, name, code, category, display_order, grading_system_id )
                )
            `)
            .eq('student_id', studentId);

        if (termId) {
            marksQuery = marksQuery.eq('exams.term_id', termId);
        }
        if (yearId) {
            marksQuery = marksQuery.eq('exams.academic_year_id', yearId);
        }

        const { data: marks, error: marksErr } = await marksQuery;

        if (marksErr) {
            console.error("Supabase error fetching marks:", marksErr);
            return NextResponse.json({ error: 'Supabase error fetching marks', details: marksErr }, { status: 500 });
        }

        if ((!marks || marks.length === 0) && (!termExams || termExams.length === 0)) {
            return NextResponse.json({ error: 'No marks and no exams found for student in this term' }, { status: 404 });
        }

        // 4.5 Fetch subject-specific grading systems
        const subjectGradingSystems: Record<string, GradingScale[]> = {};
        const subjectGradingSystemTypes: Record<string, 'KCSE' | 'CBC'> = {};
        
        const gradingSystemIds = new Set<string>();
        if (termExams) {
            for (const exam of termExams) {
                const subj = (exam as any).subjects;
                if (subj?.grading_system_id) {
                    gradingSystemIds.add(subj.grading_system_id);
                }
            }
        }
        if (marks) {
            for (const m of marks) {
                const subj = (m as any).exams?.subjects;
                if (subj?.grading_system_id) {
                    gradingSystemIds.add(subj.grading_system_id);
                }
            }
        }

        for (const gsId of gradingSystemIds) {
            const { data: gs } = await supabase
                .from('grading_systems')
                .select('id, academic_levels!inner(code)')
                .eq('id', gsId)
                .single();
            
            if (gs) {
                const levelCode = (gs.academic_levels as any)?.code;
                subjectGradingSystemTypes[gsId] = levelCode === 'CBC' ? 'CBC' : 'KCSE';
            }

            const { data: scales } = await supabase
                .from('grading_scales')
                .select('*')
                .eq('grading_system_id', gsId)
                .order('order_index', { ascending: true });
            
            if (scales) {
                subjectGradingSystems[gsId] = scales as GradingScale[];
            }
        }

        const safeMarks = marks || [];
        const firstExam = safeMarks.length > 0 ? safeMarks[0].exams : (termExams && termExams.length > 0 ? termExams[0] : null);

        let termTitle = 'Term Report';
        let academicYear = 'Academic Year';
        
        if (firstExam) {
            termTitle = (firstExam as any).terms?.name || 'Term Report';
            academicYear = (firstExam as any).academic_years?.name || 'Academic Year';
        }

        const customTitle = searchParams.get('customTitle');
        if (customTitle) {
            termTitle = customTitle;
        }

        // 5. Map to analytics interface and calculate performance
        const subjectNamesMap: Record<string, string> = {};
        const mappedMarks: ExamMarkWithDetails[] = safeMarks.map((m: any) => {
            const subjId = m.exams.subjects?.id || '';
            const subjName = m.exams.subjects?.name || '';
            if (subjId && subjName) {
                subjectNamesMap[subjId] = subjName;
            }
            return {
                id: m.id,
                student_id: studentId,
                exam_id: m.exams.id || '',
                subject_id: subjId,
                raw_score: Number(m.raw_score),
                percentage: Number(m.percentage || 0),
                max_score: Number(m.exams.max_score),
                grade_symbol: m.grade_symbol,
                remarks: m.remarks
            };
        });

        const studentPerf = mappedMarks.length > 0 ? aggregateStudentPerformance(mappedMarks, gradingScales, gradingSystemType, subjectNamesMap) : { percentage: 0, rawAverage: 0, used844Selection: false, totalPoints: 0, grade: '-', overallGrade: '-', selectedSubjectIds: [] };
        
        const selectedSubjectIds = new Set(studentPerf.selectedSubjectIds || []);
        
        // For display, use percentage based on whether 844 selection was applied
        const displayPercentage = studentPerf.used844Selection ? studentPerf.percentage : studentPerf.rawAverage;

        // 6. Calculate class ranking + per-subject ranks
        let classRank = 0;
        let totalStudents = 0;
        const gradeStreamId = student.current_grade_stream_id;
        const subjectRanksMap = new Map<string, number>(); // subjectId -> this student's rank
        const subjectStudentCountMap = new Map<string, number>(); // subjectId -> total students taking this subject

        if (gradeStreamId) {
            const { data: classmates } = await supabase
                .from('students')
                .select('id')
                .eq('current_grade_stream_id', gradeStreamId);

            if (classmates && classmates.length > 0) {
                totalStudents = classmates.length;
                const classmateIds = classmates.map((c: any) => c.id);

                let rankQuery = supabase
                    .from('exam_marks')
                    .select('student_id, raw_score, exams!inner(max_score, term_id, academic_year_id, subjects(id))')
                    .in('student_id', classmateIds);

                if (termId) rankQuery = rankQuery.eq('exams.term_id', termId);
                if (yearId) rankQuery = rankQuery.eq('exams.academic_year_id', yearId);

                const { data: allMarks } = await rankQuery;

                if (allMarks && allMarks.length > 0) {
                    const studentAggs: Record<string, { totalScore: number; totalPossible: number }> = {};
                    // Per-subject aggregation: subjectId -> { studentId -> percentage }
                    const subjectAggs: Record<string, { studentId: string; pct: number }[]> = {};

                    for (const m of allMarks as any[]) {
                        const sid = m.student_id;
                        const subjectId = m.exams.subjects?.id;
                        if (!studentAggs[sid]) studentAggs[sid] = { totalScore: 0, totalPossible: 0 };
                        studentAggs[sid].totalScore += Number(m.raw_score);
                        studentAggs[sid].totalPossible += Number(m.exams.max_score);

                        // Accumulate per-subject scores
                        if (subjectId) {
                            if (!subjectAggs[subjectId]) subjectAggs[subjectId] = [];
                            const maxScore = Number(m.exams.max_score);
                            const pct = maxScore > 0 ? (Number(m.raw_score) / maxScore) * 100 : 0;
                            subjectAggs[subjectId].push({ studentId: sid, pct });
                        }
                    }

                    // Overall class ranks
                    const aggregates = Object.entries(studentAggs)
                        .filter(([, v]) => v.totalPossible > 0)
                        .map(([sid, v]) => ({
                            studentId: sid,
                            percentage: (v.totalScore / v.totalPossible) * 100,
                        }));

                    const ranks = calculateClassRanks(aggregates);
                    classRank = ranks.get(studentId) || 0;
                    totalStudents = aggregates.length;

                    // Get student counts per subject
                    const subjectStudentCounts = getSubjectStudentCounts(subjectAggs);

                    // Per-subject ranks for this student
                    for (const [subjId, entries] of Object.entries(subjectAggs)) {
                        const subjRanks = calculateClassRanks(
                            entries.map(e => ({ studentId: e.studentId, percentage: e.pct }))
                        );
                        const rank = subjRanks.get(studentId);
                        if (rank) {
                            subjectRanksMap.set(subjId, rank);
                            // Also store the total students taking this subject
                            subjectStudentCountMap.set(subjId, subjectStudentCounts[subjId]);
                        }
                    }
                }
            }
        }

        // 7. Resolve overall grade from total points (KCSE) or percentage (CBC)
        // Use same logic as marksheet: KCSE uses points-based grade, CBC uses percentage-based grade
        const isKCSE = gradingSystemType === 'KCSE';
        const overallGradeSymbol = isKCSE 
            ? studentPerf.overallGrade 
            : (gradingScales.length > 0 
                ? getGradeFromScales(studentPerf.percentage, gradingScales) 
                : studentPerf.grade);

        // 8. Fetch class teacher and principal comments from report_cards table
        let classTeacherComment = '';
        let principalComment = '';
        if (termId && yearId) {
            const { data: reportCard } = await supabase
                .from('report_cards')
                .select('comments_class_teacher, comments_principal')
                .eq('student_id', studentId)
                .eq('term_id', termId)
                .eq('academic_year_id', yearId)
                .single();

            if (reportCard?.comments_class_teacher) {
                classTeacherComment = reportCard.comments_class_teacher;
            }
            if (reportCard?.comments_principal) {
                principalComment = reportCard.comments_principal;
            }
        }

        // 9. Build grade boundaries from scales
        const gradeBoundaries = gradingScales.map(s => ({
            symbol: s.symbol,
            label: s.label,
            min: Number(s.min_percentage),
            max: Number(s.max_percentage),
            points: s.points,
        }));

        // 10. Build subject marks with category, points/rubric, ranks, and teacher comments
        // Use subject-specific grading when available, otherwise use academic level grading
        const subjMarksMap = new Map<string, any>();
        
        safeMarks.forEach((m: any) => {
            const subject = m.exams.subjects;
            if (!subject) return;
            const pct = Number(m.percentage);

            // Get subject-specific grading if available
            const subjectGsId = subject.grading_system_id;
            const subjectScales = subjectGsId ? subjectGradingSystems[subjectGsId] : null;
            const isSubjectCBC = subjectGsId ? subjectGradingSystemTypes[subjectGsId] === 'CBC' : gradingSystemType === 'CBC';
            
            // Use subject-specific scales if available, otherwise fall back to academic level
            const effectiveScales = subjectScales && subjectScales.length > 0 ? subjectScales : gradingScales;
            
            // Use ONLY manually-entered grade - NO auto-grading
            // Teachers must manually select grades for each student
            const grade = m.grade_symbol ? m.grade_symbol : '-';

            // Points: if manual grade entered, use points from that grade; otherwise calculate from percentage
            let points: number | undefined;
            if (m.grade_symbol && effectiveScales.length > 0) {
                const gradeMatch = effectiveScales.find(s => s.symbol === m.grade_symbol);
                if (gradeMatch) {
                    points = gradeMatch.points;
                }
            }
            if (points === undefined && effectiveScales.length > 0) {
                points = getPointsFromScales(pct, effectiveScales);
            }

            const rubric = m.rubric || ((isSubjectCBC && m.grade_symbol && effectiveScales.length > 0)
                ? getRubricFromScales(pct, effectiveScales)
                : undefined);

            subjMarksMap.set(subject.id, {
                subjectCode: subject.code || subject.name || 'Unknown',
                subjectName: subject.name || 'Unknown Subject',
                category: subject.category || 'TECHNICAL',
                gradingSystemType: isSubjectCBC ? 'CBC' : 'KCSE',
                score: Number(m.raw_score),
                totalPossible: Number(m.exams.max_score),
                percentage: pct,
                grade,
                points,
                rubric,
                teacherComment: m.remarks || '',
                subjectRank: subjectRanksMap.get(subject.id) ?? undefined,
                totalStudents: subjectStudentCountMap.get(subject.id) ?? undefined,
                includedInPoints: selectedSubjectIds.has(subject.id),
            });
        });

        // Only include subjects that have marks entered (filter out exams without marks)
        // This handles CBC students who don't take all subjects
        const subjectMarks = Array.from(subjMarksMap.values())
            .filter((m: any) => m.score !== null && m.score !== undefined);

        // Sort by category then display_order
        subjectMarks.sort((a: any, b: any) => {
            const catDiff = getCategoryOrder(a.category) - getCategoryOrder(b.category);
            if (catDiff !== 0) return catDiff;
            return a.subjectName.localeCompare(b.subjectName);
        });

        // 11. Calculate total score / total possible for the summary strip (only for subjects with marks)
        const computedTotalScore = subjectMarks.reduce((sum: number, m: any) => sum + (m.score || 0), 0);
        const computedTotalPossible = subjectMarks.reduce((sum: number, m: any) => sum + (m.totalPossible || 0), 0);

        // 11.5 Fetch subject trend data (historical performance across terms)
        const subjectTrendData: { subjectName: string; scores: { term: string; percentage: number }[] }[] = [];
        
        try {
            // Get all marks for this student across all terms
            const { data: allMarks } = await supabase
                .from('exam_marks')
                .select(`
                    percentage,
                    exams!inner ( 
                        term_id,
                        subjects ( id, name )
                    )
                `)
                .eq('student_id', studentId);
            
            if (allMarks && allMarks.length > 0) {
                // Group by subject
                const subjTrends: Record<string, { termId: string; pct: number }[]> = {};
                
                for (const m of allMarks as any[]) {
                    const examData = m.exams as any;
                    const subjName = examData?.subjects?.name;
                    const markTermId = examData?.term_id;
                    if (subjName && markTermId && markTermId !== termId) { // Skip current term marks (already in subjectMarks)
                        if (!subjTrends[subjName]) subjTrends[subjName] = [];
                        subjTrends[subjName].push({ termId: markTermId, pct: Number(m.percentage) });
                    }
                }
                
                // Convert to trend data
                for (const [subjName, scores] of Object.entries(subjTrends)) {
                    // Take last 4 scores
                    const recentScores = scores.slice(-4).map((s, idx) => ({
                        term: `T${idx + 1}`,
                        percentage: s.pct
                    }));
                    
                    if (recentScores.length > 0) {
                        subjectTrendData.push({
                            subjectName: subjName,
                            scores: recentScores
                        });
                    }
                }
            }
        } catch (err) {
            console.error('Error fetching trend data:', err);
        }

        // 12. Structure data for PDF Generator
        const reportData: ReportCardData = {
            schoolName,
            schoolLogoUrl,
            schoolAddress,
            examTitle: termTitle,
            academicYear,
            studentName: `${student.users?.first_name} ${student.users?.last_name}`,
            enrollmentNumber: student.admission_number || '',
            className: student.grade_streams?.full_name || 'N/A',
            gradingSystemType,
            subjectMarks,
            overallPercentage: displayPercentage,
            overallGrade: gradingScales.length > 0 ? getGradeFromScales(displayPercentage, gradingScales) : studentPerf.grade,
            totalPoints: studentPerf.totalPoints,
            overallPointsGrade: studentPerf.overallGrade,
            classRank,
            totalStudents,
            classTeacherComment: classTeacherComment || undefined,
            principalComment: principalComment || undefined,
            gradeBoundaries,
            resultUrl: `${baseUrl}/student/${studentId}`,
            totalScore: computedTotalScore,
            totalPossible: computedTotalPossible,
            subjectTrendData: subjectTrendData.length > 0 ? subjectTrendData : undefined,
        };

        // 12. Generate PDF Buffer
        const pdfBuffer = await generateStudentReportCardPDF(reportData);

        return new NextResponse(new Uint8Array(pdfBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${student.users?.first_name}_${student.users?.last_name}_${termTitle}.pdf"`,
            },
        });

    } catch (error: any) {
        console.error('PDF Generation Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to generate PDF' }, { status: 500 });
    }
}
