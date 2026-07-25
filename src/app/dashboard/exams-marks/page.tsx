"use client";

import React, { Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { PenTool, Trophy, Send } from 'lucide-react';
import { ContentSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { MarksSetupTab } from '@/components/exams-marks/MarksSetupTab';
import { ExamResultsTab } from '@/components/exams-marks/ExamResultsTab';
import { PublishResultsView } from '@/components/exams-marks/PublishResultsView';

type Tab = 'setup' | 'results' | 'publish';

const parseTab = (t: string | null): Tab | null =>
  t === 'results' || t === 'publish' || t === 'setup' ? t : null;

export default function ExamsMarksPage() {
  return (
    <Suspense fallback={<ContentSkeleton />}>
      <ExamsMarksPageInner />
    </Suspense>
  );
}

function ExamsMarksPageInner() {
  const { role } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // The tab lives in the URL rather than in state. Deep links between tabs are
  // same-route client navigations that never remount this page — the admin
  // dashboard's "results awaiting approval" banner opens the Publish tab, and
  // the Publish tab's "Review marks" link jumps to the Results tab for one
  // exam — so reading the URL every render is what keeps those in sync.
  const tab: Tab = parseTab(searchParams.get('tab')) ?? 'setup';

  const selectTab = (id: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', id);
    // Leave a deep link's exam selection behind when the tab is switched by hand.
    params.delete('stream');
    params.delete('exam');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const tabs = [
    { id: 'setup' as const, label: 'Mark Entry & Setup', icon: <PenTool size={16} />, roles: ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'] as const },
    { id: 'results' as const, label: 'Results & Reports', icon: <Trophy size={16} />, roles: ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'] as const },
    { id: 'publish' as const, label: 'Publish Results', icon: <Send size={16} />, roles: ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'] as const },
  ].filter(t => t.roles.includes(role as any));

  // Derive the active tab in render so a role that can't see the current tab
  // falls back to the first available one — no effect / setState needed.
  const activeTab: Tab = tabs.some(t => t.id === tab) ? tab : (tabs[0]?.id ?? 'setup');

  return (
    <div className="w-full max-w-7xl mx-auto pb-10">
      <div className="mb-6">
        <h1 className="text-[1.25rem] xs:text-[1.5rem] sm:text-[1.75rem] font-bold tracking-tight font-display mb-1">Exams & Marks</h1>
        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>Manage exam schedules, enter marks, and view results</p>
      </div>

      <div className="flex flex-wrap gap-1 mb-6 p-1 bg-muted/50 border border-border rounded-lg w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => selectTab(t.id)} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === t.id ? 'bg-[var(--color-surface)] text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'setup' && <MarksSetupTab />}
      {activeTab === 'results' && <ExamResultsTab />}
      {activeTab === 'publish' && <PublishResultsView />}
    </div>
  );
}
