"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { gradeSymbolFromScales } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import type { GradeBand } from '@/types';
import EmptyState from './EmptyState';

interface Stream { id: string; full_name: string }

interface Mark {
  subject_id: string | null;
  subject_name: string;
  percentage: number | null;
  exam_id: string;
  exam_name: string;
  exam_date: string | null;
}

/** Mirrors `SubjectMeta` from /api/school/analytics. */
interface SubjectMeta {
  id: string;
  name: string;
  academic_level_id: string | null;
  level_code: string | null;
  level_name: string | null;
  grading_system_id: string | null;
}

interface AnalyticsResponse {
  marks?: Mark[];
  subjects?: SubjectMeta[];
  gradingScales?: Record<string, GradeBand[]>;
}

interface SubjectAgg {
  /** Subject id where the mark has one; the name is only a fallback key. */
  key: string;
  subject: string;
  levelId: string;
  levelLabel: string;
  avg: number;
  count: number;
  /** Null when the subject has no grading system — never a guess. */
  grade: string | null;
}

interface LevelOption { id: string; label: string; count: number }

/** One assessment series, e.g. "Term 2 Midterm" — the per-subject exam records grouped back together. */
interface SeriesOption { key: string; name: string; date: number; examIds: string[] }

/** Stable identity so the memos below don't rerun on every loading render. */
const EMPTY_MARKS: Mark[] = [];

/**
 * Curricula are stored under their full names ("Competency Based Curriculum"),
 * which is too long for a control that sits beside the subject chips.
 */
const LEVEL_LABELS: Record<string, string> = {
  CBC: 'CBC',
  '844': '8-4-4',
};

const UNKNOWN_LEVEL = '__unknown__';

function levelLabelOf(subject: SubjectMeta | undefined): string {
  if (!subject) return 'Other';
  const code = (subject.level_code || '').trim();
  return LEVEL_LABELS[code] || code || subject.level_name || 'Other';
}

/**
 * Subject averages for one assessment series.
 *
 * Grouping is by `subject_id`, not by name. A school running both curricula has
 * two subjects called "Agriculture" — one CBC, one 8-4-4, each with its own
 * grading scale — and keying on the name merged them into a single row whose
 * marks came off two different tables.
 *
 * The badge is the school's own scale applied to the average. It used to be the
 * most frequent `grade_symbol` among the individual marks, which is a different
 * quantity from the number beside it and, once the two curricula were merged,
 * not even a grade this subject can be awarded: a class averaging 50 was
 * labelled A while the school's table put 50 at B-. Where a subject has no
 * grading system configured there is no badge at all.
 */
