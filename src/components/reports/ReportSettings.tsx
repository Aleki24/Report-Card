"use client";

import React from 'react';
import { Card, CardContent, Select, Input } from '@/components/ui';
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReportRound } from '@/lib/reports/exam-round';
import { StepHeading } from '@/components/ui/StepHeading';
import { REPORT_TEMPLATES, isReportTemplateId, type ReportTemplateId } from '@/lib/pdf/templateMeta';

interface ReportSettingsProps {
  selectedAcademicYear: string; setSelectedAcademicYear: (v: string) => void;
  selectedTerm: string; setSelectedTerm: (v: string) => void;
  selectedGradeStream: string; setSelectedGradeStream: (v: string) => void;
  customReportTitle: string; setCustomReportTitle: (v: string) => void;
  selectedTemplate: ReportTemplateId; setSelectedTemplate: (v: ReportTemplateId) => void;
  selectedExamType: string; setSelectedExamType: (v: string) => void;
  /** Rounds the chosen class sat this term; null while loading. */
  rounds: ReportRound[] | null;
  /** The round "most recent" resolves to. */
  suggestedRound: string | null;
  academicYears: { id: string; name: string }[];
  terms: { id: string; name: string }[];
  gradeStreams: { id: string; full_name: string }[];
}

export function ReportSettings({
  selectedAcademicYear, setSelectedAcademicYear,
  selectedTerm, setSelectedTerm,
  selectedGradeStream, setSelectedGradeStream,
  customReportTitle, setCustomReportTitle,
  selectedTemplate, setSelectedTemplate,
  selectedExamType, setSelectedExamType,
  rounds, suggestedRound,
  academicYears, terms, gradeStreams,
}: ReportSettingsProps) {
  const isReady = !!(selectedAcademicYear && selectedTerm && selectedGradeStream && selectedExamType);
  const canPickRound = !!(selectedTerm && selectedGradeStream);
  return (
    <Card className="mb-6">
      <CardContent className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <StepHeading step={1} title="Report scope" done={isReady} />
          {isReady ? (
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" /> Ready — pick an action below
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Choose year, term, class and exam to unlock actions</span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-2 font-medium">Academic Year <span className="text-red-500">*</span></label>
            <Select className="w-full h-9 text-sm" value={selectedAcademicYear} onChange={e => setSelectedAcademicYear(e.target.value)}>
              <option value="">-- Choose Year --</option>
              {academicYears.map(ay => <option key={ay.id} value={ay.id}>{ay.name}</option>)}
            </Select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-2 font-medium">Term <span className="text-red-500">*</span></label>
            <Select className="w-full h-9 text-sm" value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)}>
              <option value="">-- Choose Term --</option>
              {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-2 font-medium">Class <span className="text-red-500">*</span></label>
            <Select className="w-full h-9 text-sm" value={selectedGradeStream} onChange={e => setSelectedGradeStream(e.target.value)}>
              <option value="">{gradeStreams.length === 0 ? 'No classes assigned to you' : '-- Choose Class --'}</option>
              {gradeStreams.map(gs => <option key={gs.id} value={gs.id}>{gs.full_name}</option>)}
            </Select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-2 font-medium">Custom Title (Optional)</label>
            <Input className="w-full h-9 text-sm" placeholder="e.g. Mid Term 1 Report" value={customReportTitle} onChange={e => setCustomReportTitle(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-2 font-medium">Card Design</label>
            <Select
              className="w-full h-9 text-sm"
              value={selectedTemplate}
              onChange={e => { if (isReportTemplateId(e.target.value)) setSelectedTemplate(e.target.value); }}
            >
              {REPORT_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1">
              {REPORT_TEMPLATES.find(t => t.id === selectedTemplate)?.description}
            </p>
          </div>
        </div>

        {/* Which exam: its own row so it cannot be missed, and always explicit. */}
        <div className="mt-5 rounded-2xl border border-violet-500/25 bg-violet-500/[0.05] p-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-sm font-semibold text-foreground">Which exam should the reports show? <span className="text-red-500">*</span></p>
            <p className="text-xs text-muted-foreground">Report cards, the mark sheet and the SMS all use this exam.</p>
          </div>
          {!canPickRound ? (
            <p className="text-sm text-muted-foreground">Choose a term and class first.</p>
          ) : rounds === null ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden /> Checking which exams have marks…</p>
          ) : rounds.length === 0 ? (
            <p className="text-sm text-amber-700 dark:text-amber-400">No exams are set up for this class this term yet.</p>
          ) : (
            <div role="radiogroup" aria-label="Exam" className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {rounds.map(r => {
                const active = selectedExamType === r.exam_type;
                const complete = r.subjects_total > 0 && r.subjects_with_marks >= r.subjects_total;
                const empty = r.marks === 0;
                return (
                  <button
                    key={r.exam_type}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setSelectedExamType(r.exam_type)}
                    className={cn(
                      'flex flex-col gap-1.5 rounded-xl border bg-card px-3 py-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active ? 'border-violet-500/70 ring-1 ring-violet-500/40' : 'border-border/70 hover:border-violet-500/40',
                      empty && !active && 'opacity-60',
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-foreground">{r.label}</span>
                      {r.exam_type === suggestedRound && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/12 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-300">
                          <Sparkles className="size-3" aria-hidden />Most recent
                        </span>
                      )}
                    </span>
                    <span className={cn(
                      'text-xs font-medium',
                      empty ? 'text-muted-foreground' : complete ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400',
                    )}>
                      {empty ? 'No marks yet' : `${r.subjects_with_marks} of ${r.subjects_total} subjects entered`}
                    </span>
                    <span className="h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
                      <span className={cn('block h-full rounded-full', complete ? 'bg-emerald-500' : 'bg-amber-500')} style={{ width: `${r.subjects_total ? (r.subjects_with_marks / r.subjects_total) * 100 : 0}%` }} />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
