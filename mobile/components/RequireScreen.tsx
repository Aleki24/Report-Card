import React from 'react';
import { useRouter } from 'expo-router';
import { MODULES } from '@shared/platform/modules';
import { useCurrentUser } from '@/lib/UserContext';
import { STAFF_SCREENS, canAccessStaffScreen, type StaffScreen } from '@/lib/roles';
import { Button, EmptyState, Screen } from './ui';

/**
 * Renders a staff screen only for whoever the web allows on the same page
 * (role, duty and the school's modules), so a deep link cannot open a screen
 * whose API would refuse the caller.
 */
export function RequireScreen({ screen, children }: { screen: StaffScreen; children: React.ReactNode }) {
    const { viewer, hasModule, role } = useCurrentUser();
    const router = useRouter();
    if (canAccessStaffScreen(screen, viewer)) return <>{children}</>;
    const offModule = STAFF_SCREENS[screen].access.map((a) => a.module).find((m) => m !== undefined && !hasModule(m));
    const adminHint = role === 'ADMIN' ? 'Turn it on under Settings → Modules to start using it.' : 'Ask your school administrator to turn it on.';
    return (
        <Screen>
            <EmptyState
                title={offModule ? `${MODULES[offModule].name} is switched off` : `${STAFF_SCREENS[screen].title} isn't available`}
                description={offModule ? adminHint : "Your role and duties don't include this screen. Ask your administrator for the duty that covers it."}
                action={<Button label="Go to dashboard" onPress={() => router.replace('/staff')} />}
            />
        </Screen>
    );
}
