"use client";

import React, { useState, useEffect } from 'react';
import { PerformanceTrendChart } from '@/components/charts/PerformanceTrend';
import { GradeDistributionChart } from '@/components/charts/GradeDistribution';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

interface SubjectStat {
    name: string;
    mean: number;
    median: number;
    highest: number;
    lowest: number;
    passRate: number;
    studentCount: number;
}

interface TrendData {
    examName: string;
    percentage: number;
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

const GRADE_ORDER = ['A+', 'A', 'B', 'C', 'D', 'F'];

export default function AnalyticsPage() {
    const supabase = createSupabaseBrowserClient();

    const [gradeStreams, setGradeStreams] = useState<GradeStreamOption[]>([]);
    const [selectedStreamId, setSelectedStreamId] = useState('all');
    const [loading, setLoading] = useState(true);

    const [trendData, setTrendData] = useState<TrendData[]>([]);
    const [gradeData, setGradeData] = useState<GradeData[]>([]);
    const [subjectStats, setSubjectStats] = useState<SubjectStat[]>([]);

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
            // so the filter works at the database level
            const selectFields = selectedStreamId !== 'all'
                ? `id, percentage, grade_symbol, student_id,
                   exams ( id, name, exam_date, subject_id, subjects(name) ),
                   students!inner ( current_grade_stream_id )`
                : `id, percentage, grade_symbol, student_id,
                   exams ( id, name, exam_date, subject_id, subjects(name) ),
                   students ( current_grade_stream_id )`;

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
                setGradeData([]);
                setSubjectStats([]);
                setLoading(false);
                return;
            }

            // Filter out nulls from inner joins (Supabase returns null for unmatched foreign keys when filtering)
            const validMarks = marks.filter(m => m.students && m.exams && (m.exams as any).subjects);

            /* --- 1. Grade Distribution --- */
            const gradeCounts: Record<string, number> = { 'A+': 0, 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'F': 0 };
            validMarks.forEach(m => {
                const g = m.grade_symbol || 'F';
                if (gradeCounts[g] !== undefined) {
                    gradeCounts[g]++;
                } else {
                    gradeCounts[g] = 1; // Fallback for unexpected grades
                }
            });
            const dbGrades = Object.entries(gradeCounts).map(([grade, count]) => ({ grade, count }));
            // Sort by specific grade order
            dbGrades.sort((a, b) => GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade));
            setGradeData(dbGrades);

            /* --- 2. Performance Trend (by Exam Date) --- */
            const examAgg: Record<string, { sum: number, count: number, date: string }> = {};
            validMarks.forEach(m => {
                const exam = m.exams as any;
                const eName = exam.name || 'Unknown Exam';
                const eDate = exam.exam_date || new Date().toISOString();
                if (!examAgg[eName]) examAgg[eName] = { sum: 0, count: 0, date: eDate };
                examAgg[eName].sum += Number(m.percentage);
                examAgg[eName].count += 1;
            });

            const dbTrend = Object.entries(examAgg)
                .map(([examName, stats]) => ({
                    examName,
                    percentage: Number((stats.sum / stats.count).toFixed(1)),
                    date: new Date(stats.date).getTime()
                }))
                .sort((a, b) => a.date - b.date); // Sort chronologically

            setTrendData(dbTrend);

            /* --- 3. Subject Stats --- */
            const subjAgg: Record<string, number[]> = {};
            validMarks.forEach(m => {
                const exam = m.exams as any;
                const sName = exam.subjects?.name || 'Unknown Subject';
                if (!subjAgg[sName]) subjAgg[sName] = [];
                subjAgg[sName].push(Number(m.percentage));
            });

            const dbSubjStats: SubjectStat[] = Object.entries(subjAgg).map(([name, scores]) => {
                scores.sort((a, b) => a - b);
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

                return {
                    name,
                    mean: Number(mean.toFixed(1)),
                    median: Number(median.toFixed(1)),
                    highest: Number(highest.toFixed(1)),
                    lowest: Number(lowest.toFixed(1)),
                    passRate: Number(passRate.toFixed(1)),
                    studentCount: count
                };
            }).sort((a, b) => b.mean - a.mean); // Sort by highest mean

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
            ) : validDataExists(trendData) || validDataExists(gradeData) ? (
                <>
                    {/* Charts Grid */}
                    <div
                        className="grid grid-cols-1 lg:grid-cols-2"
                        style={{ gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}
                    >
                        <PerformanceTrendChart data={trendData.length > 0 ? trendData : [{ examName: 'No Exams Yet', percentage: 0 }]} classAverage={trendData.length > 0 ? Number((trendData.reduce((s, t) => s + t.percentage, 0) / trendData.length).toFixed(1)) : 0} />
                        <GradeDistributionChart data={gradeData.length > 0 ? gradeData : [{ grade: 'N/A', count: 0 }]} />
                    </div>

                    {/* Subject Performance Table */}
                    {subjectStats.length > 0 && (
                        <div className="card">
                            <h3 style={{ fontSize: 16, marginBottom: 'var(--space-4)' }} className="font-bold font-[family-name:var(--font-display)]">Subject Performance Summary</h3>
                            <div className="overflow-x-auto">
                                <table className="data-table w-full min-w-[600px]">
                                    <thead>
                                        <tr>
                                            <th>Subject</th><th>Mean</th><th>Median</th><th>Highest</th><th>Lowest</th><th>Pass Rate</th><th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {subjectStats.map((s, i) => (
                                            <tr key={i}>
                                                <td style={{ fontWeight: 500 }}>{s.name}</td>
                                                <td>{s.mean}%</td>
                                                <td>{s.median}%</td>
                                                <td style={{ color: 'var(--color-success)' }}>{s.highest}%</td>
                                                <td style={{ color: 'var(--color-danger)' }}>{s.lowest}%</td>
                                                <td>{s.passRate}%</td>
                                                <td>
                                                    <span className={`badge ${s.passRate >= 85 ? 'badge-success' : s.passRate >= 70 ? 'badge-warning' : 'badge-danger'}`}>
                                                        {s.passRate >= 85 ? 'Strong' : s.passRate >= 70 ? 'Average' : 'At Risk'}
                                                    </span>
                                                </td>
                                            </tr>
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

function validDataExists(arr: any[]) {
    return arr && arr.length > 0;
}
