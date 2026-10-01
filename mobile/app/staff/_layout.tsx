import { Tabs } from 'expo-router/js-tabs';
import { useCurrentUser } from '@/lib/UserContext';
import { STAFF_SCREENS, getStaffNav, type StaffScreen } from '@/lib/roles';
import { TAB_SCREEN_OPTIONS, TabIcon } from '@/components/nav';

/** Routes that exist in the tree but never get a tab of their own. */
const DETAIL_ROUTES = ['people/[id]'] as const;

export default function StaffTabsLayout() {
    const { viewer } = useCurrentUser();
    const { primary, overflow } = getStaffNav(viewer);
    const tabs = new Set<StaffScreen>(primary);

    return (
        <Tabs screenOptions={TAB_SCREEN_OPTIONS}>
            {(Object.keys(STAFF_SCREENS) as StaffScreen[]).map((name) => {
                const meta = STAFF_SCREENS[name];
                return (
                    <Tabs.Screen
                        key={name}
                        name={name}
                        options={{
                            title: meta.title,
                            tabBarLabel: meta.tabLabel,
                            // Everything outside the role's four is reached through More.
                            href: tabs.has(name) ? undefined : null,
                            tabBarIcon: ({ color }) => <TabIcon emoji={meta.icon} color={color} />,
                        }}
                    />
                );
            })}
            <Tabs.Screen
                name="more"
                options={{
                    title: 'More',
                    href: overflow.length > 0 ? undefined : null,
                    tabBarIcon: ({ color }) => <TabIcon emoji="☰" color={color} />,
                }}
            />
            {DETAIL_ROUTES.map((name) => (
                <Tabs.Screen key={name} name={name} options={{ href: null }} />
            ))}
        </Tabs>
    );
}