function aggregateBySubject(
  marks: Mark[],
  subjectsById: Map<string, SubjectMeta>,
  scalesBySystem: Map<string, GradeBand[]>,
): SubjectAgg[] {
  const by = new Map<string, { name: string; meta?: SubjectMeta; sum: number; n: number }>();

  for (const m of marks) {
    if (m.percentage == null) continue;
    const meta = m.subject_id ? subjectsById.get(m.subject_id) : undefined;
    const key = m.subject_id ?? `name:${m.subject_name}`;
    const bucket = by.get(key) ?? { name: (meta?.name || m.subject_name || '').trim(), meta, sum: 0, n: 0 };
    bucket.sum += Number(m.percentage);
    bucket.n += 1;
    by.set(key, bucket);
  }

  return [...by.entries()]
    .map(([key, v]) => {
      const avg = Math.round(v.sum / v.n);
      const systemId = v.meta?.grading_system_id;
      return {
        key,
        subject: v.name || 'Unknown',
        levelId: v.meta?.academic_level_id ?? UNKNOWN_LEVEL,
        levelLabel: levelLabelOf(v.meta),
        avg,
        count: v.n,
        grade: systemId ? gradeSymbolFromScales(avg, scalesBySystem.get(systemId)) : null,
      };
    })
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
 *
 * Everything below the header is scoped to a single curriculum. A school
 * running CBC alongside 8-4-4 grades the two on different tables, so a subject
 * list — and the average across it — that mixes them describes nothing: the
 * same 50% is a B- in one and a different band entirely in the other.
 */
export default function GradeResultsCard() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [streamsLoaded, setStreamsLoaded] = useState(false);
  // 0..n-1 = a specific stream; -1 = "All classes" (fallback when no single
  // class has marks, e.g. exams not linked to a stream).
  const [scopeIdx, setScopeIdx] = useState(0);
  const [examId, setExamId] = useState<string | null>(null);
  // On first load, advance past classes whose marks come back empty so the
  // card opens on a real class with results.
  const [seeking, setSeeking] = useState(true);

  /**
   * Responses keyed by scope: both the cache and the source the card renders
   * from. Held as one map rather than mirrored into `marks`/`loading` state,
   * so switching back to a class already fetched is a plain lookup during
   * render — no effect, no second render pass, and no window in which the
   * previous class's marks are on screen under the new class's heading.
   */
  const [byScope, setByScope] = useState<Record<string, AnalyticsResponse>>({});

  useEffect(() => {
    fetch('/api/school/data?type=grade_streams')
      .then(res => (res.ok ? res.json() : { data: [] }))
      .then(json => setStreams(json.data ?? []))
      .catch(() => {})
      .finally(() => setStreamsLoaded(true));
  }, []);

  const scopeStream = scopeIdx >= 0 ? streams[scopeIdx] ?? null : null;
  const scopeKey = scopeStream?.id ?? 'all';

  const scopeData = byScope[scopeKey];
  const loading = !streamsLoaded || scopeData === undefined;
  const marks = scopeData?.marks ?? EMPTY_MARKS;

  useEffect(() => {
    if (!streamsLoaded || byScope[scopeKey] !== undefined) return;
    let cancelled = false;
    const params = scopeKey === 'all' ? '' : `?stream_id=${scopeKey}`;
    fetch(`/api/school/analytics${params}`)
      .then(res => (res.ok ? res.json() : {}))
      .then((json: AnalyticsResponse) => {
        if (!cancelled) setByScope(prev => ({ ...prev, [scopeKey]: json }));
      })
      .catch(() => {
        if (!cancelled) setByScope(prev => ({ ...prev, [scopeKey]: {} }));
      });
    return () => { cancelled = true; };
  }, [scopeKey, streamsLoaded, byScope]);

  useEffect(() => {
    if (!seeking || !streamsLoaded) return;
    if (streams.length === 0 || scopeIdx === -1) { setScopeIdx(-1); setSeeking(false); return; }
    if (loading) return; // this scope's marks are not in yet
    if (marks.length > 0) { setSeeking(false); return; }
    if (scopeIdx < streams.length - 1) setScopeIdx(scopeIdx + 1);
    else { setScopeIdx(-1); setSeeking(false); } // no class had marks — fall back to All classes
  }, [seeking, streamsLoaded, loading, marks, scopeIdx, streams.length]);

  const subjectsById = useMemo(
    () => new Map((scopeData?.subjects ?? []).map(s => [s.id, s])),
    [scopeData],
  );
  const scalesBySystem = useMemo(
    () => new Map(Object.entries(scopeData?.gradingScales ?? {})),
    [scopeData],
  );

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
  const allSubjects = useMemo(
    () => aggregateBySubject(marks.filter(m => seriesExamIds.has(m.exam_id)), subjectsById, scalesBySystem),
    [marks, seriesExamIds, subjectsById, scalesBySystem],
  );

  // ── Curriculum, the outermost scope ──
  const [levelId, setLevelId] = useState<string | null>(null);
  const levelOptions = useMemo<LevelOption[]>(() => {
    const byLevel = new Map<string, LevelOption>();
    for (const s of allSubjects) {
      const cur = byLevel.get(s.levelId) ?? { id: s.levelId, label: s.levelLabel, count: 0 };
      cur.count += s.count;
      byLevel.set(s.levelId, cur);
    }
    return [...byLevel.values()].sort((a, b) => b.count - a.count);
  }, [allSubjects]);
  // Default to whichever curriculum has the most marks in this series.
  const activeLevelId = levelId && levelOptions.some(l => l.id === levelId)
    ? levelId
    : levelOptions[0]?.id ?? null;
  const subjects = useMemo(
    () => (activeLevelId ? allSubjects.filter(s => s.levelId === activeLevelId) : allSubjects),
    [allSubjects, activeLevelId],
  );

  const classAvg = subjects.length
    ? Math.round(subjects.reduce((s, x) => s + x.avg * x.count, 0) / subjects.reduce((s, x) => s + x.count, 0))
    : null;
  const examDate = series?.date ? new Date(series.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
  const scopeLabel = scopeStream ? scopeStream.full_name : 'All classes';
  const activeLevelLabel = levelOptions.find(l => l.id === activeLevelId)?.label ?? null;
  const ungradedCount = subjects.filter(s => s.grade === null).length;

  // Category chips: subjects render one type at a time (Humanities, …) with a
  // click to see the others. Default is the first category present.
  const [cat, setCat] = useState<string | null>(null);
  const catOptions = useMemo(() => {
    const present = new Set(subjects.map(s => subjectCategory(s.subject)));
    return [...SUBJECT_CATEGORIES.map(c => c.label), 'Other'].filter(l => present.has(l));
  }, [subjects]);
  const activeCat = cat && catOptions.includes(cat) ? cat : catOptions[0] ?? null;
  const visibleSubjects = useMemo(
    () => (activeCat ? subjects.filter(s => subjectCategory(s.subject) === activeCat) : subjects),
    [subjects, activeCat]
  );

  const ready = !loading && !seeking;
  const showFilters = ready && (levelOptions.length > 1 || catOptions.length > 1);

  return (
    <div className="rounded-2xl border border-border/60 bg-card/90 p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-display truncate text-sm font-semibold text-foreground">
            {series ? `${series.name} — ${scopeLabel}` : `Exam Results — ${scopeLabel}`}
          </h3>
          <p className="truncate text-[11px] text-muted-foreground">
            {[
              examDate,
              levelOptions.length > 1 ? activeLevelLabel : null,
              subjects.length ? `${subjects.length} subjects` : null,
              classAvg != null ? `average ${classAvg}%` : null,
            ].filter(Boolean).join(' · ') || 'Latest exam performance by subject'}
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
            className="input-field input-field-sm w-auto max-w-[150px] shrink-0 truncate font-medium text-foreground outline-none transition-colors focus:border-primary/50"
          >
            <option value="all">All classes</option>
            {streams.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        )}
      </div>

      {showFilters && (
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          {/* Curriculum first — it scopes everything below, chips included. */}
          {levelOptions.length > 1 && (
            <div role="group" aria-label="Curriculum" className="inline-flex shrink-0 rounded-full bg-muted/60 p-0.5">
              {levelOptions.map(l => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => { setLevelId(l.id); setCat(null); }}
                  aria-pressed={l.id === activeLevelId}
                  className={cn(
                    'cursor-pointer rounded-full px-2.5 py-1 text-[10px] font-semibold leading-none transition-colors',
                    l.id === activeLevelId
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {l.label}
                </button>
              ))}
            </div>
          )}

          {catOptions.length > 1 && (
            <div className="flex flex-wrap gap-1">
              {catOptions.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCat(c)}
                  aria-pressed={c === activeCat}
                  className={cn(
                    'cursor-pointer rounded-full px-2.5 py-1 text-[10px] font-semibold leading-none transition-colors',
                    c === activeCat
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!ready ? (
        <div className="space-y-1.5">
          {[0, 1, 2, 3, 4].map(i => <div key={i} className="skeleton-bone h-6 rounded-lg" />)}
        </div>
      ) : subjects.length === 0 ? (
        <EmptyState
          title="No marks yet"
          description={scopeKey === 'all' ? 'Marks entered in Exams & Marks will appear here.' : `No marks recorded for ${scopeLabel} yet.`}
        />
      ) : (
        <>
          <div className="space-y-0.5">
            {visibleSubjects.map(s => (
              <div key={s.key} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-muted/50">
                <span className="w-28 shrink-0 truncate text-xs font-medium text-foreground sm:w-40">{s.subject}</span>
                <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(s.avg, 100)}%`, background: sevColor(s.avg) }} />
                </div>
                <span className="w-8 shrink-0 text-right text-[13px] font-bold tabular-nums text-foreground">{s.avg}%</span>
                {s.grade ? (
                  <span
                    className="w-8 shrink-0 rounded px-1 py-0.5 text-center text-[10px] font-bold leading-none"
                    style={{ color: sevColor(s.avg), background: `color-mix(in srgb, ${sevColor(s.avg)} 14%, transparent)` }}
                  >
                    {s.grade}
                  </span>
                ) : (
                  <span
                    aria-label="No grading system set for this subject"
                    title="No grading system set for this subject"
                    className="w-8 shrink-0 text-center text-[10px] leading-none text-muted-foreground/50"
                  >
                    —
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* A missing grade is a setting nobody has filled in, so say where. */}
          {ungradedCount > 0 && (
            <p className="mt-3 border-t border-border/50 pt-3 text-[11px] leading-snug text-muted-foreground">
              {ungradedCount === 1 ? '1 subject has' : `${ungradedCount} subjects have`} no grading
              system, so no grade is shown.{' '}
              <Link href="/dashboard/settings?tab=grading" className="font-medium text-primary hover:underline">
                Set one up
              </Link>
            </p>
          )}
        </>
      )}
    </div>
  );
}
