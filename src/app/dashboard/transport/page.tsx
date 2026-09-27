"use client";

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Bus, CalendarClock, Fuel, IdCard, Map as MapIcon, Navigation, Route as RouteIcon, ShieldCheck } from 'lucide-react';
import { Drawer } from '@/components/ui/Drawer';
import DataTable from '@/components/ui/DataTable';
import { useAuth } from '@/components/AuthProvider';
import { ModulePage } from '@/components/ops/ModulePage';
import { ResourceManager } from '@/components/ops/ResourceManager';
import { StatusPill, type PillTone } from '@/components/ops/StatusPill';
import type { FieldDef, FieldName } from '@/components/ops/fields';
import { LiveMap } from '@/components/transport/LiveMap';
import { DriverMode } from '@/components/transport/DriverMode';
import { useOpsList } from '@/hooks/useOpsList';
import { errorText, opsFetch } from '@/lib/ops/client';
import { admissionNo, date, dateTime, humanize, money, studentName } from '@/lib/ops/format';
import type { StudentEmbed } from '@/lib/ops/resource';
import { CREW_ROLES, RIDE_DIRECTIONS, TRIP_DIRECTIONS, VEHICLE_LOG_TYPES, VEHICLE_STATUSES, type TripStatus } from '@/lib/ops/resources/operations';
import { CREW_DOCUMENTS, VEHICLE_DOCUMENTS, complianceOf, type ComplianceItem, type ComplianceLevel } from '@/lib/transport/compliance';

interface Vehicle { id: string; registration: string; make_model: string | null; capacity: number; status: string; insurance_expiry: string | null; inspection_expiry: string | null; speed_governor_expiry: string | null; telematics_expiry: string | null }
interface Crew { id: string; full_name: string; phone: string | null; crew_role: string; user_id: string | null; licence_expiry: string | null; psv_badge_expiry: string | null; good_conduct_expiry: string | null; medical_expiry: string | null }
interface TransportRoute { id: string; name: string; fee_per_term: number; vehicle: { registration: string } | null; driver: { full_name: string } | null; stops: { count: number }[]; riders: { count: number }[] }
interface Stop { id: string; name: string; sequence: number; pickup_time: string | null; dropoff_time: string | null; lat: number | null; lng: number | null }
interface Rider { id: string; direction: string; stop: { name: string } | null; student: StudentEmbed | null }
interface Trip { id: string; direction: string; scheduled_at: string; status: TripStatus; started_at: string | null; ended_at: string | null; max_speed_kmh: number | null; route: { name: string } | null; vehicle: { registration: string } | null; driver: { full_name: string } | null }
interface Log { id: string; log_type: string; log_date: string; odometer: number | null; litres: number | null; cost: number | null; description: string | null; vehicle: { registration: string } | null }
interface Alert extends ComplianceItem { subject: string; kind: 'vehicle' | 'crew' }

const TRIP_TONES: Record<TripStatus, PillTone> = { SCHEDULED: 'neutral', IN_PROGRESS: 'info', COMPLETED: 'good', CANCELLED: 'bad' };
const LEVEL_TONES: Record<ComplianceLevel, PillTone> = { ok: 'good', due: 'warn', expired: 'bad', missing: 'neutral' };

function ComplianceChips({ items }: { items: ComplianceItem[] }) {
    const worst = items.filter(i => i.level !== 'ok');
    if (worst.length === 0) return <StatusPill status="ok" tones={LEVEL_TONES} label="All current" />;
    return (
        <span className="flex flex-wrap gap-1">
            {worst.map(i => <StatusPill key={i.label} status={i.level} tones={LEVEL_TONES} label={`${i.label}${i.level === 'due' ? ` · ${i.days}d` : i.level === 'expired' ? ' expired' : ' missing'}`} />)}
        </span>
    );
}

const VEHICLE_FIELDS: readonly FieldDef<FieldName<'vehicles'>>[] = [
    { name: 'registration', label: 'Registration', kind: 'text', required: true, placeholder: 'KDA 123A' },
    { name: 'make_model', label: 'Make & model', kind: 'text' },
    { name: 'capacity', label: 'Seats', kind: 'number', required: true },
    { name: 'status', label: 'Status', kind: 'enum', values: VEHICLE_STATUSES, required: true },
    ...Object.entries(VEHICLE_DOCUMENTS).map(([name, label]) => ({ name: name as FieldName<'vehicles'>, label: `${label} expiry`, kind: 'date' as const })),
    { name: 'notes', label: 'Notes', kind: 'textarea' },
];

const CREW_FIELDS: readonly FieldDef<FieldName<'transport-crew'>>[] = [
    { name: 'full_name', label: 'Full name', kind: 'text', required: true },
    { name: 'crew_role', label: 'Role', kind: 'enum', values: CREW_ROLES, required: true },
    { name: 'phone', label: 'Phone', kind: 'tel' },
    { name: 'user_id', label: 'Login (for driver mode)', kind: 'lookup', lookup: 'staff', hint: 'Give them the Driver duty in Settings too.' },
    { name: 'licence_number', label: 'Licence number', kind: 'text' },
    { name: 'licence_class', label: 'Licence class', kind: 'text' },
    ...Object.entries(CREW_DOCUMENTS).map(([name, label]) => ({ name: name as FieldName<'transport-crew'>, label: `${label} expiry`, kind: 'date' as const })),
];

