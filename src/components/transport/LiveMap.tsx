"use client";

import React, { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, LayerGroup } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertTriangle, Bus, Phone } from 'lucide-react';
import { opsFetch, errorText } from '@/lib/ops/client';
import { dateTime } from '@/lib/ops/format';
import { cn } from '@/lib/utils';
import type { LiveTrip } from '@/lib/transport/types';

const POLL_MS = 10_000;
const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
/** Nairobi, until a bus reports. */
const DEFAULT_CENTER: [number, number] = [-1.2921, 36.8219];

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));

/**
 * Every running bus on a map, refreshed every ten seconds, with its recent
 * path, route stops and alerts (speeding, silent tracker).
 */
export function LiveMap() {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<LeafletMap | null>(null);
    const layerRef = useRef<LayerGroup | null>(null);
    const fittedRef = useRef(false);
    const [trips, setTrips] = useState<LiveTrip[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [updated, setUpdated] = useState<string | null>(null);

    // Poll the live feed.
    useEffect(() => {
        let live = true;
        const load = () => opsFetch<LiveTrip[]>('/api/transport/live')
            .then(t => { if (live) { setTrips(t); setError(null); setUpdated(new Date().toISOString()); } })
            .catch(err => { if (live) setError(errorText(err)); });
        void load();
        const timer = setInterval(load, POLL_MS);
        return () => { live = false; clearInterval(timer); };
    }, []);

    // Create the map once (Leaflet touches window, so load it in the browser only).
    useEffect(() => {
        let cancelled = false;
        void import('leaflet').then(L => {
            if (cancelled || !containerRef.current || mapRef.current) return;
            const map = L.map(containerRef.current, { zoomControl: true }).setView(DEFAULT_CENTER, 12);
            L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);
            mapRef.current = map;
            layerRef.current = L.layerGroup().addTo(map);
        });
        return () => { cancelled = true; mapRef.current?.remove(); mapRef.current = null; };
    }, []);

    // Redraw buses, paths and stops on each refresh.
    useEffect(() => {
        void import('leaflet').then(L => {
            const map = mapRef.current;
            const layer = layerRef.current;
            if (!map || !layer) return;
            layer.clearLayers();
            const points: [number, number][] = [];
            for (const t of trips) {
                for (const s of t.stops) {
                    if (s.lat == null || s.lng == null) continue;
                    L.circleMarker([s.lat, s.lng], { radius: 5, color: '#0ea5e9', weight: 2, fillOpacity: 0.6 }).bindTooltip(escapeHtml(s.name)).addTo(layer);
                }
                if (t.path.length > 1) L.polyline(t.path, { color: t.alerts.length ? '#ef4444' : '#10b981', weight: 4, opacity: 0.7 }).addTo(layer);
                if (t.last_lat == null || t.last_lng == null) continue;
                const pos: [number, number] = [t.last_lat, t.last_lng];
                points.push(pos);
                const icon = L.divIcon({
                    className: '',
                    html: `<div style="background:${t.alerts.length ? '#ef4444' : '#10b981'};color:#fff;border-radius:9999px;padding:2px 8px;font:600 11px system-ui;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.35)">🚌 ${escapeHtml(t.vehicle?.registration ?? 'Bus')}</div>`,
                    iconAnchor: [30, 10],
                });
                L.marker(pos, { icon }).bindPopup(`<strong>${escapeHtml(t.vehicle?.registration ?? '')}</strong><br>${escapeHtml(t.route?.name ?? '')}<br>${Math.round(Number(t.last_speed_kmh ?? 0))} km/h`).addTo(layer);
            }
            if (points.length > 0 && !fittedRef.current) {
                map.fitBounds(L.latLngBounds(points).pad(0.3), { maxZoom: 15 });
                fittedRef.current = true;
            }
        });
    }, [trips]);

    const focus = (t: LiveTrip) => {
        if (t.last_lat != null && t.last_lng != null) mapRef.current?.setView([t.last_lat, t.last_lng], 15);
    };

    return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_20rem]">
            <div ref={containerRef} className="z-0 h-[55vh] min-h-80 overflow-hidden rounded-2xl border border-border/60 lg:h-[70vh]" role="region" aria-label="Live bus map" />
            <aside className="flex flex-col gap-3">
                <p className="text-xs text-muted-foreground">{error ? <span className="text-destructive">{error}</span> : updated ? `Updated ${dateTime(updated)} · refreshes every 10 s` : 'Loading…'}</p>
                {trips.length === 0 && !error && <p className="rounded-2xl border border-border/60 bg-card p-6 text-center text-sm text-muted-foreground">No buses on the road right now.</p>}
                {trips.map(t => (
                    <button key={t.id} type="button" onClick={() => focus(t)}
                        className={cn('flex flex-col gap-1 rounded-2xl border bg-card p-3 text-left shadow-sm transition-colors hover:bg-muted/40', t.alerts.length ? 'border-destructive/50' : 'border-border/70')}>
                        <span className="flex items-center gap-2 text-sm font-semibold"><Bus className="size-4" aria-hidden />{t.vehicle?.registration} <span className="font-normal text-muted-foreground">· {t.route?.name ?? 'No route'}</span></span>
                        <span className="text-xs text-muted-foreground">{t.driver?.full_name ?? 'No driver'} · {Math.round(Number(t.last_speed_kmh ?? 0))} km/h · seen {dateTime(t.last_seen_at)}</span>
                        {t.driver?.phone && <a href={`tel:${t.driver.phone}`} onClick={e => e.stopPropagation()} className="flex items-center gap-1 text-xs text-primary"><Phone className="size-3" aria-hidden />{t.driver.phone}</a>}
                        {t.alerts.map(a => <span key={a} className="flex items-center gap-1 text-xs font-medium text-destructive"><AlertTriangle className="size-3" aria-hidden />{a}</span>)}
                    </button>
                ))}
            </aside>
        </div>
    );
}
