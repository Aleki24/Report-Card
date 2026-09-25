"use client";

import React, { Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { isRoleIn } from '@/lib/roles';
import { ClipboardList, PenTool, Trophy, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TAB_TONES } from '@/components/exams-marks/examTheme';
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
    params.delete('term');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const tabs = [
    { id: 'setup' as const, label: 'Enter & Correct Marks', icon: <PenTool size={15} aria-hidden />, roles: ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'] as const },
    { id: 'results' as const, label: 'Results & Reports', icon: <Trophy size={15} aria-hidden />, roles: ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'] as const },
    { id: 'publish' as const, label: 'Release Results', icon: <Send size={15} aria-hidden />, roles: ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'] as const },
  ].filter(t => isRoleIn(role, t.roles));

  // Derive the active tab in render so a role that can't see the current tab
  // falls back to the first available one — no effect / setState needed.
  const activeTab: Tab = tabs.some(t => t.id === tab) ? tab : (tabs[0]?.id ?? 'setup');

  return (
    <div className="w-full max-w-7xl mx-auto pb-10">
      <div className="mb-6 flex items-center gap-3 sm:gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 text-white shadow-md shadow-blue-500/25 sm:size-12" aria-hidden>
          <ClipboardList className="size-5 sm:size-6" />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-[1.25rem] font-bold tracking-tight xs:text-[1.5rem] sm:text-[1.75rem]">Exams & Marks</h1>
          <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">Enter or correct marks, review results, and release them to learners</p>
        </div>
      </div>

      <div role="tablist" aria-label="Exams & Marks" className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-border/70 bg-muted/50 p-1 [scrollbar-width:none] sm:w-fit">
        {tabs.map(t => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => selectTab(t.id)}
              className={cn(
                'flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-2.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-3.5',
                active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <span className={cn('flex size-7 items-center justify-center rounded-lg transition-colors', active ? TAB_TONES[t.id].tile : 'bg-transparent')}>{t.icon}</span>
              {t.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'setup' && <MarksSetupTab />}
      {activeTab === 'results' && <ExamResultsTab />}
      {activeTab === 'publish' && <PublishResultsView />}
    </div>
  );
}
