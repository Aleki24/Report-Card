"use client";

import React from 'react';
import {
  AtSign, BookOpen, Briefcase, CalendarDays, ClipboardCheck, FileText, GraduationCap, Mail, Phone, School, ShieldCheck,
  UserRound,
} from 'lucide-react';
import type { UserRow } from '@/hooks/useUsersPage';
import type { StaffProfileResponse } from '@/types/user-profile';
import { TEACHER_ROLES, isRoleIn } from '@/lib/roles';
import { ROLE_META, formatDate, humanize } from '../userMeta';
import { EmptyNote, InfoGrid, InfoItem, ProfileSection, StatTile } from './ProfileParts';

export type StaffTab = 'overview' | 'teaching' | 'activity';

const TEACHER_TABS: readonly { value: StaffTab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'teaching', label: 'Classes & subjects' },
  { value: 'activity', label: 'Recent exams' },
];

/** Only teachers have assignments and exams to show; everyone else gets the overview alone. */
export function staffTabsFor(user: UserRow): readonly { value: StaffTab; label: string }[] {
  return isRoleIn(user.role, TEACHER_ROLES) ? TEACHER_TABS : [];
}

interface StaffProfileViewProps {
  user: UserRow;
  data: StaffProfileResponse;
  tab: StaffTab;
}

export function StaffProfileView({ user, data, tab }: StaffProfileViewProps) {
  const { profile, classAssignments, subjectAssignments, recentExams, stats } = data;
  const isTeacher = isRoleIn(user.role, TEACHER_ROLES);
  const phone = profile.phone && profile.phone !== '—' ? profile.phone : null;

  if (tab === 'teaching') {
    return (
      <div className="space-y-4">
        <ProfileSection title="Class teacher of" icon={School}>
          {classAssignments.length === 0 ? (
            <EmptyNote>Not a class teacher for any class.</EmptyNote>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {classAssignments.map(c => (
                <li key={c.id} className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-medium text-primary">
                  <School className="size-4" aria-hidden="true" />
                  {c.stream}
                  <span className="text-xs font-normal text-muted-foreground">{c.year}</span>
                </li>
              ))}
            </ul>
          )}
        </ProfileSection>

        <ProfileSection title="Subjects taught" icon={BookOpen}>
          {subjectAssignments.length === 0 ? (
            <EmptyNote>No subjects assigned yet.</EmptyNote>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {subjectAssignments.map((s, i) => (
                <li key={`${s.subject_code}-${s.grade}-${s.stream ?? 'all'}-${i}`} className="flex min-w-0 items-center gap-3 rounded-xl border border-border/70 p-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-[11px] font-bold text-violet-600 dark:text-violet-400">
                    {(s.subject_code || s.subject).slice(0, 4).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{s.subject}</p>
                    <p className="truncate text-xs text-muted-foreground">{s.stream ?? `${s.grade} · all streams`} · {s.year}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ProfileSection>
      </div>
    );
  }

  if (tab === 'activity') {
    return (
      <ProfileSection title="Recent exams created" icon={FileText}>
        {recentExams.length === 0 ? (
          <EmptyNote>No exams created yet.</EmptyNote>
        ) : (
          <ul className="divide-y divide-border/60">
            {recentExams.map(e => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{e.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{e.subject} · {e.grade}</p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-muted px-2.5 py-1 font-medium">{humanize(e.type)}</span>
                  <span className="text-muted-foreground">{formatDate(e.date)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ProfileSection>
    );
  }

  return (
    <div className="space-y-4">
      {isTeacher && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile icon={School} label="Classes" value={stats.classCount} hint="As class teacher" />
          <StatTile icon={BookOpen} label="Subjects" value={stats.subjectCount} hint="Assignments" />
          <StatTile icon={FileText} label="Exams" value={stats.examCount} hint="Recently created" />
          <StatTile icon={ClipboardCheck} label="Marks" value={stats.markCount.toLocaleString()} hint="Entered" />
        </div>
      )}

      <ProfileSection title="Contact & account" icon={UserRound}>
        <InfoGrid>
          {user.username && <InfoItem icon={AtSign} label="Username" value={user.username} copyValue={user.username} />}
          <InfoItem icon={Mail} label="Email" value={profile.email} href={profile.email ? `mailto:${profile.email}` : undefined} copyValue={profile.email} />
          <InfoItem icon={Phone} label="Phone" value={phone} href={phone ? `tel:${phone}` : undefined} copyValue={phone} />
          <InfoItem icon={isTeacher ? GraduationCap : ShieldCheck} label="Role" value={ROLE_META[profile.role].label} />
          {profile.job_title && <InfoItem icon={Briefcase} label="Job title" value={profile.job_title} />}
          <InfoItem icon={CalendarDays} label="Joined" value={formatDate(profile.created_at)} />
        </InfoGrid>
      </ProfileSection>
    </div>
  );
}
