/* Wheaterflow Location Engine v1
   Eén canonieke locatiebron voor Home, Radar, Community, Profiel en waarschuwingen. */
(() => {
  'use strict';

  const STORAGE_KEY = 'wheaterflow:location:v3';
  const RESOLVED_KEY = 'wheaterflow:resolved-location:v3';
  const VALID_STATUSES = new Set(['ready','detecting','onboarding','gps','manual','denied','receiver']);
  let current = null;
  let version = 0;
  const listeners = new Set();

  const number = value => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  const text = value => String(value ?? '').trim();
  const validCoords = loc => {
    const lat = number(loc?.lat), lon = number(loc?.lon);
    return lat != null && lon != null && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  };
  const distanceKm = (a, b) => {
    if(!validCoords(a) || !validCoords(b)) return Infinity;
    const R = 6371;
    const dLat = (Number(b.lat)-Number(a.lat))*Math.PI/180;
    const dLon = (Number(b.lon)-Number(a.lon))*Math.PI/180;
    const p1 = Number(a.lat)*Math.PI/180;
    const p2 = Number(b.lat)*Math.PI/180;
    const h = Math.sin(dLat/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.min(1, Math.sqrt(h)));
  };
  const clone = loc => loc ? {...loc} : null;

  function normalize(input={}, fallback={}){
    const source = {...fallback, ...input};
    const lat = number(source.lat);
    const lon = number(source.lon);
    const status = VALID_STATUSES.has(source.status) ? source.status : (VALID_STATUSES.has(fallback.status) ? fallback.status : 'ready');
    return {
      lat,
      lon,
      name:text(source.name),
      admin:text(source.admin),
      country:text(source.country),
      status,
      source:text(source.source) || status,
      accuracy:number(source.accuracy),
      updatedAt:number(source.updatedAt) || Date.now(),
      version:number(source.version) || 0
    };
  }

  function readStored(){
    try{
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if(validCoords(parsed)) return normalize(parsed);
      // Eenmalige migratie van de vorige locatiecache zodat bestaande gebruikers
      // na de update niet plots terugvallen op de standaardplaats.
      const legacy = JSON.parse(localStorage.getItem('wheaterflow:last-location-name') || 'null');
      if(validCoords(legacy)) return normalize({...legacy, status:'ready', source:'legacy-cache'});
      return null;
    }catch(e){ return null; }
  }
  function persist(loc){
    if(!validCoords(loc)) return;
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(loc)); }catch(e){}
  }

  function hydrate(fallback){
    if(current) return clone(current);
    const stored = readStored();
    current = normalize(stored || fallback || {}, fallback || {});
    version = Math.max(0, Number(current.version) || 0);
    return clone(current);
  }

  function get(){ return clone(current); }

  function emit(next, previous, reason){
    const detail = {location:clone(next), previous:clone(previous), reason:reason || next.source, version:next.version};
    listeners.forEach(listener => {
      try{ listener(detail); }catch(e){ console.warn('Location listener failed:', e); }
    });
    try{ window.dispatchEvent(new CustomEvent('wheaterflow:location-changed', {detail})); }catch(e){}
  }

  function set(input, options={}){
    const previous = current;
    const next = normalize(input, current || {});
    if(!validCoords(next)) throw new Error('Invalid Wheaterflow location coordinates');
    next.version = ++version;
    next.updatedAt = Date.now();
    current = next;
    if(options.persist !== false && !['detecting','onboarding','denied'].includes(next.status)) persist(next);
    if(options.emit !== false) emit(next, previous, options.reason);
    return clone(next);
  }

  function updateMeta(input, options={}){
    if(!current) return set(input, options);
    return set({...current, ...input, lat:current.lat, lon:current.lon}, options);
  }

  function setStatus(status, options={}){
    if(!current) return null;
    const safeStatus = VALID_STATUSES.has(status) ? status : current.status;
    const previous = current;
    current = {...current, status:safeStatus, source:options.source || current.source, version:++version, updatedAt:Date.now()};
    if(options.persist === true) persist(current);
    if(options.emit !== false) emit(current, previous, options.reason || 'status');
    return clone(current);
  }

  function subscribe(listener){
    if(typeof listener !== 'function') return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function sameCoordinates(a, b, toleranceKm=0.15){
    return distanceKm(a,b) <= Math.max(0, Number(toleranceKm) || 0);
  }

  function rememberResolved(input){
    if(!validCoords(input) || !text(input.name)) return;
    const item = normalize({...input, status:input.status || 'ready'});
    try{ localStorage.setItem(RESOLVED_KEY, JSON.stringify(item)); }catch(e){}
  }

  function resolvedNear(lat, lon, maxKm=5){
    try{
      const item = JSON.parse(localStorage.getItem(RESOLVED_KEY) || 'null');
      const target = {lat:number(lat), lon:number(lon)};
      if(!validCoords(item) || !validCoords(target)) return null;
      return distanceKm(item, target) <= Math.max(0, Number(maxKm) || 0) ? normalize(item) : null;
    }catch(e){ return null; }
  }

  window.WF_LOCATION = {
    hydrate, get, set, updateMeta, setStatus, subscribe,
    validCoords, distanceKm, sameCoordinates, rememberResolved, resolvedNear,
    storageKey:STORAGE_KEY
  };
})();
