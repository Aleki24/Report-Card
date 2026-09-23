"use client";

import { useMemo, useState } from 'react';
import { BookOpen, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiErrorMessage } from '@/lib/api-error-message';
import { PREDEFINED_SUBJECTS, type EducationLevel, type PredefinedSubject } from '@/lib/subject-definitions';
import { PATHWAYS, PATHWAY_ORDER } from '@/lib/pathway-definitions';

type OfferedSubject = { id: string; name: string; code: string };

type Props = {
    offered: OfferedSubject[];
    onChanged: () => Promise<void> | void;
    onMessage: (msg: string) => void;
};

const LEVELS: { value: EducationLevel; label: string }[] = [
    { value: 'CBC_LOWER_PRIMARY', label: 'CBC Lower Primary' },
    { value: 'CBC_UPPER_PRIMARY', label: 'CBC Upper Primary' },
    { value: 'CBC_JUNIOR_SCHOOL', label: 'CBC Junior School' },
    { value: 'CBC_SENIOR_SCHOOL', label: 'CBC Senior School' },
    { value: '844_SECONDARY', label: '8-4-4 Secondary' },
];

type Group = { title: string; hint?: string; subjects: PredefinedSubject[] };

const norm = (code: string) => code.trim().toUpperCase();

/** Senior School reads by pathway; every other band is simply core vs optional. */
function groupsFor(level: EducationLevel): Group[] {
    const inLevel = PREDEFINED_SUBJECTS.filter(s => s.level === level);
    if (level !== 'CBC_SENIOR_SCHOOL') {
        return [
            { title: 'Core', subjects: inLevel.filter(s => s.isCore) },
            { title: 'Optional', subjects: inLevel.filter(s => !s.isCore) },
        ].filter(g => g.subjects.length > 0);
    }
    return [
        { title: 'Compulsory', hint: 'Every learner takes these', subjects: inLevel.filter(s => s.isCore) },
        ...PATHWAY_ORDER.map(pw => ({
            title: PATHWAYS[pw].label,
            hint: 'Electives',
            subjects: inLevel.filter(s => s.pathway === pw),
        })),
        { title: 'Also offered', hint: 'Not compulsory, not in any combination', subjects: inLevel.filter(s => !s.isCore && !s.pathway) },
    ].filter(g => g.subjects.length > 0);
}

/**
 * The national subject catalogue as a checklist: a school ticks what it
 * offers and saves. Ticking links the school to the shared catalogue row, so
 * no school ever types a subject name or code of its own.
 */
