import { z } from 'zod';
import { defineResource, STUDENT_JOIN, personJoin } from '../resource';
import {
    text, optionalText, isoDate, optionalDate, uuid, optionalUuid, oneOf, count, optionalCount,
    money, optionalMoney, personId, optionalPersonId, isoDateTime, optionalTime, decimal,
} from '../zod-fields';

// ── Transport ────────────────────────────────────────────────

export const VEHICLE_STATUSES = ['ACTIVE', 'MAINTENANCE', 'RETIRED'] as const;
export const CREW_ROLES = ['DRIVER', 'ATTENDANT'] as const;
export const TRIP_DIRECTIONS = ['MORNING', 'EVENING', 'OTHER'] as const;
export const TRIP_STATUSES = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];
export const RIDE_DIRECTIONS = ['BOTH', 'MORNING', 'EVENING'] as const;
export const VEHICLE_LOG_TYPES = ['FUEL', 'SERVICE', 'REPAIR', 'INSPECTION', 'OTHER'] as const;

const optionalCoordinate = (limit: number) =>
    z.preprocess(v => (v === '' || v === undefined ? null : typeof v === 'string' ? Number(v) : v), z.number().min(-limit).max(limit).nullable()).optional();

export const vehicles = defineResource({
    table: 'vehicles',
    module: 'transport',
    label: { singular: 'Vehicle', plural: 'Vehicles' },
    read: ['transport.view', 'transport.drive'],
    write: ['transport.manage'],
    schema: z.object({
        registration: text(20).transform(v => v.toUpperCase()),
        make_model: optionalText(100),
        capacity: count(200).pipe(z.number().min(1, 'At least one seat')),
        status: oneOf(VEHICLE_STATUSES).default('ACTIVE'),
        insurance_expiry: optionalDate,
        inspection_expiry: optionalDate,
        speed_governor_expiry: optionalDate,
        telematics_expiry: optionalDate,
        notes: optionalText(1000),
    }),
    order: { column: 'registration' },
    audit: true,
});

export const transportCrew = defineResource({
    table: 'transport_crew',
    module: 'transport',
    label: { singular: 'Crew member', plural: 'Drivers & attendants' },
    read: ['transport.view', 'transport.drive'],
    write: ['transport.manage'],
    schema: z.object({
        full_name: text(150),
        user_id: optionalPersonId,
        phone: optionalText(30),
        crew_role: oneOf(CREW_ROLES).default('DRIVER'),
        licence_number: optionalText(40),
        licence_class: optionalText(20),
        licence_expiry: optionalDate,
        psv_badge_expiry: optionalDate,
        good_conduct_expiry: optionalDate,
        medical_expiry: optionalDate,
    }),
    order: { column: 'full_name' },
    userRefs: ['user_id'],
    audit: true,
});

export const transportRoutes = defineResource({
    table: 'transport_routes',
    module: 'transport',
    label: { singular: 'Route', plural: 'Routes' },
    read: ['transport.view', 'transport.drive'],
    write: ['transport.manage'],
    schema: z.object({
        name: text(120),
        vehicle_id: optionalUuid,
        driver_id: optionalUuid,
        fee_per_term: money.default(0),
        description: optionalText(1000),
    }),
    select: '*, vehicle:vehicles(registration), driver:transport_crew(full_name), stops:route_stops(count), riders:student_transport(count)',
    order: { column: 'name' },
    refs: { vehicle_id: 'vehicles', driver_id: 'transport_crew' },
});

export const routeStops = defineResource({
    table: 'route_stops',
    module: 'transport',
    label: { singular: 'Stop', plural: 'Stops' },
    read: ['transport.view', 'transport.drive'],
    write: ['transport.manage'],
    schema: z.object({
        route_id: uuid,
        name: text(120),
        sequence: count(200).default(1),
        pickup_time: optionalTime,
        dropoff_time: optionalTime,
        lat: optionalCoordinate(90),
        lng: optionalCoordinate(180),
    }),
    select: '*, route:transport_routes(name)',
    order: { column: 'sequence' },
    filters: ['route_id'],
    refs: { route_id: 'transport_routes' },
});

export const studentTransport = defineResource({
    table: 'student_transport',
    module: 'transport',
    label: { singular: 'Rider', plural: 'Riders' },
    read: ['transport.view', 'transport.drive'],
    write: ['transport.manage'],
    schema: z.object({
        student_id: personId,
        route_id: uuid,
        stop_id: optionalUuid,
        direction: oneOf(RIDE_DIRECTIONS).default('BOTH'),
    }),
    select: `*, route:transport_routes(name), stop:route_stops(name, pickup_time), ${STUDENT_JOIN}`,
    order: { column: 'created_at', ascending: false },
    filters: ['route_id', 'stop_id', 'student_id'],
    refs: { student_id: 'students', route_id: 'transport_routes', stop_id: 'route_stops' },
    maxRows: 5000,
});

export const trips = defineResource({
    table: 'trips',
    module: 'transport',
    label: { singular: 'Trip', plural: 'Trips' },
    read: ['transport.view', 'transport.drive'],
    write: ['transport.manage'],
    schema: z.object({
        route_id: optionalUuid,
        vehicle_id: uuid,
        driver_id: optionalUuid,
        direction: oneOf(TRIP_DIRECTIONS).default('MORNING'),
        scheduled_at: isoDateTime,
        notes: optionalText(1000),
    }),
    select: '*, route:transport_routes(name), vehicle:vehicles(registration, capacity), driver:transport_crew(full_name, phone, user_id)',
    order: { column: 'scheduled_at', ascending: false },
    filters: ['status', 'vehicle_id', 'route_id', 'driver_id'],
    refs: { route_id: 'transport_routes', vehicle_id: 'vehicles', driver_id: 'transport_crew' },
    maxRows: 500,
});

