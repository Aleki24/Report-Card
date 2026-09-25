"use client";

import React, { Suspense, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { GraduationCap, Heart, Users, type LucideIcon } from 'lucide-react';
import PageHeader from '@/components/dashboard/PageHeader';
import { ContentSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { useAuth } from '@/components/AuthProvider';
import { TONES, type Hue } from '@/components/ui/tones';
import { StudentsSection } from '@/components/people/StudentsSection';
import { StaffSection } from '@/components/people/StaffSection';
import { ParentsSection } from '@/components/people/ParentsSection';
import { isRoleIn } from '@/lib/roles';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types';

type PeopleTab = 'students' | 'teachers' | 'parents';

const TABS: readonly { id: PeopleTab; label: string; icon: LucideIcon; hue: Hue; roles: readonly UserRole[] }[] = [
  { id: 'students', label: 'Students', icon: Users, hue: 'orange', roles: ['ADMIN', 'CLASS_TEACHER'] },
  { id: 'teachers', label: 'Staff', icon: GraduationCap, hue: 'blue', roles: ['ADMIN'] },
  { id: 'parents', label: 'Parents', icon: Heart, hue: 'rose', roles: ['ADMIN'] },
];

export default function PeoplePage() {
  return (
    <Suspense fallback={<ContentSkeleton />}>
      <PeoplePageInner />
    </Suspense>
  );
}

function PeoplePageInner() {
  const { role } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const tabs = TABS.filter(t => isRoleIn(role, t.roles));
  const requested = searchParams.get('tab');
  // A tab this role cannot see (e.g. ?tab=parents for a class teacher) falls back to the first allowed one.
  const active = tabs.find(t => t.id === requested) ?? tabs[0];

  // The tab lives in the URL, so a refresh or a shared link opens the same one.
  const select = (id: PeopleTab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', id);
    params.delete('search');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + tabs.length) % tabs.length;
    tabRefs.current[next]?.focus();
    select(tabs[next].id);
  };

  return (
    <div className="mx-auto w-full max-w-7xl pb-10">
      <PageHeader
        title="People"
        eyebrow="School"
        icon={Users}
        hue="orange"
        description="Students, staff and parent contacts. Open anyone for their full profile."
      />

      {tabs.length > 1 && (
        <div role="tablist" aria-label="People" className="mb-6 grid grid-cols-3 gap-1 rounded-2xl border border-border/70 bg-muted/40 p-1 sm:inline-grid sm:w-auto sm:grid-flow-col sm:auto-cols-fr">
          {tabs.map((t, i) => {
            const selected = active?.id === t.id;
            return (
              <button
                key={t.id}
                ref={el => { tabRefs.current[i] = el; }}
                type="button"
                role="tab"
                id={`people-tab-${t.id}`}
                aria-selected={selected}
                aria-controls="people-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => select(t.id)}
                onKeyDown={e => onKeyDown(e, i)}
                className={cn(
                  'flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-5',
                  selected ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:bg-card/60 hover:text-foreground',
                )}
              >
                <span className={cn('flex size-6 items-center justify-center rounded-lg transition-colors', selected ? TONES[t.hue].tile : 'text-current')} aria-hidden>
                  <t.icon className="size-4" />
                </span>
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      <div role={tabs.length > 1 ? 'tabpanel' : undefined} id="people-panel" aria-labelledby={active && tabs.length > 1 ? `people-tab-${active.id}` : undefined}>
        {active?.id === 'students' && <StudentsSection initialSearch={searchParams.get('search') ?? ''} />}
        {active?.id === 'teachers' && <StaffSection />}
        {active?.id === 'parents' && <ParentsSection />}
      </div>
    </div>
  );
}
