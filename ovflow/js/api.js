// OVFlow – API-laag
// Transitous (MOTIS 2): routeplanner, haltes, vertrekken, ritten en live voertuigen voor
//   NMBS/SNCB, De Lijn, TEC en MIVB/STIB (incl. realtime GTFS-RT van NMBS, De Lijn en TEC).
// iRail: NMBS-stations, liveboards met perrons/bezetting, treinnummers en storingen.

export const TRANSITOUS = 'https://api.transitous.org';
export const IRAIL = 'https://api.irail.be';

// Serverproxy's (zelfde origin) als fallback wanneer een directe aanvraag faalt (CORS/netwerk).
const PROXIES = ['/api/ov-proxy', '/.netlify/functions/ov-proxy'];

export class ApiError extends Error {
  constructor(message, status = 0) { super(message); this.status = status; }
}

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* privémodus */ } }
};

let preferProxy = store.get('ovflow.proxy') === '1';

async function fetchWithTimeout(url, { signal, timeout = 20000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(new DOMException('Time-out', 'TimeoutError')), timeout);
  const onAbort = () => ctrl.abort(signal.reason);
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    return await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
  } finally {
    clearTimeout(t);
    signal?.removeEventListener('abort', onAbort);
  }
}

async function readJson(res) {
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* geen JSON */ }
  if (!res.ok) {
    const msg = data?.error || data?.message || `HTTP ${res.status}`;
    throw new ApiError(typeof msg === 'string' ? msg : `HTTP ${res.status}`, res.status);
  }
  if (data === null) throw new ApiError('Ongeldig antwoord van de server', res.status);
  return data;
}

/** GET JSON, eerst rechtstreeks en bij netwerk/CORS-fouten via de eigen proxy. */
export async function getJSON(url, opts = {}) {
  const viaProxy = async () => {
    let lastErr;
    for (const p of PROXIES) {
      try {
        const res = await fetchWithTimeout(`${p}?url=${encodeURIComponent(url)}`, opts);
        // Alleen antwoorden van onze eigen proxy tellen (anders bv. een 404-pagina van de host)
        if (!res.headers.get('x-ovflow-proxy')) { lastErr = new ApiError('Proxy niet beschikbaar'); continue; }
        return await readJson(res);
      } catch (e) {
        if (e.name === 'AbortError' && opts.signal?.aborted) throw e;
        if (e instanceof ApiError && e.status && e.status !== 502 && e.status !== 504) throw e;
        lastErr = e;
      }
    }
    throw lastErr || new ApiError('Geen verbinding');
  };

  if (preferProxy) {
    try { return await viaProxy(); } catch (e) { if (e instanceof ApiError && e.status) throw e; }
  }
  try {
    const res = await fetchWithTimeout(url, opts);
    return await readJson(res);
  } catch (e) {
    if (e.name === 'AbortError' && opts.signal?.aborted) throw e;
    if (e instanceof ApiError && e.status) throw e; // echte HTTP-fout van de API
    // Netwerk/CORS: probeer proxy
    try {
      const data = await viaProxy();
      preferProxy = true; store.set('ovflow.proxy', '1');
      return data;
    } catch (pe) {
      if (pe instanceof ApiError && pe.status && pe.status !== 404) throw pe;
      throw new ApiError(navigator.onLine === false ? 'Je bent offline' : 'De OV-server is niet bereikbaar. Probeer het zo opnieuw.');
    }
  }
}

function qs(params) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    u.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  return u.toString();
}

/* ------------------------------------------------------------------ */
/* Transitous / MOTIS                                                  */
/* ------------------------------------------------------------------ */

// Nieuwste versie eerst; bij 404 wordt automatisch de vorige geprobeerd.
const VERSIONS = {
  plan: [6, 5, 4, 3, 2, 1],
  trip: [6, 5, 4, 2, 1],
  stoptimes: [6, 5, 4, 1],
  'map/trips': [6, 5, 4, 1],
  'map/stops': [6, 1],
  geocode: [1],
  'reverse-geocode': [1]
};
const chosen = JSON.parse(store.get('ovflow.apiv') || '{}');
export const apiVersion = ep => chosen[ep] || VERSIONS[ep][0];

