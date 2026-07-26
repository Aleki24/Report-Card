"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { ContentSkeleton } from '@/components/dashboard/LoadingSkeleton';

interface Grade { id: string; name_display: string; academic_level_id: string; numeric_order: number }
interface Stream { id: string; full_name: string; grade_id: string }
interface SubjectRow { id: string; name: string; code: string; teacher_user_id: string | null }
interface StaffOption { id: string; name: string }

/**
 * Who teaches each subject in a class.
 *
 * The teacher's name printed against a subject on report cards and the class
 * marksheet comes from this mapping. It could previously only be set while
 * inviting a teacher, so a subject whose teacher was never assigned — or who
 * has since changed — printed no name with nowhere to fix it. Each row saves
 * on change, because an admin correcting one subject shouldn't have to hunt
 * for a save button.
 */
export function SubjectTeachersTab({ grades, streams }: { grades: Grade[]; streams: Stream[] }) {
    const [gradeId, setGradeId] = useState('');
    const [streamId, setStreamId] = useState('');
    const [subjects, setSubjects] = useState<SubjectRow[]>([]);
    const [staff, setStaff] = useState<StaffOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [savingId, setSavingId] = useState<string | null>(null);

    const gradeStreams = streams.filter(s => s.grade_id === gradeId);

    const load = useCallback(async () => {
        if (!gradeId) { setSubjects([]); return; }
        setLoading(true);
        try {
            const params = new URLSearchParams({ grade_id: gradeId });
            if (streamId) params.set('grade_stream_id', streamId);
            const res = await fetch(`/api/admin/subject-teachers?${params.toString()}`, { cache: 'no-store' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to load');
            setSubjects(json.subjects || []);
            setStaff(json.staff || []);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to load subject teachers');
            setSubjects([]);
        } finally {
            setLoading(false);
        }
    }, [gradeId, streamId]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { setStreamId(''); }, [gradeId]);

    const assign = async (subjectId: string, teacherUserId: string) => {
        const previous = subjects;
        // Optimistic: the select shouldn't snap back while the request is out.
        setSubjects(prev => prev.map(s => (s.id === subjectId ? { ...s, teacher_user_id: teacherUserId || null } : s)));
        setSavingId(subjectId);
        try {
            const res = await fetch('/api/admin/subject-teachers', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject_id: subjectId,
                    grade_id: gradeId,
                    grade_stream_id: streamId || null,
                    teacher_user_id: teacherUserId || null,
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to save');
        } catch (err) {
            setSubjects(previous);
            toast.error(err instanceof Error ? err.message : 'Could not save that change');
        } finally {
            setSavingId(null);
        }
    };

    const assignedCount = subjects.filter(s => s.teacher_user_id).length;

    return (
        <div className="card p-5">
            <h3 className="font-bold text-base font-[family-name:var(--font-display)] mb-1">Subject Teachers</h3>
            <p className="text-xs text-muted-foreground mb-4">
                The teacher set here is the name printed against each subject on report cards and the class marksheet.
                Leave a subject blank and it simply prints no name.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="flex-1">
                    <label className="block text-xs text-muted-foreground mb-1">Class *</label>
                    <select className="input-field w-full" value={gradeId} onChange={e => setGradeId(e.target.value)}>
                        <option value="">-- Select class --</option>
                        {[...grades].sort((a, b) => a.numeric_order - b.numeric_order).map(g => (
                            <option key={g.id} value={g.id}>{g.name_display}</option>
                        ))}
                    </select>
                </div>
                <div className="flex-1">
                    <label className="block text-xs text-muted-foreground mb-1">Stream (optional)</label>
                    <select className="input-field w-full" value={streamId} onChange={e => setStreamId(e.target.value)} disabled={!gradeId || gradeStreams.length === 0}>
                        <option value="">All streams in this class</option>
                        {gradeStreams.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                    </select>
                    <p className="text-[10px] text-muted-foreground mt-1">
                        Pick a stream only when a subject has a different teacher there.
                    </p>
                </div>
            </div>

            {!gradeId ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Select a class to set its subject teachers.</p>
            ) : loading ? (
                <ContentSkeleton message="Loading subjects..." />
            ) : subjects.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No subjects configured for this class&apos;s curriculum.</p>
            ) : (
                <>
                    <div className="text-xs text-muted-foreground mb-2">{assignedCount} of {subjects.length} subjects have a teacher</div>
                    <div className="overflow-x-auto border border-border rounded-lg">
                        <table className="data-table w-full text-left">
                            <thead className="bg-muted border-b border-border">
                                <tr>
                                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Subject</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Code</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Teacher</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-border)]">
                                {subjects.map(subject => (
                                    <tr key={subject.id} className="hover:bg-muted/50 transition-colors">
                                        <td className="px-4 py-2.5 text-sm font-medium">{subject.name}</td>
                                        <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground">{subject.code || '—'}</td>
                                        <td className="px-4 py-2.5">
                                            <select
                                                className="input-field text-xs w-full max-w-[240px]"
                                                value={subject.teacher_user_id || ''}
                                                onChange={e => assign(subject.id, e.target.value)}
                                                disabled={savingId === subject.id}
                                            >
                                                <option value="">— No teacher —</option>
                                                {staff.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}
