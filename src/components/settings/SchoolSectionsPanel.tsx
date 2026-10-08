"use client";

import React, { useCallback, useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import { Layers, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { CardHeading } from '@/components/ui/CardHeading';
import { FormField, InputField } from '@/components/ui';
import { apiErrorMessage, jsonBody } from '@/lib/api-error-message';
import type { CurriculumBand } from '@/lib/curriculum-bands';
import {
    SCHOOL_SECTIONS_URL, bandLabel, sectionForBand, sectionSignatureTarget,
    type SchoolSection, type SchoolSectionInput, type SchoolSectionsOverview,
} from '@/lib/school-sections';
import { SignatureField } from './SignatureField';

async function call<T>(input: string, init?: RequestInit): Promise<T> {
    const res = await fetch(input, { cache: 'no-store', ...init });
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) throw new Error(apiErrorMessage(json, 'Could not save the section.'));
    return (json as { data: T }).data;
}

/**
 * The school's sections (Primary, Junior School, Senior School), each with
 * its own head who signs its classes' report cards and mark sheets. Saves on
 * its own, apart from the profile form above it.
 */
export function SchoolSectionsPanel() {
    const [overview, setOverview] = useState<SchoolSectionsOverview | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [editing, setEditing] = useState<string | 'new' | null>(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try { setOverview(await call<SchoolSectionsOverview>(SCHOOL_SECTIONS_URL)); setError(null); }
        catch (err) { setError(err instanceof Error ? err.message : 'Could not load the sections.'); }
    }, []);
    useEffect(() => { void load(); }, [load]);

    const run = async (work: () => Promise<unknown>, done: string) => {
        setBusy(true);
        try {
            await work();
            toast.success(done);
            setEditing(null);
            await load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not save the section.');
        } finally {
            setBusy(false);
        }
    };

    const sections = overview?.sections ?? [];
    const bands = overview?.bands ?? [];
    const unplaced = bands.filter(b => !sectionForBand(sections, b.band));

    return (
        <section className="mx-auto mt-6 max-w-2xl rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-6" aria-label="Sections and their heads">
            <CardHeading
                icon={Layers}
                hue="violet"
                title="Sections and their heads"
                description="Each section's head signs its own classes' report cards and mark sheets. Classes in no section are signed by the principal above."
            />

            {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
            {!overview && !error && <div className="skeleton-bone h-24 rounded-xl" />}

            {overview && sections.length === 0 && (
                <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                        type="button"
                        className="btn-primary w-full justify-center sm:w-auto"
                        disabled={busy}
                        onClick={() => void run(() => call(SCHOOL_SECTIONS_URL, jsonBody('POST', { defaults: true })), 'Sections set up. Add each head’s name and signature.')}
                    >
                        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Layers className="size-4" aria-hidden />}
                        Set up Primary, Junior and Senior
                    </button>
                    <button type="button" className="btn-secondary w-full justify-center sm:w-auto" disabled={busy} onClick={() => setEditing('new')}>
                        <Plus className="size-4" aria-hidden />Add a section
                    </button>
                </div>
            )}

            {editing === 'new' && (
                <SectionEditor
                    sections={sections}
                    bands={bands.map(b => b.band)}
                    busy={busy}
                    onCancel={() => setEditing(null)}
                    onSave={input => void run(() => call(SCHOOL_SECTIONS_URL, jsonBody('POST', input)), `${input.name} added.`)}
                />
            )}

            <ul className="mt-4 flex flex-col gap-4">
                {sections.map(section => (
                    <li key={section.id} className="rounded-xl border border-border p-4">
                        {editing === section.id ? (
                            <SectionEditor
                                section={section}
                                sections={sections}
                                bands={bands.map(b => b.band)}
                                busy={busy}
                                onCancel={() => setEditing(null)}
                                onSave={input => void run(() => call(`${SCHOOL_SECTIONS_URL}/${section.id}`, jsonBody('PATCH', input)), `${input.name} saved.`)}
                                onDelete={() => {
                                    if (!window.confirm(`Remove ${section.name}? Its classes will be signed by the school-wide principal again.`)) return;
                                    void run(() => call(`${SCHOOL_SECTIONS_URL}/${section.id}`, { method: 'DELETE' }), `${section.name} removed.`);
                                }}
                            />
                        ) : (
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="font-semibold">{section.name}</p>
                                    <p className="text-sm text-muted-foreground">{section.bands.map(bandLabel).join(', ') || 'No classes yet'}</p>
                                    <p className="text-sm text-muted-foreground">{section.head_title}: {section.head_name ?? 'name not set'}</p>
                                </div>
                                <button type="button" className="btn-secondary shrink-0" disabled={busy} onClick={() => setEditing(section.id)}>
                                    <Pencil className="size-4" aria-hidden />Edit
                                </button>
                            </div>
                        )}
                        <div className="mt-4 border-t border-border pt-4">
                            <SignatureField
                                key={`${section.id}:${section.head_name ?? ''}`}
                                target={sectionSignatureTarget(section.id)}
                                label={`${section.head_title}'s signature`}
                                description={`Printed on ${section.name} report cards and mark sheets.`}
                            />
                        </div>
                    </li>
                ))}
            </ul>

            {sections.length > 0 && (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">{unplaced.length > 0 ? `Not in a section: ${unplaced.map(b => b.label).join(', ')}.` : 'Every class is in a section.'}</p>
                    {editing !== 'new' && (
                        <button type="button" className="btn-secondary w-full justify-center sm:w-auto" disabled={busy} onClick={() => setEditing('new')}>
                            <Plus className="size-4" aria-hidden />Add a section
                        </button>
                    )}
                </div>
            )}
        </section>
    );
}

