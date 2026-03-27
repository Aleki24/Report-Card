"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { PerformanceTrendChart } from '@/components/charts/PerformanceTrend';

interface TermResult {
    term: string;
    termId: string | null;
    yearId: string | null;
    yearName: string;
    subjects: {
        name: string;
        score: number;
        maxScore: number;
        grade: string;
        comment: string;
    }[];
    average: number;
    position: number;
    totalStudents: number;
}

export default function MyResultsPage() {
    const { profile, user, role, loading } = useAuth();
    const supabase = useMemo(() => createSupabaseBrowserClient(), []);

    const [studentId, setStudentId] = useState<string | null>(null);
    const [termResults, setTermResults] = useState<TermResult[]>([]);
    const [stats, setStats] = useState({
        termAverage: 0,
        bestSubject: '-',
        bestScore: 0,
        weakestSubject: '-',
        weakestScore: 0,
        streamPosition: 0,
        totalInStream: 0,
    });
    const [trendData, setTrendData] = useState<{ examName: string; percentage: number }[]>([]);
    const [fetching, setFetching] = useState(true);

    useEffect(() => {
        const fetchResults = async () => {
            if (!user?.id) {
                setFetching(false);
                return;
            }

            // Step 1: Look up the student record from the auth user ID
            const { data: studentRecord } = await supabase
                .from('students')
                .select('id, current_grade_stream_id')
                .eq('id', user.id)
                .limit(1)
                .single();

            if (!studentRecord) {
                setFetching(false);
                return;
            }

            setStudentId(studentRecord.id);
            const gradeStreamId = studentRecord.current_grade_stream_id;

            // Step 2: Fetch all marks for this student
            const { data, error } = await supabase
                .from('exam_marks')
                .select(`
                    id,
                    percentage,
                    grade_symbol,
                    raw_score,
                    remarks,
                    student_id,
                    exams (
                        id,
                        name,
                        max_score,
                        term_id,
                        academic_year_id,
                        terms ( id, name ),
                        academic_years ( id, name ),
                        subjects ( name )
                    )
                `)
                .eq('student_id', studentRecord.id);

            if (error) {
                console.error("Error fetching results:", error.message);
                setFetching(false);
                return;
            }

            if (!data || data.length === 0) {
                setFetching(false);
                return;
            }

            // Step 3: Group marks by term
            const groups: Record<string, {
                term: string;
                termId: string | null;
                yearId: string | null;
                yearName: string;
                subjects: { name: string; score: number; maxScore: number; grade: string; comment: string }[];
                average: number;
                position: number;
                totalStudents: number;
                examIds: string[];
            }> = {};
            let totalPct = 0;
            let count = 0;
            let bestSub = '';
            let bestScore = -1;
            let worstSub = '';
            let worstScore = 101;

            data.forEach((mark: any) => {
                const ex = mark.exams;
                if (!ex) return;

                const termName = ex.terms?.name || 'Unknown Term';
                const yearName = ex.academic_years?.name || '';
                const termKey = `${termName} ${yearName}`.trim();
                const termId = ex.term_id || ex.terms?.id || null;
                const yearId = ex.academic_year_id || ex.academic_years?.id || null;

                if (!groups[termKey]) {
                    groups[termKey] = {
                        term: termKey,
                        termId,
                        yearId,
                        yearName,
                        subjects: [],
                        average: 0,
                        position: 0,
                        totalStudents: 0,
                        examIds: [],
                    };
                }

                if (ex.id && !groups[termKey].examIds.includes(ex.id)) {
                    groups[termKey].examIds.push(ex.id);
                }

                const subjName = ex.subjects?.name || 'Unknown Subject';
                groups[termKey].subjects.push({
                    name: subjName,
                    score: mark.raw_score,
                    maxScore: ex.max_score,
                    grade: mark.grade_symbol,
                    comment: mark.remarks || 'No remarks',
                });

                totalPct += mark.percentage;
                count++;

                if (mark.percentage > bestScore) {
                    bestScore = mark.percentage;
                    bestSub = subjName;
                }
                if (mark.percentage < worstScore) {
                    worstScore = mark.percentage;
                    worstSub = subjName;
                }
            });

            // Step 4: Calculate averages per term
            const resultsArray: TermResult[] = Object.values(groups).map((g) => {
                const sum = g.subjects.reduce(
                    (s, subj) => s + (subj.maxScore > 0 ? (subj.score / subj.maxScore) * 100 : 0),
                    0
                );
                g.average = g.subjects.length > 0 ? Number((sum / g.subjects.length).toFixed(1)) : 0;
                return {
                    term: g.term,
                    termId: g.termId,
                    yearId: g.yearId,
                    yearName: g.yearName,
                    subjects: g.subjects,
                    average: g.average,
                    position: 0,
                    totalStudents: 0,
                };
            });

            // Step 5: Calculate stream position for each term
            if (gradeStreamId) {
                // Get all classmates
                const { data: classmates } = await supabase
                    .from('students')
                    .select('id')
                    .eq('current_grade_stream_id', gradeStreamId);

                if (classmates && classmates.length > 0) {
                    const classmateIds = classmates.map(c => c.id);

                    for (const term of resultsArray) {
                        if (!term.termId) continue;

                        // Get all marks for classmates for this term
                        let rankQuery = supabase
                            .from('exam_marks')
                            .select('student_id, raw_score, percentage, exams!inner(max_score, term_id, academic_year_id)')
                            .in('student_id', classmateIds)
                            .eq('exams.term_id', term.termId);

                        if (term.yearId) {
                            rankQuery = rankQuery.eq('exams.academic_year_id', term.yearId);
                        }

                        const { data: allMarks } = await rankQuery;

                        if (allMarks && allMarks.length > 0) {
                            // Aggregate per student
                            const studentAggs: Record<string, { totalScore: number; totalPossible: number }> = {};
                            for (const m of allMarks as any[]) {
                                const sid = m.student_id;
                                if (!studentAggs[sid]) studentAggs[sid] = { totalScore: 0, totalPossible: 0 };
                                studentAggs[sid].totalScore += Number(m.raw_score);
                                studentAggs[sid].totalPossible += Number(m.exams.max_score);
                            }

                            // Sort by percentage descending
                            const sorted = Object.entries(studentAggs)
                                .filter(([, v]) => v.totalPossible > 0)
                                .map(([sid, v]) => ({
                                    sid,
                                    pct: (v.totalScore / v.totalPossible) * 100,
                                }))
                                .sort((a, b) => b.pct - a.pct);

                            term.totalStudents = sorted.length;

                            // Find this student's rank (handle ties)
                            let rank = 1;
                            for (let i = 0; i < sorted.length; i++) {
                                if (i > 0 && sorted[i].pct < sorted[i - 1].pct) {
                                    rank = i + 1;
                                }
                                if (sorted[i].sid === studentRecord.id) {
                                    term.position = rank;
                                    break;
                                }
                            }
                        }
                    }
                }
            }

            setTermResults(resultsArray);

            // Step 6: Build performance trend data
            const trend = resultsArray.map(t => ({
                examName: t.term,
                percentage: t.average,
            }));
            setTrendData(trend);

            // Step 7: Set summary stats (use latest term for position)
            const latestTerm = resultsArray.length > 0 ? resultsArray[resultsArray.length - 1] : null;
            if (count > 0) {
                setStats({
                    termAverage: Number((totalPct / count).toFixed(1)),
                    bestSubject: bestSub,
                    bestScore: Number(bestScore.toFixed(1)),
                    weakestSubject: worstSub,
                    weakestScore: Number(worstScore.toFixed(1)),
                    streamPosition: latestTerm?.position || 0,
                    totalInStream: latestTerm?.totalStudents || 0,
                });
            }
            setFetching(false);
        };

        if (role === 'STUDENT' && user) {
            fetchResults();
        } else {
            setFetching(false);
        }
    }, [user, role, supabase]);

    if (loading || fetching) {
        return (
            <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--color-text-muted)' }}>
                <div style={{ fontSize: 32, marginBottom: 'var(--space-4)' }}>⏳</div>
                <p>Loading your results...</p>
            </div>
        );
    }

    // Access guard: only students should see this page
    if (role && role !== 'STUDENT' && role !== 'ADMIN') {
        return (
            <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--color-text-muted)' }}>
                <img src="https://em-content.zobj.net/source/apple/354/locked_1f512.png" alt="Locked" style={{ width: 48, height: 48, marginBottom: 'var(--space-4)', objectFit: 'contain' }} />
                <h2 style={{ fontSize: 20, marginBottom: 'var(--space-2)' }}>Access Restricted</h2>
                <p style={{ fontSize: 14 }}>This page is only available to students.</p>
            </div>
        );
    }

    const studentName = profile ? `${profile.first_name} ${profile.last_name}` : 'Student';

    const handleDownloadReport = (term: TermResult) => {
        if (!studentId) return;
        const params = new URLSearchParams();
        if (term.termId) params.set('term', term.termId);
        if (term.yearId) params.set('year', term.yearId);
        const qs = params.toString();
        window.open(`/api/reports/student/${studentId}${qs ? `?${qs}` : ''}`, '_blank');
    };

    return (
        <div className="w-full max-w-7xl mx-auto pb-10">
            {/* Page Header */}
            <div style={{ marginBottom: 'var(--space-8)' }}>
                <h1 className="text-2xl md:text-3xl font-bold font-[family-name:var(--font-display)] mb-2">
                    My Results
                </h1>
                <p className="text-sm text-[var(--color-text-muted)]">
                    Welcome, {studentName}. View your exam results and download report cards.
                </p>
            </div>

            {/* Performance Summary Cards */}
            {termResults.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="stat-card">
                        <div className="stat-label">Overall Average</div>
                        <div className="stat-value" style={{ color: stats.termAverage >= 50 ? 'var(--color-success)' : 'var(--color-warning)' }}>
                            {stats.termAverage}%
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">Stream Position</div>
                        <div className="stat-value">
                            {stats.streamPosition > 0
                                ? `${stats.streamPosition} / ${stats.totalInStream}`
                                : '—'}
                        </div>
                        {stats.streamPosition > 0 && (
                            <div className="text-xs text-[var(--color-text-muted)] mt-1">Latest term ranking</div>
                        )}
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">Best Subject</div>
                        <div className="stat-value" style={{ fontSize: '1.25rem' }}>{stats.bestSubject}</div>
                        <div className="text-xs text-[var(--color-success)] mt-1">{stats.bestScore}%</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">Weakest Subject</div>
                        <div className="stat-value" style={{ fontSize: '1.25rem' }}>{stats.weakestSubject}</div>
                        <div className="text-xs text-[var(--color-warning)] mt-1">{stats.weakestScore}%</div>
                    </div>
                </div>
            ) : (
                <div className="card text-center p-8 mb-6">
                    <img src="https://em-content.zobj.net/source/apple/354/open-mailbox-with-lowered-flag_1f4ed.png" alt="Empty" className="mb-4" style={{ width: 48, height: 48, objectFit: 'contain' }} />
                    <h3 className="text-lg font-bold font-[family-name:var(--font-display)] mb-2">No Results Yet</h3>
                    <p className="text-sm text-[var(--color-text-muted)]">
                        You don&apos;t have any published marks at the moment.
                    </p>
                </div>
            )}

            {/* Results by Term */}
            {termResults.map((term, tIdx) => (
                <div key={tIdx} className="card mb-6">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4">
                        <div>
                            <h3 className="text-base font-bold font-[family-name:var(--font-display)]">{term.term}</h3>
                            <p className="text-xs text-[var(--color-text-muted)]">
                                Average: {term.average}%
                                {term.position > 0 && ` · Position: ${term.position}/${term.totalStudents}`}
                            </p>
                        </div>
                        <button
                            className="btn-primary mt-3 sm:mt-0 text-sm"
                            onClick={() => handleDownloadReport(term)}
                        >
                            📥 Download Report
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="data-table sm:whitespace-nowrap w-full">
                            <thead>
                                <tr>
                                    <th>Subject</th>
                                    <th>Score</th>
                                    <th>%</th>
                                    <th>Grade</th>
                                    <th>Comment</th>
                                </tr>
                            </thead>
                            <tbody>
                                {term.subjects.map((s, sIdx) => {
                                    const pct = s.maxScore > 0 ? Math.round((s.score / s.maxScore) * 100) : 0;
                                    const badgeClass = pct >= 80 ? 'badge-success' : pct >= 50 ? 'badge-warning' : 'badge-danger';
                                    return (
                                        <tr key={sIdx}>
                                            <td style={{ fontWeight: 500 }}>{s.name}</td>
                                            <td className="font-mono text-sm">{s.score}/{s.maxScore}</td>
                                            <td>{pct}%</td>
                                            <td><span className={`badge ${badgeClass}`}>{s.grade || '-'}</span></td>
                                            <td className="text-[var(--color-text-muted)] text-sm">{s.comment}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}

            {/* Performance Trend Chart */}
            {trendData.length > 1 && (
                <PerformanceTrendChart
                    data={trendData.map(d => ({ examName: d.examName, 'My Average': d.percentage }))}
                    subjects={['My Average']}
                />
            )}

            {/* Single term — show a note instead of chart */}
            {trendData.length === 1 && (
                <div className="card text-center p-8">
                    <img src="https://em-content.zobj.net/source/apple/354/chart-increasing_1f4c8.png" alt="Chart" className="mb-4" style={{ width: 48, height: 48, objectFit: 'contain' }} />
                    <h3 className="text-base font-bold font-[family-name:var(--font-display)] mb-2">Performance Trend</h3>
                    <p className="text-sm text-[var(--color-text-muted)]">
                        Your trend chart will appear here once results for more than one term are available.
                    </p>
                </div>
            )}
        </div>
    );
}
