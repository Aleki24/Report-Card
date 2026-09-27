"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { MapPin, Play, Square, UserCheck, UserMinus, UserX, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormField, InputField } from '@/components/ui/FormField';
import { useAuth } from '@/components/AuthProvider';
import { errorText, opsFetch } from '@/lib/ops/client';
import { dateTime, humanize, studentName } from '@/lib/ops/format';
import type { StudentEmbed } from '@/lib/ops/resource';
import { SPEED_LIMIT_KMH } from '@/lib/transport/compliance';
import { cn } from '@/lib/utils';

interface MyTrip { id: string; direction: string; scheduled_at: string; status: 'SCHEDULED' | 'IN_PROGRESS'; route: { name: string } | null; vehicle: { registration: string } | null }
interface Rider { student_id: string; stop: { name: string; sequence: number; pickup_time: string | null } | null; student: StudentEmbed | null }
type BoardEvent = 'BOARDED' | 'ALIGHTED' | 'ABSENT';
interface Fix { lat: number; lng: number; speed_kmh: number | null; heading: number | null; accuracy_m: number | null; recorded_at: string }

const FLUSH_MS = 15_000;
const queueKey = (tripId: string) => `trip-gps-queue:${tripId}`;

/** Fixes waiting to upload survive a reload or a dead network. */
function readQueue(tripId: string): Fix[] {
    try { return JSON.parse(localStorage.getItem(queueKey(tripId)) ?? '[]') as Fix[]; } catch { return []; }
}
function writeQueue(tripId: string, fixes: Fix[]) {
    try { localStorage.setItem(queueKey(tripId), JSON.stringify(fixes.slice(-5000))); } catch { /* storage full or blocked: keep in memory only */ }
}

/**
 * The driver's phone screen: pick today's trip, start it (NTSA checks run on
 * the server), share location while it runs (queued offline), tick learners
 * on and off, and end it.
 */