function SectionEditor({ section, sections, bands, busy, onSave, onCancel, onDelete }: {
    section?: SchoolSection;
    sections: readonly SchoolSection[];
    /** The bands the school teaches. */
    bands: readonly CurriculumBand[];
    busy: boolean;
    onSave: (input: SchoolSectionInput) => void;
    onCancel: () => void;
    onDelete?: () => void;
}) {
    const id = useId();
    const [name, setName] = useState(section?.name ?? '');
    const [title, setTitle] = useState(section?.head_title ?? 'Principal');
    const [head, setHead] = useState(section?.head_name ?? '');
    const [chosen, setChosen] = useState<CurriculumBand[]>(section?.bands ?? []);
    const toggle = (band: CurriculumBand, on: boolean) => setChosen(c => (on ? [...c, band] : c.filter(b => b !== band)));

    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Section name" htmlFor={`${id}-name`} required className="sm:col-span-2">
                    <InputField id={`${id}-name`} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Junior School" maxLength={60} />
                </FormField>
                <FormField label="Head's title" htmlFor={`${id}-title`} hint="Printed on the cards.">
                    <InputField id={`${id}-title`} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Principal" maxLength={40} />
                </FormField>
                <FormField label="Head's name" htmlFor={`${id}-head`}>
                    <InputField id={`${id}-head`} value={head} onChange={e => setHead(e.target.value)} placeholder="e.g. Mrs. Jane Wanjiku" maxLength={100} />
                </FormField>
            </div>
            <fieldset>
                <legend className="mb-2 text-xs font-medium text-muted-foreground">Classes in this section</legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {bands.map(band => {
                        const owner = sections.find(s => s.id !== section?.id && s.bands.includes(band));
                        return (
                            <label key={band} className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-2.5 text-sm">
                                <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary" checked={chosen.includes(band)} onChange={e => toggle(band, e.target.checked)} />
                                <span className="min-w-0">
                                    {bandLabel(band)}
                                    {owner && <span className="block text-xs text-muted-foreground">In {owner.name} now</span>}
                                </span>
                            </label>
                        );
                    })}
                </div>
            </fieldset>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                {onDelete && (
                    <button type="button" className="btn-secondary justify-center text-destructive sm:mr-auto" disabled={busy} onClick={onDelete}>
                        <Trash2 className="size-4" aria-hidden />Remove
                    </button>
                )}
                <button type="button" className="btn-secondary justify-center" disabled={busy} onClick={onCancel}>Cancel</button>
                <button
                    type="button"
                    className="btn-primary justify-center"
                    disabled={busy || !name.trim() || !title.trim()}
                    onClick={() => onSave({ name: name.trim(), bands: chosen, head_title: title.trim(), head_name: head.trim() || null })}
                >
                    {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}Save
                </button>
            </div>
        </div>
    );
}
