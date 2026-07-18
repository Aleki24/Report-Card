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

function examBelongsToStream(exam: Exam, stream: Stream): boolean {
  if (exam.grade_stream_id) return exam.grade_stream_id === stream.id;
  if (exam.grade_id != null) return exam.grade_id === stream.grade_id;
  return false;
}

/**
 * Exam results by subject, with ‹ › navigation across classes and an exam
 * filter. Marks-first: all marks are fetched once and the card opens on the
 * newest exam that actually has marks, resolving its class from the exam's
 * stream/grade link. An exam that matches no known class still displays,
 * labelled "All classes" — marks can never be hidden by a linkage mismatch.
 */
export default function GradeResultsCard() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [loading, setLoading] = useState(true);
  // streamIdx === -1 → "All classes" view for a marked exam matching no stream.
  const [streamIdx, setStreamIdx] = useState(0);
  const [examId, setExamId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [streamsRes, examsRes, termsRes, marksRes] = await Promise.all([
          fetch('/api/school/data?type=grade_streams'),
          fetch('/api/school/data?type=exams'),
          fetch('/api/school/data?type=terms'),
          fetch('/api/school/analytics'),
        ]);
        if (streamsRes.ok) setStreams((await streamsRes.json()).data ?? []);
        if (examsRes.ok) setExams((await examsRes.json()).data ?? []);
        if (termsRes.ok) setTerms((await termsRes.json()).data ?? []);
        if (marksRes.ok) setMarks((await marksRes.json()).marks ?? []);
      } catch (err) {
        console.error('Grade results fetch error:', err);
      }
      setLoading(false);
    })();
  }, []);

  const markedExamIds = useMemo(() => new Set(marks.map(m => m.exam_id)), [marks]);
  // exams arrive newest-first from the API, so the first marked one is the latest.
  const markedExams = useMemo(() => exams.filter(e => markedExamIds.has(e.id)), [exams, markedExamIds]);

  // Open on the newest exam that has marks, on the class it belongs to.
  useEffect(() => {
    if (loading || initialized) return;
    const latest = markedExams[0];
    if (latest) {
      const idx = streams.findIndex(s => examBelongsToStream(latest, s));
      setStreamIdx(idx); // -1 → "All classes" view
      setExamId(latest.id);
    } else {
      setStreamIdx(0);
      setExamId(null);
    }
    setInitialized(true);
  }, [loading, initialized, markedExams, streams]);

  const stream = streamIdx >= 0 ? streams[streamIdx] ?? null : null;

  // Exams selectable in the current view: the stream's own (marked ones first,
  // then newest unmarked), or every marked exam in the "All classes" view.
  const viewExams = useMemo(() => {
    if (!stream) return markedExams;
    const own = exams.filter(e => examBelongsToStream(e, stream));
    return [...own.filter(e => markedExamIds.has(e.id)), ...own.filter(e => !markedExamIds.has(e.id))];
  }, [stream, exams, markedExams, markedExamIds]);

  const goToStream = (idx: number) => {
    setStreamIdx(idx);
    const target = streams[idx];
    if (!target) return;
    const own = exams.filter(e => examBelongsToStream(e, target));
    const preferred = own.find(e => markedExamIds.has(e.id)) ?? own[0];
    setExamId(preferred?.id ?? null);
  };

  const cycle = (dir: 1 | -1) => {
    if (streams.length === 0) return;
    goToStream(((streamIdx < 0 ? (dir === 1 ? -1 : 0) : streamIdx) + dir + streams.length) % streams.length);
  };

  const subjects = useMemo(() => aggregateBySubject(marks.filter(m => m.exam_id === examId)), [marks, examId]);
  const classAvg = subjects.length ? Math.round(subjects.reduce((s, x) => s + x.avg * x.count, 0) / subjects.reduce((s, x) => s + x.count, 0)) : null;
  const exam = exams.find(e => e.id === examId) ?? null;
  const termName = exam?.term_id ? terms.find(t => t.id === exam.term_id)?.name : null;
  const scopeLabel = stream ? stream.full_name : streams.length > 0 && exam ? 'All classes' : null;

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
            {exam ? exam.name : 'Exam Results'}{scopeLabel ? ` — ${scopeLabel}` : ''}
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
        {viewExams.length > 0 && (
          <select
            value={examId ?? ''}
            onChange={e => setExamId(e.target.value)}
            aria-label="Filter by exam"
            className="max-w-[150px] shrink-0 cursor-pointer truncate rounded-lg border border-border/60 bg-card px-2 py-1.5 text-xs font-medium text-foreground outline-none transition-colors focus:border-primary/50"
          >
            {viewExams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map(i => <div key={i} className="skeleton-bone h-[88px] rounded-xl" />)}
        </div>
      ) : streams.length === 0 && exams.length === 0 ? (
        <EmptyState title="No classes yet" description="Set up grades, streams and exams to see results here." />
      ) : subjects.length === 0 ? (
        <EmptyState title="No marks yet" description={`No marks recorded${scopeLabel ? ` for ${scopeLabel}` : ''}${exam ? ` on ${exam.name}` : ''}.`} />
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
