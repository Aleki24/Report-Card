"use client";

import React, { useEffect, useState } from 'react';
import { BookOpen, Search, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function StudentSubjectsPage() {
    const [subjects, setSubjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetch('/api/school/student/subjects').then(r => r.json()).then(j => setSubjects(j.data || [])).catch(() => {}).finally(() => setLoading(false));
    }, []);

    const filtered = subjects.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.code?.toLowerCase().includes(search.toLowerCase()));

    if (loading) return (
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div className="skeleton-bone" style={{ width: '30%', height: 22, borderRadius: 6, marginBottom: 24 }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: 'var(--space-4)' }}>
                {[1,2,3,4,5,6].map(i => <div key={i} className="student-skeleton-card" style={{ height: 120 }} />)}
            </div>
        </div>
    );

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 'var(--space-10)' }}>
            <div className="student-page-header">
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800, color: 'var(--foreground)', marginBottom: 4 }}>
                    My Subjects
                </h1>
                <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>
                    Select a subject to view detailed performance, assignments, and notes.
                </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-6)', padding: '10px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--muted)', maxWidth: 400 }}>
                <Search size={18} color="var(--muted-foreground)" />
                <input type="text" placeholder="Search subjects..." value={search} onChange={e => setSearch(e.target.value)} style={{ border: 'none', outline: 'none', background: 'transparent', color: 'var(--foreground)', fontSize: 14, width: '100%', fontWeight: 500 }} />
            </div>

            {filtered.length === 0 ? (
                <div className="premium-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <BookOpen size={48} style={{ color: 'var(--muted-foreground)', marginBottom: 16, margin: '0 auto', opacity: 0.5 }} />
                    <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', marginBottom: 4 }}>No subjects found</p>
                    <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>No subjects match your search or are assigned to your level.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: 'var(--space-5)' }}>
                    {filtered.map((s, i) => {
                        const colors = ['var(--viz-info)', 'var(--viz-good)', 'var(--viz-warn)', 'var(--primary)', 'var(--viz-bad)'];
                        const c = colors[i % colors.length];
                        return (
                            <Link key={s.id} href={`/student/subjects/${s.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                                <div className="premium-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 20, transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer' }}
                                     onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.05)'; }}
                                     onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; }}>
                                    
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                            <div style={{ width: 44, height: 44, borderRadius: 12, background: `color-mix(in srgb, ${c} 15%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c, flexShrink: 0 }}>
                                                <BookOpen size={20} />
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                                                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 600 }}>{s.code || 'No Code'}</div>
                                            </div>
                                        </div>
                                        <ChevronRight size={18} color="var(--muted-foreground)" />
                                    </div>
                                    
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 'auto' }}>
                                        <span style={{ 
                                            padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                                            background: s.subject_type === 'CORE' ? 'color-mix(in srgb, var(--viz-good) 10%, transparent)' : s.subject_type === 'ESSENTIAL' ? 'color-mix(in srgb, var(--viz-info) 10%, transparent)' : 'color-mix(in srgb, var(--viz-warn) 10%, transparent)',
                                            color: s.subject_type === 'CORE' ? 'var(--viz-good)' : s.subject_type === 'ESSENTIAL' ? 'var(--viz-info)' : 'var(--viz-warn)'
                                        }}>
                                            {s.subject_type === 'CORE' ? 'Core' : s.subject_type === 'ESSENTIAL' ? 'Essential' : 'Optional'}
                                        </span>
                                        {s.category && (
                                            <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                                                {s.category}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
