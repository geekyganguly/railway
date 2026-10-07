import L from 'leaflet';

const COLORS = {
  route: '#2563eb',
  halt: '#2563eb',
  pass: '#94a3b8',
  origin: '#16a34a',
  destination: '#dc2626',
};

let map;
let routeLayer;
let markers = [];
// Height of whatever covers the bottom of the map (the phone bottom sheet).
let bottomInset = 0;

export function initMap(el, { attributionPosition = 'bottomright' } = {}) {
  map = L.map(el, { attributionControl: false }).setView([22.5, 79], 5);
  L.control.attribution({ position: attributionPosition }).addTo(map);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  routeLayer = L.layerGroup().addTo(map);
  // The map's container may change size when the layout reflows.
  new ResizeObserver(() => map.invalidateSize()).observe(el);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function popupHtml(stop) {
  const times = [stop.arr && `arr ${stop.arr}`, stop.dep && `dep ${stop.dep}`].filter(Boolean).join(' · ');
  return `<strong>${escapeHtml(stop.name)}</strong> (${escapeHtml(stop.code)})<br>${escapeHtml(times)}${
    stop.halt ? '' : '<br><em>passes through</em>'
  }<br>Day ${escapeHtml(stop.day)}`;
}

/** Draws the train's path and a marker per stop; markers[i] matches train.stops[i]. */
export function showRoute(train, { showPassing = false } = {}) {
  routeLayer.clearLayers();
  markers = [];
  if (train.path.length > 1) {
    L.polyline(train.path, { color: COLORS.route, weight: 4, opacity: 0.75 }).addTo(routeLayer);
  }

  const last = train.stops.length - 1;
  train.stops.forEach((stop, i) => {
    if (stop.lat === null || (!stop.halt && !showPassing)) {
      markers.push(null);
      return;
    }
    const color = i === 0 ? COLORS.origin : i === last ? COLORS.destination : stop.halt ? COLORS.halt : COLORS.pass;
    const endpoint = i === 0 || i === last;
    const marker = L.circleMarker([stop.lat, stop.lng], {
      radius: endpoint ? 8 : stop.halt ? 6 : 3,
      color: '#fff',
      weight: stop.halt ? 2 : 1,
      fillColor: color,
      fillOpacity: 1,
    })
      .bindPopup(popupHtml(stop))
      .bindTooltip(stop.name, { direction: 'top', offset: [0, -6] })
      .addTo(routeLayer);
    markers.push(marker);
  });

  const points = train.path.length ? train.path : train.stops.filter((s) => s.lat !== null).map((s) => [s.lat, s.lng]);
  if (points.length) {
    map.fitBounds(points, { paddingTopLeft: [32, 32], paddingBottomRight: [32, 32 + bottomInset], maxZoom: 12 });
  }
}

export function setBottomInset(px) {
  bottomInset = px;
}

export function clearRoute() {
  routeLayer?.clearLayers();
  markers = [];
}

export function focusStop(i) {
  const marker = markers[i];
  if (!marker) return false;
  // Centre the stop in the part of the map the bottom sheet leaves visible.
  const zoom = Math.max(map.getZoom(), 10);
  const center = map.unproject(map.project(marker.getLatLng(), zoom).add([0, bottomInset / 2]), zoom);
  map.flyTo(center, zoom, { duration: 0.6 });
  marker.openPopup();
  return true;
}
