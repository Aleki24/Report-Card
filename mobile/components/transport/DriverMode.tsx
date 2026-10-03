import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { dateTime, humanize, studentName } from '@shared/ops/format';
import { SPEED_LIMIT_KMH } from '@shared/transport/compliance';
import {
    FLUSH_BATCH, FLUSH_MS, QUEUE_LIMIT, byStop, gpsQueueKey, toFix,
    type BoardEvent, type Fix, type MyTrip, type TripRider, type TripRiders,
} from '@shared/ops/forms/transport';
import { Button, ButtonRow, Card, EmptyState, SectionLabel, TextField } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useApi } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { opsGet } from '@/lib/ops';
import { readJson, writeJson } from '@/lib/storage';
import { useCurrentUser } from '@/lib/UserContext';
import { colors, spacing, fonts } from '@/lib/theme';

const KEEP_AWAKE_TAG = 'driver-trip';

/* Fixes waiting to upload survive an app restart or a dead network. */
const readQueue = (tripId: string) => readJson<Fix[]>(gpsQueueKey(tripId), []);
const writeQueue = (tripId: string, fixes: Fix[]) => writeJson(gpsQueueKey(tripId), fixes.slice(-QUEUE_LIMIT));

/**
 * The driver's phone screen: pick today's trip, start it (NTSA checks run on
 * the server), share location while it runs (queued offline), tick learners
 * on and off, and end it — the web's driver mode with the phone's own GPS.
 */
