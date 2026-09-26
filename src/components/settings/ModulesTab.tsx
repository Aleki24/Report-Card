"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';
import { ContentSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { ConfirmDialog } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import { errorText, opsFetch } from '@/lib/ops/client';
import {
    MODULES, MODULE_CATEGORIES, MODULE_CATEGORY_LABELS, MODULE_LIST, MODULE_PRESETS,
    dependents, withDependencies, type ModuleKey, type ModulePresetId,
} from '@/lib/platform/modules';

interface ModuleState { key: ModuleKey; enabled: boolean; entitled: boolean }

const URL = '/api/platform/modules';

type Pending = { kind: 'toggle'; key: ModuleKey; enabled: boolean; also: ModuleKey[] } | { kind: 'preset'; id: ModulePresetId; name: string };

/**
 * Which modules the school runs. Switching one off hides it everywhere and
 * keeps its data; the page reloads so every menu reflects the change.
 */
export function ModulesTab() {
    const [states, setStates] = useState<ModuleState[] | null>(null);
    const [busy, setBusy] = useState(false);
    const [pending, setPending] = useState<Pending | null>(null);

    const load = useCallback(async () => {
        try { setStates(await opsFetch<ModuleState[]>(URL)); }
        catch (err) { toast.error(errorText(err)); setStates([]); }
    }, []);
    useEffect(() => { void load(); }, [load]);

    const byKey = useMemo(() => new Map((states ?? []).map(s => [s.key, s])), [states]);

    const apply = async (body: { module: ModuleKey; enabled: boolean } | { preset: ModulePresetId }) => {
        setBusy(true);
        try {
            setStates(await opsFetch<ModuleState[]>(URL, { method: 'PUT', json: body }));
            toast.success('Modules updated. Refreshing menus…');
            // Menus and page guards read modules at sign-in; reload to pick up the change.
            setTimeout(() => window.location.reload(), 600);
        } catch (err) {
            toast.error(errorText(err));
        } finally {
            setBusy(false);
            setPending(null);
        }
    };

    const requestToggle = (key: ModuleKey, enabled: boolean) => {
        const also = enabled
            ? withDependencies(key).filter(k => k !== key && !byKey.get(k)?.enabled)
            : dependents(key).filter(k => byKey.get(k)?.enabled);
        if (also.length === 0) void apply({ module: key, enabled });
        else setPending({ kind: 'toggle', key, enabled, also });
    };

    if (!states) return <ContentSkeleton message="Loading modules…" />;

    const enabledCount = states.filter(s => s.enabled).length;

    return (
        <div className="flex flex-col gap-6">
            <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground"><Sparkles className="size-4 text-amber-500" aria-hidden />Start from a preset</h2>
                        <p className="text-sm text-muted-foreground">Pick the kind of school you run; you can fine-tune each module below. Nothing is ever deleted.</p>
                    </div>
                    <p className="text-xs text-muted-foreground tabular-nums">{enabledCount} of {states.length} modules on</p>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {MODULE_PRESETS.map(p => (
                        <button
                            key={p.id}
                            type="button"
                            disabled={busy}
                            onClick={() => setPending({ kind: 'preset', id: p.id, name: p.name })}
                            className="rounded-xl border border-border/70 bg-background px-3 py-2.5 text-left text-sm font-medium transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50"
                        >
                            {p.name}
                            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{p.modules.length} modules</span>
                        </button>
                    ))}
                </div>
            </section>

            {MODULE_CATEGORIES.map(category => (
                <section key={category}>
                    <h3 className="mb-3 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">{MODULE_CATEGORY_LABELS[category]}</h3>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {MODULE_LIST.filter(m => m.category === category).map(m => {
                            const state = byKey.get(m.key);
                            const on = !!state?.enabled;
                            const locked = state?.entitled === false;
                            const switchId = `module-${m.key}`;
                            return (
                                <div key={m.key} className={cn('flex gap-3 rounded-2xl border bg-card p-4 shadow-sm transition-colors', on ? 'border-primary/40' : 'border-border/70')}>
                                    <div className="min-w-0 flex-1">
                                        <label htmlFor={switchId} className="text-sm font-semibold text-foreground">{m.name}</label>
                                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{m.description}</p>
                                        {m.requires.length > 0 && (
                                            <p className="mt-2 flex flex-wrap gap-1">
                                                {m.requires.map(r => (
                                                    <span key={r} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Needs {MODULES[r].name}</span>
                                                ))}
                                            </p>
                                        )}
                                        {locked && <p className="mt-2 text-[11px] font-medium text-amber-600 dark:text-amber-400">Not included in your plan</p>}
                                    </div>
                                    <button
                                        id={switchId}
                                        type="button"
                                        role="switch"
                                        aria-checked={on}
                                        disabled={busy || locked}
                                        onClick={() => requestToggle(m.key, !on)}
                                        className={cn('relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50', on ? 'bg-primary' : 'bg-muted-foreground/30')}
                                    >
                                        <span className={cn('absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform', on && 'translate-x-5')} aria-hidden />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </section>
            ))}

            <ConfirmDialog
                isOpen={pending !== null}
                onClose={() => { if (!busy) setPending(null); }}
                loading={busy}
                onConfirm={() => {
                    if (!pending) return;
                    void apply(pending.kind === 'preset' ? { preset: pending.id } : { module: pending.key, enabled: pending.enabled });
                }}
                title={pending?.kind === 'preset' ? `Apply “${pending.name}”?` : pending?.enabled ? `Turn on ${MODULES[pending.key].name}?` : `Turn off ${pending ? MODULES[pending.key].name : ''}?`}
                message={
                    pending?.kind === 'preset'
                        ? 'Modules in the preset are switched on and the rest off. Data in switched-off modules is kept and comes back when you switch them on again.'
                        : pending
                            ? `${pending.enabled ? 'It needs' : 'These depend on it and will also be switched off'}: ${pending.also.map(k => MODULES[k].name).join(', ')}.`
                            : ''
                }
                confirmText="Continue"
            />
        </div>
    );
}
