import React from 'react';
import { Text } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useCurrentUser } from '@/lib/UserContext';
import { STAFF_SCREENS, getStaffNav } from '@/lib/roles';
import { ListCard, ListRow, Screen, ScreenHeader } from '@/components/ui';

/** Everything the role can open that isn't on the tab bar — the web's "More" sheet. */
export default function MoreScreen() {
    const router = useRouter();
    const { role } = useCurrentUser();
    const { overflow } = getStaffNav(role);

    return (
        <Screen>
            <ScreenHeader title="More" description="Everything else your role can open." />
            <ListCard>
                {overflow.map((name) => {
                    const meta = STAFF_SCREENS[name];
                    return (
                        <ListRow
                            key={name}
                            title={meta.title}
                            subtitle={meta.description}
                            left={<Text style={{ fontSize: 22 }}>{meta.icon}</Text>}
                            onPress={() => router.push(meta.href as Href)}
                        />
                    );
                })}
            </ListCard>
        </Screen>
    );
}
