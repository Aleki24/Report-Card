"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { LookupSelect } from '@/components/ops/SearchableSelect';
import { errorText, opsFetch } from '@/lib/ops/client';
import { humanize } from '@/lib/ops/format';
import { cn } from '@/lib/utils';
import { normalizeMpesaPhone } from '@/lib/phone';
import { GUARDIAN_RELATIONSHIPS, type GuardianRelationship } from '@/lib/ops/forms/platform';
import { CLASS_LINK_LIMIT, splitName, type ClassGuardianLearner, type ClassLinkResult } from '@/lib/parents/class-guardians';

interface Draft {
    first: string;
    last: string;
    phone: string;
    relationship: GuardianRelationship;
}

const blank = (l: ClassGuardianLearner): Draft => {
    const { first, last } = splitName(l.recordName);
    return { first, last, phone: l.recordPhone ?? '', relationship: 'GUARDIAN' };
};

/** Filled in enough to link: both names and a phone. */
const ready = (d: Draft | undefined): d is Draft => !!d && !!d.first.trim() && !!d.last.trim() && d.phone.trim().length >= 9;

/**
 * Link a whole class's parents in one sitting, from the class list the
 * school already has. Learners already linked show who; the rest start from
 * the contact on their record. Each parent gets the portal invite by SMS,
 * and a parent of two learners is matched by phone, not made twice.
 */
export function ClassParentsSheet() {
    const [streamId, setStreamId] = useState('');
    const [learners, setLearners] = useState<ClassGuardianLearner[] | null>(null);
    const [drafts, setDrafts] = useState<Record<string, Draft>>({});
    const [results, setResults] = useState<Record<string, ClassLinkResult>>({});
    const [saving, setSaving] = useState(false);

    const load = useCallback(async (id: string) => {
        setLearners(null);
        setResults({});
        try {
            const rows = await opsFetch<ClassGuardianLearner[]>(`/api/admin/parents/class?grade_stream_id=${encodeURIComponent(id)}`);
            setLearners(rows);
            setDrafts(Object.fromEntries(rows.filter(l => l.links.length === 0).map(l => [l.id, blank(l)])));
        } catch (err) {
            toast.error(errorText(err));
            setLearners([]);
        }
    }, []);
    useEffect(() => { if (streamId) void load(streamId); }, [streamId, load]);

    const unlinked = useMemo(() => (learners ?? []).filter(l => l.links.length === 0), [learners]);
    const toLink = unlinked.filter(l => ready(drafts[l.id]) && !results[l.id]?.ok);
    const linkedCount = (learners ?? []).length - unlinked.length + Object.values(results).filter(r => r.ok).length;

    const update = (id: string, patch: Partial<Draft>) => setDrafts(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));

    const save = async () => {
        const batch = toLink.slice(0, CLASS_LINK_LIMIT);
        if (batch.length === 0) return;
        setSaving(true);
        try {
            const out = await opsFetch<ClassLinkResult[]>('/api/admin/parents/class', {
                method: 'POST',
                json: {
                    links: batch.map(l => {
                        const d = drafts[l.id];
                        return { student_id: l.id, first_name: d.first.trim(), last_name: d.last.trim(), phone: d.phone.trim(), relationship: d.relationship, is_primary: true };
                    }),
                },
            });
            setResults(prev => ({ ...prev, ...Object.fromEntries(out.map(r => [r.student_id, r])) }));
            const ok = out.filter(r => r.ok).length;
            const failed = out.length - ok;
            if (failed === 0) toast.success(`Linked ${ok} ${ok === 1 ? 'parent' : 'parents'}. New parents get their invite code by SMS.`);
            else toast.warning(`Linked ${ok}; ${failed} need a look (marked below).`);
        } catch (err) {
            toast.error(errorText(err));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col gap-5">
            <FormField label="Class" htmlFor="cp-class" className="sm:max-w-md">
                <LookupSelect id="cp-class" lookup="streams" value={streamId} onChange={setStreamId} />
            </FormField>

            {streamId && learners === null && <div className="h-40 animate-pulse rounded-2xl bg-muted/60" aria-busy="true" />}

            {learners && learners.length === 0 && <p className="text-sm text-muted-foreground">No active learners in this class.</p>}

            {learners && learners.length > 0 && (
                <>
                    <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400" aria-hidden="true"><Users className="size-5" /></span>
                            <div>
                                <p className="text-sm font-semibold">{linkedCount} of {learners.length} learners have a parent linked</p>
                                <p className="text-xs text-muted-foreground">Fill in a parent for the rest. Rows with both names and a phone are linked; empty rows are skipped.</p>
                            </div>
                        </div>
                        <Button onClick={() => void save()} disabled={saving || toLink.length === 0} className="shrink-0">
                            {saving ? <Loader2 className="animate-spin" /> : <UserPlus />}
                            {saving ? 'Linking…' : `Link ${toLink.length} ${toLink.length === 1 ? 'parent' : 'parents'}`}
                        </Button>
                    </div>

                    <ul className="flex flex-col gap-2">
                        {learners.map(l => {
                            const d = drafts[l.id];
                            const result = results[l.id];
                            const linked = l.links.length > 0 || result?.ok;
                            const phoneOk = !d?.phone.trim() || !!normalizeMpesaPhone(d.phone);
                            return (
                                <li key={l.id} className={cn('rounded-2xl border p-3', result && !result.ok ? 'border-destructive/40 bg-destructive/[0.04]' : 'border-border/70 bg-card')}>
                                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                        <p className="text-sm font-semibold">{l.name}{l.admissionNumber && <span className="font-normal text-muted-foreground"> · {l.admissionNumber}</span>}</p>
                                        {linked && (
                                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                                                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                                                {l.links.length > 0
                                                    ? l.links.map(g => `${g.name}${g.relationship ? ` (${humanize(g.relationship).toLowerCase()})` : ''}`).join(', ')
                                                    : result?.reused ? 'Linked to their existing parent account' : 'Linked · invite sent'}
                                            </span>
                                        )}
                                    </div>
                                    {!linked && d && (
                                        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-[1fr_1fr_1fr_9rem]">
                                            <input aria-label={`${l.name}: parent's first name`} placeholder="First name" className="input-field" value={d.first} onChange={e => update(l.id, { first: e.target.value })} />
                                            <input aria-label={`${l.name}: parent's last name`} placeholder="Last name" className="input-field" value={d.last} onChange={e => update(l.id, { last: e.target.value })} />
                                            <input aria-label={`${l.name}: parent's phone`} placeholder="Phone (07…)" type="tel" inputMode="tel" className={cn('input-field', !phoneOk && 'border-amber-500')} value={d.phone} onChange={e => update(l.id, { phone: e.target.value })} />
                                            <select aria-label={`${l.name}: relationship`} className="input-field" value={d.relationship} onChange={e => update(l.id, { relationship: e.target.value as GuardianRelationship })}>
                                                {GUARDIAN_RELATIONSHIPS.map(r => <option key={r} value={r}>{humanize(r)}</option>)}
                                            </select>
                                        </div>
                                    )}
                                    {!phoneOk && !linked && <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">That doesn&apos;t look like a Kenyan mobile number; SMS may not reach it.</p>}
                                    {result && !result.ok && <p role="alert" className="mt-1 text-xs text-destructive">{result.error}</p>}
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
        </div>
    );
}
