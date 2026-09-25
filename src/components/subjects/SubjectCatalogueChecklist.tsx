"use client";

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BookOpen, RotateCcw } from 'lucide-react';
import { CardHeading, ConfirmDialog } from '@/components/ui';
import { cn } from '@/lib/utils';
import { apiErrorMessage } from '@/lib/api-error-message';
import { PREDEFINED_SUBJECTS, type EducationLevel, type PredefinedSubject } from '@/lib/subject-definitions';
import { PATHWAYS, PATHWAY_ORDER } from '@/lib/pathway-definitions';

type OfferedSubject = { id: string; name: string; code: string };

type Props = {
    offered: OfferedSubject[];
    onChanged: () => Promise<void> | void;
};

/** A subject with exams that needs a knowing confirmation to leave the list. */
type WithExams = { code: string; id: string; count: number };

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
/** The band the school offers most subjects in: where an admin most likely wants to start. */
function busiestLevel(offeredCodes: ReadonlySet<string>): EducationLevel {
    let best: EducationLevel = LEVELS[0].value;
    let bestCount = -1;
    for (const { value } of LEVELS) {
        const count = PREDEFINED_SUBJECTS.filter(s => s.level === value && offeredCodes.has(norm(s.code))).length;
        if (count > bestCount) { best = value; bestCount = count; }
    }
    return best;
}

export default function SubjectCatalogueChecklist({ offered, onChanged }: Props) {
    const offeredIdByCode = useMemo(() => new Map(offered.map(s => [norm(s.code), s.id])), [offered]);
    const [level, setLevel] = useState<EducationLevel>(() => busiestLevel(new Set(offeredIdByCode.keys())));
    const [pendingLevel, setPendingLevel] = useState<EducationLevel | null>(null);
    const [withExams, setWithExams] = useState<WithExams[]>([]);
    const [draft, setDraft] = useState<ReadonlySet<string> | null>(null);
    // Open straight away only for a school with nothing ticked yet; after
    // that the long list would push the school's own subjects off screen.
    const [expanded, setExpanded] = useState(offered.length === 0);
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
        if (dirty) { setPendingLevel(next); return; }
        setLevel(next);
    };

    const nameOf = (code: string) => PREDEFINED_SUBJECTS.find(s => norm(s.code) === code)?.name ?? code;

    /** Removes subjects that have exams; their results are kept, only the offering goes. */
    const forceRemove = async (items: readonly WithExams[]) => {
        setSaving(true);
        let removed = 0;
        try {
            for (const { code, id } of items) {
                const res = await fetch(`/api/admin/academic-structure?type=subject&id=${id}&force=true`, { method: 'DELETE' });
                if (!res.ok) throw new Error(apiErrorMessage(await res.json().catch(() => null), `Could not remove ${nameOf(code)}`));
                removed++;
            }
            toast.success(`Removed ${removed} subject${removed === 1 ? '' : 's'}; their results are kept.`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not remove the subjects.');
        } finally {
            setWithExams([]);
            setDraft(null);
            setSaving(false);
            await onChanged();
        }
    };

    const save = async () => {
        setSaving(true);
        let added = 0;
        let removed = 0;
        const needConfirm: WithExams[] = [];
        try {
            if (toAdd.length > 0) {
                const res = await fetch('/api/admin/academic-structure', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'subjects_bulk', level, codes: toAdd }),
                });
                if (!res.ok) throw new Error(apiErrorMessage(await res.json().catch(() => null), 'Could not add subjects'));
                added = toAdd.length;
            }

            // Removing keeps every recorded result; the server answers 409 when a
            // subject has exams so the admin confirms knowingly, once for all.
            for (const code of toRemove) {
                const id = offeredIdByCode.get(code);
                if (!id) continue;
                const res = await fetch(`/api/admin/academic-structure?type=subject&id=${id}`, { method: 'DELETE' });
                if (res.status === 409) {
                    const d = (await res.json().catch(() => null)) as { examCount?: number } | null;
                    needConfirm.push({ code, id, count: Number(d?.examCount) || 0 });
                } else if (!res.ok) {
                    throw new Error(apiErrorMessage(await res.json().catch(() => null), `Could not remove ${nameOf(code)}`));
                } else {
                    removed++;
                }
            }
            if (added + removed > 0) toast.success(`Saved: ${added} added, ${removed} removed.`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not save the changes.');
        } finally {
            // Whatever went through is real, so the list is refreshed either way.
            setSaving(false);
            if (needConfirm.length > 0) setWithExams(needConfirm);
            else setDraft(null);
            await onChanged();
        }
    };

    return (
        <section className="mb-6 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5" aria-labelledby="subject-catalogue">
            <header className={cn('flex flex-wrap items-start justify-between gap-3', expanded && 'mb-4')}>
                <CardHeading
                    as="h2"
                    icon={BookOpen}
                    hue="emerald"
                    className="mb-0"
                    title={<span id="subject-catalogue">Subjects your school offers</span>}
                    description={expanded
                        ? 'Every official CBC and 8-4-4 subject, stored once for all schools. Tick the ones you teach.'
                        : `${offered.length} subject${offered.length === 1 ? '' : 's'} ticked from the national list.`}
                />
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    {expanded && (
                        <label className="block min-w-0 flex-1 sm:w-56 sm:flex-none">
                            <span className="sr-only">Curriculum level</span>
                            <select className="input-field w-full text-sm" value={level} onChange={e => switchLevel(e.target.value as EducationLevel)}>
                                {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                            </select>
                        </label>
                    )}
                    <button
                        type="button"
                        className={cn('shrink-0', expanded ? 'btn-secondary' : 'btn-primary')}
                        onClick={() => setExpanded(v => !v)}
                        disabled={expanded && (dirty || saving)}
                        aria-expanded={expanded}
                        aria-controls="subject-catalogue-list"
                        title={expanded && dirty ? 'Save or undo your changes first' : undefined}
                    >
                        {expanded ? 'Done' : 'Edit list'}
                    </button>
                </div>
            </header>

            {expanded && (<div id="subject-catalogue-list">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {groups.map(group => {
                    const codes = group.subjects.map(s => norm(s.code));
                    const allOn = codes.every(c => ticked.has(c));
                    return (
                        <fieldset key={group.title} className="rounded-xl border border-border/70 p-3 sm:p-4">
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
            </div>)}

            <ConfirmDialog
                isOpen={withExams.length > 0}
                onClose={() => { if (!saving) { setWithExams([]); setDraft(null); } }}
                onConfirm={() => void forceRemove(withExams)}
                loading={saving}
                variant="warning"
                title="Remove subjects with results?"
                message={`${withExams.map(e => `${nameOf(e.code)} (${e.count} exam${e.count === 1 ? '' : 's'})`).join(', ')} ${withExams.length === 1 ? 'has' : 'have'} exams recorded. The results are kept; the subject just leaves your list and stops appearing for new exams.`}
                confirmText="Remove anyway"
                cancelText="Keep them"
            />
            <ConfirmDialog
                isOpen={pendingLevel !== null}
                onClose={() => setPendingLevel(null)}
                onConfirm={() => { if (pendingLevel) { setDraft(null); setLevel(pendingLevel); } setPendingLevel(null); }}
                variant="warning"
                title="Discard unsaved changes?"
                message={`You have ${toAdd.length + toRemove.length} unsaved change${toAdd.length + toRemove.length === 1 ? '' : 's'} in this list. Switching levels discards them.`}
                confirmText="Discard"
                cancelText="Stay"
            />
        </section>
    );
}
