import React, { useState } from 'react';
import { View } from 'react-native';
import { admissionNo, date, dateTime, humanize, money, studentName } from '@shared/ops/format';
import { CREW_DOCUMENTS, SPEED_LIMIT_KMH, VEHICLE_DOCUMENTS, complianceOf, type ComplianceItem } from '@shared/transport/compliance';
import {
    CREW_DEFAULTS, CREW_FIELDS, LEVEL_TONES, STOP_FIELDS, TRIP_DEFAULTS, TRIP_TONES, VEHICLE_DEFAULTS, VEHICLE_FIELDS,
    complianceChipLabel, complianceLevelLabel, driverOptions, logDefaults, logFields, riderDefaults, riderFields,
    routeFields, stopDefaults, tripFields, vehicleOptions,
    type ComplianceAlert, type Crew, type Rider, type Stop, type TransportRoute, type Trip, type Vehicle, type VehicleLog,
} from '@shared/ops/forms/transport';
import { EmptyState, ErrorBanner, ListCard, ListRow, LoadingView, SectionLabel } from '@/components/ui';
import { FormSheet } from '@/components/ops/FormSheet';
import { ModuleScreen } from '@/components/ops/ModuleScreen';
import { ResourceList } from '@/components/ops/ResourceList';
import { StatusPill, useRefreshSignal } from '@/components/ops/bits';
import { DriverMode } from '@/components/transport/DriverMode';
import { LiveMap } from '@/components/transport/LiveMap';
import { useOpsData, useOpsList } from '@/lib/ops';
import { useCurrentUser } from '@/lib/UserContext';
import { spacing } from '@/lib/theme';

function ComplianceChips({ items }: { items: ComplianceItem[] }) {
    const worst = items.filter((i) => i.level !== 'ok');
    if (worst.length === 0) return <StatusPill status="ok" tones={LEVEL_TONES} label="All current" />;
    return (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {worst.map((i) => <StatusPill key={i.label} status={i.level} tones={LEVEL_TONES} label={complianceChipLabel(i)} />)}
        </View>
    );
}

function RouteDetail({ route, manage }: { route: TransportRoute; manage: boolean }) {
    const stops = useOpsList<Stop>('route-stops', { route_id: route.id });
    return (
        <View>
            <SectionLabel>Stops</SectionLabel>
            <ResourceList<'route-stops', Stop>
                resource="route-stops"
                params={{ route_id: route.id }}
                defaults={stopDefaults(route.id, stops.rows)}
                fields={STOP_FIELDS}
                canCreate={manage}
                canEdit={manage}
                canDelete={manage}
                title={(s) => `${s.sequence}. ${s.name}`}
                subtitle={(s) => `Pick-up ${s.pickup_time?.slice(0, 5) ?? '—'} · drop-off ${s.dropoff_time?.slice(0, 5) ?? '—'}`}
            />
            <SectionLabel>Learners</SectionLabel>
            <ResourceList<'riders', Rider>
                resource="riders"
                params={{ route_id: route.id }}
                defaults={riderDefaults(route.id)}
                fields={riderFields(stops.rows)}
                canCreate={manage}
                canEdit={manage}
                canDelete={manage}
                addLabel="Add learner"
                searchText={(r) => `${studentName(r.student)} ${admissionNo(r.student)}`}
                title={(r) => studentName(r.student)}
                subtitle={(r) => `${r.stop?.name ?? 'No stop'} · ${humanize(r.direction)}`}
            />
        </View>
    );
}

function Compliance() {
    const { data, loading, error, reload } = useOpsData<ComplianceAlert[]>('/api/transport/compliance');
    useRefreshSignal(reload);
    if (loading && !data) return <LoadingView />;
    if (error) return <ErrorBanner message={error} onRetry={() => void reload()} />;
    if (!data || data.length === 0) return <EmptyState title="Every vehicle and crew document is current." />;
    return (
        <ListCard>
            {data.map((a) => (
                <ListRow
                    key={`${a.kind}-${a.subject}-${a.label}`}
                    title={a.subject}
                    subtitle={`${a.label} · expires ${date(a.date)}`}
                    right={<StatusPill status={a.level} tones={LEVEL_TONES} label={complianceLevelLabel(a) ?? humanize(a.level)} />}
                />
            ))}
        </ListCard>
    );
}

