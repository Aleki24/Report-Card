import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Image,
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
import { usePathname, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { pageIdentity } from '@/lib/hues';
import { CountUp } from './dashboard/kit';
import { InlineLoader } from './Loader';
export { FilterGrid } from './Choice';
import { OptionTiles, PickerField, SegmentedChoice, layoutFor, useInFilterGrid, type ChoiceLayout, type ChoiceOption } from './Choice';
import { screenIconFor } from '@/lib/roles';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoidingView, KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { ArrowLeft, ChevronLeft, ChevronRight, Inbox, Search, X, type LucideIcon } from 'lucide-react-native';
import { radius, spacing, fonts, makeStyles, useTheme, shadowFor, type Hue, type Palette } from '@/lib/theme';
import { formatDate, parseISODate, shiftISODate, toISODate } from '@/lib/format';
import { ScreenRefreshProvider, useScreenRefreshRegistry } from '@/lib/screenRefresh';

// ── Layout ─────────────────────────────────────────────────

/** Scrolls the screen so a view inside it sits near the top (e.g. a section a "Fix" button opens). */
type ScrollToView = (view: View | null) => void;
const ScreenScrollContext = createContext<ScrollToView>(() => undefined);
export const useScrollToView = () => useContext(ScreenScrollContext);

export function Screen({
    children,
    onRefresh,
    refreshing,
    footer,
    header,
}: {
    children: React.ReactNode;
    onRefresh?: () => void;
    refreshing?: boolean;
    /** Pinned below the scroll area (e.g. a save bar). */
    footer?: React.ReactNode;
    /** Pinned above the scroll area; content scrolls under it (e.g. the home's profile bar). */
    header?: React.ReactNode;
}) {
    const { colors } = useTheme();
    const styles = useStyles();
    // Without its own handler, pulling down reloads every query rendered on the screen.
    const registry = useScreenRefreshRegistry();
    const [pulling, setPulling] = useState(false);
    const refreshAll = () => {
        setPulling(true);
        void registry.reloadAll().finally(() => setPulling(false));
    };
    const handleRefresh = onRefresh ?? refreshAll;
    const scrollRef = useRef<React.ElementRef<typeof KeyboardAwareScrollView>>(null);
    const contentRef = useRef<View>(null);
    const scrollToView = useCallback<ScrollToView>((view) => {
        const content = contentRef.current;
        if (!view || !content) return;
        view.measureLayout(content, (_x, y) => scrollRef.current?.scrollTo({ y: Math.max(0, y - spacing.md), animated: true }), () => undefined);
    }, []);
    const isRefreshing = onRefresh ? !!refreshing : pulling;
    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            {header ? <View style={styles.pinned}><View style={styles.pinnedInner}>{header}</View></View> : null}
            {/* Android 15 draws edge to edge, so the window no longer resizes for the keyboard:
                scroll the focused field into view, and lift a pinned save bar above the keyboard. */}
            <KeyboardAvoidingView behavior="padding" enabled={!!footer} style={styles.fill}>
                <KeyboardAwareScrollView
                    ref={scrollRef}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    bottomOffset={spacing.xl}
                    refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
                >
                    <ScreenRefreshProvider registry={registry}>
                        <ScreenScrollContext.Provider value={scrollToView}>
                            <View ref={contentRef} style={styles.content}>{children}</View>
                        </ScreenScrollContext.Provider>
                    </ScreenRefreshProvider>
                </KeyboardAwareScrollView>
                {footer ? <View style={styles.footer}>{footer}</View> : null}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

/**
 * Every screen's title block, as the web's PageHeader: the menu icon on a
 * gradient tile in the section's colour, the section name above the title.
 * Taken from the route, so screens need not pass them.
 */
export function ScreenHeader({ title, description, action, icon, hue, eyebrow }: {
    title: string;
    description?: string;
    action?: React.ReactNode;
    icon?: LucideIcon;
    hue?: Hue;
    eyebrow?: string;
}) {
    const { tones } = useTheme();
    const styles = useStyles();
    const pathname = usePathname();
    const identity = pageIdentity(pathname);
    const Icon = icon ?? screenIconFor(pathname);
    const tone = tones[hue ?? identity?.hue ?? 'blue'];
    const label = eyebrow ?? identity?.eyebrow;
    return (
        <View style={styles.header}>
            {Icon ? (
                <LinearGradient colors={tone.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerIcon}>
                    <Icon size={22} color="#ffffff" strokeWidth={2.2} />
                </LinearGradient>
            ) : null}
            <View style={{ flex: 1, minWidth: 0 }}>
                {label ? <Text style={[styles.headerEyebrow, { color: tone.fg }]}>{label.toUpperCase()}</Text> : null}
                <Text style={styles.headerTitle} accessibilityRole="header">{title}</Text>
                {description ? <Text style={styles.headerDesc}>{description}</Text> : null}
            </View>
            {action}
        </View>
    );
}

export function BackLink({ label = 'Back' }: { label?: string }) {
    const { colors } = useTheme();
    const styles = useStyles();
    const router = useRouter();
    return (
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={8} style={styles.backLink} accessibilityRole="link">
            <ArrowLeft size={16} color={colors.primary} />
            <Text style={styles.link}>{label}</Text>
        </Pressable>
    );
}

export function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
    const styles = useStyles();
    return (
        <View style={styles.sectionRow}>
            <Text style={styles.sectionLabel}>{children}</Text>
            {action}
        </View>
    );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
    const styles = useStyles();
    return <View style={[styles.card, style]}>{children}</View>;
}

/** The web's tinted icon square (`bg-primary/15 text-primary`) used on stat cards and menus. */
export function IconTile({ icon: Icon, color, background, hue, size = 40 }: { icon: LucideIcon; color?: string; background?: string; hue?: Hue; size?: number }) {
    const { colors, tones } = useTheme();
    const styles = useStyles();
    const tone = hue ? tones[hue] : null;
    return (
        <View style={[styles.iconTile, { width: size, height: size, backgroundColor: background ?? tone?.bg ?? colors.primarySoft }]}>
            <Icon size={size / 2} color={color ?? tone?.fg ?? colors.primary} strokeWidth={2} />
        </View>
    );
}

/** A card whose rows run edge to edge, separated by hairlines. */
export function ListCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
    const styles = useStyles();
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
    const { colors } = useTheme();
    const styles = useStyles();
    const body = (
        <>
            {left}
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.rowTitle, danger && { color: colors.danger }]} numberOfLines={2}>{title}</Text>
                {subtitle ? <Text style={styles.rowSub} numberOfLines={3}>{subtitle}</Text> : null}
                {meta ? <Text style={styles.rowMeta}>{meta}</Text> : null}
            </View>
            {right}
            {onPress && !right ? <ChevronRight size={18} color={colors.muted} /> : null}
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
    const styles = useStyles();
    return (
        <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={styles.infoValue} numberOfLines={2}>{value === null || value === undefined || value === '' ? '—' : value}</Text>
        </View>
    );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
    const styles = useStyles();
    return <View style={styles.statGrid}>{children}</View>;
}

