/**
 * Transport: the row shapes, status colours, form fields and driver-mode
 * rules the web pages and the mobile screens share.
 */
import type { FieldDef, FieldName } from '../form';
import type { LookupOption } from '../lookups';
import type { StudentEmbed } from '../resource';
import type { PillTone } from '../tones';
import { today } from '../format';
import { CREW_ROLES, RIDE_DIRECTIONS, TRIP_DIRECTIONS, VEHICLE_LOG_TYPES, VEHICLE_STATUSES, type TripStatus } from '../resources/operations';
import { CREW_DOCUMENTS, VEHICLE_DOCUMENTS, type ComplianceItem, type ComplianceLevel } from '../../transport/compliance';

export interface Vehicle { id: string; registration: string; make_model: string | null; capacity: number; status: string; insurance_expiry: string | null; inspection_expiry: string | null; speed_governor_expiry: string | null; telematics_expiry: string | null }
export interface Crew { id: string; full_name: string; phone: string | null; crew_role: string; user_id: string | null; licence_expiry: string | null; psv_badge_expiry: string | null; good_conduct_expiry: string | null; medical_expiry: string | null }
export interface TransportRoute { id: string; name: string; fee_per_term: number; vehicle: { registration: string } | null; driver: { full_name: string } | null; stops: { count: number }[]; riders: { count: number }[] }
export interface Stop { id: string; name: string; sequence: number; pickup_time: string | null; dropoff_time: string | null; lat: number | null; lng: number | null }
export interface Rider { id: string; direction: string; stop: { name: string } | null; student: StudentEmbed | null }
export interface Trip { id: string; direction: string; scheduled_at: string; status: TripStatus; started_at: string | null; ended_at: string | null; max_speed_kmh: number | null; route: { name: string } | null; vehicle: { registration: string } | null; driver: { full_name: string } | null }
export interface VehicleLog { id: string; log_type: string; log_date: string; odometer: number | null; litres: number | null; cost: number | null; description: string | null; vehicle: { registration: string } | null }
export interface ComplianceAlert extends ComplianceItem { subject: string; kind: 'vehicle' | 'crew' }

export const TRIP_TONES: Record<TripStatus, PillTone> = { SCHEDULED: 'neutral', IN_PROGRESS: 'info', COMPLETED: 'good', CANCELLED: 'bad' };
export const LEVEL_TONES: Record<ComplianceLevel, PillTone> = { ok: 'good', due: 'warn', expired: 'bad', missing: 'neutral' };

/** A document's chip text: "Insurance · 12d", "PSV badge expired". */
export const complianceChipLabel = (i: ComplianceItem) => `${i.label}${i.level === 'due' ? ` · ${i.days}d` : i.level === 'expired' ? ' expired' : ' missing'}`;
export const complianceLevelLabel = (a: ComplianceItem) => (a.level === 'due' ? `Due in ${a.days} days` : undefined);

export const VEHICLE_FIELDS: readonly FieldDef<FieldName<'vehicles'>>[] = [
    { name: 'registration', label: 'Registration', kind: 'text', required: true, placeholder: 'KDA 123A' },
    { name: 'make_model', label: 'Make & model', kind: 'text' },
    { name: 'capacity', label: 'Seats', kind: 'number', required: true },
    { name: 'status', label: 'Status', kind: 'enum', values: VEHICLE_STATUSES, required: true },
    ...Object.entries(VEHICLE_DOCUMENTS).map(([name, label]) => ({ name: name as FieldName<'vehicles'>, label: `${label} expiry`, kind: 'date' as const })),
    { name: 'notes', label: 'Notes', kind: 'textarea' },
];
export const VEHICLE_DEFAULTS = { status: 'ACTIVE' } as const;

export const CREW_FIELDS: readonly FieldDef<FieldName<'transport-crew'>>[] = [
    { name: 'full_name', label: 'Full name', kind: 'text', required: true },
    { name: 'crew_role', label: 'Role', kind: 'enum', values: CREW_ROLES, required: true },
    { name: 'phone', label: 'Phone', kind: 'tel' },
    { name: 'user_id', label: 'Login (for driver mode)', kind: 'lookup', lookup: 'staff', hint: 'Give them the Driver duty in Settings too.' },
    { name: 'licence_number', label: 'Licence number', kind: 'text' },
    { name: 'licence_class', label: 'Licence class', kind: 'text' },
    ...Object.entries(CREW_DOCUMENTS).map(([name, label]) => ({ name: name as FieldName<'transport-crew'>, label: `${label} expiry`, kind: 'date' as const })),
];
export const CREW_DEFAULTS = { crew_role: 'DRIVER' } as const;

export const vehicleOptions = (vehicles: readonly Vehicle[]): LookupOption[] => vehicles.map(v => ({ id: v.id, label: v.registration }));
export const driverOptions = (crew: readonly Crew[]): LookupOption[] => crew.filter(c => c.crew_role === 'DRIVER').map(c => ({ id: c.id, label: c.full_name }));

export const tripFields = (routes: readonly { id: string; name: string }[], vehicles: readonly LookupOption[], drivers: readonly LookupOption[]): readonly FieldDef<FieldName<'trips'>>[] => [
    { name: 'route_id', label: 'Route', kind: 'options', options: routes.map(r => ({ id: r.id, label: r.name })) },
    { name: 'vehicle_id', label: 'Vehicle', kind: 'options', options: vehicles, required: true },
    { name: 'driver_id', label: 'Driver', kind: 'options', options: drivers },
    { name: 'direction', label: 'Run', kind: 'enum', values: TRIP_DIRECTIONS, required: true },
    { name: 'scheduled_at', label: 'Departure', kind: 'datetime', required: true },
    { name: 'notes', label: 'Notes', kind: 'textarea' },
];
export const TRIP_DEFAULTS = { direction: 'MORNING' } as const;