export function DriverMode() {
    const { hasModule } = useAuth();
    const tracking = hasModule('transport_tracking');
    const [trips, setTrips] = useState<MyTrip[]>([]);
    const [active, setActive] = useState<MyTrip | null>(null);
    const [odometer, setOdometer] = useState('');
    const [riders, setRiders] = useState<Rider[]>([]);
    const [events, setEvents] = useState<Map<string, BoardEvent>>(new Map());
    const [queued, setQueued] = useState(0);
    const [lastFix, setLastFix] = useState<Fix | null>(null);
    const [online, setOnline] = useState(true);
    const [busy, setBusy] = useState(false);
    const watchRef = useRef<number | null>(null);
    const wakeRef = useRef<{ release: () => Promise<void> } | null>(null);

    const loadTrips = useCallback(async () => {
        try {
            const t = await opsFetch<MyTrip[]>('/api/transport/my-trips');
            setTrips(t);
            setActive(a => a ?? t.find(x => x.status === 'IN_PROGRESS') ?? null);
        } catch (err) { toast.error(errorText(err)); }
    }, []);
    useEffect(() => { void loadTrips(); }, [loadTrips]);

    const loadRiders = useCallback(async (tripId: string) => {
        try {
            const r = await opsFetch<{ riders: Rider[]; events: { student_id: string; event: BoardEvent }[] }>(`/api/transport/trips/${tripId}/riders`);
            setRiders([...r.riders].sort((a, b) => (a.stop?.sequence ?? 999) - (b.stop?.sequence ?? 999)));
            setEvents(new Map(r.events.map(e => [e.student_id, e.event])));
        } catch (err) { toast.error(errorText(err)); }
    }, []);

    const flush = useCallback(async (tripId: string) => {
        const pending = readQueue(tripId);
        setQueued(pending.length);
        if (pending.length === 0) return;
        try {
            const batch = pending.slice(0, 500);
            await opsFetch(`/api/transport/trips/${tripId}/positions`, { method: 'POST', json: { points: batch } });
            const rest = readQueue(tripId).slice(batch.length);
            writeQueue(tripId, rest);
            setQueued(rest.length);
            setOnline(true);
        } catch {
            setOnline(false);
        }
    }, []);

    const stopTracking = useCallback(() => {
        if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
        void wakeRef.current?.release().catch(() => undefined);
        wakeRef.current = null;
    }, []);

    // While a trip runs: rider list, GPS watch, periodic upload, screen kept awake.
    useEffect(() => {
        if (!active || active.status !== 'IN_PROGRESS') return;
        void loadRiders(active.id);
        if (!tracking) return;
        if (!('geolocation' in navigator)) { toast.error('This phone cannot share its location.'); return; }
        watchRef.current = navigator.geolocation.watchPosition(pos => {
            const fix: Fix = {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                speed_kmh: pos.coords.speed != null ? Math.round(pos.coords.speed * 3.6 * 10) / 10 : null,
                heading: pos.coords.heading != null && !Number.isNaN(pos.coords.heading) ? pos.coords.heading : null,
                accuracy_m: pos.coords.accuracy ?? null,
                recorded_at: new Date(pos.timestamp).toISOString(),
            };
            writeQueue(active.id, [...readQueue(active.id), fix]);
            setLastFix(fix);
            setQueued(q => q + 1);
        }, err => toast.error(`Location: ${err.message}`), { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
        const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
        nav.wakeLock?.request('screen').then(l => { wakeRef.current = l; }).catch(() => undefined);
        const timer = setInterval(() => void flush(active.id), FLUSH_MS);
        return () => { clearInterval(timer); stopTracking(); };
    }, [active, tracking, flush, loadRiders, stopTracking]);

    const start = async (trip: MyTrip) => {
        setBusy(true);
        try {
            await opsFetch(`/api/transport/trips/${trip.id}/start`, { method: 'POST', json: odometer ? { odometer: Number(odometer) } : {} });
            toast.success('Trip started. Keep this screen open.');
            setOdometer('');
            setActive({ ...trip, status: 'IN_PROGRESS' });
        } catch (err) { toast.error(errorText(err)); }
        finally { setBusy(false); }
    };

    const end = async () => {
        if (!active) return;
        setBusy(true);
        try {
            await flush(active.id);
            await opsFetch(`/api/transport/trips/${active.id}/end`, { method: 'POST', json: odometer ? { odometer: Number(odometer) } : {} });
            stopTracking();
            toast.success('Trip ended.');
            setActive(null);
            setRiders([]);
            setOdometer('');
            await loadTrips();
        } catch (err) { toast.error(errorText(err)); }
        finally { setBusy(false); }
    };

    const board = async (studentId: string, event: BoardEvent) => {
        if (!active) return;
        try {
            const r = await opsFetch<{ notified: boolean }>(`/api/transport/trips/${active.id}/boarding`, { method: 'POST', json: { student_id: studentId, event } });
            setEvents(m => new Map(m).set(studentId, event));
            if (!r.notified) toast.message('Recorded (no guardian phone on file).');
        } catch (err) { toast.error(errorText(err)); }
    };

    if (!active || active.status !== 'IN_PROGRESS') {
        return (
            <div className="flex flex-col gap-4">
                {trips.length === 0 ? (
                    <p className="rounded-2xl border border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">No trips assigned to you right now. Ask the transport manager to schedule one and link your account under Crew.</p>
                ) : (
                    <>
                        <FormField label="Odometer at start (optional)" htmlFor="odo-start" className="max-w-xs">
                            <InputField id="odo-start" type="number" inputMode="numeric" value={odometer} onChange={e => setOdometer(e.target.value)} />
                        </FormField>
                        <ul className="flex flex-col gap-3">
                            {trips.map(t => (
                                <li key={t.id} className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:flex-row sm:items-center">
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold">{t.vehicle?.registration} · {t.route?.name ?? 'No route'}</p>
                                        <p className="text-sm text-muted-foreground">{humanize(t.direction)} · {dateTime(t.scheduled_at)}</p>
                                    </div>
                                    <Button size="lg" onClick={() => void start(t)} disabled={busy}><Play />Start trip</Button>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </div>
        );
    }

    const speeding = (lastFix?.speed_kmh ?? 0) > SPEED_LIMIT_KMH;

    return (
        <div className="flex flex-col gap-4">
            <section className={cn('flex flex-col gap-2 rounded-2xl border p-4 shadow-sm', speeding ? 'border-destructive bg-destructive/10' : 'border-emerald-500/40 bg-emerald-500/5')}>
                <p className="text-lg font-bold">{active.vehicle?.registration} · {active.route?.name ?? 'No route'}</p>
                {tracking ? (
                    <p className="flex flex-wrap items-center gap-3 text-sm">
                        <span className="flex items-center gap-1">{online ? <Wifi className="size-4 text-emerald-600" aria-hidden /> : <WifiOff className="size-4 text-amber-600" aria-hidden />}{online ? 'Sharing location' : 'Offline — saving locations to send later'}</span>
                        <span className="flex items-center gap-1"><MapPin className="size-4" aria-hidden />{lastFix ? `${Math.round(lastFix.speed_kmh ?? 0)} km/h` : 'Waiting for GPS…'}</span>
                        {queued > 0 && <span className="text-muted-foreground">{queued} waiting to upload</span>}
                    </p>
                ) : <p className="text-sm text-muted-foreground">Live tracking is switched off for your school.</p>}
                {speeding && <p className="text-sm font-bold text-destructive">Slow down: the limit for school buses is {SPEED_LIMIT_KMH} km/h.</p>}
            </section>

            <section>
                <h2 className="mb-2 text-sm font-semibold">Learners ({[...events.values()].filter(e => e === 'BOARDED').length} on board)</h2>
                {riders.length === 0 ? <p className="text-sm text-muted-foreground">No learners are assigned to this route.</p> : (
                    <ul className="flex flex-col gap-2">
                        {riders.map(r => {
                            const ev = events.get(r.student_id);
                            return (
                                <li key={r.student_id} className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 sm:flex-row sm:items-center">
                                    <span className="min-w-0 flex-1 text-sm"><span className="font-medium">{studentName(r.student)}</span> <span className="text-muted-foreground">{r.stop?.name ?? ''}{r.stop?.pickup_time ? ` · ${r.stop.pickup_time.slice(0, 5)}` : ''}</span></span>
                                    <div className="flex gap-1.5">
                                        <Button size="sm" variant={ev === 'BOARDED' ? 'default' : 'outline'} onClick={() => void board(r.student_id, 'BOARDED')}><UserCheck />On</Button>
                                        <Button size="sm" variant={ev === 'ALIGHTED' ? 'default' : 'outline'} onClick={() => void board(r.student_id, 'ALIGHTED')}><UserMinus />Off</Button>
                                        <Button size="sm" variant={ev === 'ABSENT' ? 'destructive' : 'outline'} onClick={() => void board(r.student_id, 'ABSENT')}><UserX />Absent</Button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            <section className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-end">
                <FormField label="Odometer at end (optional)" htmlFor="odo-end" className="sm:w-56">
                    <InputField id="odo-end" type="number" inputMode="numeric" value={odometer} onChange={e => setOdometer(e.target.value)} />
                </FormField>
                <Button size="lg" variant="destructive" onClick={end} disabled={busy}><Square />End trip</Button>
            </section>
        </div>
    );
}