export function StatTile({ label, value, sub, tone, icon, onPress }: { label: string; value: string | number; sub?: string; tone?: string; icon?: LucideIcon; onPress?: () => void }) {
    const styles = useStyles();
    const content = (
        <>
            {icon ? <IconTile icon={icon} /> : null}
            <View style={styles.statBody}>
                <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
                <CountUp value={value} style={[styles.statValue, tone ? { color: tone } : null]} />
                {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
            </View>
        </>
    );
    return onPress ? (
        <Pressable onPress={onPress} style={({ pressed }) => [styles.card, styles.statTile, pressed && { opacity: 0.8 }]}>{content}</Pressable>
    ) : (
        <View style={[styles.card, styles.statTile]}>{content}</View>
    );
}

// ── Feedback ───────────────────────────────────────────────

export type BadgeVariant = 'success' | 'danger' | 'warning' | 'info' | 'default';

/** Soft fill and strong text for each status, in the current theme. */
export function badgeColors(colors: Palette, variant: BadgeVariant): { bg: string; fg: string } {
    switch (variant) {
        case 'success': return { bg: colors.successBg, fg: colors.success };
        case 'danger': return { bg: colors.dangerBg, fg: colors.danger };
        case 'warning': return { bg: colors.warningBg, fg: colors.warning };
        case 'info': return { bg: colors.infoBg, fg: colors.info };
        default: return { bg: colors.mutedBg, fg: colors.muted };
    }
}

export function Badge({ label, variant = 'default' }: { label: string; variant?: BadgeVariant }) {
    const { colors } = useTheme();
    const styles = useStyles();
    const c = badgeColors(colors, variant);
    return (
        <View style={[styles.badge, { backgroundColor: c.bg }]}>
            <Text style={[styles.badgeText, { color: c.fg }]}>{label}</Text>
        </View>
    );
}

/** A friendly "nothing here yet": an icon, what is missing, and what to do next. */
export function EmptyState({ title, description, action, icon: Icon = Inbox }: { title: string; description?: string; action?: React.ReactNode; icon?: LucideIcon }) {
    const { colors } = useTheme();
    const styles = useStyles();
    return (
        <View style={styles.empty}>
            <View style={styles.emptyIcon}><Icon size={22} color={colors.muted} /></View>
            <Text style={styles.emptyTitle}>{title}</Text>
            {description ? <Text style={styles.emptyDesc}>{description}</Text> : null}
            {action ? <View style={{ marginTop: spacing.md }}>{action}</View> : null}
        </View>
    );
}

/** Content still loading: the app's bead loader, not a spinner. */
export function LoadingView({ message }: { message?: string }) {
    return <InlineLoader message={message} />;
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
    const { colors } = useTheme();
    const styles = useStyles();
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
    const { colors } = useTheme();
    const styles = useStyles();
    const c = badgeColors(colors, tone);
    return (
        <View style={[styles.banner, { backgroundColor: c.bg, borderColor: c.fg }]}>
            <Text style={[styles.bannerText, { color: c.fg }]}>{message}</Text>
            {onDismiss ? (
                <Pressable onPress={onDismiss} hitSlop={8} accessibilityRole="button" accessibilityLabel="Dismiss">
                    <X size={16} color={c.fg} />
                </Pressable>
            ) : null}
        </View>
    );
}

export function ProgressBar({ value, color: colorProp }: { value: number; color?: string }) {
    const { colors } = useTheme();
    const styles = useStyles();
    const color = colorProp ?? colors.primary;
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
    const { colors } = useTheme();
    const styles = useStyles();
    const buttonVariantStyles = useButtonVariantStyles();
    const buttonTextStyles = useButtonTextStyles();
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
                block && { alignSelf: 'stretch', marginTop: spacing.sm },
                (pressed || isDisabled) && { opacity: isDisabled ? 0.5 : 0.85 },
            ]}
        >
            {loading ? <ActivityIndicator size="small" color={variant === 'primary' || variant === 'danger' ? colors.white : colors.primary} /> : null}
            <Text style={[styles.buttonText, size === 'sm' && { fontSize: 12 }, buttonTextStyles[variant]]}>{label}</Text>
        </Pressable>
    );
}

