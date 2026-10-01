import { Tabs } from 'expo-router/js-tabs';
import { TAB_SCREEN_OPTIONS, TabIcon } from '@/components/nav';

/** A parent's app: their children and their account — the web's /parent portal. */
export default function ParentTabsLayout() {
    return (
        <Tabs screenOptions={TAB_SCREEN_OPTIONS}>
            <Tabs.Screen name="index" options={{ title: 'My children', tabBarLabel: 'Children', tabBarIcon: ({ color }) => <TabIcon emoji="👨‍👩‍👧" color={color} /> }} />
            <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarLabel: 'Profile', tabBarIcon: ({ color }) => <TabIcon emoji="👤" color={color} /> }} />
        </Tabs>
    );
}
