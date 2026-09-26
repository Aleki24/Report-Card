/**
 * Every resource the shared operations API serves, by URL name
 * (`/api/ops/<name>`). Adding a simple record type is a table, a definition
 * and a line here; the route, validation, scoping and audit come with it.
 */
import type { ResourceDef } from './resource';
import { userDuties } from './resources/core';
import {
    schoolEvents, rooms, timetableRequirements, timetableSubstitutions,
    schemesOfWork, lessonPlans, recordsOfWork,
} from './resources/academics';
import { voteHeads, feeStructures, feeStructureItems, feeAwards, suppliers, expenses } from './resources/finance';
import {
    dorms, dormAllocations, exeats, dormInspections,
    medicalProfiles, medicineStock, medicationLogs, disciplineIncidents,
} from './resources/welfare';
import {
    vehicles, transportCrew, transportRoutes, routeStops, studentTransport, trips, vehicleLogs,
    libraryBooks, libraryLoans, inventoryItems, storeRequisitions, leaveRequests,
} from './resources/operations';

export const RESOURCES = {
    'duties': userDuties,
    'events': schoolEvents,
    'rooms': rooms,
    'timetable-requirements': timetableRequirements,
    'substitutions': timetableSubstitutions,
    'schemes': schemesOfWork,
    'lesson-plans': lessonPlans,
    'records-of-work': recordsOfWork,
    'vote-heads': voteHeads,
    'fee-structures': feeStructures,
    'fee-structure-items': feeStructureItems,
    'fee-awards': feeAwards,
    'suppliers': suppliers,
    'expenses': expenses,
    'dorms': dorms,
    'dorm-allocations': dormAllocations,
    'exeats': exeats,
    'dorm-inspections': dormInspections,
    'medical-profiles': medicalProfiles,
    'medicine-stock': medicineStock,
    'medication-logs': medicationLogs,
    'discipline': disciplineIncidents,
    'vehicles': vehicles,
    'transport-crew': transportCrew,
    'routes': transportRoutes,
    'route-stops': routeStops,
    'riders': studentTransport,
    'trips': trips,
    'vehicle-logs': vehicleLogs,
    'books': libraryBooks,
    'loans': libraryLoans,
    'inventory': inventoryItems,
    'requisitions': storeRequisitions,
    'leave': leaveRequests,
} as const satisfies Record<string, ResourceDef>;

export type ResourceName = keyof typeof RESOURCES;

export function getResource(name: string): ResourceDef | undefined {
    return Object.hasOwn(RESOURCES, name) ? RESOURCES[name as ResourceName] : undefined;
}
