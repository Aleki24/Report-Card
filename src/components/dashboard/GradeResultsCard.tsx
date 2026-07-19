"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
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

/* Kenyan-curriculum subject buckets; order is both match precedence and the
   order category chips render in. More specific tests come before broader
   ones ("Home Science" must hit Technical before the Sciences test sees it). */
const SUBJECT_CATEGORIES: { label: string; test: RegExp }[] = [
  { label: 'Mathematics', test: /math/i },
  { label: 'Languages', test: /english|kiswahili|swahili|french|german|arabic|chinese|sign language|literature|lugha/i },
  { label: 'Humanities', test: /history|geograph|religio|\bcre\b|\bire\b|\bhre\b|social studies|life skills|citizenship/i },
  { label: 'Technical & Applied', test: /business|computer|agricult|home science|art|music|physical|sport|pre-?tech|creative|design|woodwork|metal|building|electric|drawing|aviation/i },
  { label: 'Sciences', test: /biolog|chemist|physic|science/i },
];

function subjectCategory(subject: string): string {
  return SUBJECT_CATEGORIES.find(c => c.test.test(subject))?.label ?? 'Other';
}

/**
 * Exam results by subject, sourced exactly like the Analytics page: the marks
 * endpoint does the class filtering server-side and the card aggregates what
 * comes back. Opens on "All classes" (every recorded mark); the dropdown
 * switches to individual classes.
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
  // card opens on a real class with results.
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

  // Exams in this app are per-subject records ("Term 2 Midterm - English",
  // sometimes with extra decoration like "(English)" appended), so group them
  // back into assessment series. The subject name is removed wherever it
  // appears in the exam name — tolerant of separators, parentheses and
  // ordering — and leftover punctuation is cleaned, so every subject of a
  // sitting lands in the same series regardless of naming quirks.
  const seriesOptions = useMemo<SeriesOption[]>(() => {
    const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const seriesNameOf = (examName: string, subjectName: string) => {
      let n = examName;
      const subj = subjectName.trim();
      if (subj) n = n.replace(new RegExp(escapeRe(subj), 'gi'), '');
      n = n
        .replace(/\(\s*\)/g, ' ')          // empty parens left by removal
        .replace(/\s*[-–—:/]\s*(?=$)/g, '') // dangling trailing separators
        .replace(/^\s*[-–—:/]\s*/g, '')     // dangling leading separators
        .replace(/\s{2,}/g, ' ')
        .trim();
      return n || examName;
    };
    const byKey = new Map<string, { name: string; date: number; examIds: Set<string> }>();
    for (const m of marks) {
      const seriesName = seriesNameOf(m.exam_name || 'Exam', m.subject_name || '');
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

  // Category chips: subjects render one type at a time (Humanities, …) with a
  // click to see the others. Default is the first category present.
  const [cat, setCat] = useState<string | null>(null);
  const catOptions = useMemo(() => {
    const present = new Set(subjects.map(s => subjectCategory(s.subject)));
    const ordered = [...SUBJECT_CATEGORIES.map(c => c.label), 'Other'].filter(l => present.has(l));
    return ordered;
  }, [subjects]);
  const activeCat = cat && catOptions.includes(cat) ? cat : catOptions[0] ?? null;
  const visibleSubjects = useMemo(
    () => (activeCat ? subjects.filter(s => subjectCategory(s.subject) === activeCat) : subjects),
    [subjects, activeCat]
  );

  return (
    <div className="rounded-2xl border border-border/60 bg-card/90 p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-display truncate text-sm font-semibold text-foreground">
            {series ? `${series.name} — ${scopeLabel}` : `Exam Results — ${scopeLabel}`}
          </h3>
          <p className="truncate text-[11px] text-muted-foreground">
            {[examDate, subjects.length ? `${subjects.length} subjects` : null, classAvg != null ? `average ${classAvg}%` : null].filter(Boolean).join(' · ') || 'Latest exam performance by subject'}
          </p>
        </div>
        {streams.length > 0 && (
          <select
            value={scopeKey}
            onChange={e => {
              setSeeking(false);
              const v = e.target.value;
              setScopeIdx(v === 'all' ? -1 : streams.findIndex(s => s.id === v));
            }}
            aria-label="Filter by class"
            className="max-w-[150px] shrink-0 cursor-pointer truncate rounded-lg border border-border/60 bg-card px-2 py-1.5 text-xs font-medium text-foreground outline-none transition-colors focus:border-primary/50"
          >
            <option value="all">All classes</option>
            {streams.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        )}
      </div>

      {/* Subject type chips — one category shown at a time */}
      {!loading && !seeking && catOptions.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {catOptions.map(c => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`cursor-pointer rounded-full px-2.5 py-1 text-[10px] font-semibold leading-none transition-colors ${
                c === activeCat
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

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
          {visibleSubjects.map(s => (
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
