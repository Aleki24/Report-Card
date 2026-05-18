"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
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

interface Stats {
    termAverage: number;
    bestSubject: string;
    bestScore: number;
    weakestSubject: string;
    weakestScore: number;
    streamPosition: number;
    totalInStream: number;
}

export default function MyResultsPage() {
    const { profile, user, role, loading } = useAuth();

    const [studentId, setStudentId] = useState<string | null>(null);
    const [termResults, setTermResults] = useState<TermResult[]>([]);
    const [stats, setStats] = useState<Stats>({
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

            try {
                const res = await fetch('/api/school/my-results');
                if (!res.ok) {
                    console.error('Failed to fetch results:', await res.text());
                    setFetching(false);
                    return;
                }

                const json = await res.json();
                const data = json.data;

                if (!data || !data.termResults || data.termResults.length === 0) {
                    setFetching(false);
                    return;
                }

                setStudentId(data.studentId);
                setTermResults(data.termResults);
                setTrendData(data.trendData || []);

                if (data.stats) {
                    setStats(data.stats);
                }
            } catch (err) {
                console.error('Error fetching results:', err);
            } finally {
                setFetching(false);
            }
        };

        if (role === 'STUDENT' && user) {
            fetchResults();
        } else {
            setFetching(false);
        }
    }, [user, role]);

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
                <h2 style={{ fontSize: 16, marginBottom: 'var(--space-2)' }}>Access Restricted</h2>
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
            <div className="mb-6">
                <h1 className="text-[1.25rem] xs:text-[1.5rem] sm:text-[1.75rem] font-bold tracking-tight font-display mb-1">
                    My Results
                </h1>
                <p className="text-[11px] xs:text-[12px] text-muted-foreground leading-relaxed">
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
                            <div className="text-xs text-muted-foreground mt-1">Latest term ranking</div>
                        )}
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">Best Subject</div>
                        <div className="stat-value" style={{ fontSize: '0.875rem' }}>{stats.bestSubject}</div>
                        <div className="text-xs text-emerald-500 mt-1">{stats.bestScore}%</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">Weakest Subject</div>
                        <div className="stat-value" style={{ fontSize: '0.875rem' }}>{stats.weakestSubject}</div>
                        <div className="text-xs text-amber-500 mt-1">{stats.weakestScore}%</div>
                    </div>
                </div>
            ) : (
                <div className="card text-center p-8 mb-6">
                    <img src="https://em-content.zobj.net/source/apple/354/open-mailbox-with-lowered-flag_1f4ed.png" alt="Empty" className="mb-4" style={{ width: 48, height: 48, objectFit: 'contain' }} />
                    <h3 className="text-lg font-bold font-[family-name:var(--font-display)] mb-2">No Results Yet</h3>
                    <p className="text-sm text-muted-foreground">
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
                            <p className="text-xs text-muted-foreground">
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
                                            <td className="text-muted-foreground text-sm">{s.comment}</td>
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
                    <p className="text-sm text-muted-foreground">
                        Your trend chart will appear here once results for more than one term are available.
                    </p>
                </div>
            )}
        </div>
    );
}