async function motis(endpoint, params, opts) {
  const list = VERSIONS[endpoint];
  const start = Math.max(0, list.indexOf(chosen[endpoint]));
  let lastErr;
  for (let i = start; i < list.length; i++) {
    const v = list[i];
    const p = typeof params === 'function' ? params(v) : params;
    try {
      const data = await getJSON(`${TRANSITOUS}/api/v${v}/${endpoint}?${qs(p)}`, opts);
      if (chosen[endpoint] !== v) { chosen[endpoint] = v; store.set('ovflow.apiv', JSON.stringify(chosen)); }
      return { data, version: v };
    } catch (e) {
      lastErr = e;
      if (!(e instanceof ApiError) || e.status !== 404) throw e;
      // 404 kan "versie bestaat niet" betekenen → volgende versie
    }
  }
  throw lastErr;
}

const BE_CENTER = '50.85,4.35';

/** Plaatsen, adressen en haltes zoeken. */
export async function geocode(text, { types, near, signal } = {}) {
  const { data } = await motis('geocode', {
    text, language: 'nl', type: types, place: near || BE_CENTER, placeBias: near ? 2 : 1, numResults: 10
  }, { signal, timeout: 10000 });
  const list = Array.isArray(data) ? data : [];
  // Belgische resultaten eerst
  return list
    .map((m, i) => ({ ...m, _rank: (m.country && m.country !== 'BE' ? 100 : 0) + i }))
    .sort((a, b) => a._rank - b._rank);
}

export async function reverseGeocode(lat, lon, { signal } = {}) {
  const { data } = await motis('reverse-geocode', { place: `${lat},${lon}`, numResults: 1 }, { signal, timeout: 8000 });
  return Array.isArray(data) ? data[0] : null;
}

function trainModes(v) {
  return v >= 5 ? ['HIGHSPEED_RAIL', 'LONG_DISTANCE', 'NIGHT_RAIL', 'REGIONAL_RAIL', 'SUBURBAN']
               : ['HIGHSPEED_RAIL', 'LONG_DISTANCE', 'NIGHT_RAIL', 'REGIONAL_FAST_RAIL', 'REGIONAL_RAIL', 'METRO'];
}
/** Vertaal de filters van de app naar MOTIS-transitModes (null = alles). */
export function transitModes(groups, v) {
  const all = ['train', 'metro', 'tram', 'bus'];
  if (!groups || all.every(g => groups.includes(g))) return null;
  const out = [];
  if (groups.includes('train')) out.push(...trainModes(v));
  if (groups.includes('metro')) out.push('SUBWAY');
  if (groups.includes('tram')) out.push('TRAM');
  if (groups.includes('bus')) out.push('BUS', 'COACH', 'FERRY', 'ODM');
  return out.length ? out : null;
}

/** Routeplanner. */
export async function plan({ from, to, time, arriveBy = false, modes, maxTransfers, wheelchair = false, walkSpeed, pageCursor, signal }) {
  const { data, version } = await motis('plan', v => ({
    fromPlace: from, toPlace: to,
    time: time ? new Date(time).toISOString() : undefined,
    arriveBy: arriveBy ? 'true' : undefined,
    transitModes: transitModes(modes, v),
    maxTransfers: Number.isFinite(maxTransfers) ? maxTransfers : undefined,
    pedestrianProfile: wheelchair ? 'WHEELCHAIR' : undefined,
    pedestrianSpeed: walkSpeed || undefined,
    detailedTransfers: 'true',
    numItineraries: 6,
    language: 'nl',
    pageCursor
  }), { signal, timeout: 30000 });
  data._version = version;
  return data;
}

/** Vertrekken (of aankomsten) aan een halte. */
export async function stoptimes({ stopId, time, n = 30, arriveBy = false, pageCursor, signal }) {
  const { data } = await motis('stoptimes', {
    stopId, time: time ? new Date(time).toISOString() : undefined, n, arriveBy: arriveBy ? 'true' : undefined, language: 'nl', pageCursor
  }, { signal, timeout: 15000 });
  return data;
}

/** Volledige rit (alle haltes met realtime tijden). */
export async function trip(tripId, { signal } = {}) {
  const { data, version } = await motis('trip', { tripId, language: 'nl' }, { signal, timeout: 15000 });
  data._version = version;
  return data;
}

/** Ritsegmenten in een kaartgebied en tijdvenster (voor live voertuigen). */
export async function mapTrips({ zoom, min, max, start, end, signal }) {
  const precision = zoom >= 11 ? 5 : zoom >= 8 ? 4 : zoom >= 5 ? 3 : 2;
  const { data } = await motis('map/trips', {
    zoom: Math.round(zoom), min: `${min[0]},${min[1]}`, max: `${max[0]},${max[1]}`,
    startTime: new Date(start).toISOString(), endTime: new Date(end).toISOString(), precision, language: 'nl'
  }, { signal, timeout: 20000 });
  return { segments: Array.isArray(data) ? data : [], precision };
}

