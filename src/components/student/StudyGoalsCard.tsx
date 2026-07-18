"use client";

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Target, Plus, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { Modal } from '@/components/ui';
import EmptyState from '@/components/dashboard/EmptyState';

interface Goal {
    id: string;
    title: string;
    targetValue: number | null;
    deadline: string | null;
    completed: boolean;
    subjectName: string | null;
}

interface SubjectOption {
    id: string;
    name: string;
}

function getDeadlineLabel(dateStr: string | null): string | null {
    if (!dateStr) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(dateStr);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'Overdue';
    if (diffDays === 0) return 'Due today';
    if (diffDays === 1) return 'Due tomorrow';
    return `Due in ${diffDays} days`;
}

export default function StudyGoalsCard() {
    const [goals, setGoals] = useState<Goal[]>([]);
    const [subjects, setSubjects] = useState<SubjectOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    const [title, setTitle] = useState('');
    const [subjectId, setSubjectId] = useState('');
    const [targetValue, setTargetValue] = useState('');
    const [deadline, setDeadline] = useState('');

    const fetchGoals = () => {
        fetch('/api/school/student/goals').then(r => r.json()).then(j => setGoals(j.data || [])).catch(() => {}).finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchGoals();
        fetch('/api/school/student/subjects').then(r => r.json()).then(j => setSubjects((j.data || []).map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })))).catch(() => {});
    }, []);

    const resetForm = () => {
        setTitle('');
        setSubjectId('');
        setTargetValue('');
        setDeadline('');
    };

    const handleAddGoal = async () => {
        if (!title.trim()) return;
        setSaving(true);
        try {
            const res = await fetch('/api/school/student/goals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: title.trim(),
                    subject_id: subjectId || null,
                    target_value: targetValue ? Number(targetValue) : null,
                    deadline: deadline || null,
                }),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.error || 'Could not save goal');
            }
            setModalOpen(false);
            resetForm();
            fetchGoals();
            toast.success('Goal added');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not save goal');
        }
        setSaving(false);
    };

    const toggleComplete = async (goal: Goal) => {
        setGoals(prev => prev.map(g => g.id === goal.id ? { ...g, completed: !g.completed } : g));
        try {
            const res = await fetch('/api/school/student/goals', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: goal.id, completed: !goal.completed }),
            });
            if (!res.ok) throw new Error();
        } catch {
            setGoals(prev => prev.map(g => g.id === goal.id ? { ...g, completed: goal.completed } : g));
            toast.error('Could not update goal');
        }
    };

    const deleteGoal = async (id: string) => {
        const prevGoals = goals;
        setGoals(prev => prev.filter(g => g.id !== id));
        try {
            const res = await fetch(`/api/school/student/goals?id=${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error();
        } catch {
            setGoals(prevGoals);
            toast.error('Could not delete goal');
        }
    };

    return (
        <div className="flex h-full flex-col rounded-2xl border border-border/60 bg-card/90 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Target size={18} />
                    </div>
                    <h3 className="text-[15px] font-semibold text-foreground">Study Goals</h3>
                </div>
                <button
                    onClick={() => setModalOpen(true)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-muted px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-muted/70"
                >
                    <Plus size={14} /> Add
                </button>
            </div>

            {loading ? (
                <div className="flex flex-col gap-2">
                    {[1, 2].map(i => <div key={i} className="skeleton-bone h-10 rounded-lg" />)}
                </div>
            ) : goals.length === 0 ? (
                <EmptyState icon={<Target className="h-6 w-6" />} title="No goals yet" description="Set a personal target to stay on track this term." />
            ) : (
                <div className="flex flex-col gap-2">
                    {goals.map((goal) => {
                        const deadlineLabel = getDeadlineLabel(goal.deadline);
                        return (
                            <div key={goal.id} className={`flex items-center gap-2.5 rounded-lg border border-border/60 px-3 py-2 ${goal.completed ? 'opacity-60' : ''}`}>
                                <button onClick={() => toggleComplete(goal)} className="shrink-0 text-primary" title={goal.completed ? 'Mark incomplete' : 'Mark complete'}>
                                    {goal.completed ? <CheckCircle2 size={18} /> : <Circle size={18} className="text-muted-foreground" />}
                                </button>
                                <div className="min-w-0 flex-1">
                                    <div className={`truncate text-[13px] font-semibold text-foreground ${goal.completed ? 'line-through' : ''}`}>{goal.title}</div>
                                    <div className="truncate text-[11px] text-muted-foreground">
                                        {[goal.subjectName, goal.targetValue != null ? `Target ${goal.targetValue}%` : null, deadlineLabel].filter(Boolean).join(' · ')}
                                    </div>
                                </div>
                                <button onClick={() => deleteGoal(goal.id)} className="shrink-0 text-muted-foreground hover:text-destructive" title="Delete goal">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            <Modal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                title="New Study Goal"
                footer={(
                    <>
                        <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
                        <button onClick={handleAddGoal} disabled={saving || !title.trim()} className="btn-primary">
                            {saving ? 'Saving...' : 'Add Goal'}
                        </button>
                    </>
                )}
            >
                <div className="mb-4">
                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">Goal</label>
                    <input
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="e.g. Score 80% in Mathematics"
                        className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                    />
                </div>
                <div className="mb-4 grid grid-cols-2 gap-3">
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-muted-foreground">Subject (optional)</label>
                        <select value={subjectId} onChange={e => setSubjectId(e.target.value)} className="w-full rounded-lg border border-border px-3 py-2 text-sm">
                            <option value="">Any subject</option>
                            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-muted-foreground">Target % (optional)</label>
                        <input
                            type="number" min={0} max={100} value={targetValue}
                            onChange={e => setTargetValue(e.target.value)}
                            placeholder="80"
                            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                        />
                    </div>
                </div>
                <div>
                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">Deadline (optional)</label>
                    <input
                        type="date" value={deadline}
                        onChange={e => setDeadline(e.target.value)}
                        className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                    />
                </div>
            </Modal>
        </div>
    );
}
