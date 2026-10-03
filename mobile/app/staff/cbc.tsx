import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CBC_LEVELS, CBC_LEVEL_LABELS } from '@shared/ops/resources/academics';
import {
    CBC_LEVEL_TONES, EMPTY_CBC_FILTER, cbcCounts, cbcFilterReady,
    type CbcFilter, type CbcLevel, type CbcRow, type StrandOption,
} from '@shared/ops/forms/academics';
import { Button, Card, ChipSelect, EmptyState, TextField } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { ModuleScreen } from '@/components/ops/ModuleScreen';
import { LookupField } from '@/components/ops/SelectField';
import { TonePill, toneColor } from '@/components/ops/bits';
import { useApi, withQuery } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { opsGet } from '@/lib/ops';
import { useCurrentUser } from '@/lib/UserContext';
import { colors, radius, spacing, fonts } from '@/lib/theme';

function RubricGrid() {
    const api = useApi();
    const toast = useToast();
    const { can } = useCurrentUser();
    const canAssess = can('cbc.assess');
    const [filter, setFilter] = useState<CbcFilter>(EMPTY_CBC_FILTER);
    const [strands, setStrands] = useState<StrandOption[]>([]);
    const [rows, setRows] = useState<CbcRow[] | null>(null);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!filter.subject_id) return;
        let live = true;
        opsGet<StrandOption[]>(api, withQuery('/api/academics/cbc/strands', { subject_id: filter.subject_id }))
            .then((s) => { if (live) setStrands(s); })
            .catch(() => undefined);
        return () => { live = false; };
    }, [api, filter.subject_id]);

    const set = (patch: Partial<CbcFilter>) => { setFilter((f) => ({ ...f, ...patch })); setRows(null); };

    const load = async () => {
        if (!cbcFilterReady(filter)) { toast.error('Choose a class, subject, term and strand.'); return; }
        try {
            setRows(await opsGet<CbcRow[]>(api, withQuery('/api/academics/cbc', filter)));
            setDirty(false);
        } catch (err) { toast.error(errorMessage(err, 'Could not open the class list')); }
    };

    const save = async () => {
        if (!rows) return;
        setSaving(true);
        try {
            const r = await api.put<{ data: { saved: number } }>('/api/academics/cbc', { ...filter, rows: rows.map((x) => ({ student_id: x.studentId, level: x.level, comment: x.comment })) });
            toast.success(`${r.data.saved} levels saved.`);
            setDirty(false);
        } catch (err) { toast.error(errorMessage(err, 'Could not save')); }
        finally { setSaving(false); }
    };

    const setLevel = (id: string, level: CbcLevel) => {
        setRows((rs) => rs && rs.map((r) => (r.studentId === id ? { ...r, level: r.level === level ? null : level } : r)));
        setDirty(true);
    };

    const counts = useMemo(() => cbcCounts(rows), [rows]);
    const subStrands = strands.find((s) => s.strand === filter.strand)?.subStrands ?? [];

    return (
        <View>
            <Card style={{ marginBottom: spacing.md }}>
                <LookupField label="Class" required lookup="streams" value={filter.grade_stream_id} onChange={(v) => set({ grade_stream_id: v })} />
                <LookupField label="Learning area" required lookup="subjects" value={filter.subject_id} onChange={(v) => set({ subject_id: v, strand: '', sub_strand: '' })} />
                <LookupField label="Term" required lookup="terms" value={filter.term_id} onChange={(v) => set({ term_id: v })} />
                <TextField label="Strand *" value={filter.strand} onChangeText={(v) => set({ strand: v })} placeholder="e.g. Numbers" />
                {strands.length > 0 ? <ChipSelect options={strands.map((s) => ({ value: s.strand, label: s.strand }))} value={filter.strand || null} onChange={(v) => set({ strand: v, sub_strand: '' })} /> : null}
                <TextField label="Sub-strand" value={filter.sub_strand} onChangeText={(v) => set({ sub_strand: v })} placeholder="e.g. Fractions" />
                {subStrands.length > 0 ? <ChipSelect options={subStrands.map((s) => ({ value: s, label: s }))} value={filter.sub_strand || null} onChange={(v) => set({ sub_strand: v })} /> : null}
                <Button label="Open class list" onPress={() => void load()} block />
            </Card>

            {rows ? (
                <>
                    <View style={styles.counts}>
                        {CBC_LEVELS.map((l) => <TonePill key={l} tone={CBC_LEVEL_TONES[l]} label={`${l} ${CBC_LEVEL_LABELS[l]} · ${counts[l]}`} />)}
                    </View>
                    {canAssess ? <Button label={saving ? 'Saving…' : 'Save'} onPress={() => void save()} disabled={saving || !dirty} block /> : null}
                    {rows.length === 0 ? <EmptyState title="No learners in this class." /> : rows.map((r) => (
                        <Card key={r.studentId} style={styles.row}>
                            <Text style={styles.name}>{r.name} <Text style={styles.adm}>{r.admissionNumber}</Text></Text>
                            <View style={styles.levels} accessibilityRole="radiogroup" accessibilityLabel={`Level for ${r.name}`}>
                                {CBC_LEVELS.map((l) => {
                                    const on = r.level === l;
                                    return (
                                        <Pressable
                                            key={l}
                                            disabled={!canAssess}
                                            onPress={() => setLevel(r.studentId, l)}
                                            accessibilityRole="radio"
                                            accessibilityState={{ checked: on, disabled: !canAssess }}
                                            accessibilityLabel={CBC_LEVEL_LABELS[l]}
                                            style={[styles.level, on && { backgroundColor: toneColor(CBC_LEVEL_TONES[l]) }]}
                                        >
                                            <Text style={[styles.levelText, on && { color: colors.white }]}>{l}</Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </Card>
                    ))}
                </>
            ) : null}
        </View>
    );
}

export default function CbcScreen() {
    return (
        <ModuleScreen
            screen="cbc"
            title="CBC assessment"
            description="Rate each learner per strand and sub-strand: Exceeding, Meeting, Approaching or Below expectations."
            tabs={[{ id: 'rubric', label: 'Rubric', render: () => <RubricGrid /> }]}
        />
    );
}

const styles = StyleSheet.create({
    counts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
    row: { marginTop: spacing.sm, padding: spacing.md },
    name: { fontSize: 14, fontFamily: fonts.bold, color: colors.foreground },
    adm: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted },
    levels: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    level: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.mutedBg, alignItems: 'center', justifyContent: 'center' },
    levelText: { fontSize: 13, fontFamily: fonts.display, color: colors.muted },
});
