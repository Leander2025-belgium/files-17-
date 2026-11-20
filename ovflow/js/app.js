// OVFlow – hoofdapplicatie
import * as api from './api.js';
import {
  OPERATORS, detectOperator, modeInfo, isTransitMode, modeGroup, decodePolyline, haversine, cumulative, pointAlong,
  vehiclePosition, toMs, hhmm, dayLabel, duration, delayMin, relMinutes, distance, esc, lineName, lineColors, debounce
} from './util.js';

const $ = id => document.getElementById(id);
const L = window.L;

/* ================================================================== */
/* Opslag                                                              */
/* ================================================================== */
const db = {
  get(k, d) { try { const v = localStorage.getItem('ovflow.' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ovflow.' + k, JSON.stringify(v)); } catch { /* vol/privé */ } },
  del(k) { try { localStorage.removeItem('ovflow.' + k); } catch { /* */ } }
};

const state = {
  view: 'plan',
  from: null, to: null,
  plan: null, planReq: null,
  stopNames: db.get('stopNames', {}),
  me: null,
  timers: {},
  liveSegments: new Map(),
  liveMarkers: new Map(),
  follow: db.get('follow', null),
  notified: new Set(db.get('notified', [])),
  detailCleanup: null
};

/* ================================================================== */
/* Kleine helpers                                                      */
/* ================================================================== */
function toast(msg, ms = 3500) {
  const t = $('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, ms);
}
function setStatus(el, msg, { error = false, busy = false } = {}) {
  el.className = 'status' + (error ? ' error' : '');
  el.innerHTML = msg ? (busy ? '<span class="spinner"></span>' : '') + esc(msg) : '';
}
function every(name, fn, ms, immediate = true) {
  stop(name);
  if (immediate) fn();
  state.timers[name] = setInterval(fn, ms);
}
function stop(name) { clearInterval(state.timers[name]); delete state.timers[name]; }
function errMsg(e) { return e?.name === 'AbortError' ? '' : (e?.message || 'Er ging iets mis'); }

function opTag(op) {
  return `<span class="op-tag" style="--c:${op.color};--t:${op.text}">${esc(op.name)}</span>`;
}
function badge(x, op, mode) {
  const { bg, fg } = lineColors(x, op);
  const name = lineName(x) || modeInfo(mode).label;
  return `<span class="badge" style="--bg-c:${bg};--fg-c:${fg}">${modeInfo(mode).icon} ${esc(name)}</span>`;
}
function delayHtml(actual, scheduled, realTime) {
  const d = delayMin(actual, scheduled);
  if (d > 0) return ` <span class="delay">+${d}</span>`;
  if (d < 0) return ` <span class="delay early">${d}</span>`;
  return realTime ? ' <span class="rt" title="Realtime: op tijd">●</span>' : '';
}
function trackHtml(p) {
  if (!p?.track && !p?.scheduledTrack) return '';
  const changed = p.track && p.scheduledTrack && p.track !== p.scheduledTrack;
  return `<span class="track${changed ? ' changed' : ''}" title="Perron/spoor">${esc(p.track || p.scheduledTrack)}</span>`;
}
function alertsHtml(alerts) {
  if (!Array.isArray(alerts) || !alerts.length) return '';
  const seen = new Set();
  return alerts.filter(a => { const k = a.headerText + a.descriptionText; if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, 3).map(a => `<div class="alert"><b>⚠️ ${esc(a.headerText || 'Melding')}</b>${esc(a.descriptionText || '')}</div>`).join('');
}
function placeLabel(m) {
  const area = (m.areas || []).find(a => a.default)?.name || (m.areas || [])[0]?.name || '';
  const street = m.street ? `${m.street}${m.houseNumber ? ' ' + m.houseNumber : ''}` : '';
  if (m.type === 'ADDRESS') return { name: street || m.name, sub: [m.zip, area].filter(Boolean).join(' ') };
  return { name: m.name, sub: [m.type === 'STOP' ? '' : street, area].filter(Boolean).join(', ') };
}
function rememberStop(id, name) {
  if (!id || !name || state.stopNames[id] === name) return;
  state.stopNames[id] = name;
  const keys = Object.keys(state.stopNames);
  if (keys.length > 400) keys.slice(0, 100).forEach(k => delete state.stopNames[k]);
  db.set('stopNames', state.stopNames);
}

/* ---------- Locatie ---------- */
function getPosition({ timeout = 12000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Locatie wordt niet ondersteund door deze browser'));
    // recente positie (bv. van live volgen) direct gebruiken
    if (state.me && Date.now() - (state.meTime || 0) < 20000) return resolve(state.me);
    navigator.geolocation.getCurrentPosition(
      p => { state.me = [p.coords.latitude, p.coords.longitude]; state.meTime = Date.now(); showMe(p.coords.accuracy); resolve(state.me); },
      e => {
        // terugvallen op een recente bekende positie (max. 10 min oud)
        if (e.code !== 1 && state.me && Date.now() - (state.meTime || 0) < 600000) return resolve(state.me);
        reject(new Error(e.code === 1 ? 'Geef OVFlow toegang tot je locatie (browserinstellingen)' : 'Locatie niet gevonden, probeer opnieuw'));
      },
      { enableHighAccuracy: true, timeout, maximumAge: 60000 }
    );
  });
}

/* ================================================================== */
/* Kaart                                                               */
/* ================================================================== */
const map = L.map('map', { zoomControl: false, attributionControl: true, preferCanvas: true }).setView([50.75, 4.45], 8);
const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
L.tileLayer(`https://{s}.basemaps.cartocdn.com/${dark ? 'dark_all' : 'rastertiles/voyager'}/{z}/{x}/{y}{r}.png`, {
  maxZoom: 19, subdomains: 'abcd',
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a> · <a href="https://transitous.org">Transitous</a>'
}).addTo(map);
L.control.zoom({ position: 'bottomright' }).addTo(map);
const layers = {
  route: L.layerGroup().addTo(map),
  live: L.layerGroup().addTo(map),
  stops: L.layerGroup().addTo(map),
  trip: L.layerGroup().addTo(map),
  follow: L.layerGroup().addTo(map),
  me: L.layerGroup().addTo(map)
};
const divIcon = (html, cls = 'veh-icon') => L.divIcon({ html, className: cls, iconSize: [0, 0] });
let meMarker = null, meCircle = null;
function showMe(acc) {
  if (!state.me) return;
  if (!meMarker) {
    meMarker = L.marker(state.me, { icon: divIcon('<div class="me-dot"></div>'), zIndexOffset: 2000, interactive: false }).addTo(layers.me);
    meCircle = L.circle(state.me, { radius: acc || 30, color: '#1a73e8', weight: 1, fillOpacity: .08, interactive: false }).addTo(layers.me);
  } else { meMarker.setLatLng(state.me); meCircle.setLatLng(state.me); if (acc) meCircle.setRadius(acc); }
}
function invalidateMap() { setTimeout(() => map.invalidateSize(), 280); }
$('mapLocate').onclick = async () => {
  try { const p = await getPosition(); map.setView(p, Math.max(map.getZoom(), 15)); } catch (e) { toast(e.message); }
};
$('mapExpand').onclick = () => { document.body.classList.toggle('map-big'); invalidateMap(); };
new ResizeObserver(() => map.invalidateSize()).observe($('map'));

function pin(latlng, color, end = false) {
  return L.marker(latlng, { icon: divIcon(`<div class="pin${end ? ' end' : ''}" style="--c:${color}"></div>`), interactive: false, zIndexOffset: 500 });
}
function fitTo(latlngs, maxZoom = 16) {
  const pts = latlngs.filter(p => p && Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (!pts.length) return;
  const b = L.latLngBounds(pts);
  map.fitBounds(b.pad(0.12), { maxZoom, animate: true });
}

/* ================================================================== */
/* Autocomplete                                                        */
/* ================================================================== */
function attachAutocomplete(input, { types, withMyLocation = false, onSelect, stations = false }) {
  const wrap = input.closest('.ac-wrap') || input.parentElement;
  const ul = document.createElement('ul');
  ul.className = 'ac'; ul.hidden = true; ul.setAttribute('role', 'listbox');
  wrap.appendChild(ul);
  let items = [], active = -1, ctrl = null;

  const render = () => {
    ul.innerHTML = items.map((it, i) => `<li role="option" data-i="${i}" class="${i === active ? 'active' : ''}">
      <span class="ac-ico">${it.icon}</span><span class="ac-main"><div class="ac-name">${esc(it.name)}</div>${it.sub ? `<div class="ac-sub">${it.sub}</div>` : ''}</span></li>`).join('');
    ul.hidden = !items.length;
  };
  const choose = i => {
    const it = items[i]; if (!it) return;
    ul.hidden = true; items = [];
    input.value = it.value ?? it.name;
    onSelect(it.data, it);
  };
  const extra = q => {
    const out = [];
    if (withMyLocation) out.push({ icon: '◎', name: 'Mijn locatie', sub: 'Huidige GPS-positie', data: { myLocation: true } });
    const fav = db.get('places', {});
    for (const [k, p] of Object.entries(fav)) {
      if (p && (!q || p.label.toLowerCase().includes(q.toLowerCase()) || (k === 'home' ? 'thuis' : 'werk').startsWith(q.toLowerCase())))
        out.push({ icon: k === 'home' ? '🏠' : '💼', name: k === 'home' ? 'Thuis' : 'Werk / school', sub: esc(p.label), value: p.label, data: p });
    }
    return out;
  };
  const search = debounce(async () => {
    const q = input.value.trim();
    ctrl?.abort();
    if (q.length < 2) { items = extra(''); active = -1; render(); return; }
    if (stations) {
      const list = await api.irailStations().catch(() => []);
      const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[-\s]+/g, ' ');
      const nq = norm(q);
      items = list.filter(s => norm(s.name).includes(nq) || norm(s.local).includes(nq))
        .sort((a, b) => norm(a.name).indexOf(nq) - norm(b.name).indexOf(nq)).slice(0, 10)
        .map(s => ({ icon: '🚆', name: s.name, sub: s.local !== s.name ? esc(s.local) : 'NMBS-station', data: s }));
      active = -1; render(); return;
    }
    ctrl = new AbortController();
    try {
      const res = await api.geocode(q, { types, near: state.me ? state.me.join(',') : null, signal: ctrl.signal });
      items = [...extra(q).filter(x => !x.data.myLocation), ...res.map(m => {
        const { name, sub } = placeLabel(m);
        const op = m.type === 'STOP' ? detectOperator(m.id) : null;
        const icon = m.type === 'STOP' ? (op && op.id !== 'other' ? `<span class="op-tag" style="--c:${op.color};--t:${op.text}">${esc(op.name)}</span>` : '🚏') : m.type === 'ADDRESS' ? '🏠' : '📍';
        const modes = (m.modes || []).map(x => modeInfo(x).icon).filter((v, i, a) => a.indexOf(v) === i).join('');
        return {
          icon, name, sub: esc(sub) + (modes ? ` ${modes}` : ''),
          data: { label: name, type: m.type, id: m.id, lat: m.lat, lon: m.lon, place: m.type === 'STOP' ? m.id : `${m.lat},${m.lon}` }
        };
      })].slice(0, 12);
      if (withMyLocation && 'mijn locatie'.startsWith(q.toLowerCase())) items.unshift(extra('')[0]);
      active = -1; render();
    } catch (e) {
      if (e.name !== 'AbortError') { items = []; render(); }
    }
  }, 220);

  input.addEventListener('input', () => { input.dataset.selected = ''; search(); });
  input.addEventListener('focus', () => { if (!input.value.trim()) { items = extra(''); active = -1; render(); } else if (!input.dataset.selected) search(); });
  input.addEventListener('keydown', e => {
    if (ul.hidden) return;
    if (e.key === 'ArrowDown') { active = Math.min(items.length - 1, active + 1); render(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { active = Math.max(0, active - 1); render(); e.preventDefault(); }
    else if (e.key === 'Enter' && items.length) { choose(active >= 0 ? active : 0); e.preventDefault(); }
    else if (e.key === 'Escape') { ul.hidden = true; }
  });
  ul.addEventListener('mousedown', e => e.preventDefault());
  ul.addEventListener('click', e => { const li = e.target.closest('li'); if (li) choose(+li.dataset.i); });
  input.addEventListener('blur', () => setTimeout(() => { ul.hidden = true; }, 150));
}

/* ================================================================== */
/* PLANNEN                                                             */
/* ================================================================== */
const planEls = { from: $('fromInput'), to: $('toInput'), timeMode: $('timeMode'), time: $('timeInput') };

function setPlace(which, p) {
  state[which] = p;
  const input = which === 'from' ? planEls.from : planEls.to;
  input.value = p ? p.label : '';
  input.dataset.selected = p ? '1' : '';
}
async function resolveMyLocation() {
  const pos = await getPosition();
  return { label: 'Mijn locatie', place: `${pos[0].toFixed(6)},${pos[1].toFixed(6)}`, lat: pos[0], lon: pos[1], my: true };
}
attachAutocomplete(planEls.from, { withMyLocation: true, onSelect: async p => {
  if (p.myLocation) { try { setPlace('from', await resolveMyLocation()); } catch (e) { toast(e.message); setPlace('from', null); } }
  else setPlace('from', p);
  if (state.from && !state.to) planEls.to.focus();
} });
attachAutocomplete(planEls.to, { withMyLocation: true, onSelect: async p => {
  if (p.myLocation) { try { setPlace('to', await resolveMyLocation()); } catch (e) { toast(e.message); setPlace('to', null); } }
  else setPlace('to', p);
  if (state.from && state.to) runPlan();
} });
$('fromLocate').onclick = async () => {
  try { setPlace('from', await resolveMyLocation()); toast('Vertrekpunt: je huidige locatie'); } catch (e) { toast(e.message); }
};
$('swapBtn').onclick = () => { const f = state.from, t = state.to; setPlace('from', t); setPlace('to', f); };

const localInputValue = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
planEls.timeMode.onchange = () => {
  planEls.time.hidden = planEls.timeMode.value === 'now';
  if (!planEls.time.value) planEls.time.value = localInputValue(new Date());
};
document.querySelectorAll('#modeChips .chip').forEach(c => c.onclick = () => { c.classList.toggle('on'); saveOpts(); });
['maxTransfers', 'walkSpeed', 'wheelchair'].forEach(id => $(id).addEventListener('change', saveOpts));
function getOpts() {
  return {
    modes: [...document.querySelectorAll('#modeChips .chip.on')].map(c => c.dataset.mode),
    maxTransfers: $('maxTransfers').value === '' ? undefined : Number($('maxTransfers').value),
    walkSpeed: Number($('walkSpeed').value) || 1.2,
    wheelchair: $('wheelchair').checked
  };
}
function saveOpts() {
  const o = getOpts(); db.set('opts', o);
  const off = 4 - o.modes.length;
  $('optSummary').textContent = [off ? `${off} uit` : '', o.maxTransfers !== undefined ? `≤${o.maxTransfers} overst.` : '', o.wheelchair ? '♿' : ''].filter(Boolean).join(' · ');
}
(function loadOpts() {
  const o = db.get('opts', null); if (!o) return;
  document.querySelectorAll('#modeChips .chip').forEach(c => c.classList.toggle('on', o.modes.includes(c.dataset.mode)));
  $('maxTransfers').value = o.maxTransfers ?? '';
  $('walkSpeed').value = String(o.walkSpeed || 1.2);
  $('wheelchair').checked = !!o.wheelchair;
  saveOpts();
})();

$('planForm').addEventListener('submit', e => { e.preventDefault(); runPlan(); });

let planCtrl = null;
async function runPlan(pageCursor, direction) {
  const status = $('planStatus');
  if (!state.from || !state.to) {
    // probeer vrije tekst eerst te geocoderen
    for (const w of ['from', 'to']) {
      const input = w === 'from' ? planEls.from : planEls.to;
      if (!state[w] && input.value.trim().length >= 2) {
        if (/^mijn locatie$/i.test(input.value.trim())) { try { setPlace(w, await resolveMyLocation()); } catch { /* */ } continue; }
        try {
          const r = (await api.geocode(input.value.trim(), { near: state.me?.join(',') }))[0];
          if (r) { const { name } = placeLabel(r); setPlace(w, { label: name, type: r.type, id: r.id, lat: r.lat, lon: r.lon, place: r.type === 'STOP' ? r.id : `${r.lat},${r.lon}` }); }
        } catch { /* */ }
      }
    }
    if (!state.from || !state.to) { setStatus(status, 'Kies een vertrekpunt en een bestemming uit de lijst.', { error: true }); return; }
  }
  if (state.from.place === state.to.place) { setStatus(status, 'Vertrekpunt en bestemming zijn hetzelfde.', { error: true }); return; }
  const opts = getOpts();
  if (!opts.modes.length) { setStatus(status, 'Zet minstens één vervoermiddel aan bij Opties.', { error: true }); return; }
  const mode = planEls.timeMode.value;
  const req = {
    from: state.from.place, to: state.to.place,
    time: mode === 'now' ? undefined : new Date(planEls.time.value || Date.now()),
    arriveBy: mode === 'arr', ...opts
  };
  if (!pageCursor) state.planReq = req;
  planCtrl?.abort(); planCtrl = new AbortController();
  $('planBtn').disabled = true;
  setStatus(status, 'Reisadvies zoeken bij NMBS, De Lijn, TEC en MIVB…', { busy: true });
  if (!pageCursor) $('planResults').innerHTML = '';
  try {
    const res = await api.plan({ ...(pageCursor ? state.planReq : req), pageCursor, signal: planCtrl.signal });
    const its = (res.itineraries || []).filter(it => it.legs?.length);
    if (pageCursor && state.plan) {
      const merged = direction === 'earlier' ? [...its, ...state.plan.itineraries] : [...state.plan.itineraries, ...its];
      const seen = new Set();
      state.plan.itineraries = merged.filter(it => { const k = it.startTime + it.endTime + it.legs.map(l => l.tripId || l.mode).join(); if (seen.has(k)) return false; seen.add(k); return true; });
      if (direction === 'earlier') state.plan.previousPageCursor = res.previousPageCursor; else state.plan.nextPageCursor = res.nextPageCursor;
    } else {
      state.plan = { ...res, itineraries: its, direct: res.direct || [] };
    }
    addRecent(state.from, state.to);
    renderPlan();
    setStatus(status, '');
  } catch (e) {
    const m = errMsg(e);
    if (m) setStatus(status, m.includes('HTTP 4') ? 'Geen route gevonden voor deze plaatsen.' : m, { error: true });
  } finally {
    $('planBtn').disabled = false;
  }
}

function legSummary(it) {
  const parts = [];
  it.legs.forEach(l => {
    if (isTransitMode(l.mode)) parts.push(badge(l, detectOperator(l.tripId, l.agencyName, l.from?.stopId), l.mode));
    else if (l.duration >= 120 || it.legs.length === 1) parts.push(`<span class="walk-pill">${modeInfo(l.mode).icon}${Math.round(l.duration / 60)}′</span>`);
  });
  return parts.join('<span class="sep">›</span>');
}
function itinFirstTransit(it) { return it.legs.find(l => isTransitMode(l.mode)); }

function renderPlan() {
  const box = $('planResults');
  const p = state.plan;
  if (!p) { box.innerHTML = ''; return; }
  let html = '';
  if (!p.itineraries.length && !p.direct.length) {
    box.innerHTML = '<div class="empty">Geen verbindingen gevonden. Probeer een ander tijdstip of minder filters.</div>';
    return;
  }
  html += `<div class="row" style="margin:0 0 8px;justify-content:space-between"><b>${esc(state.from.label)} → ${esc(state.to.label)}</b>
    <button class="btn small" id="saveRoute">☆ Bewaar route</button></div>`;
  if (p.previousPageCursor) html += `<div class="page-btns"><button class="btn small" id="earlier">↑ Eerdere verbindingen</button></div><div style="height:8px"></div>`;
  let lastDay = '';
  p.itineraries.forEach((it, i) => {
    const day = dayLabel(it.startTime);
    if (day !== lastDay && (lastDay || day !== dayLabel(Date.now()))) html += `<div class="muted small" style="margin:8px 4px">${esc(day)}</div>`;
    lastDay = day;
    const ft = itinFirstTransit(it);
    const depDelay = ft ? delayMin(ft.startTime, ft.scheduledStartTime) : 0;
    const anyCancel = it.legs.some(l => l.cancelled);
    html += `<article class="itin" tabindex="0" data-i="${i}">
      <div class="itin-top"><div class="itin-times">${hhmm(it.startTime)} → ${hhmm(it.endTime)}</div><div class="itin-dur">${duration(it.duration)}</div></div>
      <div class="itin-legs">${legSummary(it)}</div>
      <div class="itin-meta">${anyCancel ? '<span class="cancel">Rit afgeschaft · </span>' : ''}${it.transfers ? `${it.transfers} overstap${it.transfers > 1 ? 'pen' : ''}` : 'Rechtstreeks'}
      ${ft ? ` · ${modeInfo(ft.mode).icon} <b>${hhmm(ft.startTime)}</b>${depDelay ? ` <span class="delay">+${depDelay}</span>` : ''} ${esc(ft.from.name)}${ft.from.track ? ` (spoor ${esc(ft.from.track)})` : ''}` : ''}
      · vertrekt ${relMinutes(it.startTime)}</div>
    </article>`;
  });
  (p.direct || []).filter(d => d.duration < 3600).forEach((it, i) => {
    html += `<article class="itin" tabindex="0" data-direct="${i}"><div class="itin-top"><div class="itin-times">${modeInfo(it.legs[0]?.mode).icon} Te voet</div><div class="itin-dur">${duration(it.duration)}</div></div>
    <div class="itin-meta">${distance(it.legs.reduce((s, l) => s + (l.distance || 0), 0))} · aankomst ${hhmm(it.endTime)}</div></article>`;
  });
  if (p.nextPageCursor) html += `<div class="page-btns"><button class="btn small" id="later">↓ Latere verbindingen</button></div>`;
  box.innerHTML = html;
  box.querySelectorAll('.itin').forEach(el => {
    const open = () => {
      const it = el.dataset.direct !== undefined ? p.direct[+el.dataset.direct] : p.itineraries[+el.dataset.i];
      state.currentItin = it;
      go('#/route');
    };
    el.onclick = open; el.onkeydown = e => { if (e.key === 'Enter') open(); };
  });
  $('earlier')?.addEventListener('click', () => runPlan(p.previousPageCursor, 'earlier'));
  $('later')?.addEventListener('click', () => runPlan(p.nextPageCursor, 'later'));
  $('saveRoute').onclick = () => saveRoute(state.from, state.to);
  // preview van de eerste route op de kaart
  if (p.itineraries[0] && state.view === 'plan') drawItinerary(p.itineraries[0], { fit: true });
}

function legLatLngs(leg) {
  const g = leg.legGeometry;
  if (g?.points) {
    const prec = g.precision ?? (state.plan?._version === 1 ? 7 : 6);
    const pts = decodePolyline(g.points, prec);
    if (pts.length > 1) return pts;
  }
  const pts = [[leg.from.lat, leg.from.lon]];
  (leg.intermediateStops || []).forEach(s => pts.push([s.lat, s.lon]));
  pts.push([leg.to.lat, leg.to.lon]);
  return pts;
}
function drawItinerary(it, { fit = true } = {}) {
  layers.route.clearLayers();
  const all = [];
  it.legs.forEach(leg => {
    const pts = legLatLngs(leg);
    all.push(...pts);
    if (isTransitMode(leg.mode)) {
      const { bg } = lineColors(leg, detectOperator(leg.tripId, leg.agencyName));
      L.polyline(pts, { color: '#fff', weight: 9, opacity: .9 }).addTo(layers.route);
      L.polyline(pts, { color: bg, weight: 6, opacity: 1 }).addTo(layers.route)
        .bindTooltip(`${modeInfo(leg.mode).icon} ${esc(lineName(leg))} → ${esc(leg.headsign || leg.to.name)}`, { sticky: true });
      L.circleMarker([leg.from.lat, leg.from.lon], { radius: 5, color: bg, weight: 3, fillColor: '#fff', fillOpacity: 1 }).addTo(layers.route).bindTooltip(esc(leg.from.name));
      L.circleMarker([leg.to.lat, leg.to.lon], { radius: 5, color: bg, weight: 3, fillColor: '#fff', fillOpacity: 1 }).addTo(layers.route).bindTooltip(esc(leg.to.name));
    } else {
      L.polyline(pts, { color: '#5d6b80', weight: 4, dashArray: '2 8', lineCap: 'round' }).addTo(layers.route);
    }
  });
  const first = it.legs[0], last = it.legs[it.legs.length - 1];
  pin([first.from.lat, first.from.lon], '#0a6cff').addTo(layers.route);
  pin([last.to.lat, last.to.lon], '#d0182b', true).addTo(layers.route);
  if (fit) fitTo(all);
}

function stopTimeCell(p, kind) {
  const actual = kind === 'arr' ? p.arrival : p.departure;
  const sched = kind === 'arr' ? p.scheduledArrival : p.scheduledDeparture;
  return `${hhmm(actual || sched)}${delayHtml(actual, sched, false)}`;
}

function renderItineraryDetail(it, { live = false } = {}) {
  const legs = it.legs;
  let html = '';
  html += `<div class="card summary-box"><div><div class="big">${hhmm(it.startTime)} → ${hhmm(it.endTime)}</div>
    <div class="muted small">${dayLabel(it.startTime)} · ${duration(it.duration)} · ${it.transfers ? it.transfers + ' overstap' + (it.transfers > 1 ? 'pen' : '') : 'rechtstreeks'}</div></div>
    ${live ? '' : '<button class="btn primary" id="startFollow">▶ Volg deze reis live</button>'}</div>`;
  html += '<div class="card timeline">';
  legs.forEach((leg, i) => {
    const transit = isTransitMode(leg.mode);
    const op = detectOperator(leg.tripId, leg.agencyName, leg.from?.stopId);
    const { bg } = transit ? lineColors(leg, op) : { bg: '' };
    const lc = transit ? `--lc:${bg}` : '';
    const showFrom = i === 0 || transit;
    if (showFrom) {
      html += `<div class="leg ${transit ? '' : 'walk'}" style="${lc}">
        <div class="t">${hhmm(leg.startTime)}${transit ? `<small>${delayHtml(leg.startTime, leg.scheduledStartTime, leg.realTime)}</small>` : ''}</div>
        <div class="rail"><div class="dot"></div></div>
        <div class="body"><div class="stop-name">${esc(leg.from.name)} ${trackHtml(leg.from)}</div>`;
    } else {
      html += `<div class="leg walk"><div class="t"></div><div class="rail"></div><div class="body">`;
    }
    if (transit) {
      const n = (leg.intermediateStops || []).length;
      html += `<div class="leg-info">
        <div class="line">${badge(leg, op, leg.mode)} ${opTag(op)} <b>→ ${esc(leg.headsign || leg.to.name)}</b></div>
        <div class="muted small" style="margin-top:4px">${duration(leg.duration)}${n ? ` · ${n} tussenhalte${n > 1 ? 's' : ''}` : ''}${leg.realTime ? ' · <span class="rt">● realtime</span>' : ''}${leg.cancelled ? ' · <span class="cancel">AFGESCHAFT</span>' : ''}</div>
        ${alertsHtml(leg.alerts)}
        <div class="row" style="margin-top:4px">
          ${n ? `<button class="linklike" data-toggle="${i}">Toon haltes ▾</button>` : ''}
          ${leg.tripId ? `<button class="linklike" data-trip="${esc(leg.tripId)}">🛰 Live positie voertuig</button>` : ''}
        </div>
        ${n ? `<ul class="leg-stops" id="ls-${i}" hidden>${leg.intermediateStops.map(s => `<li><span>${hhmm(s.departure || s.arrival)}</span><span>${esc(s.name)}${s.cancelled ? ' <span class="cancel">(vervalt)</span>' : ''}</span></li>`).join('')}</ul>` : ''}
      </div></div></div>`;
      html += `<div class="leg" style="${lc}"><div class="t">${hhmm(leg.endTime)}<small>${delayHtml(leg.endTime, leg.scheduledEndTime, leg.realTime)}</small></div>
        <div class="rail"><div class="dot"></div></div><div class="body"><div class="stop-name">${esc(leg.to.name)} ${trackHtml(leg.to)}</div></div></div>`;
    } else {
      html += `<div class="muted small" style="padding:6px 0 12px">${modeInfo(leg.mode).icon} ${modeInfo(leg.mode).label} ${duration(leg.duration)}${leg.distance ? ` (${distance(leg.distance)})` : ''}${i === legs.length - 1 || !isTransitMode(legs[i + 1]?.mode) ? ` naar <b>${esc(leg.to.name)}</b>` : ''}</div></div></div>`;
    }
  });
  const last = legs[legs.length - 1];
  if (!isTransitMode(last.mode)) {
    html += `<div class="leg"><div class="t">${hhmm(last.endTime)}</div><div class="rail"><div class="dot" style="border-color:var(--bad)"></div></div><div class="body"><div class="stop-name">${esc(last.to.name === 'END' ? state.to?.label || 'Bestemming' : last.to.name)}</div></div></div>`;
  }
  html += '</div>';
  return html;
}
function bindItineraryDetail(root) {
  root.querySelectorAll('[data-toggle]').forEach(b => b.onclick = () => {
    const ul = $('ls-' + b.dataset.toggle); ul.hidden = !ul.hidden; b.textContent = ul.hidden ? 'Toon haltes ▾' : 'Verberg haltes ▴';
  });
  root.querySelectorAll('[data-trip]').forEach(b => b.onclick = () => go('#/trip/' + encodeURIComponent(b.dataset.trip)));
}

function placeName(p, fallback) { return !p?.name || p.name === 'START' || p.name === 'END' ? fallback : p.name; }

function showRouteDetail() {
  const it = state.currentItin;
  if (!it) return go('#/plan', true);
  it.legs[0].from.name = placeName(it.legs[0].from, state.from?.label || 'Vertrek');
  it.legs[it.legs.length - 1].to.name = placeName(it.legs[it.legs.length - 1].to, state.to?.label || 'Bestemming');
  detail(`${esc(state.from?.label || '')} → ${esc(state.to?.label || '')}<small>Reisadvies</small>`, renderItineraryDetail(it), [
    { icon: '⤴', title: 'Delen', fn: () => shareRoute() }
  ]);
  drawItinerary(it);
  bindItineraryDetail($('detailBody'));
  $('startFollow')?.addEventListener('click', () => startFollow(it));
}
function shareRoute() {
  const f = state.from, t = state.to;
  const enc = p => encodeURIComponent(`${p.place}|${p.label}`);
  const url = `${location.origin}${location.pathname}#/plan?f=${enc(f)}&t=${enc(t)}`;
  if (navigator.share) navigator.share({ title: 'OVFlow-route', text: `${f.label} → ${t.label}`, url }).catch(() => {});
  else navigator.clipboard?.writeText(url).then(() => toast('Link gekopieerd'), () => toast(url));
}

/* ---------- Recente/bewaarde routes ---------- */
const slim = p => p && ({ label: p.label, place: p.place, lat: p.lat, lon: p.lon, type: p.type, id: p.id, my: p.my });
function addRecent(f, t) {
  if (f.my || t.my) return;
  const list = db.get('recent', []).filter(r => !(r.from.place === f.place && r.to.place === t.place));
  list.unshift({ from: slim(f), to: slim(t) });
  db.set('recent', list.slice(0, 6));
  renderQuick();
}
function saveRoute(f, t) {
  const list = db.get('routes', []);
  if (list.some(r => r.from.place === f.place && r.to.place === t.place)) return toast('Route staat al bij je favorieten');
  list.push({ from: slim(f), to: slim(t) }); db.set('routes', list);
  toast('Route bewaard ⭐'); renderQuick(); renderFav();
}
function renderQuick() {
  const box = $('quickRoutes');
  const places = db.get('places', {});
  const btns = [];
  if (places.home) btns.push({ label: '🏠 Naar huis', fn: () => quickTo(places.home) });
  if (places.work) btns.push({ label: '💼 Naar werk', fn: () => quickTo(places.work) });
  db.get('routes', []).forEach(r => btns.push({ label: `⭐ ${r.from.label} → ${r.to.label}`, fn: () => { setPlace('from', r.from); setPlace('to', r.to); runPlan(); } }));
  db.get('recent', []).slice(0, 4).forEach(r => btns.push({ label: `🕑 ${r.from.label} → ${r.to.label}`, fn: () => { setPlace('from', r.from); setPlace('to', r.to); runPlan(); } }));
  box.innerHTML = '';
  btns.forEach(b => { const el = document.createElement('button'); el.type = 'button'; el.textContent = b.label; el.onclick = b.fn; box.appendChild(el); });
}
async function quickTo(place) {
  try { setPlace('from', await resolveMyLocation()); } catch (e) { toast(e.message); return; }
  setPlace('to', place); runPlan();
}

/* ================================================================== */
/* LIVE VOLGEN van een reisadvies                                      */
/* ================================================================== */
let watchId = null;
function startFollow(it) {
  state.follow = { itin: it, from: slim(state.from), to: slim(state.to), started: Date.now() };
  state.notified = new Set();
  db.set('follow', state.follow); db.set('notified', []);
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  toast('Live volgen gestart – je krijgt meldingen bij vertragingen en overstappen');
  initFollow();
  go('#/follow');
}
function stopFollow() {
  state.follow = null; db.del('follow'); db.del('notified');
  stop('followTick'); stop('followRefresh');
  if (watchId != null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
  layers.follow.clearLayers(); followTick.marker = null; followTick.key = null;
  $('followBar').hidden = true;
  if (location.hash.startsWith('#/follow')) go('#/plan', true);
}
function initFollow() {
  if (!state.follow) return;
  if (toMs(state.follow.itin.endTime) < Date.now() - 30 * 60000) { stopFollow(); return; }
  $('followBar').hidden = false;
  every('followTick', followTick, 1000);
  every('followRefresh', followRefresh, 30000);
  if (navigator.geolocation && watchId == null) {
    watchId = navigator.geolocation.watchPosition(p => { state.me = [p.coords.latitude, p.coords.longitude]; state.meTime = Date.now(); showMe(p.coords.accuracy); }, () => {}, { enableHighAccuracy: true, maximumAge: 10000 });
  }
}
$('fbStop').onclick = () => { if (confirm('Stoppen met live volgen?')) stopFollow(); };
$('fbOpen').onclick = () => go('#/follow');
$('followBar').querySelector('.fb-text').onclick = () => go('#/follow');

async function followRefresh() {
  const f = state.follow; if (!f) return;
  const legs = f.itin.legs.filter(l => isTransitMode(l.mode) && l.tripId && toMs(l.endTime) > Date.now() - 60000);
  await Promise.all(legs.map(async leg => {
    try {
      const t = await api.trip(leg.tripId);
      const stops = tripStops(t);
      const match = (p) => stops.find(s => (p.stopId && s.stopId === p.stopId)) || stops.find(s => s.name === p.name);
      const a = match(leg.from), b = match(leg.to);
      const before = delayMin(leg.startTime, leg.scheduledStartTime);
      if (a) { leg.from.departure = a.departure || leg.from.departure; leg.startTime = a.departure || leg.startTime; leg.from.track = a.track || leg.from.track; if (a.cancelled) leg.cancelled = true; }
      if (b) { leg.to.arrival = b.arrival || leg.to.arrival; leg.endTime = b.arrival || leg.endTime; leg.to.track = b.track || leg.to.track; }
      leg.realTime = true;
      leg._trip = { stops, shape: tripShape(t) };
      const after = delayMin(leg.startTime, leg.scheduledStartTime);
      if (Math.abs(after - before) >= 2 && toMs(leg.startTime) > Date.now()) {
        notifyOnce(`delay-${leg.tripId}-${after}`, `${lineName(leg)} ${after > 0 ? `+${after} min vertraging` : 'weer op tijd'}`, `Vertrek ${hhmm(leg.startTime)} uit ${leg.from.name}`);
      }
      if (leg.cancelled) notifyOnce(`cancel-${leg.tripId}`, `⚠️ ${lineName(leg)} is afgeschaft`, 'Plan een nieuwe route in OVFlow');
    } catch { /* volgende poging */ }
  }));
  const L0 = f.itin.legs;
  f.itin.startTime = L0[0].startTime; f.itin.endTime = L0[L0.length - 1].endTime;
  // overstaprisico
  const tl = L0.filter(l => isTransitMode(l.mode));
  for (let i = 0; i < tl.length - 1; i++) {
    const slack = (toMs(tl[i + 1].startTime) - toMs(tl[i].endTime)) / 60000;
    if (slack < 2 && toMs(tl[i + 1].startTime) > Date.now()) notifyOnce(`risk-${i}-${Math.round(slack)}`, '⚠️ Overstap in gevaar', `Nog ${Math.max(0, Math.round(slack))} min om over te stappen op ${lineName(tl[i + 1])} in ${tl[i + 1].from.name}`);
  }
  db.set('follow', f);
  if (location.hash.startsWith('#/follow')) renderFollowDetail(false);
}

function followStatus(now = Date.now()) {
  const f = state.follow; const legs = f.itin.legs;
  const start = toMs(f.itin.startTime), end = toMs(f.itin.endTime);
  const nextTransit = from => legs.slice(from).find(l => isTransitMode(l.mode));
  const progress = Math.max(0, Math.min(1, (now - start) / Math.max(1, end - start)));
  if (now >= end) return { icon: '🎉', title: 'Je bent aangekomen', sub: `${f.to?.label || ''} om ${hhmm(end)}`, progress: 1, done: true };
  if (now < start) {
    const nt = nextTransit(0);
    return { icon: '⏱', title: `Vertrek over ${Math.max(0, Math.round((start - now) / 60000))} min`, sub: nt ? `${lineName(nt)} om ${hhmm(nt.startTime)} uit ${nt.from.name}${nt.from.track ? ` · spoor ${nt.from.track}` : ''}` : `${f.to?.label}`, progress: 0 };
  }
  for (let i = 0; i < legs.length; i++) {
    const l = legs[i], s = toMs(l.startTime), e = toMs(l.endTime);
    if (now >= s && now < e) {
      if (isTransitMode(l.mode)) {
        return { icon: modeInfo(l.mode).icon, title: `${lineName(l)} → ${l.headsign || l.to.name}`, sub: `Uitstappen: ${l.to.name} om ${hhmm(e)} (${relMinutes(e, now)})`, progress, leg: l, legIndex: i };
      }
      const nt = nextTransit(i + 1);
      return { icon: '🚶', title: `Wandel naar ${l.to.name}`, sub: nt ? `${lineName(nt)} vertrekt ${hhmm(nt.startTime)} (${relMinutes(nt.startTime, now)})` : `Aankomst ${hhmm(e)}`, progress, legIndex: i, nextLeg: nt };
    }
    const next = legs[i + 1];
    if (next && now >= e && now < toMs(next.startTime)) {
      const nt = nextTransit(i + 1);
      return { icon: '⏳', title: `Wacht op ${nt ? lineName(nt) : 'vertrek'}`, sub: nt ? `${nt.from.name}${nt.from.track ? ` · spoor ${nt.from.track}` : ''} · ${hhmm(nt.startTime)} (${relMinutes(nt.startTime, now)})` : '', progress, nextLeg: nt };
    }
  }
  return { icon: '🧭', title: 'Onderweg', sub: `Aankomst ${hhmm(end)}`, progress };
}

function followTick() {
  const f = state.follow; if (!f) return;
  const now = Date.now();
  const st = followStatus(now);
  $('fbIcon').textContent = st.icon; $('fbTitle').textContent = st.title; $('fbSub').textContent = st.sub;
  if (st.done && now > toMs(f.itin.endTime) + 10 * 60000) { stopFollow(); return; }
  // meldingen op het juiste moment
  const legs = f.itin.legs;
  const firstT = legs.find(l => isTransitMode(l.mode));
  if (firstT) {
    const walkBefore = legs.slice(0, legs.indexOf(firstT)).reduce((s, l) => s + (l.duration || 0), 0) * 1000;
    const leaveAt = toMs(firstT.startTime) - walkBefore;
    if (now >= leaveAt - 3 * 60000 && now < leaveAt) notifyOnce('leave', '🚶 Tijd om te vertrekken', `${lineName(firstT)} vertrekt om ${hhmm(firstT.startTime)} uit ${firstT.from.name}`);
  }
  legs.forEach((l, i) => {
    if (!isTransitMode(l.mode)) return;
    const e = toMs(l.endTime);
    if (now >= e - 2.5 * 60000 && now < e) notifyOnce(`off-${i}`, `🔔 Bijna uitstappen: ${l.to.name}`, `Om ${hhmm(e)}${l.to.track ? ` · spoor ${l.to.track}` : ''}`);
  });
  // voertuigpositie op de kaart
  const leg = st.leg || st.nextLeg;
  if (leg?._trip) {
    const vp = vehiclePosition(leg._trip.stops.map(s => ({ lat: s.lat, lon: s.lon, arr: toMs(s.arrival || s.departure), dep: toMs(s.departure || s.arrival) })), leg._trip.shape, now);
    if (vp) {
      const op = detectOperator(leg.tripId, leg.agencyName);
      const { bg, fg } = lineColors(leg, op);
      const key = leg.tripId;
      if (!followTick.marker || followTick.key !== key) {
        layers.follow.clearLayers();
        followTick.marker = L.marker(vp.pos, { icon: divIcon(`<div class="veh big" style="--c:${bg};--t:${fg}">${esc(lineName(leg))}</div>`), zIndexOffset: 1500 })
          .bindTooltip(`${esc(lineName(leg))} → ${esc(leg.headsign || '')}`).addTo(layers.follow);
        followTick.key = key;
      } else followTick.marker.setLatLng(vp.pos);
    }
  } else if (followTick.marker) { layers.follow.clearLayers(); followTick.marker = null; followTick.key = null; }
  if (location.hash.startsWith('#/follow')) {
    const box = document.querySelector('#detailBody .live-box');
    if (box) { box.querySelector('.now').textContent = `${st.icon} ${st.title}`; box.querySelector('.sub').textContent = st.sub; box.querySelector('.bar i').style.width = `${Math.round(st.progress * 100)}%`; }
  }
}

function renderFollowDetail(fit = true) {
  const f = state.follow;
  if (!f) { go('#/plan', true); return; }
  const st = followStatus();
  const html = `<div class="live-box"><div class="now">${st.icon} ${esc(st.title)}</div><div class="sub">${esc(st.sub)}</div><div class="bar"><i style="width:${Math.round(st.progress * 100)}%"></i></div></div>
    ${renderItineraryDetail(f.itin, { live: true })}
    <button class="btn danger" id="stopFollowBtn" style="width:100%">■ Stop met volgen</button>`;
  detail(`${esc(f.from?.label || '')} → ${esc(f.to?.label || '')}<small>Live reis · ververst elke 30 s</small>`, html, [
    { icon: '↻', title: 'Vernieuwen', fn: () => followRefresh() }
  ]);
  bindItineraryDetail($('detailBody'));
  $('stopFollowBtn').onclick = () => stopFollow();
  drawItinerary(f.itin, { fit });
}

/* ---------- Meldingen ---------- */
function notifyOnce(key, title, body) {
  if (state.notified.has(key)) return;
  state.notified.add(key); db.set('notified', [...state.notified].slice(-50));
  notify(title, body);
}
async function notify(title, body) {
  toast(`${title} – ${body}`, 6000);
  navigator.vibrate?.([200, 100, 200]);
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, icon: './icons/icon-192.png', badge: './icons/icon-192.png', tag: 'ovflow-' + title, renotify: true });
    else new Notification(title, { body, icon: './icons/icon-192.png' });
  } catch { /* geen meldingen mogelijk */ }
}

/* ================================================================== */
/* RIT (MOTIS trip) – live positie                                     */
/* ================================================================== */
function tripStops(t) {
  const out = [];
  (t.legs || []).filter(l => isTransitMode(l.mode)).forEach((l, li) => {
    if (li === 0) out.push({ ...l.from });
    (l.intermediateStops || []).forEach(s => out.push({ ...s }));
    out.push({ ...l.to });
  });
  // dubbele overgangen bij gekoppelde ritten samenvoegen
  return out.filter((s, i) => !(i > 0 && s.stopId && s.stopId === out[i - 1].stopId));
}
function tripShape(t) {
  const pts = [];
  (t.legs || []).forEach(l => {
    if (l.legGeometry?.points) pts.push(...decodePolyline(l.legGeometry.points, l.legGeometry.precision ?? (t._version === 1 ? 7 : 6)));
  });
  return pts;
}

async function showTrip(tripId) {
  detail('<span class="spinner"></span> Rit laden…', '', []);
  layers.trip.clearLayers();
  let t, follow = true;
  const load = async () => {
    try {
      t = await api.trip(tripId);
      render();
    } catch (e) {
      if (!t) $('detailBody').innerHTML = `<div class="empty">Deze rit kon niet geladen worden.<br><small>${esc(errMsg(e))}</small></div>`;
    }
  };
  let shape = [], stops = [], marker = null, firstDraw = true;
  const render = () => {
    const leg = (t.legs || []).find(l => isTransitMode(l.mode)) || t.legs?.[0];
    if (!leg) return;
    const op = detectOperator(leg.tripId || tripId, leg.agencyName, leg.from?.stopId);
    const { bg, fg } = lineColors(leg, op);
    stops = tripStops(t); shape = tripShape(t);
    const now = Date.now();
    const vp = vehiclePosition(stops.map(s => ({ lat: s.lat, lon: s.lon, arr: toMs(s.arrival || s.departure), dep: toMs(s.departure || s.arrival) })), shape, now);
    const cur = vp ? (vp.state === 'running' ? vp.next : vp.index) : -1;
    const lastStop = stops[stops.length - 1];
    let html = `<div class="card"><div class="line row" style="margin:0">${badge(leg, op, leg.mode)} ${opTag(op)} <b>→ ${esc(leg.headsign || lastStop?.name || '')}</b></div>
      <div class="muted small" style="margin-top:6px">${esc(leg.agencyName || op.full)} · ${modeInfo(leg.mode).label}${leg.tripShortName && leg.tripShortName !== lineName(leg) ? ' ' + esc(leg.tripShortName) : ''}
      ${leg.realTime ? ' · <span class="rt">● realtime</span>' : ' · dienstregeling'}${leg.cancelled ? ' · <span class="cancel">AFGESCHAFT</span>' : ''}</div>
      ${vp ? `<div style="margin-top:8px;font-weight:700">${vp.state === 'before' ? `Vertrekt ${relMinutes(stops[0].departure)} uit ${esc(stops[0].name)}` : vp.state === 'after' ? 'Rit beëindigd' : vp.state === 'at-stop' ? `Staat nu in ${esc(stops[vp.index].name)}` : `Rijdt nu naar ${esc(stops[vp.next].name)}`}</div>` : ''}
      ${alertsHtml(leg.alerts)}
      <label class="check small"><input type="checkbox" id="followVeh" ${follow ? 'checked' : ''}> Kaart volgt het voertuig</label></div>`;
    html += `<div class="card"><ul class="stoplist" style="--lc:${bg}">`;
    stops.forEach((s, i) => {
      const passed = cur >= 0 && i < cur;
      const isCur = i === cur && vp && vp.state !== 'after';
      const arr = s.arrival || s.departure, dep = s.departure || s.arrival;
      const schedA = s.scheduledArrival || s.scheduledDeparture, schedD = s.scheduledDeparture || s.scheduledArrival;
      const showArr = i === stops.length - 1;
      html += `<li class="${passed ? 'passed' : ''} ${isCur ? 'current' : ''}">
        <div class="t ${s.cancelled ? 'strike' : ''}">${hhmm(showArr ? arr : dep)}<small>${delayHtml(showArr ? arr : dep, showArr ? schedA : schedD, leg.realTime)}</small></div>
        <div class="rail"><div class="dot"></div></div>
        <div class="nm">${s.stopId ? `<a href="#/stop/${encodeURIComponent(s.stopId)}" class="stoplink">${esc(s.name)}</a>` : esc(s.name)}${s.cancelled ? ' <span class="cancel">vervalt</span>' : ''}
          ${isCur ? `<div class="vehicle-here">${vp.state === 'running' ? '▲ voertuig nadert' : vp.state === 'before' ? '● vertrekpunt' : '● voertuig staat hier'}</div>` : ''}</div>
        <div>${trackHtml(s)}</div></li>`;
      if (s.stopId) rememberStop(s.stopId, s.name);
    });
    html += '</ul></div>';
    $('detailTitle').innerHTML = `${esc(lineName(leg) || modeInfo(leg.mode).label)} → ${esc(leg.headsign || lastStop?.name || '')}<small>Rit live · ververst elke 20 s</small>`;
    $('detailBody').innerHTML = html;
    $('followVeh').onchange = e => { follow = e.target.checked; };
    // kaart
    layers.trip.clearLayers();
    const line = shape.length > 1 ? shape : stops.map(s => [s.lat, s.lon]);
    L.polyline(line, { color: '#fff', weight: 8, opacity: .9 }).addTo(layers.trip);
    L.polyline(line, { color: bg, weight: 5 }).addTo(layers.trip);
    stops.forEach((s, i) => L.circleMarker([s.lat, s.lon], { radius: 4, color: bg, weight: 2, fillColor: i < cur ? bg : '#fff', fillOpacity: 1 }).bindTooltip(`${esc(s.name)} · ${hhmm(s.departure || s.arrival)}`).addTo(layers.trip));
    marker = L.marker(vp ? vp.pos : [stops[0].lat, stops[0].lon], { icon: divIcon(`<div class="veh big" style="--c:${bg};--t:${fg}">${esc(lineName(leg) || modeInfo(leg.mode).icon)}</div>`), zIndexOffset: 1500 }).addTo(layers.trip);
    if (firstDraw) { fitTo(line); firstDraw = false; }
  };
  const tick = () => {
    if (!marker || !stops.length) return;
    const vp = vehiclePosition(stops.map(s => ({ lat: s.lat, lon: s.lon, arr: toMs(s.arrival || s.departure), dep: toMs(s.departure || s.arrival) })), shape, Date.now());
    if (vp) { marker.setLatLng(vp.pos); if (follow && vp.state === 'running' && !map.getBounds().pad(-0.2).contains(vp.pos)) map.panTo(vp.pos); }
  };
  await load();
  every('tripRefresh', load, 20000, false);
  every('tripTick', tick, 1000, false);
  state.detailCleanup = () => { stop('tripRefresh'); stop('tripTick'); layers.trip.clearLayers(); };
}

/* ================================================================== */
/* LIVE KAART                                                          */
/* ================================================================== */
const liveFilter = { ops: new Set(['nmbs', 'delijn', 'tec', 'mivb', 'other']), modes: new Set(['train', 'metro', 'tram', 'bus']) };
document.querySelectorAll('#liveOps .chip').forEach(c => c.onclick = () => {
  c.classList.toggle('on'); c.classList.contains('on') ? liveFilter.ops.add(c.dataset.op) : liveFilter.ops.delete(c.dataset.op); liveTick();
});
document.querySelectorAll('#liveModes .chip').forEach(c => c.onclick = () => {
  c.classList.toggle('on'); c.classList.contains('on') ? liveFilter.modes.add(c.dataset.mode) : liveFilter.modes.delete(c.dataset.mode); liveTick();
});
$('liveLocate').onclick = async () => { try { const p = await getPosition(); map.setView(p, 15); } catch (e) { toast(e.message); } };
$('liveBelgium').onclick = () => map.fitBounds([[49.5, 2.55], [51.5, 6.4]]);

let liveCtrl = null;
async function liveFetch() {
  if (state.view !== 'live') return;
  const z = map.getZoom();
  const b = map.getBounds().pad(0.15);
  if (z < 8) { setStatus($('liveStatus'), 'Zoom verder in om voertuigen te zien.'); state.liveSegments.clear(); liveTick(); return; }
  liveCtrl?.abort(); liveCtrl = new AbortController();
  const now = Date.now();
  try {
    const { segments, precision } = await api.mapTrips({ zoom: z, min: [b.getSouth(), b.getWest()], max: [b.getNorth(), b.getEast()], start: now - 30000, end: now + 150000, signal: liveCtrl.signal });
    const byTrip = new Map();
    for (const s of segments) {
      const id = s.trips?.[0]?.tripId; if (!id) continue;
      const seg = { dep: toMs(s.departure), arr: toMs(s.arrival), pts: null, poly: s.polyline, precision, mode: s.mode, color: s.routeColor, trip: s.trips[0], realTime: s.realTime, from: s.from, to: s.to, schedDep: toMs(s.scheduledDeparture) };
      if (!byTrip.has(id)) byTrip.set(id, []);
      byTrip.get(id).push(seg);
    }
    byTrip.forEach(list => list.sort((a, b) => a.dep - b.dep));
    state.liveSegments = byTrip;
    liveTick();
  } catch (e) {
    const m = errMsg(e); if (m) setStatus($('liveStatus'), m, { error: true });
  }
  if (z >= 15) loadMapStops(); else layers.stops.clearLayers();
}
function liveTick() {
  if (state.view !== 'live') return;
  const now = Date.now(), z = map.getZoom();
  const seen = new Set();
  let count = 0;
  const bounds = map.getBounds().pad(0.05);
  for (const [id, segs] of state.liveSegments) {
    // actief segment, of het volgende segment als het voertuig nog aan een halte staat
    const seg = segs.find(s => now <= s.arr);
    if (!seg || (now < seg.dep && seg.dep - now > 120000)) continue;
    const op = detectOperator(id);
    if (!liveFilter.ops.has(op.id) || !liveFilter.modes.has(modeGroup(seg.mode))) continue;
    if (!seg.pts) { seg.pts = decodePolyline(seg.poly, seg.precision); seg.cum = cumulative(seg.pts); }
    if (!seg.pts.length) continue;
    const f = (now - seg.dep) / Math.max(1, seg.arr - seg.dep);
    const p = pointAlong(seg.pts, f, seg.cum);
    if (!p || !bounds.contains(p.pos)) continue;
    count++;
    seen.add(id);
    const label = seg.trip.displayName || seg.trip.routeShortName || '';
    const { bg, fg } = lineColors({ routeColor: seg.color }, op);
    const cls = z >= 13 ? 'veh' : 'veh dot';
    const key = cls + bg;
    let m = state.liveMarkers.get(id);
    if (!m || m._key !== key) {
      if (m) layers.live.removeLayer(m);
      m = L.marker(p.pos, { icon: divIcon(`<div class="${cls}" style="--c:${bg};--t:${fg}">${esc(label)}</div>`), riseOnHover: true });
      m._key = key;
      m.bindTooltip(() => `${modeInfo(seg.mode).icon} <b>${esc(label)}</b> ${esc(op.name)}<br>${esc(seg.from?.name || '')} → ${esc(seg.to?.name || '')}${seg.realTime ? `<br>${delayMin(seg.dep, seg.schedDep) > 0 ? `+${delayMin(seg.dep, seg.schedDep)} min` : 'op tijd'} (realtime)` : ''}`, { direction: 'top' });
      m.on('click', () => go('#/trip/' + encodeURIComponent(id)));
      m.addTo(layers.live);
      state.liveMarkers.set(id, m);
    } else m.setLatLng(p.pos);
  }
  for (const [id, m] of state.liveMarkers) if (!seen.has(id)) { layers.live.removeLayer(m); state.liveMarkers.delete(id); }
  if (z >= 8) setStatus($('liveStatus'), `${count} voertuig${count === 1 ? '' : 'en'} in beeld${z < 11 ? ' · zoom in voor bussen en trams' : ''}`);
}
let stopsCtrl = null;
async function loadMapStops() {
  const b = map.getBounds();
  stopsCtrl?.abort(); stopsCtrl = new AbortController();
  try {
    const stops = await api.mapStops({ min: [b.getSouth(), b.getWest()], max: [b.getNorth(), b.getEast()], signal: stopsCtrl.signal });
    layers.stops.clearLayers();
    stops.slice(0, 400).forEach(s => {
      const op = detectOperator(s.stopId);
      L.circleMarker([s.lat, s.lon], { radius: 5, color: op.color, weight: 2, fillColor: '#fff', fillOpacity: 1 })
        .bindTooltip(esc(s.name)).on('click', () => { rememberStop(s.stopId, s.name); go('#/stop/' + encodeURIComponent(s.stopId)); }).addTo(layers.stops);
    });
  } catch { /* stil */ }
}
const liveFetchDebounced = debounce(liveFetch, 400);
map.on('moveend', () => { if (state.view === 'live') { liveFetchDebounced(); liveTick(); } });

/* ================================================================== */
/* HALTES & VERTREKKEN                                                 */
/* ================================================================== */
attachAutocomplete($('stopSearch'), { types: ['STOP'], onSelect: p => { if (p.id) { rememberStop(p.id, p.label); go('#/stop/' + encodeURIComponent(p.id)); } } });

$('nearbyBtn').onclick = async () => {
  const st = $('nearbyStatus');
  setStatus(st, 'Locatie bepalen…', { busy: true });
  try {
    const pos = await getPosition();
    setStatus(st, 'Haltes zoeken…', { busy: true });
    const d = 0.006;
    const stops = await api.mapStops({ min: [pos[0] - d, pos[1] - d * 1.5], max: [pos[0] + d, pos[1] + d * 1.5] });
    const byName = new Map();
    stops.forEach(s => {
      const dist = haversine(pos, [s.lat, s.lon]);
      const k = s.parentId || `${s.name}|${detectOperator(s.stopId).id}`;
      if (!byName.has(k) || byName.get(k).dist > dist) byName.set(k, { ...s, dist });
    });
    const list = [...byName.values()].sort((a, b) => a.dist - b.dist).slice(0, 15);
    if (!list.length) { setStatus(st, 'Geen haltes gevonden binnen ±600 m.'); $('nearbyList').innerHTML = ''; return; }
    setStatus(st, `${list.length} haltes in de buurt`);
    $('nearbyList').innerHTML = list.map(s => {
      const op = detectOperator(s.stopId);
      rememberStop(s.stopId, s.name);
      return `<button class="list-item" data-stop="${esc(s.stopId)}">${opTag(op)}<div class="grow"><div class="nm">${esc(s.name)}</div><div class="sub">${distance(s.dist)} · ${Math.max(1, Math.round(s.dist / 75))} min lopen</div></div>›</button>`;
    }).join('');
    $('nearbyList').querySelectorAll('[data-stop]').forEach(b => b.onclick = () => go('#/stop/' + encodeURIComponent(b.dataset.stop)));
    layers.stops.clearLayers();
    list.forEach(s => {
      const op = detectOperator(s.stopId);
      L.circleMarker([s.lat, s.lon], { radius: 7, color: op.color, weight: 3, fillColor: '#fff', fillOpacity: 1 }).bindTooltip(esc(s.name))
        .on('click', () => go('#/stop/' + encodeURIComponent(s.stopId))).addTo(layers.stops);
    });
    fitTo([pos, ...list.map(s => [s.lat, s.lon])], 17);
  } catch (e) { setStatus(st, errMsg(e), { error: true }); }
};

async function showStop(stopId) {
  const name = state.stopNames[stopId] || 'Halte';
  let filter = 'all', arriveBy = false, data = null;
  const isFav = () => db.get('favStops', []).some(s => s.id === stopId);
  const favBtn = () => ({ icon: isFav() ? '★' : '☆', title: 'Favoriet', fn: () => {
    const list = db.get('favStops', []);
    if (isFav()) db.set('favStops', list.filter(s => s.id !== stopId)); else { list.push({ id: stopId, name: state.stopNames[stopId] || name, kind: 'stop' }); db.set('favStops', list); toast('Halte bewaard ⭐'); }
    renderFav(); showStopHead();
  } });
  const showStopHead = () => detailHead(`${esc(state.stopNames[stopId] || name)}<small>${opTag(detectOperator(stopId))} Vertrektijden · live</small>`, [favBtn(), { icon: '🧭', title: 'Plan hierheen', fn: planToStop }]);
  const planToStop = () => {
    const p = data?.place;
    setPlace('to', { label: state.stopNames[stopId] || name, place: stopId, lat: p?.lat, lon: p?.lon, type: 'STOP', id: stopId });
    go('#/plan');
    if (!state.from) resolveMyLocation().then(f => { setPlace('from', f); runPlan(); }).catch(() => planEls.from.focus());
    else runPlan();
  };
  detail('', '<div class="status"><span class="spinner"></span>Vertrektijden laden…</div>', []);
  showStopHead();
  layers.stops.clearLayers();
  let firstDraw = true;
  const load = async () => {
    try {
      data = await api.stoptimes({ stopId, n: 40, arriveBy });
      if (data.place?.name) rememberStop(stopId, data.place.name);
      showStopHead();
      render();
      if (data.place && firstDraw) {
        firstDraw = false;
        const op = detectOperator(stopId);
        L.circleMarker([data.place.lat, data.place.lon], { radius: 9, color: op.color, weight: 4, fillColor: '#fff', fillOpacity: 1 }).bindTooltip(esc(data.place.name)).addTo(layers.stops);
        map.setView([data.place.lat, data.place.lon], 16);
      }
    } catch (e) {
      if (!data) $('detailBody').innerHTML = `<div class="empty">Vertrektijden niet beschikbaar.<br><small>${esc(errMsg(e))}</small></div>`;
    }
  };
  const render = () => {
    const list = (data.stopTimes || []);
    const groups = [...new Set(list.map(s => modeGroup(s.mode)))];
    const shown = list.filter(s => filter === 'all' || modeGroup(s.mode) === filter);
    const now = Date.now();
    let html = alertsHtml(data.place?.alerts);
    html += `<div class="board"><div class="board-head"><div class="seg"><button data-ab="0" class="${arriveBy ? '' : 'on'}">Vertrek</button><button data-ab="1" class="${arriveBy ? 'on' : ''}">Aankomst</button></div>
      <div class="chips" style="margin:0">${groups.length > 1 ? ['all', ...groups].map(g => `<button class="chip ${filter === g ? 'on' : ''}" data-f="${g}" style="min-height:30px;padding:3px 10px">${g === 'all' ? 'Alles' : { train: '🚆', metro: '🚇', tram: '🚋', bus: '🚌' }[g]}</button>`).join('') : ''}</div></div>`;
    if (!shown.length) html += '<div class="empty">Geen vertrekken gevonden in de komende uren.</div>';
    shown.forEach(s => {
      const p = s.place;
      const t = arriveBy ? (p.arrival || p.scheduledArrival) : (p.departure || p.scheduledDeparture);
      const sched = arriveBy ? p.scheduledArrival : p.scheduledDeparture;
      const op = detectOperator(s.tripId, s.agencyName, p.stopId);
      const d = delayMin(t, sched);
      const cancelled = s.cancelled || s.tripCancelled || p.cancelled;
      const mins = Math.round((toMs(t) - now) / 60000);
      html += `<div class="dep ${cancelled ? 'cancelled' : ''}" data-trip="${esc(s.tripId || '')}">
        <div class="time">${hhmm(sched || t)}<small>${s.realTime ? (d > 0 ? `<span class="delay">+${d}</span>` : d < 0 ? `<span class="delay early">${d}</span>` : '<span class="rt">● op tijd</span>') : ''}</small></div>
        <div>${badge(s, op, s.mode)}</div>
        <div class="dest"><b>${esc(arriveBy ? (s.tripFrom?.name || s.headsign || '') : (s.headsign || s.tripTo?.name || ''))}</b><span>${opTag(op)} ${cancelled ? '<span class="cancel">Afgeschaft</span>' : ''}${p.track ? ` · perron ${esc(p.track)}` : ''}</span></div>
        <div class="right"><div class="rel">${cancelled ? '–' : mins <= 0 ? 'nu' : mins < 60 ? mins + "'" : hhmm(t)}</div></div>
      </div>`;
    });
    html += '</div>';
    if (data.nextPageCursor) html += '<button class="btn" id="moreDeps" style="width:100%">Meer vertrekken</button>';
    html += `<p class="muted small" style="text-align:center">Laatst bijgewerkt ${hhmm(Date.now())} · automatisch elke 30 s</p>`;
    $('detailBody').innerHTML = html;
    $('detailBody').querySelectorAll('[data-ab]').forEach(b => b.onclick = () => { arriveBy = b.dataset.ab === '1'; data = null; load(); });
    $('detailBody').querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filter = b.dataset.f; render(); });
    $('detailBody').querySelectorAll('.dep[data-trip]').forEach(r => r.onclick = () => r.dataset.trip && go('#/trip/' + encodeURIComponent(r.dataset.trip)));
    $('moreDeps')?.addEventListener('click', async () => {
      try {
        const more = await api.stoptimes({ stopId, n: 40, arriveBy, pageCursor: data.nextPageCursor });
        data.stopTimes = [...data.stopTimes, ...(more.stopTimes || [])]; data.nextPageCursor = more.nextPageCursor; render();
      } catch (e) { toast(errMsg(e)); }
    });
  };
  await load();
  every('stopRefresh', load, 30000, false);
  state.detailCleanup = () => { stop('stopRefresh'); };
}

/* ================================================================== */
/* TREINEN (iRail)                                                     */
/* ================================================================== */
attachAutocomplete($('stationSearch'), { stations: true, onSelect: s => { $('stationSearch').value = ''; go('#/station/' + encodeURIComponent(s.id)); } });
$('nearStation').onclick = async () => {
  try {
    const [pos, list] = await Promise.all([getPosition(), api.irailStations()]);
    const best = list.filter(s => Number.isFinite(s.lat)).map(s => ({ s, d: haversine(pos, [s.lat, s.lon]) })).sort((a, b) => a.d - b.d)[0];
    if (best) { toast(`${best.s.name} (${distance(best.d)})`); go('#/station/' + encodeURIComponent(best.s.id)); }
  } catch (e) { toast(errMsg(e)); }
};
$('trainForm').addEventListener('submit', e => {
  e.preventDefault();
  let v = $('trainNumber').value.trim().toUpperCase().replace(/\s+/g, '');
  if (!v) return;
  if (!v.startsWith('BE.NMBS.')) v = 'BE.NMBS.' + v;
  go('#/train/' + encodeURIComponent(v));
});
const OCC = { low: '🟢 rustig', medium: '🟠 druk', high: '🔴 zeer druk' };

async function showStation(id) {
  const stations = await api.irailStations().catch(() => []);
  const st = stations.find(s => s.id === id);
  let arrivals = false, data = null;
  const isFav = () => db.get('favStops', []).some(s => s.id === id);
  const head = () => detailHead(`${esc(st?.name || data?.station || 'Station')}<small><span class="op-tag" style="--c:#0069b4">NMBS</span> Liveboard · iRail</small>`, [
    { icon: isFav() ? '★' : '☆', title: 'Favoriet', fn: () => {
      const list = db.get('favStops', []);
      if (isFav()) db.set('favStops', list.filter(s => s.id !== id)); else { list.push({ id, name: st?.name || data?.station, kind: 'station' }); db.set('favStops', list); toast('Station bewaard ⭐'); }
      renderFav(); head();
    } }
  ]);
  detail('', '<div class="status"><span class="spinner"></span>Liveboard laden…</div>', []);
  head();
  layers.stops.clearLayers();
  if (st && Number.isFinite(st.lat)) { L.circleMarker([st.lat, st.lon], { radius: 9, color: '#0069b4', weight: 4, fillColor: '#fff', fillOpacity: 1 }).bindTooltip(esc(st.name)).addTo(layers.stops); map.setView([st.lat, st.lon], 14); }
  const load = async () => {
    try { data = await api.irailLiveboard(id, { arrivals }); head(); render(); }
    catch (e) { if (!data) $('detailBody').innerHTML = `<div class="empty">Liveboard niet beschikbaar.<br><small>${esc(errMsg(e))}</small></div>`; }
  };
  const render = () => {
    const now = Date.now();
    let html = `<div class="board"><div class="board-head"><div class="seg"><button data-ab="0" class="${arrivals ? '' : 'on'}">Vertrek</button><button data-ab="1" class="${arrivals ? 'on' : ''}">Aankomst</button></div><span>${hhmm(now)}</span></div>`;
    if (!data.items.length) html += '<div class="empty">Geen treinen gevonden.</div>';
    data.items.forEach(d => {
      const mins = Math.round((d.time + d.delay * 60000 - now) / 60000);
      html += `<div class="dep ${d.canceled ? 'cancelled' : ''}" data-veh="${esc(d.vehicle)}">
        <div class="time">${hhmm(d.time)}<small>${d.delay > 0 ? `<span class="delay">+${d.delay}</span>` : '<span class="rt">● op tijd</span>'}</small></div>
        <div><span class="badge" style="--bg-c:#0069b4">🚆 ${esc(d.name)}</span></div>
        <div class="dest"><b>${esc(d.station)}</b><span>${d.canceled ? '<span class="cancel">Afgeschaft</span> ' : ''}${d.occupancy ? `<span class="occ">${OCC[d.occupancy] || ''}</span>` : ''}${d.left ? ' · vertrokken' : ''}</span></div>
        <div class="right"><div>${d.platform ? `<span class="track${d.platformChanged ? ' changed' : ''}">${esc(d.platform)}</span>` : ''}</div><div class="rel">${d.canceled ? '–' : mins <= 0 ? 'nu' : mins < 60 ? mins + "'" : ''}</div></div>
      </div>`;
    });
    html += `</div><p class="muted small" style="text-align:center">Bron: iRail · automatisch vernieuwd elke 30 s</p>`;
    $('detailBody').innerHTML = html;
    $('detailBody').querySelectorAll('[data-ab]').forEach(b => b.onclick = () => { arrivals = b.dataset.ab === '1'; load(); });
    $('detailBody').querySelectorAll('[data-veh]').forEach(r => r.onclick = () => go('#/train/' + encodeURIComponent(r.dataset.veh)));
  };
  await load();
  every('stationRefresh', load, 30000, false);
  state.detailCleanup = () => stop('stationRefresh');
}

async function showTrain(id) {
  detail('<span class="spinner"></span> Trein laden…', '', []);
  layers.trip.clearLayers();
  let data = null, marker = null, firstDraw = true, follow = true;
  const stopsFor = () => data.stops.map(s => ({
    lat: s.lat, lon: s.lon,
    arr: (s.schedArr ?? s.time) + s.arrDelay * 60000,
    dep: (s.schedDep ?? s.time) + s.depDelay * 60000
  }));
  const load = async () => {
    try { data = await api.irailVehicle(id); render(); }
    catch (e) { if (!data) $('detailBody').innerHTML = `<div class="empty">Trein niet gevonden. Controleer het nummer (bv. IC 1832, S1 1990, L 2880).<br><small>${esc(errMsg(e))}</small></div>`; }
  };
  const render = () => {
    const vp = vehiclePosition(stopsFor(), null, Date.now());
    const cur = vp ? (vp.state === 'running' ? vp.next : vp.index) : -1;
    const maxDelay = Math.max(0, ...data.stops.map(s => s.depDelay || s.arrDelay || 0));
    const first = data.stops[0], last = data.stops[data.stops.length - 1];
    $('detailTitle').innerHTML = `🚆 ${esc(data.name)} → ${esc(last?.name || '')}<small>NMBS · live via iRail</small>`;
    let html = `<div class="card"><div class="row" style="margin:0"><span class="badge" style="--bg-c:#0069b4">🚆 ${esc(data.name)}</span><b>${esc(first?.name || '')} → ${esc(last?.name || '')}</b></div>
      <div style="margin-top:8px;font-weight:700">${vp ? (vp.state === 'before' ? `Vertrekt ${relMinutes(stopsFor()[0].dep)}` : vp.state === 'after' ? 'Rit beëindigd' : vp.state === 'at-stop' ? `Staat nu in ${esc(data.stops[vp.index].name)}` : `Rijdt naar ${esc(data.stops[vp.next].name)}`) : ''}
      ${maxDelay ? ` · <span class="delay">+${maxDelay} min</span>` : ' · <span class="rt">● op tijd</span>'}</div>
      <label class="check small"><input type="checkbox" id="followVeh" ${follow ? 'checked' : ''}> Kaart volgt de trein</label></div>
      <div class="card"><ul class="stoplist" style="--lc:#0069b4">`;
    data.stops.forEach((s, i) => {
      const isLast = i === data.stops.length - 1;
      const sched = isLast ? (s.schedArr ?? s.time) : (s.schedDep ?? s.time);
      const d = isLast ? s.arrDelay : s.depDelay;
      html += `<li class="${cur >= 0 && i < cur ? 'passed' : ''} ${i === cur && vp.state !== 'after' ? 'current' : ''}">
        <div class="t ${s.canceled ? 'strike' : ''}">${hhmm(sched)}<small>${d > 0 ? `<span class="delay">+${d}</span>` : ''}</small></div>
        <div class="rail"><div class="dot"></div></div>
        <div class="nm">${esc(s.name)}${s.canceled ? ' <span class="cancel">vervalt</span>' : ''}${s.occupancy ? ` <span class="occ">${OCC[s.occupancy] || ''}</span>` : ''}</div>
        <div>${s.platform && s.platform !== '?' ? `<span class="track${s.platformChanged ? ' changed' : ''}">${esc(s.platform)}</span>` : ''}</div></li>`;
    });
    html += '</ul></div>';
    $('detailBody').innerHTML = html;
    $('followVeh').onchange = e => { follow = e.target.checked; };
    layers.trip.clearLayers();
    const line = data.stops.filter(s => Number.isFinite(s.lat)).map(s => [s.lat, s.lon]);
    L.polyline(line, { color: '#fff', weight: 8 }).addTo(layers.trip);
    L.polyline(line, { color: '#0069b4', weight: 5 }).addTo(layers.trip);
    data.stops.forEach(s => L.circleMarker([s.lat, s.lon], { radius: 4, color: '#0069b4', weight: 2, fillColor: '#fff', fillOpacity: 1 }).bindTooltip(esc(s.name)).addTo(layers.trip));
    marker = L.marker(vp ? vp.pos : line[0], { icon: divIcon(`<div class="veh big" style="--c:#0069b4">${esc(data.name)}</div>`), zIndexOffset: 1500 }).addTo(layers.trip);
    if (firstDraw) { fitTo(line); firstDraw = false; }
  };
  const tick = () => {
    if (!data || !marker) return;
    const vp = vehiclePosition(stopsFor(), null, Date.now());
    if (vp) { marker.setLatLng(vp.pos); if (follow && vp.state === 'running' && !map.getBounds().pad(-0.2).contains(vp.pos)) map.panTo(vp.pos); }
  };
  await load();
  every('trainRefresh', load, 30000, false);
  every('trainTick', tick, 1000, false);
  state.detailCleanup = () => { stop('trainRefresh'); stop('trainTick'); layers.trip.clearLayers(); };
}

async function loadDisturbances() {
  const box = $('disturbances');
  try {
    const list = await api.irailDisturbances();
    if (!list.length) { box.innerHTML = '<p class="muted small">Geen gemelde storingen. 👍</p>'; return; }
    box.innerHTML = list.slice(0, 25).map(d => `<details class="disturb"><summary><span class="tag ${d.type === 'planned' ? 'planned' : ''}">${d.type === 'planned' ? 'werken' : 'storing'}</span>${esc(d.title)}</summary>
      <p>${esc(d.description)}</p>${d.link ? `<a href="${esc(d.link)}" target="_blank" rel="noopener" class="small">Meer info</a>` : ''}</details>`).join('');
  } catch (e) { box.innerHTML = `<p class="status error">${esc(errMsg(e))}</p>`; }
}

/* ================================================================== */
/* FAVORIETEN                                                          */
/* ================================================================== */
function bindPlaceInput(id, key) {
  const input = $(id);
  const places = db.get('places', {});
  if (places[key]) input.value = places[key].label;
  attachAutocomplete(input, { onSelect: p => {
    if (p.myLocation) return;
    const all = db.get('places', {}); all[key] = slim(p); db.set('places', all);
    toast(`${key === 'home' ? 'Thuis' : 'Werk'} opgeslagen`); renderQuick();
  } });
  input.addEventListener('change', () => { if (!input.value.trim()) { const all = db.get('places', {}); delete all[key]; db.set('places', all); renderQuick(); } });
}
bindPlaceInput('homeInput', 'home');
bindPlaceInput('workInput', 'work');

function renderFav() {
  const routes = db.get('routes', []);
  $('favRoutes').innerHTML = routes.length ? routes.map((r, i) => `<div class="list-item" data-r="${i}"><span>🧭</span><div class="grow"><div class="nm">${esc(r.from.label)} → ${esc(r.to.label)}</div></div><button class="icon-btn rm" data-rm="${i}" aria-label="Verwijder">🗑</button></div>`).join('')
    : '<p class="muted small">Nog geen routes. Plan een reis en tik op “☆ Bewaar route”.</p>';
  $('favRoutes').querySelectorAll('[data-r]').forEach(el => el.onclick = e => {
    if (e.target.closest('[data-rm]')) { const l = db.get('routes', []); l.splice(+e.target.closest('[data-rm]').dataset.rm, 1); db.set('routes', l); renderFav(); renderQuick(); return; }
    const r = routes[+el.dataset.r]; setPlace('from', r.from); setPlace('to', r.to); go('#/plan'); runPlan();
  });
  const stops = db.get('favStops', []);
  const item = (s, i) => {
    const op = s.kind === 'station' ? OPERATORS.nmbs : detectOperator(s.id);
    return `<div class="list-item" data-s="${i}">${opTag(op)}<div class="grow"><div class="nm">${esc(s.name)}</div><div class="sub">${s.kind === 'station' ? 'NMBS-liveboard' : 'Vertrektijden'}</div></div><button class="icon-btn rm" data-rm="${i}" aria-label="Verwijder">🗑</button></div>`;
  };
  const html = stops.length ? stops.map(item).join('') : '<p class="muted small">Nog geen favoriete haltes. Open een halte of station en tik op ☆.</p>';
  $('favStops').innerHTML = html;
  $('favStopsQuick').innerHTML = stops.filter(s => s.kind !== 'station').length ? '<h3 style="margin:12px 4px 8px">⭐ Favoriete haltes</h3>' + stops.map((s, i) => s.kind === 'station' ? '' : item(s, i)).join('') : '';
  $('favStations').innerHTML = stops.filter(s => s.kind === 'station').length ? '<h3 style="margin:4px 4px 8px">⭐ Favoriete stations</h3>' + stops.map((s, i) => s.kind === 'station' ? item(s, i) : '').join('') : '';
  document.querySelectorAll('#favStops [data-s], #favStopsQuick [data-s], #favStations [data-s]').forEach(el => el.onclick = e => {
    const i = +el.dataset.s;
    if (e.target.closest('[data-rm]')) { const l = db.get('favStops', []); l.splice(i, 1); db.set('favStops', l); renderFav(); return; }
    const s = stops[i];
    if (s.kind === 'station') go('#/station/' + encodeURIComponent(s.id));
    else { rememberStop(s.id, s.name); go('#/stop/' + encodeURIComponent(s.id)); }
  });
}
$('notifBtn').onclick = async () => {
  if (!('Notification' in window)) return toast('Meldingen worden niet ondersteund in deze browser');
  const p = await Notification.requestPermission();
  toast(p === 'granted' ? 'Meldingen staan aan 🔔' : 'Meldingen zijn geweigerd (pas aan in je browserinstellingen)');
  updateNotifBtn();
};
function updateNotifBtn() {
  if ('Notification' in window && Notification.permission === 'granted') { $('notifBtn').textContent = '🔔 Meldingen staan aan'; $('notifBtn').disabled = true; }
}
$('clearBtn').onclick = () => {
  if (!confirm('Alle favorieten, recente routes en instellingen van OVFlow wissen?')) return;
  Object.keys(localStorage).filter(k => k.startsWith('ovflow.')).forEach(k => localStorage.removeItem(k));
  location.reload();
};
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; $('installBtn').hidden = false; });
$('installBtn').onclick = async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice.catch(() => {}); installEvt = null; $('installBtn').hidden = true; };

