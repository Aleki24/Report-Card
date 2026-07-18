import { Tabs } from 'expo-router/js-tabs';
import { Text, type ColorValue } from 'react-native';
import { colors } from '@/lib/theme';

function TabIcon({ emoji, color }: { emoji: string; color: ColorValue }) {
    return <Text style={{ fontSize: 20, color }}>{emoji}</Text>;
}

export default function TabsLayout() {
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
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Dashboard',
                    tabBarIcon: ({ color }) => <TabIcon emoji="🏠" color={color} />,
                }}
            />
            <Tabs.Screen
                name="results"
                options={{
                    title: 'Results',
                    tabBarIcon: ({ color }) => <TabIcon emoji="🎓" color={color} />,
                }}
            />
            <Tabs.Screen
                name="subjects/index"
                options={{
                    title: 'Subjects',
                    tabBarIcon: ({ color }) => <TabIcon emoji="📚" color={color} />,
                }}
            />
            <Tabs.Screen
                name="attendance"
                options={{
                    title: 'Attendance',
                    tabBarIcon: ({ color }) => <TabIcon emoji="📅" color={color} />,
                }}
            />
            <Tabs.Screen
                name="fees"
                options={{
                    title: 'Fees',
                    tabBarIcon: ({ color }) => <TabIcon emoji="💰" color={color} />,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ color }) => <TabIcon emoji="👤" color={color} />,
                }}
            />
            <Tabs.Screen name="subjects/[subjectId]" options={{ href: null, title: 'Subject' }} />
        </Tabs>
    );
}