export const vehicleLogs = defineResource({
    table: 'vehicle_logs',
    module: 'transport',
    label: { singular: 'Log entry', plural: 'Fuel & service log' },
    read: ['transport.view'],
    write: ['transport.manage'],
    schema: z.object({
        vehicle_id: uuid,
        log_type: oneOf(VEHICLE_LOG_TYPES),
        log_date: isoDate,
        odometer: optionalCount(5_000_000),
        litres: optionalMoney,
        cost: optionalMoney,
        description: optionalText(1000),
    }),
    select: '*, vehicle:vehicles(registration)',
    order: { column: 'log_date', ascending: false },
    filters: ['vehicle_id', 'log_type'],
    refs: { vehicle_id: 'vehicles' },
    createdByColumn: 'created_by',
});

// ── Library ──────────────────────────────────────────────────

export const libraryBooks = defineResource({
    table: 'library_books',
    module: 'library',
    label: { singular: 'Book', plural: 'Books' },
    read: ['library.view'],
    write: ['library.manage'],
    schema: z.object({
        title: text(300),
        author: optionalText(200),
        isbn: optionalText(20),
        category: optionalText(100),
        shelf: optionalText(50),
        copies_total: count(10_000).default(1),
    }),
    order: { column: 'title' },
    filters: ['category'],
    maxRows: 10_000,
});

export const libraryLoans = defineResource({
    table: 'library_loans',
    module: 'library',
    label: { singular: 'Loan', plural: 'Loans' },
    read: ['library.manage'],
    write: ['library.manage'],
    schema: z.object({
        book_id: uuid,
        borrower_id: personId,
        issued_on: isoDate,
        due_on: isoDate,
        returned_on: optionalDate,
        fine_amount: money.default(0),
    }),
    validate: v => (String(v.due_on) < String(v.issued_on) ? 'The due date must not be before the issue date.' : null),
    select: `*, book:library_books(title, author), ${personJoin('borrower', 'library_loans', 'borrower_id')}`,
    order: { column: 'issued_on', ascending: false },
    filters: ['book_id', 'borrower_id'],
    flags: { open: { column: 'returned_on', isNull: true } },
    refs: { book_id: 'library_books' },
    userRefs: ['borrower_id'],
    createdByColumn: 'issued_by',
    maxRows: 5000,
});

// ── Inventory ────────────────────────────────────────────────

export const ITEM_TYPES = ['ASSET', 'CONSUMABLE'] as const;
export const REQUISITION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'ISSUED'] as const;
export type RequisitionStatus = (typeof REQUISITION_STATUSES)[number];

export const inventoryItems = defineResource({
    table: 'inventory_items',
    module: 'inventory',
    label: { singular: 'Item', plural: 'Inventory' },
    read: ['inventory.request', 'inventory.manage'],
    write: ['inventory.manage'],
    schema: z.object({
        name: text(200),
        item_type: oneOf(ITEM_TYPES).default('CONSUMABLE'),
        category: optionalText(100),
        unit: text(30).default('pcs'),
        quantity: decimal(0, 1e9),
        reorder_level: decimal(0, 1e9).default(0),
        location: optionalText(100),
        serial_number: optionalText(100),
        unit_value: optionalMoney,
    }),
    order: { column: 'name' },
    filters: ['item_type', 'category'],
    audit: true,
    maxRows: 5000,
});

export const storeRequisitions = defineResource({
    table: 'store_requisitions',
    module: 'inventory',
    label: { singular: 'Requisition', plural: 'Requisitions' },
    read: ['inventory.manage'],
    write: [],
    schema: z.object({
        item_id: uuid,
        quantity: decimal(0.01, 1e9),
        purpose: optionalText(500),
    }),
    select: `*, item:inventory_items(name, unit, quantity), ${personJoin('requester', 'store_requisitions', 'requested_by')}`,
    order: { column: 'created_at', ascending: false },
    filters: ['status', 'item_id'],
    refs: { item_id: 'inventory_items' },
    own: { column: 'requested_by', permission: 'inventory.request', editableWhile: { column: 'status', values: ['PENDING'] } },
});

// ── Staff leave ──────────────────────────────────────────────

export const LEAVE_TYPES = ['ANNUAL', 'SICK', 'MATERNITY', 'PATERNITY', 'COMPASSIONATE', 'STUDY', 'OTHER'] as const;
export const LEAVE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

export const leaveRequests = defineResource({
    table: 'leave_requests',
    module: 'staff_hr',
    label: { singular: 'Leave request', plural: 'Leave requests' },
    read: ['hr.manage'],
    write: [],
    schema: z.object({
        leave_type: oneOf(LEAVE_TYPES).default('ANNUAL'),
        starts_on: isoDate,
        ends_on: isoDate,
        reason: optionalText(1000),
        cover_notes: optionalText(1000),
    }),
    validate: v => (String(v.ends_on) < String(v.starts_on) ? 'The last day must not be before the first.' : null),
    select: `*, ${personJoin('staff', 'leave_requests', 'staff_id')}, ${personJoin('decider', 'leave_requests', 'decided_by')}`,
    order: { column: 'starts_on', ascending: false },
    filters: ['status', 'staff_id'],
    own: { column: 'staff_id', permission: 'hr.request', editableWhile: { column: 'status', values: ['PENDING'] } },
});
