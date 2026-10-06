import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { MINISTRY_COMBINATION_TEMPLATES, PATHWAYS, PATHWAY_ORDER, pathwayLabel, type CbcPathway } from '@shared/pathway-definitions';
import {
    canSaveCombination, combinationFormFrom, combinationPayload, combinationsHelp, electiveOptions, emptyCombinationForm,
    officialCombinationPayload, offeredIdByCode,
    type CombinationForm, type CombinationRow,
} from '@shared/pathway/combination-forms';
import { Badge, Button, ButtonRow, Card, ChipSelect, EmptyState, TextField, ToggleRow } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { FormSheet } from '@/components/ops/FormSheet';
import { SelectField } from '@/components/ops/SelectField';
import { ApiError, useApi } from '@/lib/api';
import { confirmAlert } from '@/lib/confirm';
import { errorMessage } from '@/lib/format';
import { spacing, fonts, useTheme } from '@/lib/theme';
import type { AcademicStructure } from '@/lib/types';

const STRUCTURE = '/api/admin/academic-structure';

/** Pick official Ministry combinations the school can run, and add them in one go. */
function OfficialPicker({ offered, existing, onAdd, busy }: { offered: ReadonlyMap<string, string>; existing: ReadonlySet<string>; onAdd: (codes: string[]) => void; busy: boolean }) {
    const { colors } = useTheme();
    const [pathway, setPathway] = useState<CbcPathway | 'ALL'>('ALL');
    const [runnableOnly, setRunnableOnly] = useState(true);
    const [selected, setSelected] = useState<string[]>([]);
    const missingFor = (codes: readonly string[]) => codes.filter((c) => !offered.has(c));
    const shown = MINISTRY_COMBINATION_TEMPLATES.filter((t) =>
        !existing.has(t.code) && (pathway === 'ALL' || t.pathway === pathway) && (!runnableOnly || missingFor(t.subjectCodes).length === 0));

    return (
        <Card style={{ marginBottom: spacing.md }}>
            <Text style={{ fontFamily: fonts.bold, color: colors.foreground }}>Add official combinations</Text>
            <ChipSelect options={[{ value: 'ALL', label: 'All pathways' }, ...PATHWAY_ORDER.map((p) => ({ value: p, label: PATHWAYS[p].label }))]} value={pathway} onChange={setPathway} />
            <ToggleRow label="Only ones we can run" description="Every elective is a subject your school offers." value={runnableOnly} onValueChange={setRunnableOnly} />
            {shown.length === 0 ? (
                <Text style={{ fontSize: 12, color: colors.muted }}>{runnableOnly ? 'No runnable combinations match. Offer more senior school subjects, or turn off the filter.' : 'Nothing matches.'}</Text>
            ) : shown.slice(0, 60).map((t) => {
                const missing = missingFor(t.subjectCodes);
                return (
                    <ToggleRow
                        key={t.code}
                        label={`${t.code} · ${t.name}`}
                        description={`${PATHWAYS[t.pathway].label} · ${t.track}${missing.length ? ` · not offered yet: ${missing.join(', ')}` : ''}`}
                        value={selected.includes(t.code)}
                        onValueChange={(on) => { if (missing.length === 0) setSelected((s) => (on ? [...s, t.code] : s.filter((c) => c !== t.code))); }}
                    />
                );
            })}
            <Button label={`Add ${selected.length || ''} selected`.replace('  ', ' ')} disabled={busy || selected.length === 0} loading={busy} onPress={() => { onAdd(selected); setSelected([]); }} block />
        </Card>
    );
}

