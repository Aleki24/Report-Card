import { Tabs } from 'expo-router/js-tabs';
import { FEATURE_ICONS } from '@/lib/featureIcons';
import { RoleGroup, TabIcon, useTabScreenOptions } from '@/components/nav';

/** A parent's app: their children and their account — the web's /parent portal. */
export default function ParentTabsLayout() {
    return <RoleGroup roles={['PARENT']}><ParentTabs /></RoleGroup>;
}

function ParentTabs() {
    const tabScreenOptions = useTabScreenOptions();
    return (
        <Tabs screenOptions={tabScreenOptions}>
            <Tabs.Screen name="index" options={{ title: 'My children', tabBarLabel: 'Children', tabBarIcon: ({ color }) => <TabIcon icon={FEATURE_ICONS.people} color={color} /> }} />
            <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarLabel: 'Profile', tabBarIcon: ({ color }) => <TabIcon icon={FEATURE_ICONS.profile} color={color} /> }} />
        </Tabs>
    );
}
