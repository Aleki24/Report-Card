"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { PenTool, Trophy, Calendar } from 'lucide-react';
import { MarksSetupTab } from '@/components/exams-marks/MarksSetupTab';
import { ExamResultsTab } from '@/components/exams-marks/ExamResultsTab';

type Tab = 'setup' | 'results';

export default function ExamsMarksPage() {
  const { role } = useAuth();
  const [tab, setTab] = useState<Tab>('setup');

  const tabs = [
    { id: 'setup' as const, label: 'Mark Entry & Setup', icon: <PenTool size={16} />, roles: ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'] as const },
    { id: 'results' as const, label: 'Results & Reports', icon: <Trophy size={16} />, roles: ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'] as const },
  ].filter(t => t.roles.includes(role as any));

  useEffect(() => {
    if (tabs.length > 0 && !tabs.find(t => t.id === tab)) setTab(tabs[0].id);
  }, [role]);

  return (
    <div className="w-full max-w-7xl mx-auto pb-10">
      <div className="mb-6">
        <h1 className="text-[1.25rem] xs:text-[1.5rem] sm:text-[1.75rem] font-bold tracking-tight font-display mb-1">Exams & Marks</h1>
        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>Manage exam schedules, enter marks, and view results</p>
      </div>

      <div className="flex gap-1 mb-6 p-1 bg-muted/50 border border-border rounded-lg w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${tab === t.id ? 'bg-[var(--color-surface)] text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'setup' && <MarksSetupTab />}
      {tab === 'results' && <ExamResultsTab />}
    </div>
  );
}
