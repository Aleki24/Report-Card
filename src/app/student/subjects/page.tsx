"use client";

import React, { useEffect, useState } from 'react';
import { BookOpen, Search, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import PageHeader from '@/components/dashboard/PageHeader';
import DashboardCard from '@/components/dashboard/DashboardCard';
import EmptyState from '@/components/dashboard/EmptyState';
import { Badge, Input } from '@/components/ui';

interface Subject {
    id: string;
    name: string;
    code: string | null;
    category: string | null;
    subject_type: 'CORE' | 'ESSENTIAL' | 'OPTIONAL' | null;
    enrollment_role?: 'CORE' | 'ELECTIVE';
}

const TONE_ICON_BG = ['bg-blue-500/12 text-blue-600', 'bg-emerald-500/12 text-emerald-600', 'bg-amber-500/12 text-amber-600', 'bg-primary/12 text-primary', 'bg-red-500/12 text-red-600'];

function typeBadge(type: Subject['subject_type']) {
    if (type === 'CORE') return <Badge variant="success">Core</Badge>;
    if (type === 'ESSENTIAL') return <Badge variant="info">Essential</Badge>;
    return <Badge variant="default">Optional</Badge>;
}

export default function StudentSubjectsPage() {
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetch('/api/school/student/subjects').then(r => r.json()).then(j => setSubjects(j.data || [])).catch(() => {}).finally(() => setLoading(false));
    }, []);

    const filtered = subjects.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.code?.toLowerCase().includes(search.toLowerCase()));

    if (loading) {
        return (
            <div className="mx-auto max-w-[1100px]">
                <div className="skeleton-bone mb-6 h-6 w-[30%] rounded-md" />
                <div className="grid grid-cols-1 gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr))]">
                    {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="skeleton-bone h-[120px] rounded-2xl" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-[1100px] pb-10">
            <PageHeader title="My Subjects" description="Select a subject to view detailed performance, assignments, and notes." />

            <div className="mb-6 flex max-w-[400px] items-center gap-2 rounded-xl border border-border bg-muted px-4 py-2.5">
                <Search size={18} className="text-muted-foreground" />
                <Input
                    type="text"
                    placeholder="Search subjects..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="border-none bg-transparent p-0 shadow-none focus-visible:ring-0"
                />
            </div>

            {filtered.length === 0 ? (
                <EmptyState icon={<BookOpen className="h-6 w-6" />} title="No subjects found" description="No subjects match your search or are assigned to your level." />
            ) : (
                <div className="grid grid-cols-1 gap-5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr))]">
                    {filtered.map((s, i) => (
                        <Link key={s.id} href={`/student/subjects/${s.id}`} className="block no-underline">
                            <DashboardCard hoverable className="flex h-full flex-col">
                                <div className="mb-4 flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${TONE_ICON_BG[i % TONE_ICON_BG.length]}`}>
                                            <BookOpen size={20} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="truncate text-[15px] font-bold text-foreground">{s.name}</div>
                                            <div className="text-xs font-semibold text-muted-foreground">{s.code || 'No Code'}</div>
                                        </div>
                                    </div>
                                    <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
                                </div>

                                <div className="mt-auto flex flex-wrap gap-2">
                                    {typeBadge(s.subject_type)}
                                    {s.category && <Badge variant="default">{s.category}</Badge>}
                                    {s.enrollment_role === 'ELECTIVE' && <Badge variant="info">My Elective</Badge>}
                                </div>
                            </DashboardCard>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
