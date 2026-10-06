import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { MANUALS, isManualSlug } from '@shared/manual';
import { ManualView } from '@/components/help/ManualView';
import { BackLink, EmptyState, Screen } from '@/components/ui';

/** One user guide — the web's /help/[slug]. */
export default function GuideScreen() {
    const { slug } = useLocalSearchParams<{ slug: string }>();
    if (!slug || !isManualSlug(slug)) {
        return (
            <Screen>
                <BackLink />
                <EmptyState title="Guide not found" description="That guide doesn’t exist. Go back to see every guide." />
            </Screen>
        );
    }
    return <ManualView manual={MANUALS[slug]} />;
}
