"use client";

import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsRight, ClipboardCheck, Clock, TrendingUp, UserX } from 'lucide-react';
import { LoadError, StatTile } from '@/components/ui';
import { AttendanceBar } from '@/components/attendance/AttendanceBar';
import { apiErrorMessage } from '@/lib/api-error-message';
import { addWeekdays, formatIsoDate, isWeekday, localIsoDate } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { LOW_ATTENDANCE_RATE, attendanceRate, type AttendanceClassDay, type AttendanceOverviewResponse } from '@/lib/attendance';

type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; body: AttendanceOverviewResponse };

const taken = (c: AttendanceClassDay) => c.counts.unmarked < c.counts.total;

/**
 * The whole school on one day: which registers are still to be taken, and
 * how many are away. Untaken classes come first; a class opens its register.
 */
export function TodayView({ onOpen }: { onOpen: (streamId: string, date: string) => void }) {
  const today = localIsoDate();
  const [date, setDate] = useState(() => (isWeekday(today) ? today : addWeekdays(today, -1)));
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<{ key: string; load: Load } | null>(null);
  const key = `${date}|${reload}`;
  const load: Load = result?.key === key ? result.load : { status: 'loading' };

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/school/attendance/overview?date=${date}`, { cache: 'no-store', signal: controller.signal })
      .then(async res => {
        const body: unknown = await res.json().catch(() => null);
        if (!res.ok) throw new Error(apiErrorMessage(body, 'Could not load the day.'));
        setResult({ key, load: { status: 'ready', body: body as AttendanceOverviewResponse } });
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setResult({ key, load: { status: 'error', message: err instanceof Error ? err.message : 'Could not load the day.' } });
      });
    return () => controller.abort();
  }, [date, key]);

  const body = load.status === 'ready' ? load.body : null;
  const classes = body ? [...body.classes].sort((a, b) => Number(taken(a)) - Number(taken(b))) : [];
  const takenCount = classes.filter(taken).length;
  const totals = body?.totals;
  const marked = totals ? totals.total - totals.unmarked : 0;
  const rate = totals ? attendanceRate(totals) : null;
  const next = addWeekdays(date, 1);

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Day" className="flex items-center justify-between gap-2 rounded-2xl border border-border/70 bg-card p-2 shadow-sm sm:p-3">
        <button type="button" className="btn-icon" aria-label="Previous school day" onClick={() => setDate(addWeekdays(date, -1))}>
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        <div className="flex min-w-0 flex-col items-center sm:flex-row sm:gap-3">
          <span className="truncate text-sm font-semibold">{formatIsoDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <input type="date" className="input-field h-8 w-36 text-xs" aria-label="Pick a day" value={date} max={today} onChange={e => e.target.value && setDate(e.target.value)} />
        </div>
        <button type="button" className="btn-icon" aria-label="Next school day" disabled={date >= today} onClick={() => setDate(next > today ? today : next)}>
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </section>

      {load.status === 'error' ? (
        <LoadError title="Couldn't load the day" message={load.message} onRetry={() => setReload(n => n + 1)} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              icon={ClipboardCheck}
              label="Registers taken"
              value={body ? `${takenCount} of ${classes.length}` : '—'}
              tone={!body ? 'default' : takenCount === classes.length ? 'good' : 'warn'}
              hint={body && takenCount < classes.length ? `${classes.length - takenCount} still to take` : undefined}
            />
            <StatTile icon={UserX} label="Absent" value={totals ? totals.absent : '—'} tone={totals && totals.absent > 0 ? 'bad' : 'default'} hint={totals?.excused ? `${totals.excused} excused` : undefined} />
            <StatTile icon={Clock} label="Late" value={totals ? totals.late : '—'} tone={totals && totals.late > 0 ? 'warn' : 'default'} />
            <StatTile icon={TrendingUp} label="Attendance" value={rate === null ? '—' : `${rate}%`} tone={rate === null ? 'default' : rate < LOW_ATTENDANCE_RATE ? 'warn' : 'good'} hint={marked > 0 ? `of ${marked} marked` : 'nothing marked yet'} />
          </div>

          {load.status === 'loading' ? (
            <div className="h-64 animate-pulse rounded-2xl bg-muted/60" aria-busy="true" />
          ) : classes.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No classes with learners yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
              {classes.map(c => {
                const isTaken = taken(c);
                return (
                  <li key={c.streamId}>
                    <button
                      type="button"
                      onClick={() => onOpen(c.streamId, date)}
                      className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{c.name}</span>
                        <span className="block text-xs text-muted-foreground">{c.counts.total} learners</span>
                      </span>
                      <span className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">
                        {isTaken ? <AttendanceBar counts={c.counts} /> : <span className="block h-2 rounded-full bg-muted" aria-hidden="true" />}
                      </span>
                      <span className="col-start-2 row-start-1 flex items-center gap-2 sm:col-start-auto sm:row-start-auto">
                        {isTaken ? (
                          <span className="text-right text-xs tabular-nums">
                            <span className={cn('font-semibold', c.rate !== null && c.rate < LOW_ATTENDANCE_RATE ? 'text-amber-700 dark:text-amber-400' : 'text-foreground')}>{c.rate ?? '—'}%</span>
                            <span className="text-muted-foreground"> · {c.counts.absent} absent{c.counts.unmarked > 0 ? ` · ${c.counts.unmarked} unmarked` : ''}</span>
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-500/12 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">Not taken</span>
                        )}
                        <ChevronsRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
