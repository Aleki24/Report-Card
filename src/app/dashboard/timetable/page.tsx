"use client";

import React from 'react';
import { CalendarClock, Clock, Layers, UserCheck } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { ModulePage } from '@/components/ops/ModulePage';
import { TimetableViewer } from '@/components/academics/timetable/TimetableViewer';
import { TimetableWizard } from '@/components/academics/timetable/TimetableWizard';
import { CoverPanel } from '@/components/academics/timetable/CoverPanel';

export default function TimetablePage() {
    const { can, role } = useAuth();
    const manager = can('timetable.manage');
    return (
        <ModulePage
            module="timetable"
            title="Timetable"
            eyebrow="Academics"
            description="Generate a clash-free timetable from teaching loads, publish it to everyone, and arrange cover when teachers are away."
            icon={Clock}
            hue="teal"
            tabs={[
                { id: 'view', label: 'Timetable', icon: CalendarClock, hue: 'teal', render: () => <TimetableViewer canBrowse={role !== 'STUDENT'} /> },
                { id: 'build', label: 'Create timetable', shortLabel: 'Create', icon: Layers, hue: 'violet', visible: manager, render: () => <TimetableWizard /> },
                { id: 'cover', label: 'Lesson cover', shortLabel: 'Cover', icon: UserCheck, hue: 'rose', visible: manager, render: () => <CoverPanel /> },
            ]}
        />
    );
}
