"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { Trophy, Download, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { REPORT_TEMPLATES, DEFAULT_TEMPLATE, isReportTemplateId, type ReportTemplateId } from '@/lib/pdf/templateMeta';
import PageHeader from '@/components/dashboard/PageHeader';
import DashboardCard from '@/components/dashboard/DashboardCard';
import EmptyState from '@/components/dashboard/EmptyState';
import FilterBar, { FilterField } from '@/components/ui/FilterBar';
import { Badge, Select } from '@/components/ui';
import DataTable, { type DataTableColumn } from '@/components/ui/DataTable';

interface ExamResult {
    id: string;
    raw_score: number;
    percentage: number;
    grade_symbol: string | null;
    remarks: string | null;
    exams: {
        id: string;
        max_score: number;
        subjects: { id: string; name: string } | null;
        academic_years: { id: string; name: string } | null;
        terms: { id: string; name: string } | null;
    } | null;
}

interface ReportSubject {
    id: string;
    total_score: number | null;
    total_max_score: number | null;
    percentage: number | null;
    grade_symbol: string | null;
    teacher_comment: string | null;
    subjects: { id: string; name: string } | null;
}

interface ReportCard {
    id: string;
    student_id?: string;
    overall_average: number | null;
    overall_position: number | null;
    comments_class_teacher: string | null;
    comments_principal: string | null;
    behaviour_summary: string | null;
    attendance_present: number;
    attendance_total: number;
    generated_at: string | null;
    academic_years: { id: string; name: string } | null;
    terms: { id: string; name: string } | null;
    grade_streams: { id: string; name: string; full_name: string } | null;
    report_card_subjects: ReportSubject[];
}

