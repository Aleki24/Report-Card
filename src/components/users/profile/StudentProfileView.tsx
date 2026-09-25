"use client";

import React from 'react';
import {
  AtSign, Award, BookMarked, BookOpen, Cake, CalendarDays, ClipboardCheck, FileText, Hash, Layers, Mail, Phone,
  School, TrendingUp, UserRound, Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserRow } from '@/hooks/useUsersPage';
import type { StudentProfileResponse, TermPerformance } from '@/types/user-profile';
import { ageFrom, formatDate, humanize } from '../userMeta';
import { EmptyNote, InfoGrid, InfoItem, ProfileSection, ScoreBar, StatTile, scoreTone } from './ProfileParts';

export type StudentTab = 'overview' | 'academics' | 'records';

export const STUDENT_TABS: readonly { value: StudentTab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'academics', label: 'Academics' },
  { value: 'records', label: 'Reports & attendance' },
];

/** The most recent term that has any marks recorded. */
function latestTermWithMarks(history: TermPerformance[]): TermPerformance | null {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].subjects.length > 0) return history[i];
  }
  return null;
}

interface StudentProfileViewProps {
  user: UserRow;
  data: StudentProfileResponse;
  tab: StudentTab;
}

export function StudentProfileView({ user, data, tab }: StudentProfileViewProps) {
  const { profile, academicHistory, reportHistory, attendanceHistory } = data;
  const latestTerm = latestTermWithMarks(academicHistory);
  const latestAttendance = attendanceHistory[0] ?? null;
  const latestReport = reportHistory[0] ?? null;

  if (tab === 'academics') {
    return (
      <div className="space-y-4">
        <ProfileSection title="Term performance" icon={TrendingUp}>
          {academicHistory.length === 0 ? (
            <EmptyNote>No terms set up for the current academic year yet.</EmptyNote>
          ) : (
            <ul className="space-y-3">
              {academicHistory.map(term => (
                <li key={term.term_id} className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-3 text-sm">
                  <span className="truncate font-medium">{term.term_name}</span>
                  {term.subjects.length > 0
                    ? <ScoreBar percent={term.average} label={`${term.term_name} average`} />
                    : <span className="text-xs text-muted-foreground">No marks yet</span>}
                  <span className={cn('w-12 text-right font-semibold tabular-nums', term.subjects.length > 0 ? scoreTone(term.average).text : 'text-muted-foreground')}>
                    {term.subjects.length > 0 ? `${term.average}%` : '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ProfileSection>

        <ProfileSection title={latestTerm ? `Subject marks · ${latestTerm.term_name}` : 'Subject marks'} icon={BookOpen}>
          {!latestTerm ? (
            <EmptyNote>No marks have been entered for this student yet.</EmptyNote>
          ) : (
            <ul className="divide-y divide-border/60">
              {latestTerm.subjects.map((s, i) => (
                <li key={`${s.subject_name}-${i}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 py-2.5 sm:grid-cols-[minmax(0,12rem)_1fr_auto]">
                  <span className="truncate text-sm font-medium">{s.subject_name}</span>
                  <span className={cn('text-sm font-semibold tabular-nums sm:order-last', scoreTone(s.percentage).text)}>
                    {Math.round(s.percentage)}%{s.grade_symbol && <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[11px] font-bold text-foreground">{s.grade_symbol}</span>}
                  </span>
                  <div className="col-span-2 sm:col-span-1"><ScoreBar percent={s.percentage} label={`${s.subject_name} score`} /></div>
                </li>
              ))}
            </ul>
          )}
        </ProfileSection>

        <ProfileSection title="Enrolled subjects" icon={BookMarked}>
          {profile.enrolled_subjects.length === 0 ? (
            <EmptyNote>Takes the standard subjects for the class.</EmptyNote>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {profile.enrolled_subjects.map(s => (
                <li key={s.id} className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium', s.role === 'CORE' ? 'border-primary/30 bg-primary/5 text-primary' : 'border-border bg-muted/50')}>
                  {s.name}
                  <span className="text-[10px] font-semibold tracking-wide uppercase opacity-70">{s.role === 'CORE' ? 'Core' : 'Elective'}</span>
                </li>
              ))}
            </ul>
          )}
        </ProfileSection>
      </div>
    );
  }

  if (tab === 'records') {
    return (
      <div className="space-y-4">
        <ProfileSection title="Report cards" icon={FileText}>
          {reportHistory.length === 0 ? (
            <EmptyNote>No report cards have been generated yet.</EmptyNote>
          ) : (
            <ul className="divide-y divide-border/60">
              {reportHistory.map(r => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.term} · {r.year}</p>
                    <p className="text-xs text-muted-foreground">Generated {formatDate(r.generated_at)}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {r.average !== null && <span className={cn('rounded-full bg-muted px-2.5 py-1 font-semibold tabular-nums', scoreTone(r.average).text)}>{Math.round(r.average)}% avg</span>}
                    {r.position !== null && <span className="rounded-full bg-primary/10 px-2.5 py-1 font-semibold text-primary tabular-nums">Position {r.position}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ProfileSection>

        <ProfileSection title="Attendance" icon={ClipboardCheck}>
          {attendanceHistory.length === 0 ? (
            <EmptyNote>No attendance has been recorded on a report card yet.</EmptyNote>
          ) : (
            <ul className="space-y-3">
              {attendanceHistory.map(a => (
                <li key={a.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{a.term} · {a.year}</span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {a.present}/{a.total} days{a.percentage !== null && <span className={cn('ml-2 font-semibold', scoreTone(a.percentage).text)}>{a.percentage}%</span>}
                    </span>
                  </div>
                  {a.percentage !== null && <ScoreBar percent={a.percentage} label={`${a.term} attendance`} />}
                </li>
              ))}
            </ul>
          )}
        </ProfileSection>
      </div>
    );
  }

  const age = ageFrom(profile.date_of_birth);
  const guardianPhone = profile.guardian_phone;
  const guardianEmail = profile.guardian_email;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile icon={TrendingUp} label="Latest average" value={latestTerm ? `${latestTerm.average}%` : '—'} hint={latestTerm?.term_name ?? 'No marks yet'} />
        <StatTile icon={Award} label="Position" value={latestReport?.position ?? '—'} hint={latestReport ? `${latestReport.term} report` : 'No reports yet'} />
        <StatTile icon={ClipboardCheck} label="Attendance" value={latestAttendance?.percentage != null ? `${latestAttendance.percentage}%` : '—'} hint={latestAttendance ? latestAttendance.term : 'Not recorded'} />
        <StatTile icon={BookOpen} label="Subjects" value={profile.enrolled_subjects.length || latestTerm?.subjects.length || '—'} hint={profile.enrolled_subjects.length ? 'Enrolled' : 'With marks this term'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <ProfileSection title="Personal details" icon={UserRound} className="lg:col-span-3">
          <InfoGrid>
            <InfoItem icon={Hash} label="Admission no." value={profile.admission_number} copyValue={profile.admission_number} />
            <InfoItem icon={AtSign} label="Username" value={user.username} copyValue={user.username} />
            <InfoItem icon={UserRound} label="Gender" value={profile.gender ? humanize(profile.gender) : null} />
            <InfoItem icon={Cake} label="Date of birth" value={profile.date_of_birth ? `${formatDate(profile.date_of_birth)}${age !== null ? ` · ${age} yrs` : ''}` : null} />
            <InfoItem icon={CalendarDays} label="Enrolled" value={profile.date_enrolled ? formatDate(profile.date_enrolled) : null} />
            <InfoItem icon={Layers} label="Enrolment status" value={humanize(profile.status)} />
            <InfoItem icon={Phone} label="Phone" value={profile.phone} href={profile.phone ? `tel:${profile.phone}` : undefined} />
            <InfoItem icon={Mail} label="Email" value={profile.email} href={profile.email ? `mailto:${profile.email}` : undefined} />
          </InfoGrid>
        </ProfileSection>

        <div className="space-y-4 lg:col-span-2">
          <ProfileSection title="Class & curriculum" icon={School}>
            <dl className="grid gap-4">
              <InfoItem icon={School} label="Class" value={profile.grade_stream?.full_name} />
              <InfoItem icon={Layers} label="Level" value={profile.academic_level?.name} />
              {(profile.pathway || profile.subject_combination) && (
                <InfoItem
                  icon={BookMarked}
                  label="Pathway"
                  value={[profile.pathway && humanize(profile.pathway), profile.track && humanize(profile.track), profile.subject_combination?.name].filter(Boolean).join(' · ')}
                />
              )}
            </dl>
          </ProfileSection>

          <ProfileSection title="Parent / guardian" icon={Users}>
            {!profile.guardian_name && !guardianPhone && !guardianEmail ? (
              <EmptyNote>No guardian details on record.</EmptyNote>
            ) : (
              <div className="space-y-3">
                <p className="font-semibold">{profile.guardian_name || 'Guardian'}</p>
                <dl className="grid gap-3">
                  <InfoItem icon={Phone} label="Phone" value={guardianPhone} href={guardianPhone ? `tel:${guardianPhone}` : undefined} copyValue={guardianPhone} />
                  <InfoItem icon={Mail} label="Email" value={guardianEmail} href={guardianEmail ? `mailto:${guardianEmail}` : undefined} />
                </dl>
                {guardianPhone && (
                  <a href={`tel:${guardianPhone}`} className="btn-secondary h-9 w-full text-xs">
                    <Phone className="size-3.5" aria-hidden="true" />Call guardian
                  </a>
                )}
              </div>
            )}
          </ProfileSection>
        </div>
      </div>
    </div>
  );
}
