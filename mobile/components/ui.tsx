import React from 'react';
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
    type KeyboardTypeOptions,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/lib/theme';
import { formatDate, parseISODate, shiftISODate, toISODate } from '@/lib/format';

// ── Layout ─────────────────────────────────────────────────

export function Screen({
    children,
    onRefresh,
    refreshing,
    footer,
}: {
    children: React.ReactNode;
    onRefresh?: () => void;
    refreshing?: boolean;
    /** Pinned below the scroll area (e.g. a save bar). */
    footer?: React.ReactNode;
}) {
    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
            >
                <View style={styles.content}>{children}</View>
            </ScrollView>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
        </SafeAreaView>
    );
}

export function ScreenHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
    return (
        <View style={styles.header}>
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.headerTitle}>{title}</Text>
                {description ? <Text style={styles.headerDesc}>{description}</Text> : null}
            </View>
            {action}
        </View>
    );
}

export function BackLink({ label = 'Back' }: { label?: string }) {
    const router = useRouter();
    return (
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ marginBottom: spacing.md, alignSelf: 'flex-start' }}>
            <Text style={styles.link}>← {label}</Text>
        </Pressable>
    );
}

export function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
    return (
        <View style={styles.sectionRow}>
            <Text style={styles.sectionLabel}>{children}</Text>
            {action}
        </View>
    );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
    return <View style={[styles.card, style]}>{children}</View>;
}

/** A card whose rows run edge to edge, separated by hairlines. */
export function ListCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
    return <View style={[styles.card, styles.listCard, style]}>{children}</View>;
}

export function ListRow({
    title,
    subtitle,
    meta,
    left,
    right,
    onPress,
    danger,
}: {
    title: string;
    subtitle?: string | null;
    meta?: string | null;
    left?: React.ReactNode;
    right?: React.ReactNode;
    onPress?: () => void;
    danger?: boolean;
}) {
    const body = (
        <>
            {left}
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.rowTitle, danger && { color: colors.danger }]} numberOfLines={2}>{title}</Text>
                {subtitle ? <Text style={styles.rowSub} numberOfLines={3}>{subtitle}</Text> : null}
                {meta ? <Text style={styles.rowMeta}>{meta}</Text> : null}
            </View>
            {right}
            {onPress && !right ? <Text style={styles.chevron}>›</Text> : null}
        </>
    );
    return onPress ? (
        <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.mutedBg }]}>
            {body}
        </Pressable>
    ) : (
        <View style={styles.row}>{body}</View>
    );
}

export function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
    return (
        <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={styles.infoValue} numberOfLines={2}>{value === null || value === undefined || value === '' ? '—' : value}</Text>
        </View>
    );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
    return <View style={styles.statGrid}>{children}</View>;
}

