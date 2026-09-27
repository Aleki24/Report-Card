import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { LookupOption, LookupType } from '@shared/ops/lookups';
import { Button, SearchField } from '@/components/ui';
import { useLookup } from '@/lib/ops';
import { colors, radius, spacing } from '@/lib/theme';

const MAX_SHOWN = 200;

interface SelectFieldProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    options: readonly LookupOption[];
    placeholder?: string;
    loading?: boolean;
    /** Offer a "None" row (optional fields). */
    clearable?: boolean;
    required?: boolean;
    hint?: string;
}

/**
 * A picker you can search: schools have hundreds of learners, and scrolling
 * a list of 900 names is unusable. Opens a full-screen list with a search box.
 */
export function SelectField({ label, value, onChange, options, placeholder = 'Select…', loading, clearable, required, hint }: SelectFieldProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const selected = options.find((o) => o.id === value);

    const matches = useMemo(() => {
        const q = query.trim().toLowerCase();
        const hits = q ? options.filter((o) => `${o.label} ${o.hint ?? ''}`.toLowerCase().includes(q)) : options;
        return hits.slice(0, MAX_SHOWN);
    }, [options, query]);

    const pick = (id: string) => {
        onChange(id);
        setOpen(false);
        setQuery('');
    };

    return (
        <View style={styles.field}>
            {label ? <Text style={styles.label}>{label}{required ? ' *' : ''}</Text> : null}
            <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={label} style={styles.control}>
                <Text style={[styles.value, !selected && { color: colors.muted }]} numberOfLines={1}>
                    {selected ? selected.label : loading ? 'Loading…' : placeholder}
                </Text>
                <Text style={styles.caret}>▾</Text>
            </Pressable>
            {selected?.hint ? <Text style={styles.hint}>{selected.hint}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}

            <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
                <SafeAreaView style={styles.sheet} edges={['top', 'bottom']}>
                    <View style={styles.sheetHeader}>
                        <Text style={styles.sheetTitle}>{label ?? 'Choose'}</Text>
                        <Button label="Close" variant="ghost" size="sm" onPress={() => setOpen(false)} />
                    </View>
                    <View style={{ paddingHorizontal: spacing.lg }}>
                        <SearchField value={query} onChangeText={setQuery} placeholder="Type to search…" />
                    </View>
                    <FlatList
                        data={matches}
                        keyExtractor={(o) => o.id}
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={{ paddingBottom: spacing.xl }}
                        ListHeaderComponent={clearable && value ? (
                            <Pressable onPress={() => pick('')} style={styles.option}>
                                <Text style={[styles.optionLabel, { color: colors.muted }]}>None</Text>
                            </Pressable>
                        ) : null}
                        ListEmptyComponent={<Text style={styles.empty}>{loading ? 'Loading…' : 'Nothing matches.'}</Text>}
                        renderItem={({ item }) => {
                            const active = item.id === value;
                            return (
                                <Pressable onPress={() => pick(item.id)} style={({ pressed }) => [styles.option, (active || pressed) && { backgroundColor: colors.mutedBg }]}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.optionLabel, active && { color: colors.primary }]}>{item.label}</Text>
                                        {item.hint ? <Text style={styles.optionHint}>{item.hint}</Text> : null}
                                    </View>
                                    {active ? <Text style={{ color: colors.primary, fontWeight: '800' }}>✓</Text> : null}
                                </Pressable>
                            );
                        }}
                    />
                </SafeAreaView>
            </Modal>
        </View>
    );
}

/** A SelectField fed by `/api/ops/lookups` (learners, staff, classes, subjects, terms…). */
export function LookupField({ lookup, params, filter, ...rest }: Omit<SelectFieldProps, 'options' | 'loading'> & {
    lookup: LookupType;
    params?: Record<string, string | undefined>;
    filter?: (o: LookupOption) => boolean;
}) {
    const { options, loading } = useLookup(lookup, params);
    const shown = useMemo(() => (filter ? options.filter(filter) : options), [options, filter]);
    return <SelectField {...rest} options={shown} loading={loading} />;
}

const styles = StyleSheet.create({
    field: { marginBottom: spacing.md },
    label: { fontSize: 12, fontWeight: '700', color: colors.muted, marginBottom: 6 },
    control: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.md, minHeight: 44, backgroundColor: colors.card, gap: spacing.sm },
    value: { flex: 1, fontSize: 14, color: colors.foreground },
    caret: { color: colors.muted, fontSize: 14 },
    hint: { fontSize: 11, color: colors.muted, marginTop: 4 },
    sheet: { flex: 1, backgroundColor: colors.background },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.foreground },
    option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    optionLabel: { fontSize: 14, fontWeight: '600', color: colors.foreground },
    optionHint: { fontSize: 12, color: colors.muted, marginTop: 2 },
    empty: { textAlign: 'center', color: colors.muted, padding: spacing.xl },
});
