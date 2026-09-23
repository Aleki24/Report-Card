import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useApi } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { colors, radius, spacing } from '@/lib/theme';
import { Button, ButtonRow, Card, ChipSelect, ErrorBanner } from '@/components/ui';
import type { AggregationMethod, ExamPaperScheme } from '@/lib/types';

/** Same methods and wording as the web's `AGGREGATION_METHODS`. */
const METHODS: { value: AggregationMethod; label: string; hint: string }[] = [
    { value: 'sum_then_percentage', label: 'Sum of papers', hint: '(P1 + P2) ÷ total max — e.g. Mathematics' },
    { value: 'languages_average_percentages', label: 'Average of papers', hint: 'Each paper as a %, then averaged — e.g. English' },
    { value: 'science_70_plus_practical', label: 'Theory 70 + practical 30', hint: 'Last paper is the practical — e.g. Biology' },
];

interface PaperDraft {
    code: string;
    name: string;
    max: string;
}

const defaultPapers = (count: number, max: number): PaperDraft[] =>
    Array.from({ length: count }, (_, i) => ({ code: `P${i + 1}`, name: `Paper ${i + 1}`, max: String(max) }));

export function PaperSetup({
    examId,
    maxScore,
    scheme,
    onSaved,
    onCancel,
}: {
    examId: string;
    maxScore: number;
    scheme: ExamPaperScheme | null;
    onSaved: () => void;
    onCancel: () => void;
}) {
    const api = useApi();
    const [method, setMethod] = useState<AggregationMethod>(scheme?.aggregation_method ?? 'sum_then_percentage');
    const [papers, setPapers] = useState<PaperDraft[]>(() =>
        scheme?.components?.length
            ? [...scheme.components].sort((a, b) => a.display_order - b.display_order).map((c) => ({ code: c.component_code, name: c.component_name, max: String(c.max_score) }))
            : defaultPapers(2, maxScore),
    );
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const setPaper = (i: number, patch: Partial<PaperDraft>) => setPapers((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

    const save = async (multi: boolean) => {
        setSaving(true);
        setError(null);
        try {
            await api.put(`/api/school/exams/${examId}/components`, {
                assessment_mode: multi ? 'multi_paper' : 'single_paper',
                aggregation_method: method,
                is_enabled: multi,
                components: multi
                    ? papers.map((p, i) => ({ component_code: p.code.trim().toUpperCase(), component_name: p.name.trim() || p.code, max_score: Number(p.max), display_order: i + 1 }))
                    : [],
            });
            onSaved();
        } catch (err) {
            setError(errorMessage(err, 'Could not save the paper structure'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card style={{ marginBottom: spacing.md }}>
            <Text style={styles.title}>Paper structure</Text>
            <Text style={styles.sub}>Enter one mark per paper; they are combined into the subject score.</Text>
            {error ? <ErrorBanner message={error} /> : null}
            <ChipSelect label="How papers combine" wrap options={METHODS.map((m) => ({ value: m.value, label: m.label }))} value={method} onChange={setMethod} />
            <Text style={styles.hint}>{METHODS.find((m) => m.value === method)?.hint}</Text>

            {papers.map((p, i) => (
                <View key={i} style={styles.paperRow}>
                    <TextInput value={p.code} onChangeText={(v) => setPaper(i, { code: v })} style={[styles.input, { width: 56 }]} autoCapitalize="characters" accessibilityLabel="Paper code" />
                    <TextInput value={p.name} onChangeText={(v) => setPaper(i, { name: v })} style={[styles.input, { flex: 1 }]} accessibilityLabel="Paper name" />
                    <TextInput value={p.max} onChangeText={(v) => setPaper(i, { max: v })} style={[styles.input, { width: 64 }]} keyboardType="number-pad" accessibilityLabel="Max score" />
                </View>
            ))}
            <ButtonRow>
                {papers.length > 2 ? <Button size="sm" variant="ghost" label="− Paper" onPress={() => setPapers((prev) => prev.slice(0, -1))} /> : null}
                {papers.length < 6 ? <Button size="sm" variant="ghost" label="+ Paper" onPress={() => setPapers((prev) => [...prev, ...defaultPapers(prev.length + 1, maxScore).slice(prev.length)])} /> : null}
            </ButtonRow>
            <ButtonRow>
                <Button variant="secondary" label="Cancel" onPress={onCancel} />
                {scheme?.is_enabled ? <Button variant="secondary" label="Use one paper" onPress={() => save(false)} disabled={saving} /> : null}
                <Button label="Save papers" onPress={() => save(true)} loading={saving} />
            </ButtonRow>
        </Card>
    );
}

const styles = StyleSheet.create({
    title: { fontSize: 15, fontWeight: '800', color: colors.foreground },
    sub: { fontSize: 12, color: colors.muted, marginTop: 2, marginBottom: spacing.md },
    hint: { fontSize: 12, color: colors.muted, marginTop: -spacing.sm, marginBottom: spacing.md },
    paperRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.sm, minHeight: 40, fontSize: 14, color: colors.foreground, backgroundColor: colors.card },
});
