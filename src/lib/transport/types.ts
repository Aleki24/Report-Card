/** Shapes the transport API returns, shared with the pages. */

/** A running trip on the live map. */
export interface LiveTrip {
    id: string; direction: string; started_at: string | null;
    last_lat: number | null; last_lng: number | null; last_speed_kmh: number | null; last_seen_at: string | null; max_speed_kmh: number | null;
    vehicle: { registration: string } | null; route: { name: string } | null; driver: { full_name: string; phone: string | null } | null;
    path: [number, number][];
    stops: { name: string; lat: number | null; lng: number | null; sequence: number }[];
    alerts: string[];
}
