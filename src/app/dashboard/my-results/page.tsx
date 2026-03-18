"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

export default function MyResultsPage() {
    const { profile, role, loading } = useAuth();
    const supabase = createSupabaseBrowserClient();

    const [termResults, setTermResults] = useState<any[]>([]);
    const [stats, setStats] = useState({
        termAverage: 0,
        bestSubject: '-',
        bestScore: 0,
        weakestSubject: '-',
        weakestScore: 0,
    });
    const [fetching, setFetching] = useState(true);

    useEffect(() => {
        const fetchResults = async () => {
            if (!profile?.id) {
                setFetching(false);
                return;
            }

            const { data, error } = await supabase
                .from('exam_marks')
                .select(`
                    id,
                    percentage,
                    grade_symbol,
                    raw_score,
                    remarks,
                    exams (
                        name,
                        max_score,
                        terms ( name ),
                        academic_years ( name ),
                        subjects ( name )
                    )
                `)
                .eq('student_id', profile.id);

            if (error) {
                console.error("Error fetching results:", error.message);
                setFetching(false);
                return;
            }

            if (!data || data.length === 0) {
                setFetching(false);
                return;
            }

            const groups: Record<string, any> = {};
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

                if (!groups[termKey]) {
                    groups[termKey] = {
                        term: termKey,
                        subjects: [],
                        average: 0,
                        position: '-', // Pending full class rank implementation calculateClassRanks()
                        totalStudents: '-',
                    };
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

            const resultsArray = Object.values(groups).map((g: any) => {
                const sum = g.subjects.reduce((s: number, subj: any) => s + (subj.maxScore > 0 ? (subj.score / subj.maxScore) * 100 : 0), 0);
                g.average = g.subjects.length > 0 ? (sum / g.subjects.length).toFixed(1) : 0;
                return g;
            });

            setTermResults(resultsArray);
            if (count > 0) {
                setStats({
                    termAverage: Number((totalPct / count).toFixed(1)),
                    bestSubject: bestSub,
                    bestScore: Number(bestScore.toFixed(1)),
                    weakestSubject: worstSub,
                    weakestScore: Number(worstScore.toFixed(1)),
                });
            }
            setFetching(false);
        };

        if (role === 'STUDENT' && profile) {
            fetchResults();
        } else {
            setFetching(false);
        }
    }, [profile, role, supabase]);

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
                <div style={{ fontSize: 48, marginBottom: 'var(--space-4)' }}>🔒</div>
                <h2 style={{ fontSize: 20, marginBottom: 'var(--space-2)' }}>Access Restricted</h2>
                <p style={{ fontSize: 14 }}>This page is only available to students.</p>
            </div>
        );
    }

    const studentName = profile ? `${profile.first_name} ${profile.last_name}` : 'Student';

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
                        <div className="stat-value">{stats.termAverage}%</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">Stream Position</div>
                        <div className="stat-value">- / -</div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-1">Pending Generation</div>
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
                    <div className="text-4xl mb-4">📭</div>
                    <h3 className="text-lg font-bold font-[family-name:var(--font-display)] mb-2">No Results Yet</h3>
                    <p className="text-sm text-[var(--color-text-muted)]">
                        You don't have any published marks at the moment.
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
                                Average: {term.average}% · Position: {term.position}/{term.totalStudents}
                            </p>
                        </div>
                        <button className="btn-primary mt-3 sm:mt-0 text-sm" onClick={() => window.open(`/api/reports/student/${profile?.id}`, '_blank')}>
                            📥 Download Report
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="data-table whitespace-nowrap w-full">
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
                                {term.subjects.map((s: any, sIdx: number) => {
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

            {/* Performance Trend placeholder */}
            {termResults.length > 0 && (
                <div className="card text-center p-8">
                    <div className="text-4xl mb-4">📈</div>
                    <h3 className="text-base font-bold font-[family-name:var(--font-display)] mb-2">Performance Trend</h3>
                    <p className="text-sm text-[var(--color-text-muted)]">
                        Term-over-term performance chart will appear here soon.
                    </p>
                </div>
            )}
        </div>
    );
}
