"use client";

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Bus, CalendarClock, Fuel, IdCard, Map as MapIcon, Navigation, Route as RouteIcon, ShieldCheck } from 'lucide-react';
import { Drawer } from '@/components/ui/Drawer';
import DataTable from '@/components/ui/DataTable';
import { useAuth } from '@/components/AuthProvider';
import { ModulePage } from '@/components/ops/ModulePage';
import { ResourceManager } from '@/components/ops/ResourceManager';
import { StatusPill } from '@/components/ops/StatusPill';
import { LiveMap } from '@/components/transport/LiveMap';
import { DriverMode } from '@/components/transport/DriverMode';
import { useOpsList } from '@/hooks/useOpsList';
import { errorText, opsFetch } from '@/lib/ops/client';
import { admissionNo, date, dateTime, humanize, money, studentName } from '@/lib/ops/format';
import { CREW_DOCUMENTS, VEHICLE_DOCUMENTS, complianceOf, type ComplianceItem } from '@/lib/transport/compliance';
import {
    CREW_DEFAULTS, CREW_FIELDS, LEVEL_TONES, STOP_FIELDS, TRIP_DEFAULTS, TRIP_TONES, VEHICLE_DEFAULTS, VEHICLE_FIELDS,
    complianceChipLabel, complianceLevelLabel, driverOptions as toDriverOptions, logDefaults, logFields, riderDefaults, riderFields,
    routeFields, stopDefaults, tripFields, vehicleOptions as toVehicleOptions,
    type ComplianceAlert as Alert, type Crew, type Rider, type Stop, type TransportRoute, type Trip, type Vehicle, type VehicleLog as Log,
} from '@/lib/ops/forms/transport';

function ComplianceChips({ items }: { items: ComplianceItem[] }) {
    const worst = items.filter(i => i.level !== 'ok');
    if (worst.length === 0) return <StatusPill status="ok" tones={LEVEL_TONES} label="All current" />;
    return (
        <span className="flex flex-wrap gap-1">
            {worst.map(i => <StatusPill key={i.label} status={i.level} tones={LEVEL_TONES} label={complianceChipLabel(i)} />)}
        </span>
    );
}

function RouteDetail({ route, canManage }: { route: TransportRoute; canManage: boolean }) {
    const stops = useOpsList<Stop>('route-stops', { route_id: route.id });
    return (
        <div className="flex flex-col gap-8">
            <section>
                <h3 className="mb-3 text-sm font-semibold">Stops</h3>
                <ResourceManager<'route-stops', Stop>
                    resource="route-stops"
                    params={{ route_id: route.id }}
                    defaults={stopDefaults(route.id, stops.rows)}
                    fields={STOP_FIELDS}
                    canCreate={canManage}
                    canEdit={canManage}
                    canDelete={canManage}
                    columns={[
                        { key: 'seq', header: '#', numeric: true, render: s => s.sequence },
                        { key: 'name', header: 'Stop', render: s => <span className="font-medium">{s.name}</span> },
                        { key: 'pick', header: 'Pick-up', render: s => s.pickup_time?.slice(0, 5) ?? '—' },
                        { key: 'drop', header: 'Drop-off', hideOnMobile: true, render: s => s.dropoff_time?.slice(0, 5) ?? '—' },
                    ]}
                />
            </section>
            <section>
                <h3 className="mb-3 text-sm font-semibold">Learners</h3>
                <ResourceManager<'riders', Rider>
                    resource="riders"
                    params={{ route_id: route.id }}
                    defaults={riderDefaults(route.id)}
                    fields={riderFields(stops.rows)}
                    canCreate={canManage}
                    canEdit={canManage}
                    canDelete={canManage}
                    addLabel="Add learner"
                    searchText={r => `${studentName(r.student)} ${admissionNo(r.student)}`}
                    columns={[
                        { key: 'learner', header: 'Learner', render: r => <span className="font-medium">{studentName(r.student)}</span> },
                        { key: 'stop', header: 'Stop', render: r => r.stop?.name ?? '—' },
                        { key: 'dir', header: 'Rides', hideOnMobile: true, render: r => humanize(r.direction) },
                    ]}
                />
            </section>
        </div>
    );
}

