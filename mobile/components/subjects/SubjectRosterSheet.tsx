import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Layers, Square, SquareCheck } from 'lucide-react-native';
import type { SubjectRosterEntry } from '@shared/subject-roster-types';
import { useApi, withQuery } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import { errorMessage, pluralize } from '@/lib/format';
import { fonts, radius, spacing, makeStyles, useTheme } from '@/lib/theme';
import { ChipSelect, ErrorBanner, LoadingView, Notice, SearchField } from '@/components/ui';
import { FormSheet } from '@/components/ops/FormSheet';

/**
 * The web's SubjectEnrollmentManager — who takes a subject: 8-4-4 electives
 * (only the CRE takers, not the whole class) and checking CBC electives. Once
 * anyone in a class is enrolled, mark entry lists only enrolled learners there.
 */
export function SubjectRosterSheet({ subject, onClose, onSaved }: {
    subject: { id: string; name: string };
    onClose: () => void;
    onSaved: (message: string) => void;
}) {
    const { colors } = useTheme();
    const styles = useStyles();
    const api = useApi();
    const query = useApiQuery<SubjectRosterEntry[]>(withQuery('/api/admin/student-subjects', { subject_id: subject.id }));
    const roster = useMemo(() => query.data ?? [], [query.data]);
    const saved = useMemo(() => new Set(roster.filter((s) => s.enrolled).map((s) => s.id)), [roster]);
    const [picked, setPicked] = useState<ReadonlySet<string> | null>(null);
    const selected = picked ?? saved;
    const [stream, setStream] = useState('');
    const [search, setSearch] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const streams = useMemo(() => {
        const map = new Map<string, string>();
        roster.forEach((s) => { if (s.stream_id) map.set(s.stream_id, s.stream_name ?? ''); });
        return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    }, [roster]);
    const shown = useMemo(() => {
        const q = search.trim().toLowerCase();
        return roster.filter((s) => (!stream || s.stream_id === stream) && (!q || `${s.name} ${s.admission_number ?? ''}`.toLowerCase().includes(q)));
    }, [roster, stream, search]);
    const allShownOn = shown.length > 0 && shown.every((s) => selected.has(s.id));
    const combos = shown.filter((s) => s.in_combination).length;

    const toggle = (id: string) => {
        const next = new Set(selected);
        if (!next.delete(id)) next.add(id);
        setPicked(next);
    };
    const toggleShown = () => {
        const next = new Set(selected);
        for (const s of shown) {
            if (allShownOn) next.delete(s.id);
            else next.add(s.id);
        }
        setPicked(next);
    };

    const save = async () => {
        const add = [...selected].filter((id) => !saved.has(id));
        const remove = [...saved].filter((id) => !selected.has(id));
        if (add.length === 0 && remove.length === 0) { onClose(); return; }
        setSaving(true);
        setError(null);
        try {
            await api.post('/api/admin/student-subjects', { subject_id: subject.id, add, remove });
            onSaved(`${pluralize(selected.size, 'learner')} now take ${subject.name}.`);
            onClose();
        } catch (err) {
            setError(errorMessage(err, 'Could not save.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <FormSheet visible title={`Learners taking ${subject.name}`} onClose={() => { if (!saving) onClose(); }} onSubmit={() => void save()} submitting={saving}>
            <Text style={styles.intro}>Tick the learners who take this subject. Once anyone in a class is ticked, mark entry for {subject.name} lists only them there.</Text>
            {error ? <ErrorBanner message={error} /> : null}
            {query.loading ? <LoadingView /> : query.error ? <ErrorBanner message={query.error} onRetry={query.reload} /> : (
                <>
                    {streams.length > 1 ? (
                        <ChipSelect options={[{ value: '', label: 'All classes' }, ...streams.map(([id, name]) => ({ value: id, label: name }))]} value={stream} onChange={setStream} />
                    ) : null}
                    <SearchField value={search} onChangeText={setSearch} placeholder="Search learners" />
                    {combos > 0 ? (
                        <Notice tone="warning" message={`${pluralize(combos, 'learner')} here ${combos === 1 ? 'is' : 'are'} on a subject combination, which re-syncs their subjects and may undo changes made here.`} />
                    ) : null}
                    <View style={styles.list}>
                        <View style={styles.head}>
                            <Pressable onPress={toggleShown} disabled={shown.length === 0} style={styles.selectAll} accessibilityRole="button">
                                {allShownOn ? <SquareCheck size={18} color={colors.primary} /> : <Square size={18} color={colors.muted} />}
                                <Text style={styles.headText}>{allShownOn ? 'Untick these' : `Tick all ${shown.length}`}</Text>
                            </Pressable>
                            <Text style={styles.count}>{selected.size} taking it</Text>
                        </View>
                        {shown.length === 0 ? <Text style={styles.empty}>No learners match.</Text> : shown.map((s) => {
                            const on = selected.has(s.id);
                            return (
                                <Pressable key={s.id} onPress={() => toggle(s.id)} style={styles.row} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                                    {on ? <SquareCheck size={20} color={colors.primary} /> : <Square size={20} color={colors.muted} />}
                                    <View style={{ flex: 1, minWidth: 0 }}>
                                        <Text style={styles.name} numberOfLines={1}>{s.name}</Text>
                                        <Text style={styles.sub} numberOfLines={1}>{[s.stream_name, s.admission_number].filter(Boolean).join(' · ')}</Text>
                                    </View>
                                    {s.in_combination ? <Layers size={16} color={colors.warning} accessibilityLabel="On a subject combination" /> : null}
                                </Pressable>
                            );
                        })}
                    </View>
                </>
            )}
        </FormSheet>
    );
}

const useStyles = makeStyles((colors) => ({
    intro: { fontSize: 13, lineHeight: 19, fontFamily: fonts.regular, color: colors.muted, marginBottom: spacing.md },
    list: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, overflow: 'hidden' },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.mutedBg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    selectAll: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    headText: { fontSize: 13, fontFamily: fonts.medium, color: colors.foreground },
    count: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted },
    empty: { padding: spacing.xl, textAlign: 'center', fontSize: 12, fontFamily: fonts.regular, color: colors.muted },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    name: { fontSize: 14, fontFamily: fonts.medium, color: colors.foreground },
    sub: { fontSize: 11, fontFamily: fonts.regular, color: colors.muted },
}));