export default function TransportScreen() {
    const { can, hasModule } = useCurrentUser();
    const manage = can('transport.manage');
    const viewer = can('transport.view');
    const [openRoute, setOpenRoute] = useState<TransportRoute | null>(null);
    const vehicles = useOpsList<Vehicle>('vehicles', {}, { enabled: manage });
    const crew = useOpsList<Crew>('transport-crew', {}, { enabled: manage });
    const routes = useOpsList<TransportRoute>('routes', {}, { enabled: manage });
    const vehicleChoices = vehicleOptions(vehicles.rows);
    const driverChoices = driverOptions(crew.rows);

    return (
        <>
            <ModuleScreen
                screen="transport"
                title="Transport"
                description="Fleet and NTSA compliance, drivers, routes and stops, trips with boarding check-in, and every bus live on the map."
                tabs={[
                    { id: 'live', label: 'Live map', visible: viewer && hasModule('transport_tracking'), render: () => <LiveMap /> },
                    { id: 'drive', label: 'Driver mode', visible: can('transport.drive') || manage, render: () => <DriverMode /> },
                    {
                        id: 'trips',
                        label: 'Trips',
                        visible: viewer,
                        render: () => (
                            <ResourceList<'trips', Trip>
                                resource="trips"
                                fields={tripFields(routes.rows, vehicleChoices, driverChoices)}
                                canCreate={manage}
                                canEdit={(t) => manage && t.status === 'SCHEDULED'}
                                canDelete={(t) => manage && t.status === 'SCHEDULED'}
                                defaults={TRIP_DEFAULTS}
                                addLabel="Schedule trip"
                                title={(t) => dateTime(t.scheduled_at)}
                                subtitle={(t) => `${t.route?.name ?? '—'} · ${humanize(t.direction)}`}
                                badge={(t) => <StatusPill status={t.status} tones={TRIP_TONES} />}
                                details={(t) => [
                                    ['Vehicle', t.vehicle?.registration ?? '—'],
                                    ['Driver', t.driver?.full_name ?? '—'],
                                    ['Top speed', t.max_speed_kmh ? `${Math.round(Number(t.max_speed_kmh))} km/h${Number(t.max_speed_kmh) > SPEED_LIMIT_KMH ? ' ⚠︎' : ''}` : '—'],
                                ]}
                            />
                        ),
                    },
                    {
                        id: 'routes',
                        label: 'Routes',
                        visible: viewer,
                        render: () => (
                            <ResourceList<'routes', TransportRoute>
                                resource="routes"
                                fields={routeFields(vehicleChoices, driverChoices)}
                                canCreate={manage}
                                canEdit={manage}
                                canDelete={manage}
                                onRowPress={setOpenRoute}
                                title={(r) => r.name}
                                subtitle={(r) => `${r.stops[0]?.count ?? 0} stops · ${r.riders[0]?.count ?? 0} learners`}
                                details={(r) => [
                                    ['Vehicle', r.vehicle?.registration ?? '—'],
                                    ['Fee / term', money(r.fee_per_term)],
                                ]}
                                emptyText="Add a route, then open it to add stops and learners."
                            />
                        ),
                    },
                    {
                        id: 'fleet',
                        label: 'Vehicles',
                        visible: viewer,
                        render: () => (
                            <ResourceList<'vehicles', Vehicle>
                                resource="vehicles"
                                fields={VEHICLE_FIELDS}
                                canCreate={manage}
                                canEdit={manage}
                                canDelete={manage}
                                defaults={VEHICLE_DEFAULTS}
                                title={(v) => v.registration}
                                subtitle={(v) => `${v.capacity} seats · ${humanize(v.status)}${v.make_model ? ` · ${v.make_model}` : ''}`}
                                rowActions={(v) => <ComplianceChips items={complianceOf(VEHICLE_DOCUMENTS, v)} />}
                            />
                        ),
                    },
                    {
                        id: 'crew',
                        label: 'Crew',
                        visible: viewer,
                        render: () => (
                            <ResourceList<'transport-crew', Crew>
                                resource="transport-crew"
                                fields={CREW_FIELDS}
                                canCreate={manage}
                                canEdit={manage}
                                canDelete={manage}
                                defaults={CREW_DEFAULTS}
                                title={(c) => c.full_name}
                                subtitle={(c) => `${humanize(c.crew_role)}${c.phone ? ` · ${c.phone}` : ''} · driver mode ${c.user_id ? 'linked' : 'not linked'}`}
                                rowActions={(c) => <ComplianceChips items={complianceOf(CREW_DOCUMENTS, c)} />}
                            />
                        ),
                    },
                    {
                        id: 'logs',
                        label: 'Fuel & service',
                        visible: viewer,
                        render: () => (
                            <ResourceList<'vehicle-logs', VehicleLog>
                                resource="vehicle-logs"
                                fields={logFields(vehicleChoices)}
                                canCreate={manage}
                                canEdit={manage}
                                canDelete={manage}
                                defaults={logDefaults()}
                                title={(l) => `${l.vehicle?.registration ?? 'Vehicle'} · ${humanize(l.log_type)}`}
                                subtitle={(l) => date(l.log_date)}
                                details={(l) => [
                                    ['Litres', l.litres ?? '—'],
                                    ['Cost', l.cost != null ? money(l.cost) : '—'],
                                    ['Odometer', l.odometer ?? '—'],
                                ]}
                            />
                        ),
                    },
                    { id: 'compliance', label: 'Compliance', visible: viewer, render: () => <Compliance /> },
                ]}
            />
            <FormSheet visible={openRoute !== null} title={openRoute?.name ?? ''} onClose={() => setOpenRoute(null)}>
                {openRoute ? <RouteDetail key={openRoute.id} route={openRoute} manage={manage} /> : null}
            </FormSheet>
        </>
    );
}