function RouteDetail({ route, canManage }: { route: TransportRoute; canManage: boolean }) {
    const stops = useOpsList<Stop>('route-stops', { route_id: route.id });
    return (
        <div className="flex flex-col gap-8">
            <section>
                <h3 className="mb-3 text-sm font-semibold">Stops</h3>
                <ResourceManager<'route-stops', Stop>
                    resource="route-stops"
                    params={{ route_id: route.id }}
                    defaults={{ route_id: route.id, sequence: String((stops.rows.at(-1)?.sequence ?? 0) + 1) }}
                    fields={[
                        { name: 'route_id', label: 'Route', kind: 'hidden' },
                        { name: 'name', label: 'Stop', kind: 'text', required: true },
                        { name: 'sequence', label: 'Order', kind: 'number', required: true },
                        { name: 'pickup_time', label: 'Morning pick-up', kind: 'time' },
                        { name: 'dropoff_time', label: 'Evening drop-off', kind: 'time' },
                        { name: 'lat', label: 'Latitude', kind: 'number', step: 'any', hint: 'Optional: shows the stop on the live map.' },
                        { name: 'lng', label: 'Longitude', kind: 'number', step: 'any' },
                    ]}
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
                    defaults={{ route_id: route.id, direction: 'BOTH' }}
                    fields={[
                        { name: 'route_id', label: 'Route', kind: 'hidden' },
                        { name: 'student_id', label: 'Learner', kind: 'lookup', lookup: 'students', required: true, span: 'full' },
                        { name: 'stop_id', label: 'Stop', kind: 'options', options: stops.rows.map(s => ({ id: s.id, label: s.name })) },
                        { name: 'direction', label: 'Rides', kind: 'enum', values: RIDE_DIRECTIONS, required: true, labels: { BOTH: 'Morning and evening', MORNING: 'Morning only', EVENING: 'Evening only' } },
                    ]}
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
                { key: 'level', header: 'Status', render: a => <StatusPill status={a.level} tones={LEVEL_TONES} label={a.level === 'due' ? `Due in ${a.days} days` : humanize(a.level)} /> },
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
    const vehicleOptions = vehicles.rows.map(v => ({ id: v.id, label: v.registration }));
    const driverOptions = crew.rows.filter(c => c.crew_role === 'DRIVER').map(c => ({ id: c.id, label: c.full_name }));

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
                                fields={[
                                    { name: 'route_id', label: 'Route', kind: 'options', options: routes.rows.map(r => ({ id: r.id, label: r.name })) },
                                    { name: 'vehicle_id', label: 'Vehicle', kind: 'options', options: vehicleOptions, required: true },
                                    { name: 'driver_id', label: 'Driver', kind: 'options', options: driverOptions },
                                    { name: 'direction', label: 'Run', kind: 'enum', values: TRIP_DIRECTIONS, required: true },
                                    { name: 'scheduled_at', label: 'Departure', kind: 'datetime', required: true },
                                    { name: 'notes', label: 'Notes', kind: 'textarea' },
                                ]}
                                canCreate={manage}
                                canEdit={t => manage && t.status === 'SCHEDULED'}
                                canDelete={t => manage && t.status === 'SCHEDULED'}
                                defaults={{ direction: 'MORNING' }}
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
                                fields={[
                                    { name: 'name', label: 'Route name', kind: 'text', required: true },
                                    { name: 'fee_per_term', label: 'Fee per term (KES)', kind: 'number', hint: 'Added to invoices when the term is billed.' },
                                    { name: 'vehicle_id', label: 'Usual vehicle', kind: 'options', options: vehicleOptions },
                                    { name: 'driver_id', label: 'Usual driver', kind: 'options', options: driverOptions },
                                    { name: 'description', label: 'Description', kind: 'textarea' },
                                ]}
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
                                defaults={{ status: 'ACTIVE' }}
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
                                defaults={{ crew_role: 'DRIVER' }}
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
                                fields={[
                                    { name: 'vehicle_id', label: 'Vehicle', kind: 'options', options: vehicleOptions, required: true },
                                    { name: 'log_type', label: 'Type', kind: 'enum', values: VEHICLE_LOG_TYPES, required: true },
                                    { name: 'log_date', label: 'Date', kind: 'date', required: true },
                                    { name: 'odometer', label: 'Odometer', kind: 'number' },
                                    { name: 'litres', label: 'Litres', kind: 'number' },
                                    { name: 'cost', label: 'Cost (KES)', kind: 'number' },
                                    { name: 'description', label: 'Details', kind: 'textarea' },
                                ]}
                                canCreate={manage}
                                canEdit={manage}
                                canDelete={manage}
                                defaults={{ log_type: 'FUEL', log_date: new Date().toISOString().slice(0, 10) }}
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

