import { Tabs } from 'expo-router/js-tabs';
import { Menu } from 'lucide-react-native';
import { useApiQuery } from '@/lib/useApiQuery';
import { useCurrentUser } from '@/lib/UserContext';
import { STUDENT_SCREENS, getStudentNav, type StudentScreen } from '@/lib/roles';
import { TAB_SCREEN_OPTIONS, TabIcon } from '@/components/nav';

export default function StudentTabsLayout() {
    // Same unread count the web sidebar badges on the student dashboard.
    const notifications = useApiQuery<{ count: number }>('/api/school/student/notifications');
    const unread = notifications.data?.count ?? 0;
    const { viewer } = useCurrentUser();
    const nav = getStudentNav(viewer);
    const primary = new Set<StudentScreen>(nav.primary);

    return (
        <Tabs screenOptions={TAB_SCREEN_OPTIONS}>
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
                            tabBarIcon: ({ color }) => <TabIcon icon={meta.icon} color={color} />,
                        }}
                    />
                );
            })}
            <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color }) => <TabIcon icon={Menu} color={color} /> }} />
            <Tabs.Screen name="subjects/[subjectId]" options={{ href: null, title: 'Subject' }} />
        </Tabs>
    );
}
