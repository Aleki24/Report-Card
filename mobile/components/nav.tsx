import React, { useMemo, useState } from 'react';
import { Text, TextInput, View, useWindowDimensions, type ColorValue } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { LifeBuoy, LogOut, Search, type LucideIcon } from 'lucide-react-native';
import { fonts, makeStyles, radius, shadowFor, spacing, useTheme } from '@/lib/theme';
import { hueForHref, pageIdentity } from '@/lib/hues';
import { useSignOut } from '@/lib/useSignOut';
import { ProfileBar } from './dashboard/Hero';
import { PressScale } from './dashboard/kit';
import { Card, IconTile, ListCard, ListRow, Screen, ScreenHeader } from './ui';

/** A tab bar icon: the web menu's Lucide icon in the tab's tint. */
export function TabIcon({ icon: Icon, color }: { icon: LucideIcon; color: ColorValue }) {
    return <Icon size={22} color={color as string} strokeWidth={2} />;
}

/**
 * Shared by the staff, student and parent tab trees. `shift` animates tab
 * changes, `freezeOnBlur` stops hidden tabs re-rendering behind the visible
 * one, and a scene background avoids a white flash between screens.
 */
export function useTabScreenOptions() {
    const { colors } = useTheme();
    return useMemo(() => ({
    animation: 'shift' as const,
    // Each screen draws its own heading (ScreenHeader, the dashboard greeting, a detail's name),
    // so the bar title only repeated it and pushed content down.
    headerShown: false,
    freezeOnBlur: true,
    sceneStyle: { backgroundColor: colors.background },
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.muted,
    tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
    tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
    headerStyle: { backgroundColor: colors.card },
    headerTitleStyle: { color: colors.foreground, fontFamily: fonts.display, fontSize: 20 },
    headerShadowVisible: false,
    }), [colors]);
}

export interface MoreItem {
    key: string;
    title: string;
    description: string;
    icon: LucideIcon;
    href: string;
}

/** Sections in the web menu's order; anything unlisted follows. */
const SECTION_ORDER = ['Academics', 'Insights', 'School', 'My school', 'Finance', 'Welfare', 'Operations', 'Communication', 'Administration', 'Platform', 'Account'];

/**
 * Everything the viewer can open that isn't on the tab bar — the web's
 * "More" sheet, as a launcher: who you are, a search, then each section's
 * destinations as coloured tiles, and help and sign-out at the foot.
 */
export function MoreList({ items, description }: { items: readonly MoreItem[]; description?: string }) {
    const { tones, colors } = useTheme();
    const styles = useStyles();
    const router = useRouter();
    const { width } = useWindowDimensions();
    const { signOut, signingOut } = useSignOut();
    const [query, setQuery] = useState('');
    const columns = width >= 900 ? 6 : width >= 600 ? 4 : 3;

    const sections = useMemo(() => {
        const q = query.trim().toLowerCase();
        const shown = items.filter((i) => !q || `${i.title} ${i.description}`.toLowerCase().includes(q));
        const by = new Map<string, MoreItem[]>();
        for (const item of shown) {
            const name = pageIdentity(item.href)?.eyebrow ?? 'More';
            by.set(name, [...(by.get(name) ?? []), item]);
        }
        const rank = (n: string) => { const i = SECTION_ORDER.indexOf(n); return i === -1 ? SECTION_ORDER.length : i; };
        return [...by.entries()].sort(([a], [b]) => rank(a) - rank(b));
    }, [items, query]);

    return (
        <Screen>
            <ScreenHeader title="More" description={description} />
            <Card style={styles.profile}><ProfileBar /></Card>
            <View style={styles.search}>
                <Search size={16} color={colors.muted} />
                <TextInput value={query} onChangeText={setQuery} placeholder="Find a page…" placeholderTextColor={colors.placeholder} style={styles.searchInput} autoCorrect={false} accessibilityLabel="Find a page" />
            </View>
            {sections.length === 0 ? <Text style={styles.none}>No page matches “{query.trim()}”.</Text> : null}
            {sections.map(([name, list]) => (
                <View key={name} style={styles.section}>
                    <Text style={styles.sectionTitle}>{name.toUpperCase()}</Text>
                    <View style={styles.grid}>
                        {list.map((item) => {
                            const tone = tones[hueForHref(item.href)];
                            const Icon = item.icon;
                            return (
                                <View key={item.key} style={{ width: `${100 / columns}%`, padding: 5 }}>
                                    <PressScale onPress={() => router.push(item.href as Href)} style={styles.tile} accessibilityRole="link" accessibilityLabel={`${item.title}. ${item.description}`}>
                                        <View style={[styles.tileIcon, { backgroundColor: tone.bg }]}><Icon size={22} color={tone.fg} strokeWidth={2.1} /></View>
                                        <Text style={styles.tileTitle} numberOfLines={2}>{item.title}</Text>
                                    </PressScale>
                                </View>
                            );
                        })}
                    </View>
                </View>
            ))}
            <ListCard style={{ marginTop: spacing.lg }}>
                <ListRow
                    title="Help & guides"
                    subtitle="Step-by-step guides for your role, and how to reach support"
                    left={<IconTile icon={LifeBuoy} />}
                    onPress={() => router.push('/help')}
                />
                <ListRow
                    title={signingOut ? 'Signing out…' : 'Sign out'}
                    danger
                    left={<IconTile icon={LogOut} color={colors.danger} background={colors.dangerBg} />}
                    onPress={() => void signOut()}
                />
            </ListCard>
        </Screen>
    );
}

const useStyles = makeStyles((colors) => ({
    profile: { paddingBottom: 0, marginBottom: spacing.md },
    search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, minHeight: 46, borderRadius: radius.xl, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
    searchInput: { flex: 1, fontSize: 14, fontFamily: fonts.regular, color: colors.foreground, paddingVertical: 8 },
    none: { fontSize: 13, fontFamily: fonts.regular, color: colors.muted, textAlign: 'center', paddingVertical: spacing.lg },
    section: { marginTop: spacing.md },
    sectionTitle: { fontSize: 11, fontFamily: fonts.bold, color: colors.muted, letterSpacing: 1, marginBottom: 4, marginLeft: 2 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
    tile: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md, paddingHorizontal: 6, borderRadius: radius.xxl, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, minHeight: 104, ...shadowFor(colors) },
    tileIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    tileTitle: { fontSize: 12, lineHeight: 15, fontFamily: fonts.semibold, color: colors.foreground, textAlign: 'center' },
}));
