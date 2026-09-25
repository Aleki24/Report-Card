"use client";

import PageHeader from '@/components/dashboard/PageHeader';
import React, { useCallback, useMemo, useState } from 'react';
import {
  CalendarCheck, CheckCheck, ChevronLeft, ChevronRight, CircleDashed, Clock, Download, FileCheck2, MessageSquare,
  RotateCcw, Save, Search, TrendingUp, UserCheck, UserX, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog, StatTile } from '@/components/ui';
import { InlineLoadingSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { RegisterRow } from '@/components/attendance/RegisterRow';
import { STATUS_STYLES } from '@/components/attendance/statusStyles';
import { useAttendanceRegister } from '@/hooks/useAttendanceRegister';
import { downloadBlob } from '@/lib/download';
import { addDays, formatIsoDate, localIsoDate } from '@/lib/dates';
import { cn } from '@/lib/utils';
import {
  ATTENDANCE_LABELS, ATTENDANCE_STATUSES, attendanceRate, countAttendance, type AttendanceStatus,
} from '@/lib/attendance';

type StatusFilter = 'all' | 'unmarked' | AttendanceStatus;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** A change of class or day waiting on "discard unsaved marks?". */
type PendingSwitch = { streamId: string; date: string } | null;

export default function AttendancePage() {
  const register = useAttendanceRegister();
  const {
    streamsState, streams, streamId, date, entries, loading, loadError, dirtyIds, isDirty, saving,
  } = register;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [pendingSwitch, setPendingSwitch] = useState<PendingSwitch>(null);
  const [confirmNotify, setConfirmNotify] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const today = localIsoDate();
  const isToday = date === today;
  const streamName = streams.find(s => s.id === streamId)?.full_name ?? '';
  const dateLabel = formatIsoDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const counts = useMemo(() => countAttendance(entries.map(e => e.status)), [entries]);
  const rate = attendanceRate(counts);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => {
        if (statusFilter === 'unmarked' ? entry.status !== null : statusFilter !== 'all' && entry.status !== statusFilter) return false;
        return !q || entry.name.toLowerCase().includes(q) || entry.admission_number.toLowerCase().includes(q);
      });
  }, [entries, search, statusFilter]);

  /** Switching class or day drops unsaved marks, so ask first when there are any. */
  const requestSwitch = useCallback((next: { streamId?: string; date?: string }) => {
    const target = { streamId: next.streamId ?? streamId, date: next.date ?? date };
    if (target.streamId === streamId && target.date === date) return;
    if (isDirty) { setPendingSwitch(target); return; }
    register.setStreamId(target.streamId);
    register.setDate(target.date);
    setStatusFilter('all');
  }, [streamId, date, isDirty, register]);

  const confirmSwitch = () => {
    if (!pendingSwitch) return;
    register.revertAll();
    register.setStreamId(pendingSwitch.streamId);
    register.setDate(pendingSwitch.date);
    setStatusFilter('all');
    setPendingSwitch(null);
  };

  const handleSave = async () => {
    try {
      const count = await register.save();
      if (count === 0) return;
      const left = counts.unmarked;
      toast.success(`Saved attendance for ${plural(count, 'student')}.`, {
        description: left > 0 ? `${plural(left, 'student')} still unmarked.` : undefined,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save attendance.');
    }
  };

  const handleNotify = async () => {
    setNotifying(true);
    try {
      const { sent, failed, skipped, alreadyNotified } = await register.notifyGuardians();
      const parts = [
        sent > 0 && `${sent} sent`,
        alreadyNotified > 0 && `${alreadyNotified} already notified`,
        skipped > 0 && `${skipped} without a guardian phone`,
        failed > 0 && `${failed} failed`,
      ].filter((p): p is string => !!p);
      if (parts.length === 0) toast('No absent students to notify for this day.');
      else if (failed > 0) toast.error(`Guardian SMS: ${parts.join(', ')}.`, { description: 'Check the numbers on the students’ profiles and try again.' });
      else toast.success(`Guardian SMS: ${parts.join(', ')}.`);
      setConfirmNotify(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not notify guardians.');
    } finally {
      setNotifying(false);
    }
  };

  const handleDownloadPdf = async () => {
    setGeneratingPdf(true);
    try {
      const { renderAttendancePdf } = await import('@/components/attendance/AttendancePdf');
      const blob = await renderAttendancePdf({ students: entries, date, className: streamName });
      downloadBlob(blob, `Attendance_${streamName.replace(/\s+/g, '_')}_${date}.pdf`);
    } catch (err) {
      toast.error(`Could not create the PDF: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setGeneratingPdf(false);
    }
  };

  const filterOptions: { value: StatusFilter; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: counts.total },
    { value: 'unmarked', label: 'Unmarked', count: counts.unmarked },
    ...ATTENDANCE_STATUSES.map(s => ({ value: s, label: ATTENDANCE_LABELS[s], count: counts[s] })),
  ];

  return (
    <div className="mx-auto w-full max-w-5xl pb-36 min-[768px]:pb-4">
      <PageHeader
        title="Attendance"
        eyebrow="Academics"
        icon={CalendarCheck}
        hue="teal"
        description="Take the daily register, add reasons for absence and let guardians know."
      />

      {/* ── Class and day ─────────────────────────────── */}
      <section aria-label="Class and day" className="mb-4 grid gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm sm:p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="min-w-0">
          <label htmlFor="attendance-class" className="mb-1.5 block text-xs font-semibold text-muted-foreground">Class</label>
          {streamsState.state === 'error' ? (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <span className="min-w-0 truncate">{streamsState.message}</span>
              <button type="button" onClick={() => void register.loadStreams()} className="btn-secondary h-8 shrink-0 px-3 text-xs">Retry</button>
            </div>
          ) : (
            <select
              id="attendance-class"
              className="input-field w-full"
              value={streamId}
              disabled={streamsState.state === 'loading' || streams.length === 0}
              onChange={e => requestSwitch({ streamId: e.target.value })}
            >
              <option value="">
                {streamsState.state === 'loading' ? 'Loading classes…' : streams.length === 0 ? 'No classes assigned to you' : 'Select a class'}
              </option>
              {streams.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          )}
        </div>

        <div className="min-w-0">
          <label htmlFor="attendance-date" className="mb-1.5 block text-xs font-semibold text-muted-foreground">Day</label>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => requestSwitch({ date: addDays(date, -1) })} aria-label="Previous day" className="btn-secondary size-11 shrink-0 px-0">
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <input
              id="attendance-date"
              type="date"
              className="input-field min-w-0 flex-1 md:w-44 md:flex-none"
              value={date}
              max={today}
              onChange={e => { if (e.target.value) requestSwitch({ date: e.target.value > today ? today : e.target.value }); }}
            />
            <button type="button" onClick={() => requestSwitch({ date: addDays(date, 1) })} disabled={date >= today} aria-label="Next day" className="btn-secondary size-11 shrink-0 px-0 disabled:pointer-events-none disabled:opacity-40">
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => requestSwitch({ date: today })} disabled={isToday} className="btn-secondary h-11 shrink-0 px-3 disabled:pointer-events-none disabled:opacity-40">
              Today
            </button>
          </div>
        </div>
      </section>

      {!streamId ? (
        <EmptyState
          icon={CalendarCheck}
          title={streamsState.state === 'ready' && streams.length === 0 ? 'No class to take attendance for' : 'Select a class to begin'}
          body={streamsState.state === 'ready' && streams.length === 0
            ? 'Registers are kept by admins and by each class’s own class teacher. Ask an admin to make you class teacher of your class.'
            : 'Choose a class and a day to view or take the register.'}
        />
      ) : loading ? (
        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm"><InlineLoadingSkeleton rows={6} /></div>
      ) : loadError ? (
        <EmptyState icon={X} title="Couldn’t load the register" body={loadError} action={<button type="button" onClick={register.reload} className="btn-primary"><RotateCcw className="size-4" aria-hidden="true" />Try again</button>} />
      ) : entries.length === 0 ? (
        <EmptyState icon={UserX} title="No students in this class" body="Only active students placed in this class appear on its register." />
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 className="text-base font-bold text-foreground">
              {streamName} <span className="font-medium text-muted-foreground">· {dateLabel}</span>
            </h2>
            {!isToday && <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">Past day</span>}
          </div>

          {/* ── Summary ─────────────────────────────────── */}
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatTile icon={UserCheck} hue="emerald" label="Present" value={counts.present} />
            <StatTile icon={UserX} hue="rose" label="Absent" value={counts.absent} tone={counts.absent > 0 ? 'bad' : 'default'} />
            <StatTile icon={Clock} hue="amber" label="Late" value={counts.late} tone={counts.late > 0 ? 'warn' : 'default'} />
            <StatTile icon={FileCheck2} hue="sky" label="Excused" value={counts.excused} />
            <StatTile
              icon={TrendingUp}
              label="Attendance"
              value={rate === null ? '—' : `${rate}%`}
              tone={rate === null ? 'default' : rate >= 80 ? 'good' : rate >= 60 ? 'warn' : 'bad'}
              hint={counts.unmarked > 0 ? `${counts.unmarked} unmarked` : 'Everyone marked'}
              className="col-span-2 sm:col-span-1"
            />
          </div>

          {/* Present, late, excused, absent, unmarked: keeps green and red apart for CVD readability. */}
          <div
            className="mb-4 flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`${counts.present} present, ${counts.late} late, ${counts.excused} excused, ${counts.absent} absent, ${counts.unmarked} unmarked`}
          >
            {(['present', 'late', 'excused', 'absent'] as const).map(s => counts[s] > 0 && (
              <div key={s} className={STATUS_STYLES[s].bar} style={{ width: `${(counts[s] / counts.total) * 100}%` }} />
            ))}
          </div>

          {/* ── Tools ───────────────────────────────────── */}
          <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name or admission no."
                aria-label="Search students"
                className="input-field input-icon-left w-full"
              />
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex sm:flex-wrap">
              <button type="button" onClick={register.markUnmarkedPresent} disabled={counts.unmarked === 0} className="btn-secondary col-span-2 disabled:pointer-events-none disabled:opacity-50 sm:col-span-1">
                <CheckCheck className="size-4" aria-hidden="true" />
                {counts.unmarked > 0 ? `Mark ${counts.unmarked} unmarked present` : 'All marked'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmNotify(true)}
                disabled={counts.absent === 0 || isDirty}
                title={isDirty ? 'Save your changes before notifying guardians' : counts.absent === 0 ? 'No one is marked absent' : 'Text the guardians of absent students'}
                className="btn-secondary disabled:pointer-events-none disabled:opacity-50"
              >
                <MessageSquare className="size-4" aria-hidden="true" />Notify guardians
              </button>
              <button type="button" onClick={handleDownloadPdf} disabled={generatingPdf} className="btn-secondary disabled:pointer-events-none disabled:opacity-50">
                <Download className="size-4" aria-hidden="true" />{generatingPdf ? 'Preparing…' : 'PDF'}
              </button>
            </div>
          </div>

          <div role="group" aria-label="Show students" className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {filterOptions.map(opt => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={statusFilter === opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={cn(
                  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  statusFilter === opt.value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground',
                )}
              >
                {opt.value === 'unmarked' && <CircleDashed className="size-3.5" aria-hidden="true" />}
                {opt.label}
                <span className="tabular-nums opacity-80">{opt.count}</span>
              </button>
            ))}
          </div>

          {/* ── Register ────────────────────────────────── */}
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
            {visible.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                {search.trim() ? <>No students match &ldquo;{search.trim()}&rdquo;.</> : 'No students in this group.'}
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {visible.map(({ entry, index }) => (
                  <RegisterRow
                    key={entry.id}
                    entry={entry}
                    index={index}
                    dirty={dirtyIds.has(entry.id)}
                    onStatus={register.setStatus}
                    onNote={register.setNote}
                    onRevert={register.revert}
                  />
                ))}
              </ul>
            )}
          </div>

          {/* ── Save bar ────────────────────────────────── */}
          {/* Phones: fixed above the bottom navigation (the page itself does not
              scroll there). Desktop: sticks to the bottom of the scrolling main. */}
          <div className="fixed inset-x-3 bottom-[calc(72px+env(safe-area-inset-bottom))] z-40 min-[768px]:sticky min-[768px]:inset-x-auto min-[768px]:bottom-3 min-[768px]:mt-4">
            <div className={cn(
              'flex items-center justify-between gap-3 rounded-2xl border bg-card/95 px-3 py-2.5 shadow-lg backdrop-blur sm:px-4',
              isDirty ? 'border-amber-500/40' : 'border-border/70',
            )}>
              <p className="min-w-0 truncate text-xs text-muted-foreground sm:text-sm" aria-live="polite">
                {isDirty
                  ? (
                    <span className="font-semibold text-amber-700 dark:text-amber-400">
                      {dirtyIds.size} unsaved<span className="hidden sm:inline"> change{dirtyIds.size === 1 ? '' : 's'}</span>
                    </span>
                  )
                  : counts.unmarked > 0 ? `${plural(counts.unmarked, 'student')} not marked yet` : 'All changes saved'}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                {isDirty && (
                  <button type="button" onClick={register.revertAll} disabled={saving} className="btn-secondary h-9 px-3 text-xs sm:text-sm">
                    <RotateCcw className="size-4" aria-hidden="true" /><span className="hidden xs:inline">Undo all</span>
                  </button>
                )}
                <button type="button" onClick={handleSave} disabled={!isDirty || saving} className="btn-primary h-9 px-4 disabled:pointer-events-none disabled:opacity-50">
                  <Save className="size-4" aria-hidden="true" />{saving ? 'Saving…' : isDirty ? 'Save' : 'Saved'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        isOpen={pendingSwitch !== null}
        onClose={() => setPendingSwitch(null)}
        onConfirm={confirmSwitch}
        title="Discard unsaved marks?"
        message={`You have ${plural(dirtyIds.size, 'unsaved change')} on this register. Switching class or day will discard them.`}
        confirmText="Discard changes"
        cancelText="Keep editing"
        variant="warning"
      />

      <ConfirmDialog
        isOpen={confirmNotify}
        onClose={() => { if (!notifying) setConfirmNotify(false); }}
        onConfirm={handleNotify}
        title="Text guardians?"
        message={`Send an SMS to the guardians of ${plural(counts.absent, 'student')} marked absent in ${streamName} on ${dateLabel}. Guardians already texted for this day are not texted again.`}
        confirmText="Send SMS"
        loading={notifying}
      />
    </div>
  );
}

function EmptyState({ icon: Icon, title, body, action }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
      <Icon className="mb-3 size-10 text-muted-foreground/40" />
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