export function ButtonRow({ children }: { children: React.ReactNode }) {
    const styles = useStyles();
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
    const { colors } = useTheme();
    const styles = useStyles();
    return (
        <View style={styles.field}>
            {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
            <TextInput
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={colors.placeholder}
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
    const { colors } = useTheme();
    const styles = useStyles();
    return (
        <View style={styles.searchBox}>
            <Search size={17} color={colors.muted} />
            <TextInput
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={colors.placeholder}
                autoCorrect={false}
                style={styles.searchInput}
                accessibilityLabel={placeholder}
            />
            {value ? (
                <Pressable onPress={() => onChangeText('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
                    <X size={16} color={colors.muted} />
                </Pressable>
            ) : null}
        </View>
    );
}

export function ToggleRow({ label, description, value, onValueChange }: { label: string; description?: string; value: boolean; onValueChange: (v: boolean) => void }) {
    const { colors } = useTheme();
    const styles = useStyles();
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

export type ChipOption<T extends string> = ChoiceOption<T>;

/**
 * Pick one of a set. The shape follows the choices: two or three short ones
 * sit side by side on a track, a handful in a form become tick tiles, and
 * longer lists (classes, subjects, terms) are a field that opens a sheet.
 */
export function ChipSelect<T extends string>({
    options,
    value,
    onChange,
    label,
    wrap,
    layout,
    placeholder,
}: {
    options: readonly ChipOption<T>[];
    value: T | null;
    onChange: (value: T) => void;
    label?: string;
    /** In a form: prefer tiles to a sheet for a handful of choices. */
    wrap?: boolean;
    layout?: ChoiceLayout;
    placeholder?: string;
}) {
    const styles = useStyles();
    const inGrid = useInFilterGrid();
    const shape = layout ?? (inGrid ? 'picker' : layoutFor(options, wrap));
    if (shape === 'picker') return <PickerField label={label} options={options} value={value} onChange={onChange} placeholder={placeholder} />;
    return (
        <View style={styles.field}>
            {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
            {shape === 'segmented'
                ? <SegmentedChoice options={options} value={value} onChange={onChange} />
                : <OptionTiles options={options} value={value} onChange={onChange} />}
        </View>
    );
}

/** Tabs within a screen (e.g. Marks / Results / Publish). */
export function SegmentedTabs<T extends string>({ tabs, value, onChange }: { tabs: readonly ChipOption<T>[]; value: T; onChange: (v: T) => void }) {
    const styles = useStyles();
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

/** Many sections: text tabs on a sideways-scrolling bar, the chosen one underlined. */
export function ScrollTabs<T extends string>({ tabs, value, onChange }: { tabs: readonly ChipOption<T>[]; value: T; onChange: (v: T) => void }) {
    const styles = useStyles();
    return (
        <View style={styles.scrollTabs}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.lg, paddingRight: spacing.lg }}>
                {tabs.map((t) => {
                    const active = t.value === value;
                    return (
                        <Pressable key={t.value} onPress={() => onChange(t.value)} accessibilityRole="tab" accessibilityState={{ selected: active }} style={styles.scrollTab}>
                            <Text style={[styles.scrollTabText, active && styles.scrollTabTextActive]} numberOfLines={1}>{t.label}</Text>
                            <View style={[styles.scrollTabBar, active && styles.scrollTabBarActive]} />
                        </Pressable>
                    );
                })}
            </ScrollView>
        </View>
    );
}

/** A previous/next date stepper over YYYY-MM-DD strings; no native picker dependency needed. */
export function DateStepper({ value, onChange, max }: { value: string; onChange: (iso: string) => void; max?: string }) {
    const { colors } = useTheme();
    const styles = useStyles();
    const atMax = !!max && value >= max;
    return (
        <View style={styles.dateRow}>
            <Pressable onPress={() => onChange(shiftISODate(value, -1))} hitSlop={8} style={styles.dateArrow} accessibilityLabel="Previous day">
                <ChevronLeft size={22} color={colors.primary} />
            </Pressable>
            <Pressable onPress={() => onChange(toISODate())} accessibilityHint="Jump to today">
                <Text style={styles.dateText}>{formatDate(parseISODate(value), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</Text>
            </Pressable>
            <Pressable onPress={() => !atMax && onChange(shiftISODate(value, 1))} disabled={atMax} hitSlop={8} style={[styles.dateArrow, atMax && { opacity: 0.3 }]} accessibilityLabel="Next day">
                <ChevronRight size={22} color={colors.primary} />
            </Pressable>
        </View>
    );
}

/** Initials on a coloured disc, or the person's photo when they have one. */
export function Avatar({ label, size = 56, color: colorProp, uri }: { label: string; size?: number; color?: string; uri?: string | null }) {
    const { colors } = useTheme();
    const color = colorProp ?? colors.primary;
    const styles = useStyles();
    const frame = { width: size, height: size, borderRadius: size / 2 };
    if (uri) return <Image source={{ uri }} style={[frame, { backgroundColor: colors.mutedBg }]} accessibilityLabel={label} />;
    return (
        <View style={[styles.avatar, frame, { backgroundColor: color }]}>
            <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{label}</Text>
        </View>
    );
}

/** Month/day block used for exams and due dates. */
export function DateBadge({ date, highlight }: { date: string; highlight?: boolean }) {
    const { colors } = useTheme();
    const styles = useStyles();
    const d = new Date(date);
    return (
        <View style={[styles.dateBadge, highlight && { borderColor: colors.warning, backgroundColor: colors.warningBg }]}>
            <Text style={[styles.dateBadgeMonth, highlight && { color: colors.warning }]}>{d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()}</Text>
            <Text style={styles.dateBadgeDay}>{d.toLocaleDateString('en-GB', { day: '2-digit' })}</Text>
        </View>
    );
}

const useButtonVariantStyles = makeStyles((colors) => ({
    primary: { backgroundColor: colors.primarySolid, borderColor: colors.primarySolid },
    secondary: { backgroundColor: colors.mutedBg, borderColor: colors.border },
    danger: { backgroundColor: colors.dangerSolid, borderColor: colors.dangerSolid },
    ghost: { backgroundColor: 'transparent', borderColor: 'transparent' },
}));

const useButtonTextStyles = makeStyles((colors) => ({
    primary: { color: colors.white },
    secondary: { color: colors.foreground },
    danger: { color: colors.white },
    ghost: { color: colors.primary },
}));

const useStyles = makeStyles((colors) => ({
    safe: { flex: 1, backgroundColor: colors.background },
    fill: { flex: 1 },
    scrollContent: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
    // Cap line length on tablets so screens stay readable at every width.
    content: { width: '100%', maxWidth: 760, alignSelf: 'center' },
    pinned: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, backgroundColor: colors.background, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, zIndex: 2 },
    pinnedInner: { width: '100%', maxWidth: 760, alignSelf: 'center' },
    footer: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
    headerIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
    headerEyebrow: { fontSize: 11, fontFamily: fonts.bold, letterSpacing: 1.2, marginBottom: 1 },
    headerTitle: { fontSize: 24, lineHeight: 30, fontFamily: fonts.display, color: colors.foreground, letterSpacing: -0.5 },
    headerDesc: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 4 },
    backLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.md, alignSelf: 'flex-start' },
    link: { color: colors.primary, fontFamily: fonts.bold, fontSize: 14 },
    sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.sm },
    sectionLabel: { fontSize: 11, fontFamily: fonts.bold, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
    card: { backgroundColor: colors.card, borderRadius: radius.xxl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, ...shadowFor(colors) },
    iconTile: { borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
    listCard: { padding: 0, overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    rowTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.foreground },
    rowSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
    rowMeta: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, marginTop: 4 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    infoLabel: { fontSize: 13, color: colors.muted, fontFamily: fonts.semibold },
    infoValue: { fontSize: 13, color: colors.foreground, fontFamily: fonts.bold, flexShrink: 1, textAlign: 'right' },
    statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    statTile: { flexBasis: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
    statBody: { flex: 1, minWidth: 0, gap: 2 },
    statLabel: { fontSize: 12, color: colors.muted, fontFamily: fonts.semibold },
    statValue: { fontSize: 20, fontFamily: fonts.bold, color: colors.foreground, letterSpacing: -0.3 },
    statSub: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
    badge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm, alignSelf: 'flex-start' },
    badgeText: { fontSize: 11, fontFamily: fonts.bold },
    empty: { alignItems: 'center', paddingVertical: spacing.xl * 1.5, paddingHorizontal: spacing.lg },
    emptyIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.mutedBg, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
    emptyTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.foreground, textAlign: 'center' },
    emptyDesc: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 4, textAlign: 'center' },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl * 2 },
    banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.md },
    bannerText: { fontFamily: fonts.regular, fontSize: 13, flex: 1, marginRight: spacing.sm },
    bannerAction: { fontSize: 13, fontFamily: fonts.bold, textDecorationLine: 'underline' },
    progressTrack: { height: 10, borderRadius: 999, overflow: 'hidden', width: '100%' },
    progressFill: { height: '100%', borderRadius: 999 },
    button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.xl, paddingVertical: 11, paddingHorizontal: spacing.lg, minHeight: 44 },
    buttonSm: { paddingVertical: 7, paddingHorizontal: spacing.md, minHeight: 36 },
    buttonText: { fontFamily: fonts.medium, fontSize: 14 },
    buttonRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.xs },
    field: { marginBottom: spacing.md },
    fieldLabel: { fontSize: 12, fontFamily: fonts.bold, color: colors.muted, marginBottom: 6 },
    fieldError: { fontFamily: fonts.regular, fontSize: 12, color: colors.danger, marginTop: 4 },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, paddingHorizontal: spacing.md, paddingVertical: 9, fontFamily: fonts.regular, fontSize: 14, color: colors.foreground, backgroundColor: colors.card, minHeight: 40 },
    textArea: { minHeight: 96, textAlignVertical: 'top' },
    searchBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 46, paddingHorizontal: spacing.md, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, marginBottom: spacing.md },
    searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.foreground, paddingVertical: 8 },
    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
    segmented: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: radius.xl, backgroundColor: colors.mutedBg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
    segment: { flex: 1, minHeight: 38, paddingHorizontal: 4, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
    segmentActive: { backgroundColor: colors.card, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
    segmentText: { fontSize: 13, fontFamily: fonts.semibold, color: colors.muted },
    segmentTextActive: { color: colors.foreground, fontFamily: fonts.bold },
    scrollTabs: { borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: spacing.lg },
    scrollTab: { paddingTop: spacing.sm },
    scrollTabText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.muted, paddingBottom: spacing.sm },
    scrollTabTextActive: { color: colors.primary, fontFamily: fonts.bold },
    scrollTabBar: { height: 3, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: 'transparent' },
    scrollTabBarActive: { backgroundColor: colors.primary },
    dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg, marginBottom: spacing.md },
    dateArrow: { padding: spacing.sm },
    dateText: { fontSize: 14, fontFamily: fonts.bold, color: colors.foreground, minWidth: 160, textAlign: 'center' },
    avatar: { alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: colors.white, fontFamily: fonts.bold },
    dateBadge: { width: 44, height: 44, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    dateBadgeMonth: { fontSize: 9, fontFamily: fonts.bold, color: colors.muted },
    dateBadgeDay: { fontSize: 15, fontFamily: fonts.bold, color: colors.foreground },
}));
