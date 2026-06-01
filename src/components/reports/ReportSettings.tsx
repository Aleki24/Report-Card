"use client";

import React from 'react';
import { Card, CardContent, Select, Input } from '@/components/ui';
import { Filter, BookOpen, GraduationCap, CalendarDays } from 'lucide-react';

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
    <Card className="mb-6">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-primary" />
          <h3 className="text-[15px] font-semibold font-display">Report Settings</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
        </div>
      </CardContent>
    </Card>
  );
}
