"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { BookOpen, Search, Plus } from 'lucide-react';
import { ContentSkeleton } from '@/components/dashboard/LoadingSkeleton';

interface Subject {
  id: string;
  name: string;
  code: string;
  category?: string;
  academic_level_id?: string;
  is_compulsory?: boolean;
  grading_system_id?: string | null;
}

interface AcademicLevel {
  id: string;
  code: string;
  name: string;
}

const categoryColors: Record<string, { bg: string; color: string }> = {
  LANGUAGE: { bg: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6' },
  MATHEMATICS: { bg: 'rgba(234, 179, 8, 0.15)', color: '#EAB308' },
  SCIENCE: { bg: 'rgba(16, 185, 129, 0.15)', color: '#10B981' },
  HUMANITY: { bg: 'rgba(139, 92, 246, 0.15)', color: '#8B5CF6' },
  TECHNICAL: { bg: 'rgba(249, 115, 22, 0.15)', color: '#F97316' },
  CREATIVE: { bg: 'rgba(236, 72, 153, 0.15)', color: '#EC4899' },
};

export default function SubjectsPage() {
  const { role } = useAuth();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [academicLevels, setAcademicLevels] = useState<AcademicLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch subjects from the school-scoped academic-structure API
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const res = await fetch('/api/admin/academic-structure');
        if (!res.ok) {
          setError('Failed to load subjects');
          setLoading(false);
          return;
        }
        const json = await res.json();
        setSubjects(json.subjects || []);
        setAcademicLevels(json.academic_levels || []);
      } catch (err) {
        console.error('Failed to fetch subjects:', err);
        setError('Failed to load subjects');
      } finally {
        setLoading(false);
      }
    };
    fetchSubjects();
  }, []);

  const getLevelName = (levelId?: string) => {
    if (!levelId) return '—';
    return academicLevels.find(l => l.id === levelId)?.name || '—';
  };

  const filtered = subjects.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === 'ALL' || (s.category || '').toUpperCase() === categoryFilter;
    return matchSearch && matchCategory;
  });

  const compulsory = subjects.filter(s => s.is_compulsory).length;
  const categories = [...new Set(subjects.map(s => (s.category || 'TECHNICAL').toUpperCase()))];

  if (loading) {
    return <ContentSkeleton message="Loading subjects..." />;
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--color-text-muted)' }}>
        <BookOpen style={{ width: 48, height: 48, margin: '0 auto var(--space-4)', opacity: 0.3 }} />
        <p style={{ fontSize: 14 }}>{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.375rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '4px' }}>Subject Management</h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>Manage subjects, assign teachers, and organize by curriculum.</p>
        </div>
        {role === 'ADMIN' && (
          <button className="btn-primary" style={{ gap: '8px' }}>
            <Plus style={{ width: 16, height: 16 }} /> Add Subject
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
        {[
          { label: 'Total Subjects', value: subjects.length.toString(), sub: 'Registered' },
          { label: 'Compulsory', value: compulsory.toString(), sub: 'Required for all' },
          { label: 'Optional', value: (subjects.length - compulsory).toString(), sub: 'Elective subjects' },
          { label: 'Departments', value: categories.length.toString(), sub: 'Subject categories' },
        ].map((s, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px', maxWidth: '400px' }}>
            <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--color-text-muted)' }} />
            <input className="input-field" placeholder="Search subjects..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '36px' }} />
          </div>
          <select className="input-field" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ width: 'auto', minWidth: '160px' }}>
            <option value="ALL">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-10)', color: 'var(--color-text-muted)' }}>
            <BookOpen style={{ width: 48, height: 48, margin: '0 auto var(--space-4)', opacity: 0.3 }} />
            <p style={{ fontSize: 14 }}>No subjects found.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Subject</th><th>Code</th><th>Category</th><th>Type</th><th>Level</th></tr></thead>
              <tbody>
                {filtered.map(s => {
                  const catKey = (s.category || 'TECHNICAL').toUpperCase();
                  const cat = categoryColors[catKey] || { bg: 'rgba(100,100,100,0.15)', color: 'var(--color-text-muted)' };
                  return (
                    <tr key={s.id}>
                      <td data-label="Subject" style={{ fontWeight: 600 }}>{s.name}</td>
                      <td data-label="Code" style={{ fontFamily: 'monospace', fontSize: 13 }}>{s.code}</td>
                      <td data-label="Category"><span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '999px', fontSize: 11, fontWeight: 600, background: cat.bg, color: cat.color }}>{catKey}</span></td>
                      <td data-label="Type">{s.is_compulsory ? <span className="badge badge-success">Compulsory</span> : <span className="badge badge-warning">Optional</span>}</td>
                      <td data-label="Level" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{getLevelName(s.academic_level_id)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