/* ================================================================== */
/* DETAIL-weergave & router                                            */
/* ================================================================== */
function detailHead(title, actions = []) {
  $('detailTitle').innerHTML = title;
  const box = $('detailActions'); box.innerHTML = '';
  actions.forEach(a => { const b = document.createElement('button'); b.className = 'icon-btn'; b.title = a.title; b.setAttribute('aria-label', a.title); b.textContent = a.icon; b.onclick = a.fn; box.appendChild(b); });
}
function detail(title, body, actions) {
  if (title) detailHead(title, actions); else if (actions?.length) detailHead($('detailTitle').innerHTML, actions);
  $('detailBody').innerHTML = body;
  $('panel').scrollTop = 0;
}
let lastMainView = 'plan';
$('backBtn').onclick = () => { if (history.length > 1 && state.cameFromApp) history.back(); else go('#/' + lastMainView); };

function go(hash, replace = false) {
  state.cameFromApp = true;
  if (replace) { history.replaceState(null, '', hash); route(); }
  else if (location.hash === hash) route();
  else location.hash = hash; // → hashchange → route()
}
window.addEventListener('hashchange', () => { state.cameFromApp = true; route(); });

function setView(v) {
  const prev = state.view;
  state.view = v;
  document.body.dataset.view = v;
  if (v !== 'detail') lastMainView = v;
  document.querySelectorAll('.tabbar a').forEach(a => a.classList.toggle('on', a.dataset.tab === (v === 'detail' ? lastMainView : v)));
  if (prev !== v) invalidateMap();
}
function route() {
  const h = location.hash || '#/plan';
  const [path, query] = h.slice(2).split('?');
  const [name, ...rest] = path.split('/');
  const arg = rest.length ? decodeURIComponent(rest.join('/')) : '';
  state.detailCleanup?.(); state.detailCleanup = null;
  stop('live'); stop('liveTick');
  if (name !== 'live') { layers.live.clearLayers(); state.liveMarkers.clear(); }
  if (!['route', 'follow', 'plan'].includes(name)) layers.route.clearLayers();
  if (!['stops', 'stop', 'station', 'live'].includes(name)) layers.stops.clearLayers();

  switch (name) {
    case 'live':
      setView('live');
      if (map.getZoom() < 9) {
        if (state.me) map.setView(state.me, 13); else map.setView([50.846, 4.357], 13);
      }
      every('live', liveFetch, 30000);
      every('liveTick', liveTick, 1000, false);
      break;
    case 'stops': setView('stops'); renderFav(); break;
    case 'trains': setView('trains'); renderFav(); loadDisturbances(); break;
    case 'fav': setView('fav'); renderFav(); updateNotifBtn(); break;
    case 'route': setView('detail'); lastMainView = 'plan'; showRouteDetail(); break;
    case 'follow': setView('detail'); renderFollowDetail(); break;
    case 'trip': setView('detail'); showTrip(arg); break;
    case 'stop': setView('detail'); showStop(arg); break;
    case 'station': setView('detail'); lastMainView = 'trains'; showStation(arg); break;
    case 'train': setView('detail'); lastMainView = 'trains'; showTrain(arg); break;
    default: {
      setView('plan');
      if (query) {
        const q = new URLSearchParams(query);
        const parse = v => { if (!v) return null; const [place, ...label] = v.split('|'); const ll = place.split(','); return { place, label: label.join('|') || place, lat: +ll[0], lon: +ll[1] }; };
        const f = parse(q.get('f')), t = parse(q.get('t'));
        if (f && t) { setPlace('from', f); setPlace('to', t); history.replaceState(null, '', '#/plan'); runPlan(); }
      } else if (state.plan?.itineraries?.[0]) drawItinerary(state.plan.itineraries[0], { fit: false });
    }
  }
}

/* ================================================================== */
/* Start                                                               */
/* ================================================================== */
function updateOnline() { $('netStatus').hidden = navigator.onLine !== false; }
window.addEventListener('online', updateOnline); window.addEventListener('offline', updateOnline);
updateOnline();
renderQuick();
renderFav();
route();
initFollow();
api.irailStations().catch(() => {}); // stations alvast cachen

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
}
// Vraag stil om locatie als die eerder al is toegestaan (centreert de kaart)
navigator.permissions?.query({ name: 'geolocation' }).then(p => {
  if (p.state === 'granted') getPosition().then(pos => { if (state.view === 'plan' && !state.plan) map.setView(pos, 13); }).catch(() => {});
}).catch(() => {});

// Exporteer voor debuggen
window.ovflow = { state, map, api };
