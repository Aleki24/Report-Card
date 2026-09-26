"use client";

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { GraduationCap, Heart, Users } from 'lucide-react';
import PageHeader from '@/components/dashboard/PageHeader';
import { ContentSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { useAuth } from '@/components/AuthProvider';
import { PageTabs, useUrlTab, type PageTab } from '@/components/ui/PageTabs';
import { StudentsSection } from '@/components/people/StudentsSection';
import { StaffSection } from '@/components/people/StaffSection';
import { ParentsSection } from '@/components/people/ParentsSection';
import { isRoleIn } from '@/lib/roles';
import type { UserRole } from '@/types';

type PeopleTab = 'students' | 'teachers' | 'parents';

const TABS: readonly (PageTab<PeopleTab> & { roles: readonly UserRole[] })[] = [
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
  const searchParams = useSearchParams();
  const tabs = TABS.filter(t => isRoleIn(role, t.roles));
  // A tab this role cannot see (e.g. ?tab=parents for a class teacher) falls back to the first allowed one.
  const [active, select] = useUrlTab(tabs);
  // A class teacher sees only their class's learners, so the page is theirs.
  const isClassTeacher = role === 'CLASS_TEACHER';

  return (
    <div className="mx-auto w-full max-w-7xl pb-10">
      <PageHeader
        title={isClassTeacher ? 'My students' : 'People'}
        eyebrow={isClassTeacher ? 'My class' : 'School'}
        icon={Users}
        hue="orange"
        description={isClassTeacher
          ? 'The learners in your class, with their guardians. Open anyone for their full profile.'
          : 'Students, staff and parent contacts. Open anyone for their full profile.'}
      />

      {tabs.length > 1 && <PageTabs tabs={tabs} active={active} onSelect={select} label="People" idPrefix="people" />}

      <div role={tabs.length > 1 ? 'tabpanel' : undefined} id="people-panel" aria-labelledby={active && tabs.length > 1 ? `people-tab-${active}` : undefined}>
        {active === 'students' && <StudentsSection initialSearch={searchParams.get('search') ?? ''} />}
        {active === 'teachers' && <StaffSection />}
        {active === 'parents' && <ParentsSection />}
      </div>
    </div>
  );
}
