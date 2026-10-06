import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react-native';
import { fonts, makeStyles, radius, spacing, useTheme, shadowFor } from '@/lib/theme';

/** One choice: what is stored, what is shown, and an optional second line. */
export interface ChoiceOption<T extends string> {
    value: T;
    label: string;
    hint?: string;
}

/** Inside a FilterGrid the grid spaces its cells, so fields drop their own margin. */
const InGrid = React.createContext(false);

/** Filters in a grid are always fields, so a row of them lines up. */
export const useInFilterGrid = () => React.useContext(InGrid);

const tick = () => void Haptics.selectionAsync().catch(() => undefined);

/** Long lists get a search box; short ones are read at a glance. */
const SEARCH_FROM = 9;

/**
 * A sheet that rises from the bottom with the options as full-width rows:
 * easy to reach with a thumb, with room for long class and subject names.
 */
export function OptionSheet<T extends string>({
    visible, title, options, value, onPick, onClose, searchable, emptyText = 'Nothing matches.', header,
}: {
    visible: boolean;
    title: string;
    options: readonly ChoiceOption<T>[];
    value: T | null;
    onPick: (value: T) => void;
    onClose: () => void;
    /** Defaults to on for long lists. */
    searchable?: boolean;
    emptyText?: string;
    /** Above the list, e.g. a "None" row. */
    header?: React.ReactElement | null;
}) {
    const { colors } = useTheme();
    const styles = useStyles();
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const [query, setQuery] = useState('');
    const withSearch = searchable ?? options.length >= SEARCH_FROM;

    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q ? options.filter((o) => `${o.label} ${o.hint ?? ''}`.toLowerCase().includes(q)) : options;
    }, [options, query]);

    const close = () => { setQuery(''); onClose(); };
    const pick = (v: T) => { tick(); setQuery(''); onPick(v); };

    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
            <View style={styles.backdrop}>
                <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
                <View style={[styles.sheet, { maxHeight: height * 0.82, paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
                    <View style={styles.grabber} />
                    <View style={styles.sheetHead}>
                        <Text style={styles.sheetTitle} numberOfLines={1}>{title}</Text>
                        <Pressable onPress={close} hitSlop={10} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close">
                            <X size={18} color={colors.muted} />
                        </Pressable>
                    </View>
                    {withSearch ? (
                        <View style={styles.searchBox}>
                            <Search size={16} color={colors.muted} />
                            <TextInput
                                value={query}
                                onChangeText={setQuery}
                                placeholder="Search…"
                                placeholderTextColor={colors.placeholder}
                                autoCorrect={false}
                                style={styles.searchInput}
                            />
                        </View>
                    ) : null}
                    <FlatList
                        data={shown}
                        keyExtractor={(o) => o.value || '∅'}
                        keyboardShouldPersistTaps="handled"
                        ListHeaderComponent={header}
                        ListEmptyComponent={<Text style={styles.empty}>{emptyText}</Text>}
                        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}
                        renderItem={({ item }) => {
                            const active = item.value === value;
                            return (
                                <Pressable
                                    onPress={() => pick(item.value)}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: active }}
                                    style={({ pressed }) => [styles.row, active && styles.rowActive, pressed && !active && { backgroundColor: colors.mutedBg }]}
                                >
                                    <View style={{ flex: 1, minWidth: 0 }}>
                                        <Text style={[styles.rowLabel, active && { color: colors.primary }]} numberOfLines={2}>{item.label}</Text>
                                        {item.hint ? <Text style={styles.rowHint} numberOfLines={2}>{item.hint}</Text> : null}
                                    </View>
                                    <View style={[styles.radio, active && styles.radioOn]}>
                                        {active ? <Check size={13} color={colors.onPrimary} strokeWidth={3} /> : null}
                                    </View>
                                </Pressable>
                            );
                        }}
                    />
                </View>
            </View>
        </Modal>
    );
}

/**
 * A field that shows the current choice and opens the option sheet: the
 * label sits inside the box, so filters read as "Class · Form 3".
 */
