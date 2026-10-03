import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { humanize, personName } from '@shared/ops/format';
import {
    LOAD_DEFAULTS, LOAD_FIELDS, ROOM_DEFAULTS, ROOM_FIELDS, importLoadsMessage, loadLessonsLabel, weeklyLessonsPerClass,
    type Room, type TeachingLoad,
} from '@shared/ops/forms/academics';
import { Button, Card, SectionLabel, TextField } from '@/components/ui';
import { CoverPanel, DayStructureEditor, TimetableBuilder, TimetableViewer } from '@/components/academics/TimetablePanels';
import { ModuleScreen } from '@/components/ops/ModuleScreen';
import { ResourceList } from '@/components/ops/ResourceList';
import { useToast } from '@/components/Toast';
import { useApi } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { useCurrentUser } from '@/lib/UserContext';
import { colors, spacing, fonts } from '@/lib/theme';

function Loads() {
    const api = useApi();
    const toast = useToast();
    const [perWeek, setPerWeek] = useState('5');
    const [version, setVersion] = useState(0);
    const [busy, setBusy] = useState(false);

    const importLoads = async () => {
        setBusy(true);
        try {
            const r = await api.post<{ data: { created: number } }>('/api/academics/timetable/requirements/import', { lessons_per_week: Number(perWeek) || 5 });
            toast.success(importLoadsMessage(r.data.created));
            setVersion((v) => v + 1);
        } catch (err) {
            toast.error(errorMessage(err, 'Import failed'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <View>
            <Card style={{ marginBottom: spacing.md }}>
                <Text style={{ fontFamily: fonts.bold, color: colors.foreground }}>Start from subject assignments</Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginBottom: spacing.md }}>Creates a load for every subject each teacher is assigned to a class this year.</Text>
                <TextField label="Lessons a week" value={perWeek} onChangeText={setPerWeek} keyboardType="number-pad" />
                <Button label={busy ? 'Importing…' : 'Import'} onPress={() => void importLoads()} loading={busy} block />
            </Card>
            <ResourceList<'timetable-requirements', TeachingLoad>
                key={version}
                resource="timetable-requirements"
                fields={LOAD_FIELDS}
                canCreate
                canEdit
                canDelete
                defaults={LOAD_DEFAULTS}
                searchText={(l) => `${l.stream?.full_name} ${l.subject?.name} ${personName(l.teacher)}`}
                header={(rows) => (rows.length > 0 ? (
                    <Text style={{ fontSize: 12, color: colors.muted, marginBottom: spacing.md }}>Weekly lessons per class: {weeklyLessonsPerClass(rows)}</Text>
                ) : null)}
                title={(l) => `${l.stream?.full_name ?? ''} · ${l.subject?.name ?? ''}`}
                subtitle={(l) => (l.teacher ? personName(l.teacher) : 'Unassigned')}
                details={(l) => [
                    ['Lessons', loadLessonsLabel(l)],
                    ['Room', l.room_type ? humanize(l.room_type) : 'Any'],
                ]}
            />
        </View>
    );
}

export default function TimetableScreen() {
    const { can, role } = useCurrentUser();
    const manager = can('timetable.manage');
    return (
        <ModuleScreen
            screen="timetable"
            title="Timetable"
            description="Generate a clash-free timetable from teaching loads, publish it to everyone, and arrange cover when teachers are away."
            tabs={[
                { id: 'view', label: 'Timetable', render: () => <TimetableViewer canBrowse={role !== 'STUDENT'} /> },
                { id: 'build', label: 'Generate & publish', visible: manager, render: () => <TimetableBuilder /> },
                { id: 'loads', label: 'Teaching loads', visible: manager, render: () => <Loads /> },
                {
                    id: 'setup',
                    label: 'Day & rooms',
                    visible: manager,
                    render: () => (
                        <View>
                            <DayStructureEditor />
                            <SectionLabel>Rooms</SectionLabel>
                            <ResourceList<'rooms', Room>
                                resource="rooms"
                                fields={ROOM_FIELDS}
                                canCreate
                                canEdit
                                canDelete
                                defaults={ROOM_DEFAULTS}
                                title={(r) => r.name}
                                subtitle={(r) => `${humanize(r.room_type)} · ${r.capacity ?? '—'} seats`}
                                emptyText="No rooms yet. Add labs so practicals get one; ordinary lessons run in the class's own room."
                            />
                        </View>
                    ),
                },
                { id: 'cover', label: 'Lesson cover', visible: manager, render: () => <CoverPanel /> },
            ]}
        />
    );
}
