// OVFlow – gedeelde hulpfuncties (werkt in browser én Node voor tests)

export const TZ = 'Europe/Brussels';

export const OPERATORS = {
  nmbs:  { id: 'nmbs',  name: 'NMBS',    full: 'NMBS / SNCB',  color: '#0069b4', text: '#ffffff' },
  delijn:{ id: 'delijn',name: 'De Lijn', full: 'De Lijn',      color: '#ffd400', text: '#1a1a1a' },
  tec:   { id: 'tec',   name: 'TEC',     full: 'TEC',          color: '#e2001a', text: '#ffffff' },
  mivb:  { id: 'mivb',  name: 'MIVB',    full: 'MIVB / STIB',  color: '#ea5b0c', text: '#ffffff' },
  other: { id: 'other', name: 'OV',      full: 'Openbaar vervoer', color: '#5b6b7f', text: '#ffffff' }
};

/** Bepaal de vervoerder uit tripId / stopId / agencyName. */
export function detectOperator(...hints) {
  const s = hints.filter(Boolean).join(' ').toLowerCase();
  if (!s) return OPERATORS.other;
  if (/be-sncb|sncb|nmbs|irail|\bbe\.nmbs/.test(s)) return OPERATORS.nmbs;
  if (/be-delijn|de ?lijn|delijn/.test(s)) return OPERATORS.delijn;
  if (/be-stib|stib|mivb/.test(s)) return OPERATORS.mivb;
  if (/be-tec|(^|[^a-z])tec([^a-z]|$)|transport en commun/.test(s)) return OPERATORS.tec;
  return OPERATORS.other;
}

export const MODE_INFO = {
  WALK: { icon: '🚶', label: 'Wandelen' },
  BIKE: { icon: '🚲', label: 'Fiets' },
  CAR: { icon: '🚗', label: 'Auto' },
  RENTAL: { icon: '🛴', label: 'Deelvoertuig' },
  TRAM: { icon: '🚋', label: 'Tram' },
  SUBWAY: { icon: '🚇', label: 'Metro' },
  METRO: { icon: '🚇', label: 'Metro' },
  FERRY: { icon: '⛴️', label: 'Veerboot' },
  AIRPLANE: { icon: '✈️', label: 'Vliegtuig' },
  BUS: { icon: '🚌', label: 'Bus' },
  COACH: { icon: '🚌', label: 'Bus' },
  RAIL: { icon: '🚆', label: 'Trein' },
  HIGHSPEED_RAIL: { icon: '🚄', label: 'Hogesnelheidstrein' },
  LONG_DISTANCE: { icon: '🚆', label: 'Trein' },
  NIGHT_RAIL: { icon: '🚆', label: 'Nachttrein' },
  REGIONAL_FAST_RAIL: { icon: '🚆', label: 'Trein' },
  REGIONAL_RAIL: { icon: '🚆', label: 'Trein' },
  SUBURBAN: { icon: '🚆', label: 'S-trein' },
  FUNICULAR: { icon: '🚞', label: 'Kabelspoor' },
  AERIAL_LIFT: { icon: '🚡', label: 'Kabelbaan' },
  ODM: { icon: '🚐', label: 'Belbus' },
  FLEX: { icon: '🚐', label: 'Flexvervoer' },
  OTHER: { icon: '🚍', label: 'OV' }
};
export const modeInfo = m => MODE_INFO[m] || MODE_INFO.OTHER;
export const isTransitMode = m => !['WALK', 'BIKE', 'CAR', 'RENTAL', 'CAR_PARKING', 'CAR_DROPOFF'].includes(m);

export const TRAIN_MODES = ['RAIL', 'HIGHSPEED_RAIL', 'LONG_DISTANCE', 'NIGHT_RAIL', 'REGIONAL_RAIL', 'REGIONAL_FAST_RAIL', 'SUBURBAN'];
/** Groepeer een MOTIS-modus in de filtercategorieën van de app. */
export function modeGroup(mode) {
  if (TRAIN_MODES.includes(mode)) return 'train';
  if (mode === 'SUBWAY' || mode === 'METRO') return 'metro';
  if (mode === 'TRAM') return 'tram';
  return 'bus';
}

