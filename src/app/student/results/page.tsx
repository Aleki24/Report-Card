"use client";

import React, { useState, useMemo } from 'react';
import { Trophy, Download, FileText, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { REPORT_TEMPLATES, DEFAULT_TEMPLATE, isReportTemplateId, type ReportTemplateId } from '@/lib/pdf/templateMeta';
import PageHeader from '@/components/dashboard/PageHeader';
import DashboardCard from '@/components/dashboard/DashboardCard';
import EmptyState from '@/components/dashboard/EmptyState';
import FilterBar, { FilterField } from '@/components/ui/FilterBar';
import { Badge, Select } from '@/components/ui';
import DataTable, { type DataTableColumn } from '@/components/ui/DataTable';
import { useSchoolPassMark } from '@/hooks/useSchoolPassMark';
import { useJsonList } from '@/hooks/useJsonList';
import type { StudentReportCardListItem, StudentReportSubject } from '@/lib/student/queries';
import { groupResultsByRound } from '@/lib/student/result-groups';
import { FEATURE_ICONS } from '@/components/ui/featureIcons';

interface ExamResult {
    id: string;
    raw_score: number;
    percentage: number;
    grade_symbol: string | null;
    remarks: string | null;
    exams: {
        id: string;
        name: string;
        exam_type: string;
        exam_date: string | null;
        max_score: number;
        subjects: { id: string; name: string } | null;
        academic_years: { id: string; name: string } | null;
        terms: { id: string; name: string } | null;
    } | null;
}

type ReportCard = StudentReportCardListItem;
type ReportSubject = StudentReportSubject;

export default function StudentCombinedResultsPage() {
    const [activeTab, setActiveTab] = useState<'marks' | 'reports'>('marks');
    const [reportsOpened, setReportsOpened] = useState(false);

    return (
        <div className="w-full mx-auto max-w-[1100px] pb-10">
            <PageHeader title="My results" eyebrow="Academics" icon={FEATURE_ICONS.results} hue="violet" description="Your exam marks and official report cards." />

            <div className="mb-6 flex overflow-x-auto border-b border-border">
                <button
                    onClick={() => setActiveTab('marks')}
                    className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${activeTab === 'marks' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                    Exam marks
                </button>
                <button
                    onClick={() => { setActiveTab('reports'); setReportsOpened(true); }}
                    className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${activeTab === 'reports' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                    Report cards
                </button>
            </div>

            {/* Each tab mounts on first visit and then stays, hidden, so switching
                back neither refetches nor resets the filters. */}
            <div hidden={activeTab !== 'marks'}><ExamMarksTab /></div>
            {reportsOpened && <div hidden={activeTab !== 'reports'}><ReportCardsTab /></div>}
        </div>
    );
}


const optionsOf = (results: readonly ExamResult[], pick: (r: ExamResult) => { id: string; name: string } | null | undefined) =>
    Array.from(new Map(results.flatMap(r => { const o = pick(r); return o ? [[o.id, o.name] as const] : []; })).entries());

/**
 * Every released mark, by term and then by exam (Midterm, Endterm, …).
 *
 * It listed a term's marks in one table with no exam name, so a learner with
 * a CAT and a Midterm saw "English" twice and couldn't tell which was which,
 * under a count of "subjects" that was really a count of marks. Its filters
 * were rebuilt from the filtered results, so choosing a term hid every other
 * term until the filter was cleared. A learner's released marks are a small
 * set, so they load once and filter here.
 */
function ExamMarksTab() {
    // Green from the school's own pass mark, as on its dashboards.
    const passMark = useSchoolPassMark();
    // The shared list hook, for its Try again: a failed load used to say "reload the page".
    const marks = useJsonList<ExamResult>('/api/school/student/results', 'Couldn’t load your results.');
    const results = marks.loading ? null : marks.rows;
    const [yearFilter, setYearFilter] = useState('');
    const [termFilter, setTermFilter] = useState('');
    const [subjectFilter, setSubjectFilter] = useState('');

    const all = useMemo(() => results ?? [], [results]);
    const years = useMemo(() => optionsOf(all, r => r.exams?.academic_years), [all]);
    const terms = useMemo(() => optionsOf(all.filter(r => !yearFilter || r.exams?.academic_years?.id === yearFilter), r => r.exams?.terms), [all, yearFilter]);
    const subjects = useMemo(() => optionsOf(all, r => r.exams?.subjects).sort((a, b) => a[1].localeCompare(b[1])), [all]);

    const grouped = useMemo(() => groupResultsByRound(all.filter(r =>
        (!yearFilter || r.exams?.academic_years?.id === yearFilter)
        && (!termFilter || r.exams?.terms?.id === termFilter)
        && (!subjectFilter || r.exams?.subjects?.id === subjectFilter))), [all, yearFilter, termFilter, subjectFilter]);

    const columns: DataTableColumn<ExamResult>[] = [
        { key: 'subject', header: 'Subject', render: r => <span className="font-semibold text-foreground">{r.exams?.subjects?.name || '—'}</span> },
        { key: 'score', header: 'Score', render: r => <span className="font-mono text-muted-foreground">{r.raw_score}/{r.exams?.max_score}</span> },
        {
            key: 'percentage', header: '%', numeric: true,
            render: r => <span className={`font-bold ${Number(r.percentage) >= passMark ? 'text-emerald-600' : 'text-destructive'}`}>{r.percentage}%</span>,
        },
        {
            key: 'grade', header: 'Grade',
            render: r => <Badge variant={Number(r.percentage) >= passMark ? 'success' : 'danger'}>{r.grade_symbol || '—'}</Badge>,
        },
        { key: 'remarks', header: 'Remarks', hideOnMobile: true, render: r => <span className="text-muted-foreground">{r.remarks || '—'}</span> },
    ];

    return (
        <div>
            <FilterBar>
                <FilterField label="Year">
                    <Select value={yearFilter} onChange={e => { setYearFilter(e.target.value); setTermFilter(''); }}>
                        <option value="">All years</option>
                        {years.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                    </Select>
                </FilterField>
                <FilterField label="Term">
                    <Select value={termFilter} onChange={e => setTermFilter(e.target.value)}>
                        <option value="">All terms</option>
                        {terms.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                    </Select>
                </FilterField>
                <FilterField label="Subject">
                    <Select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}>
                        <option value="">All subjects</option>
                        {subjects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                    </Select>
                </FilterField>
            </FilterBar>

            {results === null ? (
                <div className="flex flex-col gap-2">
                    {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton-bone h-12 rounded-xl" />)}
                </div>
            ) : marks.error ? (
                <EmptyState
                    icon={<Trophy className="h-6 w-6" />}
                    title="Couldn’t load your results"
                    description={marks.error}
                    action={<button type="button" onClick={marks.retry} className="btn-primary"><RotateCcw className="size-4" aria-hidden />Try again</button>}
                />
            ) : grouped.length === 0 ? (
                <EmptyState
                    icon={<Trophy className="h-6 w-6" />}
                    title={all.length === 0 ? 'No results yet' : 'Nothing matches these filters'}
                    description={all.length === 0 ? 'Your marks appear here once your teachers release them.' : 'Try another year, term or subject.'}
                />
            ) : (
                <div className="flex flex-col gap-8">
                    {grouped.map(t => (
                        <section key={t.key} aria-label={`${t.term} ${t.year}`} className="flex flex-col gap-4">
                            <h3 className="font-display text-base font-bold text-foreground">{t.term}{t.year ? ` · ${t.year}` : ''}</h3>
                            {t.rounds.map(rd => (
                                <div key={rd.key}>
                                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                        <h4 className="text-sm font-semibold text-foreground">{rd.label}</h4>
                                        <span className="text-xs text-muted-foreground">
                                            {rd.items.length} subject{rd.items.length === 1 ? '' : 's'} · average <strong className={rd.average >= passMark ? 'text-emerald-600' : 'text-destructive'}>{rd.average}%</strong>
                                        </span>
                                    </div>
                                    <DataTable columns={columns} rows={rd.items} rowKey={r => r.id} mobileTitleKey="subject" />
                                </div>
                            ))}
                        </section>
                    ))}
                </div>
            )}
        </div>
    );
}

function ReportCardsTab() {
    // Green from the school's own pass mark, as on its dashboards.
    const passMark = useSchoolPassMark();
    const { rows: reports, loading, error, retry } = useJsonList<ReportCard>('/api/school/student/report-cards', 'Couldn’t load your report cards.');
    const [expanded, setExpanded] = useState<string | null>(null);
    const [template, setTemplate] = useState<ReportTemplateId>(DEFAULT_TEMPLATE);

    if (loading) {
        return (
            <div className="flex flex-col gap-4">
                {[1, 2].map(i => <div key={i} className="skeleton-bone h-40 rounded-2xl" />)}
            </div>
        );
    }

    if (error) {
        return (
            <EmptyState
                icon={<FileText className="h-6 w-6" />}
                title="Couldn’t load your report cards"
                description={error}
                action={<button type="button" onClick={retry} className="btn-primary"><RotateCcw className="size-4" aria-hidden />Try again</button>}
            />
        );
    }

    if (reports.length === 0) {
        return <EmptyState icon={<FileText className="h-6 w-6" />} title="No report cards yet" description="A term’s report card appears here once your school releases its results." />;
    }

    const subjectColumns: DataTableColumn<ReportSubject>[] = [
        { key: 'subject', header: 'Subject', render: s => <span className="font-semibold text-foreground">{s.subjects.name}</span> },
        // The term's average; the PDF prints each paper's score and grade.
        {
            key: 'percentage', header: 'Term average', numeric: true,
            render: s => <span className={`font-bold ${s.percentage >= passMark ? 'text-emerald-600' : 'text-destructive'}`}>{s.percentage}%</span>,
        },
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
                                    href={`/api/reports/student/${rc.student_id}?term=${rc.terms?.id || ''}&year=${rc.academic_years?.id || ''}${template !== DEFAULT_TEMPLATE ? `&template=${template}` : ''}`}
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
                                <strong className={`text-lg ${(rc.overall_average || 0) >= passMark ? 'text-emerald-600' : 'text-destructive'}`}>{rc.overall_average != null ? `${rc.overall_average}%` : '—'}</strong>
                            </div>
                            {rc.overall_position != null && (
                                <div>
                                    <span className="mb-1 block text-xs font-semibold text-muted-foreground">Class Position</span>
                                    <strong className="text-lg text-foreground">{rc.overall_position}</strong>
                                </div>
                            )}
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
