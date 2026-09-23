import React from 'react';
import { useRouter } from 'expo-router';
import { useCurrentUser } from '@/lib/UserContext';
import { STAFF_SCREENS, canAccessStaffScreen, type StaffScreen } from '@/lib/roles';
import { Button, EmptyState, Screen } from './ui';

/**
 * Renders a staff screen only for the roles the web allows on the same page,
 * so a deep link cannot open a screen whose API would refuse the caller.
 */
export function RequireScreen({ screen, children }: { screen: StaffScreen; children: React.ReactNode }) {
    const { role } = useCurrentUser();
    const router = useRouter();
    if (canAccessStaffScreen(screen, role)) return <>{children}</>;
    return (
        <Screen>
            <EmptyState
                title={`${STAFF_SCREENS[screen].title} isn't available`}
                description="Your role doesn't include this screen. Ask your administrator if you need access."
                action={<Button label="Go to dashboard" onPress={() => router.replace('/staff')} />}
            />
        </Screen>
    );
}
