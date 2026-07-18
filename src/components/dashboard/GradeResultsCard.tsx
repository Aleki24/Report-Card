"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import EmptyState from './EmptyState';

interface Stream { id: string; full_name: string }
interface Mark {
  subject_name: string;
  percentage: number | null;
  grade_symbol: string | null;
  exam_id: string;
  exam_name: string;
  exam_date: string | null;
}

interface SubjectAgg { subject: string; avg: number; count: number; grade: string | null }
/** One assessment series, e.g. "Term 2 Midterm" — the per-subject exam records grouped back together. */
interface SeriesOption { key: string; name: string; date: number; examIds: string[] }

function aggregateBySubject(marks: Mark[]): SubjectAgg[] {
  const by: Record<string, { sum: number; n: number; grades: Record<string, number> }> = {};
  for (const m of marks) {
    if (m.percentage == null) continue;
    const bucket = (by[m.subject_name] ??= { sum: 0, n: 0, grades: {} });
    bucket.sum += Number(m.percentage);
    bucket.n += 1;
    if (m.grade_symbol) bucket.grades[m.grade_symbol] = (bucket.grades[m.grade_symbol] || 0) + 1;
  }
  return Object.entries(by)
    .map(([subject, v]) => ({
      subject,
      avg: Math.round(v.sum / v.n),
      count: v.n,
      grade: Object.entries(v.grades).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    }))
    .sort((a, b) => b.avg - a.avg);
}

/* Red is reserved for genuinely alarming scores (≤20%); everything else gets
   calm colors — green for strong, amber for good, blue for the middle band. */
function sevColor(avg: number): string {
  if (avg <= 20) return 'var(--viz-bad)';
  if (avg >= 80) return 'var(--viz-good)';
  if (avg >= 60) return 'var(--viz-warn)';
  return 'var(--viz-info)';
}

/**
 * Exam results by subject, sourced exactly like the Analytics page: the marks
 * endpoint does the class filtering server-side and the card aggregates what
 * comes back. Opens on "All classes" (every recorded mark), ‹ › cycles into
 * individual classes, and the dropdown filters by exam — options come from the
 * marks themselves, so only exams that actually have marks are listed.
 */
