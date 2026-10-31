"use client";

import React, { Suspense, useMemo } from 'react';
import { BarChart3, ClipboardCheck, LayoutGrid } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/dashboard/PageHeader';
import { useAuth } from '@/components/AuthProvider';
import { PageTabs, useUrlTab, type PageTab } from '@/components/ui/PageTabs';
import { FEATURE_ICONS } from '@/components/ui/featureIcons';
import { RegisterView } from '@/components/attendance/RegisterView';
import { ReportsView } from '@/components/attendance/ReportsView';
import { TodayView } from '@/components/attendance/TodayView';
import { useAttendanceRegister } from '@/hooks/useAttendanceRegister';
import { cn } from '@/lib/utils';

type AttendanceTab = 'register' | 'today' | 'reports';

const TABS: readonly PageTab<AttendanceTab>[] = [
  { id: 'register', label: 'Register', icon: ClipboardCheck, hue: 'teal' },
  { id: 'today', label: 'Whole school', shortLabel: 'School', icon: LayoutGrid, hue: 'blue' },
  { id: 'reports', label: 'Reports', icon: BarChart3, hue: 'violet' },
];

export default function AttendancePage() {
  return (
    <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-2xl bg-muted/40" aria-hidden="true" />}>
      <AttendancePageInner />
    </Suspense>
  );
}

function AttendancePageInner() {
  const { role } = useAuth();
  // The school-wide day is the admin's; a class teacher sees their own class on the register.
  const tabs = useMemo(() => TABS.filter(t => t.id !== 'today' || role === 'ADMIN'), [role]);
  const [tab, selectTab] = useUrlTab(tabs);
  // Held here so marks survive a look at another tab.
  const register = useAttendanceRegister();

  const openRegister = (streamId: string, date: string) => {
    if (register.isDirty && (streamId !== register.streamId || date !== register.date)) {
      toast.info('Save or undo the marks on the open register first.');
    } else {
      register.setStreamId(streamId);
      register.setDate(date);
    }
    selectTab('register');
  };

  return (
    // The register's save bar sticks to the bottom on phones: leave room for it.
    <div className={cn('mx-auto w-full max-w-5xl', tab === 'register' && 'pb-36 min-[768px]:pb-4')}>
      <PageHeader
        title="Attendance"
        eyebrow="Academics"
        icon={FEATURE_ICONS.attendance}
        hue="teal"
        description="Take the daily register, see who is away across the school and follow up learners who miss often."
      />
      <PageTabs tabs={tabs} active={tab} onSelect={selectTab} label="Attendance views" idPrefix="attendance" />
      <div role="tabpanel" id="attendance-panel" aria-labelledby={`attendance-tab-${tab}`}>
        {tab === 'register' && <RegisterView register={register} />}
        {tab === 'today' && <TodayView onOpen={openRegister} />}
        {tab === 'reports' && <ReportsView key={register.streams.length} streams={register.streams} initialStreamId={register.streamId} />}
      </div>
    </div>
  );
}
