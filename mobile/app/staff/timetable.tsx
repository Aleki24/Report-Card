import React from 'react';
import { CoverPanel, TimetableViewer } from '@/components/academics/TimetablePanels';
import { TimetableWizard } from '@/components/academics/TimetableWizard';
import { ModuleScreen } from '@/components/ops/ModuleScreen';
import { useCurrentUser } from '@/lib/UserContext';

export default function TimetableScreen() {
    const { can, role } = useCurrentUser();
    const manager = can('timetable.manage');
    return (
        <ModuleScreen
            screen="timetable"
            title="Timetable"
            description="Generate a clash-free timetable from teaching loads, publish it to everyone, and arrange cover when teachers are away."
            tabs={[
                // In working order for whoever builds it: set up, then the timetable, then cover.
                { id: 'build', label: 'Set up', visible: manager, render: () => <TimetableWizard /> },
                { id: 'view', label: 'Timetable', render: () => <TimetableViewer canBrowse={role !== 'STUDENT'} /> },
                { id: 'cover', label: 'Cover', visible: manager, render: () => <CoverPanel /> },
            ]}
        />
    );
}
