"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { Trophy, Download, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { PerformanceTrendChart } from '@/components/charts/PerformanceTrend';
import { REPORT_TEMPLATES, DEFAULT_TEMPLATE, isReportTemplateId, type ReportTemplateId } from '@/lib/pdf/templateMeta';

export default function StudentCombinedResultsPage() {
    const [activeTab, setActiveTab] = useState<'marks' | 'reports'>('marks');

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 'var(--space-10)' }}>
            <div className="student-page-header">
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800, color: '#1E293B', marginBottom: 4 }}>
                    My Results
                </h1>
                <p style={{ fontSize: 14, color: '#64748B' }}>
                    View your granular exam marks and official report cards.
                </p>
            </div>

            {/* Custom Tabs */}
            <div style={{ display: 'flex', gap: 16, borderBottom: '1px solid #E2E8F0', marginBottom: 24, overflowX: 'auto', whiteSpace: 'nowrap' }}>
                <button 
                    onClick={() => setActiveTab('marks')}
                    style={{ 
                        padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', 
                        fontSize: 14, fontWeight: 700, 
                        color: activeTab === 'marks' ? '#3B82F6' : '#64748B',
                        borderBottom: activeTab === 'marks' ? '2px solid #3B82F6' : '2px solid transparent',
                        transition: 'all 0.2s'
                    }}
                >
                    Granular Exam Marks
                </button>
                <button 
                    onClick={() => setActiveTab('reports')}
                    style={{ 
                        padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', 
                        fontSize: 14, fontWeight: 700, 
                        color: activeTab === 'reports' ? '#3B82F6' : '#64748B',
                        borderBottom: activeTab === 'reports' ? '2px solid #3B82F6' : '2px solid transparent',
                        transition: 'all 0.2s'
                    }}
                >
                    Official Report Cards
                </button>
            </div>

            {activeTab === 'marks' ? <ExamMarksTab /> : <ReportCardsTab />}
        </div>
    );
}