export function StatTile({ label, value, sub, tone, onPress }: { label: string; value: string | number; sub?: string; tone?: string; onPress?: () => void }) {
    const content = (
        <>
            <Text style={styles.statLabel}>{label}</Text>
            <Text style={[styles.statValue, tone ? { color: tone } : null]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
            {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
        </>
    );
    return onPress ? (
        <Pressable onPress={onPress} style={({ pressed }) => [styles.card, styles.statTile, pressed && { opacity: 0.8 }]}>{content}</Pressable>
    ) : (
        <View style={[styles.card, styles.statTile]}>{content}</View>
    );
}

// ── Feedback ───────────────────────────────────────────────

type BadgeVariant = 'success' | 'danger' | 'warning' | 'info' | 'default';

const BADGE_COLORS: Record<BadgeVariant, { bg: string; fg: string }> = {
    success: { bg: colors.successBg, fg: colors.success },
    danger: { bg: colors.dangerBg, fg: colors.danger },
    warning: { bg: colors.warningBg, fg: colors.warning },
    info: { bg: colors.infoBg, fg: colors.info },
    default: { bg: colors.mutedBg, fg: colors.muted },
};

export function Badge({ label, variant = 'default' }: { label: string; variant?: BadgeVariant }) {
    const c = BADGE_COLORS[variant];
    return (
        <View style={[styles.badge, { backgroundColor: c.bg }]}>
            <Text style={[styles.badgeText, { color: c.fg }]}>{label}</Text>
        </View>
    );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
    return (
        <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{title}</Text>
            {description ? <Text style={styles.emptyDesc}>{description}</Text> : null}
            {action ? <View style={{ marginTop: spacing.md }}>{action}</View> : null}
        </View>
    );
}

export function LoadingView() {
    return (
        <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
        </View>
    );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
    return (
        <View style={[styles.banner, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}>
            <Text style={[styles.bannerText, { color: colors.danger }]}>{message}</Text>
            {onRetry ? (
                <Text onPress={onRetry} style={[styles.bannerAction, { color: colors.danger }]}>
                    Retry
                </Text>
            ) : null}
        </View>
    );
}

export function Notice({ message, tone = 'success', onDismiss }: { message: string; tone?: 'success' | 'info' | 'warning' | 'danger'; onDismiss?: () => void }) {
    const c = BADGE_COLORS[tone];
    return (
        <View style={[styles.banner, { backgroundColor: c.bg, borderColor: c.fg }]}>
            <Text style={[styles.bannerText, { color: c.fg }]}>{message}</Text>
            {onDismiss ? (
                <Text onPress={onDismiss} style={[styles.bannerAction, { color: c.fg }]}>
                    ✕
                </Text>
            ) : null}
        </View>
    );
}

export function ProgressBar({ value, color = colors.primary }: { value: number; color?: string }) {
    const pct = Math.max(0, Math.min(100, value));
    return (
        <View style={[styles.progressTrack, { backgroundColor: `${color}26` }]}>
            <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: color }]} />
        </View>
    );
}

// ── Inputs ─────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
    label,
    onPress,
    variant = 'primary',
    loading,
    disabled,
    block,
    size = 'md',
}: {
    label: string;
    onPress: () => void;
    variant?: ButtonVariant;
    loading?: boolean;
    disabled?: boolean;
    block?: boolean;
    size?: 'sm' | 'md';
}) {
    const isDisabled = disabled || loading;
    return (
        <Pressable
            onPress={onPress}
            disabled={isDisabled}
            accessibilityRole="button"
            accessibilityState={{ disabled: isDisabled, busy: loading }}
            style={({ pressed }) => [
                styles.button,
                size === 'sm' && styles.buttonSm,
                buttonVariantStyles[variant],
                block && { alignSelf: 'stretch' },
                (pressed || isDisabled) && { opacity: isDisabled ? 0.5 : 0.85 },
            ]}
        >
            {loading ? <ActivityIndicator size="small" color={variant === 'primary' || variant === 'danger' ? colors.white : colors.primary} /> : null}
            <Text style={[styles.buttonText, size === 'sm' && { fontSize: 12 }, buttonTextStyles[variant]]}>{label}</Text>
        </Pressable>
    );
}

export function ButtonRow({ children }: { children: React.ReactNode }) {
    return <View style={styles.buttonRow}>{children}</View>;
}

