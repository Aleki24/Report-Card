"use client";

import React from 'react';
import { Card, CardContent, Select, Input } from '@/components/ui';
import { Filter, CheckCircle2 } from 'lucide-react';
import { REPORT_TEMPLATES, isReportTemplateId, type ReportTemplateId } from '@/lib/pdf/templateMeta';

interface ReportSettingsProps {
  selectedAcademicYear: string; setSelectedAcademicYear: (v: string) => void;
  selectedTerm: string; setSelectedTerm: (v: string) => void;
  selectedGradeStream: string; setSelectedGradeStream: (v: string) => void;
  customReportTitle: string; setCustomReportTitle: (v: string) => void;
  selectedTemplate: ReportTemplateId; setSelectedTemplate: (v: ReportTemplateId) => void;
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
  academicYears, terms, gradeStreams,
}: ReportSettingsProps) {
  const isReady = !!(selectedAcademicYear && selectedTerm && selectedGradeStream);
  return (
    <Card className="mb-6">
      <CardContent className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-primary" />
            <h3 className="text-[15px] font-semibold font-display">① Report Scope</h3>
          </div>
          {isReady ? (
            <span className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <CheckCircle2 className="h-3.5 w-3.5" /> Ready — pick an action below
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Select year, term &amp; class to unlock actions</span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Academic Year <span className="text-red-500">*</span></label>
            <Select className="w-full h-9 text-sm" value={selectedAcademicYear} onChange={e => setSelectedAcademicYear(e.target.value)}>
              <option value="">-- Choose Year --</option>
              {academicYears.map(ay => <option key={ay.id} value={ay.id}>{ay.name}</option>)}
            </Select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Term <span className="text-red-500">*</span></label>
            <Select className="w-full h-9 text-sm" value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)}>
              <option value="">-- Choose Term --</option>
              {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Grade Stream <span className="text-red-500">*</span></label>
            <Select className="w-full h-9 text-sm" value={selectedGradeStream} onChange={e => setSelectedGradeStream(e.target.value)}>
              <option value="">-- Choose Stream --</option>
              {gradeStreams.map(gs => <option key={gs.id} value={gs.id}>{gs.full_name}</option>)}
            </Select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Custom Title (Optional)</label>
            <Input className="w-full h-9 text-sm" placeholder="e.g. Mid Term 1 Report" value={customReportTitle} onChange={e => setCustomReportTitle(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Card Design</label>
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
      </CardContent>
    </Card>
  );
}
