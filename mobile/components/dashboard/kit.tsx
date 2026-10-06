import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring, withTiming, Easing } from 'react-native-reanimated';
import { ArrowRight, ChevronRight, type LucideIcon } from 'lucide-react-native';
import { fonts, makeStyles, radius, spacing, useTheme, shadowFor, type Hue } from '@/lib/theme';

/**
 * The web's routes (`/dashboard/exams-marks?tab=publish`) as the app's
 * (`/staff/exams?tab=publish`), so links built from shared data open the
 * same place on both.
 */
const WEB_TO_APP: Readonly<Record<string, string>> = { 'exams-marks': 'exams' };
export function appHref(webHref: string): Href {
    const [path, query] = webHref.split('?');
    const mapped = path.replace(/^\/dashboard(?=\/|$)/, '/staff').replace(/^\/staff\/([^/]+)/, (m, seg: string) => `/staff/${WEB_TO_APP[seg] ?? seg}`);
    return (query ? `${mapped}?${query}` : mapped) as Href;
}

/** Sections glide up into place one after another as the screen opens. */
export function Reveal({ index = 0, children, style }: { index?: number; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
    return (
        <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 60).duration(420).easing(Easing.out(Easing.cubic))} style={style}>
            {children}
        </Animated.View>
    );
}

/** A pressable that sinks slightly under the finger, with a light tick. */
export function PressScale({
    onPress, children, style, haptic = true, accessibilityLabel, accessibilityRole = 'button',
}: {
    onPress: () => void;
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    haptic?: boolean;
    accessibilityLabel?: string;
    accessibilityRole?: 'button' | 'link';
}) {
    const scale = useSharedValue(1);
    const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
    return (
        <Pressable
            onPress={() => {
                if (haptic) void Haptics.selectionAsync().catch(() => undefined);
                onPress();
            }}
            onPressIn={() => { scale.value = withSpring(0.96, { damping: 18, stiffness: 320 }); }}
            onPressOut={() => { scale.value = withSpring(1, { damping: 14, stiffness: 260 }); }}
            accessibilityRole={accessibilityRole}
            accessibilityLabel={accessibilityLabel}
        >
            <Animated.View style={[style, animated]}>{children}</Animated.View>
        </Pressable>
    );
}

