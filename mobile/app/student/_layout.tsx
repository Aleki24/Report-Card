import { Tabs } from 'expo-router/js-tabs';
import { Text, type ColorValue } from 'react-native';
import { colors } from '@/lib/theme';
import { useApiQuery } from '@/lib/useApiQuery';
import { STUDENT_PRIMARY, STUDENT_SCREENS, type StudentScreen } from '@/lib/roles';

function TabIcon({ emoji, color }: { emoji: string; color: ColorValue }) {
    return <Text style={{ fontSize: 20, color }}>{emoji}</Text>;
}

export default function StudentTabsLayout() {
    // Same unread count the web sidebar badges on the student dashboard.
    const notifications = useApiQuery<{ count: number }>('/api/school/student/notifications');
    const unread = notifications.data?.count ?? 0;
    const primary = new Set<StudentScreen>(STUDENT_PRIMARY);

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.muted,
                headerStyle: { backgroundColor: colors.card },
                headerTitleStyle: { color: colors.foreground, fontWeight: '700' },
                headerShadowVisible: false,
            }}
        >
            {(Object.keys(STUDENT_SCREENS) as StudentScreen[]).map((name) => {
                const meta = STUDENT_SCREENS[name];
                return (
                    <Tabs.Screen
                        key={name}
                        name={name}
                        options={{
                            title: meta.title,
                            tabBarLabel: meta.tabLabel,
                            href: primary.has(name) ? undefined : null,
                            tabBarBadge: name === 'index' && unread > 0 ? unread : undefined,
                            tabBarIcon: ({ color }) => <TabIcon emoji={meta.icon} color={color} />,
                        }}
                    />
                );
            })}
            <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color }) => <TabIcon emoji="☰" color={color} /> }} />
            <Tabs.Screen name="subjects/[subjectId]" options={{ href: null, title: 'Subject' }} />
        </Tabs>
    );
}