export default function SubjectCatalogueChecklist({ offered, onChanged, onMessage }: Props) {
    const [level, setLevel] = useState<EducationLevel>('CBC_SENIOR_SCHOOL');
    const offeredIdByCode = useMemo(() => new Map(offered.map(s => [norm(s.code), s.id])), [offered]);
    const [draft, setDraft] = useState<ReadonlySet<string> | null>(null);
    const [saving, setSaving] = useState(false);

    const groups = useMemo(() => groupsFor(level), [level]);
    const levelCodes = useMemo(() => groups.flatMap(g => g.subjects.map(s => norm(s.code))), [groups]);
    const current = useMemo(() => new Set(levelCodes.filter(c => offeredIdByCode.has(c))), [levelCodes, offeredIdByCode]);
    const ticked = draft ?? current;

    const toAdd = levelCodes.filter(c => ticked.has(c) && !current.has(c));
    const toRemove = levelCodes.filter(c => !ticked.has(c) && current.has(c));
    const dirty = toAdd.length + toRemove.length > 0;

    const setTicked = (codes: string[], on: boolean) =>
        setDraft(() => {
            const next = new Set(ticked);
            codes.forEach(c => (on ? next.add(c) : next.delete(c)));
            return next;
        });

    const switchLevel = (next: EducationLevel) => {
        if (dirty && !confirm('Discard your unsaved subject changes?')) return;
        setDraft(null);
        setLevel(next);
    };

    const nameOf = (code: string) => PREDEFINED_SUBJECTS.find(s => norm(s.code) === code)?.name ?? code;

    const save = async () => {
        setSaving(true);
        onMessage('');
        try {
            if (toAdd.length > 0) {
                const res = await fetch('/api/admin/academic-structure', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'subjects_bulk', level, codes: toAdd }),
                });
                if (!res.ok) throw new Error(apiErrorMessage(await res.json(), 'Could not add subjects'));
            }

            // Removing keeps every recorded result; the server answers 409 when a
            // subject has exams so the admin confirms knowingly, once for all.
            const withExams: { code: string; count: number }[] = [];
            for (const code of toRemove) {
                const id = offeredIdByCode.get(code);
                if (!id) continue;
                const res = await fetch(`/api/admin/academic-structure?type=subject&id=${id}`, { method: 'DELETE' });
                if (res.status === 409) {
                    const d = await res.json();
                    withExams.push({ code, count: Number(d.examCount) || 0 });
                } else if (!res.ok) {
                    throw new Error(apiErrorMessage(await res.json(), `Could not remove ${nameOf(code)}`));
                }
            }
            if (withExams.length > 0) {
                const list = withExams.map(e => `${nameOf(e.code)} (${e.count} exam${e.count === 1 ? '' : 's'})`).join(', ');
                if (confirm(`These subjects have exams recorded: ${list}. Their results are kept — they just leave your list. Remove them?`)) {
                    for (const { code } of withExams) {
                        const id = offeredIdByCode.get(code);
                        const res = await fetch(`/api/admin/academic-structure?type=subject&id=${id}&force=true`, { method: 'DELETE' });
                        if (!res.ok) throw new Error(apiErrorMessage(await res.json(), `Could not remove ${nameOf(code)}`));
                    }
                }
            }

            onMessage(`Saved: ${toAdd.length} added, ${toRemove.length} removed.`);
            setDraft(null);
            await onChanged();
        } catch (err) {
            onMessage(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="card mb-6 p-5" aria-labelledby="subject-catalogue">
            <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 id="subject-catalogue" className="flex items-center gap-2 text-sm font-bold">
                        <BookOpen size={16} className="text-primary" aria-hidden /> Subjects your school offers
                    </h3>
                    <p className="text-xs text-muted-foreground">
                        Every official CBC and 8-4-4 subject, stored once for all schools. Tick the ones you teach.
                    </p>
                </div>
                <label className="block w-full sm:w-56">
                    <span className="sr-only">Curriculum level</span>
                    <select className="input-field w-full text-sm" value={level} onChange={e => switchLevel(e.target.value as EducationLevel)}>
                        {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                </label>
            </header>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {groups.map(group => {
                    const codes = group.subjects.map(s => norm(s.code));
                    const allOn = codes.every(c => ticked.has(c));
                    return (
                        <fieldset key={group.title} className="rounded-lg border border-border p-4">
                            <legend className="flex w-full items-center justify-between gap-2 px-1">
                                <span className="text-xs font-semibold tracking-wide uppercase">
                                    {group.title}
                                    {group.hint && <span className="ml-1.5 font-normal normal-case text-muted-foreground">· {group.hint}</span>}
                                </span>
                            </legend>
                            <button
                                type="button"
                                className="mb-2 text-xs font-semibold text-primary hover:underline disabled:opacity-50"
                                onClick={() => setTicked(codes, !allOn)}
                                disabled={saving}
                            >
                                {allOn ? 'Clear all' : 'Select all'}
                            </button>
                            <ul className="flex flex-col">
                                {group.subjects.map(s => {
                                    const code = norm(s.code);
                                    const on = ticked.has(code);
                                    const changed = on !== current.has(code);
                                    return (
                                        <li key={code}>
                                            <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-muted/50">
                                                <input
                                                    type="checkbox"
                                                    className="size-4 shrink-0 accent-primary"
                                                    checked={on}
                                                    disabled={saving}
                                                    onChange={e => setTicked([code], e.target.checked)}
                                                />
                                                <span className="min-w-0 flex-1 text-sm">{s.name}</span>
                                                <span className={cn('font-mono text-[11px] text-muted-foreground', changed && 'font-semibold text-primary')}>
                                                    {changed ? (on ? '+ add' : '− remove') : s.code}
                                                </span>
                                            </label>
                                        </li>
                                    );
                                })}
                            </ul>
                        </fieldset>
                    );
                })}
            </div>

            <footer className="mt-4 flex flex-wrap items-center justify-end gap-3">
                {dirty && (
                    <button type="button" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground" onClick={() => setDraft(null)} disabled={saving}>
                        <RotateCcw size={14} aria-hidden /> Undo changes
                    </button>
                )}
                <button type="button" className="btn-primary h-9 px-4 text-sm" onClick={save} disabled={!dirty || saving}>
                    {saving ? 'Saving…' : dirty ? `Save changes (${toAdd.length} add, ${toRemove.length} remove)` : 'No changes'}
                </button>
            </footer>
        </section>
    );
}