export const routeFields = (vehicles: readonly LookupOption[], drivers: readonly LookupOption[]): readonly FieldDef<FieldName<'routes'>>[] => [
    { name: 'name', label: 'Route name', kind: 'text', required: true },
    { name: 'fee_per_term', label: 'Fee per term (KES)', kind: 'number', hint: 'Added to invoices when the term is billed.' },
    { name: 'vehicle_id', label: 'Usual vehicle', kind: 'options', options: vehicles },
    { name: 'driver_id', label: 'Usual driver', kind: 'options', options: drivers },
    { name: 'description', label: 'Description', kind: 'textarea' },
];

export const STOP_FIELDS: readonly FieldDef<FieldName<'route-stops'>>[] = [
    { name: 'route_id', label: 'Route', kind: 'hidden' },
    { name: 'name', label: 'Stop', kind: 'text', required: true },
    { name: 'sequence', label: 'Order', kind: 'number', required: true },
    { name: 'pickup_time', label: 'Morning pick-up', kind: 'time' },
    { name: 'dropoff_time', label: 'Evening drop-off', kind: 'time' },
    { name: 'lat', label: 'Latitude', kind: 'number', step: 'any', hint: 'Optional: shows the stop on the live map.' },
    { name: 'lng', label: 'Longitude', kind: 'number', step: 'any' },
];
/** New stops go after the last one. */
export const stopDefaults = (routeId: string, stops: readonly Stop[]) => ({ route_id: routeId, sequence: String((stops.at(-1)?.sequence ?? 0) + 1) });

export const RIDE_DIRECTION_LABELS: Record<(typeof RIDE_DIRECTIONS)[number], string> = { BOTH: 'Morning and evening', MORNING: 'Morning only', EVENING: 'Evening only' };

export const riderFields = (stops: readonly Stop[]): readonly FieldDef<FieldName<'riders'>>[] => [
    { name: 'route_id', label: 'Route', kind: 'hidden' },
    { name: 'student_id', label: 'Learner', kind: 'lookup', lookup: 'students', required: true, span: 'full' },
    { name: 'stop_id', label: 'Stop', kind: 'options', options: stops.map(s => ({ id: s.id, label: s.name })) },
    { name: 'direction', label: 'Rides', kind: 'enum', values: RIDE_DIRECTIONS, required: true, labels: RIDE_DIRECTION_LABELS },
];
export const riderDefaults = (routeId: string) => ({ route_id: routeId, direction: 'BOTH' });

export const logFields = (vehicles: readonly LookupOption[]): readonly FieldDef<FieldName<'vehicle-logs'>>[] => [
    { name: 'vehicle_id', label: 'Vehicle', kind: 'options', options: vehicles, required: true },
    { name: 'log_type', label: 'Type', kind: 'enum', values: VEHICLE_LOG_TYPES, required: true },
    { name: 'log_date', label: 'Date', kind: 'date', required: true },
    { name: 'odometer', label: 'Odometer', kind: 'number' },
    { name: 'litres', label: 'Litres', kind: 'number' },
    { name: 'cost', label: 'Cost (KES)', kind: 'number' },
    { name: 'description', label: 'Details', kind: 'textarea' },
];
export const logDefaults = () => ({ log_type: 'FUEL', log_date: today() });

// ── Driver mode ──────────────────────────────────────────────

export interface MyTrip { id: string; direction: string; scheduled_at: string; status: 'SCHEDULED' | 'IN_PROGRESS'; route: { name: string } | null; vehicle: { registration: string } | null }
export interface TripRider { student_id: string; stop: { name: string; sequence: number; pickup_time: string | null } | null; student: StudentEmbed | null }
export type BoardEvent = 'BOARDED' | 'ALIGHTED' | 'ABSENT';
export interface TripRiders { riders: TripRider[]; events: { student_id: string; event: BoardEvent }[] }
/** One GPS fix as the positions endpoint takes it. */
export interface Fix { lat: number; lng: number; speed_kmh: number | null; heading: number | null; accuracy_m: number | null; recorded_at: string }

/** How often queued fixes are sent. */
export const FLUSH_MS = 15_000;
/** Fixes per upload. */
export const FLUSH_BATCH = 500;
/** Fixes kept on the phone while offline. */
export const QUEUE_LIMIT = 5000;
export const gpsQueueKey = (tripId: string) => `trip-gps-queue:${tripId}`;

/** A position from the phone's GPS (speed in m/s) as a fix to upload. */
export function toFix(p: { latitude: number; longitude: number; speed: number | null; heading: number | null; accuracy: number | null }, timestamp: number): Fix {
    return {
        lat: p.latitude,
        lng: p.longitude,
        speed_kmh: p.speed != null && p.speed >= 0 ? Math.round(p.speed * 3.6 * 10) / 10 : null,
        heading: p.heading != null && !Number.isNaN(p.heading) && p.heading >= 0 ? p.heading : null,
        accuracy_m: p.accuracy ?? null,
        recorded_at: new Date(timestamp).toISOString(),
    };
}

/** Riders in stop order. */
export const byStop = (riders: readonly TripRider[]) => [...riders].sort((a, b) => (a.stop?.sequence ?? 999) - (b.stop?.sequence ?? 999));