export function DriverMode() {
    const api = useApi();
    const toast = useToast();
    const { hasModule } = useCurrentUser();
    const tracking = hasModule('transport_tracking');
    const [trips, setTrips] = useState<MyTrip[]>([]);
    const [active, setActive] = useState<MyTrip | null>(null);
    const [odometer, setOdometer] = useState('');
    const [riders, setRiders] = useState<TripRider[]>([]);
    const [events, setEvents] = useState<Map<string, BoardEvent>>(new Map());
    const [queued, setQueued] = useState(0);
    const [lastFix, setLastFix] = useState<Fix | null>(null);
    const [online, setOnline] = useState(true);
    const [busy, setBusy] = useState(false);
    const watch = useRef<Location.LocationSubscription | null>(null);

    const loadTrips = useCallback(async () => {
        try {
            const t = await opsGet<MyTrip[]>(api, '/api/transport/my-trips');
            setTrips(t);
            setActive((a) => a ?? t.find((x) => x.status === 'IN_PROGRESS') ?? null);
        } catch (err) { toast.error(errorMessage(err, 'Could not load your trips')); }
    }, [api, toast]);
    useEffect(() => { void loadTrips(); }, [loadTrips]);

    const loadRiders = useCallback(async (tripId: string) => {
        try {
            const r = await opsGet<TripRiders>(api, `/api/transport/trips/${tripId}/riders`);
            setRiders(byStop(r.riders));
            setEvents(new Map(r.events.map((e) => [e.student_id, e.event])));
        } catch (err) { toast.error(errorMessage(err, 'Could not load the learners')); }
    }, [api, toast]);

    const flush = useCallback(async (tripId: string) => {
        const pending = readQueue(tripId);
        setQueued(pending.length);
        if (pending.length === 0) return;
        try {
            const batch = pending.slice(0, FLUSH_BATCH);
            await api.post(`/api/transport/trips/${tripId}/positions`, { points: batch });
            const rest = readQueue(tripId).slice(batch.length);
            writeQueue(tripId, rest);
            setQueued(rest.length);
            setOnline(true);
        } catch {
            setOnline(false);
        }
    }, [api]);

    const stopTracking = useCallback(() => {
        watch.current?.remove();
        watch.current = null;
        deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    }, []);

    // While a trip runs: rider list, GPS watch, periodic upload, screen kept awake.
    useEffect(() => {
        if (!active || active.status !== 'IN_PROGRESS') return;
        void loadRiders(active.id);
        if (!tracking) return;
        let cancelled = false;
        void (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (cancelled) return;
            if (status !== 'granted') { toast.error('Allow location access so the school can see the bus.'); return; }
            watch.current = await Location.watchPositionAsync(
                { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
                (pos) => {
                    const fix = toFix(pos.coords, pos.timestamp);
                    writeQueue(active.id, [...readQueue(active.id), fix]);
                    setLastFix(fix);
                    setQueued((q) => q + 1);
                },
            );
            if (cancelled) watch.current.remove();
        })().catch((err: unknown) => toast.error(`Location: ${errorMessage(err, 'unavailable')}`));
        activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
        const timer = setInterval(() => void flush(active.id), FLUSH_MS);
        return () => { cancelled = true; clearInterval(timer); stopTracking(); };
    }, [active, tracking, flush, loadRiders, stopTracking, toast]);

    const odometerBody = () => (odometer ? { odometer: Number(odometer) } : {});

    const start = async (trip: MyTrip) => {
        setBusy(true);
        try {
            await api.post(`/api/transport/trips/${trip.id}/start`, odometerBody());
            toast.success('Trip started. Keep this screen open.');
            setOdometer('');
            setActive({ ...trip, status: 'IN_PROGRESS' });
        } catch (err) { toast.error(errorMessage(err, 'Could not start the trip')); }
        finally { setBusy(false); }
    };

    const end = async () => {
        if (!active) return;
        setBusy(true);
        try {
            await flush(active.id);
            await api.post(`/api/transport/trips/${active.id}/end`, odometerBody());
            stopTracking();
            toast.success('Trip ended.');
            setActive(null);
            setRiders([]);
            setOdometer('');
            await loadTrips();
        } catch (err) { toast.error(errorMessage(err, 'Could not end the trip')); }
        finally { setBusy(false); }
    };

    const board = async (studentId: string, event: BoardEvent) => {
        if (!active) return;
        try {
            const r = await api.post<{ data: { notified: boolean } }>(`/api/transport/trips/${active.id}/boarding`, { student_id: studentId, event });
            setEvents((m) => new Map(m).set(studentId, event));
            if (!r.data.notified) toast.show('Recorded (no guardian phone on file).');
        } catch (err) { toast.error(errorMessage(err, 'Could not record that')); }
    };

    if (!active || active.status !== 'IN_PROGRESS') {
        return trips.length === 0 ? (
            <EmptyState title="No trips assigned to you right now." description="Ask the transport manager to schedule one and link your account under Crew." />
        ) : (
            <View>
                <TextField label="Odometer at start (optional)" value={odometer} onChangeText={setOdometer} keyboardType="number-pad" />
                {trips.map((t) => (
                    <Card key={t.id} style={styles.card}>
                        <Text style={styles.title}>{t.vehicle?.registration} · {t.route?.name ?? 'No route'}</Text>
                        <Text style={styles.muted}>{humanize(t.direction)} · {dateTime(t.scheduled_at)}</Text>
                        <View style={{ marginTop: spacing.sm }}><Button label="▶ Start trip" onPress={() => void start(t)} disabled={busy} block /></View>
                    </Card>
                ))}
            </View>
        );
    }

    const speeding = (lastFix?.speed_kmh ?? 0) > SPEED_LIMIT_KMH;
    const onBoard = [...events.values()].filter((e) => e === 'BOARDED').length;

    return (
        <View>
            <Card style={[styles.card, { borderColor: speeding ? colors.danger : colors.success, backgroundColor: speeding ? colors.dangerBg : colors.successBg }]}>
                <Text style={[styles.title, { fontSize: 18 }]}>{active.vehicle?.registration} · {active.route?.name ?? 'No route'}</Text>
                {tracking ? (
                    <Text style={styles.muted}>
                        {online ? 'Sharing location' : 'Offline — saving locations to send later'} · {lastFix ? `${Math.round(lastFix.speed_kmh ?? 0)} km/h` : 'Waiting for GPS…'}
                        {queued > 0 ? ` · ${queued} waiting to upload` : ''}
                    </Text>
                ) : <Text style={styles.muted}>Live tracking is switched off for your school.</Text>}
                {speeding ? <Text style={styles.alert}>Slow down: the limit for school buses is {SPEED_LIMIT_KMH} km/h.</Text> : null}
            </Card>

            <SectionLabel>{`Learners (${onBoard} on board)`}</SectionLabel>
            {riders.length === 0 ? <EmptyState title="No learners are assigned to this route." /> : riders.map((r) => {
                const ev = events.get(r.student_id);
                return (
                    <Card key={r.student_id} style={styles.card}>
                        <Text style={styles.title}>{studentName(r.student)}</Text>
                        <Text style={styles.muted}>{r.stop?.name ?? ''}{r.stop?.pickup_time ? ` · ${r.stop.pickup_time.slice(0, 5)}` : ''}</Text>
                        <ButtonRow>
                            <Button size="sm" label="On" variant={ev === 'BOARDED' ? 'primary' : 'secondary'} onPress={() => void board(r.student_id, 'BOARDED')} />
                            <Button size="sm" label="Off" variant={ev === 'ALIGHTED' ? 'primary' : 'secondary'} onPress={() => void board(r.student_id, 'ALIGHTED')} />
                            <Button size="sm" label="Absent" variant={ev === 'ABSENT' ? 'danger' : 'secondary'} onPress={() => void board(r.student_id, 'ABSENT')} />
                        </ButtonRow>
                    </Card>
                );
            })}

            <View style={{ marginTop: spacing.lg }}>
                <TextField label="Odometer at end (optional)" value={odometer} onChangeText={setOdometer} keyboardType="number-pad" />
                <Button label="■ End trip" variant="danger" onPress={() => void end()} loading={busy} block />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: { marginBottom: spacing.sm, padding: spacing.md },
    title: { fontSize: 15, fontFamily: fonts.bold, color: colors.foreground },
    muted: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
    alert: { fontSize: 13, fontFamily: fonts.display, color: colors.danger, marginTop: spacing.sm },
});
