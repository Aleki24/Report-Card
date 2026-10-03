import React from 'react';
import type { ColorValue } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { LifeBuoy, type LucideIcon } from 'lucide-react-native';
import { colors, fonts } from '@/lib/theme';
import { IconTile, ListCard, ListRow, Screen, ScreenHeader } from './ui';

/** A tab bar icon: the web menu's Lucide icon in the tab's tint. */
export function TabIcon({ icon: Icon, color }: { icon: LucideIcon; color: ColorValue }) {
    return <Icon size={22} color={color as string} strokeWidth={2} />;
}

/**
 * Shared by the staff, student and parent tab trees. `shift` animates tab
 * changes, `freezeOnBlur` stops hidden tabs re-rendering behind the visible
 * one, and a scene background avoids a white flash between screens.
 */
export const TAB_SCREEN_OPTIONS = {
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
};

export interface MoreItem {
    key: string;
    title: string;
    description: string;
    icon: LucideIcon;
    href: string;
}

/** Everything the viewer can open that isn't on the tab bar — the web's "More" sheet. */
export function MoreList({ items, description }: { items: readonly MoreItem[]; description?: string }) {
    const router = useRouter();
    return (
        <Screen>
            <ScreenHeader title="More" description={description} />
            <ListCard>
                {items.map((item) => (
                    <ListRow
                        key={item.key}
                        title={item.title}
                        subtitle={item.description}
                        left={<IconTile icon={item.icon} />}
                        onPress={() => router.push(item.href as Href)}
                    />
                ))}
            </ListCard>
            <ListCard style={{ marginTop: 16 }}>
                <ListRow
                    title="Help & guides"
                    subtitle="Step-by-step guides for your role, and how to reach support"
                    left={<IconTile icon={LifeBuoy} />}
                    onPress={() => router.push('/help')}
                />
            </ListCard>
        </Screen>
    );
}