function ExamMarksTab() {
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [yearFilter, setYearFilter] = useState('');
    const [termFilter, setTermFilter] = useState('');
    const [subjectFilter, setSubjectFilter] = useState('');

    useEffect(() => {
        const params = new URLSearchParams();
        if (yearFilter) params.set('year', yearFilter);
        if (termFilter) params.set('term', termFilter);
        if (subjectFilter) params.set('subject', subjectFilter);
        const qs = params.toString();

        setLoading(true);
        fetch(`/api/school/student/results${qs ? `?${qs}` : ''}`)
            .then(r => r.json())
            .then(j => setResults(j.data || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [yearFilter, termFilter, subjectFilter]);

    // Extract unique filter options
    const { years, terms, subjects } = useMemo(() => {
        const yrs = new Map<string, string>();
        const trms = new Map<string, string>();
        const subs = new Map<string, string>();
        results.forEach((r: any) => {
            const ex = r.exams;
            if (ex?.academic_years) yrs.set(ex.academic_years.id, ex.academic_years.name);
            if (ex?.terms) trms.set(ex.terms.id, ex.terms.name);
            if (ex?.subjects) subs.set(ex.subjects.id, ex.subjects.name);
        });
        return { years: Array.from(yrs.entries()), terms: Array.from(trms.entries()), subjects: Array.from(subs.entries()) };
    }, [results]);

    // Group by term
    const grouped = useMemo(() => {
        const map: Record<string, { term: string; year: string; termId: string; yearId: string; items: any[] }> = {};
        results.forEach((r: any) => {
            const ex = r.exams;
            const key = `${ex?.terms?.id || 'x'}_${ex?.academic_years?.id || 'x'}`;
            if (!map[key]) map[key] = { term: ex?.terms?.name || '?', year: ex?.academic_years?.name || '', termId: ex?.terms?.id, yearId: ex?.academic_years?.id, items: [] };
            map[key].items.push(r);
        });
        return Object.values(map);
    }, [results]);

    return (
        <div>
            {/* Filters */}
            <div className="student-filter-bar" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12 }}>
                <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
                    <option value="">All Years</option>
                    {years.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
                <select value={termFilter} onChange={e => setTermFilter(e.target.value)}>
                    <option value="">All Terms</option>
                    {terms.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
                <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}>
                    <option value="">All Subjects</option>
                    {subjects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-10)' }}><div className="skeleton-spinner" style={{ margin: '0 auto' }} /></div>
            ) : results.length === 0 ? (
                <div className="premium-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <Trophy size={48} style={{ color: '#94A3B8', marginBottom: 16, margin: '0 auto', opacity: 0.5 }} />
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#1E293B', marginBottom: 4 }}>No Results Yet</p>
                    <p style={{ fontSize: 13, color: '#64748B' }}>Results will appear here once your teachers publish exam marks.</p>
                </div>
            ) : (
                <>
                    {/* Results by term */}
                    {grouped.map((g, idx) => (
                        <div key={idx} className="premium-card" style={{ marginBottom: 24, padding: 0, overflow: 'hidden' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
                                <div>
                                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: '#1E293B' }}>{g.term} — {g.year}</h3>
                                    <p style={{ fontSize: 12, color: '#64748B' }}>{g.items.length} subjects recorded</p>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="data-table" style={{ width: '100%', border: 'none' }}>
                                    <thead style={{ background: '#fff' }}>
                                        <tr>
                                            <th style={{ color: '#64748B', fontWeight: 600, fontSize: 12 }}>Subject</th>
                                            <th style={{ color: '#64748B', fontWeight: 600, fontSize: 12 }}>Score</th>
                                            <th style={{ color: '#64748B', fontWeight: 600, fontSize: 12 }}>%</th>
                                            <th style={{ color: '#64748B', fontWeight: 600, fontSize: 12 }}>Grade</th>
                                            <th style={{ color: '#64748B', fontWeight: 600, fontSize: 12 }}>Remarks</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {g.items.map((r: any) => {
                                            const pct = Number(r.percentage);
                                            const isGood = pct >= 50;
                                            return (
                                                <tr key={r.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                                    <td style={{ fontWeight: 600, color: '#1E293B', fontSize: 13 }}>{r.exams?.subjects?.name || '—'}</td>
                                                    <td className="font-mono" style={{ fontSize: 13, color: '#64748B' }}>{r.raw_score}/{r.exams?.max_score}</td>
                                                    <td style={{ fontWeight: 700, color: isGood ? '#10B981' : '#EF4444' }}>{pct}%</td>
                                                    <td>
                                                        <span style={{ 
                                                            padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                                                            background: isGood ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                            color: isGood ? '#10B981' : '#EF4444'
                                                        }}>
                                                            {r.grade_symbol || '—'}
                                                        </span>
                                                    </td>
                                                    <td style={{ color: '#64748B', fontSize: 12 }}>{r.remarks || '—'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </>
            )}
        </div>
    );
}

function ReportCardsTab() {
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [template, setTemplate] = useState<ReportTemplateId>(DEFAULT_TEMPLATE);

    useEffect(() => {
        fetch('/api/school/student/report-cards').then(r => r.json()).then(j => setReports(j.data || [])).catch(() => {}).finally(() => setLoading(false));
    }, []);

    if (loading) return <div style={{ textAlign: 'center', padding: 'var(--space-10)' }}><div className="skeleton-spinner" style={{ margin: '0 auto' }} /></div>;

    if (reports.length === 0) return (
        <div className="premium-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <FileText size={48} style={{ color: '#94A3B8', marginBottom: 16, margin: '0 auto', opacity: 0.5 }} />
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1E293B', marginBottom: 4 }}>No Report Cards</p>
            <p style={{ fontSize: 13, color: '#64748B' }}>Report cards will appear here once generated by your teachers.</p>
        </div>
    );

    return (
        <div style={{ display: 'grid', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>PDF design:</label>
                <select
                    value={template}
                    onChange={e => { if (isReportTemplateId(e.target.value)) setTemplate(e.target.value); }}
                    style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', fontSize: 13, color: '#334155', fontWeight: 600 }}
                >
                    {REPORT_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <span style={{ fontSize: 12, color: '#94A3B8' }}>{REPORT_TEMPLATES.find(t => t.id === template)?.description}</span>
            </div>
            {reports.map((rc: any) => {
                const isOpen = expanded === rc.id;
                const subjects = rc.report_card_subjects || [];
                const attendPct = rc.attendance_total > 0 ? Math.round((rc.attendance_present / rc.attendance_total) * 100) : null;

                return (
                    <div key={rc.id} className="premium-card" style={{ padding: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <FileText size={24} />
                                </div>
                                <div>
                                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#1E293B', marginBottom: 4 }}>
                                        {rc.terms?.name || 'Term'} — {rc.academic_years?.name || 'Year'}
                                    </h3>
                                    <div style={{ fontSize: 13, color: '#64748B', fontWeight: 500 }}>
                                        {rc.grade_streams?.full_name || rc.grade_streams?.name || ''}
                                        {rc.generated_at && ` · Generated ${new Date(rc.generated_at).toLocaleDateString('en-GB')}`}
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <button 
                                    style={{ padding: '8px 16px', background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                                    onClick={() => setExpanded(isOpen ? null : rc.id)}
                                >
                                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    {isOpen ? 'Collapse' : 'Details'}
                                </button>
                                <a 
                                    href={`/api/reports/student/${rc.student_id || ''}?term=${rc.terms?.id || ''}&year=${rc.academic_years?.id || ''}${template !== DEFAULT_TEMPLATE ? `&template=${template}` : ''}`}
                                    target="_blank" 
                                    style={{ padding: '8px 16px', background: '#10B981', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
                                >
                                    <Download size={16} /> Download PDF
                                </a>
                            </div>
                        </div>

                        {/* Summary row */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, marginTop: 24, paddingTop: 20, borderTop: '1px solid #F1F5F9', fontSize: 14 }}>
                            <div>
                                <span style={{ color: '#64748B', display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Overall Average</span> 
                                <strong style={{ fontSize: 18, color: (rc.overall_average || 0) >= 50 ? '#10B981' : '#EF4444' }}>{rc.overall_average != null ? `${rc.overall_average}%` : '—'}</strong>
                            </div>
                            <div>
                                <span style={{ color: '#64748B', display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Class Position</span> 
                                <strong style={{ fontSize: 18, color: '#1E293B' }}>{rc.overall_position || '—'}</strong>
                            </div>
                            {attendPct != null && (
                                <div>
                                    <span style={{ color: '#64748B', display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Attendance</span> 
                                    <strong style={{ fontSize: 18, color: '#1E293B' }}>{attendPct}% <span style={{ fontSize: 13, color: '#94A3B8', fontWeight: 500 }}>({rc.attendance_present}/{rc.attendance_total})</span></strong>
                                </div>
                            )}
                        </div>

                        {/* Expanded details */}
                        {isOpen && (
                            <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid #F1F5F9', animation: 'slideUpFade 0.2s ease-out' }}>
                                {/* Comments */}
                                {(rc.comments_class_teacher || rc.comments_principal || rc.behaviour_summary) && (
                                    <div style={{ marginBottom: 24, padding: 16, background: '#F8FAFC', borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 13 }}>
                                        {rc.comments_class_teacher && <div style={{ marginBottom: 8 }}><span style={{ fontWeight: 700, color: '#475569' }}>Class Teacher:</span> <span style={{ color: '#1E293B' }}>{rc.comments_class_teacher}</span></div>}
                                        {rc.comments_principal && <div style={{ marginBottom: 8 }}><span style={{ fontWeight: 700, color: '#475569' }}>Principal:</span> <span style={{ color: '#1E293B' }}>{rc.comments_principal}</span></div>}
                                        {rc.behaviour_summary && <div><span style={{ fontWeight: 700, color: '#475569' }}>Behaviour:</span> <span style={{ color: '#1E293B' }}>{rc.behaviour_summary}</span></div>}
                                    </div>
                                )}

                                {/* Subject table */}
                                {subjects.length > 0 && (
                                    <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, overflowX: 'auto' }}>
                                        <table className="data-table" style={{ width: '100%', border: 'none' }}>
                                            <thead style={{ background: '#F8FAFC' }}>
                                                <tr>
                                                    <th style={{ color: '#64748B', fontWeight: 600, fontSize: 12 }}>Subject</th>
                                                    <th style={{ color: '#64748B', fontWeight: 600, fontSize: 12 }}>Score</th>
                                                    <th style={{ color: '#64748B', fontWeight: 600, fontSize: 12 }}>%</th>
                                                    <th style={{ color: '#64748B', fontWeight: 600, fontSize: 12 }}>Grade</th>
                                                    <th style={{ color: '#64748B', fontWeight: 600, fontSize: 12 }}>Comment</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {subjects.map((s: any) => {
                                                    const pct = s.percentage || 0;
                                                    const isGood = pct >= 50;
                                                    return (
                                                        <tr key={s.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                                            <td style={{ fontWeight: 600, color: '#1E293B', fontSize: 13 }}>{s.subjects?.name || '—'}</td>
                                                            <td style={{ fontSize: 13, color: '#64748B' }}>{s.total_score ?? '—'}/{s.total_max_score ?? '—'}</td>
                                                            <td style={{ fontWeight: 700, color: isGood ? '#10B981' : '#EF4444' }}>{pct}%</td>
                                                            <td>
                                                                <span style={{ 
                                                                    padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                                                                    background: isGood ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                                    color: isGood ? '#10B981' : '#EF4444'
                                                                }}>
                                                                    {s.grade_symbol || '—'}
                                                                </span>
                                                            </td>
                                                            <td style={{ fontSize: 12, color: '#64748B' }}>{s.teacher_comment || '—'}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