/** Counts up to a figure when it first appears; text such as "64%" keeps its suffix. */
export function CountUp({ value, style, fit }: { value: number | string; style?: StyleProp<import('react-native').TextStyle>; /** Shrink to one line in a narrow tile. */ fit?: boolean }) {
    const text = String(value);
    const match = /^(-?[\d,]+(?:\.\d+)?)(.*)$/.exec(text);
    const target = match ? Number(match[1].replace(/,/g, '')) : NaN;
    const [shown, setShown] = useState(Number.isFinite(target) ? 0 : target);
    const started = useRef(false);
    useEffect(() => {
        if (!Number.isFinite(target)) return;
        if (started.current) { setShown(target); return; }
        started.current = true;
        const t0 = Date.now();
        const duration = 650;
        let frame = 0;
        const tick = () => {
            const p = Math.min(1, (Date.now() - t0) / duration);
            setShown(target * (1 - Math.pow(1 - p, 3)));
            if (p < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [target]);
    const fitProps = fit ? { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.6 } : {};
    if (!match || !Number.isFinite(target)) return <Text style={style} {...fitProps}>{text}</Text>;
    const decimals = match[1].includes('.') ? match[1].split('.')[1].length : 0;
    const body = shown.toLocaleString('en-KE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return <Text style={style} {...fitProps}>{body}{match[2]}</Text>;
}

/** A bar that fills to its value when shown. */
export function Meter({ value, color, track, height = 8 }: { value: number; color: string; track?: string; height?: number }) {
    const width = useSharedValue(0);
    useEffect(() => { width.value = withTiming(Math.max(0, Math.min(100, value)), { duration: 700, easing: Easing.out(Easing.cubic) }); }, [value, width]);
    const fill = useAnimatedStyle(() => ({ width: `${width.value}%` }));
    return (
        <View style={{ height, borderRadius: height, backgroundColor: track ?? `${color}26`, overflow: 'hidden' }}>
            <Animated.View style={[{ height: '100%', borderRadius: height, backgroundColor: color }, fill]} />
        </View>
    );
}

export function SectionTitle({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
    const { colors } = useTheme();
    const styles = useStyles();
    return (
        <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
            {action ? (
                <Pressable onPress={action.onPress} hitSlop={10} style={styles.sectionAction} accessibilityRole="link">
                    <Text style={styles.sectionActionText}>{action.label}</Text>
                    <ChevronRight size={14} color={colors.primary} />
                </Pressable>
            ) : null}
        </View>
    );
}

/** A figure with its icon in the colour of the section it opens. */
export function KpiTile({ title, value, icon: Icon, hue, tone, href }: {
    title: string;
    value: number | string;
    icon: LucideIcon;
    hue: Hue;
    /** Colours the figure itself when it says something good or bad. */
    tone?: 'good' | 'warn' | 'bad';
    href?: Href;
}) {
    const { colors, tones } = useTheme();
    const styles = useStyles();
    const router = useRouter();
    const t = tones[hue];
    const figure = tone === 'good' ? colors.success : tone === 'warn' ? colors.warning : tone === 'bad' ? colors.danger : colors.foreground;
    const body = (
        <>
            <View style={[styles.kpiIcon, { backgroundColor: t.bg }]}><Icon size={15} color={t.fg} strokeWidth={2.2} /></View>
            <CountUp fit value={value} style={[styles.kpiValue, { color: figure }]} />
            <Text style={styles.kpiTitle} numberOfLines={2}>{title}</Text>
        </>
    );
    return (
        <View style={styles.kpiCell}>
            {href ? (
                <PressScale onPress={() => router.push(href)} style={styles.kpi} accessibilityRole="link" accessibilityLabel={`${title}: ${value}`}>{body}</PressScale>
            ) : (
                <View style={styles.kpi}>{body}</View>
            )}
        </View>
    );
}

export function KpiGrid({ children }: { children: React.ReactNode }) {
    const styles = useStyles();
    return <View style={styles.kpiGrid}>{children}</View>;
}

export interface QuickAction { label: string; icon: LucideIcon; hue: Hue; href: Href }

/** Every common task at the same weight: four to a row, each in its section's colour. */
export function QuickActionGrid({ actions }: { actions: readonly QuickAction[] }) {
    const { tones } = useTheme();
    const styles = useStyles();
    const router = useRouter();
    return (
        <View style={styles.qaGrid}>
            {actions.map(({ label, icon: Icon, hue, href }) => (
                <View key={label} style={styles.qaCell}>
                    <PressScale onPress={() => router.push(href)} style={styles.qa} accessibilityRole="link" accessibilityLabel={label}>
                        <View style={[styles.qaIcon, { backgroundColor: tones[hue].bg }]}><Icon size={20} color={tones[hue].fg} strokeWidth={2.2} /></View>
                        <Text style={styles.qaLabel} numberOfLines={2}>{label}</Text>
                    </PressScale>
                </View>
            ))}
        </View>
    );
}

/** A titled panel with an optional link out, the web's InsightCard. */
export function InsightCard({ title, meta, action, children }: { title: string; meta?: string; action?: { label: string; href: Href }; children: React.ReactNode }) {
    const { colors } = useTheme();
    const styles = useStyles();
    const router = useRouter();
    return (
        <View style={styles.insight}>
            <View style={styles.insightHead}>
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.insightTitle}>{title}</Text>
                    {meta ? <Text style={styles.insightMeta}>{meta}</Text> : null}
                </View>
                {action ? (
                    <Pressable onPress={() => router.push(action.href)} hitSlop={10} style={styles.sectionAction} accessibilityRole="link">
                        <Text style={styles.sectionActionText}>{action.label}</Text>
                        <ArrowRight size={14} color={colors.primary} />
                    </Pressable>
                ) : null}
            </View>
            {children}
        </View>
    );
}

/** One line of a link list: tinted icon, label and description, arrow. */
export function LinkRow({ label, desc, icon: Icon, hue, href, last }: { label: string; desc: string; icon: LucideIcon; hue: Hue; href: Href; last?: boolean }) {
    const { colors, tones } = useTheme();
    const styles = useStyles();
    const router = useRouter();
    return (
        <Pressable onPress={() => router.push(href)} style={({ pressed }) => [styles.linkRow, !last && styles.linkRowBorder, pressed && { backgroundColor: colors.elevated }]} accessibilityRole="link">
            <View style={[styles.linkIcon, { backgroundColor: tones[hue].bg }]}><Icon size={16} color={tones[hue].fg} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.linkLabel} numberOfLines={1}>{label}</Text>
                <Text style={styles.linkDesc} numberOfLines={1}>{desc}</Text>
            </View>
            <ArrowRight size={14} color={colors.muted} />
        </Pressable>
    );
}

/** A small legend dot with a count and a label. */
export function LegendItem({ color, count, label }: { color: string; count: number | string; label: string }) {
    const styles = useStyles();
    return (
        <View style={styles.legend}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text style={styles.legendCount}>{count}</Text>
            <Text style={styles.legendLabel}>{label}</Text>
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xl, marginBottom: spacing.md },
    sectionTitle: { fontSize: 17, fontFamily: fonts.display, color: colors.foreground, letterSpacing: -0.3 },
    sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    sectionActionText: { fontSize: 13, fontFamily: fonts.semibold, color: colors.primary },
    kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
    kpiCell: { width: '33.333%', padding: 4 },
    kpi: { backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.sm + 2, minHeight: 96, ...shadowFor(colors) },
    kpiIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
    kpiValue: { fontSize: 20, fontFamily: fonts.display, letterSpacing: -0.5 },
    kpiTitle: { fontSize: 11, lineHeight: 14, fontFamily: fonts.medium, color: colors.muted, marginTop: 1 },
    qaGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
    qaCell: { width: '25%', padding: 4 },
    qa: { alignItems: 'center', gap: 7, paddingVertical: spacing.md, paddingHorizontal: 2, borderRadius: radius.xxl, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, minHeight: 96 },
    qaIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    qaLabel: { fontSize: 11, lineHeight: 14, fontFamily: fonts.semibold, color: colors.foreground, textAlign: 'center' },
    insight: { backgroundColor: colors.card, borderRadius: radius.xxl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md, ...shadowFor(colors) },
    insightHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.md },
    insightTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.foreground },
    insightMeta: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted, marginTop: 1 },
    linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 11, paddingHorizontal: spacing.md },
    linkRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
    linkIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    linkLabel: { fontSize: 14, fontFamily: fonts.semibold, color: colors.foreground },
    linkDesc: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted, marginTop: 1 },
    legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 9, height: 9, borderRadius: 5 },
    legendCount: { fontSize: 12, fontFamily: fonts.bold, color: colors.foreground },
    legendLabel: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted },
}));
