/**
 * The live bus map as a self-contained Leaflet page, drawn the same way as
 * the web's `LiveMap` (buses, recent paths, route stops, red when a bus has
 * an alert). The app feeds it trips with `window.render(trips)` (native
 * WebView) or `postMessage` (web iframe), and a tap on a bus card calls
 * `window.focusBus(lat, lng)`.
 */
const TILE_URL = process.env.EXPO_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const LEAFLET = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist';

export const liveMapHtml = () => `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="${LEAFLET}/leaflet.css">
<style>html,body,#map{height:100%;margin:0;background:#f1f5f9}.bus{color:#fff;border-radius:9999px;padding:2px 8px;font:600 11px system-ui;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.35)}</style>
</head>
<body>
<div id="map" role="region" aria-label="Live bus map"></div>
<script src="${LEAFLET}/leaflet.js"></script>
<script>
(function () {
  var map = L.map('map', { zoomControl: true }).setView([-1.2921, 36.8219], 12);
  L.tileLayer(${JSON.stringify(TILE_URL)}, { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 }).addTo(map);
  var layer = L.layerGroup().addTo(map);
  var fitted = false;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  window.render = function (trips) {
    layer.clearLayers();
    var points = [];
    (trips || []).forEach(function (t) {
      var bad = t.alerts && t.alerts.length > 0;
      (t.stops || []).forEach(function (s) {
        if (s.lat == null || s.lng == null) return;
        L.circleMarker([s.lat, s.lng], { radius: 5, color: '#0ea5e9', weight: 2, fillOpacity: 0.6 }).bindTooltip(esc(s.name)).addTo(layer);
      });
      if (t.path && t.path.length > 1) L.polyline(t.path, { color: bad ? '#ef4444' : '#10b981', weight: 4, opacity: 0.7 }).addTo(layer);
      if (t.last_lat == null || t.last_lng == null) return;
      var pos = [t.last_lat, t.last_lng];
      points.push(pos);
      var reg = t.vehicle ? t.vehicle.registration : 'Bus';
      var icon = L.divIcon({ className: '', html: '<div class="bus" style="background:' + (bad ? '#ef4444' : '#10b981') + '">\\uD83D\\uDE8C ' + esc(reg) + '</div>', iconAnchor: [30, 10] });
      L.marker(pos, { icon: icon }).bindPopup('<strong>' + esc(reg) + '</strong><br>' + esc(t.route ? t.route.name : '') + '<br>' + Math.round(Number(t.last_speed_kmh || 0)) + ' km/h').addTo(layer);
    });
    if (points.length > 0 && !fitted) { map.fitBounds(L.latLngBounds(points).pad(0.3), { maxZoom: 15 }); fitted = true; }
  };
  window.focusBus = function (lat, lng) { map.setView([lat, lng], 15); };
  window.addEventListener('message', function (e) {
    var msg = e.data;
    if (typeof msg === 'string') { try { msg = JSON.parse(msg); } catch (err) { return; } }
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'render') window.render(msg.trips);
    if (msg.type === 'focus') window.focusBus(msg.lat, msg.lng);
  });
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage('ready');
  else if (window.parent !== window) window.parent.postMessage('live-map-ready', '*');
})();
</script>
</body>
</html>`;

export type LiveMapCommand = { type: 'render'; trips: unknown[] } | { type: 'focus'; lat: number; lng: number };