/** The school's subject combinations — the web's Combinations tab. */
export function CombinationsPanel({ structure, minGroupSize, onChanged }: { structure: AcademicStructure | null; minGroupSize: number; onChanged: () => void }) {
    const { colors } = useTheme();
    const api = useApi();
    const toast = useToast();
    const combinations = structure?.subject_combinations ?? [];
    const cbcLevelId = structure?.academic_levels?.find((l) => l.code === 'CBC')?.id;
    const electives = useMemo(() => electiveOptions((structure?.subjects ?? []).map((s) => ({ ...s, code: s.code ?? '', academic_level_id: s.academic_level_id ?? undefined })), cbcLevelId), [structure, cbcLevelId]);
    const offered = useMemo(() => offeredIdByCode(electives), [electives]);
    const existing = useMemo(() => new Set(combinations.map((c) => c.code.trim().toUpperCase())), [combinations]);
    const [form, setForm] = useState<CombinationForm | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const addOfficial = async (codes: string[]) => {
        setBusy(true);
        const failed: string[] = [];
        for (const t of MINISTRY_COMBINATION_TEMPLATES.filter((x) => codes.includes(x.code))) {
            const body = officialCombinationPayload(t, offered);
            try {
                if (!body) throw new Error('subject not offered');
                await api.post(STRUCTURE, body);
            } catch { failed.push(t.code); }
        }
        const added = codes.length - failed.length;
        if (failed.length === 0) toast.success(`Added ${added} combination${added === 1 ? '' : 's'}.`);
        else toast.error(`Could not add ${failed.join(', ')}${added > 0 ? ` (${added} others were added)` : ''}.`);
        setBusy(false);
        onChanged();
    };

    const save = async () => {
        if (!form) return;
        setBusy(true);
        try {
            const payload = combinationPayload(form);
            if (editingId) await api.patch(STRUCTURE, { type: 'subject_combination', id: editingId, ...payload });
            else await api.post(STRUCTURE, { type: 'subject_combination', ...payload });
            toast.success(editingId ? 'Combination updated; assigned students were re-synced.' : 'Combination created.');
            setForm(null);
            setEditingId(null);
            onChanged();
        } catch (err) { toast.error(errorMessage(err, 'Something went wrong.')); }
        finally { setBusy(false); }
    };

    const toggleActive = (c: CombinationRow) => void api.patch(STRUCTURE, { type: 'subject_combination', id: c.id, is_active: !c.is_active })
        .then(onChanged).catch((err: unknown) => toast.error(errorMessage(err, 'Something went wrong.')));

    /** Deleting asks first; when learners are assigned the server answers 409 and we ask again before detaching them. */
    const remove = (c: CombinationRow, force = false) => {
        const go = async () => {
            try {
                await api.del(`${STRUCTURE}?type=subject_combination&id=${encodeURIComponent(c.id)}${force ? '&force=true' : ''}`);
                toast.success(`${c.code} deleted`);
                onChanged();
            } catch (err) {
                if (err instanceof ApiError && err.status === 409 && !force) remove(c, true);
                else toast.error(errorMessage(err, 'Could not delete the combination.'));
            }
        };
        confirmAlert(
            force ? `Learners are placed in ${c.code}` : `Delete ${c.code}?`,
            force ? 'Deleting it removes them from this combination; they will need placing again.' : c.name,
            [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void go() }],
        );
    };

    const setSubject = (i: 0 | 1 | 2) => (id: string) => setForm((f) => {
        if (!f) return f;
        const ids = [...f.subject_ids] as [string, string, string];
        ids[i] = id;
        return { ...f, subject_ids: ids };
    });

    return (
        <View>
            <Text style={{ fontSize: 12, color: colors.muted, marginBottom: spacing.md }}>{combinationsHelp(minGroupSize)}</Text>
            <OfficialPicker offered={offered} existing={existing} onAdd={(codes) => void addOfficial(codes)} busy={busy} />
            <Button variant="secondary" label="+ Custom combination" onPress={() => { setEditingId(null); setForm(emptyCombinationForm()); }} block />

            {combinations.length === 0 ? <EmptyState title="No combinations yet." description="Add official ones above, or a custom one." /> : combinations.map((c) => {
                const count = c.student_count ?? 0;
                const below = count > 0 && count < minGroupSize;
                return (
                    <Card key={c.id} style={{ marginTop: spacing.sm, padding: spacing.md }}>
                        <Text style={{ fontFamily: fonts.display, color: colors.foreground }}>{c.code} <Text style={{ fontFamily: fonts.regular, color: colors.muted }}>· {c.name}</Text></Text>
                        <Text style={{ fontSize: 12, color: colors.muted }}>{pathwayLabel(c.pathway)}{c.track ? ` — ${c.track}` : ''} · {(c.subjects ?? []).map((s) => s.name).join(', ')}</Text>
                        <Text style={{ fontSize: 12, color: below ? colors.warning : colors.muted }}>{count} learner{count === 1 ? '' : 's'}{below ? ` · below the ${minGroupSize}-learner minimum` : ''}</Text>
                        <ButtonRow>
                            <Badge variant={c.is_active ? 'success' : 'default'} label={c.is_active ? 'Active' : 'Inactive'} />
                            <Button size="sm" variant="ghost" label={c.is_active ? 'Mark inactive' : 'Mark active'} onPress={() => toggleActive(c)} />
                            <Button size="sm" variant="secondary" label="Edit" onPress={() => { setEditingId(c.id); setForm(combinationFormFrom(c)); }} />
                            <Button size="sm" variant="ghost" label="Delete" onPress={() => remove(c)} />
                        </ButtonRow>
                    </Card>
                );
            })}

            <FormSheet
                visible={form !== null}
                title={editingId ? 'Edit combination' : 'Custom combination'}
                onClose={() => { setForm(null); setEditingId(null); }}
                onSubmit={form && canSaveCombination(form) ? () => void save() : undefined}
                submitLabel={editingId ? 'Save changes' : 'Create'}
                submitting={busy}
            >
                {form ? (
                    <>
                        {!editingId ? <Text style={{ fontSize: 12, color: colors.muted, marginBottom: spacing.md }}>A custom combination is for one your school runs that is not on the Ministry list.</Text> : null}
                        <TextField label="Code *" value={form.code} onChangeText={(v) => setForm({ ...form, code: v.toUpperCase() })} autoCapitalize="characters" placeholder="SPORTS" />
                        <TextField label="Name *" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="e.g. Sports Science" />
                        <ChipSelect label="Pathway *" wrap options={PATHWAY_ORDER.map((p) => ({ value: p, label: PATHWAYS[p].label }))} value={form.pathway} onChange={(p) => setForm({ ...form, pathway: p, track: '' })} />
                        <ChipSelect label="Track" wrap options={[{ value: '', label: 'No track / other' }, ...PATHWAYS[form.pathway].tracks.map((t) => ({ value: t, label: t }))]} value={form.track} onChange={(t) => setForm({ ...form, track: t })} />
                        {([0, 1, 2] as const).map((i) => (
                            <SelectField
                                key={i}
                                label={`Elective ${i + 1}`}
                                required
                                value={form.subject_ids[i]}
                                onChange={setSubject(i)}
                                options={electives.filter((s) => !form.subject_ids.includes(s.id) || form.subject_ids[i] === s.id).map((s) => ({ id: s.id, label: s.name, hint: s.code }))}
                            />
                        ))}
                        {electives.length === 0 ? <Text style={{ fontSize: 12, color: colors.warning }}>No CBC subjects found — add senior-school subjects first.</Text> : null}
                        {!canSaveCombination(form) ? <Text style={{ fontSize: 12, color: colors.muted }}>Fill in a code, a name and three different electives.</Text> : null}
                    </>
                ) : null}
            </FormSheet>
        </View>
    );
}