export function PickerField<T extends string>({
    label, options, value, onChange, placeholder = 'Choose…', compact,
}: {
    label?: string;
    options: readonly ChoiceOption<T>[];
    value: T | null;
    onChange: (value: T) => void;
    placeholder?: string;
    /** No outer margin: for filter rows laid out by the parent. */
    compact?: boolean;
}) {
    const { colors } = useTheme();
    const styles = useStyles();
    const inGrid = React.useContext(InGrid);
    const [open, setOpen] = useState(false);
    const selected = options.find((o) => o.value === value);
    return (
        <View style={!(compact || inGrid) && styles.fieldGap}>
            <Pressable
                onPress={() => { tick(); setOpen(true); }}
                accessibilityRole="button"
                accessibilityLabel={`${label ?? 'Choose'}: ${selected?.label ?? 'none'}`}
                style={({ pressed }) => [styles.picker, pressed && { borderColor: colors.primary }]}
            >
                <View style={{ flex: 1, minWidth: 0 }}>
                    {label ? <Text style={styles.pickerLabel} numberOfLines={1}>{label.toUpperCase()}</Text> : null}
                    <Text style={[styles.pickerValue, !selected && { color: colors.placeholder }]} numberOfLines={1}>
                        {selected?.label ?? placeholder}
                    </Text>
                    {selected?.hint ? <Text style={styles.pickerHint} numberOfLines={1}>{selected.hint}</Text> : null}
                </View>
                <View style={styles.pickerIcon}><ChevronsUpDown size={16} color={colors.primary} /></View>
            </Pressable>
            <OptionSheet
                visible={open}
                title={label ?? 'Choose'}
                options={options}
                value={value}
                onPick={(v) => { setOpen(false); onChange(v); }}
                onClose={() => setOpen(false)}
            />
        </View>
    );
}