/** Google polyline decoder met instelbare precisie. Geeft [[lat, lon], ...]. */
export function decodePolyline(str, precision = 5) {
  if (!str) return [];
  const factor = Math.pow(10, precision);
  const out = [];
  let index = 0, lat = 0, lon = 0;
  while (index < str.length) {
    let result = 0, shift = 0, b;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    result = 0; shift = 0;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lon += (result & 1) ? ~(result >> 1) : (result >> 1);
    out.push([lat / factor, lon / factor]);
  }
  return out;
}

export function encodePolyline(points, precision = 5) {
  const factor = Math.pow(10, precision);
  let out = '', pLat = 0, pLon = 0;
  const enc = v => { v = v < 0 ? ~(v << 1) : v << 1; let s = ''; while (v >= 0x20) { s += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; } return s + String.fromCharCode(v + 63); };
  for (const [la, lo] of points) {
    const a = Math.round(la * factor), o = Math.round(lo * factor);
    out += enc(a - pLat) + enc(o - pLon); pLat = a; pLon = o;
  }
  return out;
}

/** Afstand in meter tussen twee [lat, lon]-punten. */
export function haversine(a, b) {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (b[0] - a[0]) * toR, dLon = (b[1] - a[1]) * toR;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * toR) * Math.cos(b[0] * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

/** Cumulatieve afstanden langs een lijn. */
export function cumulative(points) {
  const c = [0];
  for (let i = 1; i < points.length; i++) c.push(c[i - 1] + haversine(points[i - 1], points[i]));
  return c;
}

/** Punt op fractie f (0..1) langs een lijn, met rijrichting in graden. */
export function pointAlong(points, f, cum = cumulative(points)) {
  if (!points.length) return null;
  if (points.length === 1) return { pos: points[0], bearing: 0 };
  f = Math.max(0, Math.min(1, Number.isFinite(f) ? f : 0));
  const total = cum[cum.length - 1];
  const target = total * f;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < target) i++;
  const seg = cum[i] - cum[i - 1] || 1;
  const t = Math.max(0, Math.min(1, (target - cum[i - 1]) / seg));
  const a = points[i - 1], b = points[i];
  return { pos: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], bearing: bearing(a, b) };
}

export function bearing(a, b) {
  const toR = Math.PI / 180;
  const y = Math.sin((b[1] - a[1]) * toR) * Math.cos(b[0] * toR);
  const x = Math.cos(a[0] * toR) * Math.sin(b[0] * toR) - Math.sin(a[0] * toR) * Math.cos(b[0] * toR) * Math.cos((b[1] - a[1]) * toR);
  return (Math.atan2(y, x) / toR + 360) % 360;
}

