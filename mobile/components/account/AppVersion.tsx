import React, { useState } from 'react';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { RefreshCw } from 'lucide-react-native';
import { IconTile, ListCard, ListRow } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { errorMessage, formatDate } from '@/lib/format';

/**
 * Which version of the app is running, and a way to fetch the latest
 * without waiting for the next restart: updates normally download in the
 * background and apply the time after.
 */
export function AppVersion() {
    const toast = useToast();
    const [busy, setBusy] = useState(false);
    const version = Constants.expoConfig?.version ?? '1.0.0';
    const running = Updates.isEnabled
        ? Updates.isEmbeddedLaunch || !Updates.createdAt
            ? 'the version inside the app'
            : `update of ${formatDate(Updates.createdAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
        : 'updates are off in this build';

    const check = async () => {
        if (!Updates.isEnabled) { toast.error('This copy of the app cannot take updates. Install the latest app from the link you were sent.'); return; }
        setBusy(true);
        try {
            const found = await Updates.checkForUpdateAsync();
            if (!found.isAvailable) { toast.success('You have the latest version.'); return; }
            await Updates.fetchUpdateAsync();
            toast.success('Update downloaded. Restarting…');
            await Updates.reloadAsync();
        } catch (err) {
            toast.error(errorMessage(err, 'Could not check for updates. Check your connection.'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <ListCard style={{ marginBottom: 16 }}>
            <ListRow
                title={busy ? 'Checking for updates…' : 'Check for updates'}
                subtitle={`Version ${version} · running the ${running}`}
                left={<IconTile icon={RefreshCw} />}
                onPress={busy ? undefined : () => void check()}
            />
        </ListCard>
    );
}
