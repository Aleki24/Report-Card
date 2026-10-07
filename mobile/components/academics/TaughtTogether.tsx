import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Link2, Trash2 } from 'lucide-react-native';
import { BAND_LABELS, type CurriculumBand } from '@shared/curriculum-bands';
import { TOGETHER_URL, levelsOf, ruleScope, subjectsAt, toggled, type TogetherRules } from '@shared/timetable/together';
import { Button, ButtonRow, LoadingView, TextField } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useApi, withQuery } from '@/lib/api';
import { confirmAlert } from '@/lib/confirm';
import { errorMessage } from '@/lib/format';
import { opsGet } from '@/lib/ops';
import { fonts, makeStyles, radius, spacing, useTheme } from '@/lib/theme';

/** A tappable chip for picking several values. */
function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
    const { colors } = useTheme();
    const styles = useStyles();
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            style={[styles.chip, on && { backgroundColor: colors.primary, borderColor: colors.primary }]}
        >
            <Text style={[styles.chipText, on && { color: colors.onPrimary }]}>{label}</Text>
        </Pressable>
    );
}

/**
 * Subjects the school teaches at the same time: learners take one of them,
 * so the timetable gives them one slot. Built-in groups hold in every school;
 * the school adds its own by picking the subjects.
 */
export function TaughtTogether({ onChange }: { onChange: () => void }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const api = useApi();
    const toast = useToast();
    const [data, setData] = useState<TogetherRules | null>(null);
    const [adding, setAdding] = useState(false);
    const [name, setName] = useState('');
    const [bands, setBands] = useState<CurriculumBand[]>([]);
    const [picked, setPicked] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try { setData(await opsGet<TogetherRules>(api, TOGETHER_URL)); }
        catch (err) { toast.error(errorMessage(err, 'Could not load the subject groups')); }
    }, [api, toast]);
    useEffect(() => { void load(); }, [load]);

    const save = async () => {
        setBusy(true);
        try {
            await api.post(TOGETHER_URL, { name: name.trim() || 'Taught together', bands, subject_ids: picked });
            toast.success('Saved. The next draft teaches these at the same time.');
            setAdding(false); setName(''); setBands([]); setPicked([]);
            await load();
            onChange();
        } catch (err) { toast.error(errorMessage(err, 'Could not save the group')); }
        finally { setBusy(false); }
    };

    const remove = (id: string, label: string) => confirmAlert(`Remove “${label}”?`, 'These subjects will no longer be kept in one slot.', [
        { text: 'Cancel', style: 'cancel' },
        {
            text: 'Remove', style: 'destructive', onPress: () => void (async () => {
                try { await api.del(withQuery(TOGETHER_URL, { id })); await load(); onChange(); }
                catch (err) { toast.error(errorMessage(err, 'Could not remove the group')); }
            })(),
        },
    ]);

    if (!data) return <LoadingView />;
    const builtIn = data.rules.filter((r) => r.builtIn);
    const own = data.rules.filter((r) => !r.builtIn);
    const choices = subjectsAt(data.subjects, bands);

    return (
        <View style={styles.wrap}>
            <View style={styles.head}>
                <Link2 size={18} color={colors.primary} />
                <Text style={styles.title}>Subjects taught at the same time</Text>
            </View>
            <Text style={styles.help}>Learners take one subject from each group, so its subjects share a slot. Add your school’s own option groups here.</Text>

            <Text style={styles.label}>Every school</Text>
            {builtIn.map((r) => (
                <Text key={r.name} style={styles.builtIn}>• {r.name}{r.bands.length > 0 ? ` (${ruleScope(r.bands)})` : ''}</Text>
            ))}

            <Text style={[styles.label, { marginTop: spacing.sm }]}>Your school</Text>
            {own.length === 0 ? <Text style={styles.help}>None yet.</Text> : own.map((r) => (
                <View key={r.id} style={styles.rule}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.ruleName}>{r.name}</Text>
                        <Text style={styles.help}>{r.subjects.join(' / ')} · {ruleScope(r.bands)}</Text>
                    </View>
                    <Pressable onPress={() => r.id && remove(r.id, r.name)} accessibilityRole="button" accessibilityLabel={`Remove ${r.name}`} hitSlop={8} style={styles.iconBtn}>
                        <Trash2 size={16} color={colors.danger} />
                    </Pressable>
                </View>
            ))}

            {adding ? (
                <View style={styles.form}>
                    <TextField label="Group name" value={name} onChangeText={setName} placeholder="e.g. Humanities option" />
                    <Text style={styles.label}>For which levels?</Text>
                    <View style={styles.chips}>
                        <Chip label="Every level" on={bands.length === 0} onPress={() => { setBands([]); }} />
                        {levelsOf(data.subjects).map((b) => (
                            <Chip key={b} label={BAND_LABELS[b]} on={bands.includes(b)} onPress={() => { setBands(toggled(bands, b)); setPicked([]); }} />
                        ))}
                    </View>
                    <Text style={styles.label}>Subjects taught together ({picked.length} picked)</Text>
                    <View style={styles.chips}>
                        {choices.map((s) => <Chip key={s.id} label={s.name} on={picked.includes(s.id)} onPress={() => setPicked(toggled(picked, s.id))} />)}
                    </View>
                    <ButtonRow>
                        <Button variant="secondary" label="Cancel" onPress={() => setAdding(false)} />
                        <Button label="Save group" onPress={() => void save()} loading={busy} disabled={picked.length < 2} />
                    </ButtonRow>
                </View>
            ) : (
                <ButtonRow>
                    <Button size="sm" variant="secondary" label="+ Add a group" onPress={() => setAdding(true)} />
                </ButtonRow>
            )}
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    wrap: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, gap: 4 },
    head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    title: { fontSize: 15, fontFamily: fonts.bold, color: colors.foreground },
    help: { fontSize: 12, lineHeight: 17, fontFamily: fonts.regular, color: colors.muted },
    label: { fontSize: 12, fontFamily: fonts.semibold, color: colors.foreground, marginTop: 4 },
    builtIn: { fontSize: 12, lineHeight: 17, fontFamily: fonts.regular, color: colors.muted },
    rule: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.mutedBg, borderRadius: radius.md, padding: spacing.sm, marginTop: 4 },
    ruleName: { fontSize: 13, fontFamily: fonts.semibold, color: colors.foreground },
    iconBtn: { width: 32, height: 32, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
    form: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.sm, gap: 4 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
    chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.card },
    chipText: { fontSize: 12, fontFamily: fonts.medium, color: colors.foreground },
}));