/** Index van het dichtstbijzijnde punt op de lijn (vanaf `from`). */
export function nearestIndex(points, p, from = 0) {
  let best = from, bd = Infinity;
  for (let i = from; i < points.length; i++) {
    const d = haversine(points[i], p);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

const ms = v => (v == null ? NaN : (typeof v === 'number' ? (v < 1e12 ? v * 1000 : v) : Date.parse(v)));
export const toMs = ms;

/**
 * Bereken de live positie van een voertuig op een rit.
 * stops: [{lat, lon, arr, dep}] (ms), shape: [[lat,lon]] (optioneel)
 * Geeft {pos, bearing, state: 'before'|'running'|'at-stop'|'after', index, next}
 */
export function vehiclePosition(stops, shape, now = Date.now()) {
  const st = stops.filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lon));
  if (!st.length) return null;
  const t = i => ({ arr: Number.isFinite(st[i].arr) ? st[i].arr : st[i].dep, dep: Number.isFinite(st[i].dep) ? st[i].dep : st[i].arr });
  if (now < t(0).dep) return { pos: [st[0].lat, st[0].lon], bearing: 0, state: 'before', index: 0, next: 0 };
  const last = st.length - 1;
  if (now >= t(last).arr) return { pos: [st[last].lat, st[last].lon], bearing: 0, state: 'after', index: last, next: last };
  for (let i = 0; i < last; i++) {
    const a = t(i), b = t(i + 1);
    if (now >= a.arr && now < a.dep) return { pos: [st[i].lat, st[i].lon], bearing: 0, state: 'at-stop', index: i, next: i + 1 };
    if (now >= a.dep && now < b.arr) {
      const f = (now - a.dep) / Math.max(1, b.arr - a.dep);
      const pa = [st[i].lat, st[i].lon], pb = [st[i + 1].lat, st[i + 1].lon];
      let path = [pa, pb];
      if (shape && shape.length > 1) {
        const ia = nearestIndex(shape, pa), ib = nearestIndex(shape, pb, ia);
        if (ib > ia) path = [pa, ...shape.slice(ia + 1, ib), pb];
      }
      const r = pointAlong(path, f);
      return { pos: r.pos, bearing: r.bearing, state: 'running', index: i, next: i + 1, fraction: f };
    }
  }
  return { pos: [st[last].lat, st[last].lon], bearing: 0, state: 'after', index: last, next: last };
}

/* ---------- Tijd ---------- */
const fmtTime = new Intl.DateTimeFormat('nl-BE', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
const fmtDay = new Intl.DateTimeFormat('nl-BE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ });
export const hhmm = v => { const t = ms(v); return Number.isFinite(t) ? fmtTime.format(new Date(t)) : '–'; };
export const dayLabel = v => { const t = ms(v); return Number.isFinite(t) ? fmtDay.format(new Date(t)) : ''; };
export function duration(sec) {
  sec = Math.max(0, Math.round(sec));
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} u ${String(m % 60).padStart(2, '0')}`;
}
/** Vertraging in minuten tussen realtime en gepland. */
export function delayMin(actual, scheduled) {
  const a = ms(actual), s = ms(scheduled);
  if (!Number.isFinite(a) || !Number.isFinite(s)) return 0;
  return Math.round((a - s) / 60000);
}
export function relMinutes(v, now = Date.now()) {
  const t = ms(v);
  if (!Number.isFinite(t)) return '';
  const m = Math.round((t - now) / 60000);
  if (m <= 0) return m < -1 ? `${-m} min geleden` : 'nu';
  if (m < 60) return `${m} min`;
  return hhmm(t);
}
export function distance(m) {
  if (!Number.isFinite(m)) return '';
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0).replace('.', ',')} km`;
}

/* ---------- Diversen ---------- */
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function color(c, fallback) {
  if (!c) return fallback;
  const v = String(c).replace(/^#/, '');
  return /^[0-9a-f]{6}$/i.test(v) ? `#${v}` : fallback;
}
/** Contrastkleur (zwart/wit) bij een achtergrond. */
export function contrast(hex) {
  const v = String(hex).replace('#', '');
  if (v.length !== 6) return '#fff';
  const r = parseInt(v.slice(0, 2), 16), g = parseInt(v.slice(2, 4), 16), b = parseInt(v.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#111' : '#fff';
}
export function lineName(x) {
  return x?.displayName || x?.routeShortName || x?.tripShortName || x?.routeLongName || '';
}
/** Badge-kleuren voor een lijn: routeColor indien beschikbaar, anders vervoerder. */
export function lineColors(x, op) {
  const bg = color(x?.routeColor, op?.color || OPERATORS.other.color);
  const fg = color(x?.routeTextColor, null) || (x?.routeColor ? contrast(bg) : (op?.text || contrast(bg)));
  return { bg, fg };
}
export function debounce(fn, wait = 250) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), wait); };
}