export default function StudentCombinedResultsPage() {
    const [activeTab, setActiveTab] = useState<'marks' | 'reports'>('marks');

    return (
        <div className="mx-auto max-w-[1100px] pb-10">
            <PageHeader title="My Results" description="View your granular exam marks and official report cards." />

            <div className="mb-6 flex overflow-x-auto border-b border-border">
                <button
                    onClick={() => setActiveTab('marks')}
                    className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${activeTab === 'marks' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                    Granular Exam Marks
                </button>
                <button
                    onClick={() => setActiveTab('reports')}
                    className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${activeTab === 'reports' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                    Official Report Cards
                </button>
            </div>

            {activeTab === 'marks' ? <ExamMarksTab /> : <ReportCardsTab />}
        </div>
    );
}

function ExamMarksTab() {
    const [results, setResults] = useState<ExamResult[]>([]);
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
        results.forEach((r) => {
            const ex = r.exams;
            if (ex?.academic_years) yrs.set(ex.academic_years.id, ex.academic_years.name);
            if (ex?.terms) trms.set(ex.terms.id, ex.terms.name);
            if (ex?.subjects) subs.set(ex.subjects.id, ex.subjects.name);
        });
        return { years: Array.from(yrs.entries()), terms: Array.from(trms.entries()), subjects: Array.from(subs.entries()) };
    }, [results]);

    // Group by term
    const grouped = useMemo(() => {
        const map: Record<string, { term: string; year: string; items: ExamResult[] }> = {};
        results.forEach((r) => {
            const ex = r.exams;
            const key = `${ex?.terms?.id || 'x'}_${ex?.academic_years?.id || 'x'}`;
            if (!map[key]) map[key] = { term: ex?.terms?.name || '?', year: ex?.academic_years?.name || '', items: [] };
            map[key].items.push(r);
        });
        return Object.values(map);
    }, [results]);

    const columns: DataTableColumn<ExamResult>[] = [
        { key: 'subject', header: 'Subject', render: r => <span className="font-semibold text-foreground">{r.exams?.subjects?.name || '—'}</span> },
        { key: 'score', header: 'Score', render: r => <span className="font-mono text-muted-foreground">{r.raw_score}/{r.exams?.max_score}</span> },
        {
            key: 'percentage', header: '%', numeric: true,
            render: r => <span className={`font-bold ${Number(r.percentage) >= 50 ? 'text-emerald-600' : 'text-destructive'}`}>{r.percentage}%</span>,
        },
        {
            key: 'grade', header: 'Grade',
            render: r => <Badge variant={Number(r.percentage) >= 50 ? 'success' : 'danger'}>{r.grade_symbol || '—'}</Badge>,
        },
        { key: 'remarks', header: 'Remarks', hideOnMobile: true, render: r => <span className="text-muted-foreground">{r.remarks || '—'}</span> },
    ];

    return (
        <div>
            <FilterBar>
                <FilterField label="Year">
                    <Select value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
                        <option value="">All Years</option>
                        {years.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                    </Select>
                </FilterField>
                <FilterField label="Term">
                    <Select value={termFilter} onChange={e => setTermFilter(e.target.value)}>
                        <option value="">All Terms</option>
                        {terms.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                    </Select>
                </FilterField>
                <FilterField label="Subject">
                    <Select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}>
                        <option value="">All Subjects</option>
                        {subjects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                    </Select>
                </FilterField>
            </FilterBar>

            {loading ? (
                <div className="flex flex-col gap-2">
                    {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton-bone h-12 rounded-xl" />)}
                </div>
            ) : results.length === 0 ? (
                <EmptyState icon={<Trophy className="h-6 w-6" />} title="No results yet" description="Results will appear here once your teachers publish exam marks." />
            ) : (
                <div className="flex flex-col gap-6">
                    {grouped.map((g, idx) => (
                        <div key={idx}>
                            <div className="mb-2 flex items-center justify-between">
                                <h3 className="font-display text-[15px] font-bold text-foreground">{g.term} — {g.year}</h3>
                                <span className="text-xs text-muted-foreground">{g.items.length} subjects recorded</span>
                            </div>
                            <DataTable columns={columns} rows={g.items} rowKey={r => r.id} mobileTitleKey="subject" />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function ReportCardsTab() {
    const [reports, setReports] = useState<ReportCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [template, setTemplate] = useState<ReportTemplateId>(DEFAULT_TEMPLATE);

    useEffect(() => {
        fetch('/api/school/student/report-cards').then(r => r.json()).then(j => setReports(j.data || [])).catch(() => {}).finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col gap-4">
                {[1, 2].map(i => <div key={i} className="skeleton-bone h-40 rounded-2xl" />)}
            </div>
        );
    }

    if (reports.length === 0) {
        return <EmptyState icon={<FileText className="h-6 w-6" />} title="No report cards" description="Report cards will appear here once generated by your teachers." />;
    }

    const subjectColumns: DataTableColumn<ReportSubject>[] = [
        { key: 'subject', header: 'Subject', render: s => <span className="font-semibold text-foreground">{s.subjects?.name || '—'}</span> },
        { key: 'score', header: 'Score', render: s => <span className="text-muted-foreground">{s.total_score ?? '—'}/{s.total_max_score ?? '—'}</span> },
        {
            key: 'percentage', header: '%', numeric: true,
            render: s => <span className={`font-bold ${(s.percentage ?? 0) >= 50 ? 'text-emerald-600' : 'text-destructive'}`}>{s.percentage ?? 0}%</span>,
        },
        {
            key: 'grade', header: 'Grade',
            render: s => <Badge variant={(s.percentage ?? 0) >= 50 ? 'success' : 'danger'}>{s.grade_symbol || '—'}</Badge>,
        },
        { key: 'comment', header: 'Comment', hideOnMobile: true, render: s => <span className="text-muted-foreground">{s.teacher_comment || '—'}</span> },
    ];

    return (
        <div className="flex flex-col gap-5">
            <FilterBar>
                <FilterField label="PDF design">
                    <Select value={template} onChange={e => { if (isReportTemplateId(e.target.value)) setTemplate(e.target.value); }}>
                        {REPORT_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </Select>
                </FilterField>
                <span className="text-xs text-muted-foreground">{REPORT_TEMPLATES.find(t => t.id === template)?.description}</span>
            </FilterBar>

            {reports.map((rc) => {
                const isOpen = expanded === rc.id;
                const subjects = rc.report_card_subjects || [];
                const attendPct = rc.attendance_total > 0 ? Math.round((rc.attendance_present / rc.attendance_total) * 100) : null;

                return (
                    <DashboardCard key={rc.id}>
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                    <FileText size={24} />
                                </div>
                                <div>
                                    <h3 className="font-display text-base font-bold text-foreground">
                                        {rc.terms?.name || 'Term'} — {rc.academic_years?.name || 'Year'}
                                    </h3>
                                    <div className="text-[13px] font-medium text-muted-foreground">
                                        {rc.grade_streams?.full_name || rc.grade_streams?.name || ''}
                                        {rc.generated_at && ` · Generated ${new Date(rc.generated_at).toLocaleDateString('en-GB')}`}
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button onClick={() => setExpanded(isOpen ? null : rc.id)} className="btn-secondary inline-flex items-center gap-1.5">
                                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    {isOpen ? 'Collapse' : 'Details'}
                                </button>
                                <a
                                    href={`/api/reports/student/${rc.student_id || ''}?term=${rc.terms?.id || ''}&year=${rc.academic_years?.id || ''}${template !== DEFAULT_TEMPLATE ? `&template=${template}` : ''}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-primary inline-flex items-center gap-1.5 no-underline"
                                >
                                    <Download size={16} /> Download PDF
                                </a>
                            </div>
                        </div>

                        {/* Summary row */}
                        <div className="mt-6 flex flex-wrap gap-8 border-t border-border pt-5">
                            <div>
                                <span className="mb-1 block text-xs font-semibold text-muted-foreground">Overall Average</span>
                                <strong className={`text-lg ${(rc.overall_average || 0) >= 50 ? 'text-emerald-600' : 'text-destructive'}`}>{rc.overall_average != null ? `${rc.overall_average}%` : '—'}</strong>
                            </div>
                            <div>
                                <span className="mb-1 block text-xs font-semibold text-muted-foreground">Class Position</span>
                                <strong className="text-lg text-foreground">{rc.overall_position || '—'}</strong>
                            </div>
                            {attendPct != null && (
                                <div>
                                    <span className="mb-1 block text-xs font-semibold text-muted-foreground">Attendance</span>
                                    <strong className="text-lg text-foreground">{attendPct}% <span className="text-[13px] font-medium text-muted-foreground">({rc.attendance_present}/{rc.attendance_total})</span></strong>
                                </div>
                            )}
                        </div>

                        {/* Expanded details */}
                        {isOpen && (
                            <div className="mt-6 animate-[slideUpFade_0.2s_ease-out] border-t border-border pt-6">
                                {(rc.comments_class_teacher || rc.comments_principal || rc.behaviour_summary) && (
                                    <div className="mb-6 rounded-xl border border-border bg-muted/40 p-4 text-[13px]">
                                        {rc.comments_class_teacher && <div className="mb-2"><span className="font-bold text-foreground/80">Class Teacher:</span> <span className="text-foreground">{rc.comments_class_teacher}</span></div>}
                                        {rc.comments_principal && <div className="mb-2"><span className="font-bold text-foreground/80">Principal:</span> <span className="text-foreground">{rc.comments_principal}</span></div>}
                                        {rc.behaviour_summary && <div><span className="font-bold text-foreground/80">Behaviour:</span> <span className="text-foreground">{rc.behaviour_summary}</span></div>}
                                    </div>
                                )}

                                {subjects.length > 0 && (
                                    <DataTable columns={subjectColumns} rows={subjects} rowKey={s => s.id} mobileTitleKey="subject" />
                                )}
                            </div>
                        )}
                    </DashboardCard>
                );
            })}
        </div>
    );
}
