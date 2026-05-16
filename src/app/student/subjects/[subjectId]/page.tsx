"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
    ArrowLeft, BookOpen, User, FileText, UploadCloud, 
    DownloadCloud, Calendar, MessageSquare, TrendingUp
} from 'lucide-react';
import { PerformanceTrendChart } from '@/components/charts/PerformanceTrend';

export default function SubjectAnalysisPage() {
    const params = useParams();
    const router = useRouter();
    const subjectId = params.subjectId as string;
    
    const [subject, setSubject] = useState<any>(null);
    const [performance, setPerformance] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            fetch('/api/school/student/subjects').then(r => r.json()),
            fetch('/api/school/student/performance').then(r => r.json())
        ]).then(([subRes, perfRes]) => {
            const subs = subRes.data || [];
            const found = subs.find((s: any) => s.id === subjectId);
            setSubject(found);

            if (found && perfRes.data) {
                // Map the performance data to only include this subject
                const trendData = perfRes.data.map((term: any) => {
                    const subjectMark = term.subjects.find((s: any) => s.subjectName === found.name);
                    return {
                        examName: `${term.termName} ${term.yearName}`.trim(),
                        [found.name]: subjectMark ? subjectMark.percentage : null
                    };
                }).filter((t: any) => t[found.name] !== null);
                
                setPerformance(trendData);
            }
            setLoading(false);
        }).catch(() => {
            setLoading(false);
        });
    }, [subjectId]);

    if (loading) return (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 0' }}>
            <div className="skeleton-spinner" style={{ margin: '0 auto' }} />
        </div>
    );

    if (!subject) return (
        <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center', padding: '100px 0' }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: '#1E293B', marginBottom: 8 }}>Subject Not Found</h2>
            <p style={{ color: '#64748B', marginBottom: 24 }}>The subject you are looking for does not exist or you don't have access to it.</p>
            <button onClick={() => router.back()} className="btn-secondary">Go Back</button>
        </div>
    );

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 'var(--space-10)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
                <button 
                    onClick={() => router.back()} 
                    style={{ width: 40, height: 40, borderRadius: '50%', background: '#F1F5F9', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748B' }}
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, color: '#1E293B', marginBottom: 4 }}>
                        {subject.name}
                    </h1>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <span style={{ fontSize: 13, color: '#64748B', fontWeight: 600 }}>{subject.code || 'No Code'}</span>
                        <span style={{ 
                            padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                            background: subject.is_compulsory ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                            color: subject.is_compulsory ? '#10B981' : '#3B82F6'
                        }}>
                            {subject.is_compulsory ? 'Compulsory' : 'Elective'}
                        </span>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
                {/* Performance Trend */}
                <div className="premium-card" style={{ gridColumn: '1 / -1' }}>
                    <div className="premium-card-header">
                        <div className="premium-card-title">
                            <TrendingUp size={18} color="#3B82F6" />
                            Performance Analysis
                        </div>
                    </div>
                    <div style={{ height: 300, width: '100%', marginTop: 16 }}>
                        {performance.length > 1 ? (
                            <PerformanceTrendChart data={performance} subjects={[subject.name]} />
                        ) : (
                            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 14, textAlign: 'center', padding: 20 }}>
                                <TrendingUp size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
                                Need more than one term of results to show a performance trend for {subject.name}.
                            </div>
                        )}
                    </div>
                </div>

                {/* Teacher Info */}
                <div className="premium-card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="premium-card-header">
                        <div className="premium-card-title">
                            <User size={18} color="#10B981" />
                            Subject Teacher
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16, padding: 16, background: '#F8FAFC', borderRadius: 12, border: '1px solid #E2E8F0' }}>
                        <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, fontWeight: 700 }}>
                            T
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#1E293B' }}>Teacher Name</div>
                            <div style={{ fontSize: 12, color: '#64748B' }}>Department of {subject.category || 'Science'}</div>
                        </div>
                        <button style={{ width: 36, height: 36, borderRadius: '50%', background: '#EFF6FF', color: '#3B82F6', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                            <MessageSquare size={18} />
                        </button>
                    </div>
                </div>

                {/* Assignments & Homework */}
                <div className="premium-card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="premium-card-header">
                        <div className="premium-card-title">
                            <FileText size={18} color="#F59E0B" />
                            Active Assignments
                        </div>
                        <button className="premium-card-action">View All</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, border: '1px solid rgba(0,0,0,0.04)', borderRadius: 12 }}>
                            <div style={{ width: 36, height: 36, background: '#FFF7ED', color: '#F59E0B', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <FileText size={16} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>Chapter 5 Questions</div>
                                <div style={{ fontSize: 11, color: '#EF4444', marginTop: 2, fontWeight: 600 }}>Due Tomorrow</div>
                            </div>
                            <button style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#3B82F6', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                                <UploadCloud size={14} /> Submit
                            </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, border: '1px solid rgba(0,0,0,0.04)', borderRadius: 12 }}>
                            <div style={{ width: 36, height: 36, background: '#F1F5F9', color: '#64748B', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <FileText size={16} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#64748B' }}>Practical Report</div>
                                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2, fontWeight: 600 }}>Submitted</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Learning Materials */}
                <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gridColumn: '1 / -1' }}>
                    <div className="premium-card-header">
                        <div className="premium-card-title">
                            <BookOpen size={18} color="#8B5CF6" />
                            Learning Materials & Notes
                        </div>
                        <button className="premium-card-action">View All</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 16, marginTop: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: 16, background: '#F8FAFC', borderRadius: 12, border: '1px solid #E2E8F0' }}>
                            <div style={{ width: 44, height: 44, background: 'rgba(139, 92, 246, 0.1)', color: '#8B5CF6', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <FileText size={20} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B', marginBottom: 4 }}>Term 1 Revision Guide</div>
                                <div style={{ fontSize: 12, color: '#64748B', marginBottom: 8 }}>Comprehensive notes covering all topics.</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>PDF · 4.2 MB</span>
                                    <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>Uploaded 2 weeks ago</span>
                                </div>
                            </div>
                            <button style={{ width: 36, height: 36, borderRadius: '50%', background: '#fff', border: '1px solid #E2E8F0', color: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                <DownloadCloud size={16} />
                            </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: 16, background: '#F8FAFC', borderRadius: 12, border: '1px solid #E2E8F0' }}>
                            <div style={{ width: 44, height: 44, background: 'rgba(139, 92, 246, 0.1)', color: '#8B5CF6', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <FileText size={20} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B', marginBottom: 4 }}>Topic 4 Presentation</div>
                                <div style={{ fontSize: 12, color: '#64748B', marginBottom: 8 }}>Slides used in class.</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>PPTX · 8.1 MB</span>
                                    <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>Uploaded 1 month ago</span>
                                </div>
                            </div>
                            <button style={{ width: 36, height: 36, borderRadius: '50%', background: '#fff', border: '1px solid #E2E8F0', color: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                <DownloadCloud size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
