/**
 * NTSA compliance: every date that must be current for a school vehicle or
 * crew member to run a trip. Client-safe, so the fleet pages and the trip
 * start check share one list.
 */
import { daysUntil } from '../ops/format';

export const VEHICLE_DOCUMENTS = {
    insurance_expiry: 'Insurance',
    inspection_expiry: 'NTSA inspection',
    speed_governor_expiry: 'Speed governor',
    telematics_expiry: 'Telematics (KEBS)',
} as const;

export const CREW_DOCUMENTS = {
    licence_expiry: 'Driving licence',
    psv_badge_expiry: 'PSV badge',
    good_conduct_expiry: 'Certificate of good conduct',
    medical_expiry: 'Medical certificate',
} as const;

/** Days before expiry at which a reminder starts showing. */
export const WARN_DAYS = 30;

export type ComplianceLevel = 'ok' | 'due' | 'expired' | 'missing';

export interface ComplianceItem { label: string; date: string | null; level: ComplianceLevel; days: number | null }

export function complianceOf<K extends string>(docs: Readonly<Record<K, string>>, row: Partial<Record<NoInfer<K>, string | null>>): ComplianceItem[] {
    return (Object.keys(docs) as K[]).map(key => {
        const value = row[key] ?? null;
        const days = daysUntil(value);
        const level: ComplianceLevel = days === null ? 'missing' : days < 0 ? 'expired' : days <= WARN_DAYS ? 'due' : 'ok';
        return { label: docs[key], date: value, level, days };
    });
}

/** Expired documents block a trip; missing ones are warned about but not blocking. */
export const blocking = (items: readonly ComplianceItem[]) => items.filter(i => i.level === 'expired');

/** Kenya's school bus limit (km/h). */
export const SPEED_LIMIT_KMH = 80;
/** A live bus that has not reported for this long is flagged. */
export const STALE_AFTER_MS = 3 * 60_000;
/** School transport may only run between these hours (local time). */
export const OPERATING_HOURS = { from: 5, to: 22 } as const;