function CompliancePanel() {
    const [alerts, setAlerts] = useState<Alert[] | null>(null);
    useEffect(() => { opsFetch<Alert[]>('/api/transport/compliance').then(setAlerts).catch(err => { toast.error(errorText(err)); setAlerts([]); }); }, []);
    return (
        <DataTable
            loading={alerts === null}
            rows={alerts ?? []}
            rowKey={a => `${a.kind}-${a.subject}-${a.label}`}
            emptyState="Every vehicle and crew document is current."
            columns={[
                { key: 'subject', header: 'Vehicle / person', render: a => <span className="font-medium">{a.subject}</span> },
                { key: 'doc', header: 'Document', render: a => a.label },
                { key: 'date', header: 'Expiry', render: a => date(a.date) },
                { key: 'level', header: 'Status', render: a => <StatusPill status={a.level} tones={LEVEL_TONES} label={complianceLevelLabel(a) ?? humanize(a.level)} /> },
            ]}
        />
    );
}

export default function TransportPage() {
    const { can, hasModule } = useAuth();
    const manage = can('transport.manage');
    const viewer = can('transport.view');
    const [openRoute, setOpenRoute] = useState<TransportRoute | null>(null);
    const vehicles = useOpsList<Vehicle>('vehicles', {}, { enabled: manage });
    const crew = useOpsList<Crew>('transport-crew', {}, { enabled: manage });
    const routes = useOpsList<TransportRoute>('routes', {}, { enabled: manage });
    const vehicleOptions = toVehicleOptions(vehicles.rows);
    const driverOptions = toDriverOptions(crew.rows);

    return (
        <>
            <ModulePage
                module="transport"
                title="Transport"
                eyebrow="Operations"
                description="Fleet and NTSA compliance, drivers, routes and stops, trips with boarding check-in, and every bus live on the map."
                icon={Bus}
                hue="amber"
                tabs={[
                    { id: 'live', label: 'Live map', shortLabel: 'Live', icon: MapIcon, hue: 'emerald', visible: viewer && hasModule('transport_tracking'), render: () => <LiveMap /> },
                    { id: 'drive', label: 'Driver mode', shortLabel: 'Drive', icon: Navigation, hue: 'blue', visible: can('transport.drive') || manage, render: () => <DriverMode /> },
                    {
                        id: 'trips', label: 'Trips', icon: CalendarClock, hue: 'violet', visible: viewer,
                        render: () => (
                            <ResourceManager<'trips', Trip>
                                resource="trips"
                                fields={tripFields(routes.rows, vehicleOptions, driverOptions)}
                                canCreate={manage}
                                canEdit={t => manage && t.status === 'SCHEDULED'}
                                canDelete={t => manage && t.status === 'SCHEDULED'}
                                defaults={TRIP_DEFAULTS}
                                addLabel="Schedule trip"
                                columns={[
                                    { key: 'when', header: 'Departure', render: t => <span className="font-medium">{dateTime(t.scheduled_at)}</span> },
                                    { key: 'route', header: 'Route', render: t => `${t.route?.name ?? '—'} · ${humanize(t.direction)}` },
                                    { key: 'bus', header: 'Vehicle', hideOnMobile: true, render: t => t.vehicle?.registration },
                                    { key: 'driver', header: 'Driver', hideOnMobile: true, render: t => t.driver?.full_name ?? '—' },
                                    { key: 'max', header: 'Top speed', hideOnMobile: true, numeric: true, render: t => (t.max_speed_kmh ? <span className={Number(t.max_speed_kmh) > 80 ? 'font-semibold text-destructive' : ''}>{Math.round(Number(t.max_speed_kmh))} km/h</span> : '—') },
                                    { key: 'status', header: 'Status', render: t => <StatusPill status={t.status} tones={TRIP_TONES} /> },
                                ]}
                            />
                        ),
                    },
                    {
                        id: 'routes', label: 'Routes', icon: RouteIcon, hue: 'sky', visible: viewer,
                        render: () => (
                            <ResourceManager<'routes', TransportRoute>
                                resource="routes"
                                fields={routeFields(vehicleOptions, driverOptions)}
                                canCreate={manage}
                                canEdit={manage}
                                canDelete={manage}
                                onRowClick={setOpenRoute}
                                columns={[
                                    { key: 'name', header: 'Route', render: r => <span className="font-medium">{r.name}</span> },
                                    { key: 'stops', header: 'Stops', numeric: true, render: r => r.stops[0]?.count ?? 0 },
                                    { key: 'riders', header: 'Learners', numeric: true, render: r => r.riders[0]?.count ?? 0 },
                                    { key: 'bus', header: 'Vehicle', hideOnMobile: true, render: r => r.vehicle?.registration ?? '—' },
                                    { key: 'fee', header: 'Fee / term', hideOnMobile: true, numeric: true, render: r => money(r.fee_per_term) },
                                ]}
                                emptyText="Add a route, then open it to add stops and learners."
                            />
                        ),
                    },
                    {
                        id: 'fleet', label: 'Vehicles', icon: Bus, hue: 'amber', visible: viewer,
                        render: () => (
                            <ResourceManager<'vehicles', Vehicle>
                                resource="vehicles"
                                fields={VEHICLE_FIELDS}
                                canCreate={manage}
                                canEdit={manage}
                                canDelete={manage}
                                defaults={VEHICLE_DEFAULTS}
                                columns={[
                                    { key: 'reg', header: 'Vehicle', render: v => <span className="font-medium">{v.registration}</span> },
                                    { key: 'seats', header: 'Seats', numeric: true, render: v => v.capacity },
                                    { key: 'status', header: 'Status', hideOnMobile: true, render: v => humanize(v.status) },
                                    { key: 'docs', header: 'NTSA documents', render: v => <ComplianceChips items={complianceOf(VEHICLE_DOCUMENTS, v)} /> },
                                ]}
                            />
                        ),
                    },
                    {
                        id: 'crew', label: 'Drivers & attendants', shortLabel: 'Crew', icon: IdCard, hue: 'rose', visible: viewer,
                        render: () => (
                            <ResourceManager<'transport-crew', Crew>
                                resource="transport-crew"
                                fields={CREW_FIELDS}
                                canCreate={manage}
                                canEdit={manage}
                                canDelete={manage}
                                defaults={CREW_DEFAULTS}
                                columns={[
                                    { key: 'name', header: 'Name', render: c => <span className="font-medium">{c.full_name}</span> },
                                    { key: 'role', header: 'Role', render: c => humanize(c.crew_role) },
                                    { key: 'login', header: 'Driver mode', hideOnMobile: true, render: c => (c.user_id ? 'Linked' : '—') },
                                    { key: 'docs', header: 'Documents', render: c => <ComplianceChips items={complianceOf(CREW_DOCUMENTS, c)} /> },
                                ]}
                            />
                        ),
                    },
                    {
                        id: 'logs', label: 'Fuel & service', shortLabel: 'Logs', icon: Fuel, hue: 'slate', visible: viewer,
                        render: () => (
                            <ResourceManager<'vehicle-logs', Log>
                                resource="vehicle-logs"
                                fields={logFields(vehicleOptions)}
                                canCreate={manage}
                                canEdit={manage}
                                canDelete={manage}
                                defaults={logDefaults()}
                                columns={[
                                    { key: 'date', header: 'Date', render: l => date(l.log_date) },
                                    { key: 'bus', header: 'Vehicle', render: l => <span className="font-medium">{l.vehicle?.registration}</span> },
                                    { key: 'type', header: 'Type', render: l => humanize(l.log_type) },
                                    { key: 'litres', header: 'Litres', hideOnMobile: true, numeric: true, render: l => l.litres ?? '—' },
                                    { key: 'cost', header: 'Cost', numeric: true, render: l => (l.cost != null ? money(l.cost) : '—') },
                                ]}
                            />
                        ),
                    },
                    { id: 'compliance', label: 'Compliance', icon: ShieldCheck, hue: 'teal', visible: viewer, render: () => <CompliancePanel /> },
                ]}
            />
            <Drawer isOpen={openRoute !== null} onClose={() => setOpenRoute(null)} title={openRoute?.name ?? ''} size="lg">
                {openRoute && <RouteDetail key={openRoute.id} route={openRoute} canManage={manage} />}
            </Drawer>
        </>
    );
}

