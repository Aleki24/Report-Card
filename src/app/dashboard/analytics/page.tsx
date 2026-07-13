"use client";

import React, { useState, useEffect } from 'react';
import { PerformanceTrendChart } from '@/components/charts/PerformanceTrend';
import { SubjectComparisonChart } from '@/components/charts/SubjectComparisonChart';
import { InsightsPanel } from '@/components/charts/InsightsPanel';
import { ContentSkeleton } from '@/components/dashboard/LoadingSkeleton';

interface StudentMark {
  studentName: string;
  admissionNumber: string;
  percentage: number;
  gradeSymbol: string;
}

interface MeritRow {
  rank: number;
  studentName: string;
  admissionNumber: string;
  average: number;
  subjectCount: number;
}

interface SubjectStat {
  name: string;
  mean: number;
  median: number;
  highest: number;
  lowest: number;
  passRate: number;
  studentCount: number;
  students: StudentMark[];
}

interface GradeData {
  grade: string;
  count: number;
}

interface GradeStreamOption {
  id: string;
  full_name: string;
}

function KpiCard({
  label,
  value,
  subtitle,
  color,
  icon,
}: {
  label: string;
  value: string;
  subtitle?: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '16px 18px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
    }}>
      <div style={{
        width: 38,
        height: 38,
        borderRadius: 10,
        background: `color-mix(in oklch, ${color} 10%, transparent)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 2px' }}>
          {label}
        </p>
        <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.03em', lineHeight: 1.25, overflowWrap: 'break-word', wordBreak: 'break-word' }}>
          {value}
        </p>
        {subtitle && (
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '1px 0 0' }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [gradeStreams, setGradeStreams] = useState<GradeStreamOption[]>([]);
  const [selectedStreamId, setSelectedStreamId] = useState('all');
  const [loading, setLoading] = useState(true);

  const [trendData, setTrendData] = useState<Record<string, any>[]>([]);
  const [trendSubjects, setTrendSubjects] = useState<string[]>([]);
  const [classAverage, setClassAverage] = useState(0);
  const [gradeData, setGradeData] = useState<GradeData[]>([]);
  const [subjectStats, setSubjectStats] = useState<SubjectStat[]>([]);
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
  const [meritList, setMeritList] = useState<MeritRow[]>([]);
  const [showFullMerit, setShowFullMerit] = useState(false);

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const res = await fetch('/api/school/data?type=grade_streams');
        const json = await res.json();
        setGradeStreams(json.data || []);
      } catch (err) {
        console.error('Failed to fetch grade streams:', err);
      }
    };
    fetchClasses();
  }, []);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);

      try {
        const params = new URLSearchParams();
        if (selectedStreamId !== 'all') params.set('stream_id', selectedStreamId);

        const res = await fetch(`/api/school/analytics?${params.toString()}`);
        const json = await res.json();

        if (!res.ok || !json.marks || json.marks.length === 0) {
          setTrendData([]);
          setTrendSubjects([]);
          setClassAverage(0);
          setGradeData([]);
          setSubjectStats([]);
          setLoading(false);
          return;
        }

        const marks = json.marks;

        const gradeCounts: Record<string, number> = {};
        marks.forEach((m: any) => {
          const g = m.grade_symbol || 'F';
          gradeCounts[g] = (gradeCounts[g] || 0) + 1;
        });
        const gradeOrder = (g: string) => {
          const base: Record<string, number> = { 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'F': 6 };
          const letter = g.charAt(0).toUpperCase();
          const modifier = g.length > 1 ? g.charAt(1) : '';
          return (base[letter] || 7) * 10 + (modifier === '+' ? 0 : modifier === '-' ? 2 : 1);
        };
        const dbGrades = Object.entries(gradeCounts)
          .map(([grade, count]) => ({ grade, count }))
          .sort((a, b) => gradeOrder(a.grade) - gradeOrder(b.grade));
        setGradeData(dbGrades);

        const examSubjAgg: Record<string, Record<string, { sum: number; count: number }>> = {};
        const examDates: Record<string, string> = {};
        const allSubjects = new Set<string>();

        marks.forEach((m: any) => {
          const eName = m.exam_name || 'Unknown Exam';
          const sName = m.subject_name || 'Unknown';
          const eDate = m.exam_date || new Date().toISOString();
          allSubjects.add(sName);
          if (!examDates[eName]) examDates[eName] = eDate;
          if (!examSubjAgg[eName]) examSubjAgg[eName] = {};
          if (!examSubjAgg[eName][sName]) examSubjAgg[eName][sName] = { sum: 0, count: 0 };
          examSubjAgg[eName][sName].sum += Number(m.percentage);
          examSubjAgg[eName][sName].count += 1;
        });

        const subjects = Array.from(allSubjects).sort();
        setTrendSubjects(subjects);

        const trendRows = Object.entries(examSubjAgg)
          .map(([examName, subjMap]) => {
            const row: Record<string, any> = { examName, _date: new Date(examDates[examName]).getTime() };
            for (const subj of subjects) {
              if (subjMap[subj]) {
                row[subj] = Math.round(subjMap[subj].sum / subjMap[subj].count);
              }
            }
            return row;
          })
          .sort((a, b) => a._date - b._date);

        setTrendData(trendRows);

        const allPcts = marks.map((m: any) => Number(m.percentage));
        const avg = allPcts.length > 0 ? allPcts.reduce((s: number, v: number) => s + v, 0) / allPcts.length : 0;
        setClassAverage(Math.round(avg));

        const subjAgg: Record<string, StudentMark[]> = {};
        marks.forEach((m: any) => {
          const sName = m.subject_name || 'Unknown Subject';
          if (!subjAgg[sName]) subjAgg[sName] = [];
          subjAgg[sName].push({
            studentName: m.student_name || 'Unknown',
            admissionNumber: m.admission_number || '',
            percentage: Number(m.percentage),
            gradeSymbol: m.grade_symbol || '-',
          });
        });

        const dbSubjStats: SubjectStat[] = Object.entries(subjAgg).map(([name, students]) => {
          const scores = students.map(s => s.percentage).sort((a, b) => a - b);
          const count = scores.length;
          const sum = scores.reduce((a, b) => a + b, 0);
          const mean = sum / count;
          const median = count % 2 === 0
            ? (scores[count / 2 - 1] + scores[count / 2]) / 2
            : scores[Math.floor(count / 2)];
          const passes = scores.filter(s => s >= 50).length;
          const passRate = (passes / count) * 100;
          return {
            name,
            mean: Math.round(mean),
            median: Math.round(median),
            highest: Math.round(scores[count - 1]),
            lowest: Math.round(scores[0]),
            passRate: Math.round(passRate),
            studentCount: count,
            students: [...students].sort((a, b) => b.percentage - a.percentage),
          };
        }).sort((a, b) => b.mean - a.mean);

        setSubjectStats(dbSubjStats);

        // ── Merit list: rank students by mean % across their subjects ──
        const perStudent: Record<string, { name: string; adm: string; sum: number; count: number }> = {};
        marks.forEach((m: { admission_number?: string; student_name?: string; percentage: number }) => {
          const key = m.admission_number || m.student_name || 'unknown';
          if (!perStudent[key]) {
            perStudent[key] = { name: m.student_name || 'Unknown', adm: m.admission_number || '', sum: 0, count: 0 };
          }
          perStudent[key].sum += Number(m.percentage);
          perStudent[key].count += 1;
        });
        const ranked = Object.values(perStudent)
          .map(s => ({ studentName: s.name, admissionNumber: s.adm, average: s.sum / s.count, subjectCount: s.count }))
          .sort((a, b) => b.average - a.average);
        // Standard competition ranking: ties share a rank
        let lastAvg = Number.NaN;
        let lastRank = 0;
        setMeritList(ranked.map((s, i) => {
          const rank = s.average === lastAvg ? lastRank : i + 1;
          lastAvg = s.average;
          lastRank = rank;
          return { ...s, rank };
        }));
        setShowFullMerit(false);
      } catch (err) {
        console.error('Analytics fetch error:', err);
      }

      setLoading(false);
    };

    fetchAnalytics();
  }, [selectedStreamId]);

  const totalStudents = subjectStats.reduce((sum, s) => sum + s.studentCount, 0);

  const examAverages = trendData.map(row => {
    const scores = trendSubjects.map(s => row[s]).filter((v): v is number => v != null);
    const avg = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;
    return { examName: row.examName, average: avg };
  });

  const improvement = examAverages.length >= 2
    ? examAverages[examAverages.length - 1].average - examAverages[0].average
    : 0;

  const bestSubject = subjectStats[0];
  const weakestSubject = subjectStats[subjectStats.length - 1];
  const atRiskSubjects = subjectStats.filter(s => s.passRate < 70);
  const strongSubjects = subjectStats.filter(s => s.passRate >= 85);
  const atRiskCount = atRiskSubjects.length;

  const subjectBarData = subjectStats.map(s => ({
    name: s.name,
    mean: s.mean,
    passRate: s.passRate,
  }));

  const statusColor = (mean: number) => {
    if (mean >= 70) return 'var(--viz-good)';
    if (mean >= 50) return 'var(--viz-warn)';
    return 'var(--viz-bad)';
  };
  const statusBg = (mean: number) => `color-mix(in srgb, ${statusColor(mean)} 12%, transparent)`;
  const statusLabel = (mean: number) => {
    if (mean >= 70) return 'Strong';
    if (mean >= 50) return 'Average';
    return 'At Risk';
  };

  const downloadMeritCsv = () => {
    const className = selectedStreamId === 'all'
      ? 'All Classes'
      : gradeStreams.find(g => g.id === selectedStreamId)?.full_name || 'Class';
    const header = 'Rank,Student,Admission No,Average %,Subjects';
    const rows = meritList.map(r =>
      `${r.rank},"${r.studentName.replace(/"/g, '""')}",${r.admissionNumber},${r.average.toFixed(1)},${r.subjectCount}`
    );
    const blob = new Blob([`Merit List — ${className}\n${header}\n${rows.join('\n')}\n`], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Merit_List_${className.replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="px-4 sm:px-6" style={{ maxWidth: 1120, margin: '0 auto', paddingBottom: 48 }}>
      <style>{`
        .chart-inner { height: 260px; }
        @media (max-width: 480px) { .chart-inner { height: 220px; } }
        @media (min-width: 481px) and (max-width: 768px) { .chart-inner { height: 240px; } }
      `}</style>
      <div className="flex flex-col gap-5 mb-6">
        <div className="flex flex-col gap-1">
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.03em' }}>
            Analytics
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: 0 }}>
            Class performance overview and subject insights
          </p>
        </div>
        <select
          className="w-full md:max-w-[260px]"
          style={{
            height: 36,
            padding: '0 32px 0 12px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--card)',
            color: 'var(--foreground)',
            fontSize: 13,
            fontWeight: 500,
            appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2394A3B8' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10l-5 5z'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 10px center',
            cursor: 'pointer',
          }}
          value={selectedStreamId}
          onChange={(e) => setSelectedStreamId(e.target.value)}
        >
          <option value="all">All Classes</option>
          {gradeStreams.map(gs => (
            <option key={gs.id} value={gs.id}>{gs.full_name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <ContentSkeleton message="Analyzing data..." />
      ) : (trendData.length > 0 || gradeData.length > 0) ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
            <KpiCard
              label="Overall Average"
              value={`${classAverage}%`}
              subtitle={totalStudents > 0 ? `${totalStudents} students` : undefined}
              color="var(--primary)"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>}
            />
            {bestSubject && (
              <KpiCard
                label="Best Subject"
                value={bestSubject.name}
                subtitle={`${bestSubject.mean}% mean`}
                color="var(--color-success)"
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>}
              />
            )}
            {weakestSubject && (
              <KpiCard
                label="Weakest Subject"
                value={weakestSubject.name}
                subtitle={`${weakestSubject.mean}% mean`}
                color="var(--color-danger)"
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>}
              />
            )}
            <KpiCard
              label="At Risk"
              value={`${atRiskCount}`}
              subtitle={atRiskCount === 1 ? 'subject below threshold' : 'subjects below threshold'}
              color={atRiskCount > 0 ? 'var(--color-danger)' : 'var(--color-success)'}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={atRiskCount > 0 ? 'var(--color-danger)' : 'var(--color-success)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>}
            />
            <KpiCard
              label="Improvement"
              value={improvement >= 0 ? `+${improvement}%` : `${improvement}%`}
              subtitle={examAverages.length >= 2 ? 'first to last exam' : 'need 2+ exams'}
              color={improvement >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={improvement >= 0 ? 'var(--color-success)' : 'var(--color-danger)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{improvement >= 0 ? <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></> : <><polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" /></>}</svg>}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div className="chart-card">
              <PerformanceTrendChart
                data={examAverages}
                improvement={improvement}
                classAverage={classAverage}
              />
            </div>
            <div className="chart-card">
              <SubjectComparisonChart data={subjectBarData} />
            </div>
          </div>

          <div className="mb-5">
            <InsightsPanel
              strongSubjects={strongSubjects}
              atRiskSubjects={atRiskSubjects}
              allSubjects={subjectStats}
              classAverage={classAverage}
              improvement={improvement}
            />
          </div>

          {/* ── Merit List ── */}
          {meritList.length > 0 && (
            <div className="mb-5 overflow-hidden rounded-2xl border border-border/60 bg-card/90 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-4">
                <div>
                  <h3 className="text-[15px] font-bold text-foreground">Merit List</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Students ranked by mean score across their subjects
                    {selectedStreamId !== 'all' && gradeStreams.find(g => g.id === selectedStreamId)
                      ? ` — ${gradeStreams.find(g => g.id === selectedStreamId)?.full_name}` : ''}
                  </p>
                </div>
                <button className="btn-secondary text-xs px-3 py-1.5" onClick={downloadMeritCsv}>
                  ⬇ Export CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b-2 border-border">
                      <th className="w-14 px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Rank</th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Student</th>
                      <th className="hidden px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground sm:table-cell">Adm No</th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Average</th>
                      <th className="hidden px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground sm:table-cell">Subjects</th>
                      <th className="px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(showFullMerit ? meritList : meritList.slice(0, 10)).map(r => (
                      <tr key={`${r.admissionNumber}-${r.studentName}`} className={`border-b border-border/50 last:border-0 ${r.rank <= 3 ? 'bg-primary/5' : ''}`}>
                        <td className="px-3 py-2.5 font-bold text-foreground">
                          {r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : ''} {r.rank}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-foreground">
                          <div>{r.studentName}</div>
                          <div className="font-mono text-[11px] font-normal text-muted-foreground sm:hidden">{r.admissionNumber}</div>
                        </td>
                        <td className="hidden px-3 py-2.5 font-mono text-xs text-muted-foreground sm:table-cell">{r.admissionNumber}</td>
                        <td className="px-3 py-2.5 text-right font-bold tabular-nums text-foreground">{r.average.toFixed(1)}%</td>
                        <td className="hidden px-3 py-2.5 text-center text-muted-foreground sm:table-cell">{r.subjectCount}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="inline-block rounded-md px-2.5 py-0.5 text-[11px] font-bold" style={{ background: statusBg(r.average), color: statusColor(r.average) }}>
                            {statusLabel(r.average)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {meritList.length > 10 && (
                <button
                  className="w-full cursor-pointer border-t border-border/50 py-2.5 text-center text-xs font-semibold text-primary transition-colors hover:bg-muted/40"
                  onClick={() => setShowFullMerit(v => !v)}
                >
                  {showFullMerit ? 'Show top 10 only' : `Show all ${meritList.length} students`}
                </button>
              )}
            </div>
          )}

          {subjectStats.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/90 shadow-sm">
              <div className="px-5 pb-3 pt-4">
                <h3 className="text-[15px] font-bold text-foreground">Detailed Results</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">Tap a row to expand student scores</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b-2 border-border">
                      <th className="w-7 px-2 py-2.5"></th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Subject</th>
                      <th className="w-16 px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Mean</th>
                      <th className="hidden w-16 px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground sm:table-cell">Median</th>
                      <th className="hidden w-16 px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground md:table-cell">Highest</th>
                      <th className="hidden w-16 px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground md:table-cell">Lowest</th>
                      <th className="hidden w-20 px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground sm:table-cell">Pass Rate</th>
                      <th className="hidden w-16 px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground md:table-cell">Students</th>
                      <th className="w-20 px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjectStats.map((s, i) => (
                      <React.Fragment key={i}>
                        <tr
                          onClick={() => setExpandedSubject(expandedSubject === s.name ? null : s.name)}
                          className="cursor-pointer border-b border-border/50 transition-colors last:border-0 hover:bg-muted/40"
                        >
                          <td className="px-2 py-2.5 text-center text-[10px] text-muted-foreground">
                            {expandedSubject === s.name ? '▼' : '▶'}
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-foreground">
                            <div>{s.name}</div>
                            <div className="truncate text-[11px] font-normal text-muted-foreground sm:hidden">Pass {s.passRate}%</div>
                          </td>
                          <td className="px-3 py-2.5 text-center font-bold tabular-nums text-foreground">{s.mean}%</td>
                          <td className="hidden px-3 py-2.5 text-center tabular-nums text-muted-foreground sm:table-cell">{s.median}%</td>
                          <td className="hidden px-3 py-2.5 text-center font-semibold tabular-nums md:table-cell" style={{ color: 'var(--viz-good)' }}>{s.highest}%</td>
                          <td className="hidden px-3 py-2.5 text-center font-semibold tabular-nums md:table-cell" style={{ color: 'var(--viz-bad)' }}>{s.lowest}%</td>
                          <td className="hidden px-3 py-2.5 text-center font-semibold tabular-nums sm:table-cell">{s.passRate}%</td>
                          <td className="hidden px-3 py-2.5 text-center tabular-nums text-muted-foreground md:table-cell">{s.studentCount}</td>
                          <td className="px-3 py-2.5 text-center">
                            <span className="inline-block rounded-md px-2.5 py-0.5 text-[11px] font-bold" style={{ background: statusBg(s.mean), color: statusColor(s.mean) }}>
                              {statusLabel(s.mean)}
                            </span>
                          </td>
                        </tr>
                        {expandedSubject === s.name && (
                          <tr>
                            <td colSpan={9} className="p-0" style={{ width: 0 }}>
                              <div className="border-b border-border bg-muted/40 px-4 py-3.5 sm:px-5" style={{ minWidth: '100%' }}>
                                <div className="overflow-x-auto">
                                  <table className="w-full border-collapse text-sm">
                                    <thead>
                                      <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                        <th className="w-6 px-2.5 py-1.5 text-left">#</th>
                                        <th className="px-2.5 py-1.5 text-left">Student</th>
                                        <th className="hidden w-24 px-2.5 py-1.5 text-left sm:table-cell">Adm No</th>
                                        <th className="w-16 px-2.5 py-1.5 text-center">Score</th>
                                        <th className="w-16 px-2.5 py-1.5 text-center">Grade</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {s.students.map((st, idx) => (
                                        <tr key={idx} className="border-b border-border/50 last:border-0">
                                          <td className="px-2.5 py-1.5 text-muted-foreground">{idx + 1}</td>
                                          <td className="px-2.5 py-1.5 font-medium text-foreground">
                                            <div>{st.studentName}</div>
                                            <div className="truncate font-mono text-[11px] font-normal text-muted-foreground sm:hidden">{st.admissionNumber}</div>
                                          </td>
                                          <td className="hidden px-2.5 py-1.5 text-muted-foreground sm:table-cell">{st.admissionNumber}</td>
                                          <td className="px-2.5 py-1.5 text-center font-bold tabular-nums text-foreground">{Math.round(st.percentage)}%</td>
                                          <td className="px-2.5 py-1.5 text-center">
                                            <span
                                              className="inline-block rounded px-2 py-0.5 text-xs font-bold"
                                              style={{ background: statusBg(st.percentage), color: statusColor(st.percentage) }}
                                            >
                                              {st.gradeSymbol}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: '48px 24px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: 'color-mix(in oklch, var(--foreground) 5%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
          </div>
          <p style={{ fontWeight: 600, fontSize: 15, color: 'var(--foreground)', margin: 0 }}>No mark data available</p>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: 0 }}>Enter marks for exams to see performance analytics here.</p>
        </div>
      )}
    </div>
  );
}
