"use client";

import React, { useEffect, useState } from 'react';
import { AlertTriangle, CalendarRange, Download, TrendingUp } from 'lucide-react';
import { LoadError, StatTile } from '@/components/ui';
import { STATUS_STYLES } from '@/components/attendance/statusStyles';
import { apiErrorMessage } from '@/lib/api-error-message';
import { addDays, formatIsoDate, localIsoDate } from '@/lib/dates';
import { cn } from '@/lib/utils';
import {
  ATTENDANCE_LABELS, ATTENDANCE_SUMMARY_MAX_DAYS, LOW_ATTENDANCE_RATE,
  type AttendanceStream, type AttendanceSummaryResponse,
} from '@/lib/attendance';

type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; body: AttendanceSummaryResponse };
type Range = readonly [from: string, to: string];

/** Monday of the week `day` falls in. */
function weekStart(day: string): string {
  const weekday = new Date(`${day}T00:00:00`).getDay();
  return addDays(day, -((weekday + 6) % 7));
}

const PRESETS: readonly { id: string; label: string; range: (today: string) => Range }[] = [
  { id: 'week', label: 'This week', range: t => [weekStart(t), t] },
  { id: 'month', label: 'This month', range: t => [`${t.slice(0, 8)}01`, t] },
  { id: 'days30', label: 'Last 30 days', range: t => [addDays(t, -29), t] },
  { id: 'days90', label: 'Last 90 days', range: t => [addDays(t, -89), t] },
];

const rateTone = (rate: number | null) =>
  rate === null ? 'text-muted-foreground' : rate < LOW_ATTENDANCE_RATE ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400';

/**
 * One class over a period: the class's rate, who is often away (below
 * {@link LOW_ATTENDANCE_RATE}%), and each learner's mark day by day. Exports
 * the same grid to Excel.
 */