/** Haltes in een kaartgebied. */
export async function mapStops({ min, max, signal }) {
  const { data } = await motis('map/stops', { min: `${min[0]},${min[1]}`, max: `${max[0]},${max[1]}` }, { signal, timeout: 15000 });
  return Array.isArray(data) ? data : [];
}

/* ------------------------------------------------------------------ */
/* iRail (NMBS)                                                        */
/* ------------------------------------------------------------------ */

const irail = (path, params, opts) => getJSON(`${IRAIL}/${path}/?${qs({ format: 'json', lang: 'nl', ...params })}`, opts);

let stationsCache = null;
export async function irailStations({ signal } = {}) {
  if (stationsCache) return stationsCache;
  try {
    const cached = JSON.parse(store.get('ovflow.stations') || 'null');
    if (cached && Date.now() - cached.t < 7 * 864e5 && cached.list?.length) return (stationsCache = cached.list);
  } catch { /* negeer */ }
  const data = await irail('stations', {}, { signal, timeout: 20000 });
  const list = (data.station || []).map(s => ({
    id: s.id, name: s.standardname || s.name, local: s.name,
    lat: Number(s.locationY), lon: Number(s.locationX)
  }));
  store.set('ovflow.stations', JSON.stringify({ t: Date.now(), list }));
  return (stationsCache = list);
}

const arr = x => (Array.isArray(x) ? x : x ? [x] : []);

export async function irailLiveboard(stationId, { arrivals = false, signal } = {}) {
  const data = await irail('liveboard', { id: stationId, arrdep: arrivals ? 'arrival' : 'departure', alerts: 'true' }, { signal, timeout: 15000 });
  const list = arrivals ? arr(data.arrivals?.arrival) : arr(data.departures?.departure);
  return {
    station: data.stationinfo?.standardname || data.station,
    items: list.map(d => ({
      time: Number(d.time) * 1000,
      delay: Math.round(Number(d.delay || 0) / 60),
      station: d.station,
      vehicle: d.vehicle,
      name: d.vehicleinfo?.shortname || String(d.vehicle || '').replace('BE.NMBS.', ''),
      type: d.vehicleinfo?.type || '',
      number: d.vehicleinfo?.number || '',
      platform: d.platform,
      platformChanged: d.platforminfo?.normal === '0',
      canceled: d.canceled === '1',
      left: d.left === '1',
      occupancy: d.occupancy?.name && d.occupancy.name !== 'unknown' ? d.occupancy.name : null
    }))
  };
}

export async function irailVehicle(id, { signal } = {}) {
  const data = await irail('vehicle', { id, alerts: 'true' }, { signal, timeout: 15000 });
  return {
    id: data.vehicle,
    name: data.vehicleinfo?.shortname || String(data.vehicle || '').replace('BE.NMBS.', ''),
    stops: arr(data.stops?.stop).map(s => ({
      name: s.station,
      lat: Number(s.stationinfo?.locationY), lon: Number(s.stationinfo?.locationX),
      time: Number(s.time) * 1000,
      delay: Math.round(Number(s.delay || 0) / 60),
      arrDelay: Math.round(Number(s.arrivalDelay ?? s.delay ?? 0) / 60),
      depDelay: Math.round(Number(s.departureDelay ?? s.delay ?? 0) / 60),
      schedArr: s.scheduledArrivalTime ? Number(s.scheduledArrivalTime) * 1000 : null,
      schedDep: s.scheduledDepartureTime ? Number(s.scheduledDepartureTime) * 1000 : null,
      platform: s.platform,
      platformChanged: s.platforminfo?.normal === '0',
      canceled: s.canceled === '1' || s.departureCanceled === '1',
      arrived: s.arrived === '1',
      left: s.left === '1',
      occupancy: s.occupancy?.name && s.occupancy.name !== 'unknown' ? s.occupancy.name : null
    }))
  };
}

export async function irailDisturbances({ signal } = {}) {
  const data = await irail('disturbances', {}, { signal, timeout: 15000 });
  return arr(data.disturbance).map(d => ({
    title: d.title, description: d.description, link: d.link,
    type: d.type, time: Number(d.timestamp) * 1000
  }));
}
