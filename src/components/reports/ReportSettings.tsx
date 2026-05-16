"use client";

import React from 'react';

interface ReportSettingsProps {
  selectedAcademicYear: string; setSelectedAcademicYear: (v: string) => void;
  selectedTerm: string; setSelectedTerm: (v: string) => void;
  selectedGradeStream: string; setSelectedGradeStream: (v: string) => void;
  customReportTitle: string; setCustomReportTitle: (v: string) => void;
  academicYears: { id: string; name: string }[];
  terms: { id: string; name: string }[];
  gradeStreams: { id: string; full_name: string }[];
}

export function ReportSettings({
  selectedAcademicYear, setSelectedAcademicYear,
  selectedTerm, setSelectedTerm,
  selectedGradeStream, setSelectedGradeStream,
  customReportTitle, setCustomReportTitle,
  academicYears, terms, gradeStreams,
}: ReportSettingsProps) {
  return (
    <div className="card glass-panel mb-8 relative z-10" style={{ marginTop: '-2rem' }}>
      <h3 className="text-lg font-bold font-[family-name:var(--font-display)] mb-4">Report Global Settings</h3>
      <p className="text-sm text-muted-foreground mb-6 -mt-2">Filter and apply these settings to generate individual or bulk report cards.</p>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Academic Year <span className="text-red-500">*</span></label>
          <select className="input-field w-full" value={selectedAcademicYear} onChange={e => setSelectedAcademicYear(e.target.value)} suppressHydrationWarning>
            <option value="">-- Choose Year --</option>
            {academicYears.map(ay => <option key={ay.id} value={ay.id}>{ay.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Term <span className="text-red-500">*</span></label>
          <select className="input-field w-full" value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)} suppressHydrationWarning>
            <option value="">-- Choose Term --</option>
            {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Grade Stream <span className="text-red-500">*</span></label>
          <select className="input-field w-full" value={selectedGradeStream} onChange={e => setSelectedGradeStream(e.target.value)} suppressHydrationWarning>
            <option value="">-- Choose Stream --</option>
            {gradeStreams.map(gs => <option key={gs.id} value={gs.id}>{gs.full_name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Custom Title (Optional)</label>
          <input className="input-field w-full" placeholder="e.g. Mid Term 1 Report" value={customReportTitle} onChange={e => setCustomReportTitle(e.target.value)} suppressHydrationWarning />
        </div>
      </div>
    </div>
  );
}
