"use client";

import React, { useState } from 'react';
import { toast } from 'sonner';
import { CalendarClock, Clock, DoorOpen, Download, Layers, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormField, InputField } from '@/components/ui/FormField';
import { useAuth } from '@/components/AuthProvider';
import { ModulePage } from '@/components/ops/ModulePage';
import { ResourceManager } from '@/components/ops/ResourceManager';
import { TimetableViewer } from '@/components/academics/timetable/TimetableViewer';
import { TimetableBuilder } from '@/components/academics/timetable/TimetableBuilder';
import { DayStructureEditor } from '@/components/academics/timetable/DayStructureEditor';
import { CoverPanel } from '@/components/academics/timetable/CoverPanel';
import { errorText, opsFetch } from '@/lib/ops/client';
import { humanize, personName } from '@/lib/ops/format';
import {
    LOAD_DEFAULTS, LOAD_FIELDS, ROOM_DEFAULTS, ROOM_FIELDS, importLoadsMessage, loadLessonsLabel, weeklyLessonsPerClass,
    type Room, type TeachingLoad as Load,
} from '@/lib/ops/forms/academics';

function Loads() {
    const [perWeek, setPerWeek] = useState('5');
    const [importing, setImporting] = useState(false);
    const [key, setKey] = useState(0);

    const importLoads = async () => {
        setImporting(true);
        try {
            const r = await opsFetch<{ created: number }>('/api/academics/timetable/requirements/import', { method: 'POST', json: { lessons_per_week: Number(perWeek) || 5 } });
            toast.success(importLoadsMessage(r.created));
            setKey(k => k + 1);
        } catch (err) { toast.error(errorText(err)); }
        finally { setImporting(false); }
    };

    return (
        <div className="flex flex-col gap-4">
            <section className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:flex-row sm:items-end sm:p-5">
                <div className="sm:flex-1">
                    <h2 className="text-base font-semibold">Start from subject assignments</h2>
                    <p className="text-sm text-muted-foreground">Creates a load for every subject each teacher is assigned to a class this year.</p>
                </div>
                <FormField label="Lessons a week" htmlFor="import-per-week" className="sm:w-36">
                    <InputField id="import-per-week" type="number" min={1} max={20} value={perWeek} onChange={e => setPerWeek(e.target.value)} />
                </FormField>
                <Button onClick={importLoads} disabled={importing}><Download />{importing ? 'Importing…' : 'Import'}</Button>
            </section>
            <ResourceManager<'timetable-requirements', Load>
                key={key}
                resource="timetable-requirements"
                fields={LOAD_FIELDS}
                canCreate
                canEdit
                canDelete
                defaults={LOAD_DEFAULTS}
                searchText={l => `${l.stream?.full_name} ${l.subject?.name} ${personName(l.teacher)}`}
                header={rows => (rows.length > 0 ? (
                    <p className="text-xs text-muted-foreground">Weekly lessons per class: {weeklyLessonsPerClass(rows)}</p>
                ) : null)}
                columns={[
                    { key: 'class', header: 'Class', render: l => <span className="font-medium">{l.stream?.full_name}</span> },
                    { key: 'subject', header: 'Subject', render: l => l.subject?.name },
                    { key: 'teacher', header: 'Teacher', render: l => (l.teacher ? personName(l.teacher) : <span className="text-destructive">Unassigned</span>) },
                    { key: 'lessons', header: 'Lessons', numeric: true, render: l => loadLessonsLabel(l) },
                    { key: 'room', header: 'Room', hideOnMobile: true, render: l => (l.room_type ? humanize(l.room_type) : 'Any') },
                ]}
            />
        </div>
    );
}

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
                { id: 'build', label: 'Generate & publish', shortLabel: 'Build', icon: Layers, hue: 'violet', visible: manager, render: () => <TimetableBuilder /> },
                { id: 'loads', label: 'Teaching loads', shortLabel: 'Loads', icon: Layers, hue: 'blue', visible: manager, render: () => <Loads /> },
                {
                    id: 'setup', label: 'Day & rooms', shortLabel: 'Setup', icon: DoorOpen, hue: 'amber', visible: manager,
                    render: () => (
                        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                            <DayStructureEditor />
                            <ResourceManager<'rooms', Room>
                                resource="rooms"
                                fields={ROOM_FIELDS}
                                canCreate
                                canEdit
                                canDelete
                                defaults={ROOM_DEFAULTS}
                                columns={[
                                    { key: 'name', header: 'Room', render: r => <span className="font-medium">{r.name}</span> },
                                    { key: 'type', header: 'Type', render: r => humanize(r.room_type) },
                                    { key: 'capacity', header: 'Seats', numeric: true, render: r => r.capacity ?? '—' },
                                ]}
                                emptyText="No rooms yet. Add labs so practicals get one; ordinary lessons run in the class's own room."
                            />
                        </div>
                    ),
                },
                { id: 'cover', label: 'Lesson cover', shortLabel: 'Cover', icon: UserCheck, hue: 'rose', visible: manager, render: () => <CoverPanel /> },
            ]}
        />
    );
}
