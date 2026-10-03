import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import { LifeBuoy, ShieldCheck, UserX } from 'lucide-react-native';
import { webUrl } from '@/lib/api';
import { colors, spacing } from '@/lib/theme';
import { Button, IconTile, ListCard, ListRow } from '@/components/ui';

/**
 * The foot of every profile: help, the privacy policy, account deletion
 * (both required by Google Play) and sign out.
 */
export function AccountActions() {
    const router = useRouter();
    const { signOut } = useAuth();
    return (
        <View>
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
            <Button variant="danger" block label="Sign out" onPress={() => void signOut()} />
        </View>
    );
}
