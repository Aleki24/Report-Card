import React from 'react';
import { Screen, ScreenHeader } from '@/components/ui';
import { TimetableViewer } from '@/components/academics/TimetablePanels';

/** A learner's class timetable, as published by the school. */
export default function StudentTimetableScreen() {
    return (
        <Screen>
            <ScreenHeader title="My timetable" description="Your class's lessons for the week." />
            <TimetableViewer canBrowse={false} />
        </Screen>
    );
}
