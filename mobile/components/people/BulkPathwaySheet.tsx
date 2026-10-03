import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Square, SquareCheck } from 'lucide-react-native';
import { pathwayLabel } from '@shared/pathway-definitions';
import { useApi } from '@/lib/api';
import { errorMessage, fullName, pluralize } from '@/lib/format';
import type { GradeStream, StudentListItem } from '@/lib/types';
import { colors, fonts, radius, spacing } from '@/lib/theme';
import { ChipSelect, ErrorBanner, SearchField, ToggleRow } from '@/components/ui';
import { FormSheet } from '@/components/ops/FormSheet';
import { SelectField } from '@/components/ops/SelectField';

/** GET /api/school/data?type=subject_combinations, as the web's CombinationOption. */
export interface CombinationOption {
    id: string;
    code: string;
    name: string;
    pathway: string;
    track: string | null;
    is_active: boolean;
}

/**
 * The web's BulkPathwayModal: move CBC Senior School learners (Grades 10–12)
 * to a subject combination; their subjects — three electives plus the
 * compulsory core — update to match (POST /api/admin/student-pathways).
 */
export function BulkPathwaySheet({ visible, onClose, onSaved, students, seniorStreams, combinations, defaultStreamId }: {
    visible: boolean;
    onClose: () => void;
    onSaved: (message: string) => void;
    students: readonly StudentListItem[];
    seniorStreams: readonly GradeStream[];
    combinations: readonly CombinationOption[];
    defaultStreamId: string;
}) {
    const api = useApi();
    const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
    const [streamId, setStreamId] = useState(() => (seniorStreams.some((s) => s.id === defaultStreamId) ? defaultStreamId : ''));
    const [search, setSearch] = useState('');
    const [combinationId, setCombinationId] = useState('');
    const [clear, setClear] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const seniorIds = useMemo(() => new Set(seniorStreams.map((s) => s.id)), [seniorStreams]);
    const shown = useMemo(() => {
        const q = search.trim().toLowerCase();
        return students.filter((s) =>
            !!s.current_grade_stream_id && seniorIds.has(s.current_grade_stream_id)
            && (!streamId || s.current_grade_stream_id === streamId)
            && (!q || `${fullName(s.users)} ${s.admission_number ?? ''}`.toLowerCase().includes(q)));
    }, [students, seniorIds, streamId, search]);
    const allShownSelected = shown.length > 0 && shown.every((s) => selected.has(s.id));

    const toggle = (id: string) => setSelected((prev) => {
        const next = new Set(prev);
        if (!next.delete(id)) next.add(id);
        return next;
    });
    const toggleShown = () => setSelected((prev) => {
        const next = new Set(prev);
        for (const s of shown) {
            if (allShownSelected) next.delete(s.id);
            else next.add(s.id);
        }
        return next;
    });

    const count = selected.size;
    const save = async () => {
        if (count === 0) { setError('Select at least one student.'); return; }
        if (!clear && !combinationId) { setError('Choose the combination to assign.'); return; }
        setSaving(true);
        setError(null);
        try {
            const r = await api.post<{ updated?: number; warnings?: string[] }>('/api/admin/student-pathways', {
                student_ids: [...selected], subject_combination_id: clear ? null : combinationId, pathway: null, track: null,
            });
            const warnings = r.warnings?.length ? ` (${pluralize(r.warnings.length, 'subject sync warning')})` : '';
            onSaved(`${pluralize(r.updated ?? count, 'student')} ${clear ? 'cleared' : 'assigned'}${warnings}.`);
            onClose();
        } catch (err) {
            setError(errorMessage(err, 'Could not update pathways.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <FormSheet
            visible={visible}
            title="Pathways & subject combinations"
            onClose={() => { if (!saving) onClose(); }}
            onSubmit={() => void save()}
            submitLabel={clear ? `Clear ${pluralize(count, 'student')}` : `Assign ${pluralize(count, 'student')}`}
            submitting={saving}
        >
            <Text style={styles.intro}>Move Senior School students (Grades 10–12) to a subject combination. Their subjects — three electives plus the compulsory core — update to match.</Text>
            {error ? <ErrorBanner message={error} /> : null}
            <ChipSelect
                label="Class"
                options={[{ value: '', label: 'All senior classes' }, ...seniorStreams.map((s) => ({ value: s.id, label: s.full_name }))]}
                value={streamId}
                onChange={setStreamId}
            />
            <SearchField value={search} onChangeText={setSearch} placeholder="Search students" />
            <View style={styles.list}>
                <View style={styles.listHead}>
                    <Pressable onPress={toggleShown} disabled={shown.length === 0} style={styles.selectAll} accessibilityRole="button">
                        {allShownSelected ? <SquareCheck size={18} color={colors.primary} /> : <Square size={18} color={colors.muted} />}
                        <Text style={styles.headText}>{allShownSelected ? 'Unselect these' : `Select all ${shown.length}`}</Text>
                    </Pressable>
                    <Text style={styles.count}>{count} selected</Text>
                </View>
                {shown.length === 0 ? (
                    <Text style={styles.empty}>
                        {seniorStreams.length === 0 ? 'No Grade 10–12 classes yet. Pathways only apply to Senior School students.' : 'No Senior School students match.'}
                    </Text>
                ) : shown.map((s) => {
                    const on = selected.has(s.id);
                    return (
                        <Pressable key={s.id} onPress={() => toggle(s.id)} style={styles.row} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                            {on ? <SquareCheck size={20} color={colors.primary} /> : <Square size={20} color={colors.muted} />}
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={styles.name} numberOfLines={1}>{fullName(s.users)}</Text>
                                <Text style={styles.sub} numberOfLines={1}>{s.grade_streams?.full_name ?? 'No class'} · {s.admission_number ?? 'No adm. no.'}</Text>
                            </View>
                            <Text style={[styles.badge, s.subject_combinations ? styles.badgeOn : null]}>{s.subject_combinations?.code ?? 'Unassigned'}</Text>
                        </Pressable>
                    );
                })}
            </View>
            {!clear ? (
                <SelectField
                    label="Assign to combination"
                    placeholder="Choose a combination"
                    value={combinationId}
                    onChange={setCombinationId}
                    options={combinations.filter((c) => c.is_active).map((c) => ({ id: c.id, label: `${c.code} — ${c.name}`, hint: `${pathwayLabel(c.pathway)}${c.track ? ` / ${c.track}` : ''}` }))}
                />
            ) : null}
            <ToggleRow label="Clear instead" description="Remove the selected students’ combination and pathway." value={clear} onValueChange={setClear} />
        </FormSheet>
    );
}

const styles = StyleSheet.create({
    intro: { fontSize: 13, lineHeight: 19, fontFamily: fonts.regular, color: colors.muted, marginBottom: spacing.md },
    list: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, overflow: 'hidden', marginBottom: spacing.md },
    listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.mutedBg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    selectAll: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    headText: { fontSize: 13, fontFamily: fonts.medium, color: colors.foreground },
    count: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted },
    empty: { padding: spacing.xl, textAlign: 'center', fontSize: 12, lineHeight: 18, fontFamily: fonts.regular, color: colors.muted },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    name: { fontSize: 14, fontFamily: fonts.medium, color: colors.foreground },
    sub: { fontSize: 11, fontFamily: fonts.regular, color: colors.muted },
    badge: { fontSize: 11, fontFamily: fonts.semibold, color: colors.muted, backgroundColor: colors.mutedBg, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 2, overflow: 'hidden' },
    badgeOn: { color: '#016630', backgroundColor: colors.successBg },
});
