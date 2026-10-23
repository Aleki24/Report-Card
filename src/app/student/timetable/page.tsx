"use client";

import React from 'react';
import { Clock } from 'lucide-react';
import { ModulePage } from '@/components/ops/ModulePage';
import { TimetableViewer } from '@/components/academics/timetable/TimetableViewer';
import { FEATURE_ICONS } from '@/components/ui/featureIcons';

/** A learner's class timetable, as published by the school. */
export default function StudentTimetablePage() {
    return (
        <ModulePage
            module="timetable"
            title="My timetable"
            eyebrow="Academics"
            description="Your class's lessons for the week."
            icon={FEATURE_ICONS.timetable}
            hue="teal"
            tabs={[{ id: 'week', label: 'Week', icon: Clock, hue: 'teal', render: () => <TimetableViewer canBrowse={false} /> }]}
        />
    );
}
