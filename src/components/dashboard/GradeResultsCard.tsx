"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import EmptyState from './EmptyState';

interface Stream { id: string; full_name: string; grade_id: string | null }
interface Exam { id: string; name: string; term_id: string | null; grade_stream_id: string | null; grade_id: string | null; created_at: string }
interface Term { id: string; name: string }
interface Mark { subject_name: string; percentage: number | null; grade_symbol: string | null; exam_id: string }

interface SubjectAgg { subject: string; avg: number; count: number; grade: string | null }

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

function sevColor(avg: number): string {
  return avg >= 80 ? 'var(--viz-good)' : avg >= 60 ? 'var(--viz-warn)' : 'var(--viz-bad)';
}

/** Exam results for one grade/stream, with ‹ › navigation across streams and an exam filter. */
export default function GradeResultsCard() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [streamIdx, setStreamIdx] = useState(0);
  const [examId, setExamId] = useState<string | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMarks, setLoadingMarks] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [streamsRes, examsRes, termsRes] = await Promise.all([
          fetch('/api/school/data?type=grade_streams'),
          fetch('/api/school/data?type=exams'),
          fetch('/api/school/data?type=terms'),
        ]);
        if (streamsRes.ok) setStreams((await streamsRes.json()).data ?? []);
        if (examsRes.ok) setExams((await examsRes.json()).data ?? []);
        if (termsRes.ok) setTerms((await termsRes.json()).data ?? []);
      } catch (err) {
        console.error('Grade results fetch error:', err);
      }
      setLoading(false);
    })();
  }, []);

  const stream = streams[streamIdx] ?? null;

  // A stream's exams include stream-scoped exams and whole-grade exams for its grade.
  const streamExams = useMemo(() => {
    if (!stream) return [];
    return exams.filter(e => e.grade_stream_id === stream.id || (!e.grade_stream_id && e.grade_id != null && e.grade_id === stream.grade_id));
  }, [exams, stream]);

  // One fetch per stream: all its marks. Exam switching then filters locally,
  // and the default exam can be the newest one that actually has marks instead
  // of the newest created (which is often a just-scheduled, unmarked exam).
  useEffect(() => {
    if (!stream) { setMarks([]); return; }
    let cancelled = false;
    setLoadingMarks(true);
    fetch(`/api/school/analytics?stream_id=${stream.id}`)
      .then(res => (res.ok ? res.json() : { marks: [] }))
      .then(json => { if (!cancelled) setMarks(json.marks ?? []); })
      .catch(() => { if (!cancelled) setMarks([]); })
      .finally(() => { if (!cancelled) setLoadingMarks(false); });
    return () => { cancelled = true; };
  }, [stream]);

  useEffect(() => {
    const withMarks = new Set(marks.map(m => m.exam_id));
    const preferred = streamExams.find(e => withMarks.has(e.id)) ?? streamExams[0];
    setExamId(preferred?.id ?? null);
  }, [streamExams, marks]);

  const subjects = useMemo(() => aggregateBySubject(marks.filter(m => m.exam_id === examId)), [marks, examId]);
  const classAvg = subjects.length ? Math.round(subjects.reduce((s, x) => s + x.avg * x.count, 0) / subjects.reduce((s, x) => s + x.count, 0)) : null;
  const exam = streamExams.find(e => e.id === examId) ?? null;
  const termName = exam?.term_id ? terms.find(t => t.id === exam.term_id)?.name : null;

  const cycle = (dir: 1 | -1) => setStreamIdx(i => (i + dir + streams.length) % streams.length);

  return (
    <div className="rounded-2xl border border-border/60 bg-card/90 p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => cycle(-1)}
          disabled={streams.length < 2}
          aria-label="Previous class"
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:cursor-default disabled:opacity-40"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="min-w-0 flex-1">
          <h3 className="font-display truncate text-[15px] font-semibold text-foreground">
            {exam ? exam.name : 'Exam Results'}{stream ? ` — ${stream.full_name}` : ''}
          </h3>
          <p className="truncate text-xs text-muted-foreground">
            {[termName, subjects.length ? `${subjects.length} subjects` : null, classAvg != null ? `class average ${classAvg}%` : null].filter(Boolean).join(' · ') || 'Latest exam performance by subject'}
          </p>
        </div>
        <button
          onClick={() => cycle(1)}
          disabled={streams.length < 2}
          aria-label="Next class"
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:cursor-default disabled:opacity-40"
        >
          <ChevronRight size={16} />
        </button>
        {streamExams.length > 0 && (
          <select
            value={examId ?? ''}
            onChange={e => setExamId(e.target.value)}
            aria-label="Filter by exam"
            className="max-w-[150px] shrink-0 cursor-pointer truncate rounded-lg border border-border/60 bg-card px-2 py-1.5 text-xs font-medium text-foreground outline-none transition-colors focus:border-primary/50"
          >
            {streamExams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        )}
      </div>

      {loading || loadingMarks ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map(i => <div key={i} className="skeleton-bone h-[88px] rounded-xl" />)}
        </div>
      ) : streams.length === 0 ? (
        <EmptyState title="No classes yet" description="Set up grades and streams to see exam results here." />
      ) : subjects.length === 0 ? (
        <EmptyState title="No marks yet" description={`No marks recorded for ${stream?.full_name ?? 'this class'}${exam ? ` on ${exam.name}` : ''}.`} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {subjects.map(s => (
            <div key={s.subject} className="rounded-xl border border-border/55 bg-muted/35 p-3.5 transition-colors hover:bg-muted/55">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-semibold tracking-tight text-foreground">{s.subject}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{s.count} {s.count === 1 ? 'mark' : 'marks'}</span>
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-2xl font-bold leading-none tracking-tight text-foreground">{s.avg}</span>
                <span
                  className="rounded-md px-1.5 py-0.5 text-[11px] font-bold"
                  style={{ color: sevColor(s.avg), background: `color-mix(in srgb, ${sevColor(s.avg)} 14%, transparent)` }}
                >
                  {s.grade ?? `${s.avg}%`}
                </span>
              </div>
              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full" style={{ background: `color-mix(in srgb, ${sevColor(s.avg)} 15%, transparent)` }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(s.avg, 100)}%`, background: sevColor(s.avg) }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