export default function GradeResultsCard() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [streamsLoaded, setStreamsLoaded] = useState(false);
  // 0..n-1 = a specific stream; -1 = "All classes" (fallback when no single
  // class has marks, e.g. exams not linked to a stream).
  const [scopeIdx, setScopeIdx] = useState(0);
  const [marks, setMarks] = useState<Mark[]>([]);
  // Which scope the marks in state belong to — guards the seek effect against
  // reading the previous scope's (stale) marks before the next fetch lands.
  const [marksScope, setMarksScope] = useState<string | null>(null);
  const [examId, setExamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // On first load, advance past classes whose marks come back empty so the
  // card opens on a real class with results; ‹ › then cycles the rest.
  const [seeking, setSeeking] = useState(true);
  const cacheRef = useRef(new Map<string, Mark[]>());

  useEffect(() => {
    fetch('/api/school/data?type=grade_streams')
      .then(res => (res.ok ? res.json() : { data: [] }))
      .then(json => setStreams(json.data ?? []))
      .catch(() => {})
      .finally(() => setStreamsLoaded(true));
  }, []);

  const scopeStream = scopeIdx >= 0 ? streams[scopeIdx] ?? null : null;
  const scopeKey = scopeStream?.id ?? 'all';

  useEffect(() => {
    if (!streamsLoaded) return;
    const cached = cacheRef.current.get(scopeKey);
    if (cached) {
      setMarks(cached);
      setMarksScope(scopeKey);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const params = scopeKey === 'all' ? '' : `?stream_id=${scopeKey}`;
    fetch(`/api/school/analytics${params}`)
      .then(res => (res.ok ? res.json() : { marks: [] }))
      .then(json => {
        if (cancelled) return;
        const rows: Mark[] = json.marks ?? [];
        cacheRef.current.set(scopeKey, rows);
        setMarks(rows);
        setMarksScope(scopeKey);
      })
      .catch(() => { if (!cancelled) { setMarks([]); setMarksScope(scopeKey); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [scopeKey, streamsLoaded]);

  useEffect(() => {
    if (!seeking || !streamsLoaded) return;
    if (streams.length === 0 || scopeIdx === -1) { setScopeIdx(-1); setSeeking(false); return; }
    if (loading || marksScope !== scopeKey) return; // current scope's marks not in yet
    if (marks.length > 0) { setSeeking(false); return; }
    if (scopeIdx < streams.length - 1) setScopeIdx(scopeIdx + 1);
    else { setScopeIdx(-1); setSeeking(false); } // no class had marks — fall back to All classes
  }, [seeking, streamsLoaded, loading, marks, marksScope, scopeKey, scopeIdx, streams.length]);

  // Exams in this app are per-subject records ("Term 2 Midterm - English"),
  // so group them back into assessment series by stripping the subject suffix
  // off the exam name — one dropdown entry shows every subject sat together.
  const seriesOptions = useMemo<SeriesOption[]>(() => {
    const byKey = new Map<string, { name: string; date: number; examIds: Set<string> }>();
    for (const m of marks) {
      const name = m.exam_name || 'Exam';
      const subj = (m.subject_name || '').trim();
      const suffix = ` - ${subj}`.toLowerCase();
      const seriesName = subj && name.toLowerCase().endsWith(suffix) ? name.slice(0, name.length - suffix.length).trim() : name;
      const time = m.exam_date ? new Date(m.exam_date).getTime() : 0;
      // Year-scope the key so a recurring series name doesn't merge across years.
      const key = `${seriesName.toLowerCase()}|${time ? new Date(time).getFullYear() : 0}`;
      const cur = byKey.get(key) ?? { name: seriesName, date: 0, examIds: new Set<string>() };
      cur.date = Math.max(cur.date, time);
      cur.examIds.add(m.exam_id);
      byKey.set(key, cur);
    }
    return [...byKey.entries()]
      .map(([key, v]) => ({ key, name: v.name, date: v.date, examIds: [...v.examIds] }))
      .sort((a, b) => b.date - a.date);
  }, [marks]);

  // Default to the newest series whenever the scope's marks change.
  useEffect(() => {
    setExamId(seriesOptions[0]?.key ?? null);
  }, [seriesOptions]);

  const series = seriesOptions.find(s => s.key === examId) ?? null;
  const seriesExamIds = useMemo(() => new Set(series?.examIds ?? []), [series]);
  const subjects = useMemo(() => aggregateBySubject(marks.filter(m => seriesExamIds.has(m.exam_id))), [marks, seriesExamIds]);
  const classAvg = subjects.length ? Math.round(subjects.reduce((s, x) => s + x.avg * x.count, 0) / subjects.reduce((s, x) => s + x.count, 0)) : null;
  const examDate = series?.date ? new Date(series.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
  const scopeLabel = scopeStream ? scopeStream.full_name : 'All classes';

  // ‹ › order: All classes → stream 0 → … → stream n-1 → All classes.
  const cycle = (dir: 1 | -1) => {
    setSeeking(false);
    const total = streams.length + 1; // +1 for the All classes scope
    const pos = scopeIdx + 1;         // All classes occupies position 0
    setScopeIdx((((pos + dir) % total) + total) % total - 1);
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card/90 p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => cycle(-1)}
          disabled={streams.length === 0}
          aria-label="Previous class"
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:cursor-default disabled:opacity-40"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="min-w-0 flex-1">
          <h3 className="font-display truncate text-sm font-semibold text-foreground">
            {series ? `${series.name} — ${scopeLabel}` : `Exam Results — ${scopeLabel}`}
          </h3>
          <p className="truncate text-[11px] text-muted-foreground">
            {[examDate, subjects.length ? `${subjects.length} subjects` : null, classAvg != null ? `average ${classAvg}%` : null].filter(Boolean).join(' · ') || 'Latest exam performance by subject'}
          </p>
        </div>
        <button
          onClick={() => cycle(1)}
          disabled={streams.length === 0}
          aria-label="Next class"
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:cursor-default disabled:opacity-40"
        >
          <ChevronRight size={16} />
        </button>
        {seriesOptions.length > 0 && (
          <select
            value={examId ?? ''}
            onChange={e => setExamId(e.target.value)}
            aria-label="Filter by exam"
            className="max-w-[150px] shrink-0 cursor-pointer truncate rounded-lg border border-border/60 bg-card px-2 py-1.5 text-xs font-medium text-foreground outline-none transition-colors focus:border-primary/50"
          >
            {seriesOptions.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
          </select>
        )}
      </div>

      {loading || seeking ? (
        <div className="space-y-1.5">
          {[0, 1, 2, 3, 4].map(i => <div key={i} className="skeleton-bone h-6 rounded-lg" />)}
        </div>
      ) : subjects.length === 0 ? (
        <EmptyState
          title="No marks yet"
          description={scopeKey === 'all' ? 'Marks entered in Exams & Marks will appear here.' : `No marks recorded for ${scopeLabel} yet.`}
        />
      ) : (
        <div className="space-y-0.5">
          {subjects.map(s => (
            <div key={s.subject} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-muted/50">
              <span className="w-28 shrink-0 truncate text-xs font-medium text-foreground sm:w-40">{s.subject}</span>
              <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full" style={{ width: `${Math.min(s.avg, 100)}%`, background: sevColor(s.avg) }} />
              </div>
              <span className="w-6 shrink-0 text-right text-[13px] font-bold tabular-nums text-foreground">{s.avg}</span>
              <span
                className="w-8 shrink-0 rounded px-1 py-0.5 text-center text-[10px] font-bold leading-none"
                style={{ color: sevColor(s.avg), background: `color-mix(in srgb, ${sevColor(s.avg)} 14%, transparent)` }}
              >
                {s.grade ?? `${s.avg}%`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
