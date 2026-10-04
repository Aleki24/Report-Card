import { Tabs } from 'expo-router/js-tabs';
import { CircleUser, Users } from 'lucide-react-native';
import { TabIcon, useTabScreenOptions } from '@/components/nav';

/** A parent's app: their children and their account — the web's /parent portal. */
export default function ParentTabsLayout() {
    const tabScreenOptions = useTabScreenOptions();
    return (
        <Tabs screenOptions={tabScreenOptions}>
            <Tabs.Screen name="index" options={{ title: 'My children', tabBarLabel: 'Children', tabBarIcon: ({ color }) => <TabIcon icon={Users} color={color} /> }} />
            <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarLabel: 'Profile', tabBarIcon: ({ color }) => <TabIcon icon={CircleUser} color={color} /> }} />
        </Tabs>
    );
}