export function TextField({
    label,
    value,
    onChangeText,
    placeholder,
    multiline,
    keyboardType,
    secureTextEntry,
    autoCapitalize,
    error,
}: {
    label?: string;
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    multiline?: boolean;
    keyboardType?: KeyboardTypeOptions;
    secureTextEntry?: boolean;
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
    error?: string | null;
}) {
    return (
        <View style={styles.field}>
            {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
            <TextInput
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={colors.muted}
                multiline={multiline}
                keyboardType={keyboardType}
                secureTextEntry={secureTextEntry}
                autoCapitalize={autoCapitalize}
                style={[styles.input, multiline && styles.textArea, error ? { borderColor: colors.danger } : null]}
            />
            {error ? <Text style={styles.fieldError}>{error}</Text> : null}
        </View>
    );
}

export function SearchField({ value, onChangeText, placeholder = 'Search…' }: { value: string; onChangeText: (text: string) => void; placeholder?: string }) {
    return (
        <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={colors.muted}
            autoCorrect={false}
            clearButtonMode="while-editing"
            style={[styles.input, styles.search]}
        />
    );
}

export function ToggleRow({ label, description, value, onValueChange }: { label: string; description?: string; value: boolean; onValueChange: (v: boolean) => void }) {
    return (
        <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{label}</Text>
                {description ? <Text style={styles.rowSub}>{description}</Text> : null}
            </View>
            <Switch value={value} onValueChange={onValueChange} trackColor={{ true: colors.primary, false: colors.border }} />
        </View>
    );
}

export interface ChipOption<T extends string> {
    value: T;
    label: string;
    hint?: string;
}

/** Single-select pills. Scrolls sideways by default; `wrap` lays them out in rows. */
export function ChipSelect<T extends string>({
    options,
    value,
    onChange,
    label,
    wrap,
}: {
    options: readonly ChipOption<T>[];
    value: T | null;
    onChange: (value: T) => void;
    label?: string;
    wrap?: boolean;
}) {
    const chips = options.map((o) => {
        const active = o.value === value;
        return (
            <Pressable
                key={o.value}
                onPress={() => onChange(o.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.chip, active && styles.chipActive]}
            >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text>
                {o.hint ? <Text style={[styles.chipHint, active && styles.chipTextActive]}>{o.hint}</Text> : null}
            </Pressable>
        );
    });
    return (
        <View style={styles.field}>
            {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
            {wrap ? (
                <View style={styles.chipWrap}>{chips}</View>
            ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                    {chips}
                </ScrollView>
            )}
        </View>
    );
}

/** Tabs within a screen (e.g. Marks / Results / Publish). */
export function SegmentedTabs<T extends string>({ tabs, value, onChange }: { tabs: readonly ChipOption<T>[]; value: T; onChange: (v: T) => void }) {
    return (
        <View style={styles.segmented}>
            {tabs.map((t) => {
                const active = t.value === value;
                return (
                    <Pressable
                        key={t.value}
                        onPress={() => onChange(t.value)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: active }}
                        style={[styles.segment, active && styles.segmentActive]}
                    >
                        <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>{t.label}</Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

/** ‹ date › stepper over YYYY-MM-DD strings; no native picker dependency needed. */
export function DateStepper({ value, onChange, max }: { value: string; onChange: (iso: string) => void; max?: string }) {
    const atMax = !!max && value >= max;
    return (
        <View style={styles.dateRow}>
            <Pressable onPress={() => onChange(shiftISODate(value, -1))} hitSlop={8} style={styles.dateArrow} accessibilityLabel="Previous day">
                <Text style={styles.dateArrowText}>‹</Text>
            </Pressable>
            <Pressable onPress={() => onChange(toISODate())} accessibilityHint="Jump to today">
                <Text style={styles.dateText}>{formatDate(parseISODate(value), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</Text>
            </Pressable>
            <Pressable onPress={() => !atMax && onChange(shiftISODate(value, 1))} disabled={atMax} hitSlop={8} style={[styles.dateArrow, atMax && { opacity: 0.3 }]} accessibilityLabel="Next day">
                <Text style={styles.dateArrowText}>›</Text>
            </Pressable>
        </View>
    );
}

export function Avatar({ label, size = 56, color = colors.primary }: { label: string; size?: number; color?: string }) {
    return (
        <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
            <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{label}</Text>
        </View>
    );
}

/** Month/day block used for exams and due dates. */
export function DateBadge({ date, highlight }: { date: string; highlight?: boolean }) {
    const d = new Date(date);
    return (
        <View style={[styles.dateBadge, highlight && { borderColor: colors.warning, backgroundColor: colors.warningBg }]}>
            <Text style={[styles.dateBadgeMonth, highlight && { color: colors.warning }]}>{d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()}</Text>
            <Text style={styles.dateBadgeDay}>{d.toLocaleDateString('en-GB', { day: '2-digit' })}</Text>
        </View>
    );
}

const buttonVariantStyles = StyleSheet.create({
    primary: { backgroundColor: colors.primary, borderColor: colors.primary },
    secondary: { backgroundColor: colors.card, borderColor: colors.border },
    danger: { backgroundColor: colors.danger, borderColor: colors.danger },
    ghost: { backgroundColor: 'transparent', borderColor: 'transparent' },
});

const buttonTextStyles = StyleSheet.create({
    primary: { color: colors.white },
    secondary: { color: colors.foreground },
    danger: { color: colors.white },
    ghost: { color: colors.primary },
});

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    scrollContent: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
    // Cap line length on tablets so screens stay readable at every width.
    content: { width: '100%', maxWidth: 760, alignSelf: 'center' },
    footer: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card },
    header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.lg },
    headerTitle: { fontSize: 24, fontWeight: '800', color: colors.foreground },
    headerDesc: { fontSize: 13, color: colors.muted, marginTop: 4 },
    link: { color: colors.primary, fontWeight: '700', fontSize: 14 },
    sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.sm },
    sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
    card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
    listCard: { padding: 0, overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    rowTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    rowSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
    rowMeta: { fontSize: 11, color: colors.muted, marginTop: 4 },
    chevron: { fontSize: 22, color: colors.muted },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    infoLabel: { fontSize: 13, color: colors.muted, fontWeight: '600' },
    infoValue: { fontSize: 13, color: colors.foreground, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
    statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    statTile: { flexBasis: '47%', flexGrow: 1, gap: 2, padding: spacing.md },
    statLabel: { fontSize: 12, color: colors.muted, fontWeight: '600' },
    statValue: { fontSize: 20, fontWeight: '800', color: colors.foreground },
    statSub: { fontSize: 11, color: colors.muted },
    badge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
    badgeText: { fontSize: 11, fontWeight: '700' },
    empty: { alignItems: 'center', paddingVertical: spacing.xl * 1.5, paddingHorizontal: spacing.lg },
    emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.foreground, textAlign: 'center' },
    emptyDesc: { fontSize: 13, color: colors.muted, marginTop: 4, textAlign: 'center' },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl * 2 },
    banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.md },
    bannerText: { fontSize: 13, flex: 1, marginRight: spacing.sm },
    bannerAction: { fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
    progressTrack: { height: 10, borderRadius: 999, overflow: 'hidden', width: '100%' },
    progressFill: { height: '100%', borderRadius: 999 },
    button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: spacing.lg, minHeight: 44 },
    buttonSm: { paddingVertical: 6, paddingHorizontal: spacing.md, minHeight: 32 },
    buttonText: { fontWeight: '700', fontSize: 14 },
    buttonRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
    field: { marginBottom: spacing.md },
    fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.muted, marginBottom: 6 },
    fieldError: { fontSize: 12, color: colors.danger, marginTop: 4 },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: 14, color: colors.foreground, backgroundColor: colors.card, minHeight: 44 },
    textArea: { minHeight: 96, textAlignVertical: 'top' },
    search: { marginBottom: spacing.md },
    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
    chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, minHeight: 36, justifyContent: 'center' },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontSize: 13, fontWeight: '600', color: colors.foreground },
    chipHint: { fontSize: 10, color: colors.muted, marginTop: 1 },
    chipTextActive: { color: colors.white },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    segmented: { flexDirection: 'row', padding: 4, borderRadius: radius.md, backgroundColor: colors.mutedBg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
    segment: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: 'center' },
    segmentActive: { backgroundColor: colors.card, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
    segmentText: { fontSize: 13, fontWeight: '600', color: colors.muted },
    segmentTextActive: { color: colors.foreground },
    dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg, marginBottom: spacing.md },
    dateArrow: { padding: spacing.sm },
    dateArrowText: { fontSize: 24, color: colors.primary, fontWeight: '700' },
    dateText: { fontSize: 14, fontWeight: '700', color: colors.foreground, minWidth: 160, textAlign: 'center' },
    avatar: { alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: colors.white, fontWeight: '800' },
    dateBadge: { width: 44, height: 44, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    dateBadgeMonth: { fontSize: 9, fontWeight: '700', color: colors.muted },
    dateBadgeDay: { fontSize: 15, fontWeight: '800', color: colors.foreground },
});