/** Two or three short choices side by side on a sunken track. */
export function SegmentedChoice<T extends string>({ options, value, onChange }: {
    options: readonly ChoiceOption<T>[];
    value: T | null;
    onChange: (value: T) => void;
}) {
    const styles = useStyles();
    return (
        <View style={styles.track} accessibilityRole="radiogroup">
            {options.map((o) => {
                const active = o.value === value;
                return (
                    <Pressable
                        key={o.value || '∅'}
                        onPress={() => { if (!active) { tick(); onChange(o.value); } }}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: active }}
                        style={[styles.trackItem, active && styles.trackItemOn]}
                    >
                        <Text style={[styles.trackText, active && styles.trackTextOn]} numberOfLines={1}>{o.label}</Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

/** A handful of choices as cards in a grid, each with a tick when chosen. */
export function OptionTiles<T extends string>({ options, value, onChange }: {
    options: readonly ChoiceOption<T>[];
    value: T | null;
    onChange: (value: T) => void;
}) {
    const { colors } = useTheme();
    const styles = useStyles();
    return (
        <View style={styles.tiles} accessibilityRole="radiogroup">
            {options.map((o) => {
                const active = o.value === value;
                return (
                    <Pressable
                        key={o.value || '∅'}
                        onPress={() => { tick(); onChange(o.value); }}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: active }}
                        style={({ pressed }) => [styles.tile, active && styles.tileOn, pressed && !active && { backgroundColor: colors.mutedBg }]}
                    >
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={[styles.tileLabel, active && { color: colors.primary }]} numberOfLines={2}>{o.label}</Text>
                            {o.hint ? <Text style={styles.tileHint} numberOfLines={2}>{o.hint}</Text> : null}
                        </View>
                        <View style={[styles.radio, styles.radioSm, active && styles.radioOn]}>
                            {active ? <Check size={11} color={colors.onPrimary} strokeWidth={3} /> : null}
                        </View>
                    </Pressable>
                );
            })}
        </View>
    );
}

/** Filters side by side, two to a row on phones and more on tablets. */
export function FilterGrid({ children }: { children: React.ReactNode }) {
    const styles = useStyles();
    const { width } = useWindowDimensions();
    const columns = width >= 900 ? 4 : width >= 600 ? 3 : 2;
    const items = React.Children.toArray(children).filter(Boolean);
    return (
        <InGrid.Provider value>
            <View style={styles.filterGrid}>
                {items.map((child, i) => (
                    <View key={i} style={{ width: `${100 / columns - 2}%`, flexGrow: 1 }}>{child}</View>
                ))}
            </View>
        </InGrid.Provider>
    );
}

export type ChoiceLayout = 'segmented' | 'tiles' | 'picker';

/** Short, few choices sit side by side; a handful become tiles; anything longer opens a sheet. */
export function layoutFor(options: readonly ChoiceOption<string>[], wrap?: boolean): ChoiceLayout {
    const chars = options.reduce((n, o) => n + o.label.length, 0);
    const hinted = options.some((o) => o.hint);
    if (options.length <= 4 && !hinted && chars <= 28) return 'segmented';
    if (wrap && options.length <= 6) return 'tiles';
    return 'picker';
}

const useStyles = makeStyles((colors) => ({
    fieldGap: { marginBottom: spacing.md },
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
    sheet: {
        backgroundColor: colors.card, borderTopLeftRadius: radius.xxxl, borderTopRightRadius: radius.xxxl,
        paddingTop: spacing.sm, width: '100%', maxWidth: 640, alignSelf: 'center',
    },
    grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.sm },
    sheetHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.md },
    sheetTitle: { flex: 1, fontSize: 18, fontFamily: fonts.display, color: colors.foreground, letterSpacing: -0.3 },
    closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.mutedBg, alignItems: 'center', justifyContent: 'center' },
    searchBox: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.lg, marginBottom: spacing.sm,
        paddingHorizontal: spacing.md, borderRadius: radius.xl, backgroundColor: colors.mutedBg, minHeight: 44,
    },
    searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.foreground, paddingVertical: 8 },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 14, borderRadius: radius.xl, marginBottom: 2 },
    rowActive: { backgroundColor: colors.primarySoft },
    rowLabel: { fontSize: 15, fontFamily: fonts.semibold, color: colors.foreground },
    rowHint: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
    radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    radioSm: { width: 18, height: 18, borderRadius: 9 },
    radioOn: { backgroundColor: colors.primarySolid, borderColor: colors.primarySolid },
    empty: { textAlign: 'center', color: colors.muted, fontFamily: fonts.regular, padding: spacing.xl },
    picker: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 56,
        paddingLeft: spacing.md, paddingRight: spacing.sm, paddingVertical: spacing.sm,
        borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, ...shadowFor(colors),
    },
    pickerLabel: { fontSize: 10, fontFamily: fonts.bold, color: colors.muted, letterSpacing: 0.8, marginBottom: 1 },
    pickerValue: { fontSize: 15, fontFamily: fonts.bold, color: colors.foreground },
    pickerHint: { fontSize: 11, fontFamily: fonts.regular, color: colors.muted, marginTop: 1 },
    pickerIcon: { width: 32, height: 32, borderRadius: radius.lg, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
    track: { flexDirection: 'row', padding: 4, borderRadius: radius.xl, backgroundColor: colors.mutedBg, borderWidth: 1, borderColor: colors.border, gap: 4 },
    trackItem: { flex: 1, minHeight: 38, paddingHorizontal: spacing.sm, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
    trackItemOn: { backgroundColor: colors.card, ...shadowFor(colors), elevation: 2 },
    trackText: { fontSize: 13, fontFamily: fonts.semibold, color: colors.muted },
    trackTextOn: { color: colors.foreground, fontFamily: fonts.bold },
    tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    tile: {
        flexBasis: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 52,
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
    },
    tileOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    tileLabel: { fontSize: 14, fontFamily: fonts.semibold, color: colors.foreground },
    tileHint: { fontSize: 11, fontFamily: fonts.regular, color: colors.muted, marginTop: 1 },
    filterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
}));