export function ReportsView({ streams, initialStreamId }: { streams: readonly AttendanceStream[]; initialStreamId: string }) {
  const today = localIsoDate();
  const [streamId, setStreamId] = useState(() => initialStreamId || streams[0]?.id || '');
  const [range, setRange] = useState<Range>(() => PRESETS[1].range(today));
  const [lowOnly, setLowOnly] = useState(false);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<{ key: string; load: Load } | null>(null);
  const [from, to] = range;
  const query = new URLSearchParams({ stream_id: streamId, from, to }).toString();
  const key = `${query}|${reload}`;
  const load: Load = result?.key === key ? result.load : { status: 'loading' };

  useEffect(() => {
    if (!streamId) return;
    const controller = new AbortController();
    fetch(`/api/school/attendance/summary?${query}`, { cache: 'no-store', signal: controller.signal })
      .then(async res => {
        const body: unknown = await res.json().catch(() => null);
        if (!res.ok) throw new Error(apiErrorMessage(body, 'Could not load the report.'));
        setResult({ key, load: { status: 'ready', body: body as AttendanceSummaryResponse } });
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setResult({ key, load: { status: 'error', message: err instanceof Error ? err.message : 'Could not load the report.' } });
      });
    return () => controller.abort();
  }, [key, query, streamId]);

  if (streams.length === 0) {
    return <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">You have no class to report on.</p>;
  }

  const activePreset = PRESETS.find(p => { const [a, b] = p.range(today); return a === from && b === to; })?.id;
  const body = load.status === 'ready' ? load.body : null;
  const low = body ? body.learners.filter(l => l.rate !== null && l.rate < LOW_ATTENDANCE_RATE) : [];
  // Lowest first so the learners to follow up are on top; unrated (never marked) last.
  const shown = [...(lowOnly ? low : body?.learners ?? [])].sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101) || a.name.localeCompare(b.name));
  // Keep a picked range within what the API covers.
  const clampFrom = (value: string) => (addDays(to, -(ATTENDANCE_SUMMARY_MAX_DAYS - 1)) > value ? addDays(to, -(ATTENDANCE_SUMMARY_MAX_DAYS - 1)) : value);

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Class and period" className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm sm:p-4">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-[minmax(0,1fr)_9.5rem_9.5rem_auto]">
          <select className="input-field col-span-2 md:col-span-1" aria-label="Class" value={streamId} onChange={e => setStreamId(e.target.value)}>
            {streams.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
          <input type="date" className="input-field" aria-label="From" value={from} max={to} onChange={e => e.target.value && setRange([clampFrom(e.target.value), to])} />
          <input type="date" className="input-field" aria-label="To" value={to} min={from} max={today} onChange={e => e.target.value && setRange([from, e.target.value])} />
          <a href={`/api/school/attendance/summary?${query}&format=xlsx`} className="btn-secondary col-span-2 justify-center md:col-span-1">
            <Download className="size-4" aria-hidden="true" />Excel
          </a>
        </div>
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none]" role="group" aria-label="Quick periods">
          {PRESETS.map(p => (
            <button
              key={p.id}
              type="button"
              aria-pressed={activePreset === p.id}
              onClick={() => setRange(p.range(today))}
              className={cn('shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors', activePreset === p.id ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>

      {load.status === 'error' ? (
        <LoadError title="Couldn't load the report" message={load.message} onRetry={() => setReload(n => n + 1)} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <StatTile icon={TrendingUp} label="Class attendance" value={body?.rate != null ? `${body.rate}%` : '—'} tone={body?.rate == null ? 'default' : body.rate < LOW_ATTENDANCE_RATE ? 'warn' : 'good'} />
            <StatTile icon={CalendarRange} hue="blue" label="Registers taken" value={body ? body.days.length : '—'} hint={body ? `${formatIsoDate(from, { day: 'numeric', month: 'short' })} – ${formatIsoDate(to, { day: 'numeric', month: 'short' })}` : undefined} />
            <StatTile
              icon={AlertTriangle}
              label={`Below ${LOW_ATTENDANCE_RATE}%`}
              value={body ? low.length : '—'}
              tone={low.length > 0 ? 'warn' : body ? 'good' : 'default'}
              hint={body ? `of ${body.learners.length} learners` : undefined}
              className="col-span-2 md:col-span-1"
            />
          </div>

          {load.status === 'loading' ? (
            <div className="h-64 animate-pulse rounded-2xl bg-muted/60" aria-busy="true" />
          ) : body && body.days.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No register was taken for this class in this period.</p>
          ) : body && (
            <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
                <h3 className="text-sm font-semibold">Learners <span className="font-normal text-muted-foreground">· lowest attendance first</span></h3>
                <label className="inline-flex items-center gap-2 text-xs font-medium">
                  <input type="checkbox" className="size-4 accent-current" checked={lowOnly} onChange={e => setLowOnly(e.target.checked)} />
                  Only below {LOW_ATTENDANCE_RATE}%
                </label>
              </header>
              <ul className="flex flex-col divide-y divide-border/60">
                {shown.map(l => (
                  <li key={l.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 lg:grid-cols-[minmax(0,14rem)_5rem_minmax(0,1fr)]">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{l.name}</p>
                      <p className="truncate text-xs text-muted-foreground tabular-nums">
                        {[l.admission_number, `${l.counts.absent} absent`, l.counts.late ? `${l.counts.late} late` : '', l.counts.excused ? `${l.counts.excused} excused` : ''].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <span className={cn('text-right text-sm font-bold tabular-nums lg:text-left', rateTone(l.rate))}>{l.rate === null ? '—' : `${l.rate}%`}</span>
                    {/* One square per register day; scrolls sideways when the period is long. */}
                    <div className="col-span-2 flex gap-0.5 overflow-x-auto pb-0.5 [scrollbar-width:thin] lg:col-span-1" role="img" aria-label={`${l.name}: ${l.counts.present} present, ${l.counts.late} late, ${l.counts.excused} excused, ${l.counts.absent} absent`}>
                      {body.days.map(day => {
                        const status = l.days[day];
                        return (
                          <span
                            key={day}
                            title={`${formatIsoDate(day, { weekday: 'short', day: 'numeric', month: 'short' })}: ${status ? ATTENDANCE_LABELS[status] : 'Not marked'}`}
                            className={cn('size-3 shrink-0 rounded-[3px]', status ? STATUS_STYLES[status].bar : 'bg-muted')}
                          />
                        );
                      })}
                    </div>
                  </li>
                ))}
                {shown.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Nobody is below {LOW_ATTENDANCE_RATE}%.</li>}
              </ul>
              <footer className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border/60 px-4 py-2.5 text-[11px] text-muted-foreground">
                {(['present', 'late', 'excused', 'absent'] as const).map(s => (
                  <span key={s} className="inline-flex items-center gap-1.5"><span className={cn('size-2.5 rounded-[3px]', STATUS_STYLES[s].bar)} aria-hidden="true" />{ATTENDANCE_LABELS[s]}</span>
                ))}
                <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-muted" aria-hidden="true" />Not marked</span>
              </footer>
            </section>
          )}
        </>
      )}
    </div>
  );
}
