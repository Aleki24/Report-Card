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
        <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.03em' }}>
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
    if (mean >= 70) return 'var(--color-success)';
    if (mean >= 50) return 'var(--color-warning)';
    return 'var(--color-danger)';
  };
  const statusBg = (mean: number) => {
    if (mean >= 70) return 'color-mix(in oklch, var(--color-success) 10%, transparent)';
    if (mean >= 50) return 'color-mix(in oklch, var(--color-warning) 10%, transparent)';
    return 'color-mix(in oklch, var(--color-danger) 10%, transparent)';
  };
  const statusLabel = (mean: number) => {
    if (mean >= 70) return 'Strong';
    if (mean >= 50) return 'Average';
    return 'At Risk';
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

          {subjectStats.length > 0 && (
            <div style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              overflow: 'hidden',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '18px 22px 12px',
              }}>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
                    Detailed Results
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>
                    Click a row to expand student scores
                  </p>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  minWidth: 700,
                  fontSize: 13,
                }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      <th style={{ width: 28, padding: '10px 8px' }}></th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Subject</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Mean</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Median</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Highest</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Lowest</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pass Rate</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Students</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjectStats.map((s, i) => (
                      <React.Fragment key={i}>
                        <tr
                          onClick={() => setExpandedSubject(expandedSubject === s.name ? null : s.name)}
                          style={{
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--border)',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'color-mix(in oklch, var(--foreground) 3%, transparent)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <td style={{ textAlign: 'center', padding: '10px 8px', fontSize: 10, color: 'var(--color-border-subtle)' }}>
                            {expandedSubject === s.name ? '▼' : '▶'}
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--foreground)' }}>{s.name}</td>
                          <td style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 700, color: 'var(--foreground)' }}>{s.mean}%</td>
                          <td style={{ textAlign: 'center', padding: '10px 12px', color: 'var(--muted-foreground)' }}>{s.median}%</td>
                          <td style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 600, color: 'var(--color-success)' }}>{s.highest}%</td>
                          <td style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 600, color: 'var(--color-danger)' }}>{s.lowest}%</td>
                          <td style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 600 }}>{s.passRate}%</td>
                          <td style={{ textAlign: 'center', padding: '10px 12px', color: 'var(--muted-foreground)' }}>{s.studentCount}</td>
                          <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 10px',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              background: statusBg(s.mean),
                              color: statusColor(s.mean),
                            }}>
                              {statusLabel(s.mean)}
                            </span>
                          </td>
                        </tr>
                        {expandedSubject === s.name && (
                          <tr>
                            <td colSpan={9} style={{ padding: 0 }}>
                              <div style={{
                                background: 'color-mix(in oklch, var(--foreground) 3%, transparent)',
                                padding: '14px 20px',
                                borderBottom: '1px solid var(--border)',
                              }}>
                                <div style={{ overflowX: 'auto' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                    <thead>
                                      <tr style={{ color: 'var(--muted-foreground)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        <th style={{ textAlign: 'left', padding: '6px 10px' }}>#</th>
                                        <th style={{ textAlign: 'left', padding: '6px 10px' }}>Student</th>
                                        <th style={{ textAlign: 'left', padding: '6px 10px' }}>Adm No</th>
                                        <th style={{ textAlign: 'center', padding: '6px 10px' }}>Score</th>
                                        <th style={{ textAlign: 'center', padding: '6px 10px' }}>Grade</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {s.students.map((st, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                          <td style={{ padding: '6px 10px', color: 'var(--muted-foreground)' }}>{idx + 1}</td>
                                          <td style={{ padding: '6px 10px', fontWeight: 500, color: 'var(--foreground)' }}>{st.studentName}</td>
                                          <td style={{ padding: '6px 10px', color: 'var(--muted-foreground)' }}>{st.admissionNumber}</td>
                                          <td style={{ textAlign: 'center', padding: '6px 10px', fontWeight: 700, color: 'var(--foreground)' }}>{Math.round(st.percentage)}%</td>
                                          <td style={{ textAlign: 'center', padding: '6px 10px' }}>
                                            <span style={{
                                              display: 'inline-block',
                                              padding: '2px 8px',
                                              borderRadius: 5,
                                              fontSize: 12,
                                              fontWeight: 700,
                                              background: st.percentage >= 70 ? 'color-mix(in oklch, var(--color-success) 10%, transparent)' : st.percentage >= 50 ? 'color-mix(in oklch, var(--color-warning) 10%, transparent)' : 'color-mix(in oklch, var(--color-danger) 10%, transparent)',
                                              color: st.percentage >= 70 ? 'var(--color-success)' : st.percentage >= 50 ? 'var(--color-warning)' : 'var(--color-danger)',
                                            }}>
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
