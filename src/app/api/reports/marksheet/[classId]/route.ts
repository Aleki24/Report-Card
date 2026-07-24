import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import {
    aggregateStudentPerformance,
    calculateClassRanks,
    calculatePercentage,
    getGradeFromScales,
    getGradeFromPercentage,
    getOverallGradeFromMeanPoints,
    isKCSEGradeLevel,
} from '@/lib/analytics';
import type { ExamMarkWithDetails } from '@/lib/analytics';
import type { GradingScale } from '@/types';

export const runtime = 'nodejs';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ classId: string }> }
) {
    try {
        const classId = (await params).classId;
        const { searchParams } = new URL(request.url);
        const termId = searchParams.get('termId');
        const yearId = searchParams.get('yearId');

        if (!termId) {
            return NextResponse.json({ error: 'termId is required for marksheet reports' }, { status: 400 });
        }

        const supabase = createSupabaseAdmin();

        // Optional CBC pathway filters — restrict the sheet (and therefore
        // its positions) to one combination or pathway group
        const combinationId = searchParams.get('combinationId');
        const pathwayFilter = searchParams.get('pathway');

        // 1. Fetch Students in the grade stream (classId = grade_stream_id)
        let studentsQuery = supabase
            .from('students')
            .select('id, admission_number, academic_level_id, current_grade_stream_id, pathway, subject_combination_id, users(first_name, last_name, school_id), grade_streams(full_name, grade_id)')
            .eq('current_grade_stream_id', classId);
        if (combinationId) studentsQuery = studentsQuery.eq('subject_combination_id', combinationId);
        if (pathwayFilter) studentsQuery = studentsQuery.eq('pathway', pathwayFilter);

        const { data: students, error: studentsErr } = await studentsQuery;

        if (studentsErr || !students || students.length === 0) {
            return NextResponse.json({ error: 'No students found in this class' }, { status: 404 });
        }

        // 2. Fetch school info
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
            .select('school_id')
            .eq('id', userId)
            .maybeSingle();

        const userSchoolId = userProfile?.school_id;
        if (!userSchoolId || (targetSchoolId && targetSchoolId !== userSchoolId)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (targetSchoolId) {
            const { data: schoolData } = await supabase.from('schools').select('name, logo_url, address').eq('id', targetSchoolId).maybeSingle();
            if (schoolData) {
                schoolName = schoolData.name;
                schoolLogoUrl = schoolData.logo_url || undefined;
                schoolAddress = schoolData.address || undefined;
            }
        }

        // 3. Grading info
        let gradingSystemType: 'KCSE' | 'CBC' = 'KCSE';
        let gradingScales: GradingScale[] = [];

        // Determine grading system by grade code - G7-8, G11-12, F3-4 use KCSE style (points-based)
        // G1-G6, G9-G10 use CBC style (rubric-based)
        const firstAcademicLevelId = students[0].academic_level_id;
        const streamName = (students[0] as any)?.grade_streams?.full_name || '';
        const gradeId = (students[0] as any)?.grade_streams?.grade_id;
        
        // Fetch grade code from grades table
        let gradeLevelCode = '';
        if (gradeId) {
            const { data: gradeData } = await supabase.from('grades').select('code').eq('id', gradeId).maybeSingle();
            if (gradeData) gradeLevelCode = gradeData.code || '';
        }
        
        // Check if grade code indicates KCSE-style grading (G7-8, G11-12, F3-4)
        const isKCSEGrade = isKCSEGradeLevel(gradeLevelCode, streamName);

        if (firstAcademicLevelId) {
            const { data: academicLevel } = await supabase.from('academic_levels').select('code').eq('id', firstAcademicLevelId).maybeSingle();
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
                .eq('academic_level_id', firstAcademicLevelId)
                .neq('system_kind', 'OVERALL');

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
                const { data: scales } = await supabase.from('grading_scales').select('*').eq('grading_system_id', gradingSystemId).order('order_index', { ascending: true });
                if (scales) {
                    gradingScales = (scales as any[]).map(s => ({
                        ...s,
                        min_percentage: Number(s.min_percentage),
                        max_percentage: Number(s.max_percentage),
                        points: s.points ? Number(s.points) : undefined,
                        order_index: Number(s.order_index)
                    })) as GradingScale[];
                }
            }
        }

        // A school-configured Overall Grading System (opt-in) decides the
        // overall grade from total points (8-4-4). Unset → unchanged behaviour.
        let overallGradingScales: GradingScale[] | undefined;
        let overallGradingKind: 'POINTS' | 'PERCENTAGE' = 'POINTS';
        if (targetSchoolId) {
            const { data: schoolRow } = await supabase.from('schools').select('overall_grading_system_id').eq('id', targetSchoolId).maybeSingle();
            if (schoolRow?.overall_grading_system_id) {
                const [{ data: overallSystem }, { data: overallScales }] = await Promise.all([
                    supabase.from('grading_systems').select('system_kind').eq('id', schoolRow.overall_grading_system_id).maybeSingle(),
                    supabase.from('grading_scales').select('*').eq('grading_system_id', schoolRow.overall_grading_system_id).order('order_index', { ascending: true }),
                ]);
                if (overallScales && overallScales.length > 0) {
                    overallGradingScales = (overallScales as any[]).map(s => ({
                        ...s,
                        min_percentage: Number(s.min_percentage),
                        max_percentage: Number(s.max_percentage),
                        points: s.points != null ? Number(s.points) : undefined,
                        order_index: Number(s.order_index),
                    })) as GradingScale[];
                    overallGradingKind = overallSystem?.system_kind === 'SUBJECT' ? 'PERCENTAGE' : 'POINTS';
                }
            }
        }

        // 4. Term and Year Titles
        let termTitle = 'Term Report';
        let academicYearName = 'Academic Year';
        if (termId) {
            const { data: termData } = await supabase.from('terms').select('name').eq('id', termId).maybeSingle();
            if (termData) termTitle = termData.name;
        }
        const customTitle = searchParams.get('customTitle');
        if (customTitle) termTitle = customTitle;

        if (yearId) {
            const { data: yearData } = await supabase.from('academic_years').select('name').eq('id', yearId).maybeSingle();
            if (yearData) academicYearName = yearData.name;
        }

        // 5. Fetch all marks
        const studentIds = students.map(s => s.id);

        let marksQuery = supabase
            .from('exam_marks')
            .select(`
                id, student_id, percentage, raw_score, grade_symbol, remarks,
                exams!inner ( id, name, max_score, term_id, academic_year_id,
                    subjects ( id, code, name, category, display_order )
                )
            `)
            .in('student_id', studentIds)
            .eq('exams.term_id', termId);

        if (yearId) marksQuery = marksQuery.eq('exams.academic_year_id', yearId);

        const { data: allMarks, error: marksErr } = await marksQuery;
        if (marksErr) throw marksErr;

        if (!allMarks || allMarks.length === 0) {
            return NextResponse.json({ error: 'No marks found for this class and term' }, { status: 404 });
        }

        // Collect all distinct subject names and codes for the table columns
        const subjectsMap = new Map<string, { code: string; name: string }>();
        const subjectNamesMap: Record<string, string> = {};
        const subjectCategoriesMap: Record<string, string> = {};
        allMarks.forEach((m: any) => {
            const sname = m.exams.subjects?.name;
            const scode = m.exams.subjects?.code;
            const sid = m.exams.subjects?.id;
            const scategory = m.exams.subjects?.category;
            if (sname) {
                subjectsMap.set(scode || sname, { code: scode || sname, name: sname });
                if (sid) subjectNamesMap[sid] = sname;
                if (sid && scategory) subjectCategoriesMap[sid] = scategory;
            }
        });
        const subjectsArray = Array.from(subjectsMap.values()).sort((a, b) => a.code.localeCompare(b.code));

        // 6. Group marks by student and calculate ranks
        const marksByStudent: Record<string, any[]> = {};
        for (const m of allMarks) {
            if (!marksByStudent[m.student_id]) marksByStudent[m.student_id] = [];
            marksByStudent[m.student_id].push(m);
        }

        const aggregates = Object.entries(marksByStudent).map(([sid, marks]) => {
            const mapped: ExamMarkWithDetails[] = marks.map((m: any) => ({
                id: m.id,
                student_id: sid,
                exam_id: m.exams.id || '',
                subject_id: m.exams.subjects?.id || '',
                raw_score: Number(m.raw_score),
                percentage: Number(m.percentage || 0),
                max_score: Number(m.exams.max_score),
                grade_symbol: m.grade_symbol,
                remarks: m.remarks,
            }));
            const perf = aggregateStudentPerformance(mapped, gradingScales, gradingSystemType, subjectNamesMap, subjectCategoriesMap);
            
            // Calculate average percentage consistently: sum of percentages / number of subjects
            const subjectPercentages = mapped.map(m => calculatePercentage(m.raw_score, m.max_score));
            const avgPercentage = subjectPercentages.length > 0
                ? subjectPercentages.reduce((a, b) => a + b, 0) / subjectPercentages.length
                : 0;
            
            const rankingValue = (gradingSystemType === 'KCSE' && perf.totalPoints !== undefined) 
                ? perf.totalPoints 
                : avgPercentage;
            return { studentId: sid, percentage: avgPercentage, totalPoints: perf.totalPoints, rankingValue };
        });

        const rankingBy = gradingSystemType === 'KCSE' ? 'points' : 'percentage';
        const ranks = calculateClassRanks(aggregates, rankingBy);
        const rankedStudentCount = aggregates.length;

        // 7. Aggregate data for the specific report format
        let totalClassPercentage = 0;

        // Calculate subject-wise statistics (mean, rank)
        const subjectStats: Record<string, { mean: number; highest: number; lowest: number; studentCount: number }> = {};
        
        // Initialize subject stats
        subjectsArray.forEach(sub => {
            subjectStats[sub.code] = { mean: 0, highest: 0, lowest: 100, studentCount: 0 };
        });

        // Calculate mean per subject across all students
        const subjectScores: Record<string, number[]> = {};
        subjectsArray.forEach(sub => subjectScores[sub.code] = []);

        for (const student of students) {
            const studentMarks = marksByStudent[student.id] || [];
            studentMarks.forEach((m: any) => {
                const scode = m.exams.subjects?.code || m.exams.subjects?.name;
                if (scode && m.percentage !== null && m.percentage !== undefined) {
                    const pct = Number(m.percentage);
                    subjectScores[scode].push(pct);
                }
            });
        }

        // Calculate stats for each subject
        for (const sub of subjectsArray) {
            const scores = subjectScores[sub.code];
            if (scores.length > 0) {
                const sum = scores.reduce((a, b) => a + b, 0);
                subjectStats[sub.code] = {
                    mean: Math.round(sum / scores.length),
                    highest: Math.round(Math.max(...scores)),
                    lowest: Math.round(Math.min(...scores)),
                    studentCount: scores.length
                };
            }
        }

        // Calculate subject ranks (rank subjects by mean score)
        const subjectRankings = subjectsArray
            .map(sub => ({ code: sub.code, mean: subjectStats[sub.code].mean }))
            .sort((a, b) => b.mean - a.mean)
            .map((sub, idx) => ({ ...sub, rank: idx + 1 }));

        const studentsData = students.map(student => {
            const studentMarks = marksByStudent[student.id] || [];
            
            const mapped: ExamMarkWithDetails[] = studentMarks.map((m: any) => ({
                id: m.id,
                student_id: student.id,
                exam_id: m.exams.id || '',
                subject_id: m.exams.subjects?.id || '',
                raw_score: Number(m.raw_score),
                percentage: Number(m.percentage || 0),
                max_score: Number(m.exams.max_score),
                grade_symbol: m.grade_symbol,
            }));

            const studentPerf = aggregateStudentPerformance(mapped, gradingScales, gradingSystemType, subjectNamesMap, subjectCategoriesMap, overallGradingScales, overallGradingKind);
            const isKCSE = gradingSystemType === 'KCSE';
            
            const firstName = (student.users as any)?.first_name || 'Student';
            const lastName = (student.users as any)?.last_name || '';

            const marksRecord: Record<string, number | null> = {};
            // Initialize with null using subject codes as keys
            subjectsArray.forEach(sub => marksRecord[sub.code] = null);
            
            studentMarks.forEach((m: any) => {
                const scode = m.exams.subjects?.code || m.exams.subjects?.name;
                if (scode) {
                    marksRecord[scode] = Number(m.percentage); // Taking percentage for the mark sheet
                }
            });

            // Calculate average percentage: sum of percentages / number of subjects
            const subjectPercentages = Object.values(marksRecord).filter(p => p !== null) as number[];
            const totalPercentage = subjectPercentages.length > 0 
                ? subjectPercentages.reduce((a, b) => a + b, 0) 
                : 0;
            const averagePercentage = subjectPercentages.length > 0 
                ? totalPercentage / subjectPercentages.length 
                : 0;
            
            const displayPercentage = isKCSE && studentPerf.used844Selection ? studentPerf.percentage : averagePercentage;
            const overallGradeSymbol = isKCSE 
                ? studentPerf.overallGrade 
                : (gradingScales.length > 0 
                    ? getGradeFromScales(displayPercentage, gradingScales) 
                    : getGradeFromPercentage(Math.round(displayPercentage)));

            if (studentMarks.length > 0) {
                totalClassPercentage += displayPercentage;
            }

            // Check if student has any marks entered (at least one non-null mark)
            const hasAnyMarks = Object.values(marksRecord).some(mark => mark !== null);
            
            return {
                studentName: `${firstName} ${lastName}`,
                admissionNumber: student.admission_number || '',
                marks: marksRecord,
                overallPercentage: displayPercentage,
                overallGrade: overallGradeSymbol,
                totalPoints: studentPerf.totalPoints || 0,
                // Per-subject mean points (KCSE) — the class mean grade must be
                // derived from these, not from total points.
                meanPoints: studentPerf.markCount > 0 ? (studentPerf.totalPoints || 0) / studentPerf.markCount : 0,
                overallPointsGrade: studentPerf.overallGrade,
                classRank: ranks.get(student.id) || 0,
                hasAnyMarks,
            };
        }).filter(s => s.hasAnyMarks); // only students with at least one mark entered

        // Sort students by rank
        studentsData.sort((a, b) => a.classRank - b.classRank);

        // Grade distribution — computed ONLY from students who have marks
        const gradeDistribution: Record<string, number> = {};
        const studentsWithMarks = studentsData.filter(s => s.overallPercentage > 0);
        for (const s of studentsWithMarks) {
            if (s.overallGrade) {
                gradeDistribution[s.overallGrade] = (gradeDistribution[s.overallGrade] || 0) + 1;
            }
        }

        // Class mean grade (KCSE): average the students' per-subject mean points
        // (a 0-12 scale), then map with the points-band function. Previously this
        // summed total points (0-84) and fed that into a 0-100 percentage-band
        // function, so a straight-A class could read as 'B'.
        const meanPointsSum = studentsWithMarks.reduce((sum, s) => sum + (Number(s.meanPoints) || 0), 0);
        const classMeanPoints = studentsWithMarks.length > 0 ? meanPointsSum / studentsWithMarks.length : 0;

        const meanGrade = gradingSystemType === 'KCSE' ? getOverallGradeFromMeanPoints(classMeanPoints) : '';
        
        // Label a filtered sheet with its combination code / pathway
        let classNameLabel = (students[0].grade_streams as any)?.full_name || 'Class';
        if (combinationId) {
            const { data: combo } = await supabase
                .from('subject_combinations')
                .select('code')
                .eq('id', combinationId)
                .eq('school_id', targetSchoolId || userSchoolId)
                .maybeSingle();
            if (combo?.code) classNameLabel = `${classNameLabel} — ${combo.code}`;
        } else if (pathwayFilter) {
            classNameLabel = `${classNameLabel} — ${pathwayFilter.replace(/_/g, ' ')}`;
        }

        const markSheetData = {
            schoolName,
            schoolLogoUrl,
            schoolAddress,
            examTitle: termTitle,
            academicYear: academicYearName,
            className: classNameLabel,
            gradingSystemType,
            subjects: subjectsArray,
            students: studentsData,
            gradeDistribution,
            meanGrade,
            meanPoints: Math.round(classMeanPoints * 100) / 100,
            subjectStats,
            subjectRankings,
        };

        return NextResponse.json(markSheetData, { status: 200 });

    } catch (error: any) {
        console.error('Marksheet Data Generation Error:', error);
        return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
    }
}
