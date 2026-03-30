"use client";

import React, { useState, useEffect } from 'react';
import { PerformanceTrendChart } from '@/components/charts/PerformanceTrend';
import { GradeDistributionChart } from '@/components/charts/GradeDistribution';

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

  // ── Fetch grade streams via school-scoped API ──────────────
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

  // ── Fetch analytics data via server API ────────────────────
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

        // ── Grade Distribution ─────────────────────────────
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

        // ── Performance Trend ──────────────────────────────
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

        // ── Subject Stats ──────────────────────────────────
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

  return (
    <div className="w-full max-w-7xl mx-auto pb-10">
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4" style={{ marginBottom: 'var(--space-8)' }}>
        <div>
          <h1 style={{ fontSize: 28, marginBottom: 'var(--space-2)' }} className="font-bold font-[family-name:var(--font-display)]">Analytics</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
            Subject performance, grade distribution, and trend analysis
          </p>
        </div>
        <select
          className="input-field w-full md:w-[240px]"
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
        <div className="p-12 text-center text-[var(--color-text-muted)]">Analyzing data...</div>
      ) : (trendData.length > 0 || gradeData.length > 0) ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
            <PerformanceTrendChart
              data={trendData.length > 0 ? trendData : [{ examName: 'No Exams Yet' }]}
              subjects={trendSubjects}
              classAverage={classAverage}
            />
            <GradeDistributionChart data={gradeData.length > 0 ? gradeData : [{ grade: 'N/A', count: 0 }]} />
          </div>

          {subjectStats.length > 0 && (
            <div className="card">
              <h3 style={{ fontSize: 16, marginBottom: 'var(--space-4)' }} className="font-bold font-[family-name:var(--font-display)]">Subject Performance Summary</h3>
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <table className="data-table w-full min-w-[600px] sm:min-w-[700px]">
                  <thead>
                    <tr>
                      <th className="w-8"></th>
                      <th>Subject</th><th>Mean</th><th>Median</th><th>Highest</th><th>Lowest</th><th>Pass Rate</th><th className="whitespace-nowrap">Students</th><th className="whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjectStats.map((s, i) => (
                      <React.Fragment key={i}>
                        <tr style={{ cursor: 'pointer' }} onClick={() => setExpandedSubject(expandedSubject === s.name ? null : s.name)}>
                          <td className="text-center">{expandedSubject === s.name ? '▼' : '▶'}</td>
                          <td style={{ fontWeight: 500 }}>{s.name}</td>
                          <td>{s.mean}%</td>
                          <td>{s.median}%</td>
                          <td style={{ color: 'var(--color-success)' }}>{s.highest}%</td>
                          <td style={{ color: 'var(--color-danger)' }}>{s.lowest}%</td>
                          <td>{s.passRate}%</td>
                          <td>{s.studentCount}</td>
                          <td>
                            <span className={`badge ${s.passRate >= 85 ? 'badge-success' : s.passRate >= 70 ? 'badge-warning' : 'badge-danger'}`}>
                              {s.passRate >= 85 ? 'Strong' : s.passRate >= 70 ? 'Average' : 'At Risk'}
                            </span>
                          </td>
                        </tr>
                        {expandedSubject === s.name && (
                          <tr>
                            <td colSpan={9} className="p-0">
                              <div style={{ background: 'var(--color-surface-raised)', padding: 'var(--space-3)', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)' }}>
                                <div className="overflow-x-auto -mx-3">
                                  <table className="w-full min-w-[400px] text-sm" style={{ borderCollapse: 'collapse' }}>
                                    <thead>
                                      <tr style={{ color: 'var(--color-text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        <th className="text-left p-2">#</th>
                                        <th className="text-left p-2">Student</th>
                                        <th className="text-left p-2">Adm No</th>
                                        <th className="text-center p-2">Score</th>
                                        <th className="text-center p-2">Grade</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {s.students.map((st, idx) => (
                                        <tr key={idx} className="border-b border-[var(--color-border)]">
                                          <td className="p-2 text-[var(--color-text-muted)]">{idx + 1}</td>
                                          <td className="p-2 font-medium">{st.studentName}</td>
                                          <td className="p-2 text-[var(--color-text-muted)]">{st.admissionNumber}</td>
                                          <td className="p-2 text-center font-semibold">{Math.round(st.percentage)}%</td>
                                          <td className="p-2 text-center">{st.gradeSymbol}</td>
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
        <div className="card p-12 text-center text-[var(--color-text-muted)]">
          <img src="https://em-content.zobj.net/source/apple/354/bar-chart_1f4ca.png" alt="Analytics" className="mb-4" style={{ width: 48, height: 48, objectFit: 'contain' }} />
          <p>No mark data available for this selection.</p>
          <p className="text-sm mt-2">Enter marks for exams to see performance analytics here.</p>
        </div>
      )}
    </div>
  );
}
