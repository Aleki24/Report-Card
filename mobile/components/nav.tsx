import React from 'react';
import { Text, type ColorValue } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { colors } from '@/lib/theme';
import { ListCard, ListRow, Screen, ScreenHeader } from './ui';

/** The emoji icon every tab bar uses. */
export function TabIcon({ emoji, color }: { emoji: string; color: ColorValue }) {
    return <Text style={{ fontSize: 20, color }}>{emoji}</Text>;
}

/** Shared by the staff, student and parent tab trees. */
export const TAB_SCREEN_OPTIONS = {
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.muted,
    headerStyle: { backgroundColor: colors.card },
    headerTitleStyle: { color: colors.foreground, fontWeight: '700' as const },
    headerShadowVisible: false,
};

export interface MoreItem {
    key: string;
    title: string;
    description: string;
    icon: string;
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
                        left={<Text style={{ fontSize: 22 }}>{item.icon}</Text>}
                        onPress={() => router.push(item.href as Href)}
                    />
                ))}
            </ListCard>
        </Screen>
    );
}
