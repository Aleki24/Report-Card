import { Tabs } from 'expo-router/js-tabs';
import { Text, type ColorValue } from 'react-native';
import { colors } from '@/lib/theme';
import { useCurrentUser } from '@/lib/UserContext';

function TabIcon({ emoji, color }: { emoji: string; color: ColorValue }) {
    return <Text style={{ fontSize: 20, color }}>{emoji}</Text>;
}

export default function StaffTabsLayout() {
    const { role } = useCurrentUser();
    const isAdmin = role === 'ADMIN';

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
            <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: ({ color }) => <TabIcon emoji="🏠" color={color} /> }} />
            <Tabs.Screen name="people/index" options={{ title: 'People', tabBarIcon: ({ color }) => <TabIcon emoji="🧑‍🎓" color={color} /> }} />
            <Tabs.Screen name="attendance" options={{ title: 'Attendance', tabBarIcon: ({ color }) => <TabIcon emoji="📅" color={color} /> }} />
            <Tabs.Screen name="announcements" options={{ title: 'News', tabBarIcon: ({ color }) => <TabIcon emoji="📣" color={color} /> }} />
            <Tabs.Screen name="assignments" options={{ title: 'Assignments', tabBarIcon: ({ color }) => <TabIcon emoji="📝" color={color} /> }} />
            <Tabs.Screen name="fees" options={{ title: 'Fees', tabBarIcon: ({ color }) => <TabIcon emoji="💰" color={color} /> }} />
            <Tabs.Screen
                name="analytics"
                options={{ title: 'Analytics', href: isAdmin ? undefined : null, tabBarIcon: ({ color }) => <TabIcon emoji="📊" color={color} /> }}
            />
            <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <TabIcon emoji="👤" color={color} /> }} />
            <Tabs.Screen name="people/[id]" options={{ href: null, title: 'Person' }} />
        </Tabs>
    );
}
