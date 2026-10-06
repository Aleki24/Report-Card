import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { date, humanize } from '@shared/ops/format';
import { EVENT_FIELDS, EVENT_TYPE_TONES, eventDefaults, isHappeningToday, monthLabel, upcomingByMonth, type SchoolEvent } from '@shared/ops/forms/academics';
import { Card, EmptyState, ErrorBanner, LoadingView, SectionLabel } from '@/components/ui';
import { ModuleScreen } from '@/components/ops/ModuleScreen';
import { ResourceList } from '@/components/ops/ResourceList';
import { StatusPill, useRefreshSignal } from '@/components/ops/bits';
import { useOpsList } from '@/lib/ops';
import { useCurrentUser } from '@/lib/UserContext';
import { radius, spacing, fonts, makeStyles, useTheme } from '@/lib/theme';

const eventWhen = (e: SchoolEvent) => (e.ends_on && e.ends_on !== e.starts_on ? `${date(e.starts_on)} – ${date(e.ends_on)}` : date(e.starts_on));

/** Upcoming events grouped by month: what everyone in school needs to plan around. */
function Agenda() {
    const { colors } = useTheme();
    const styles = useStyles();
    const { rows, loading, error, reload } = useOpsList<SchoolEvent>('events');
    useRefreshSignal(reload);
    const months = upcomingByMonth(rows);

    if (loading) return <LoadingView />;
    if (error) return <ErrorBanner message={error} onRetry={() => void reload()} />;
    if (months.length === 0) return <EmptyState title="Nothing coming up on the school calendar." />;

    return (
        <View>
            {months.map(([month, events]) => (
                <View key={month}>
                    <SectionLabel>{monthLabel(month)}</SectionLabel>
                    {events.map((e) => {
                        const d = new Date(`${e.starts_on}T00:00:00`);
                        return (
                            <Card key={e.id} style={[styles.event, isHappeningToday(e) && { borderColor: colors.primary }]}>
                                <View style={styles.day}>
                                    <Text style={styles.weekday}>{d.toLocaleDateString('en-KE', { weekday: 'short' }).toUpperCase()}</Text>
                                    <Text style={styles.dayNum}>{d.getDate()}</Text>
                                </View>
                                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                                    <Text style={styles.title}>{e.title}</Text>
                                    <Text style={styles.meta}>{eventWhen(e)} · {humanize(e.audience)}</Text>
                                    <StatusPill status={e.event_type} tones={EVENT_TYPE_TONES} />
                                    {e.description ? <Text style={styles.meta} numberOfLines={3}>{e.description}</Text> : null}
                                </View>
                            </Card>
                        );
                    })}
                </View>
            ))}
        </View>
    );
}

export default function CalendarScreen() {
    const { can } = useCurrentUser();
    return (
        <ModuleScreen
            screen="calendar"
            title="School calendar"
            description="Exams, marks deadlines, report release, meetings and holidays in one place."
            tabs={[
                { id: 'agenda', label: 'Upcoming', render: () => <Agenda /> },
                {
                    id: 'manage',
                    label: 'Manage events',
                    visible: can('calendar.manage'),
                    render: () => (
                        <ResourceList<'events', SchoolEvent>
                            resource="events"
                            fields={EVENT_FIELDS}
                            canCreate
                            canEdit
                            canDelete
                            defaults={eventDefaults()}
                            searchText={(e) => `${e.title} ${e.event_type}`}
                            title={(e) => e.title}
                            subtitle={(e) => `${eventWhen(e)} · ${humanize(e.audience)}`}
                            badge={(e) => <StatusPill status={e.event_type} tones={EVENT_TYPE_TONES} />}
                        />
                    ),
                },
            ]}
        />
    );
}

const useStyles = makeStyles((colors) => ({
    event: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm, padding: spacing.md },
    day: { width: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.mutedBg, borderRadius: radius.md, paddingVertical: 6 },
    weekday: { fontSize: 10, fontFamily: fonts.bold, color: colors.muted },
    dayNum: { fontSize: 18, fontFamily: fonts.display, color: colors.foreground },
    title: { fontSize: 14, fontFamily: fonts.bold, color: colors.foreground },
    meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
}));
