import React from 'react';
import { useSignOut } from '@/lib/useSignOut';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { LifeBuoy, ShieldCheck, UserX } from 'lucide-react-native';
import { webUrl } from '@/lib/api';
import { spacing, useTheme } from '@/lib/theme';
import { Button, IconTile, ListCard, ListRow } from '@/components/ui';
import { AppearancePicker } from './AppearancePicker';
import { AppVersion } from './AppVersion';

/**
 * The foot of every profile: help, the privacy policy, account deletion
 * (both required by Google Play) and sign out.
 */
export function AccountActions() {
    const { colors } = useTheme();
    const router = useRouter();
    const { signOut, signingOut } = useSignOut();
    return (
        <View>
            <AppearancePicker />
            <ListCard style={{ marginBottom: spacing.lg }}>
                <ListRow title="Help & guides" subtitle="Guides for your account and how to reach support" left={<IconTile icon={LifeBuoy} />} onPress={() => router.push('/help')} />
                <ListRow title="Privacy policy" subtitle="What we collect and how it is used" left={<IconTile icon={ShieldCheck} />} onPress={() => void WebBrowser.openBrowserAsync(webUrl('/privacy'))} />
                <ListRow
                    title="Delete account"
                    subtitle="Permanently remove your account and its data"
                    left={<IconTile icon={UserX} color={colors.danger} background={colors.dangerBg} />}
                    onPress={() => router.push('/account/delete')}
                />
            </ListCard>
            <AppVersion />
            <Button variant="danger" block label={signingOut ? 'Signing out…' : 'Sign out'} loading={signingOut} onPress={() => void signOut()} />
        </View>
    );
}
