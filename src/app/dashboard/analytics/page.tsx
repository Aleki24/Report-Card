"use client";

import React, { useState, useEffect } from 'react';
import { PerformanceTrendChart } from '@/components/charts/PerformanceTrend';
import { GradeDistributionChart } from '@/components/charts/GradeDistribution';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

interface StudentMark {
    studentName: string;
    admissionNumber: string;
    percentage: number;
    gradeSymbol: string;
}

interface SubjectStat {
    name: string;
    mean: number;
    median: number;
    highest: number;
    lowest: number;
    passRate: number;
    studentCount: number;
    students: StudentMark[];
}

interface GradeData {
    grade: string;
    count: number;
}

interface GradeStreamOption {
    id: string;
    name: string;
    full_name: string;
}

export default function AnalyticsPage() {
    const supabase = createSupabaseBrowserClient();

    const [gradeStreams, setGradeStreams] = useState<GradeStreamOption[]>([]);
    const [selectedStreamId, setSelectedStreamId] = useState('all');
    const [loading, setLoading] = useState(true);

    // Multi-subject trend data: each row = { examName, Math: 75, English: 60, ... }
    const [trendData, setTrendData] = useState<Record<string, any>[]>([]);
    const [trendSubjects, setTrendSubjects] = useState<string[]>([]);
    const [classAverage, setClassAverage] = useState(0);

    const [gradeData, setGradeData] = useState<GradeData[]>([]);
    const [subjectStats, setSubjectStats] = useState<SubjectStat[]>([]);
    const [expandedSubject, setExpandedSubject] = useState<string | null>(null);

    // 1. Fetch available classes (grade streams) on mount
    useEffect(() => {
        const fetchClasses = async () => {
            const { data } = await supabase.from('grade_streams').select('id, name, full_name').order('full_name');
            if (data) setGradeStreams(data);
        };
        fetchClasses();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 2. Fetch and aggregate data whenever the selected class changes
    useEffect(() => {
        const fetchAnalytics = async () => {
            setLoading(true);

            // Build query for marks — use !inner join when filtering by stream
            const selectFields = selectedStreamId !== 'all'
                ? `id, percentage, grade_symbol, student_id,
                   exams ( id, name, exam_date, subject_id, subjects(name) ),
                   students!inner ( current_grade_stream_id, admission_number, users(first_name, last_name) )`
                : `id, percentage, grade_symbol, student_id,
                   exams ( id, name, exam_date, subject_id, subjects(name) ),
                   students ( current_grade_stream_id, admission_number, users(first_name, last_name) )`;

            let query = supabase
                .from('exam_marks')
                .select(selectFields);

            if (selectedStreamId !== 'all') {
                query = query.eq('students.current_grade_stream_id', selectedStreamId);
            }

            const { data: marks, error } = await query;

            if (error) {
                console.error("Analytics fetch error:", error.message);
            }
            if (!marks || marks.length === 0) {
                setTrendData([]);
                setTrendSubjects([]);
                setClassAverage(0);
                setGradeData([]);
                setSubjectStats([]);
                setLoading(false);
                return;
            }

            // Filter out nulls from inner joins
            const validMarks = marks.filter(m => m.students && m.exams && (m.exams as any).subjects);

            /* ═══════ 1. Grade Distribution (dynamic) ═══════ */
            const gradeCounts: Record<string, number> = {};
            validMarks.forEach(m => {
                const g = m.grade_symbol || 'F';
                gradeCounts[g] = (gradeCounts[g] || 0) + 1;
            });
            // Sort grades: letters first by quality then +/- variants
            const gradeOrder = (g: string) => {
                const base: Record<string, number> = { 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'F': 6 };
                const letter = g.charAt(0).toUpperCase();
                const modifier = g.length > 1 ? g.charAt(1) : '';
                const baseVal = base[letter] || 7;
                const modVal = modifier === '+' ? 0 : modifier === '-' ? 2 : 1;
                return baseVal * 10 + modVal;
            };
            const dbGrades = Object.entries(gradeCounts)
                .map(([grade, count]) => ({ grade, count }))
                .sort((a, b) => gradeOrder(a.grade) - gradeOrder(b.grade));
            setGradeData(dbGrades);

            /* ═══════ 2. Performance Trend (per subject) ═══════ */
            // Collect: examName → subjectName → { sum, count, date }
            const examSubjAgg: Record<string, Record<string, { sum: number; count: number }>> = {};
            const examDates: Record<string, string> = {};
            const allSubjects = new Set<string>();

            validMarks.forEach(m => {
                const exam = m.exams as any;
                const eName = exam.name || 'Unknown Exam';
                const sName = exam.subjects?.name || 'Unknown';
                const eDate = exam.exam_date || new Date().toISOString();
                allSubjects.add(sName);
                if (!examDates[eName]) examDates[eName] = eDate;
                if (!examSubjAgg[eName]) examSubjAgg[eName] = {};
                if (!examSubjAgg[eName][sName]) examSubjAgg[eName][sName] = { sum: 0, count: 0 };
                examSubjAgg[eName][sName].sum += Number(m.percentage);
                examSubjAgg[eName][sName].count += 1;
            });

            const subjects = Array.from(allSubjects).sort();
            setTrendSubjects(subjects);

            const trendRows = Object.entries(examSubjAgg)
                .map(([examName, subjMap]) => {
                    const row: Record<string, any> = { examName, _date: new Date(examDates[examName]).getTime() };
                    for (const subj of subjects) {
                        if (subjMap[subj]) {
                            row[subj] = Number((subjMap[subj].sum / subjMap[subj].count).toFixed(1));
                        }
                        // leave undefined if no data — connectNulls handles it
                    }
                    return row;
                })
                .sort((a, b) => a._date - b._date);

            setTrendData(trendRows);

            // Overall class average
            const allPcts = validMarks.map(m => Number(m.percentage));
            const avg = allPcts.length > 0 ? allPcts.reduce((s, v) => s + v, 0) / allPcts.length : 0;
            setClassAverage(Number(avg.toFixed(1)));

            /* ═══════ 3. Subject Stats (with student names) ═══════ */
            const subjAgg: Record<string, StudentMark[]> = {};
            validMarks.forEach(m => {
                const exam = m.exams as any;
                const stu = m.students as any;
                const sName = exam.subjects?.name || 'Unknown Subject';
                if (!subjAgg[sName]) subjAgg[sName] = [];
                const firstName = stu?.users?.first_name || '';
                const lastName = stu?.users?.last_name || '';
                subjAgg[sName].push({
                    studentName: `${firstName} ${lastName}`.trim() || 'Unknown',
                    admissionNumber: stu?.admission_number || '',
                    percentage: Number(m.percentage),
                    gradeSymbol: m.grade_symbol || '-',
                });
            });

            const dbSubjStats: SubjectStat[] = Object.entries(subjAgg).map(([name, students]) => {
                const scores = students.map(s => s.percentage).sort((a, b) => a - b);
                const count = scores.length;
                const sum = scores.reduce((a, b) => a + b, 0);
                const mean = sum / count;
                const median = count % 2 === 0
                    ? (scores[count / 2 - 1] + scores[count / 2]) / 2
                    : scores[Math.floor(count / 2)];
                const highest = scores[count - 1];
                const lowest = scores[0];
                const passes = scores.filter(s => s >= 50).length;
                const passRate = (passes / count) * 100;

                // Sort students by percentage descending
                const sortedStudents = [...students].sort((a, b) => b.percentage - a.percentage);

                return {
                    name,
                    mean: Number(mean.toFixed(1)),
                    median: Number(median.toFixed(1)),
                    highest: Number(highest.toFixed(1)),
                    lowest: Number(lowest.toFixed(1)),
                    passRate: Number(passRate.toFixed(1)),
                    studentCount: count,
                    students: sortedStudents,
                };
            }).sort((a, b) => b.mean - a.mean);

            setSubjectStats(dbSubjStats);
            setLoading(false);
        };

        fetchAnalytics();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedStreamId]);

    return (
        <div className="w-full max-w-7xl mx-auto pb-10">
            {/* Header */}
            <div
                className="flex flex-col md:flex-row md:justify-between md:items-start gap-4"
                style={{ marginBottom: 'var(--space-8)' }}
            >
                <div>
                    <h1 style={{ fontSize: 28, marginBottom: 'var(--space-2)' }} className="font-bold font-[family-name:var(--font-display)]">Analytics</h1>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
                        Subject performance, grade distribution, and trend analysis
                    </p>
                </div>
                <select
                    className="input-field w-full md:w-[240px]"
                    value={selectedStreamId}
                    onChange={(e) => setSelectedStreamId(e.target.value)}
                >
                    <option value="all">All Classes</option>
                    {gradeStreams.map(gs => (
                        <option key={gs.id} value={gs.id}>{gs.full_name}</option>
                    ))}
                </select>
            </div>

            {loading ? (
                <div className="p-12 text-center text-[var(--color-text-muted)]">
                    Analyzing data...
                </div>
            ) : (trendData.length > 0 || gradeData.length > 0) ? (
                <>
                    {/* Charts Grid */}
                    <div
                        className="grid grid-cols-1 lg:grid-cols-2"
                        style={{ gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}
                    >
                        <PerformanceTrendChart
                            data={trendData.length > 0 ? trendData : [{ examName: 'No Exams Yet' }]}
                            subjects={trendSubjects}
                            classAverage={classAverage}
                        />
                        <GradeDistributionChart data={gradeData.length > 0 ? gradeData : [{ grade: 'N/A', count: 0 }]} />
                    </div>

                    {/* Subject Performance Table with expandable student list */}
                    {subjectStats.length > 0 && (
                        <div className="card">
                            <h3 style={{ fontSize: 16, marginBottom: 'var(--space-4)' }} className="font-bold font-[family-name:var(--font-display)]">Subject Performance Summary</h3>
                            <div className="overflow-x-auto">
                                <table className="data-table w-full min-w-[700px]">
                                    <thead>
                                        <tr>
                                            <th></th>
                                            <th>Subject</th><th>Mean</th><th>Median</th><th>Highest</th><th>Lowest</th><th>Pass Rate</th><th>Students</th><th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {subjectStats.map((s, i) => (
                                            <React.Fragment key={i}>
                                                <tr
                                                    style={{ cursor: 'pointer' }}
                                                    onClick={() => setExpandedSubject(expandedSubject === s.name ? null : s.name)}
                                                >
                                                    <td style={{ width: 30, textAlign: 'center' }}>
                                                        {expandedSubject === s.name ? '▼' : '▶'}
                                                    </td>
                                                    <td style={{ fontWeight: 500 }}>{s.name}</td>
                                                    <td>{s.mean}%</td>
                                                    <td>{s.median}%</td>
                                                    <td style={{ color: 'var(--color-success)' }}>{s.highest}%</td>
                                                    <td style={{ color: 'var(--color-danger)' }}>{s.lowest}%</td>
                                                    <td>{s.passRate}%</td>
                                                    <td>{s.studentCount}</td>
                                                    <td>
                                                        <span className={`badge ${s.passRate >= 85 ? 'badge-success' : s.passRate >= 70 ? 'badge-warning' : 'badge-danger'}`}>
                                                            {s.passRate >= 85 ? 'Strong' : s.passRate >= 70 ? 'Average' : 'At Risk'}
                                                        </span>
                                                    </td>
                                                </tr>
                                                {/* Expanded student list */}
                                                {expandedSubject === s.name && (
                                                    <tr>
                                                        <td colSpan={9} style={{ padding: 0 }}>
                                                            <div style={{
                                                                background: 'var(--color-surface-raised)',
                                                                padding: 'var(--space-3) var(--space-4)',
                                                                borderTop: '1px solid var(--color-border)',
                                                                borderBottom: '1px solid var(--color-border)',
                                                                overflowX: 'auto',
                                                            }}>
                                                                <table style={{ minWidth: 500, width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                                                                    <thead>
                                                                        <tr style={{ color: 'var(--color-text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                                            <th style={{ textAlign: 'left', padding: '4px 8px' }}>#</th>
                                                                            <th style={{ textAlign: 'left', padding: '4px 8px' }}>Student</th>
                                                                            <th style={{ textAlign: 'left', padding: '4px 8px' }}>Adm No</th>
                                                                            <th style={{ textAlign: 'center', padding: '4px 8px' }}>Score</th>
                                                                            <th style={{ textAlign: 'center', padding: '4px 8px' }}>Grade</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {s.students.map((st, idx) => (
                                                                            <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                                                                <td style={{ padding: '4px 8px', color: 'var(--color-text-muted)' }}>{idx + 1}</td>
                                                                                <td style={{ padding: '4px 8px', fontWeight: 500 }}>{st.studentName}</td>
                                                                                <td style={{ padding: '4px 8px', color: 'var(--color-text-muted)' }}>{st.admissionNumber}</td>
                                                                                <td style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 600 }}>{st.percentage.toFixed(1)}%</td>
                                                                                <td style={{ padding: '4px 8px', textAlign: 'center' }}>{st.gradeSymbol}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <div className="card p-12 text-center text-[var(--color-text-muted)]">
                    <div className="text-4xl mb-4">📊</div>
                    <p>No mark data available for this selection.</p>
                    <p className="text-sm mt-2">Enter marks for exams to see performance analytics here.</p>
                </div>
            )}
        </div>
    );
}
