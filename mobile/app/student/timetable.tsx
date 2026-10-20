import React, { useState } from 'react';
import { Screen, ScreenHeader } from '@/components/ui';
import { TimetableViewer } from '@/components/academics/TimetablePanels';
import { RefreshSignalProvider } from '@/components/ops/bits';

/** A learner's class timetable, as published by the school. Pull down to reload it. */
export default function StudentTimetableScreen() {
    const [signal, setSignal] = useState(0);
    return (
        <Screen onRefresh={() => setSignal((n) => n + 1)} refreshing={false}>
            <ScreenHeader title="My timetable" description="Your class's lessons for the week." />
            <RefreshSignalProvider value={signal}>
                <TimetableViewer canBrowse={false} />
            </RefreshSignalProvider>
        </Screen>
    );
}
