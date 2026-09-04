/* =========================================================================
   WEERSCOOP - live weer, radar en storm-chaser tool
   Databronnen: Open-Meteo (weer + geocoding), KNMI en WeatherFlow radar-worker.
   ========================================================================= */

const KNMI_OPEN_DATA_API_KEY = ''; // server-side via api.wheaterflow.be
const KNMI_WMS_API_KEY = ''; // server-side via api.wheaterflow.be
const RADAR_MAX_AGE_MINUTES = 90;
const WEATHERFLOW_RADAR_WORKER = 'https://weatherflow-radar.leanderdevriendt.workers.dev';
const WEATHERFLOW_RADAR_OFFSETS = [-120,-110,-100,-90,-80,-70,-60,-50,-40,-30,-20,-10,0];
const WHEATERFLOW_API_BASE = 'https://api.wheaterflow.be/api';
const FUNCTION_BASE = WHEATERFLOW_API_BASE + '/';
const PUSH_FUNCTION_BASE = FUNCTION_BASE;
const ONBOARDING_STORAGE_KEY = 'wheaterflow:onboarding:v1';
let onboardingPendingProfile = false;
function isFirstRunOnboarding(){
  try{ return localStorage.getItem(ONBOARDING_STORAGE_KEY) !== 'done'; }catch(e){ return false; }
}
function completeFirstRunOnboarding(){
  try{ localStorage.setItem(ONBOARDING_STORAGE_KEY, 'done'); }catch(e){}
}
const XWEATHER_SDK_VERSION = '1.9.3';
const XWEATHER_SDK_BASE = `https://cdn.jsdelivr.net/npm/@xweather/mapsgl@${XWEATHER_SDK_VERSION}/dist/`;
const ASTRO_EVENTS_URL = 'assets/data/astro-events.json';
const CAST_CONFIG_URLS = [
  new URL('/api/cast-config', location.origin).href,
  FUNCTION_BASE + 'cast-config'
];
const TV_PAIRING_API_URLS = [
  ...(window.WHEATERFLOW_TV_PAIRING_API_URL ? [window.WHEATERFLOW_TV_PAIRING_API_URL] : []),
  FUNCTION_BASE + 'tv-pairing',
  new URL('/api/tv-pairing', location.origin).href
];
const API_BASE = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
  ? new URL('/api/', location.origin).href
  : 'https://api.wheaterflow.be/api/';
const DEFAULT_WEATHER_PHOTO = 'Bewolkt.png';
const WEATHER_PHOTO_FILES = new Set([
  'zonnig.png',
  'licht bewolkt.png',
  'Overwegend zonnig.png',
  'Half bewolkt.png',
  'Bewolkt.png',
  'Zwaarbewolkt.png',
  'Mist.png',
  'Nevel.png',
  'Motregen.png',
  'Lichte regen.png',
  'Regen.png',
  'Hevige regen.png',
  'Onweersbuien.png',
  'Zwaar onweer.png',
  'Hagel.png'
]);

const NIGHT_WEATHER_PHOTO_FILES = new Set([
  '01-night-clear.jpeg',
  '02-night-mostly-clear.jpeg',
  '03-night-partly-cloudy.jpeg',
  '04-night-cloudy.jpeg',
  '05-night-overcast.jpeg',
  '06-night-fog.jpeg',
  '07-night-mist.jpeg',
  '08-night-drizzle.jpeg',
  '09-night-light-rain.jpeg',
  '10-night-rain.jpeg',
  '11-night-heavy-rain.jpeg',
  '12-night-rain-showers.jpeg',
  '13-night-thunderstorm.jpeg',
  '14-night-thunder-showers.jpeg',
  '15-night-severe-thunderstorm.jpeg',
  '16-night-hail.jpeg',
  '17-night-sleet.jpeg',
  '18-night-light-snow.jpeg',
  '19-night-snow.jpeg',
  '20-night-heavy-snow.jpeg'
]);

function nightWeatherPhotoFilename(code, cloudCover=0){
  const cc = Math.max(0, Math.min(100, Number(cloudCover) || 0));
  const c = Number(code);
  if(c === 0) return cc <= 12 ? '01-night-clear.jpeg' : '02-night-mostly-clear.jpeg';
  if(c === 1) return '02-night-mostly-clear.jpeg';
  if(c === 2) return '03-night-partly-cloudy.jpeg';
  if(c === 3) return cc >= 88 ? '05-night-overcast.jpeg' : '04-night-cloudy.jpeg';
  if(c === 45) return '06-night-fog.jpeg';
  if(c === 48) return '07-night-mist.jpeg';
  if([51,53,55,56,57].includes(c)) return '08-night-drizzle.jpeg';
  if(c === 61) return '09-night-light-rain.jpeg';
  if([63,66].includes(c)) return '10-night-rain.jpeg';
  if([65,67].includes(c)) return '11-night-heavy-rain.jpeg';
  if([80,81,82].includes(c)) return '12-night-rain-showers.jpeg';
  if(c === 95) return '13-night-thunderstorm.jpeg';
  if(c === 96) return '16-night-hail.jpeg';
  if(c === 99) return '15-night-severe-thunderstorm.jpeg';
  if([71,77,85].includes(c)) return '18-night-light-snow.jpeg';
  if(c === 73) return '19-night-snow.jpeg';
  if([75,86].includes(c)) return '20-night-heavy-snow.jpeg';
  // Freezing/mixed precipitation gets the sleet image when no more specific code applies.
  if([68,69,83,84].includes(c)) return '17-night-sleet.jpeg';
  if(cc <= 15) return '01-night-clear.jpeg';
  if(cc <= 30) return '02-night-mostly-clear.jpeg';
  if(cc <= 60) return '03-night-partly-cloudy.jpeg';
  if(cc <= 87) return '04-night-cloudy.jpeg';
  return '05-night-overcast.jpeg';
}
const TV_WEATHER_PHOTO_FILES = new Set([
  'tv-night-clear.png',
  'tv-night-light-clouds.png',
  'tv-night-cloudy.png',
  'tv-night-heavy-clouds.png',
  'tv-drizzle.png',
  'tv-light-rain.png',
  'tv-rain.png',
  'tv-heavy-rain.png'
]);

const state = {
  loc: { lat: 51.2405, lon: 2.9309, name: "Oostende", admin: "West-Vlaanderen, Belgie" },
  units: { temp:'C', wind:'kmh', precip:'mm', press:'hpa', days:7, model:'knmi_seamless' },
  current: null, hourly: null, daily: null, tz: 'Europe/Brussels', utcOffsetSec: 0,
  observation: null, marine: null, seaspark: null, air: null,
  alerts: [],
  alertsMeta: { source:'Indicatieve weercode', official:false, updated:null },
  lightning: { available:false, loading:false, updated:null, strikes:[], nearest:null, summary:null, threat:null, error:null },
  locationStatus: 'ready',
  astroEvents: { loaded:false, events:[], sources:[], error:null },
  knmiKey: null,
  lastUpdated: null,
  favorites: [],
  auth: { configured:false, ready:false, supabase:null, session:null, user:null, profile:null, syncing:false, guest:true },
  community: { posts: [], page: 0, pageSize: 12, hasMore: true, loading: false, view: 'feed', category: '', query: '', quickFilter: 'foryou', map: null, markers: null, selectedFile: null, realtimeChannel: null },
  climate: { records: [], settings: {mode:'off'}, period:'month', location:'all', chart:null, loaded:false },
  xweather: { configured:false, loading:false, ready:false, sdkLoaded:false, controller:null, legend:null, activeLayer:null, activeCodes:[], availableCodes:new Set(), disabledCodes:new Set(), metadata:[], marker:null, accuracy:null, pointMarker:null, timelineUiTimer:null, overlayLightning:false, fallback:false, uiWired:false, visibilityWired:false, mapClickWired:false },
  push: { supported:false, standalone:false, configured:false, status:'Niet ondersteund', installationId:null, preferences:null, thresholds:null },
  cast: { service:null, status:'idle', available:false, configured:false, connected:false, deviceName:'', receiver:false },
  tvPairing: { service:null, receiver:false, connected:false, code:'', expiresAt:0, status:'idle' },
  radar: { frames: [], index: 0, playing: false, timer: null, refreshTimer: null, layer: 'precip', scheme: 4, opacity: 0.9, duration: 1, animator: null, openMeteoLayer: null, proximity:null, initialized:false, activating:false },
  map: null, marker: null, homeMap: { map:null, base:null, overlay:null, xweatherController:null, activeLayer:'radar' },
  activeTab: 'home',
  rainEta: null,
  sharedWeather: {marine:null, wind:null, locationName:'Oostende'},
  dataStatus: {homeMap:{lastSuccess:null,error:null}, radar:{lastSuccess:null,error:null}},
  refreshTimer: null, clockTickTimer: null
};

const $ = (s,ctx=document)=>ctx.querySelector(s);
const $$ = (s,ctx=document)=>Array.from(ctx.querySelectorAll(s));
const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '"' ? '&quot;' : '&#39;');

function cleanLocationName(name, fallback='Huidige locatie'){
  const value = String(name || '').trim();
  if(!value || /onbekende locatie/i.test(value)) return fallback;
  return value;
}

function locationDisplayName(fallback='Huidige locatie'){
  const name = cleanLocationName(state.loc?.name, '');
  if(name) return name;
  if(state.locationStatus === 'detecting') return 'Locatie bepalen...';
  if(state.locationStatus === 'denied') return 'Plaats kiezen';
  return fallback;
}

function toast(msg){
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(()=>t.classList.remove('show'), 2200);
}


function validNumber(value){
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function validText(value){
  const s = String(value ?? '').trim();
  return s && !/^(null|undefined|nan)$/i.test(s) ? s : '';
}
function wheaterflowStatus(kind='loading', message='', options={}){
  const defaults = {
    loading:'Gegevens worden geladen…',
    empty:'Momenteel geen gegevens beschikbaar',
    radar:'Radargegevens tijdelijk niet beschikbaar',
    error:'Momenteel geen gegevens beschikbaar'
  };
  const text = validText(message) || defaults[kind] || defaults.empty;
  const updated = options.updated ? new Date(options.updated) : null;
  const updatedText = updated && Number.isFinite(updated.getTime())
    ? `<small>Laatst bijgewerkt om ${updated.toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit'})}</small>` : '';
  const retry = options.retryId ? `<button class="smallbtn wf-status-retry" id="${esc(options.retryId)}" type="button">Opnieuw proberen</button>` : '';
  return `<div class="wf-data-status ${esc(kind)}" role="status"><span class="wf-status-spinner" aria-hidden="true"></span><div><b>${esc(text)}</b>${updatedText}</div>${retry}</div>`;
}
function formatWindPair(speed, gust){
  const s=validNumber(speed), g=validNumber(gust);
  const parts=[];
  if(s!=null) parts.push(`Wind ${fmtWind(s)}`);
  if(g!=null && (s==null || g >= s + 8)) parts.push(`stoten ${fmtWind(g)}`);
  return parts.join(' · ');
}
function rememberResolvedLocation(name, admin='', country=''){
  const clean=cleanLocationName(name,'');
  if(!clean || /huidige locatie|locatie bepalen/i.test(clean)) return;
  state.sharedWeather.locationName=clean;
  try{ localStorage.setItem('wheaterflow:last-location-name', JSON.stringify({name:clean,admin,country,lat:state.loc?.lat,lon:state.loc?.lon})); }catch(e){}
}
function lastResolvedLocation(){
  try{ const x=JSON.parse(localStorage.getItem('wheaterflow:last-location-name')||'null'); return x?.name ? x : null; }catch(e){ return null; }
}

function loadScriptOnce(src){
  return new Promise((resolve, reject)=>{
    const existing = document.querySelector(`script[src="${src}"]`);
    if(existing){
      if(existing.dataset.loaded === 'true') resolve();
      else existing.addEventListener('load', resolve, {once:true});
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = ()=>{ script.dataset.loaded = 'true'; resolve(); };
    script.onerror = ()=>reject(new Error('Script kon niet worden geladen'));
    document.head.appendChild(script);
  });
}

function loadCssOnce(href){
  if(document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

let appSplashHidden = false;
function hideAppSplash(){
  if(appSplashHidden) return;
  const splash = $('#app-splash');
  if(!splash){ appSplashHidden = true; return; }
  appSplashHidden = true;
  splash.classList.add('is-hidden');
  splash.addEventListener('transitionend', ()=>splash.remove(), {once:true});
}
setTimeout(hideAppSplash, 2500);

/* ---------------- storage helpers (best effort, non-blocking) ---------------- */
async function loadStoredFavorites(){
  try{
    const r = await window.storage.get('weerscoop:favorites');
    if(r && r.value) state.favorites = JSON.parse(r.value);
  }catch(e){ /* geen opgeslagen favorieten */ }
}
async function saveFavorites(){
  try{ await window.storage.set('weerscoop:favorites', JSON.stringify(state.favorites)); }catch(e){}
  syncFavoritesToCloud();
}
async function loadStoredUnits(){
  try{
    const r = await window.storage.get('weerscoop:units');
    if(r && r.value) Object.assign(state.units, JSON.parse(r.value));
  }catch(e){}
  // Modelkeuze blijft behouden; alleen oude/ongeldige waarden herstellen.
  const validModels = new Set(['best_match','ecmwf_ifs025','icon_eu','gfs_seamless','knmi_seamless']);
  if(!validModels.has(state.units.model)) state.units.model = 'best_match';
}
async function saveUnitsLocalOnly(){
  try{ await window.storage.set('weerscoop:units', JSON.stringify(state.units)); }catch(e){}
}
async function saveUnits(){
  await saveUnitsLocalOnly();
  syncProfileSettingsToCloud();
}

async function loadStoredClimate(){
  try{
    const settings = await window.storage.get('weerscoop:climateSettings');
    if(settings?.value) state.climate.settings = {...state.climate.settings, ...JSON.parse(settings.value)};
    const records = await window.storage.get('weerscoop:climateRecords');
    if(records?.value) state.climate.records = normalizeClimateRecords(JSON.parse(records.value));
  }catch(e){}
}

async function saveClimateSettings(){
  try{ await window.storage.set('weerscoop:climateSettings', JSON.stringify(state.climate.settings)); }catch(e){}
}

async function saveLocalClimateRecords(){
  try{ await window.storage.set('weerscoop:climateRecords', JSON.stringify(state.climate.records)); }catch(e){}
}

/* ---------------- Wheaterflow own-server auth ---------------- */
const AUTH_STORAGE_KEY = 'wheaterflow:auth';

function authRedirectUrl(){ return new URL('./', location.href).href; }
function decodeJwtPayload(token){ try{ const p=token.split('.')[1]; const n=p.replace(/-/g,'+').replace(/_/g,'/'); return JSON.parse(decodeURIComponent(atob(n).split('').map(c=>'%' + ('00'+c.charCodeAt(0).toString(16)).slice(-2)).join(''))); }catch(e){ return null; } }
function makeLocalSession(token,user){ if(!token||!user)return null; return {access_token:token,user:{id:user.id,email:user.email,username:user.username,user_metadata:{display_name:user.displayName||user.display_name||user.username||user.email?.split('@')[0]}}}; }
function saveOwnServerSession(session){ try{ if(session)localStorage.setItem(AUTH_STORAGE_KEY,JSON.stringify(session)); else localStorage.removeItem(AUTH_STORAGE_KEY); }catch(e){} }
function loadOwnServerSession(){ try{ const raw=localStorage.getItem(AUTH_STORAGE_KEY); if(!raw)return null; const session=JSON.parse(raw); const payload=decodeJwtPayload(session?.access_token||''); if(!payload||(payload.exp&&payload.exp*1000<=Date.now())){localStorage.removeItem(AUTH_STORAGE_KEY);return null;} return session; }catch(e){ return null; } }
async function apiJson(path,options={}){ const headers={'content-type':'application/json',...(options.headers||{})}; if(state.auth.session?.access_token) headers.authorization=`Bearer ${state.auth.session.access_token}`; let r; try{ r=await fetch(WHEATERFLOW_API_BASE+path,{...options,headers,cache:'no-store'}); }catch(e){ throw new Error('network'); } let data={}; try{data=await r.json();}catch(e){} if(!r.ok) throw new Error(data.error||`HTTP ${r.status}`); return data; }

async function apiForm(path, formData, options={}){
  const headers = {...(options.headers || {})};
  if(state.auth.session?.access_token) headers.authorization = `Bearer ${state.auth.session.access_token}`;
  const response = await fetch(WHEATERFLOW_API_BASE + path, {
    ...options,
    method: options.method || 'POST',
    headers,
    body: formData,
    cache:'no-store'
  });
  let data = {};
  try{ data = await response.json(); }catch(e){}
  if(!response.ok){
    const err = new Error(data.error || `HTTP ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return data;
}

async function initAuth(){ updateAuthMessage('Profiel laden...'); state.auth.configured=true; state.auth.supabase=null; await applyAuthSession(loadOwnServerSession()); if(typeof showPasswordResetPrompt==='function') await showPasswordResetPrompt(); state.auth.ready=true; }
async function applyAuthSession(session,event=''){
  state.auth.session=session||null;
  state.auth.user=session?.user||null;
  state.auth.guest=!state.auth.user;
  if(state.auth.user){
    state.auth.profile={
      ...(state.auth.profile||{}),
      display_name:state.auth.profile?.display_name||state.auth.user?.user_metadata?.display_name||state.auth.user?.username||state.auth.user?.email?.split('@')[0]||'Wheaterflow gebruiker'
    };
    state.climate.loaded=true;
    // Laad het profiel van de Wheaterflow-server vóór de UI wordt ingevuld.
    // Zo blijft o.a. de gekozen thuislocatie gekoppeld aan het account in
    // plaats van telkens door de actuele GPS-locatie te worden vervangen.
    await loadCloudProfileAndFavorites();
  } else {
    state.auth.profile=null;
    state.climate.loaded=true;
  }
  updateAuthInterface(state.auth.session);
  renderClimateDashboard();
  // Als een account vanuit de first-run onboarding werd aangemaakt,
  // laat de onboarding daarna pas doorgaan naar het samenvattingsscherm.
  if(state.auth.user && onboardingPendingProfile){
    window.dispatchEvent(new CustomEvent('wheaterflow:onboarding-profile-created', {
      detail:{user:state.auth.user}
    }));
  }
}

function parseProfileJsonSetting(value, fallback){
  if(value == null) return fallback;
  if(typeof value === 'object') return value;
  if(typeof value === 'string'){
    try{ return JSON.parse(value); }catch(e){ return fallback; }
  }
  return fallback;
}

function mapProfileToUnits(profile){
  if(!profile) return;
  if(profile.temperature_unit) state.units.temp = profile.temperature_unit;
  if(profile.wind_unit) state.units.wind = profile.wind_unit;
  if(profile.precipitation_unit) state.units.precip = profile.precipitation_unit;
  if(profile.pressure_unit) state.units.press = profile.pressure_unit;
  if(profile.forecast_days) state.units.days = Number(profile.forecast_days);
  if(profile.weather_model && ['best_match','ecmwf_ifs025','icon_eu','gfs_seamless','knmi_seamless'].includes(profile.weather_model)){
    state.units.model = profile.weather_model;
  }

  const cloudPrefs = parseProfileJsonSetting(profile.notification_preferences ?? profile.push_preferences, null);
  const cloudThresholds = parseProfileJsonSetting(profile.notification_thresholds ?? profile.push_thresholds, null);
  if(cloudPrefs) state.push.preferences = {...defaultPushPreferences(), ...state.push.preferences, ...cloudPrefs};
  if(cloudThresholds) state.push.thresholds = {...defaultPushThresholds(), ...state.push.thresholds, ...cloudThresholds};
}

function profilePayload(){
  const profile = state.auth.profile || {};
  return {
    display_name: profile.display_name || state.auth.user?.user_metadata?.display_name || state.auth.user?.email?.split('@')[0] || 'Wheaterflow gebruiker',
    // Thuislocatie is een profielinstelling en mag NOOIT automatisch de
    // huidige GPS-locatie volgen. Alleen expliciet kiezen/wijzigen past dit aan.
    home_location_name: profile.home_location_name || null,
    home_latitude: Number.isFinite(Number(profile.home_latitude)) ? Number(profile.home_latitude) : null,
    home_longitude: Number.isFinite(Number(profile.home_longitude)) ? Number(profile.home_longitude) : null,
    language:'nl',
    temperature_unit:state.units.temp,
    wind_unit:state.units.wind,
    pressure_unit:state.units.press,
    precipitation_unit:state.units.precip,
    forecast_days:state.units.days,
    weather_model:preferredWeatherModel(),
    notifications_enabled:state.push.status === 'Ingeschakeld',
    // Nieuwe servers kunnen deze JSON-instellingen accountbreed bewaren.
    notification_preferences:state.push.preferences,
    notification_thresholds:state.push.thresholds
  };
}

async function loadCloudProfileAndFavorites(){
  if(!state.auth.user) return;
  try{
    const data = await apiJson('/profile');
    state.auth.profile = data.profile || null;
    mapProfileToUnits(state.auth.profile);
    await saveUnitsLocalOnly();
    savePushSettings();
    refreshPushSettingsControls();
    refreshSettingsSegments();
    if(Array.isArray(data.favorites)){
      state.favorites = data.favorites.map(f=>({id:f.id, name:f.name, lat:+f.latitude, lon:+f.longitude, admin:f.country || ''}));
      await window.storage.set('weerscoop:favorites', JSON.stringify(state.favorites)).catch(()=>undefined);
    }
  }catch(e){
    console.warn('Profielsync mislukt:', e?.message || e);
    toast('Profiel kon niet worden gesynchroniseerd.');
  }
}

async function syncProfileSettingsToCloud(){
  if(state.auth.syncing || !state.auth.user) return;
  state.auth.syncing = true;
  try{
    const payload = profilePayload();
    let data;
    try{
      data = await apiJson('/profile', {method:'PUT', body:JSON.stringify(payload)});
    }catch(error){
      // Compatibiliteit met een oudere API die de twee nieuwe JSON-velden nog niet kent.
      const legacyPayload = {...payload};
      delete legacyPayload.notification_preferences;
      delete legacyPayload.notification_thresholds;
      data = await apiJson('/profile', {method:'PUT', body:JSON.stringify(legacyPayload)});
      console.info('Profielserver gebruikt nog het oude schema; meldingsvoorkeuren blijven lokaal bewaard.', error?.message || error);
    }
    state.auth.profile = data.profile || state.auth.profile;
    updateAuthInterface(state.auth.session);
  }catch(e){
    console.warn('Instellingen niet gesynchroniseerd:', e?.message || e);
  }finally{
    state.auth.syncing = false;
  }
}

async function syncFavoritesToCloud(force=false){
  if(!force && state.auth.syncing) return;
  if(!state.auth.user) return;
  try{
    const rows = state.favorites.map((f,i)=>({
      name:String(f.name || 'Favoriet').slice(0,80),
      latitude:+f.lat,
      longitude:+f.lon,
      country:String(f.admin || '').slice(0,120),
      sort_order:i
    }));
    await apiJson('/favorites', {method:'PUT', body:JSON.stringify({favorites:rows})});
    updateAuthInterface(state.auth.session);
  }catch(e){
    console.warn('Favorieten niet gesynchroniseerd:', e?.message || e);
  }
}

/* ---------------- unit conversions ---------------- */
function fmtTemp(c){
  if(c==null||isNaN(c)) return '-';
  const v = state.units.temp==='F' ? c*9/5+32 : c;
  return Math.round(v) + '°';
}

function formatConfidence(value, fallback=.6){
  const raw = Number.isFinite(Number(value)) ? Number(value) : fallback;
  const pct = raw <= 1 ? raw * 100 : raw;
  return `${Math.max(0, Math.min(100, Math.round(pct)))}%`;
}
function fmtWind(kmh){
  if(kmh==null||isNaN(kmh)) return '-';
  let v = kmh, unit='km/u';
  if(state.units.wind==='ms'){ v = kmh/3.6; unit='m/s'; }
  else if(state.units.wind==='kn'){ v = kmh/1.852; unit='kn'; }
  else if(state.units.wind==='mph'){ v = kmh/1.609; unit='mph'; }
  return Math.round(v) + ' ' + unit;
}
function fmtWindVal(kmh){
  if(kmh==null||isNaN(kmh)) return '-';
  let v = kmh;
  if(state.units.wind==='ms') v = kmh/3.6;
  else if(state.units.wind==='kn') v = kmh/1.852;
  else if(state.units.wind==='mph') v = kmh/1.609;
  return Math.round(v);
}
function fmtPrecip(mm){
  if(mm==null||isNaN(mm)) return '-';
  const v = state.units.precip==='in' ? mm/25.4 : mm;
  return (state.units.precip==='in' ? v.toFixed(2) : v.toFixed(1)) + (state.units.precip==='in'?' in':' mm');
}
function fmtPress(hpa){
  if(hpa==null||isNaN(hpa)) return '-';
  const v = state.units.press==='inhg' ? hpa*0.02953 : hpa;
  return (state.units.press==='inhg' ? v.toFixed(2) : Math.round(v)) + (state.units.press==='inhg' ? ' inHg':' hPa');
}

function isBeneluxLocation(){
  const {lat, lon} = state.loc;
  return lat >= 49 && lat <= 54.2 && lon >= 2.2 && lon <= 7.8;
}

function preferredWeatherModel(){
  const model = state.units.model || 'best_match';
  return ['best_match','ecmwf_ifs025','icon_eu','gfs_seamless','knmi_seamless'].includes(model) ? model : 'best_match';
}

function closestIndex(times, targetMs){
  if(!times || !times.length) return 0;
  let best = 0, bestDiff = Infinity;
  for(let i=0;i<times.length;i++){
    const diff = Math.abs(new Date(times[i]).getTime() - targetMs);
    if(diff < bestDiff){ best = i; bestDiff = diff; }
  }
  return best;
}

const METAR_STATIONS = [
  {id:'EBOS', name:'Oostende', lat:51.199, lon:2.862},
  {id:'EBFN', name:'Koksijde', lat:51.089, lon:2.652},
  {id:'EBAW', name:'Antwerpen', lat:51.190, lon:4.463},
  {id:'EBBR', name:'Brussel', lat:50.901, lon:4.484},
  {id:'EBCI', name:'Charleroi', lat:50.459, lon:4.454},
  {id:'EBLG', name:'Luik', lat:50.637, lon:5.443},
  {id:'EBBL', name:'Kleine-Brogel', lat:51.168, lon:5.470},
  {id:'EHAM', name:'Amsterdam Schiphol', lat:52.309, lon:4.764},
  {id:'EHRD', name:'Rotterdam', lat:51.957, lon:4.437},
  {id:'EHBK', name:'Maastricht', lat:50.912, lon:5.770},
  {id:'EHEH', name:'Eindhoven', lat:51.450, lon:5.374},
  {id:'EHGG', name:'Groningen', lat:53.119, lon:6.579}
];

const COASTAL_PLACES = [
  {name:'Oostende', lat:51.225, lon:2.919},
  {name:'Middelkerke', lat:51.186, lon:2.820},
  {name:'Nieuwpoort', lat:51.132, lon:2.751},
  {name:'Koksijde', lat:51.116, lon:2.637},
  {name:'De Panne', lat:51.099, lon:2.593},
  {name:'Blankenberge', lat:51.313, lon:3.132},
  {name:'Zeebrugge', lat:51.330, lon:3.207},
  {name:'Knokke-Heist', lat:51.341, lon:3.286}
];

function kmDistance(aLat, aLon, bLat, bLon){
  const r = 6371, toRad = d => d*Math.PI/180;
  const dLat = toRad(bLat-aLat), dLon = toRad(bLon-aLon);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(aLat))*Math.cos(toRad(bLat))*Math.sin(dLon/2)**2;
  return 2*r*Math.asin(Math.sqrt(a));
}

function nearestMetarStation(){
  const ranked = METAR_STATIONS
    .map(s => ({...s, dist:kmDistance(state.loc.lat,state.loc.lon,s.lat,s.lon)}))
    .sort((a,b)=>a.dist-b.dist);
  return ranked[0];
}

function nearestCoastalPlace(){
  const ranked = COASTAL_PLACES
    .map(p => ({...p, dist:kmDistance(state.loc.lat,state.loc.lon,p.lat,p.lon)}))
    .sort((a,b)=>a.dist-b.dist);
  return ranked[0];
}

function isCoastalLocation(){
  const p = nearestCoastalPlace();
  return p && p.dist <= 18;
}

async function loadMarine(){
  state.marine = null;
  state.seaspark = null;
  const coast = nearestCoastalPlace();
  if(!coast || coast.dist > 18) return;
  try{
    const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${coast.lat}&longitude=${coast.lon}&hourly=wave_height,wave_period,wave_direction,sea_surface_temperature&timezone=auto&forecast_days=2`;
    const r = await fetch(url);
    if(!r.ok) return;
    const d = await r.json();
    const idx = closestIndex(d.hourly.time, Date.now());
    state.marine = {
      place:coast.name,
      waveHeight:d.hourly.wave_height?.[idx] ?? null,
      wavePeriod:d.hourly.wave_period?.[idx] ?? null,
      waveDirection:d.hourly.wave_direction?.[idx] ?? null,
      seaSurfaceTemperature:d.hourly.sea_surface_temperature?.[idx] ?? null,
      hourly:d.hourly,
      tide:tideStateForOostende(new Date())
    };
    state.seaspark = buildSeaSparkForecast(coast, d.hourly);
  }catch(e){}
}

function clamp(n, min=0, max=100){
  return Math.max(min, Math.min(max, n));
}

function buildSeaSparkForecast(coast, marineHourly){
  if(!coast || !state.hourly || !state.daily) return null;
  const now = new Date();
  const start = new Date(now);
  if(start.getHours() < 18) start.setHours(20,0,0,0);
  else start.setMinutes(0,0,0);
  const end = new Date(start);
  end.setHours(3,0,0,0);
  if(end <= start) end.setDate(end.getDate()+1);

  const hours = [];
  for(let i=0;i<state.hourly.time.length;i++){
    const t = new Date(state.hourly.time[i]);
    if(t >= start && t <= end) hours.push(i);
  }
  const marineHours = [];
  for(let i=0;i<(marineHourly?.time || []).length;i++){
    const t = new Date(marineHourly.time[i]);
    if(t >= start && t <= end) marineHours.push(i);
  }
  const avg = arr => {
    const vals = arr.filter(v=>v!=null && Number.isFinite(Number(v))).map(Number);
    return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
  };
  const max = arr => {
    const vals = arr.filter(v=>v!=null && Number.isFinite(Number(v))).map(Number);
    return vals.length ? Math.max(...vals) : null;
  };
  const min = arr => {
    const vals = arr.filter(v=>v!=null && Number.isFinite(Number(v))).map(Number);
    return vals.length ? Math.min(...vals) : null;
  };

  const seaTemp = avg(marineHours.map(i=>marineHourly.sea_surface_temperature?.[i]));
  const wave = avg(marineHours.map(i=>marineHourly.wave_height?.[i]));
  const wind = avg(hours.map(i=>state.hourly.wind_speed_10m?.[i]));
  const gust = max(hours.map(i=>state.hourly.wind_gusts_10m?.[i]));
  const rain = avg(hours.map(i=>state.hourly.precipitation?.[i]));
  const pop = max(hours.map(i=>state.hourly.precipitation_probability?.[i]));
  const cloud = avg(hours.map(i=>state.hourly.cloud_cover?.[i]));
  const visibility = min(hours.map(i=>state.hourly.visibility?.[i]));
  const season = seaSparkSeasonScore(now);
  const tempScore = seaTemp == null ? 12 : seaTemp >= 20 ? 24 : seaTemp >= 18 ? 20 : seaTemp >= 16 ? 14 : seaTemp >= 14 ? 8 : 3;
  const calmScore = wind == null ? 10 : wind <= 8 ? 20 : wind <= 14 ? 15 : wind <= 22 ? 7 : 0;
  const waveScore = wave == null ? 8 : wave <= .25 ? 16 : wave <= .55 ? 12 : wave <= .9 ? 6 : 0;
  const dryScore = (rain ?? 0) <= .1 && (pop ?? 0) <= 35 ? 12 : (rain ?? 0) <= .5 ? 6 : 0;
  const darkScore = cloud == null ? 8 : cloud >= 55 ? 12 : cloud >= 25 ? 8 : 5;
  const visibilityScore = visibility == null ? 4 : visibility >= 6000 ? 6 : visibility >= 3000 ? 3 : 0;
  const score = clamp(Math.round(season + tempScore + calmScore + waveScore + dryScore + darkScore + visibilityScore));
  const level = score >= 72 ? 'Hoog' : score >= 48 ? 'Matig' : score >= 25 ? 'Laag' : 'Zeer laag';
  const bestHour = bestSeaSparkHour(hours, marineHourly, marineHours, seaTemp);
  const factors = [];
  if(seaTemp != null) factors.push(`zeewater ${seaTemp.toFixed(1)} °C`);
  if(wind != null) factors.push(`wind ${Math.round(wind)} km/u`);
  if(wave != null) factors.push(`golven ${wave.toFixed(1)} m`);
  if(pop != null) factors.push(`regenkans ${Math.round(pop)}%`);
  const advice = [];
  if(score >= 48) advice.push('Ga pas na volledige duisternis kijken en beweeg het water zachtjes.');
  if((wind ?? 99) > 18) advice.push('Veel wind kan het effect moeilijk zichtbaar maken.');
  if((wave ?? 99) > .8) advice.push('Een ruwe zee verlaagt de zichtbaarheid.');
  if((seaTemp ?? 0) < 16) advice.push('Het zeewater is nog koel, daardoor is de kans lager.');
  if(!advice.length) advice.push('Kijk op donkere plekken zonder fel licht, liefst bij rustig water.');

  return {
    place:coast.name,
    score,
    level,
    bestTime:bestHour,
    seaTemp,
    wind,
    gust,
    wave,
    rain,
    pop,
    cloud,
    factors,
    advice,
    source:'Open-Meteo weer + marine, indicatieve natuurkans'
  };
}

function seaSparkSeasonScore(date){
  const m = date.getMonth() + 1;
  if(m === 6 || m === 7 || m === 8) return 20;
  if(m === 5 || m === 9) return 12;
  if(m === 4 || m === 10) return 5;
  return 0;
}

function bestSeaSparkHour(hours, marineHourly, marineHours, fallbackSeaTemp){
  if(!hours.length) return null;
  let best = {score:-1, time:null};
  hours.forEach(i=>{
    const t = new Date(state.hourly.time[i]);
    const hour = t.getHours();
    const dark = hour >= 22 || hour <= 3 ? 22 : hour >= 20 ? 12 : 4;
    const wind = state.hourly.wind_speed_10m?.[i] ?? 16;
    const pop = state.hourly.precipitation_probability?.[i] ?? 40;
    const marineIndex = closestIndex(marineHourly?.time || [], t.getTime());
    const wave = marineHourly?.wave_height?.[marineIndex] ?? .7;
    const seaTemp = marineHourly?.sea_surface_temperature?.[marineIndex] ?? fallbackSeaTemp ?? 16;
    const score = dark + (seaTemp >= 18 ? 18 : seaTemp >= 16 ? 11 : 4) + (wind <= 10 ? 18 : wind <= 18 ? 10 : 2) + (wave <= .45 ? 12 : wave <= .8 ? 7 : 1) + (pop <= 30 ? 8 : 2);
    if(score > best.score) best = {score, time:t};
  });
  return best.time;
}

async function loadAirQuality(){
  state.air = null;
  try{
    const {lat, lon} = state.loc;
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,ozone,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen&hourly=european_aqi,pm10,pm2_5,nitrogen_dioxide,ozone&timezone=auto`;
    const r = await fetch(url);
    if(!r.ok) return;
    const d = await r.json();
    state.air = d.current || null;
  }catch(e){}
}

function tideStateForOostende(now){
  const highRef = new Date('2026-07-17T16:33:00+02:00').getTime();
  const halfCycle = 6*3600*1000 + 12.5*60*1000;
  const cycle = halfCycle*2;
  let n = Math.round((now.getTime() - highRef) / halfCycle);
  let nearest = highRef + n*halfCycle;
  const nearestType = Math.abs(n % 2) === 0 ? 'hoogwater' : 'laagwater';
  let nextN = Math.ceil((now.getTime() - highRef) / halfCycle);
  if(highRef + nextN*halfCycle <= now.getTime()) nextN++;
  const nextTime = new Date(highRef + nextN*halfCycle);
  const nextType = Math.abs(nextN % 2) === 0 ? 'hoogwater' : 'laagwater';
  const previousN = nextN - 1;
  const previousType = Math.abs(previousN % 2) === 0 ? 'hoogwater' : 'laagwater';
  const stateLabel = nextType === 'hoogwater' ? 'Vloed' : 'Eb';
  return {state:stateLabel, nextType, nextTime, nearestType, nearestTime:new Date(nearest), previousType};
}

function metarWeatherCode(m){
  const raw = String(m.rawOb || '');
  if(/\bTS/.test(raw)) return 95;
  if(/\bSN/.test(raw)) return 71;
  if(/\bRA/.test(raw)) return 61;
  if(/\bDZ/.test(raw)) return 51;
  if(/\bFG|\bBR/.test(raw)) return 45;
  if(['BKN','OVC'].includes(m.cover)) return 3;
  if(['SCT'].includes(m.cover)) return 2;
  if(['FEW'].includes(m.cover)) return 1;
  if(['CLR','SKC','NSC','CAVOK'].includes(m.cover)) return 0;
  return null;
}

async function loadCurrentObservation(){
  state.observation = null;
  const station = nearestMetarStation();
  if(!station || station.dist > 90) return;
  try{
    const controller = new AbortController();
    const timeout = setTimeout(()=>controller.abort(), 5500);
    const endpoint = new URL('weather/metar', API_BASE);
    endpoint.searchParams.set('ids', station.id);
    const r = await fetch(endpoint.href, {cache:'no-store', signal:controller.signal}).finally(()=>clearTimeout(timeout));
    if(!r.ok) return;
    const rows = await r.json();
    const m = Array.isArray(rows) ? rows[0] : rows;
    if(!m || m.temp == null) return;
    const reportMs = m.reportTime ? new Date(m.reportTime).getTime() : (m.obsTime ? m.obsTime*1000 : 0);
    if(!reportMs || Date.now() - reportMs > 90*60*1000) return;
    state.observation = {
      source:`Waarneming ${station.id}`,
      station:station.name,
      distanceKm:station.dist,
      time:reportMs,
      temperature_2m:+m.temp,
      dew_point_2m:m.dewp != null ? +m.dewp : null,
      wind_direction_10m:m.wdir != null ? +m.wdir : null,
      wind_speed_10m:m.wspd != null ? +m.wspd*1.852 : null,
      pressure_msl:m.altim != null ? +m.altim : null,
      weather_code:metarWeatherCode(m)
    };
  }catch(e){
    console.warn('METAR niet beschikbaar, Open-Meteo blijft actief:', e?.message || e);
  }
}

function liveWeatherSnapshot(){
  const cur = {...(state.current || {})};
  if(state.minutely && state.minutely.time && state.minutely.time.length){
    const targetMs = Date.now();
    const idx = closestIndex(state.minutely.time, targetMs);
    const minuteAge = Math.abs(new Date(state.minutely.time[idx]).getTime() - targetMs) / 60000;
    if(minuteAge <= 35){
      ['temperature_2m','weather_code','precipitation','wind_speed_10m','wind_gusts_10m'].forEach(k=>{
        if(state.minutely[k] && state.minutely[k][idx] != null) cur[k] = state.minutely[k][idx];
      });
    }
  }
  const obs = state.observation;
  if(obs){
    ['temperature_2m','dew_point_2m','wind_direction_10m','wind_speed_10m','pressure_msl'].forEach(k=>{
      if(obs[k] != null) cur[k] = obs[k];
    });
    if(obs.weather_code != null) cur.weather_code = obs.weather_code;
  }
  cur.weather_code = effectiveCurrentWeatherCode(cur);
  return cur;
}

function precipitationSignal(cur=state.current || {}){
  const signal = {now:0, soon:0, pop:0, thunder:false};

  // Gebruik zowel de actuele snapshot als de ruwe current-data. Zo kan een
  // 15-minutenframe met 0 mm een echte actuele regenmeting niet overschrijven.
  const snapshotPrecip = Number(cur?.precipitation) || 0;
const snapshotRain = Number(cur?.rain) || 0;
const snapshotShowers = Number(cur?.showers) || 0;

const currentPrecip = Number(state.current?.precipitation) || 0;
const currentRain = Number(state.current?.rain) || 0;
const currentShowers = Number(state.current?.showers) || 0;

const currentTotal = Math.max(
  snapshotPrecip,
  snapshotRain,
  snapshotShowers,
  currentPrecip,
  currentRain,
  currentShowers
);

signal.now = Math.max(signal.now, currentTotal);
signal.soon = Math.max(signal.soon, currentTotal);

  const targetMs = Date.now();
  if(state.minutely?.time?.length){
    const idx = closestIndex(state.minutely.time, targetMs);
    const minuteAge = Math.abs(new Date(state.minutely.time[idx]).getTime() - targetMs) / 60000;
    if(minuteAge <= 35){
      // Open-Meteo minutely_15 is een hoeveelheid per 15 minuten. Zet om naar
      // een mm/u-intensiteit voordat we lichte/gewone/zware regen bepalen.
      const slots = state.minutely.precipitation.slice(idx, idx + 4).map(v=>(Number(v) || 0) * 4);
      const minuteNow = slots[0] || 0;
      signal.now = Math.max(signal.now, minuteNow);
      signal.soon = Math.max(signal.soon, ...slots);
      const codes = state.minutely.weather_code?.slice(idx, idx + 4) || [];
      signal.thunder = codes.some(c=>[95,96,99].includes(Number(c)));
    }
  }

  if(state.hourly?.time?.length){
    const idx = nowIndexInHourly();
    const hourPrecip = Number(state.hourly.precipitation?.[idx]) || 0;
    const nextPrecip = Number(state.hourly.precipitation?.[idx + 1]) || 0;
    // Uurdata is grover: gebruik ze vooral als 'soon'-signaal, niet om droog
    // weer nu automatisch als regen te tonen.
    signal.soon = Math.max(signal.soon, hourPrecip, nextPrecip);
    signal.pop = Number(state.hourly.precipitation_probability?.[idx]) || 0;
    signal.thunder = signal.thunder || [95,96,99].includes(Number(state.hourly.weather_code?.[idx]));
  }
  // Verse live radar krijgt voorrang wanneer neerslag echt boven de gebruiker ligt.
  const rp = state.radar?.proximity;
  const radarFresh = rp && Date.now() - Number(rp.checkedAt || 0) < 10*60*1000;
  if(radarFresh){
    signal.radarDistanceKm = Number(rp.distanceKm);
    signal.radarLevel = rp.localIntensity || rp.intensity || 'light';
    signal.radarNow = Boolean(rp.atLocation || (Number.isFinite(signal.radarDistanceKm) && signal.radarDistanceKm <= 4));
    if(signal.radarNow){
      // Radar bepaalt vooral OF het regent. De kleur van RainViewer is niet betrouwbaar
      // genoeg om rechtstreeks 'zware regen' te forceren; daarvoor gebruiken we de
      // gemeten/verwachte hoeveelheid van Open-Meteo.
      const radarMm = 0.2;
      signal.now = Math.max(signal.now, radarMm);
      signal.soon = Math.max(signal.soon, radarMm);
    }
  }
  return signal;
}

function effectiveCurrentWeatherCode(cur=state.current || {}){
  const code = Number(cur.weather_code);
  const drizzleCodes = [51,53,55,56,57];
  const rainCodes = [61,63,65,66,67,80,81,82];
  const snowCodes = [71,73,75,77,85,86];
  const p = precipitationSignal(cur);

  if([99,96,95].includes(code)) return code;
  if(snowCodes.includes(code)) return code;
  if([66,67].includes(code)) return code;
  if([45,48].includes(code) && p.now < 0.1) return code;

  if(p.thunder && p.now >= 0.1) return 95;
  if(p.now >= 7.5) return 65;
  if(p.now >= 2.0) return 63;
  if(p.now >= 0.1) return 61;

  if(drizzleCodes.includes(code) || rainCodes.includes(code)) return code;
  return Number.isFinite(code) ? code : 0;
}

function isNetherlandsLocation(){
  const {lat, lon} = state.loc;
  return lat >= 50.7 && lat <= 53.8 && lon >= 3.1 && lon <= 7.4;
}

function isBelgiumLocation(){
  const lat = Number(state.loc?.lat), lon = Number(state.loc?.lon);
  return Number.isFinite(lat) && Number.isFinite(lon) &&
    lat >= 49.45 && lat <= 51.60 && lon >= 2.45 && lon <= 6.45;
}

function shouldUseKnmiWmsRadar(){
  return isNetherlandsLocation();
}

function radarView(){
  const lat = Number(state.loc?.lat);
  const lon = Number(state.loc?.lon);
  if(Number.isFinite(lat) && Number.isFinite(lon)) return {center:[lat, lon], zoom:8};
  return {center:[50.85, 4.55], zoom:7};
}

const TV_RADAR_OOSTENDE_VIEW = Object.freeze({
  marker:[51.225, 2.919],
  center:[51.34, 2.80],
  bounds:[[50.72, 1.45], [51.95, 4.15]],
  padding:[14, 14],
  zoom:8
});

function tvRadarView(){
  return TV_RADAR_OOSTENDE_VIEW;
}

const RADAR_PROVIDER_ZOOMS = {
  rainviewer:{min:3, max:8, nativeMax:7},
  weatherflow:{min:5, max:8, nativeMax:7}
};

function clampRadarZoom(provider, requestedZoom){
  const range = RADAR_PROVIDER_ZOOMS[provider] || RADAR_PROVIDER_ZOOMS.rainviewer;
  const rounded = Math.round(Number(requestedZoom) || range.max);
  return Math.max(range.min, Math.min(range.max, rounded));
}

function setTvRadarViewForProvider(provider){
  const rv = tvRadarView();
  const range = RADAR_PROVIDER_ZOOMS[provider] || RADAR_PROVIDER_ZOOMS.rainviewer;
  const zoom = clampRadarZoom(provider, rv.zoom);
  tv.radarProvider = provider;
  if(tv.map){
    tv.map.stop();
    tv.map.setMinZoom(range.min);
    tv.map.setMaxZoom(range.max);
    tv.map.fitBounds(L.latLngBounds(rv.bounds), {
      animate:false,
      paddingTopLeft:rv.padding,
      paddingBottomRight:rv.padding,
      maxZoom:zoom
    });
  }
  tv.locationMarker?.setLatLng(rv.marker);
  return {center:rv.center, zoom};
}

const ALERT_LEVELS = {
  green:{rank:0, label:'Code groen', cls:'green', title:'Geen bijzonder weer'},
  yellow:{rank:1, label:'Code geel', cls:'yellow', title:'Wees alert'},
  orange:{rank:2, label:'Code oranje', cls:'orange', title:'Grote kans op gevaarlijk weer'},
  red:{rank:3, label:'Code rood', cls:'red', title:'Zeer gevaarlijk weer'}
};

function alertLevelFromText(text){
  const t = String(text || '').toLowerCase();
  if(t.includes('code rood') || /\brood\b/.test(t) || /\bred\b/.test(t)) return 'red';
  if(t.includes('code oranje') || /\boranje\b/.test(t) || /\borange\b/.test(t)) return 'orange';
  if(t.includes('code geel') || /\bgeel\b/.test(t) || /\byellow\b/.test(t)) return 'yellow';
  return 'green';
}

function buildIndicativeAlert(){
  if(!state.current || !state.hourly) return [];
  const cur = liveWeatherSnapshot();
  const nowIdx = nowIndexInHourly();
  const end = Math.min(nowIdx + 24, state.hourly.time.length);
  let maxGust = cur.wind_gusts_10m || 0;
  let maxRain = 0;
  let maxPop = 0;
  let thunder = [95,96,99].includes(cur.weather_code);
  let maxTemp = cur.temperature_2m ?? -99;
  let minTemp = cur.temperature_2m ?? 99;
  for(let i=nowIdx;i<end;i++){
    maxGust = Math.max(maxGust, state.hourly.wind_gusts_10m[i] || 0);
    maxRain = Math.max(maxRain, state.hourly.precipitation[i] || 0);
    maxPop = Math.max(maxPop, state.hourly.precipitation_probability[i] || 0);
    maxTemp = Math.max(maxTemp, state.hourly.temperature_2m[i] ?? maxTemp);
    minTemp = Math.min(minTemp, state.hourly.temperature_2m[i] ?? minTemp);
    if([95,96,99].includes(state.hourly.weather_code[i])) thunder = true;
  }
  let level = 'green';
  const reasons = [];
  if(maxGust >= 100){ level = 'red'; reasons.push(`zeer zware windstoten tot ${Math.round(maxGust)} km/u`); }
  else if(maxGust >= 85){ level = 'orange'; reasons.push(`zware windstoten tot ${Math.round(maxGust)} km/u`); }
  else if(maxGust >= 70){ level = 'yellow'; reasons.push(`windstoten tot ${Math.round(maxGust)} km/u`); }
  if(thunder && ALERT_LEVELS[level].rank < 1){ level = 'yellow'; reasons.push('kans op onweer'); }
  if(maxRain >= 20 && ALERT_LEVELS[level].rank < 2){ level = 'orange'; reasons.push(`intense neerslag mogelijk (${maxRain.toFixed(1)} mm/u)`); }
  else if((maxRain >= 8 || maxPop >= 80) && ALERT_LEVELS[level].rank < 1){ level = 'yellow'; reasons.push('grote kans op buien of regen'); }
  if(maxTemp >= 35 && ALERT_LEVELS[level].rank < 2){ level = 'orange'; reasons.push(`hitte tot ${Math.round(maxTemp)} graden`); }
  else if(maxTemp >= 30 && ALERT_LEVELS[level].rank < 1){ level = 'yellow'; reasons.push(`warm tot ${Math.round(maxTemp)} graden`); }
  if(minTemp <= -5 && ALERT_LEVELS[level].rank < 1){ level = 'yellow'; reasons.push(`kou rond ${Math.round(minTemp)} graden`); }
  let headline = 'Geen actieve weermelding';
  if(level !== 'green'){
    const text = reasons.join(' ').toLowerCase();
    if(text.includes('regen') || text.includes('bui') || text.includes('neerslag')) headline = 'Regen op komst';
    else if(text.includes('onweer')) headline = 'Onweer mogelijk';
    else if(text.includes('wind')) headline = 'Sterke wind mogelijk';
    else if(text.includes('hitte') || text.includes('warm')) headline = 'Warm weer';
    else if(text.includes('kou')) headline = 'Koud weer';
    else headline = 'Wheaterflow-signaal';
  }
  return [{
    level,
    headline,
    description: reasons.length ? sentenceFromReasons(reasons) : 'Geen opvallende signalen in de komende 24 uur.',
    source: preferredWeatherModel()==='knmi_seamless' ? 'KNMI HARMONIE model' : 'weermodel',
    official:false
  }];
}

function sentenceFromReasons(reasons){
  const clean = reasons.filter(Boolean);
  if(!clean.length) return '';
  if(clean.length === 1) return clean[0].charAt(0).toUpperCase() + clean[0].slice(1) + '.';
  const last = clean.pop();
  return clean.join(', ') + ' en ' + last + '.';
}

async function fetchKnmiWarnings(){
  if(!isNetherlandsLocation()) return null;
  const r = await fetch(WHEATERFLOW_API_BASE + '/knmi/warnings', {cache:'no-store'});
  if(!r.ok) throw new Error('KNMI waarschuwingen niet beschikbaar');
  const data = await r.json();
  return Array.isArray(data.alerts) ? data.alerts : null;
}


function isValidOfficialKmiAlert(alert){
  if(!alert || alert.official !== true) return false;
  if(!['yellow','orange','red'].includes(String(alert.level||'').toLowerCase())) return false;

  const phenomenon = String(alert.phenomenon || '').trim().toLowerCase();
  const headline = String(alert.headline || '').trim().toLowerCase();
  const description = String(alert.description || '').trim().toLowerCase();
  const combined = `${phenomenon} ${headline} ${description}`;

  const allowed = ['wind','regen','onweer','gladheid','mist','stormtij','koude','hitte'];
  if(!allowed.some(x => phenomenon === x || headline.startsWith(x + ' ') || headline.startsWith(x + '·'))) return false;

  // Nooit browser-/fallbackteksten als weerwaarschuwing tonen.
  if(/browser|upgrade|inhoud kan verloren|niet correct weergegeven|algemene voorwaarden|nieuwsoverzicht|podcasts|management|gender equality/i.test(combined)) return false;

  // Een echte KMI-waarschuwing moet een geldigheidsperiode hebben.
  const from = alert.validFrom ? new Date(alert.validFrom).getTime() : NaN;
  const to = alert.validTo ? new Date(alert.validTo).getTime() : NaN;
  if(!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return false;
  if(to < Date.now()) return false;

  return true;
}

async function fetchKmiWarnings(){
  if(!isBelgiumLocation()) return null;
  const qs = new URLSearchParams({lat:String(state.loc.lat), lon:String(state.loc.lon)});
  const r = await fetch(WHEATERFLOW_API_BASE + '/kmi/warnings?' + qs.toString(), {cache:'no-store'});
  if(!r.ok) throw new Error('KMI waarschuwingen niet beschikbaar');
  const data = await r.json();
  return Array.isArray(data.alerts) ? data.alerts : null;
}

async function loadAlerts(){
  try{
    const official = isBelgiumLocation() ? await fetchKmiWarnings() : await fetchKnmiWarnings();
    if(official && official.length){
      const cleaned = isBelgiumLocation()
        ? official.filter(isValidOfficialKmiAlert)
        : official;
      if(cleaned.length){
        state.alerts = cleaned.sort((a,b)=>{ const rank=(ALERT_LEVELS[b.level]?.rank||0)-(ALERT_LEVELS[a.level]?.rank||0); if(rank) return rank; const ta=a.validFrom?new Date(a.validFrom).getTime():0, tb=b.validFrom?new Date(b.validFrom).getTime():0; return (ta||Infinity)-(tb||Infinity); });
        state.alertsMeta = {
          source:isBelgiumLocation() ? 'KMI België' : 'KNMI Data Platform',
          official:true,
          updated:Date.now()
        };
        return;
      }
    }
  }catch(e){
    console.warn('Officiële waarschuwingen tijdelijk niet beschikbaar:', e);
  }
  state.alerts = buildIndicativeAlert();
  state.alertsMeta = {
    source: state.alerts[0]?.source || 'Indicatieve weercode',
    official:false,
    updated:Date.now()
  };
}

async function loadAstroEvents(){
  if(state.astroEvents.loaded) return;
  try{
    const r = await fetch(`${ASTRO_EVENTS_URL}?v=20260812-astro-events`, {cache:'no-store'});
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    state.astroEvents.events = Array.isArray(data.events) ? data.events : [];
    state.astroEvents.sources = Array.isArray(data.sources) ? data.sources : [];
    state.astroEvents.error = null;
  }catch(error){
    console.warn('Astro-events konden niet geladen worden:', error);
    state.astroEvents.events = [];
    state.astroEvents.sources = [];
    state.astroEvents.error = error;
  }finally{
    state.astroEvents.loaded = true;
  }
}

/* ---------------- weather code -> label / icon / severity ---------------- */
const WCODE = {
  0:{l:'Helder', ic:'sun'}, 1:{l:'Overwegend helder', ic:'sun-cloud'}, 2:{l:'Half bewolkt', ic:'sun-cloud'},
  3:{l:'Bewolkt', ic:'cloud'}, 45:{l:'Mist', ic:'fog'}, 48:{l:'Rijpmist', ic:'fog'},
  51:{l:'Lichte motregen', ic:'drizzle'}, 53:{l:'Motregen', ic:'drizzle'}, 55:{l:'Dichte motregen', ic:'drizzle'},
  56:{l:'IJzel (motregen)', ic:'drizzle'}, 57:{l:'IJzel (dichte motregen)', ic:'drizzle'},
  61:{l:'Lichte regen', ic:'rain'}, 63:{l:'Regen', ic:'rain'}, 65:{l:'Zware regen', ic:'rain'},
  66:{l:'IJzel (regen)', ic:'rain'}, 67:{l:'IJzel (zware regen)', ic:'rain'},
  71:{l:'Lichte sneeuw', ic:'snow'}, 73:{l:'Sneeuw', ic:'snow'}, 75:{l:'Zware sneeuw', ic:'snow'}, 77:{l:'Sneeuwkorrels', ic:'snow'},
  80:{l:'Lichte buien', ic:'rain'}, 81:{l:'Buien', ic:'rain'}, 82:{l:'Zware buien', ic:'rain'},
  85:{l:'Sneeuwbuien', ic:'snow'}, 86:{l:'Zware sneeuwbuien', ic:'snow'},
  95:{l:'Onweer', ic:'storm', severe:true}, 96:{l:'Onweer met hagel', ic:'storm', severe:true}, 99:{l:'Zwaar onweer met hagel', ic:'storm', severe:true}
};
function wcInfo(code){ return WCODE[code] || {l:'Onbekend', ic:'cloud'}; }

function isDayForTime(timeValue){
  if(!state.daily || !state.daily.time) return true;
  const dateKey = String(timeValue).slice(0,10);
  const dayIdx = state.daily.time.findIndex(t => t === dateKey);
  if(dayIdx < 0) return true;
  const sunrise = state.daily.sunrise?.[dayIdx];
  const sunset = state.daily.sunset?.[dayIdx];
  if(!sunrise || !sunset) return true;
  const ts = new Date(timeValue).getTime();
  return ts >= new Date(sunrise).getTime() && ts < new Date(sunset).getTime();
}

function icon(name, isDay=true, size=24, cls=''){
  const s = size, c = cls;
  const stroke = 'stroke="currentColor" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  switch(name){
    case 'sun': return isDay
      ? `<svg class="${c}" width="${s}" height="${s}" viewBox="0 0 24 24" ${stroke} style="color:#f5c451"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/></svg>`
      : `<svg class="${c}" width="${s}" height="${s}" viewBox="0 0 24 24" ${stroke} style="color:#c9d3ea"><path d="M20 14.5A8 8 0 1110.5 4a6.5 6.5 0 009.5 10.5z"/></svg>`;
    case 'sun-cloud': return isDay
      ? `<svg class="${c}" width="${s}" height="${s}" viewBox="0 0 24 24" ${stroke}><circle cx="9" cy="9" r="3.4" style="color:#f5c451" stroke="#f5c451"/><path d="M4 9v0M9 3v0" stroke="#f5c451"/><path d="M7 20h10a3.5 3.5 0 000-7 5 5 0 00-9.6-1.6A3.6 3.6 0 007 20z" style="color:#9fb0d1" stroke="#9fb0d1"/></svg>`
      : `<svg class="${c}" width="${s}" height="${s}" viewBox="0 0 24 24" ${stroke}><path d="M15.8 10.6A5.8 5.8 0 019.4 3.2a6.7 6.7 0 007.9 8.4" style="color:#d7def0" stroke="#d7def0"/><path d="M7 20h10a3.5 3.5 0 000-7 5 5 0 00-9.6-1.6A3.6 3.6 0 007 20z" style="color:#9fb0d1" stroke="#9fb0d1"/></svg>`;
    case 'cloud': return `<svg class="${c}" width="${s}" height="${s}" viewBox="0 0 24 24" ${stroke} style="color:#9fb0d1"><path d="M6.5 19h11a3.8 3.8 0 000-7.6 5.5 5.5 0 00-10.6-1.7A4 4 0 006.5 19z"/></svg>`;
    case 'fog': return `<svg class="${c}" width="${s}" height="${s}" viewBox="0 0 24 24" ${stroke} style="color:#9fb0d1"><path d="M6.5 14h11a3.8 3.8 0 000-7.6 5.5 5.5 0 00-10.6-1.7A4 4 0 006.5 14z"/><path d="M4 18h16M4 21h16"/></svg>`;
    // Neerslagiconen gebruiken dezelfde verticale 'cloud baseline' als het gewone wolkicoon.
    // De wolk is iets compacter gemaakt zodat regen/sneeuw/bliksem eronder past zonder
    // dat het hele icoon omhoog hoeft te schuiven.
    case 'drizzle': return `<svg class="${c}" width="${s}" height="${s}" viewBox="0 0 24 24" ${stroke} style="overflow:visible"><g><path d="M6.5 19h11a3.8 3.8 0 000-7.6 5.5 5.5 0 00-10.6-1.7A4 4 0 006.5 19z" transform="translate(1.75 .6) scale(.855)" style="color:#9fb0d1"/><path d="M8.8 18.7l-.8 2M12.8 18.7l-.8 2M16.8 18.7l-.8 2" style="color:#35d0c4"/></g></svg>`;
    case 'rain': return `<svg class="${c}" width="${s}" height="${s}" viewBox="0 0 24 24" ${stroke} style="overflow:visible"><g><path d="M6.5 19h11a3.8 3.8 0 000-7.6 5.5 5.5 0 00-10.6-1.7A4 4 0 006.5 19z" transform="translate(1.75 .2) scale(.855)" style="color:#9fb0d1"/><path d="M8.5 18.5l-1.1 3M13 18.5l-1.1 3M17.5 18.5l-1.1 3" style="color:#35d0c4"/></g></svg>`;
    case 'snow': return `<svg class="${c}" width="${s}" height="${s}" viewBox="0 0 24 24" ${stroke} style="overflow:visible"><g><path d="M6.5 19h11a3.8 3.8 0 000-7.6 5.5 5.5 0 00-10.6-1.7A4 4 0 006.5 19z" transform="translate(1.75 .2) scale(.855)" style="color:#9fb0d1"/><path d="M9 19v3M7.5 20.5h3M15 19v3M13.5 20.5h3" style="color:#dfe9fb"/></g></svg>`;
    case 'storm': return `<svg class="${c}" width="${s}" height="${s}" viewBox="0 0 24 24" ${stroke} style="overflow:visible"><g><path d="M6.5 19h11a3.8 3.8 0 000-7.6 5.5 5.5 0 00-10.6-1.7A4 4 0 006.5 19z" transform="translate(1.75 -.25) scale(.855)" style="color:#9fb0d1"/><path d="M13 17.3l-3 3.6h2.45L11.35 23l3.8-4.5h-2.3z" fill="#f5a524" stroke="#f5a524"/></g></svg>`;
    case 'wind': return `<svg class="${c}" width="${s}" height="${s}" viewBox="0 0 24 24" ${stroke}><path d="M3 8h10a2.5 2.5 0 10-2.2-3.7M3 16h13a2.5 2.5 0 11-2.2 3.7M3 12h16a2 2 0 10-1.8-2.9"/></svg>`;
    case 'drop': return `<svg class="${c}" width="${s}" height="${s}" viewBox="0 0 24 24" ${stroke}><path d="M12 3s6 7 6 11.5A6 6 0 016 14.5C6 10 12 3 12 3z"/></svg>`;
    case 'gauge': return `<svg class="${c}" width="${s}" height="${s}" viewBox="0 0 24 24" ${stroke}><path d="M12 12L16 8M4 14a8 8 0 1116 0"/></svg>`;
    case 'eye': return `<svg class="${c}" width="${s}" height="${s}" viewBox="0 0 24 24" ${stroke}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="2.6"/></svg>`;
    case 'uv': return `<svg class="${c}" width="${s}" height="${s}" viewBox="0 0 24 24" ${stroke}><circle cx="12" cy="14" r="4.2"/><path d="M12 3v2.5M4.5 8L6.3 9.5M19.5 8l-1.8 1.5M2.5 15h2.7M18.8 15h2.7"/></svg>`;
    case 'sunrise': return `<svg class="${c}" width="${s}" height="${s}" viewBox="0 0 24 24" ${stroke}><path d="M4 18h16M7 18a5 5 0 0110 0M12 6v4M8.5 8.5L10 10M15.5 8.5L14 10"/></svg>`;
    case 'thermo': return `<svg class="${c}" width="${s}" height="${s}" viewBox="0 0 24 24" ${stroke}><path d="M12 3a2 2 0 00-2 2v9.5a4 4 0 102 0V5a2 2 0 00-2-2z" fill="none"/><circle cx="12" cy="17" r="1.4" fill="currentColor"/></svg>`;
    default: return `<svg class="${c}" width="${s}" height="${s}" viewBox="0 0 24 24" ${stroke}><circle cx="12" cy="12" r="9"/></svg>`;
  }
}

/* ---------------- geolocation ---------------- */
function getBrowserLocation({fresh=false}={}){
  return new Promise((resolve)=>{
    if(!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      pos => resolve({lat:pos.coords.latitude, lon:pos.coords.longitude, accuracy:pos.coords.accuracy}),
      () => resolve(null),
      {
        timeout:fresh ? 12000 : 6000,
        maximumAge:fresh ? 0 : 600000,
        enableHighAccuracy:!!fresh
      }
    );
  });
}

async function reverseGeocode(lat, lon, {fallbackToStored=true}={}){
  try{
    const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=nl`, {cache:'no-store'});
    if(!r.ok) throw new Error(`reverse geocode ${r.status}`);
    const d = await r.json();
    const name = d.city || d.locality || d.principalSubdivision || d.countryName || '';
    const admin = [d.principalSubdivision, d.countryName].filter(Boolean).join(', ');
    const country = d.countryName || '';
    if(name) rememberResolvedLocation(name,admin,country);
    if(!fallbackToStored){
      return {name:name || 'Huidige locatie', admin, country};
    }
    const last=lastResolvedLocation();
    return {name:name || last?.name || cleanLocationName(state.loc?.name,'Geselecteerde locatie'), admin:admin || last?.admin || state.loc?.admin || '', country:country || last?.country || state.loc?.country || ''};
  }catch(e){
    if(!fallbackToStored){
      return {name:'Huidige locatie', admin:'', country:''};
    }
    const last=lastResolvedLocation();
    return {name:last?.name || cleanLocationName(state.loc?.name,'Geselecteerde locatie'), admin:last?.admin || state.loc?.admin || '', country:last?.country || state.loc?.country || ''};
  }
}

/* ---------------- geocoding search ---------------- */
let searchTimer = null;
let searchRequestSeq = 0;
$('#searchInput').addEventListener('input', (e)=>{
  const q = e.target.value.trim();
  $('#clearSearch').style.display = q ? 'block' : 'none';
  clearTimeout(searchTimer);
  if(q.length < 2){ searchRequestSeq++; showLocationSuggestion(); return; }
  searchTimer = setTimeout(()=>doSearch(q), 300);
});
$('#searchInput').addEventListener('focus', ()=>{
  if(!$('#searchInput').value.trim()) showLocationSuggestion();
});
$('#clearSearch').addEventListener('click', ()=>{
  $('#searchInput').value=''; $('#clearSearch').style.display='none'; showLocationSuggestion();
});

$('#searchLocationBtn')?.addEventListener('click', async (e)=>{
  e.preventDefault();
  e.stopPropagation();
  clearTimeout(searchTimer);
  searchTimer = null;
  searchRequestSeq++;
  const input = $('#searchInput');
  if(input){
    input.value='';
    input.blur();
  }
  $('#clearSearch').style.display='none';
  await useCurrentBrowserLocation();
});

function locationSuggestionHtml(){
  return `<div class="sugg-item sugg-location" data-use-current-location="true">
    <span class="sugg-location-icon" aria-hidden="true">
      <img src="./assets/ui/location/current-location-liquid.png" alt="" class="current-location-liquid-icon"/>
    </span>
    <span class="sugg-main">
      <span class="sugg-location-title-row">
        <span class="sugg-name">Huidige locatie</span>
        <span class="sugg-current-badge">Actueel</span>
      </span>
      <span class="sugg-sub">Tik om je huidige positie te gebruiken</span>
    </span>
  </div>`;
}

function fitSearchSuggestions(){
  const box = $('#suggestions');
  if(!box || !box.classList.contains('show')) return;
  const vv = window.visualViewport;
  const viewportBottom = (vv?.offsetTop || 0) + (vv?.height || window.innerHeight);
  const boxTop = box.getBoundingClientRect().top;
  const available = Math.max(150, viewportBottom - boxTop - 10);
  box.style.setProperty('--wf-search-results-max', `${Math.min(420, Math.floor(available))}px`);
}

function showSearchSuggestions(box){
  if(!box) return;
  box.classList.add('show');
  requestAnimationFrame(fitSearchSuggestions);
}

window.visualViewport?.addEventListener('resize', fitSearchSuggestions);
window.visualViewport?.addEventListener('scroll', fitSearchSuggestions);
window.addEventListener('orientationchange', ()=>setTimeout(fitSearchSuggestions, 120));

function showLocationSuggestion(){
  const box = $('#suggestions');
  if(!box) return;
  box.innerHTML = locationSuggestionHtml();
  showSearchSuggestions(box);
  wireCurrentLocationSuggestion(box);
}

function wireCurrentLocationSuggestion(box=$('#suggestions')){
  $('[data-use-current-location]', box)?.addEventListener('click', useCurrentBrowserLocation);
}

async function useCurrentBrowserLocation(){
  const box = $('#suggestions');
  if(box){
    box.innerHTML = `<div class="sugg-empty">Je actuele GPS-locatie wordt bepaald...</div>`;
    showSearchSuggestions(box);
  }
  // Voor deze knop nooit een oude/cached positie gebruiken: hij betekent letterlijk 'waar ben ik nu?'.
  const p = await getBrowserLocation({fresh:true});
  if(!p){
    if(box) box.innerHTML = `<div class="sugg-empty">Je huidige locatie kon niet worden opgehaald. Controleer Locatievoorzieningen en de toestemming voor Wheaterflow.</div>`;
    return;
  }
  // Belangrijk: als reverse geocoding faalt, nooit de laatst GEZOCHTE plaatsnaam hergebruiken.
  const g = await reverseGeocode(p.lat, p.lon, {fallbackToStored:false});
  await setLocation(p.lat, p.lon, g.name, g.admin, g.country, 'gps');
  if(box) box.classList.remove('show');
  $('#searchInput').value='';
  $('#clearSearch').style.display='none';
  toast(g.name && g.name !== 'Huidige locatie' ? `Huidige locatie: ${g.name}` : 'Huidige GPS-locatie geladen');
}

async function doSearch(q){
  const box = $('#suggestions');
  const requestSeq = ++searchRequestSeq;
  try{
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=nl&format=json`);
    const d = await r.json();
    if(requestSeq !== searchRequestSeq || $('#searchInput').value.trim() !== q) return;
    const results = d.results || [];
    if(!results.length){
      box.innerHTML = `<div class="sugg-empty">Geen plaatsen gevonden voor "${q}"</div>`;
      showSearchSuggestions(box); return;
    }
    box.innerHTML = results.map((res,i)=>`
      <div class="sugg-item sugg-place" data-i="${i}">
        <span class="sugg-main">
          <span class="sugg-name">${res.name}</span>
          <span class="sugg-sub">${[res.admin1, res.country].filter(Boolean).join(', ')}</span>
        </span>
        <span class="sugg-place-arrow" aria-hidden="true">›</span>
      </div>`).join('');
    showSearchSuggestions(box);
    $$('.sugg-place', box).forEach(el=>{
      el.addEventListener('click', ()=>{
        const res = results[+el.dataset.i];
        if(!res) return;
        setLocation(res.latitude, res.longitude, res.name, [res.admin1,res.country].filter(Boolean).join(', '), res.country || '', 'manual');
        box.classList.remove('show');
        $('#searchInput').value=''; $('#clearSearch').style.display='none';
      });
    });
  }catch(e){
    box.innerHTML = `<div class="sugg-empty">Zoeken mislukt - controleer je verbinding.</div>`;
    showSearchSuggestions(box);
  }
}
document.addEventListener('click', (e)=>{
  if(!e.target.closest('.searchwrap')) $('#suggestions').classList.remove('show');
});

async function setLocation(lat, lon, name, admin, country='', status='manual'){
  const nextLat = Number(lat);
  const nextLon = Number(lon);
  if(!Number.isFinite(nextLat) || !Number.isFinite(nextLon)){
    toast('Deze locatie kon niet worden gebruikt');
    return;
  }
  let displayName = cleanLocationName(name, '');
  if(!displayName || (/huidige locatie/i.test(displayName) && status !== 'gps')){
    const resolved = await reverseGeocode(nextLat,nextLon);
    displayName = cleanLocationName(resolved.name, lastResolvedLocation()?.name || 'Locatie bepalen…');
    admin = admin || resolved.admin;
    country = country || resolved.country;
  }
  // Bij GPS mag een mislukte plaatsnaam-resolutie nooit terugvallen op de laatst handmatig gezochte plaats.
  if(status === 'gps' && !displayName) displayName = 'Huidige locatie';
  state.locationStatus = status;
  state.loc = {lat:nextLat, lon:nextLon, name:displayName, admin:admin || '', country:country || ''};
  rememberResolvedLocation(displayName, state.loc.admin, state.loc.country);
  state.rainEta = null;
  await loadWeather();
  if(state.map){ const rv = radarView(); state.map.setView(rv.center, rv.zoom); placeMarker(nextLat,nextLon,displayName); }
  refreshRadarSource();
  updateStormTab();
  notifyCastLocationChanged();
  notifyTvPairingLocationChanged();
  toast(`${displayName} geladen`);
}

function currentCastLocation(){
  const lat = Number(state.loc?.lat);
  const lon = Number(state.loc?.lon);
  if(!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return {
    name: locationDisplayName('Geselecteerde locatie'),
    admin: state.loc.admin || '',
    country: state.loc.country || '',
    latitude: lat,
    longitude: lon
  };
}

function castStatusText(status, detail={}){
  switch(status){
    case 'loading': return 'Cast laden...';
    case 'ready': return 'Cast naar tv';
    case 'connecting': return 'Verbinden...';
    case 'connected': return `Verbonden met ${detail.deviceName || state.cast.deviceName || 'tv'}`;
    case 'disconnected': return 'Cast naar tv';
    case 'unconfigured': return 'Cast niet ingesteld';
    case 'unavailable': return 'Cast niet beschikbaar';
    case 'error': return detail.message || 'Kan geen verbinding maken';
    default: return 'Cast naar tv';
  }
}

function updateCastUi(status=state.cast.status, detail={}){
  state.cast.status = status;
  if(status === 'connected'){
    state.cast.connected = true;
    state.cast.deviceName = detail.deviceName || state.cast.deviceName || 'tv';
  }else if(['ready','disconnected','unavailable','unconfigured','error'].includes(status)){
    state.cast.connected = false;
    if(status !== 'error') state.cast.deviceName = '';
  }
  const btn = $('#castBtn');
  if(!btn) return;
  const visible = state.cast.available || ['loading','ready','connecting','connected','error'].includes(status);
  btn.hidden = !visible;
  btn.disabled = ['loading','connecting','unconfigured','unavailable'].includes(status);
  btn.classList.toggle('connected', status === 'connected');
  btn.classList.toggle('error', status === 'error');
  btn.textContent = castStatusText(status, detail);
  btn.title = status === 'unconfigured'
    ? 'Vul GOOGLE_CAST_APP_ID in nadat je de receiver in Google Cast Console hebt geregistreerd.'
    : btn.textContent;
}

async function initCast(){
  if(!window.WheaterflowCastService?.create) return;
  state.cast.receiver = window.WheaterflowCastService.isReceiverMode();
  state.cast.service = window.WheaterflowCastService.create({
    configUrls:CAST_CONFIG_URLS,
    getLocation:currentCastLocation,
    onStatus:(status, detail={})=>{
      if(status.startsWith('receiver')){
        const el = $('#tvCastStatus');
        if(el){
          if(status === 'receiver-loading') el.textContent = 'Verbinden...';
          if(status === 'receiver-ready') el.textContent = 'Wachten op locatie van je telefoon';
          if(status === 'receiver-dev') el.textContent = 'TV testmodus';
          if(status === 'receiver-location') el.textContent = `Cast actief - ${detail.location?.name || ''}`;
        }
        return;
      }
      if(status === 'ready') state.cast.available = true;
      if(status === 'unconfigured') state.cast.configured = false;
      updateCastUi(status, detail);
    },
    applyReceiverLocation:applyCastReceiverLocation,
    refreshReceiverWeather:async()=>loadWeather()
  });

  if(state.cast.receiver){
    await startCastReceiverMode();
    return;
  }

  const config = await state.cast.service.fetchConfig();
  state.cast.configured = Boolean(config.configured);
  if(!state.cast.configured){
    updateCastUi('unconfigured');
    return;
  }
  updateCastUi('loading');
  const ok = await state.cast.service.initSender();
  if(!ok) updateCastUi('unavailable');
}

async function startCastReceiverMode(){
  document.body.classList.add('cast-receiver-mode');
  $('#app')?.setAttribute('aria-hidden', 'true');
  await enterTV({fromCast:true});
  const urlLoc = window.WheaterflowCastService.locationFromUrl();
  if(urlLoc) await applyCastReceiverLocation(urlLoc);
  await state.cast.service?.initReceiver();
}

async function applyCastReceiverLocation(location){
  const loc = window.WheaterflowCastService?.normalizeLocation(location);
  if(!loc) return;
  state.loc = {
    lat:loc.latitude,
    lon:loc.longitude,
    name:loc.name,
    admin:loc.admin || [loc.country].filter(Boolean).join(', '),
    country:loc.country || ''
  };
  await loadWeather();
  if(tv.map){
    const rv = tvRadarView();
    tv.map.setView(rv.center, rv.zoom);
    await initTvMap();
  }
  const status = $('#tvCastStatus');
  if(status) status.textContent = `Cast actief - ${loc.name}`;
}

async function notifyCastLocationChanged(){
  if(!state.cast.service || state.cast.receiver) return;
  if(state.cast.connected || state.cast.status === 'connected'){
    await state.cast.service.notifyLocationChanged();
  }
}

$('#castBtn')?.addEventListener('click', async ()=>{
  if(!state.cast.service) await initCast();
  if(!state.cast.service) return toast('Cast is niet beschikbaar op dit apparaat');
  const ok = await state.cast.service.requestSession();
  if(ok) toast('TV-modus wordt geopend op je tv');
});


function isTvPairingRoute(){
  try{
    if(window.WheaterflowTvPairingService?.isTvRoute) return window.WheaterflowTvPairingService.isTvRoute();
    const params = new URLSearchParams(location.search);
    const path = location.pathname.replace(/\/+$/, '');
    return !params.has('castReceiver') && (path.endsWith('/tv') || params.has('tv'));
  }catch(error){
    return false;
  }
}

function tvPairingMessage(text, type=''){
  const el = $('#tvPairMessage');
  if(!el) return;
  el.textContent = text;
  el.className = `tv-pair-message ${type}`.trim();
}

function syncTvPairCodeSlots(value=$('#tvPairCodeInput')?.value || ''){
  const clean=window.WheaterflowTvPairingService?.cleanCode ? window.WheaterflowTvPairingService.cleanCode(value) : String(value).replace(/\D/g,'').slice(0,6);
  $$('.tv-pair-code-slot').forEach((slot,i)=>{
    slot.textContent=clean[i] || '';
    slot.classList.toggle('filled',Boolean(clean[i]));
    slot.classList.toggle('active',i===Math.min(clean.length,5));
  });
}

function openTvPairSheet(code=''){
  document.body.classList.add('tv-pair-open');
  const input = $('#tvPairCodeInput');
  if(input){
    if(code) input.value = code;
    syncTvPairCodeSlots(input.value);
    requestAnimationFrame(()=>input.focus());
  }
  updateTvPairingUi();
}

function closeTvPairSheet(){
  document.body.classList.remove('tv-pair-open');
}

function updateTvPairingUi(status=state.tvPairing.status, detail={}){
  state.tvPairing.status = status;
  if(status === 'connected'){
    state.tvPairing.connected = true;
  }else if(['disconnected','error','idle'].includes(status)){
    state.tvPairing.connected = false;
  }
  const btn = $('#pairTvBtn');
  if(btn){
    btn.classList.toggle('connected', state.tvPairing.connected);
    btn.classList.toggle('error', status === 'error');
    btn.textContent = state.tvPairing.connected ? 'TV gekoppeld' : 'TV koppelen';
    btn.title = state.tvPairing.connected ? 'Locatie wordt automatisch naar je TV gestuurd' : 'Koppel een TV met wheaterflow.be/tv';
  }
  const quickBtn = $('#tvBtn');
  if(quickBtn){
    quickBtn.classList.toggle('connected', state.tvPairing.connected);
    quickBtn.classList.toggle('error', status === 'error');
    quickBtn.title = state.tvPairing.connected ? 'TV gekoppeld' : 'TV koppelen';
    quickBtn.setAttribute('aria-label', state.tvPairing.connected ? 'TV gekoppeld openen' : 'TV koppelen');
  }
  const settingsStatus = $('#tvSettingsStatus');
  if(settingsStatus){
    settingsStatus.textContent = state.tvPairing.connected ? 'Gekoppeld' : (status === 'error' ? 'Controleer code' : 'Niet gekoppeld');
  }
  const settingsSubtitle = $('#tvSettingsSubtitle');
  if(settingsSubtitle){
    settingsSubtitle.textContent = state.tvPairing.connected
      ? 'Je actieve locatie wordt naar je TV gestuurd.'
      : 'Open wheaterflow.be/tv op je TV en koppel met de code.';
  }
  const disconnect = $('#tvPairDisconnect');
  const refresh = $('#tvPairRefresh');
  if(disconnect) disconnect.hidden = !state.tvPairing.connected;
  if(refresh) refresh.hidden = !state.tvPairing.connected;
  if(detail.message) tvPairingMessage(detail.message, status === 'error' ? 'error' : 'ok');
}

function updateTvPairOverlay(data={}){
  const overlay = $('#tvPairOverlay');
  const codeEl = $('#tvPairCodeDisplay');
  const countEl = $('#tvPairCountdown');
  if(!overlay || !codeEl || !countEl) return;
  overlay.hidden = Boolean(data.paired);
  if(data.code){
    state.tvPairing.code = data.code;
    state.tvPairing.expiresAt = data.expiresAt || 0;
    codeEl.textContent = data.code;
  }
  if(data.paired){
    countEl.textContent = 'Telefoon gekoppeld.';
    $('#tvPairOverlayMessage').textContent = 'Je locatie verschijnt zo op de TV.';
  }else if(data.expiresIn != null){
    countEl.textContent = `Code vervalt over ${Math.max(0, data.expiresIn)} sec.`;
  }else{
    countEl.textContent = 'Koppelcode wordt opgehaald...';
  }
}

async function applyTvPairingReceiverLocation(location){
  const loc = window.WheaterflowTvPairingService?.normalizeLocation(location);
  if(!loc) return;
  await applyCastReceiverLocation(loc);
  $('#tvPairOverlay')?.setAttribute('hidden', '');
  const status = $('#tvCastStatus');
  if(status) status.textContent = `TV gekoppeld - ${loc.name}`;
}

async function initTvPairing(){
  state.tvPairing.receiver = isTvPairingRoute();
  if(state.tvPairing.receiver){
    document.documentElement.classList.add('tv-route');
    document.body.classList.add('tv-pairing-receiver');
    $('#app')?.setAttribute('aria-hidden', 'true');
  }
  if(!window.WheaterflowTvPairingService?.create){
    if(state.tvPairing.receiver){
      document.getElementById('tvscreen')?.classList.add('active');
      $('#tvPairOverlay')?.removeAttribute('hidden');
      const msg = $('#tvPairOverlayMessage');
      if(msg) msg.textContent = 'TV-koppeling wordt geladen...';
    }
    return;
  }
  state.tvPairing.service = window.WheaterflowTvPairingService.create({
    apiUrls:TV_PAIRING_API_URLS,
    getLocation:currentCastLocation,
    onTvCode:updateTvPairOverlay,
    onTvPaired:(data)=>{
      updateTvPairOverlay(data);
      const status = $('#tvCastStatus');
      if(status) status.textContent = 'Telefoon gekoppeld - wacht op locatie';
    },
    onTvLocation:applyTvPairingReceiverLocation,
    onTvRefresh:async()=>loadWeather(),
    onTvDisconnected:()=>{
      const overlay = $('#tvPairOverlay');
      if(overlay) overlay.hidden = false;
      const status = $('#tvCastStatus');
      if(status) status.textContent = 'Telefoon ontkoppeld';
    },
    onControllerPaired:()=>{
      updateTvPairingUi('connected', {message:'TV gekoppeld. Je locatie wordt nu doorgestuurd.'});
    },
    onControllerStatus:(data)=>{
      updateTvPairingUi(data.tvConnected ? 'connected' : 'connected');
      if(!data.tvConnected) tvPairingMessage('TV is even niet bereikbaar. Laat de TV-pagina openstaan.', 'error');
    },
    onControllerDisconnected:(error)=>{
      updateTvPairingUi('disconnected', {message:error?.message || 'TV-koppeling is gestopt.'});
    },
    onError:(error)=>{
      console.warn('TV-koppeling:', error);
      const msg = $('#tvPairOverlayMessage');
      if(msg) msg.textContent = 'Koppeling probeert opnieuw te verbinden...';
    }
  });

  wireTvPairingUi();

  if(state.tvPairing.receiver){
    await startTvPairingReceiverMode();
    return;
  }

  if(state.tvPairing.service.restoreController()){
    updateTvPairingUi('connected', {message:'Vorige TV-koppeling hersteld.'});
  }

  const code = window.WheaterflowTvPairingService.pairCodeFromUrl();
  if(code) openTvPairSheet(code);
}

function wireTvPairingUi(){
  $('#pairTvBtn')?.addEventListener('click', ()=>openTvPairSheet());
  $('#tvBtn')?.addEventListener('click', ()=>openTvPairSheet());
  $('#tvPairClose')?.addEventListener('click', closeTvPairSheet);
  $('#tvPairScrim')?.addEventListener('click', closeTvPairSheet);
  $('#tvPairCodeInput')?.addEventListener('input', (event)=>{
    event.target.value = window.WheaterflowTvPairingService.cleanCode(event.target.value);
    syncTvPairCodeSlots(event.target.value);
  });
  $('#tvPairCodeSlots')?.addEventListener('click', ()=>$('#tvPairCodeInput')?.focus());
  $('#tvPairCodeInput')?.addEventListener('keydown', (event)=>{
    if(event.key === 'Enter') $('#tvPairSubmit')?.click();
  });
  $('#tvPairSubmit')?.addEventListener('click', async ()=>{
    try{
      tvPairingMessage('Koppelen...', '');
      const code = $('#tvPairCodeInput')?.value;
      await state.tvPairing.service?.pair(code);
      closeTvPairSheet();
      toast('TV gekoppeld');
    }catch(error){
      console.error('TV koppelen mislukt:', error);
      updateTvPairingUi('error', {message:error.message || 'TV kon niet gekoppeld worden.'});
    }
  });
  $('#tvPairRefresh')?.addEventListener('click', async ()=>{
    try{
      await state.tvPairing.service?.refreshTv();
      await notifyTvPairingLocationChanged();
      tvPairingMessage('TV wordt ververst.', 'ok');
    }catch(error){
      updateTvPairingUi('error', {message:error.message || 'Verversen is mislukt.'});
    }
  });
  $('#tvPairDisconnect')?.addEventListener('click', async ()=>{
    await state.tvPairing.service?.disconnect();
    updateTvPairingUi('disconnected', {message:'TV ontkoppeld.'});
  });
}

async function startTvPairingReceiverMode(){
  document.body.classList.add('tv-pairing-receiver');
  $('#app')?.setAttribute('aria-hidden', 'true');
  await enterTV({fromPairing:true});
  $('#tvPairOverlay')?.removeAttribute('hidden');
  const status = $('#tvCastStatus');
  if(status) status.textContent = 'Wachten op telefoon';
  await state.tvPairing.service?.startTvSession();
}

async function notifyTvPairingLocationChanged(){
  if(!state.tvPairing.service || state.tvPairing.receiver || !state.tvPairing.connected) return;
  try{
    await state.tvPairing.service.notifyLocationChanged(currentCastLocation());
  }catch(error){
    console.warn('TV-locatie kon niet verzonden worden:', error);
  }
}

/* ---------------- weather fetch ---------------- */
function buildForecastUrl(model){
  const {lat, lon} = state.loc;
  return `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`+
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m`+
    `&minutely_15=precipitation,weather_code,temperature_2m,wind_speed_10m,wind_gusts_10m`+
    `&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,visibility,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,cape,lifted_index,freezing_level_height,relative_humidity_2m,dew_point_2m,uv_index,cloud_cover`+
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,uv_index_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,daylight_duration,sunshine_duration`+
    `&timezone=auto&forecast_days=14&wind_speed_unit=kmh`+
    (model && model !== 'best_match' ? `&models=${model}` : '');
}

async function fetchForecast(model){
  const response = await fetch(buildForecastUrl(model), {cache:'no-store'});
  let data = null;
  try{
    data = await response.json();
  }catch(error){
    throw new Error(`Weerdata kon niet worden gelezen (${response.status})`);
  }
  if(!response.ok || data?.error || !data?.current || !data?.hourly || !data?.daily){
    const reason = data?.reason || data?.error || `HTTP ${response.status}`;
    throw new Error(reason);
  }
  return data;
}

async function fetchForecastWithFallback(model){
  try{
    return await fetchForecast(model);
  }catch(error){
    if(model && model !== 'best_match'){
      console.warn(`${model} faalde, standaard weermodel wordt geprobeerd:`, error);
      return fetchForecast('best_match');
    }
    throw error;
  }
}

async function loadWeather(){
  $('#homeLoader')?.classList.remove('hide');
  try{
    let requestedModel = preferredWeatherModel();
    let d = await fetchForecastWithFallback(requestedModel);
    state.current = d.current; state.hourly = d.hourly; state.daily = d.daily; state.minutely = d.minutely_15;
    state.tz = d.timezone; state.utcOffsetSec = d.utc_offset_seconds;
    state.lastUpdated = Date.now();
const optionalResults = await Promise.allSettled([
  loadCurrentObservation(),
  loadMarine(),
  loadAirQuality(),
  loadAlerts(),
  loadWheaterflowAdminAlerts(),
  loadAstroEvents(),
  refreshRadarProximityIfStale(),
  loadLightning()
]);
    optionalResults.forEach((result, index)=>{
      if(result.status === 'rejected'){
console.warn(
  [
    'METAR',
    'Marine',
    'Luchtkwaliteit',
    'Officiële meldingen',
    'Wheaterflow adminmeldingen',
    'Astro-events',
    'Radar-nabijheid',
    'Live bliksemdata'
  ][index] + ' laden faalde:',
  result.reason
);
      }
    });
    try{
      renderHome();
    }catch(renderError){
      console.error('Home render faalde:', renderError);
      throw renderError;
    }
    captureTodayClimate('auto').catch(error=>console.warn('Mijn Klimaat opslaan faalde:', error));
    try{ updateLastUpdatedText(); }catch(error){ console.warn('Laatste update tekst faalde:', error); }
    try{ if(tv.active) renderTV(); }catch(error){ console.warn('TV render faalde:', error); }
    try{ if($('#stormscreen')?.classList.contains('active')) updateStormTab(); }catch(error){ console.warn('Storm tab update faalde:', error); }
    try{ if($('#radarscreen')?.classList.contains('active') && state.radar.duration>1) renderHourlyChart(); }catch(error){ console.warn('Radar grafiek update faalde:', error); }
  }catch(e){
    console.error('Weather load failed:', e);
    $('#homeInner').innerHTML = `<div class="empty-state">${icon('cloud',true,38)}<div>Kon het weer niet laden.<br>Controleer je internetverbinding en probeer opnieuw.</div></div>`;
  }finally{
    $('#homeLoader')?.classList.add('hide');
    setTimeout(hideAppSplash, 260);
  }
}

function updateLastUpdatedText(){
  const el = $('#updatedText');
  if(!el || !state.lastUpdated) return;
  const secs = Math.round((Date.now()-state.lastUpdated)/1000);
  let txt;
  if(secs < 45) txt = 'Zojuist bijgewerkt';
  else if(secs < 90) txt = '1 minuut geleden bijgewerkt';
  else if(secs < 3600) txt = `${Math.round(secs/60)} minuten geleden bijgewerkt`;
  else txt = `${Math.round(secs/3600)} uur geleden bijgewerkt`;
  el.textContent = txt;
}

function startAutoRefresh(){
  clearInterval(state.refreshTimer);
  clearInterval(state.clockTickTimer);
  state.refreshTimer = setInterval(()=>{
    if(document.hidden) return; // niet nodeloos verversen als het tabblad niet zichtbaar is
    loadWeather();
  }, 60*1000);
  state.clockTickTimer = setInterval(updateLastUpdatedText, 15*1000);
  document.addEventListener('visibilitychange', async ()=>{
    if(document.hidden) return;
    const weatherAge = state.lastUpdated ? Date.now()-state.lastUpdated : Infinity;
    if(weatherAge > 30*1000) loadWeather();
    if(state.map && state.activeTab === 'radarscreen'){
      await nextPaint();
      refreshRadarLayout();
      refreshRadarSource().catch(error=>console.warn('Radar hervatten faalde:', error));
    }
  });
}

function nowIndexInHourly(){
  if(!state.hourly) return 0;
  return closestIndex(state.hourly.time, Date.now());
}

/* ---------------- Wheaterflow intelligence layer ---------------- */
function weatherIntelligence(){
  return {
    rain: nowcastEngine(),
    storm: stormEngine(),
    sea: seaEngine()
  };
}

/* Wheaterflow 2.0: één genormaliseerde frontend-weertoestand.
 * UI-componenten kunnen hiermee dezelfde semantiek gebruiken voor regen,
 * temperatuur en wind zonder telkens losse API-velden anders te interpreteren.
 */
function normalizedWeatherState(){
  const cur = liveWeatherSnapshot() || {};
  const rain = nowcastEngine();
  const idx = nowIndexInHourly();
  const h = state.hourly || {};
  const valid = value => validNumber(value);
  const rainRate = Math.max(0,
    valid(cur.precipitation) ?? 0,
    rain?.status === 'raining' && Array.isArray(rain.slots) && rain.slots.length
      ? (valid(rain.slots[0]?.precipitation) ?? 0) * 4
      : 0
  );
  return {
    temperature:valid(cur.temperature_2m),
    feelsLike:valid(cur.apparent_temperature ?? cur.temperature_2m),
    condition:wcInfo(cur.weather_code),
    weatherCode:valid(cur.weather_code),
    rainRate,
    rainProbability:valid(h.precipitation_probability?.[idx]),
    rainAccumulation:valid(h.precipitation?.[idx]),
    rainEta:rain,
    windSpeed:valid(cur.wind_speed_10m),
    windGust:valid(cur.wind_gusts_10m),
    windDirection:valid(cur.wind_direction_10m),
    pressure:valid(cur.pressure_msl),
    humidity:valid(cur.relative_humidity_2m),
    dewPoint:valid(h.dew_point_2m?.[idx]),
    visibility:valid(h.visibility?.[idx]),
    cloudCover:valid(cur.cloud_cover ?? h.cloud_cover?.[idx]),
    uv:valid(h.uv_index?.[idx] ?? state.daily?.uv_index_max?.[0]),
    sunrise:state.daily?.sunrise?.[0] || null,
    sunset:state.daily?.sunset?.[0] || null,
    warnings:Array.isArray(state.alerts) ? state.alerts : []
  };
}

function calculateRainEtaRaw(){
  const output = {
    status:'unavailable',
    title:'Nowcast tijdelijk niet beschikbaar',
    summary:'Er is nu geen bruikbare korte-termijn neerslagdata.',
    startsInMinutes:null,
    startTime:null,
    endTime:null,
    endsInMinutes:null,
    intensity:'unknown',
    intensityLabel:'Onbekend',
    dryWindowMinutes:null,
    confidence:0,
    heavyShower:false,
    thunderPossible:false,
    source:'Geen actuele nowcast',
    slots:[],
    generatedAt:new Date().toISOString()
  };
  const minutely = state.minutely;
  if(!minutely?.time?.length || !Array.isArray(minutely.precipitation)){
    return output;
  }

  const now = Date.now();
  const idx = closestIndex(minutely.time, now);
  const frameMs = Date.parse(minutely.time[idx] + ':00');
  if(!Number.isFinite(frameMs) || Math.abs(frameMs - now) > 45 * 60000){
    output.summary = 'De korte-termijn neerslagdata is te oud of ontbreekt.';
    output.source = 'Nowcast verouderd';
    return output;
  }

  const slots = [];
  const maxSlots = Math.min(minutely.time.length, idx + 12);
  for(let i=idx; i<maxSlots; i++){
    const time = new Date(minutely.time[i] + ':00');
    const mm = Math.max(0, Number(minutely.precipitation[i]) || 0);
    const code = Number(minutely.weather_code?.[i]);
    slots.push({
      index:i,
      time,
      minutes:Math.max(0, Math.round((time.getTime() - now) / 60000)),
      precipitation:mm,
      weatherCode:Number.isFinite(code) ? code : null,
      wet:mm >= 0.1 || [51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99].includes(code)
    });
  }
  if(!slots.length){
    return output;
  }

  const wetSlots = slots.filter(s => s.wet);

/*
 * Actuele neerslag krijgt voorrang op de 15-minutenvoorspelling.
 *
 * Dit voorkomt bijvoorbeeld:
 * - Home zegt "Helder"
 * - Radar toont regen
 * - Rain ETA zegt "geen regen"
 *
 * precipitationSignal() combineert de actuele snapshot,
 * current-data en de meest recente minutely-data.
 */
const currentSignal = precipitationSignal(liveWeatherSnapshot());

const rainingNow =
  currentSignal.now >= 0.1 ||
  slots[0]?.wet === true;

/*
 * Als het nu al regent, begint de regen op minuut 0.
 * Anders zoeken we zoals vroeger naar de eerstvolgende natte periode.
 */
const firstWetFromForecast = slots.find(s => s.wet);

const firstWet = rainingNow
  ? {
      time: new Date(),
      minutes: 0,
      precipitation: Math.max(
        currentSignal.now,
        Number(slots[0]?.precipitation) || 0
      ),
      wet: true
    }
  : firstWetFromForecast;

/*
 * Zoek het eerste droge tijdstip ná de actuele regen.
 */
const firstDryAfterNow = rainingNow
  ? slots.find((s, i) => i > 0 && !s.wet)
  : null;

const wetFromNow = slots.findIndex(s => s.wet);
const firstWetIndex = wetFromNow >= 0 ? wetFromNow : -1;

/*
 * Wanneer het nú regent maar het eerste 15-minutenframe foutief droog is,
 * zoeken we gewoon het eerste toekomstige droge frame.
 */
let dryAfterWetIndex = -1;

if (rainingNow) {
  dryAfterWetIndex = slots.findIndex((s, i) => i > 0 && !s.wet);
} else if (firstWetIndex >= 0) {
  dryAfterWetIndex = slots.findIndex(
    (s, i) => i > firstWetIndex && !s.wet
  );
}

/*
 * Neem ook de actuele hoeveelheid mee voor de intensiteit.
 */
// minutely_15 bevat mm per kwartier; voor intensiteitslabels vergelijken we
// alles als mm/u. Een losse WMO-code mag niet langer op zichzelf 'zware regen'
// forceren wanneer de berekende hoeveelheid slechts licht is.
const maxRain = Math.max(
  currentSignal.now || 0,
  0,
  ...slots.map(s => (Number(s.precipitation) || 0) * 4)
);
  const thunderPossible = slots.some(s=>[95,96,99].includes(Number(s.weatherCode))) || stormEngine().relevant;
  const heavyShower = maxRain >= 7.5;
  const intensity = rainIntensity(maxRain);
  let confidence = nowcastConfidence(slots, maxRain);

  // Combineer de lokale 15-minutenverwachting met de ECHTE RainViewer-radar.
  // Als Open-Meteo lokaal droog zegt maar een verse bui duidelijk upwind en
  // dichtbij ligt, mag Wheaterflow niet langer "minstens 2 u droog" tonen.
  const radarNear = state.radar?.proximity;
  const radarFresh = radarNear && Date.now()-(radarNear.checkedAt||0) < 10*60*1000;
  const radarApproaching = radarFresh && radarNear.upwind && radarNear.distanceKm <= 45 && radarNear.etaMinutes <= 70;
  const radarStart = radarApproaching ? new Date(Date.now()+radarNear.etaMinutes*60000) : null;

  output.status = rainingNow
  ? 'raining'
  : (firstWet || radarApproaching)
    ? 'rain_soon'
    : 'dry';

output.startTime = rainingNow
  ? new Date().toISOString()
  : firstWet
    ? firstWet.time.toISOString()
    : radarStart
      ? radarStart.toISOString()
      : null;

output.startsInMinutes = rainingNow
  ? 0
  : firstWet
    ? firstWet.minutes
    : radarApproaching
      ? radarNear.etaMinutes
      : null;

output.endTime =
  dryAfterWetIndex >= 0
    ? slots[dryAfterWetIndex].time.toISOString()
    : null;

output.endsInMinutes =
  dryAfterWetIndex >= 0
    ? slots[dryAfterWetIndex].minutes
    : null;
  output.intensity = intensity.id;
  output.intensityLabel = intensity.label;
  output.dryWindowMinutes = rainingNow ? 0 : (firstWet ? firstWet.minutes : (radarApproaching ? radarNear.etaMinutes : 120));
  output.confidence = radarApproaching && !firstWet ? Math.max(.62, confidence) : confidence;
  output.heavyShower = heavyShower;
  output.thunderPossible = thunderPossible;
  output.source = radarApproaching ? 'RainViewer radar + Open-Meteo minutely_15 + Wheaterflow intelligence' : 'Open-Meteo minutely_15 + Wheaterflow intelligence';
  output.slots = slots.map(s=>({time:s.time.toISOString(), minutes:s.minutes, precipitation:s.precipitation, wet:s.wet, weatherCode:s.weatherCode}));

  if(output.status === 'raining'){
    const endText = output.endTime ? `droger rond ${formatShortTime(output.endTime)}` : 'geen betrouwbaar droog venster';
    output.title = heavyShower ? 'Zware bui nu' : `${intensity.label} nu`;
    output.summary = `Het regent nu. Waarschijnlijk ${endText}.`;
  }else if(output.status === 'rain_soon'){
    const range = minuteRange(output.startsInMinutes, confidence);
    output.title = heavyShower ? `Zware bui rond ${formatShortTime(output.startTime)}` : `Regen rond ${formatShortTime(output.startTime)}`;
    output.summary = radarApproaching && !firstWet
      ? `Een bui nadert op de live radar. Aankomst naar schatting over ${range}.`
      : `${intensity.label}. Aankomst over ${range}, waarschijnlijk ${rainDurationText(output)}.`;
  }else{
    output.title = 'Droog';
    output.summary = `Minstens ${output.dryWindowMinutes} minuten geen regen verwacht.`;
  }
  if(thunderPossible) output.summary += ' Onweer mogelijk.';
  return output;
}


function computeRainEtaReliability(eta){
  const slots=Array.isArray(eta?.slots)?eta.slots:[];
  const radar=state.radar?.proximity;
  const now=Date.now();
  const radarAgeMin=radar?.frameTime ? Math.max(0,(now-radar.frameTime)/60000) : Infinity;
  const radarFresh=Boolean(radar && radarAgeMin<=RADAR_MAX_AGE_MINUTES);
  const radarFrames=Array.isArray(state.radar?.frames) ? state.radar.frames.length : 0;
  const enoughLocal=slots.length>=4;
  const concreteEta=eta?.status==='rain_soon' && Number.isFinite(Number(eta?.startsInMinutes));

  // Geen schijnprecisie wanneer we geen verse radar + voldoende korte-termijndata hebben.
  if(!radarFresh || !enoughLocal || !concreteEta){
    const qualitative = radarFresh && enoughLocal ? 'Redelijke betrouwbaarheid' : enoughLocal ? 'Lage betrouwbaarheid' : null;
    return {pct:null,label:qualitative};
  }

  let score=52;
  score += Math.min(12, slots.length*1.25);
  score += Math.max(0, 12-radarAgeMin*.8);
  score += Math.min(8, radarFrames*.8);
  if(radar.upwind) score += 7;
  if(Number.isFinite(radar.distanceKm)) score += radar.distanceKm<=15 ? 8 : radar.distanceKm<=35 ? 5 : radar.distanceKm<=55 ? 2 : -4;

  const modelWetSoon=slots.some(s=>s.wet && s.minutes<=70);
  const radarWetSoon=Boolean(radar.upwind && radar.distanceKm<=55 && radar.etaMinutes<=80);
  score += modelWetSoon===radarWetSoon ? 8 : -12;

  // Stabiliteit van de korte-termijnreeks: grote sprongen maken exacte aankomst minder zeker.
  const vals=slots.map(s=>Number(s.precipitation)).filter(Number.isFinite);
  if(vals.length>2){
    const movement=vals.slice(1).reduce((sum,v,i)=>sum+Math.abs(v-vals[i]),0)/(vals.length-1);
    score -= Math.min(10,movement*18);
  }

  // Vergelijk met de vorige ETA voor dezelfde locatie. Grote verschuiving => lagere betrouwbaarheid.
  const previous=state.rainEtaHistory;
  if(previous && previous.locKey===`${state.loc?.lat}:${state.loc?.lon}` && Number.isFinite(previous.startsInMinutes)){
    const diff=Math.abs(previous.startsInMinutes-Number(eta.startsInMinutes));
    score += diff<=5 ? 7 : diff<=12 ? 3 : diff>=25 ? -10 : -3;
  }
  const pct=Math.max(35,Math.min(96,Math.round(score)));
  const label=pct>=78?'Hoge betrouwbaarheid':pct>=58?'Redelijke betrouwbaarheid':'Lage betrouwbaarheid';
  return {pct,label};
}

function rainEtaReliabilityText(rain=nowcastEngine()){
  if(!rain || rain.status!=='rain_soon') return '';
  return Number.isFinite(rain.reliabilityPct) ? `Betrouwbaarheid: ${rain.reliabilityPct}%` : (rain.reliabilityLabel||'');
}

function nowcastEngine(){
  const radarStamp=Number(state.radar?.proximity?.checkedAt||0);
  const key=`${state.lastUpdated||0}:${radarStamp}:${state.loc?.lat}:${state.loc?.lon}`;
  if(state.rainEta?.cacheKey===key) return state.rainEta;
  const eta=calculateRainEtaRaw();
  eta.cacheKey=key;
  const reliability=computeRainEtaReliability(eta);
  eta.reliabilityPct=reliability.pct;
  eta.reliabilityLabel=reliability.label;
  if(eta.status==='rain_soon' && eta.startTime){
    const uncertainty=etaUncertaintyMinutes({...eta, confidence:Number.isFinite(eta.reliabilityPct)?eta.reliabilityPct/100:eta.confidence});
    const center=new Date(eta.startTime).getTime();
    eta.windowStart=new Date(center-uncertainty*60000).toISOString();
    eta.windowEnd=new Date(center+uncertainty*60000).toISOString();
  }else{
    eta.windowStart=eta.windowEnd=null;
  }
  state.rainEtaHistory={locKey:`${state.loc?.lat}:${state.loc?.lon}`,startsInMinutes:Number.isFinite(Number(eta.startsInMinutes))?Number(eta.startsInMinutes):null,at:Date.now()};
  state.rainEta=eta;
  return eta;
}
function centralRainEtaText(rain=nowcastEngine(), {short=false}={}){
  if(!rain || rain.status==='unavailable') return 'Geen regen verwacht binnen 2 uur';
  if(rain.status==='raining') return rain.endTime ? `Regen nu · droger rond ${formatShortTime(rain.endTime)}` : 'Regen nu';
  if(rain.status==='rain_soon'){
    const start=rain.windowStart ? formatShortTime(rain.windowStart) : formatShortTime(rain.startTime);
    const end=rain.windowEnd ? formatShortTime(rain.windowEnd) : start;
    return short && start===end ? `Regen rond ${start}` : `Regen verwacht tussen ${start} en ${end}`;
  }
  return 'Geen regen verwacht binnen 2 uur';
}
function centralRainEtaDetail(rain=nowcastEngine()){
  return [centralRainEtaText(rain), rainEtaReliabilityText(rain)].filter(Boolean).join(' · ');
}

function rainIntensity(mm){
  return rainIntensityToLevel(mm);
}

function rainIntensityToLevel(value){
  const mm = Math.max(0, Number(value) || 0);
  if(mm >= 7.5) return {id:'heavy', label:'Zware regen'};
  if(mm >= 2) return {id:'moderate', label:'Regen'};
  if(mm >= .1) return {id:'light', label:'Lichte regen'};
  return {id:'none', label:'Droog'};
}

function rainIntensityToHeight(value){
  const mm = Math.max(0, Number(value) || 0);
  if(mm <= 0) return 6;
  if(mm < .1) return 8;
  if(mm < 1) return Math.round(14 + ((mm - .1) / .9) * 10);
  if(mm < 3) return Math.round(28 + ((mm - 1) / 2) * 16);
  const capped = Math.min(mm, 6);
  return Math.round(48 + ((capped - 3) / 3) * 18);
}

function forecastWindowStats(hours=3){
  const h = state.hourly || {};
  const idx = nowIndexInHourly();
  const end = Math.min(idx + Math.max(1, hours), h.time?.length || 0);
  const indexes = [];
  for(let i=idx; i<end; i++) indexes.push(i);
  const vals = key => indexes.map(i=>Number(h[key]?.[i])).filter(v=>Number.isFinite(v));
  const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0) / arr.length : null;
  const max = arr => arr.length ? Math.max(...arr) : null;
  return {
    indexes,
    avgCloud:avg(vals('cloud_cover')),
    maxCloud:max(vals('cloud_cover')),
    maxPop:max(vals('precipitation_probability')),
    maxPrecip:max(vals('precipitation')),
    minVisibility:vals('visibility').length ? Math.min(...vals('visibility')) : null,
    maxHumidity:max(vals('relative_humidity_2m')),
    maxGust:max(vals('wind_gusts_10m')),
    thunder:indexes.some(i=>[95,96,99].includes(Number(h.weather_code?.[i])))
  };
}

function nowcastConfidence(slots, maxRain){
  // Dynamische confidence-score. Dit is geen officiële KMI-kans, maar een
  // transparante kwaliteitsscore op basis van actuele data + live radar.
  const now = Date.now();
  const coverage = Math.min(1, slots.length / 8);
  const variability = slots.reduce((sum,s,i)=>i ? sum + Math.abs(s.precipitation - slots[i-1].precipitation) : 0, 0);
  const variabilityPenalty = Math.min(.18, variability / 14);

  // Zwakke motregen is moeilijker exact te timen dan een duidelijk signaal.
  const weakSignalPenalty = maxRain > 0 && maxRain < .20 ? .10 : 0;
  const strongSignalBonus = maxRain >= 1 ? .05 : maxRain >= .3 ? .025 : 0;

  // Hoe vers is de lokale 15-minutendata?
  const firstTime = slots[0]?.time instanceof Date ? slots[0].time.getTime() : Date.parse(slots[0]?.time || '');
  const localAgeMin = Number.isFinite(firstTime) ? Math.abs(now-firstTime)/60000 : 60;
  const freshness = localAgeMin <= 8 ? 1 : localAgeMin <= 18 ? .85 : localAgeMin <= 30 ? .65 : .4;

  // Live RainViewer-radar maakt de score echt situationeel.
  const radar = state.radar?.proximity;
  const radarAgeMin = radar?.frameTime ? Math.max(0,(now-radar.frameTime)/60000) : 99;
  const radarFresh = radar && radarAgeMin <= RADAR_MAX_AGE_MINUTES;
  let radarAdjustment = 0;
  if(radarFresh){
    if(radar.upwind && radar.distanceKm <= 20) radarAdjustment += .08;
    else if(radar.upwind && radar.distanceKm <= 45) radarAdjustment += .05;
    else if(radar.distanceKm <= 25 && !radar.upwind) radarAdjustment -= .04;
    if(radarAgeMin > 12) radarAdjustment -= .04;
  }else{
    radarAdjustment -= .07;
  }

  // Als model en radar elkaar tegenspreken, verlaag de zekerheid duidelijk.
  const forecastWetSoon = slots.some(s=>s.wet && s.minutes <= 60);
  const radarWetSoon = !!(radarFresh && radar.upwind && radar.distanceKm <= 45 && radar.etaMinutes <= 70);
  const agreementAdjustment = forecastWetSoon === radarWetSoon ? .045 : -.11;

  const raw = .50
    + coverage * .20
    + freshness * .10
    + strongSignalBonus
    - variabilityPenalty
    - weakSignalPenalty
    + radarAdjustment
    + agreementAdjustment;

  // Vermijd schijnprecisie aan de uitersten; echte waarde mag wel duidelijk variëren.
  return Math.max(.42, Math.min(.95, raw));
}

function minuteRange(minutes, confidence){
  if(minutes == null) return 'onbekend';
  if(confidence >= .78) return `${Math.max(1, Math.round(minutes))} min`;
  const low = Math.max(0, Math.round(minutes - 10));
  const high = Math.round(minutes + 10);
  return `${low}-${high} min`;
}

function etaUncertaintyMinutes(rain){
  const confidence = Number(rain?.confidence || 0);
  if(confidence >= .82) return 8;
  if(confidence >= .68) return 12;
  if(confidence >= .52) return 18;
  return 25;
}

function rainDurationText(rain){
  if(!rain?.startTime || !rain?.endTime) return 'duur nog onzeker';
  const start = new Date(rain.startTime).getTime();
  const end = new Date(rain.endTime).getTime();
  if(!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 'duur nog onzeker';
  const mins = Math.round((end - start) / 60000);
  if(mins < 20) return 'ongeveer 15 minuten';
  return `${Math.max(15, mins - 8)}-${mins + 8} min`;
}

function formatShortTime(value){
  if(!value) return '--:--';
  const date = new Date(value);
  if(Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('nl-BE', {hour:'2-digit', minute:'2-digit', timeZone:state.tz || undefined});
}

async function loadLightning(force=false){
  const lat = Number(state.loc?.lat);
  const lon = Number(state.loc?.lon);
  if(!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if(state.lightning.loading) return state.lightning;
  const lastUpdate = state.lightning.updated ? new Date(state.lightning.updated).getTime() : 0;
  // Client-side guard: don't wake the server again when the same screen rerenders repeatedly.
  if(!force && lastUpdate && Date.now() - lastUpdate < 90 * 1000) return state.lightning;
  state.lightning.loading = true;
  try{
    const r = await fetch(`/api/lightning?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&radius=100`, {cache:'default'});
    const data = await r.json().catch(()=>({}));
    if(!r.ok || data.ok === false) throw new Error(data.error || `Lightning API ${r.status}`);
    state.lightning = {
      available:Boolean(data.available),
      loading:false,
      updated:data.updated || new Date().toISOString(),
      strikes:Array.isArray(data.strikes) ? data.strikes : [],
      nearest:data.nearest || null,
      summary:data.summary || null,
      threat:data.threat || null,
      source:data.source || 'Live lightning',
      provider:data.provider || null,
      fallback:Boolean(data.fallback),
      error:null
    };
    return state.lightning;
  }catch(error){
    state.lightning = {...state.lightning, available:false, loading:false, error:String(error?.message || error)};
    console.warn('Live bliksemdata laden faalde:', error);
    return state.lightning;
  }
}

function stormDirectionText(threat){
  const move = threat?.movement;
  if(!move) return null;
  if(move.dir && move.dirTo) return `${move.dir} → ${move.dirTo}`;
  return move.dirTo || move.dir || null;
}

function stormIntensityFromLightning(lightning, maxCape, maxGust){
  const count = Number(lightning?.summary?.count || 0);
  const severe = Boolean(lightning?.threat?.severe);
  if(severe || count >= 40 || maxCape >= 1800 || maxGust >= 90) return 'Zwaar';
  if(count >= 12 || maxCape >= 1000 || maxGust >= 70) return 'Matig';
  if(count > 0 || maxCape >= 500) return 'Licht';
  return 'Laag';
}

function stormEngine(){
  const h = state.hourly || {};
  const nowIdx = nowIndexInHourly();
  const indexes = [];
  for(let i=nowIdx; i<Math.min(nowIdx+6, h.time?.length || 0); i++) indexes.push(i);
  const thunderIdx = indexes.find(i=>[95,96,99].includes(Number(h.weather_code?.[i])));
  const maxCape = Math.max(0, ...indexes.map(i=>Number(h.cape?.[i]) || 0));
  const minLi = Math.min(99, ...indexes.map(i=>Number(h.lifted_index?.[i]) || 99));
  const maxGust = Math.max(0, ...indexes.map(i=>Number(h.wind_gusts_10m?.[i]) || 0));
  const lightning = state.lightning || {};
  const nearest = lightning.nearest;
  const strikeCount = Number(lightning.summary?.count || 0);
  const threat = lightning.threat || null;
  const lightningRelevant = lightning.available && (nearest?.distanceKm <= 100 || strikeCount > 0 || threat);
  const modelRelevant = thunderIdx != null || (maxCape >= 800 && minLi <= 0) || maxGust >= 70;
  const alertRelevant = (state.alerts || []).some(a=>/onweer|storm|bliksem/i.test(`${a.headline || ''} ${a.description || ''}`));
  const relevant = Boolean(lightningRelevant || modelRelevant || alertRelevant);

  let etaMinutes = null;
  if(threat?.etaMinutes != null) etaMinutes = Math.max(0, Math.round(Number(threat.etaMinutes)));
  else if(thunderIdx != null) etaMinutes = Math.max(0, Math.round((new Date(h.time[thunderIdx]).getTime() - Date.now()) / 60000));

  let status = 'Rustig';
  if(nearest?.distanceKm <= 15 || threat?.affectsNow) status = 'Actief';
  else if(nearest?.distanceKm <= 50 || threat || modelRelevant) status = 'Waakzaam';

  const movement = stormDirectionText(threat);
  const movementSpeedKph = Number(threat?.movement?.speedKph);
  const lightningDistanceKm = Number(nearest?.distanceKm);
  const lightningAgeSec = Number(nearest?.ageSec);
  const intensity = stormIntensityFromLightning(lightning, maxCape, maxGust);
  const count5m = strikeCount;

  let summaryText;
  if(lightning.available && Number.isFinite(lightningDistanceKm)){
    const age = Number.isFinite(lightningAgeSec) ? ` (${Math.max(0, Math.round(lightningAgeSec/60))} min geleden)` : '';
    summaryText = `Dichtstbijzijnde bliksem op ${lightningDistanceKm.toFixed(lightningDistanceKm < 10 ? 1 : 0)} km${age}.`;
    if(count5m > 0) summaryText += ` ${count5m} ontlading${count5m===1?'':'en'} gemeten in de laatste 5 minuten binnen 100 km.`;
    if(threat && movement) summaryText += ` De onweerszone beweegt ${movement}${Number.isFinite(movementSpeedKph) ? ` met ongeveer ${Math.round(movementSpeedKph)} km/u` : ''}.`;
  }else if(modelRelevant){
    summaryText = 'Het weermodel ziet onweerspotentieel, maar er is momenteel geen bevestigde live bliksem in de beschikbare meting.';
  }else{
    summaryText = 'Geen recente bliksem in de buurt gedetecteerd.';
  }

  return {
    relevant,
    status,
    lightningAvailable:Boolean(lightning.available),
    lightningDistanceKm:Number.isFinite(lightningDistanceKm) ? lightningDistanceKm : null,
    lightningAgeSec:Number.isFinite(lightningAgeSec) ? lightningAgeSec : null,
    lightningCount5m:count5m,
    movement,
    movementSpeedKph:Number.isFinite(movementSpeedKph) ? movementSpeedKph : null,
    movementReliability:threat?.movement?.reliability || null,
    etaMinutes,
    intensity,
    severe:Boolean(threat?.severe),
    source:lightning.source || null,
    summary:summaryText,
    limitation:lightning.available ? null : 'Live bliksemdata tijdelijk niet beschikbaar; radar en model blijven actief.'
  };
}

function seaEngine(){
  if(!state.marine){
    return {
      available:false,
      reason:isCoastalLocation() ? 'Marine data tijdelijk niet beschikbaar.' : 'Deze locatie ligt niet dicht genoeg bij de kust.',
      source:'Open-Meteo Marine + Wheaterflow intelligence'
    };
  }
  const cur = liveWeatherSnapshot();
  const m = state.marine;
  const rain = nowcastEngine();
  const wave = Number(m.waveHeight);
  const period = Number(m.wavePeriod);
  const seaTemp = Number(m.seaSurfaceTemperature);
  const wind = Number(cur.wind_speed_10m);
  const gust = Number(cur.wind_gusts_10m);
  const uv = Number(state.daily?.uv_index_max?.[0]) || 0;
  const visibility = Number(state.hourly?.visibility?.[nowIndexInHourly()]) || null;
  const alertPenalty = (state.alerts || []).some(a=>a.level && a.level !== 'green') ? 10 : 0;

  const swimParts = [];
  let swimScore = 100;
  if(Number.isFinite(seaTemp)){
    if(seaTemp < 16){ swimScore -= 24; swimParts.push('koud zeewater'); }
    else if(seaTemp < 18){ swimScore -= 12; swimParts.push('fris zeewater'); }
    else swimParts.push('aangename zeetemperatuur');
  }else swimScore -= 8;
  if(Number.isFinite(wave)){
    if(wave > 1.2){ swimScore -= 30; swimParts.push('hoge golven'); }
    else if(wave > .8){ swimScore -= 16; swimParts.push('matige golven'); }
    else swimParts.push('rustige golven');
  }else swimScore -= 8;
  if(Number.isFinite(wind)){
    if(wind > 35){ swimScore -= 22; swimParts.push('veel wind'); }
    else if(wind > 24){ swimScore -= 10; swimParts.push('merkbare wind'); }
  }
  if(rain.status === 'raining') { swimScore -= 14; swimParts.push('regen nu'); }
  if(uv >= 7){ swimScore -= 5; swimParts.push('hoge UV'); }
  swimScore -= alertPenalty;
  swimScore = clamp(Math.round(swimScore));

  let beachScore = 100;
  const beachParts = [];
  if(Number.isFinite(wind)){
    if(wind > 40){ beachScore -= 24; beachParts.push('te veel wind'); }
    else if(wind > 28){ beachScore -= 12; beachParts.push('wind aan zee'); }
    else beachParts.push('wind ok');
  }
  if(Number.isFinite(wave) && wave > 1.1){ beachScore -= 12; beachParts.push('ruwere zee'); }
  if(rain.status === 'raining'){ beachScore -= 24; beachParts.push('regen'); }
  else if(rain.status === 'rain_soon'){ beachScore -= 12; beachParts.push('regen later'); }
  if(Number(cur.temperature_2m) < 18){ beachScore -= 10; beachParts.push('fris'); }
  if(uv >= 8){ beachScore -= 6; beachParts.push('zeer hoge UV'); }
  if(visibility && visibility < 4000){ beachScore -= 8; beachParts.push('matig zicht'); }
  beachScore -= alertPenalty;
  beachScore = clamp(Math.round(beachScore));

  return {
    available:true,
    place:m.place,
    seaTemperature:Number.isFinite(seaTemp) ? seaTemp : null,
    waveHeight:Number.isFinite(wave) ? wave : null,
    wavePeriod:Number.isFinite(period) ? period : null,
    waveDirection:m.waveDirection ?? null,
    wind:Number.isFinite(wind) ? wind : null,
    gust:Number.isFinite(gust) ? gust : null,
    uv,
    feelsLike:cur.apparent_temperature ?? null,
    visibility,
    rainStatus:rain.status,
    tide:m.tide,
    seaspark:state.seaspark,
    swimScore,
    swimComfort:scoreLabel(swimScore),
    swimFactors:swimParts,
    beachScore,
    beachLabel:scoreLabel(beachScore),
    beachFactors:beachParts,
    source:'Open-Meteo Marine + Open-Meteo forecast + Wheaterflow intelligence'
  };
}

function scoreLabel(score){
  return score >= 82 ? 'Uitstekend' : score >= 68 ? 'Goed' : score >= 48 ? 'Matig' : score >= 28 ? 'Slecht' : 'Afgeraden';
}

function skyEngine(){
  const cur = liveWeatherSnapshot();
  const nowIdx = nowIndexInHourly();
  const h = state.hourly || {};
  const moon = moonPhase(new Date());
  const cloud = Number(cur.cloud_cover ?? h.cloud_cover?.[nowIdx] ?? 60);
  const window = forecastWindowStats(6);
  const visibility = Number(h.visibility?.[nowIdx]) || null;
  const humidity = Number(cur.relative_humidity_2m ?? h.relative_humidity_2m?.[nowIdx]) || null;
  const rain = nowcastEngine();
  let stargazing = 100;
  const factors = [];
  if(cloud > 80){ stargazing -= 55; factors.push('veel bewolking'); }
  else if(cloud > 50){ stargazing -= 30; factors.push('gedeeltelijk bewolkt'); }
  else factors.push('weinig bewolking');
  if(visibility && visibility < 5000){ stargazing -= 18; factors.push('beperkt zicht'); }
  if(humidity && humidity > 90){ stargazing -= 14; factors.push('vochtig/mistgevoelig'); }
  if(moon.illumination > .75){ stargazing -= 14; factors.push('veel maanlicht'); }
  if(rain.status === 'raining'){ stargazing -= 20; factors.push('regen'); }
  else if(rain.status === 'rain_soon'){ stargazing -= 14; factors.push('regen later'); }
  if((window.maxCloud ?? 0) > Math.max(cloud, 75)){ stargazing -= 10; factors.push('toenemende bewolking'); }
  if((window.maxPrecip ?? 0) >= .4 || (window.maxPop ?? 0) >= 70){ stargazing -= 12; factors.push('neerslagkans komende uren'); }
  if(window.thunder){ stargazing -= 16; factors.push('onweerskans'); }
  stargazing = clamp(Math.round(stargazing));
  return {
    stargazing,
    stargazingLabel:scoreLabel(stargazing),
    cloud,
    visibility,
    humidity,
    moon,
    auroraChance:'Nog geen data',
    milkyWayChance:isNightNow() && stargazing >= 70 && moon.illumination < .45 ? 'Goed' : 'Beperkt',
    factors,
    source:'Open-Meteo forecast + SunCalc + Wheaterflow intelligence'
  };
}

function photoWeatherEngine(){
  const h = state.hourly || {};
  const nowIdx = nowIndexInHourly();
  const window = forecastWindowStats(6);
  const sr = state.daily?.sunrise?.[0], ss = state.daily?.sunset?.[0];
  const goldenMorning = `${formatDayTime(sr)}-${addMinutesText(sr,45)}`;
  const goldenEvening = `${addMinutesText(ss,-47)}-${formatDayTime(ss)}`;
  const candidates = [];
  for(let i=nowIdx; i<Math.min(nowIdx+24, h.time?.length || 0); i++){
    const t = new Date(h.time[i]);
    const cloud = Number(h.cloud_cover?.[i] ?? 60);
    const visibility = Number(h.visibility?.[i] || 0);
    const humidity = Number(h.relative_humidity_2m?.[i] ?? 70);
    const pop = Number(h.precipitation_probability?.[i] ?? 0);
    const hour = t.getHours();
    const goldenBoost = (hour >= 5 && hour <= 8) || (hour >= 19 && hour <= 22) ? 26 : 0;
    const cloudScore = cloud >= 25 && cloud <= 70 ? 28 : cloud < 25 ? 16 : 8;
    const visibilityScore = visibility >= 8000 ? 18 : visibility >= 4000 ? 10 : 2;
    const dryScore = pop <= 25 ? 16 : pop <= 55 ? 8 : 0;
    const mistBonus = humidity >= 88 && hour <= 9 ? 12 : 0;
    const rainPenalty = Number(h.precipitation?.[i] || 0) >= .2 ? 14 : 0;
    const windPenalty = Number(h.wind_gusts_10m?.[i] || 0) >= 55 ? 8 : 0;
    const score = clamp(Math.round(goldenBoost + cloudScore + visibilityScore + dryScore + mistBonus + 20 - rainPenalty - windPenalty));
    candidates.push({time:t, score, cloud, visibility, humidity, pop});
  }
  const best = candidates.sort((a,b)=>b.score-a.score)[0] || null;
  const sunsetScore = photoMomentScore(ss, h);
  const sunriseScore = photoMomentScore(sr, h);
  return {
    best,
    goldenMorning,
    goldenEvening,
    sunriseScore,
    sunsetScore,
    mistChance:mistChanceNextMorning(),
    highCloud:window.maxCloud == null ? 'Nog geen data' : window.maxCloud >= 70 ? 'Veel bewolking' : window.maxCloud >= 35 ? 'Gedeeltelijk' : 'Weinig',
    source:'Open-Meteo forecast + Wheaterflow intelligence'
  };
}

function photoMomentScore(timeValue, hourly=state.hourly || {}){
  if(!timeValue || !hourly.time?.length) return 0;
  const idx = closestIndex(hourly.time, new Date(timeValue).getTime());
  const cloud = Number(hourly.cloud_cover?.[idx] ?? 60);
  const pop = Number(hourly.precipitation_probability?.[idx] ?? 0);
  const visibility = Number(hourly.visibility?.[idx] || 0);
  return clamp(Math.round(42 + (cloud >= 25 && cloud <= 75 ? 28 : 10) + (pop <= 30 ? 18 : 4) + (visibility >= 7000 ? 12 : 4)));
}

function mistChanceNextMorning(){
  const h = state.hourly || {};
  const nowIdx = nowIndexInHourly();
  let chance = 0;
  for(let i=nowIdx; i<Math.min(nowIdx+24, h.time?.length || 0); i++){
    const t = new Date(h.time[i]);
    if(t.getHours() <= 9){
      const humidity = Number(h.relative_humidity_2m?.[i] ?? 0);
      const visibility = Number(h.visibility?.[i] ?? 99999);
      if(humidity >= 92 || visibility < 5000) chance = Math.max(chance, humidity >= 96 || visibility < 2500 ? 72 : 48);
    }
  }
  return chance;
}

function nowcastText(){
  const rain = nowcastEngine();
  return rain.status === 'unavailable' ? null : rain.summary;
}

function rainNowcastCard(){
  const rain = nowcastEngine();
  const slots = Array.isArray(rain?.slots)
    ? rain.slots.filter(slot=>slot && Number.isFinite(Number(slot.precipitation)) && Number(slot.minutes) <= 120)
    : [];

  const updateLabel = (()=>{
    if(!state.lastUpdated) return 'Zojuist bijgewerkt';
    const sec = Math.max(0, Math.round((Date.now()-state.lastUpdated)/1000));
    if(sec < 60) return 'Zojuist bijgewerkt';
    if(sec < 120) return '1 min geleden';
    if(sec < 3600) return `${Math.round(sec/60)} min geleden`;
    return `Om ${new Date(state.lastUpdated).toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit'})}`;
  })();

  const currentSignal = precipitationSignal(liveWeatherSnapshot());
  const slotNowMm = slots.length ? Math.max(0, Number(slots[0].precipitation)||0) * 4 : 0;
  const rainingNow = rain?.status === 'raining';
  const currentMm = rainingNow ? Math.max(0, Number(currentSignal?.now)||0, slotNowMm) : 0;

  const intensity = (()=>{
    if(!rainingNow || currentMm < 0.05) return {id:'none', label:'Geen regen'};
    if(currentMm < 0.30) return {id:'very-light', label:'Zeer lichte regen'};
    if(currentMm < 2.0) return {id:'light', label:'Lichte regen'};
    if(currentMm < 7.5) return {id:'moderate', label:'Matige regen'};
    return {id:'heavy', label:'Zware regen'};
  })();

  const change = (()=>{
    if(rainingNow){
      if(Number.isFinite(Number(rain?.endsInMinutes)) && rain?.endTime){
        return {
          label:'DROGER ROND',
          main:`~${Math.max(0,Math.round(Number(rain.endsInMinutes)))} min`,
          sub:`Rond ${formatShortTime(rain.endTime)}`
        };
      }
      return {label:'REGEN HOUDT AAN', main:'Langer dan 2 uur', sub:''};
    }
    if(rain?.status === 'rain_soon' && Number.isFinite(Number(rain?.startsInMinutes)) && rain?.startTime){
      return {
        label:'REGEN ROND',
        main:`~${Math.max(0,Math.round(Number(rain.startsInMinutes)))} min`,
        sub:`Rond ${formatShortTime(rain.startTime)}`
      };
    }
    return {label:'GEEN REGEN VERWACHT', main:'Komende 2 uur', sub:''};
  })();

  // Gebruik uitsluitend de fijnste bestaande nowcast-resolutie. Lege slots blijven
  // ruimtelijk bestaan zodat de tijdas klopt, maar krijgen bewust géén regenbalk.
  const barSlots = slots.map((slot,i)=>{
    const hourlyMm = Math.max(0,(Number(slot.precipitation)||0)*4);
    const level = rainIntensityToLevel(hourlyMm);
    const current = Number(slot.minutes) === 0 || i === 0;
    const barHeight = hourlyMm > 0
      ? Math.min(96, Math.max(6, Math.round(rainIntensityToHeight(hourlyMm)*1.32)))
      : 0;
    const bar = hourlyMm > 0
      ? `<i class="${current?'now':''} ${level.id}" title="${Math.round(Number(slot.minutes)||0)} min: ${hourlyMm.toFixed(1)} mm/u · ${level.label}" style="height:${barHeight}px"></i>`
      : '';
    return `<span class="rain-slot ${hourlyMm>0?'has-rain':'is-dry'}">${bar}</span>`;
  }).join('');

  const hourly = state.hourly || {};
  const nowIdx = nowIndexInHourly();
  const hourIndexes = [];
  if(Array.isArray(hourly.time)){
    const nowMs = Date.now();
    for(let i=Math.max(0,nowIdx); i<hourly.time.length; i++){
      const t = new Date(hourly.time[i]).getTime();
      if(!Number.isFinite(t)) continue;
      if(t < nowMs-35*60*1000) continue;
      if(t > nowMs+120*60*1000) break;
      hourIndexes.push(i);
    }
  }
  const popValues = hourIndexes.map(i=>Number(hourly.precipitation_probability?.[i])).filter(Number.isFinite);
  const precipChance = popValues.length ? Math.max(...popValues.map(v=>Math.max(0,Math.min(100,v)))) : null;

  let precipAmount = slots.length
    ? slots.reduce((sum,slot)=>sum+Math.max(0,Number(slot.precipitation)||0),0)
    : null;
  if(precipAmount == null && hourIndexes.length){
    const values = hourIndexes.map(i=>Number(hourly.precipitation?.[i])).filter(Number.isFinite);
    precipAmount = values.length ? values.reduce((a,b)=>a+Math.max(0,b),0) : null;
  }

  const statusIcon = rainingNow ? icon('rain',true,29,'rain-status-icon') : icon('sun',true,28,'rain-status-icon');
  const statusText = rainingNow ? 'Het regent nu' : 'Droog';
  const intensityIcon = rainingNow ? icon('rain',true,27,'rain-metric-icon') : icon('drop',true,27,'rain-metric-icon');

  if(!rain || rain.status === 'unavailable'){
    return `<div class="card rain-now-card rain-reference-layout unavailable">
      <div class="rain-now-top"><span class="rain-brand">${icon('rain',true,19)}<strong>WHEATERFLOW RAIN</strong></span><span class="rain-updated">${icon('gauge',true,15)}${esc(updateLabel)}</span></div>
      <div class="rain-status-line">${icon('drop',true,28,'rain-status-icon')}<h3>Regengegevens niet beschikbaar</h3></div>
    </div>`;
  }

  return `<div class="card rain-now-card rain-reference-layout ${rain.status} ${rain.heavyShower?'heavy':''}">
    <div class="rain-now-top">
      <span class="rain-brand">${icon('rain',true,19)}<strong>WHEATERFLOW RAIN</strong></span>
      <span class="rain-updated">${icon('gauge',true,15)}${esc(updateLabel)}</span>
    </div>

    <div class="rain-status-line">${statusIcon}<h3>${esc(statusText)}</h3></div>

    <div class="rain-main-grid">
      <div class="rain-main-card intensity-card">
        <div class="rain-main-card-icon">${intensityIcon}</div>
        <div class="rain-main-card-copy">
          <small>INTENSITEIT</small>
          <strong>${esc(intensity.label)}</strong>
          <span>${currentMm.toFixed(1)} mm/u</span>
        </div>
      </div>
      <div class="rain-main-card change-card">
        <div class="rain-main-card-icon">${icon('gauge',true,26,'rain-metric-icon')}</div>
        <div class="rain-main-card-copy">
          <small>${esc(change.label)}</small>
          <strong>${esc(change.main)}</strong>
          ${change.sub?`<span>${esc(change.sub)}</span>`:''}
        </div>
      </div>
    </div>

    <div class="rain-forecast-card">
      <div class="rain-forecast-title">VERWACHTE REGENINTENSITEIT</div>
      ${slots.length ? `<div class="rain-now-plot"><div class="rain-now-scale" aria-hidden="true"><span>ZWAAR</span><span>MATIG</span><span>LICHT</span><span>ZEER LICHT</span></div><div class="rain-now-chart" style="--rain-slot-count:${Math.max(1,slots.length)}">${barSlots}</div></div><div class="rain-now-axis"><span>Nu</span><span>30 min</span><span>60 min</span><span>90 min</span><span>2 uur</span></div>` : `<div class="rain-chart-empty">Geen korte-termijnframes beschikbaar</div>`}
    </div>

    <div class="rain-bottom-stats">
      ${precipChance!=null ? `<div class="rain-bottom-stat"><small>KANS OP NEERSLAG</small><strong>${Math.round(precipChance)}%</strong></div>` : ''}
      ${precipAmount!=null ? `<div class="rain-bottom-stat"><small>NEERSLAG HOEVEELHEID</small><strong>${esc(precipAmount>0 && precipAmount<0.1 && state.units.precip==='mm' ? '<0.1 mm' : fmtPrecip(precipAmount))}</strong></div>` : ''}
    </div>
  </div>`;
}

function weatherHeroLine(cur, rain){
  const wx = normalizedWeatherState();
  const parts = [];
  if(wx.feelsLike != null) parts.push(`Voelt als ${fmtTemp(wx.feelsLike)}`);
  const central = rain || wx.rainEta;
  if(central?.status === 'raining' || central?.status === 'rain_soon'){
    const eta = centralRainEtaText(central, {short:true});
    if(eta) parts.push(eta);
  }
  return parts.join(' · ');
}

function tvLaterRainTrend(){
  const hourly = state.hourly;
  if(!hourly?.time?.length) return null;
  const nowIdx = nowIndexInHourly();
  const start = Math.min(nowIdx + 2, hourly.time.length - 1);
  const end = Math.min(nowIdx + 12, hourly.time.length);
  let best = {pop:0, rain:0, index:-1};
  for(let i=start;i<end;i++){
    const pop = Number(hourly.precipitation_probability?.[i]) || 0;
    const rain = Number(hourly.precipitation?.[i]) || 0;
    if(pop > best.pop || rain > best.rain) best = {pop, rain, index:i};
  }
  if(best.index < 0 || (best.pop < 55 && best.rain < 0.2)) return null;
  const time = formatShortTime(hourly.time[best.index]);
  const strong = best.pop >= 75 || best.rain >= 0.6;
  return {
    short: strong ? `regen later rond ${time}` : `regen later mogelijk`,
    detail: strong
      ? `Droog binnen de Rain ETA-horizon, maar later neemt de regenkans sterk toe rond ${time}.`
      : `Droog binnen de Rain ETA-horizon, maar later blijft regen mogelijk.`
  };
}

function modelRainSignalWithin(hours=2){
  const h=state.hourly||{};
  const idx=nowIndexInHourly();
  const until=Date.now()+hours*3600000;
  let maxPop=null,maxRain=null;
  for(let i=idx;i<(h.time?.length||0);i++){
    const t=new Date(h.time[i]).getTime(); if(!Number.isFinite(t)||t>until) break;
    const pop=validNumber(h.precipitation_probability?.[i]);
    const mm=validNumber(h.precipitation?.[i]);
    if(pop!=null) maxPop=maxPop==null?pop:Math.max(maxPop,pop);
    if(mm!=null) maxRain=maxRain==null?mm:Math.max(maxRain,mm);
  }
  return {maxPop,maxRain,elevated:(maxPop!=null&&maxPop>=45)||(maxRain!=null&&maxRain>=0.2)};
}

function radarEtaText(rain=nowcastEngine()){
  const place=locationDisplayName('je locatie');
  if(!rain || rain.status==='dry' || rain.status==='unavailable') return `Geen regen verwacht binnen 2 uur · ${place}`;
  const reliability=rain.status==='rain_soon' ? rainEtaReliabilityText(rain) : '';
  return [centralRainEtaText(rain),reliability,place].filter(Boolean).join(' · ');
}

function weatherTrendSummary(){
  const wx = normalizedWeatherState();
  const rain = wx.rainEta;
  const h = state.hourly || {};
  const idx = nowIndexInHourly();
  const sentences = [];

  if(rain?.status === 'raining'){
    if(rain.endsInMinutes != null && rain.endTime) sentences.push(`De regen houdt waarschijnlijk nog ongeveer ${Math.max(1,Math.round(rain.endsInMinutes))} minuten aan; daarna wordt het tijdelijk droger.`);
    else sentences.push('De regen houdt voorlopig aan; binnen de beschikbare nowcast is nog geen betrouwbaar droog moment zichtbaar.');
  }else if(rain?.status === 'rain_soon'){
    const when = rain.startTime ? formatShortTime(rain.startTime) : null;
    sentences.push(when ? `Vanaf ongeveer ${when} neemt de kans op regen duidelijk toe.` : 'Binnenkort neemt de kans op regen duidelijk toe.');
  }else{
    const model = modelRainSignalWithin(2);
    sentences.push(model.elevated ? 'Het is nu droog, maar later in de komende twee uur neemt de kans op regen toe.' : 'Het blijft volgens de actuele radar de komende twee uur waarschijnlijk droog.');
  }

  const futureTemps=[];
  for(let i=idx;i<Math.min(idx+6,h.time?.length||0);i++){
    const v=validNumber(h.temperature_2m?.[i]); if(v!=null) futureTemps.push(v);
  }
  if(wx.temperature!=null && futureTemps.length){
    const end=futureTemps[futureTemps.length-1];
    const delta=end-wx.temperature;
    if(delta <= -2) sentences.push(`De temperatuur zakt de komende uren richting ${fmtTemp(end)}.`);
    else if(delta >= 2) sentences.push(`De temperatuur loopt de komende uren op richting ${fmtTemp(end)}.`);
  }
  if(wx.windGust!=null && wx.windGust>=60) sentences.push(`Houd rekening met windstoten tot ongeveer ${fmtWind(wx.windGust)}.`);
  return sentences.slice(0,3).join(' ');
}

async function loadWheaterflowAdminAlerts(){
  try{
    const params = new URLSearchParams();

    const city =
      state.loc?.name ||
      state.loc?.city ||
      '';

    const admin =
      state.loc?.admin ||
      '';

    const country =
      state.loc?.country ||
      state.loc?.countryName ||
      '';

    if(country){
      params.set('land', country);
    }

    if(admin){
      params.set('provincie', admin);
    }

    if(city){
      params.set('stad', city);
    }

    const response = await fetch(
      `/api/alerts?${params.toString()}`,
      {
        cache:'no-store'
      }
    );

    if(!response.ok){
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    wheaterflowAdminAlerts =
      Array.isArray(data)
        ? data
        : [];

  }catch(error){
    console.warn(
      'Wheaterflow meldingen konden niet worden geladen:',
      error
    );

    wheaterflowAdminAlerts = [];
  }
}


function wheaterflowAdminAlertsCard(){
  if(!wheaterflowAdminAlerts.length){
    return '';
  }

  const icons = {
    info:'info',
    warning:'warning',
    danger:'warning'
  };

  return wheaterflowAdminAlerts.map(alert => {
    const type =
      ['info','warning','danger'].includes(alert.type)
        ? alert.type
        : 'info';

    const scopeText =
      alert.scope === 'all'
        ? 'Heel Wheaterflow'
        : alert.scopeValue || '';

    return `
      <div class="card wf-admin-alert wf-admin-alert-${type}">
        <div class="wf-admin-alert-head">
          <div class="wf-admin-alert-icon">
            ${icon(icons[type],true,20)}
          </div>

          <div class="wf-admin-alert-content">
            <div class="wf-admin-alert-label">
              ${
                type === 'danger'
                  ? 'ERNSTIGE WAARSCHUWING'
                  : type === 'warning'
                    ? 'WAARSCHUWING'
                    : 'WHEATERFLOW MELDING'
              }
            </div>

            <div class="wf-admin-alert-title">
              ${esc(alert.title || '')}
            </div>

            <div class="wf-admin-alert-message">
              ${esc(alert.message || '')}
            </div>

            ${
              scopeText
                ? `<div class="wf-admin-alert-scope">
                    ${esc(scopeText)}
                   </div>`
                : ''
            }
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function weatherSummaryCard(){
  return `<div class="card weather-summary-card">
    <div class="card-title">${icon('gauge',true,13)} Wheaterflow Intelligence</div>
    <p>${esc(weatherTrendSummary())}</p>
  </div>`;
}

function stormModeCard(){
  const storm = stormEngine();
  if(!storm.relevant) return '';
  const eta = storm.etaMinutes != null ? `${storm.etaMinutes} min` : '—';
  const dist = storm.lightningDistanceKm != null ? `${storm.lightningDistanceKm.toFixed(storm.lightningDistanceKm < 10 ? 1 : 0)} km` : 'Geen recente bliksem';
  const move = storm.movement ? `${storm.movement}${storm.movementSpeedKph != null ? ` · ${Math.round(storm.movementSpeedKph)} km/u` : ''}` : 'Niet bepaald';
  const badgeClass = storm.status === 'Actief' ? 'active' : storm.status === 'Waakzaam' ? 'watch' : 'quiet';
  return `<div class="card storm-mode-card storm-mode-card-v2">
    <div class="storm-mode-head">
      <div>
        <span>Live onweersmodus</span>
        <h3>${storm.status === 'Actief' ? 'Onweer in de buurt' : storm.status === 'Waakzaam' ? 'Onweer mogelijk' : 'Geen direct gevaar'}</h3>
      </div>
      <div class="storm-status-badge ${badgeClass}">${esc(storm.status)}</div>
    </div>
    <div class="storm-primary">
      ${icon('storm',true,38)}
      <div><b>${dist}</b><span>Dichtstbijzijnde bliksem</span></div>
    </div>
    <div class="storm-mode-grid">
      <div><span>Ontladingen · 5 min</span><b>${storm.lightningAvailable ? storm.lightningCount5m : '—'}</b></div>
      <div><span>Verwachte passage</span><b>${eta}</b></div>
      <div><span>Intensiteit</span><b>${esc(storm.intensity)}</b></div>
      <div><span>Trekrichting</span><b>${esc(move)}</b></div>
    </div>
    <p class="storm-summary">${esc(storm.summary)}</p>
    ${storm.source ? `<div class="storm-source">Live data · ${esc(storm.source)}</div>` : ''}
    ${storm.limitation ? `<div class="storm-limitation">${esc(storm.limitation)}</div>` : ''}
  </div>`;
}

/* ---------------- real photo background: matches current conditions ---------------- */
let lightningTimer = null;
function tvWeatherPhotoFilename(code, isDay, cloudCover, fallback){
  if([51,53,55,56,57].includes(code)) return 'tv-drizzle.png';
  if([61,80].includes(code)) return 'tv-light-rain.png';
  if([63,66,67,81].includes(code)) return 'tv-rain.png';
  if([65,82].includes(code)) return 'tv-heavy-rain.png';
  if(isDay) return fallback;

  if(code === 0) return 'tv-night-clear.png';
  if(code === 1) return 'tv-night-light-clouds.png';
  if(code === 2) return 'tv-night-cloudy.png';
  if(code === 3) return cloudCover >= 86 ? 'tv-night-heavy-clouds.png' : 'tv-night-cloudy.png';
  return fallback;
}

function applyWeatherBG(code, isDay, cloudCover=0){
  const el = $('#weatherBG');
  if(!el) return;

  clearInterval(lightningTimer);
  lightningTimer = null;

  const cc = Math.max(0, Math.min(100, Number(cloudCover) || 0));
  let filename = DEFAULT_WEATHER_PHOTO;
  let scene = 'sunny';

  // Night uses the dedicated 9:16 Wheaterflow night photo set.
  // Daytime keeps the existing backgrounds unchanged.
  if(!isDay){
    const nightFilename = nightWeatherPhotoFilename(code, cc);
    if(NIGHT_WEATHER_PHOTO_FILES.has(nightFilename)){
      const nightSafe = encodeURI(`./assets/weather/night/${nightFilename}`);
      const nightPhotoValue = `url("${nightSafe}")`;
      el.style.backgroundImage = nightPhotoValue;
      el.style.setProperty('--weather-photo', nightPhotoValue);
      document.documentElement.style.setProperty('--weather-photo', nightPhotoValue);
      document.body?.style?.setProperty('--weather-photo', nightPhotoValue);
      $('#authSheet')?.style?.setProperty('--profile-weather-photo', nightPhotoValue);
      const tvScreen = $('#tvscreen');
      tvScreen?.style?.setProperty('--weather-photo', nightPhotoValue);
      // TV can keep its dedicated landscape assets when available.
      const tvNightFilename = tvWeatherPhotoFilename(code, false, cc, DEFAULT_WEATHER_PHOTO);
      const tvNightSafe = encodeURI(`./assets/backgrounds/${tvNightFilename}`);
      tvScreen?.style?.setProperty('--tv-weather-photo', `url("${tvNightSafe}")`);

      const rainyCodes = [51,53,55,56,57,61,63,65,66,67,80,81,82,68,69,83,84];
      const stormCodes = [95,96,99];
      const snowCodes = [71,73,75,77,85,86];
      scene = stormCodes.includes(Number(code)) ? 'stormy' : snowCodes.includes(Number(code)) ? 'snowy' : rainyCodes.includes(Number(code)) ? 'rainy' : (Number(code) >= 2 || cc >= 66 ? 'cloudy' : 'sunny');
      ['sunny','cloudy','rainy','stormy','snowy'].forEach(s=>el.classList.toggle(s, s===scene));
      el.classList.add('night','photo-weather-bg');
      el.classList.toggle('cloud-cover-heavy', cc >= 86);
      el.classList.toggle('cloud-cover-light', scene === 'cloudy' && cc < 66);
      return;
    }
  }

  // Neerslag / slecht weer krijgt altijd voorrang op bewolkingsgraad.
  if(code === 99){
    filename = 'Zwaar onweer.png';
    scene = 'stormy';
  }else if(code === 96){
    filename = 'Hagel.png';
    scene = 'stormy';
  }else if(code === 95){
    filename = 'Onweersbuien.png';
    scene = 'stormy';
  }else if([51,53,55,56,57].includes(code)){
    filename = 'Motregen.png';
    scene = 'rainy';
  }else if([61,80].includes(code)){
    filename = 'Lichte regen.png';
    scene = 'rainy';
  }else if([63,66,67,81].includes(code)){
    filename = 'Regen.png';
    scene = 'rainy';
  }else if([65,82].includes(code)){
    filename = 'Hevige regen.png';
    scene = 'rainy';
  }else if(code === 45){
    filename = 'Mist.png';
    scene = 'cloudy';
  }else if(code === 48){
    filename = 'Nevel.png';
    scene = 'cloudy';
  }else if([71,73,75,77,85,86].includes(code)){
    // Er is nog geen aparte sneeuwfoto in deze set: gebruik de dichtste echte wolkenfoto.
    filename = cc >= 66 ? 'Zwaarbewolkt.png' : 'Bewolkt.png';
    scene = 'snowy';
  }else{
    // Droog weer: laat de actuele WMO-code eerst bepalen welke foto bij de
    // zichtbare omschrijving hoort. Cloud cover verfijnt alleen code 0/1/3
    // en is fallback als de code onbekend is.
    if(code === 0){
      filename = cc <= 15 ? 'zonnig.png' : 'licht bewolkt.png';
    }else if(code === 1){
      filename = cc <= 30 ? 'licht bewolkt.png' : 'Overwegend zonnig.png';
    }else if(code === 2){
      // WMO 2 = gedeeltelijk / half bewolkt: houd beeld en tekst gelijk.
      filename = 'Half bewolkt.png';
    }else if(code === 3){
      filename = cc >= 86 ? 'Zwaarbewolkt.png' : 'Bewolkt.png';
    }else{
      if(cc <= 15) filename = 'zonnig.png';
      else if(cc <= 30) filename = 'licht bewolkt.png';
      else if(cc <= 45) filename = 'Overwegend zonnig.png';
      else if(cc <= 65) filename = 'Half bewolkt.png';
      else if(cc <= 85) filename = 'Bewolkt.png';
      else filename = 'Zwaarbewolkt.png';
    }

    scene = (code === 2 || code === 3 || cc >= 66) ? 'cloudy' : 'sunny';
  }

  if(!WEATHER_PHOTO_FILES.has(filename)) filename = DEFAULT_WEATHER_PHOTO;
  let tvFilename = tvWeatherPhotoFilename(code, Boolean(isDay), cc, filename);
  if(!TV_WEATHER_PHOTO_FILES.has(tvFilename) && !WEATHER_PHOTO_FILES.has(tvFilename)) tvFilename = filename;

  const safe = encodeURI(`./assets/backgrounds/${filename}`);
  const photoValue = `url("${safe}")`;
  const tvSafe = encodeURI(`./assets/backgrounds/${tvFilename}`);
  const tvPhotoValue = `url("${tvSafe}")`;
  el.style.backgroundImage = photoValue;
  el.style.setProperty('--weather-photo', photoValue);
  document.documentElement.style.setProperty('--weather-photo', photoValue);
  document.body?.style?.setProperty('--weather-photo', photoValue);
  $('#authSheet')?.style?.setProperty('--profile-weather-photo', photoValue);
  const tvScreen = $('#tvscreen');
  tvScreen?.style?.setProperty('--weather-photo', photoValue);
  tvScreen?.style?.setProperty('--tv-weather-photo', tvPhotoValue);

  const scenes = ['sunny','cloudy','rainy','stormy','snowy'];
  scenes.forEach(s=>el.classList.toggle(s, s===scene));
  el.classList.toggle('night', !isDay);
  el.classList.toggle('cloud-cover-heavy', cc >= 86);
  el.classList.toggle('cloud-cover-light', scene === 'cloudy' && cc < 66);
  el.classList.add('photo-weather-bg');
}

function fixHomeHeaderPosition(){
  // Layout is handled in CSS. Do not force window scroll positions on iOS;
  // doing so can create a stale visual offset after dynamic admin alerts.
}

function renderHome(){
  if(state.auth?.session?.user) setTimeout(renderProfileWeatherToday,0);
  const cur = liveWeatherSnapshot(), hourly = state.hourly, daily = state.daily;
  const wc = wcInfo(cur.weather_code);
  const isDay = cur.is_day === 1;
  const nowIdx = nowIndexInHourly();
  const intel = weatherIntelligence();
  const rain = intel.rain;
  const todayMax = daily.temperature_2m_max[0], todayMin = daily.temperature_2m_min[0];
  const currentSource = state.observation ? `${state.observation.source} - ${Math.round(state.observation.distanceKm)} km` : 'Harmonie (Benelux)';

  applyWeatherBG(cur.weather_code, isDay, cur.cloud_cover);

  let html = '';
  html += `<div class="hero">
    <div class="hero-kicker">MIJN LOCATIE</div>
    <div class="locname">${esc(locationDisplayName('Locatie bepalen...'))}</div>
    <div class="bignum display">${fmtTemp(cur.temperature_2m)}</div>
    <div class="cond">${wc.l}</div>
    <div class="hilo">${esc(weatherHeroLine(cur, rain))}</div>
    <div class="updated"><span id="updatedText">Zojuist bijgewerkt</span>${state.loc.admin ? ' · ' + esc(state.loc.admin) : ''} · Model: ${esc(currentSource)}</div>
  </div>`;

html += wheaterflowAdminAlertsCard();
// Officiële waarschuwingen horen boven gewone intelligence wanneer ze relevant zijn.
const validOfficialHomeAlert = state.alertsMeta?.official && state.alerts?.some(a => isBelgiumLocation() ? isValidOfficialKmiAlert(a) : (a.level && a.level !== 'green'));
if(validOfficialHomeAlert) {
  html += `<div class="hero-kmi-spacer" aria-hidden="true"></div>`;
  html += alertsCard();
}
html += weatherSummaryCard();
html += rainNowcastCard();

  // hourly — bestaande 24-uursdata, alleen gerichte markup voor vaste uitlijning
  html += `<div class="card hourly-24-card"><div class="card-title">${icon('gauge',true,13)} Komende 24 uur</div><div class="hourly-scroll" aria-label="Komende 24 uur">`;
  for(let i=nowIdx; i<Math.min(nowIdx+24, hourly.time.length); i++){
    const t = new Date(hourly.time[i]);
    const label = i===nowIdx ? 'Nu' : t.getHours()+':00';
    const hwc = wcInfo(hourly.weather_code[i]);
    const hIsDay = isDayForTime(hourly.time[i]);
    const pop = validNumber(hourly.precipitation_probability?.[i]);
    html += `<div class="hour-item ${i===nowIdx?'now':''}">
      <div class="t">${esc(label)}</div>
      <div class="hour-icon-wrap">${icon(hwc.ic, hIsDay, 26)}</div>
      <div class="pop">${pop!=null && pop>=10 ? Math.round(Math.max(0,Math.min(100,pop)))+'%' : ''}</div>
      <div class="v">${fmtTemp(hourly.temperature_2m[i])}</div>
    </div>`;
  }
  html += `</div></div>`;

  // compacte 7-daagse verwachting op Vandaag
  const nDays = Math.min(7, daily.time.length);
  const allMax = daily.temperature_2m_max.slice(0,nDays).filter(v=>validNumber(v)!=null);
  const allMin = daily.temperature_2m_min.slice(0,nDays).filter(v=>validNumber(v)!=null);
  const gMax = allMax.length ? Math.max(...allMax) : 1, gMin = allMin.length ? Math.min(...allMin) : 0;
  html += `<div class="card compact-forecast-card"><div class="card-title">${icon('sunrise',true,13)} 7-daagse verwachting</div>`;
  if(!nDays){
    html += wheaterflowStatus('empty','Momenteel geen gegevens beschikbaar');
  }else{
    for(let i=0;i<nDays;i++){
      const dwc=wcInfo(daily.weather_code?.[i]);
      const d=new Date(daily.time[i]);
      const dayName=i===0?'Vandaag':d.toLocaleDateString('nl-BE',{weekday:'short'});
      const dateLabel=d.toLocaleDateString('nl-BE',{day:'2-digit',month:'2-digit'});
      const lo=validNumber(daily.temperature_2m_min?.[i]), hi=validNumber(daily.temperature_2m_max?.[i]);
      const left=lo==null?0:((lo-gMin)/(gMax-gMin||1))*100;
      const width=lo==null||hi==null?0:((hi-lo)/(gMax-gMin||1))*100;
      const pop=validNumber(daily.precipitation_probability_max?.[i]);
      const gust=validNumber(daily.wind_gusts_10m_max?.[i]);
      html += `<div class="daily-row daily-row-compact ${i===0?'is-today':''}" data-day-index="${i}" role="button" tabindex="0" aria-label="Details voor ${esc(dayName)} ${esc(dateLabel)}">
        <div class="dname"><b>${esc(dayName)}</b><small>${esc(dateLabel)}</small></div>
        <div class="daily-icon-wrap">${icon(dwc.ic,true,32,'dicon')}</div>
        <div class="daily-weather-data">
          <div class="dpop">${pop!=null && pop>0 ? Math.round(pop)+'%' : ''}</div>
          <div class="daily-wind-alert">${gust!=null && gust>=60 ? `stoten ${fmtWind(gust)}` : ''}</div>
        </div>
        <div class="dlow">${lo==null?'':fmtTemp(lo)}</div>
        <div class="bar-track">${lo!=null&&hi!=null?`<div class="bar-fill" style="left:${left}%;width:${Math.max(width,6)}%;"></div>`:''}</div>
        <div class="dhigh">${hi==null?'':fmtTemp(hi)}</div>
      </div>`;
    }
  }
  html += `<button class="forecast-14-button" id="openFull14" type="button"><span class="forecast-14-label"><svg class="forecast-calendar-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg><span>Bekijk alle 14 dagen</span></span><span class="forecast-14-chevron">›</span></button></div>`;
  // details grid
  const moon = moonPhase(new Date());
  html += `<div class="detail-grid">`;
  html += windCompassCard(cur.wind_speed_10m, cur.wind_gusts_10m, cur.wind_direction_10m);
  html += pressureGaugeCard(cur.pressure_msl);
  html += sunArcDetailCard(daily.sunrise[0], daily.sunset[0]);
  html += uvBarCard(daily.uv_index_max[0]);
  html += detailCard('drop','Neerslag', fmtPrecip(cur.precipitation), 'Kans '+(hourly.precipitation_probability[nowIdx]??0)+'%');
  html += detailCard('eye','Zicht', (hourly.visibility[nowIdx]/1000).toFixed(1)+' km', hourly.visibility[nowIdx] > 8000 ? 'Goed zicht':'Beperkt zicht');
  html += detailCard('gauge','Vochtigheid', cur.relative_humidity_2m+'%', 'Dauwpunt '+fmtTemp(hourly.dew_point_2m[nowIdx]));
  html += detailCard('cloud','Bewolking', cur.cloud_cover+'%', cur.cloud_cover<30?'Overwegend helder':cur.cloud_cover<70?'Half bewolkt':'Bewolkt', 'cloud-wide');
  html += moonCard(moon);
  html += seaSparkDetailCard();
  html += `</div>`;
  html += compactAirQualityCard();
  html += stormModeCard();
  html += astroEventCards();
  html += appSections();

  $('#homeInner').innerHTML = html;
  wireSectionNav();
  $('#openFull14')?.addEventListener('click', ()=>{
    document.querySelector('#moreWeatherTabs [data-more-tab="fourteen"]')?.click();
    setTimeout(()=>document.querySelector('#sec2')?.scrollIntoView({behavior:'smooth',block:'start'}),40);
  });
  wireHomeMapLayers();
  wireMoreWeatherSections();
  requestAnimationFrame(()=>requestAnimationFrame(()=>fixHomeHeaderPosition()));
}

function astroEventCards(){
  const events = activeAstroEvents();
  if(!events.length) return '';
  return events.map(astroEventCard).join('');
}

function activeAstroEvents(now = Date.now()){
  return (state.astroEvents.events || [])
    .filter(event => event.auto_show !== false)
    .filter(event => {
      const from = Date.parse(event.visible_from || event.active_from || event.date);
      const until = Date.parse(event.visible_until || event.active_until || event.date);
      return Number.isFinite(from) && Number.isFinite(until) && now >= from && now <= until;
    })
    .sort((a,b)=>(Number(b.card_priority)||0) - (Number(a.card_priority)||0))
    .slice(0, 2);
}

function astroEventCard(event){
  if(event.type === 'meteor_shower') return meteorShowerCard(event);
  if(event.type === 'solar_eclipse') return solarEclipseCard(event);
  return genericAstroCard(event);
}

function solarEclipseCard(event){
  const timeline = [
    {time:formatEventTime(event.starts_at), label:'Begin', text:'De maan schuift voor de zon.'},
    {time:formatEventTime(event.peaks_at), label:'Piek', text:'Maximum in Belgie.'},
    {time:formatEventTime(event.ends_at), label:'Einde', text:'De verduistering loopt af.'}
  ];
  return `<div class="card eclipse-card astro-card astro-eclipse-card">
    <div class="card-title">${icon('sunrise',true,13)} ${esc(event.short_title || event.title)}</div>
    <div class="eclipse-hero">
      <div class="eclipse-orbit" aria-hidden="true"><span></span></div>
      <div>
        <strong>${esc(event.title)}</strong>
        <p>${esc(event.summary || '')}</p>
      </div>
    </div>
    <div class="eclipse-timeline">
      ${timeline.map(item=>`<div class="eclipse-time ${item.label === 'Piek' ? 'peak' : ''}">
        <span>${esc(item.time)}</span><b>${esc(item.label)}</b><small>${esc(item.text)}</small>
      </div>`).join('')}
    </div>
    <div class="eclipse-note">${esc(event.safety_message || 'Kijk alleen met veilige bescherming.')}</div>
  </div>`;
}

function meteorShowerCard(event){
  const estimate = meteorVisibilityEstimate(event);
  const source = (event.source_names || []).slice(0,2).join(' + ');
  return `<div class="card eclipse-card astro-card meteor-card">
    <div class="card-title">${icon('sunrise',true,13)} ${esc(event.short_title || event.title)}</div>
    <div class="meteor-hero">
      <div class="meteor-icon" aria-hidden="true"><span></span><i></i></div>
      <div>
        <strong>${esc(event.title)}</strong>
        <p>${esc(event.summary || '')}</p>
      </div>
    </div>
    <div class="meteor-stats">
      <div><span>Beste moment</span><b>${esc(formatEventTime(event.best_from))}-${esc(formatEventTime(event.best_until))}</b></div>
      <div><span>Ideaal</span><b>${Math.round(Number(event.ideal_zhr) || 0)}/u</b></div>
      <div><span>Lokaal geschat</span><b>${estimate.range}/u</b></div>
      <div><span>Per minuut</span><b>${estimate.perMinute}</b></div>
    </div>
    <div class="meteor-meter"><i style="width:${estimate.score}%"></i></div>
    <div class="eclipse-note">${esc(estimate.message)}${source ? ` Bron: ${esc(source)}.` : ''}</div>
  </div>`;
}

function genericAstroCard(event){
  return `<div class="card eclipse-card astro-card">
    <div class="card-title">${icon('sunrise',true,13)} ${esc(event.short_title || event.title || 'Sterrenhemel')}</div>
    <div class="meteor-hero">
      <div class="meteor-icon" aria-hidden="true"><span></span><i></i></div>
      <div><strong>${esc(event.title || 'Astro-event')}</strong><p>${esc(event.summary || '')}</p></div>
    </div>
  </div>`;
}

function formatEventTime(value){
  if(!value) return '-';
  const date = new Date(value);
  if(Number.isNaN(date.getTime())) return String(value).slice(11,16) || '-';
  return date.toLocaleTimeString('nl-BE', {hour:'2-digit', minute:'2-digit'});
}

function meteorVisibilityEstimate(event){
  const ideal = Math.max(0, Number(event.ideal_zhr) || 0);
  const cur = liveWeatherSnapshot();
  const cloud = Math.max(0, Math.min(100, Number(cur.cloud_cover ?? 50)));
  const precip = Math.max(0, Number(cur.precipitation ?? 0));
  const moon = moonPhase(new Date(event.peaks_at || Date.now()));
  const cloudFactor = cloud <= 15 ? 1 : cloud <= 40 ? .72 : cloud <= 70 ? .38 : .12;
  const rainFactor = precip >= 1 ? .16 : precip >= .1 ? .45 : 1;
  const moonFactor = moon.illumination <= .18 ? 1 : moon.illumination <= .55 ? .76 : .52;
  const darkFactor = isNightNow() ? 1 : .18;
  const local = ideal * cloudFactor * rainFactor * moonFactor * darkFactor * .72;
  const low = Math.max(0, Math.floor(local * .72));
  const high = Math.max(low, Math.ceil(local * 1.18));
  const score = Math.round(Math.max(5, Math.min(100, (local / Math.max(ideal * .72, 1)) * 100)));
  const perMinuteHigh = high / 60;
  let perMinute = perMinuteHigh >= 1 ? `${perMinuteHigh.toFixed(1)}/min` : `1 per ${Math.max(1, Math.round(60 / Math.max(high, 1)))} min`;
  if(high <= 0) perMinute = 'weinig';
  const message = cloud > 70
    ? 'Door bewolking is de zichtbaarheid waarschijnlijk beperkt.'
    : precip >= .1
      ? 'Regen maakt kijken moeilijk; wacht op droge momenten.'
      : moon.illumination > .55
        ? 'Maanlicht kan zwakkere meteoren overstralen.'
        : 'Goede kans bij een donkere plek weg van straatlicht.';
  return {range:`${low}-${high}`, perMinute, score, message};
}

function isNightNow(){
  try{
    const now = Date.now();
    const sr = state.daily?.sunrise?.[0] ? new Date(state.daily.sunrise[0]).getTime() : 0;
    const ss = state.daily?.sunset?.[0] ? new Date(state.daily.sunset[0]).getTime() : 0;
    return sr && ss ? now < sr || now > ss : false;
  }catch(e){
    return false;
  }
}

function defaultPushPreferences(){
  return {
    codeYellow:true, codeOrange:true, codeRed:true, thunder:true, heavyRain:true, snow:true, ice:true,
    wind:true, heat:true, frost:true, uv:true, rainSoon:true, dailyMorning:false, coast:true
  };
}
function defaultPushThresholds(){
  return { rainProbability:70, windGust:70, heat:30, frost:0 };
}
function loadPushSettings(){
  try{
    state.push.installationId = localStorage.getItem('weerscoop:installationId') || crypto.randomUUID();
    localStorage.setItem('weerscoop:installationId', state.push.installationId);
    state.push.preferences = {...defaultPushPreferences(), ...JSON.parse(localStorage.getItem('weerscoop:pushPrefs') || '{}')};
    state.push.thresholds = {...defaultPushThresholds(), ...JSON.parse(localStorage.getItem('weerscoop:pushThresholds') || '{}')};
  }catch(e){
    state.push.installationId = 'install-' + Date.now();
    state.push.preferences = defaultPushPreferences();
    state.push.thresholds = defaultPushThresholds();
  }
}
function savePushSettings(){
  try{
    localStorage.setItem('weerscoop:pushPrefs', JSON.stringify(state.push.preferences));
    localStorage.setItem('weerscoop:pushThresholds', JSON.stringify(state.push.thresholds));
  }catch(e){}
}

function appSections(){
  return `
    <nav class="section-nav" aria-label="Weersecties">
      ${['Kaarten','Meer weerdata'].map((n,i)=>`<a href="#sec${i+1}">${n}</a>`).join('')}
    </nav>
    <section id="sec1" class="app-section">${mapLayerSection()}</section>
    <section id="sec2" class="app-section more-weather-sections">
      <div class="more-weather-head">
        <span>${icon('gauge',true,14)} Meer weerdata</span>
        <small>Kies een detail zonder eindeloze scroll</small>
      </div>
      <div class="more-weather-tabs" id="moreWeatherTabs" role="tablist" aria-label="Meer weerdata">
        <button class="active" type="button" data-more-tab="charts">Grafieken</button>
        <button type="button" data-more-tab="fourteen">14 dagen</button>
        <button type="button" data-more-tab="sunmoon">Zon & maan</button>
        <button type="button" data-more-tab="skycoast">Sky & kust</button>
        <button type="button" data-more-tab="travel">Reisweer</button>
      </div>
      <div class="more-weather-content" id="moreWeatherContent"></div>
    </section>
  `;
}

function renderMoreWeatherSections(tab='charts'){
  const sections = {
    charts: chartsSection(),
    fourteen: fourteenDaySection(),
    sunmoon: sunMoonSection(),
    skycoast: `${airQualitySection()}${coastSection()}`,
    travel: travelWeatherSection()
  };
  return sections[tab] || sections.charts;
}

function wireMoreWeatherSections(){
  const content = $('#moreWeatherContent');
  const tabs = $$('#moreWeatherTabs [data-more-tab]');
  if(!content || !tabs.length) return;
  const load = (tab='charts') => {
    content.innerHTML = renderMoreWeatherSections(tab);
    tabs.forEach(btn=>btn.classList.toggle('active', btn.dataset.moreTab === tab));
    wireDailyDetails();
    renderPremiumCharts();
    positionSunPaths();
    wireTravelWeather();
  };
  tabs.forEach(btn=>{
    btn.addEventListener('click', ()=>load(btn.dataset.moreTab));
  });
  load('charts');
}

function wireSectionNav(){
  $$('.section-nav a').forEach(a=>a.addEventListener('click', e=>{
    e.preventDefault();
    document.querySelector(a.getAttribute('href'))?.scrollIntoView({behavior:'smooth', block:'start'});
  }));
}

function smartBriefingCard(){
  const tips = smartMessages();
  return `<div class="card"><div class="card-title">${icon('gauge',true,13)} Slimme meldingen</div>
    <div class="smart-list">${tips.map(t=>`<div class="smart-item">${esc(t)}</div>`).join('')}</div>
    <div class="notify-grid">
      ${['Regen','Onweer','Sneeuw','Sterke wind','UV','Waarschuwingen','Zonsopkomst','Zonsondergang'].map(n=>`<label><input type="checkbox"> ${n}</label>`).join('')}
    </div>
    <div class="subtle">Browsermeldingen worden pas gevraagd wanneer je ze zelf inschakelt.</div>
  </div>`;
}

function smartMessages(){
  const h = state.hourly, d = state.daily, idx = nowIndexInHourly();
  const msgs = [];
  const centralRain=nowcastEngine();
  if(centralRain.status==='rain_soon') msgs.push(`${centralRainEtaText(centralRain)} (${rainEtaReliabilityText(centralRain)}).`);
  else if(centralRain.status==='raining') msgs.push(centralRainEtaText(centralRain));
  for(let i=idx;i<Math.min(idx+24,h.time.length);i++){
    if([95,96,99].includes(h.weather_code[i])){ msgs.push(`Kans op onweer rond ${new Date(h.time[i]).toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit'})}.`); break; }
  }
  const uvMax = Math.max(...(h.uv_index||[]).slice(idx, idx+24).map(v=>v||0));
  if(uvMax >= 6) msgs.push('De UV-index wordt hoog vandaag. Bescherm je huid tussen de middag.');
  const gust = Math.max(...h.wind_gusts_10m.slice(idx, idx+24).map(v=>v||0));
  if(gust >= 60) msgs.push(`Sterke windstoten mogelijk tot ${Math.round(gust)} km/u.`);
  const sunset = new Date(d.sunset[0]);
  const mins = Math.round((sunset-Date.now())/60000);
  if(mins > 0 && mins < 90) msgs.push(`Zonsondergang over ${mins} minuten.`);
  return msgs.length ? msgs : ['Geen dringende weersignalen op dit moment.'];
}

function mapLayerSection(){
  const layers = [
    ['radar','Buienradar'],
    ['temperatures','Temperatuur'],
    ['wind-speeds','Wind'],
    ['cloud-cover','Bewolking'],
    ['lightning-strikes-icons','Onweer'],
    ['wave-heights','Zeetemperatuur'],
    ['snow','Sneeuw'],
    ['satellite','Satelliet']
  ];
  return `<div class="card"><div class="card-title">${icon('gauge',true,13)} Interactieve weerkaart</div>
    <div class="map-tabs">${layers.map(([id,l],i)=>`<button class="${i===0?'active':''}" data-home-layer="${id}" type="button">${l}</button>`).join('')}</div>
    <div class="map-preview">
      <div id="homeWeatherMap" class="home-weather-map" aria-label="Interactieve weerkaart"></div>
      <div class="map-preview-status" id="homeMapStatus">Kaart laden...</div>
      <button class="map-retry-btn hidden" id="homeMapRetry" type="button">Opnieuw proberen</button>
    </div>
    <div class="legend-row"><span>Legenda</span><i></i><span id="mapLayerTime">Actuele modeltijd</span></div>
  </div>`;
}

function wireHomeMapLayers(){
  const mapEl = $('#homeWeatherMap');
  if(!mapEl) return;
  if(!window.L){
    setHomeMapStatus('Radargegevens tijdelijk niet beschikbaar','radar');
    $('#homeMapRetry')?.classList.remove('hidden');
    $('#homeMapRetry')?.addEventListener('click', ()=>{ if(window.L){ initHomeWeatherMap(); setHomeMapLayer(state.homeMap.activeLayer||'radar'); } else setHomeMapStatus('Radargegevens tijdelijk niet beschikbaar','radar'); });
    return;
  }
  updateHomeMapLayerAvailability();
  $$('.map-tabs [data-home-layer]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      if(btn.disabled) return;
      $$('.map-tabs [data-home-layer]').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      setHomeMapLayer(btn.dataset.homeLayer);
    });
  });
  $('#homeMapRetry')?.addEventListener('click', ()=>setHomeMapLayer(state.homeMap.activeLayer || 'radar'));
  setTimeout(()=>{
    initHomeWeatherMap();
    setHomeMapLayer(state.homeMap.activeLayer || 'radar');
    refreshHomeMapLayout();
  }, 80);
  setTimeout(()=>{
    const status=$('#homeMapStatus');
    if(status?.classList.contains('show') && /laden/i.test(status.textContent||'')) setHomeMapStatus('Radargegevens tijdelijk niet beschikbaar','radar');
  }, 9000);
}

async function updateHomeMapLayerAvailability(){
  const buttons=$$('.map-tabs [data-home-layer]');
  buttons.forEach(btn=>{ const id=btn.dataset.homeLayer; if(!['radar','satellite'].includes(id)){ btn.disabled=true; btn.title='Kaartlaag controleren…'; } });
  try{
    const config=await fetchXweatherConfig();
    if(!config?.configured) return;
    const defs=availableXweatherLayerDefinitions?.() || [];
    const ids=new Set(defs.map(d=>d.id));
    buttons.forEach(btn=>{
      const id=btn.dataset.homeLayer;
      if(['radar','satellite'].includes(id)){ btn.disabled=false; return; }
      const ok=ids.has(id); btn.disabled=!ok; btn.title=ok?'': 'Deze kaartlaag is momenteel niet beschikbaar';
    });
  }catch(e){ console.warn('Beschikbare kaartlagen konden niet worden gecontroleerd',e); }
}

function initHomeWeatherMap(){
  const target=$('#homeWeatherMap');
  if(!target || !window.L) return;
  // renderHome vervangt de DOM. Een Leaflet-instance die nog naar het oude element wijst
  // moet dan worden verwijderd, anders blijft op iPhone een leeg donker vlak achter.
  if(state.homeMap.map && state.homeMap.map.getContainer?.()!==target){
    try{ state.homeMap.map.remove(); }catch(e){}
    state.homeMap.map=null; state.homeMap.base=null; state.homeMap.overlay=null; state.homeMap.locationMarker=null;
  }
  if(state.homeMap.map){ refreshHomeMapLayout(); return; }
  const rv = radarView();
  const map = L.map('homeWeatherMap', {
    zoomControl:false,
    attributionControl:false,
    dragging:true,
    scrollWheelZoom:false,
    doubleClickZoom:false,
    boxZoom:false,
    keyboard:false,
    tap:true,
    zoomSnap:.25,
    minZoom:5,
    maxZoom:14
  }).setView(rv.center, Math.min(8, rv.zoom));
  state.homeMap.map = map;
  state.homeMap.base = addOpenFreeMapBase(map, {attribution:false});
  state.homeMap.locationMarker=L.circleMarker([state.loc.lat,state.loc.lon], {radius:6,color:'#fff',weight:2,fillColor:'#1677ff',fillOpacity:.9}).addTo(map);
  setTimeout(()=>{ map.invalidateSize(); map.setView(radarView().center, Math.min(8,radarView().zoom), {animate:false}); }, 120);
}

async function setHomeMapLayer(layerId){
  state.homeMap.activeLayer = layerId || 'radar';
  initHomeWeatherMap();
  const map = state.homeMap.map;
  if(!map) return;
  setHomeMapStatus('Kaartlaag laden...');
  clearHomeMapOverlay();
  try{
    if(layerId === 'radar'){
      await setHomeLegacyLayer('radar');
    }else if(layerId === 'satellite'){
      await setHomeLegacyLayer(layerId);
    }else{
      const ok = await setHomeXweatherLayer(layerId);
      if(!ok) throw new Error('Xweather laag niet beschikbaar');
    }
    setHomeMapStatus('');
    refreshHomeMapLayout();
    $('#mapLayerTime').textContent = `Laatst bijgewerkt om ${new Date().toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit'})}`;
  }catch(err){
    console.error('Home weather map layer failed', {layerId, err});
    setHomeMapStatus('Radargegevens tijdelijk niet beschikbaar','radar');
  }finally{
    setTimeout(()=>map.invalidateSize(), 80);
  }
}

function clearHomeMapOverlay(){
  const map = state.homeMap.map;
  if(state.homeMap.overlay && map){
    try{ map.removeLayer(state.homeMap.overlay); }catch(e){}
  }
  state.homeMap.overlay = null;
  if(state.homeMap.xweatherController){
    try{ state.homeMap.xweatherController.timeline?.pause?.(); }catch(e){}
    try{ state.homeMap.xweatherController.dispose?.(); }catch(e){}
  }
  state.homeMap.xweatherController = null;
}

async function setHomeLegacyLayer(layerId){
  const map = state.homeMap.map;
  if(layerId === 'radar'){
    let frame = null;
    try{
      frame = await fetchLatestRainviewerRadarFrame();
    }catch(err){
      console.warn('Home radar RainViewer faalde, WeatherFlow fallback wordt gebruikt', err);
      rainviewerMeta = null;
    }
    const url = frame
      ? rainviewerTileUrl(frame, 'home')
      : weatherflowRadarTileUrl(0);
    state.homeMap.overlay = L.tileLayer(url, {
      opacity:.86,
      maxZoom:14,
      maxNativeZoom:7,
      crossOrigin:true,
      updateWhenIdle:false,
      updateWhenZooming:false
    }).addTo(map);
    return;
  }
  const r = await fetch('https://api.rainviewer.com/public/weather-maps.json?ts=' + Date.now(), {cache:'no-store'});
  if(!r.ok) throw new Error('RainViewer '+r.status);
  const meta = await r.json();
  const frames = meta.satellite?.infrared || meta.satellite?.visible || [];
  const latest = frames[frames.length - 1];
  if(!latest) throw new Error('Geen kaartframe beschikbaar');
  const url = `${meta.host}${latest.path}/256/{z}/{x}/{y}/0/0_0.png?home=${latest.time}-${Date.now()}`;
  state.homeMap.overlay = L.tileLayer(url, {
    opacity:.74,
    maxZoom:10,
    maxNativeZoom:10,
    crossOrigin:true
  }).addTo(map);
}

async function setHomeXweatherLayer(layerId){
  const map = state.homeMap.map;
  const def = findXweatherLayerDefinition(layerId);
  if(!def) return false;
  const config = await fetchXweatherConfig();
  if(!config?.configured || !config.clientId || !config.clientSecret) return false;
  await ensureXweatherSdk();
  const maps = window.mapsgl;
  if(!maps?.Account || !maps?.LeafletMapController) return false;
  const controller = new maps.LeafletMapController(map, {
    account:new maps.Account(config.clientId, config.clientSecret),
    units:{temperature:'C',speed:'km/h',pressure:'hPa',distance:'km',precipitation:'mm'},
    animation:{duration:0,endDelay:0,pauseWhileLoading:true,resumeOnMoveEnd:false,preloadData:false}
  });
  state.homeMap.xweatherController = controller;
  await controller.initialize();
  const code = resolveXweatherLayerCode(def, controller);
  if(!code){
    try{ controller.dispose?.(); }catch(e){}
    if(state.homeMap.xweatherController === controller) state.homeMap.xweatherController = null;
    return false;
  }
  try{
    controller.addWeatherLayer(code, xweatherLayerOverrides(code));
  }catch(err){
    console.error('Home weather map Xweather layer failed', {layerId, code, error:err});
    try{ controller.dispose?.(); }catch(e){}
    if(state.homeMap.xweatherController === controller) state.homeMap.xweatherController = null;
    return false;
  }
  controller.timeline?.goToDate?.(new Date());
  controller.timeline?.pause?.();
  controller.redraw?.();
  return true;
}

function setHomeMapStatus(text, kind='loading'){
  const el=$('#homeMapStatus');
  const retry=$('#homeMapRetry');
  const legend=$('.legend-row', el?.closest('.card') || document);
  if(!el) return;
  if(!text){
    el.innerHTML=''; el.classList.remove('show'); retry?.classList.add('hidden');
    state.dataStatus.homeMap.lastSuccess=Date.now(); state.dataStatus.homeMap.error=null;
    return;
  }
  const isError=/niet beschikbaar|mislukt|fout/i.test(text);
  const type=isError?'radar':kind;
  el.innerHTML=wheaterflowStatus(type, isError?'Radargegevens tijdelijk niet beschikbaar':text, {updated:state.dataStatus.homeMap.lastSuccess,retryId:null});
  el.classList.add('show');
  retry?.classList.toggle('hidden',!isError);
  if(isError) state.dataStatus.homeMap.error=text;
}
function refreshHomeMapLayout(){
  const map=state.homeMap.map;
  if(!map) return;
  requestAnimationFrame(()=>{
    map.invalidateSize({pan:false});
    const lat=validNumber(state.loc?.lat), lon=validNumber(state.loc?.lon);
    if(lat!=null&&lon!=null){
      map.setView([lat,lon], map.getZoom()||8, {animate:false});
      state.homeMap.locationMarker?.setLatLng?.([lat,lon]);
    }
  });
}

function homeMapLayerError(layerId){
  if(['cloud-cover','temperatures','wind-speeds','lightning-strikes-icons','wave-heights','snow'].includes(layerId)){
    return 'Deze Xweather-kaartlaag is niet beschikbaar met de huidige sleutel of verbinding.';
  }
  return 'Kaartlaag kon niet worden geladen.';
}

function chartsSection(){
  if(!state.hourly?.time?.length) return `<div class="card">${wheaterflowStatus('empty','Momenteel geen gegevens beschikbaar')}</div>`;
  const idx = nowIndexInHourly();
  const points = Array.from({length:24},(_,n)=>idx+n).filter(i=>i<state.hourly.time.length);
  const stat = (label, vals, unit='') => {
    const clean = vals.filter(v=>v!=null && isFinite(v));
    if(!clean.length) return `<span>${label}<b>-</b></span>`;
    const min = Math.min(...clean), max = Math.max(...clean);
    return `<span>${label}<b>${Math.round(min)}-${Math.round(max)}${unit}</b></span>`;
  };
  return `<div class="more-weather-section-title">${icon('gauge',true,13)} Grafieken komende 24 uur</div>
    <div class="premium-chart-summary">
      ${stat('Temperatuur', points.map(i=>state.hourly.temperature_2m[i]), '°')}
      ${stat('Neerslagkans', points.map(i=>state.hourly.precipitation_probability[i]), '%')}
      ${stat('Wind', points.map(i=>state.hourly.wind_speed_10m[i]), ' km/u')}
    </div>
    <div class="chart-grid premium-charts">
      ${premiumChartShell('temp','Temperatuur','Gevoelstemperatuur en luchttemperatuur','°C')}
      ${premiumChartShell('rain','Neerslag','Kans en hoeveelheid per uur','% / mm')}
      ${premiumChartShell('uv','UV-index','Sterkte van de zon doorheen de dag','UV')}
      ${premiumChartShell('wind','Wind','Windsnelheid en windstoten','km/u')}
    </div>`;
}

function premiumChartShell(id, title, sub, unit){
  return `<div class="card mini-chart apple-chart-card" data-chart="${id}">
    <div class="mini-chart-head"><b>${title}</b><span>${unit}</span></div>
    <div class="chart-caption">${sub}</div>
    <div class="apple-chart-wrap"><canvas id="chart-${id}" height="190"></canvas></div>
  </div>`;
}

let premiumChartInstances = [];
function renderPremiumCharts(){
  premiumChartInstances.forEach(ch=>ch.destroy?.());
  premiumChartInstances = [];
  if(!window.Chart || !state.hourly?.time) return renderFallbackCharts();
  const idx = nowIndexInHourly();
  const points = Array.from({length:24},(_,n)=>idx+n).filter(i=>i<state.hourly.time.length);
  const labels = points.map(i=>new Date(state.hourly.time[i]).toLocaleTimeString('nl-BE',{hour:'2-digit'}));
  const h = state.hourly;
  const charts = [
    ['temp', labels, [
      premiumDataset('Temperatuur', points.map(i=>h.temperature_2m[i]), '#65d8ff', true),
      premiumDataset('Voelt als', points.map(i=>h.apparent_temperature?.[i]), '#ffd36b', false)
    ], '°C'],
    ['rain', labels, [
      premiumDataset('Neerslagkans', points.map(i=>h.precipitation_probability[i]), '#69e7ff', true),
      premiumDataset('Neerslag mm', points.map(i=>h.precipitation[i]), '#4ade80', false, 'bar')
    ], ''],
    ['uv', labels, [
      premiumDataset('UV-index', points.map(i=>h.uv_index?.[i] ?? null), '#ffd43b', true)
    ], ''],
    ['wind', labels, [
      premiumDataset('Wind', points.map(i=>h.wind_speed_10m[i]), '#8be7ff', true),
      premiumDataset('Stoten', points.map(i=>h.wind_gusts_10m[i]), '#ff9f43', false)
    ], ' km/u']
  ];
  charts.forEach(([id, labs, datasets, unit])=>renderOnePremiumChart(id, labs, datasets, unit));
}

function premiumDataset(label, data, color, fill, type='line'){
  return {
    type, label, data, borderColor:color, backgroundColor:fill ? color+'24' : color+'33',
    borderWidth:type==='bar'?0:2.5, pointRadius:0, pointHoverRadius:4, tension:.42,
    fill:type==='line' && fill, borderRadius:type==='bar'?6:0, maxBarThickness:12
  };
}

function renderOnePremiumChart(id, labels, datasets, unit){
  const canvas = document.getElementById(`chart-${id}`);
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const chart = new Chart(ctx, {
    data:{labels,datasets},
    options:{
      responsive:true, maintainAspectRatio:false, animation:{duration:420},
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{display:true,labels:{color:'rgba(245,249,255,.78)',boxWidth:10,boxHeight:10,usePointStyle:true,font:{size:11,weight:'600'}}},
        tooltip:{backgroundColor:'rgba(8,16,32,.92)',borderColor:'rgba(255,255,255,.18)',borderWidth:1,padding:10,titleColor:'#fff',bodyColor:'#dbeafe',
          callbacks:{label:ctx=>`${ctx.dataset.label}: ${Number(ctx.parsed.y).toFixed(id==='rain'&&ctx.dataset.label.includes('mm')?1:0)}${unit}`}}
      },
      scales:{
        x:{grid:{display:false},ticks:{color:'rgba(235,244,255,.55)',maxTicksLimit:6,font:{size:10}}},
        y:{beginAtZero:id==='rain'||id==='uv',grid:{color:'rgba(255,255,255,.09)'},ticks:{color:'rgba(235,244,255,.55)',font:{size:10},maxTicksLimit:5}}
      }
    }
  });
  premiumChartInstances.push(chart);
}

function renderFallbackCharts(){
  $$('.apple-chart-card').forEach(card=>{
    card.insertAdjacentHTML('beforeend', '<div class="subtle">Grafiekbibliotheek niet geladen. Probeer de pagina opnieuw te verversen.</div>');
  });
}

function miniChart(title, points, y1, y2, unit){
  const series1 = points.map(i=>({i, v:y1(i)})).filter(p=>p.v!=null && isFinite(p.v));
  const series2 = y2 ? points.map(i=>({i, v:y2(i)})).filter(p=>p.v!=null && isFinite(p.v)) : [];
  const vals = series1.concat(series2).map(p=>p.v);
  if(!vals.length) return `<div class="mini-chart"><div class="mini-chart-head"><b>${title}</b><span>${unit}</span></div><div class="subtle">Geen data beschikbaar.</div></div>`;
  let min = Math.min(...vals), max = Math.max(...vals);
  const pad = Math.max(1, (max-min)*0.12);
  min = Math.floor(min-pad); max = Math.ceil(max+pad);
  const left=13, right=98, top=12, bottom=82, w=right-left, h=bottom-top;
  const x = n => left + (n/(points.length-1||1))*w;
  const y = v => bottom - ((v-min)/(max-min||1))*h;
  const line = fn => points.map((i,n)=>{
    const v = fn(i);
    return v==null || !isFinite(v) ? null : `${x(n).toFixed(1)},${y(v).toFixed(1)}`;
  }).filter(Boolean).join(' ');
  const fmt = v => title==='Neerslag' ? Math.round(v) : (Math.abs(v) < 10 ? v.toFixed(1) : Math.round(v));
  const first = series1[0]?.v, last = series1[series1.length-1]?.v;
  const minVal = Math.min(...series1.map(p=>p.v)), maxVal = Math.max(...series1.map(p=>p.v));
  const minI = series1.find(p=>p.v===minVal)?.i, maxI = series1.find(p=>p.v===maxVal)?.i;
  const minN = points.indexOf(minI), maxN = points.indexOf(maxI);
  const xLabels = [0, 6, 12, 18, 23].filter(n=>n<points.length);
  const gridVals = [max, (max+min)/2, min];
  return `<div class="mini-chart" tabindex="0" aria-label="${title}">
    <div class="mini-chart-head"><b>${title}</b><span>${unit}</span></div>
    <div class="chart-stats">
      <span>Nu <b>${fmt(first)}</b></span><span>Laatste <b>${fmt(last)}</b></span><span>Min <b>${fmt(minVal)}</b></span><span>Max <b>${fmt(maxVal)}</b></span>
    </div>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="${title} grafiek">
      ${gridVals.map(v=>`<line class="gridline" x1="${left}" x2="${right}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"></line><text class="ylabel" x="1.5" y="${(y(v)+1.5).toFixed(1)}">${fmt(v)}</text>`).join('')}
      ${xLabels.map(n=>`<text class="xlabel" x="${x(n).toFixed(1)}" y="96">${new Date(state.hourly.time[points[n]]).getHours()}u</text>`).join('')}
      <polyline class="line main" points="${line(y1)}"></polyline>
      ${y2?`<polyline class="line sub" points="${line(y2)}"></polyline>`:''}
      ${minN>=0?`<circle class="point min" cx="${x(minN).toFixed(1)}" cy="${y(minVal).toFixed(1)}" r="1.8"><title>Minimum ${fmt(minVal)} ${unit}</title></circle>`:''}
      ${maxN>=0?`<circle class="point max" cx="${x(maxN).toFixed(1)}" cy="${y(maxVal).toFixed(1)}" r="1.8"><title>Maximum ${fmt(maxVal)} ${unit}</title></circle>`:''}
      ${points.map((i,n)=>({i,n,v:y1(i),v2:y2?y2(i):null})).filter(p=>p.v!=null && isFinite(p.v)).map(p=>`<circle class="hit" cx="${x(p.n).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="3"><title>${new Date(state.hourly.time[p.i]).toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit'})}: ${fmt(p.v)} ${unit}${p.v2!=null && isFinite(p.v2)?` / ${fmt(p.v2)}`:''}</title></circle>`).join('')}
    </svg>
    <div class="chart-legend"><span><i class="main"></i>${chartMainLabel(title)}</span>${y2?`<span><i class="sub"></i>${chartSubLabel(title)}</span>`:''}</div>
  </div>`;
}

function chartMainLabel(title){
  return ({Temperatuur:'temperatuur', Neerslag:'neerslagkans (%)', 'UV-index':'UV-index', Wind:'windsnelheid'})[title] || title;
}
function chartSubLabel(title){
  return ({Temperatuur:'gevoelstemperatuur', Neerslag:'neerslaghoeveelheid (mm x10)', Wind:'windstoten'})[title] || 'tweede reeks';
}

function fourteenDaySection(){
  if(!state.daily?.time?.length) return `<div class="card">${wheaterflowStatus('empty','Momenteel geen gegevens beschikbaar')}</div>`;
  const n = Math.min(14, state.daily.time.length);
  return `<div class="card forecast14-card"><div class="card-title">${icon('sunrise',true,13)} 14-daagse verwachting</div>
    <div class="forecast14-head" aria-hidden="true">
      <span></span><span></span><span>Max</span><span>Min</span><span>Max wind</span>
    </div>
    <div class="days14 forecast14-list">${Array.from({length:n},(_,i)=>day14Card(i)).join('')}</div>
  </div>`;
}

function day14Card(i){
  const d = new Date(state.daily.time[i]);
  const wc = wcInfo(state.daily.weather_code[i]);
  const lo = validNumber(state.daily.temperature_2m_min?.[i]);
  const hi = validNumber(state.daily.temperature_2m_max?.[i]);
  const wind = validNumber(state.daily.wind_speed_10m_max?.[i]);
  const dayName = i===0 ? 'Vandaag' : d.toLocaleDateString('nl-BE',{weekday:'short'});
  const fullDayName = i===0 ? 'Vandaag' : d.toLocaleDateString('nl-BE',{weekday:'long'});
  const dateLabel = d.toLocaleDateString('nl-BE',{day:'2-digit',month:'2-digit'});
  const hiLabel = hi==null ? '—' : fmtTemp(hi);
  const loLabel = lo==null ? '—' : fmtTemp(lo);
  const windLabel = wind==null ? '—' : `${Math.round(wind)} km/u`;
  return `<button class="day14 forecast14-row ${i===0?'today':''}" data-day="${i}" type="button" aria-label="${esc(fullDayName)}: maximum ${esc(hiLabel)}, minimum ${esc(loLabel)}, maximum wind ${esc(windLabel)}">
    <span class="forecast14-day"><b>${esc(dayName)}</b><small>${esc(dateLabel)}</small></span>
    <span class="forecast14-icon" title="${esc(wc.l)}">${icon(wc.ic,true,36)}</span>
    <span class="forecast14-metric forecast14-max"><small>Max</small><b>${hiLabel}</b></span>
    <span class="forecast14-metric forecast14-min"><small>Min</small><b>${loLabel}</b></span>
    <span class="forecast14-metric forecast14-wind"><small>Wind</small><b>${windLabel}</b></span>
  </button>`;
}

function wireDailyDetails(){
  $$('.day14').forEach(btn=>btn.addEventListener('click',()=>{
    const i = +btn.dataset.day;
    $$('.day14').forEach(b=>b.classList.toggle('selected', b === btn));
    btn.classList.add('tap-animate');
    setTimeout(()=>btn.classList.remove('tap-animate'), 360);
    openDayDetail(i);
  }));
}

function openDayDetail(i){
  const sheet = $('#daySheet'), scrim = $('#dayScrim');
  if(!sheet || !scrim) return;
  sheet.innerHTML = dayDetailSheet(i);
  lockPageScroll();
  sheet.classList.add('show');
  scrim.classList.add('show');
  document.body.classList.add('day-detail-open');
  $('.day-sheet-close', sheet)?.addEventListener('click', closeDayDetail);
  wireDaySheetSwipe(sheet);
}

function closeDayDetail(){
  $('#daySheet')?.classList.remove('show');
  $('#dayScrim')?.classList.remove('show');
  document.body.classList.remove('day-detail-open');
  unlockPageScroll();
}

function wireDaySheetSwipe(sheet){
  let startY = 0, dragging = false;
  sheet.onpointerdown = e => {
    if(!e.target.closest('.day-sheet-handle')) return;
    startY = e.clientY;
    dragging = true;
  };
  sheet.onpointerup = e => {
    if(!dragging) return;
    dragging = false;
    if(e.clientY - startY > 90) closeDayDetail();
  };
  sheet.onpointercancel = () => { dragging = false; };
}

function dayDetailSheet(i){
  const daily = state.daily, hourly = state.hourly;
  const date = new Date(daily.time[i]);
  const wc = wcInfo(daily.weather_code[i]);
  const hours = dayHourlyIndexes(i);
  const avg = key => average(hours.map(h=>hourly[key]?.[h]).filter(v=>v!=null && isFinite(v)));
  const max = key => {
    const vals = hours.map(h=>hourly[key]?.[h]).filter(v=>v!=null && isFinite(v));
    return vals.length ? Math.max(...vals) : null;
  };
  const windAvg = avg('wind_speed_10m');
  const humAvg = avg('relative_humidity_2m');
  const pressureAvg = avg('pressure_msl');
  const dirAvg = avgWindDirection(hours.map(h=>hourly.wind_direction_10m?.[h]).filter(v=>v!=null && isFinite(v)));
  const dayAlerts = alertsForDay(i);
  return `<div class="day-sheet-handle"></div>
    <button class="day-sheet-close" type="button" aria-label="Sluiten">&times;</button>
    <div class="day-detail-hero">
      <div>
        <div class="day-detail-date">${date.toLocaleDateString('nl-BE',{weekday:'long',day:'numeric',month:'long'})}</div>
        <h2 id="daySheetTitle">${wc.l}</h2>
        <div class="day-detail-range"><b>${fmtTemp(daily.temperature_2m_max[i])}</b><span>${fmtTemp(daily.temperature_2m_min[i])}</span></div>
      </div>
      ${icon(wc.ic,true,86)}
    </div>
    <div class="day-detail-grid">
      ${dayMetric('thermo','Gevoel', `${fmtTemp(daily.apparent_temperature_min?.[i])} - ${fmtTemp(daily.apparent_temperature_max?.[i])}`, 'min / max')}
      ${dayMetric('drop','Neerslagkans', `${daily.precipitation_probability_max[i]??0}%`, fmtPrecip(daily.precipitation_sum[i]))}
      ${dayMetric('wind','Gemiddelde wind', windAvg == null ? 'Niet beschikbaar' : fmtWind(windAvg), validNumber(daily.wind_gusts_10m_max?.[i])==null ? 'Geen stootdata' : `Windstoten ${fmtWind(daily.wind_gusts_10m_max[i])}`)}
      ${dayMetric('gauge','Windrichting', dirAvg == null ? '-' : windDirectionLabel(dirAvg), dirAvg == null ? '-' : `${Math.round(dirAvg)} deg`)}
      ${dayMetric('gauge','Vochtigheid', humAvg == null ? '-' : `${Math.round(humAvg)}%`, 'gemiddeld')}
      ${dayMetric('uv','UV-index', `${Math.round(daily.uv_index_max?.[i] ?? max('uv_index') ?? 0)}`, uvLabel(daily.uv_index_max?.[i] ?? max('uv_index') ?? 0))}
      ${dayMetric('thermo','Luchtdruk', pressureAvg == null ? '-' : fmtPress(pressureAvg), 'gemiddeld')}
      ${dayMetric('sunrise','Zon', `${formatDayTime(daily.sunrise[i])}`, `Onder ${formatDayTime(daily.sunset[i])}`)}
    </div>
    <div class="day-alerts ${dayAlerts.length?'':'quiet'}">
      <b>Waarschuwingen</b>
      ${dayAlerts.length ? dayAlerts.map(a=>`<p>${esc(a)}</p>`).join('') : '<p>Geen waarschuwingen voor deze dag.</p>'}
    </div>
    <div class="day-hours-title">Uur-tot-uur</div>
    <div class="day-hours">${hours.slice(0,24).map(h=>dayHourItem(h)).join('')}</div>`;
}

function dayMetric(ic, title, value, sub){
  return `<div class="day-metric">${icon(ic,true,18)}<div><span>${title}</span><b>${value}</b><small>${sub}</small></div></div>`;
}

function dayHourlyIndexes(dayIndex){
  const day = state.daily.time[dayIndex];
  const idx = [];
  (state.hourly.time || []).forEach((t,i)=>{
    if(String(t).slice(0,10) === day) idx.push(i);
  });
  return idx;
}

function dayHourItem(i){
  const h = state.hourly, wc = wcInfo(h.weather_code[i]);
  const time = new Date(h.time[i]).toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit'});
  const pop = h.precipitation_probability[i] ?? 0;
  return `<div class="day-hour">
    <span>${time}</span>${icon(wc.ic,isDayForTime(h.time[i]),24)}
    <b>${fmtTemp(h.temperature_2m[i])}</b>
    <small>${pop>10 ? pop+'%' : ''}</small>
  </div>`;
}

function average(vals){
  return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
}

function avgWindDirection(vals){
  if(!vals.length) return null;
  const r = vals.map(v=>v*Math.PI/180);
  const x = r.reduce((a,v)=>a+Math.cos(v),0), y = r.reduce((a,v)=>a+Math.sin(v),0);
  return (Math.atan2(y,x)*180/Math.PI + 360) % 360;
}

function windDirectionLabel(deg){
  const dirs = ['N','NO','O','ZO','Z','ZW','W','NW'];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

function formatDayTime(value){
  return value ? String(value).slice(11,16) : '-';
}

function alertsForDay(dayIndex){
  const out = [];
  const d = state.daily;
  const hIdx = dayHourlyIndexes(dayIndex);
  if((d.precipitation_probability_max[dayIndex] ?? 0) >= 70) out.push('Verhoogde kans op neerslag.');
  if((d.wind_gusts_10m_max[dayIndex] ?? 0) >= 60) out.push('Kans op sterke windstoten.');
  if((d.uv_index_max?.[dayIndex] ?? 0) >= 6) out.push('Hoge UV-index, bescherm je huid.');
  if(hIdx.some(i=>[95,96,99].includes(state.hourly.weather_code[i]))) out.push('Kans op onweer.');
  const official = (state.alerts || []).filter(a=>a.level && a.level !== 'green').map(a=>a.headline || a.description).filter(Boolean);
  return [...new Set(out.concat(dayIndex === 0 ? official : []))];
}

function sunMoonSection(){
  const moon = moonPhase(new Date());
  const sky = skyEngine();
  const photo = photoWeatherEngine();
  const sr = state.daily.sunrise[0], ss = state.daily.sunset[0];
  const srTime = formatDayTime(sr), ssTime = formatDayTime(ss);
  const daylight = formatDuration(state.daily.daylight_duration?.[0]);
  const morningGold = `${srTime}-${addMinutesText(sr,45)}`;
  const eveningGold = `${addMinutesText(ss,-47)}-${ssTime}`;
  const twilight = `${addMinutesText(sr,-40)}-${addMinutesText(ss,40)}`;
  const moonTimes = moonTimesForToday();
  return `<div class="card sun-moon-card"><div class="card-title">${icon('sunrise',true,13)} Zon en maan</div>
    <div class="sun-moon-layout">
      <div class="sun-panel">
        ${sunArcCard(sr, ss)}
        <div class="sun-moon-metrics">
          ${astroMetric('Zonsopkomst', srTime)}
          ${astroMetric('Zonsondergang', ssTime)}
          ${astroMetric('Daglengte', daylight)}
          ${astroMetric('Gouden uur', `${morningGold} · ${eveningGold}`)}
          ${astroMetric('Burgerlijke schemering', twilight)}
        </div>
      </div>
      <div class="moon-panel">
        <div class="moon-phase-row">
          ${moonVisual(moon)}
          <div><strong>${moon.name}</strong><span>${Math.round(moon.illumination*100)}% verlicht</span></div>
        </div>
        <div class="sun-moon-metrics moon-metrics">
          ${astroMetric('Maanopkomst', moonTimes.rise)}
          ${astroMetric('Maanondergang', moonTimes.set)}
          ${astroMetric('Volgende volle maan', `${moon.daysToFull} dagen`)}
        </div>
      </div>
    </div>
  </div>
  ${skySectionCard(sky)}
  ${photoWeatherCard(photo)}`;
}

function astroMetric(label, value){
  return `<div class="sun-metric"><span class="metric-label">${label}</span><strong class="metric-value">${value || '-'}</strong></div>`;
}

function metricListCard(rows, extraClass=''){
  return `<div class="metric-list-card ${extraClass}">
    ${rows.map(row=>`<div class="metric-row">
      <span>${esc(row.label)}</span>
      <b>${row.html ? row.value : esc(String(row.value ?? '-'))}</b>
      ${row.sub ? `<small>${esc(row.sub)}</small>` : ''}
    </div>`).join('')}
  </div>`;
}

function skySectionCard(sky){
  const raining=nowcastEngine()?.status==='raining';
  const poor=sky.cloud>=85 || raining || (sky.visibility && sky.visibility<4000);
  const headline=poor ? 'Sterrenkijken afgeraden' : sky.stargazing>=70 ? 'Goede omstandigheden voor sterrenkijken' : 'Matige omstandigheden voor sterrenkijken';
  const sub=sky.cloud>=85 ? 'Volledig of vrijwel volledig bewolkt' : raining ? 'Neerslag beperkt het zicht op de hemel' : `${Math.round(sky.cloud)}% bewolking`;
  return `<div class="card sky-card sky-card-v2">
    <div class="card-title">${icon('eye',true,13)} Wheaterflow Sky</div>
    <div class="sky-context-head ${poor?'poor':'good'}"><strong>${esc(headline)}</strong><span>${esc(sub)}</span></div>
    ${metricListCard([
      {label:'Sterrenkijk-score', value:`${sky.stargazing}/100 · ${sky.stargazingLabel}`},
      {label:'Bewolking', value:`${Math.round(sky.cloud)}%`},
      {label:'Zicht', value:sky.visibility ? (sky.visibility/1000).toFixed(1)+' km' : '-'},
      {label:'Maan', value:`${Math.round(sky.moon.illumination*100)}%`},
      {label:'Melkweg', value:sky.milkyWayChance},
      ...(sky.auroraChance && !/nog geen data/i.test(sky.auroraChance) ? [{label:'Aurora',value:sky.auroraChance}] : [])
    ])}
  </div>`;
}

function photoWeatherCard(photo){
  const best = photo.best;
  const cur=normalizedWeatherState();
  let context='Rustige algemene omstandigheden';
  if(cur.rainEta?.status==='raining') context='Interessant voor regenfotografie en reflecties';
  else if((cur.cloudCover??0)>=70) context='Sterke wolkenluchten en dramatische landschappen';
  else if((cur.cloudCover??0)>=30) context='Afwisselend licht en interessante wolkenstructuren';
  else context='Helder licht; golden hour is het interessantste moment';
  return `<div class="card photo-weather-card">
    <div class="card-title">${icon('sunrise',true,13)} Fotoweer</div>
    <div class="photo-context"><strong>${esc(context)}</strong>${best?`<span>Beste venster rond ${best.time.toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit'})}</span>`:''}</div>
    ${metricListCard([
      {label:'Fotografie-index', value:best ? `${best.score}/100` : 'Niet beschikbaar'},
      {label:'Golden hour', value:photo.goldenEvening || '-'},
      {label:'Zonsopgang', value:`${photo.sunriseScore}/100`},
      {label:'Zonsondergang', value:`${photo.sunsetScore}/100`},
      {label:'Mistkans', value:`${photo.mistChance}%`},
      {label:'Bewolking', value:photo.highCloud || 'Niet beschikbaar'}
    ])}
  </div>`;
}

function airQualitySection(){
  const a = state.air;
  if(!a) return `<div class="card"><div class="card-title">${icon('cloud',true,13)} Luchtkwaliteit</div>${wheaterflowStatus('empty','Momenteel geen gegevens beschikbaar')}</div>`;
  const rows = [
    ['AQI', 'Europese luchtkwaliteitsindex', a?.european_aqi, '', 100],
    ['PM2.5', 'Fijnstof', a?.pm2_5, 'µg/m³', 50],
    ['PM10', 'Fijnstof', a?.pm10, 'µg/m³', 100],
    ['NO₂', 'Stikstofdioxide', a?.nitrogen_dioxide, 'µg/m³', 100],
    ['O₃', 'Ozon', a?.ozone, 'µg/m³', 180],
    ['CO', 'Koolstofmonoxide', a?.carbon_monoxide, 'µg/m³', 1000]
  ];
  const pollen = Math.max(a?.alder_pollen??0,a?.birch_pollen??0,a?.grass_pollen??0,a?.mugwort_pollen??0,a?.olive_pollen??0,a?.ragweed_pollen??0);
  const aqi = a?.european_aqi;
  const aqStatus = airQualityStatus(aqi);
  const aqTitle = aqi == null ? 'Luchtkwaliteit' : `AQI ${Math.round(aqi)} · ${aqStatus.label}`;
  return `<div class="card"><div class="card-title">${icon('cloud',true,13)} ${aqTitle}</div>
    <div class="aq-hero">
      <div class="aq-ring" style="--aq:${Math.min(100, aqi ?? 0)}"><b>${aqi == null ? '-' : Math.round(aqi)}</b><span>AQI</span></div>
      <div><strong>${aqStatus.label}</strong><p>${a ? airSummary(a.european_aqi, pollen) : 'Luchtkwaliteitsdata is momenteel niet beschikbaar.'}</p></div>
    </div>
    <div class="aq-grid">${rows.map(([n,label,v,unit,max])=>aqRow(n,label,v,unit,max)).join('')}${aqRow('Pollen', 'Indicatie', pollen || null, '', 100)}</div>
  </div>`;
}

function aqRow(name, label, value, unit, max){
  if(value==null) return `<div class="aq-row unavailable"><span><b>${name}</b><small>${label}</small></span><strong>Nog geen data</strong></div>`;
  const pct = Math.min(100, (value/max)*100);
  const status = name === 'Pollen' ? pollenStatus(value) : pollutantStatus(name, value);
  const display = name === 'Pollen' ? status.value : `${Math.round(value)}${unit ? ' ' + unit : ''}`;
  return `<div class="aq-row ${status.cls}">
    <span><b>${name}</b><small>${label}</small></span>
    <strong>${display}<em>${status.label}</em></strong>
    <i><em style="width:${pct}%"></em></i>
  </div>`;
}

function airQualityStatus(aqi){
  if(aqi == null) return {label:'Onbekend', cls:'unknown'};
  if(aqi <= 20) return {label:'Zeer goed', cls:'good'};
  if(aqi <= 40) return {label:'Goed', cls:'good'};
  if(aqi <= 60) return {label:'Matig', cls:'moderate'};
  if(aqi <= 80) return {label:'Slecht', cls:'bad'};
  if(aqi <= 100) return {label:'Zeer slecht', cls:'bad'};
  return {label:'Extreem slecht', cls:'bad'};
}

function pollutantStatus(name, value){
  const limits = {
    'AQI':[20,40,60,80],
    'PM2.5':[5,15,25,50],
    'PM10':[15,45,80,120],
    'NO₂':[10,25,50,100],
    'O₃':[60,100,140,180],
    'CO':[200,500,1000,2000]
  }[name] || [20,40,60,80];
  if(value <= limits[0]) return {label:'Goed', cls:'good'};
  if(value <= limits[1]) return {label:'Prima', cls:'good'};
  if(value <= limits[2]) return {label:'Matig', cls:'moderate'};
  if(value <= limits[3]) return {label:'Hoog', cls:'bad'};
  return {label:'Zeer hoog', cls:'bad'};
}

function pollenStatus(value){
  if(value < 10) return {label:'Laag', value:'laag', cls:'good'};
  if(value < 50) return {label:'Matig', value:'matig', cls:'moderate'};
  return {label:'Hoog', value:'hoog', cls:'bad'};
}

function airSummary(aqi, pollen){
  if(aqi == null) return 'Algemene luchtkwaliteitsindex niet beschikbaar.';
  const status = airQualityStatus(aqi).label.toLowerCase();
  return `De luchtkwaliteit is ${status}.${pollen>50?' De pollenconcentratie is verhoogd.':' Buitenactiviteiten zijn normaal mogelijk.'}`;
}

function seaModePracticalAdvice(sea){
  const parts=[];
  const wind=validNumber(sea?.wind), gust=validNumber(sea?.gust), wave=validNumber(sea?.waveHeight), rain=validNumber(sea?.rain);
  if(wave!=null) parts.push(wave>=1.5?'De zee is ruw':wave>=0.8?'De zee is vrij onrustig':'De zee is relatief rustig');
  if(wind!=null) parts.push(wind>=35?'er staat stevige wind':wind>=20?'er staat matige wind':'de wind blijft beperkt');
  if(gust!=null && wind!=null && gust>=wind+15) parts.push(`met stoten tot ${Math.round(gust)} km/u`);
  if(rain!=null && rain>=0.2) parts.push('regen kan het zicht en comfort verminderen');
  const caution=(wave!=null&&wave>=1)||(wind!=null&&wind>=30)||(gust!=null&&gust>=45);
  return `${parts.length?parts.join(', '):'De actuele kustgegevens zijn beperkt'}. ${caution?'Voorzichtigheid bij het zwemmen is aangeraden.':'De omstandigheden zijn redelijk voor een bezoek aan het strand.'}`;
}

function coastSection(){
  const sea=seaEngine();
  if(!sea.available) return `<div class="card sea-mode-card"><div class="card-title">${icon('drop',true,13)} Sea Mode</div>${wheaterflowStatus('empty',sea.reason||'Momenteel geen gegevens beschikbaar')}</div>`;
  state.sharedWeather.marine={seaTemperature:sea.seaTemperature,waveHeight:sea.waveHeight,wavePeriod:sea.wavePeriod,wind:sea.wind,gust:sea.gust,visibility:sea.visibility,tide:sea.tide,uv:sea.uv,updated:state.lastUpdated};
  const tide=sea.tide;
  const item=(label,value,ic='gauge')=> value==null||value==='-' ? '' : `<div class="sea-compact-item">${icon(ic,true,18)}<span>${esc(label)}</span><b>${esc(value)}</b></div>`;
  return `<div class="card sea-mode-card sea-mode-compact"><div class="card-title">${icon('drop',true,13)} Sea Mode</div><div class="sea-reference">Zeegegevens · ${esc(sea.place)}</div>
    <div class="sea-score-grid"><div><span>Strandscore</span><b>${sea.beachScore}</b><small>${esc(sea.beachLabel)}</small></div><div><span>Zwemcomfort</span><b>${sea.swimScore}</b><small>${esc(sea.swimComfort)}</small></div></div>
    <div class="sea-compact-grid">
      ${item('Zeewater',validNumber(sea.seaTemperature)==null?null:`${sea.seaTemperature.toFixed(1)} °C`,'thermo')}
      ${item('Golfhoogte',validNumber(sea.waveHeight)==null?null:`${sea.waveHeight.toFixed(1)} m`,'drop')}
      ${item('Golfperiode',validNumber(sea.wavePeriod)==null?null:`${sea.wavePeriod.toFixed(1)} s`,'gauge')}
      ${item('Wind',validNumber(sea.wind)==null?null:formatWindPair(sea.wind,sea.gust),'wind')}
      ${item('Getij',tide?.state||null,'drop')}
      ${item('Volgend hoogwater',tide?.nextTime ? new Date(tide.nextTime.getTime() + (tide.nextType==='hoogwater'?0:(6*3600+12.5*60)*1000)).toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit'}) : null,'gauge')}
      ${item('UV-index',validNumber(sea.uv)==null?null:String(Math.round(sea.uv)),'uv')}
      ${item('Zicht',validNumber(sea.visibility)==null?null:`${(sea.visibility/1000).toFixed(1)} km`,'eye')}
    </div>
    <div class="sea-advice-compact"><b>Advies</b><span>${esc(seaModePracticalAdvice(sea))}</span></div>
    ${seaSparkCoastPanel()}
  </div>`;
}

function seaSparkDetailCard(){
  if(!state.seaspark) return '';
  const s = state.seaspark;
  return `<div class="detail-card wide seaspark-card">
    <div class="dt-title">${icon('drop',true,12)} Zeevonk</div>
    <div class="seaspark-main">
      <div class="seaspark-ring" style="--score:${s.score}"><b>${Math.round(s.score)}/100</b></div>
      <div>
        <div class="dt-val mono">${esc(s.level)} kans</div>
        <div class="dt-sub">${seaSparkBestTimeText(s)} - ${esc(s.place)}</div>
      </div>
    </div>
  </div>`;
}

function seaSparkCoastPanel(){
  const s=state.seaspark, sea=seaEngine();
  if(!s || !sea.available) return '';
  const essentials=[sea.seaTemperature,sea.wind,sea.waveHeight].filter(v=>validNumber(v)!=null);
  if(essentials.length<2) return '';
  const score=clamp(Math.round(Number(s.score)||0));
  const level=score>=65?'Hoge':score>=40?'Matige':'Lage';
  const cloud=validNumber(s.cloud);
  const best=s.bestTime ? new Date(s.bestTime) : null;
  const bestWindow=best&&Number.isFinite(best.getTime()) ? `${new Date(best.getTime()-30*60000).toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit'})}–${new Date(best.getTime()+60*60000).toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit'})}` : 'Na volledige duisternis';
  return `<div class="seaspark-panel seaspark-v2">
    <div class="seaspark-head"><div><div class="card-title">${icon('drop',true,13)} Zeevonk</div><h3>${level} kans op zeevonk</h3></div><div class="seaspark-score-wrap"><div class="seaspark-ring" style="--score:${score}"><b>${score}/100</b></div><small>Indicatieve score</small></div></div>
    <div class="seaspark-shared-grid"><span><small>Beste tijdvenster</small><b>${esc(bestWindow)}</b></span><span><small>Locatie</small><b>${esc(sea.place)}</b></span>${cloud!=null?`<span><small>Bewolking</small><b>${Math.round(cloud)}%</b></span>`:''}<span><small>Laatste update</small><b>${new Date(state.lastUpdated||Date.now()).toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit'})}</b></span></div>
    <p>${esc(seaModePracticalAdvice(sea))}</p>
    <div class="sea-safety">Blijf uit gevaarlijke branding en ga niet alleen het water in in het donker.</div>
    <div class="subtle">Indicatief, geen officiële voorspelling.</div>
  </div>`;
}

function seaSparkBestTimeText(s){
  if(!s?.bestTime) return 'Beste moment: na zonsondergang';
  return 'Beste moment rond ' + s.bestTime.toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit'});
}

function seaSparkSummary(s){
  const parts = [];
  if(s.seaTemp != null) parts.push(`zeewater ${s.seaTemp.toFixed(1)} °C`);
  if(s.wind != null) parts.push(`wind ${Math.round(s.wind)} km/u`);
  if(s.wave != null) parts.push(`golfhoogte ${s.wave.toFixed(1)} m`);
  const basis = parts.length ? parts.join(', ') : 'beperkte kustdata';
  return `${s.level} indicatie op basis van ${basis}. ${seaSparkBestTimeText(s)}.`;
}

function travelWeatherSection(){
  return `<div class="card travel-weather-card"><div class="card-title">${icon('wind',true,13)} Reisweer</div>
    <div class="travel-form travel-form-v2">
      <label><span>${icon('gauge',true,16)} Vertrekpunt</span><input id="travelFrom" autocomplete="off" placeholder="Bijv. Oostende"></label>
      <button class="travel-swap" id="travelSwap" type="button" aria-label="Vertrekpunt en bestemming omwisselen">⇅ <span>Wissel</span></button>
      <label><span>${icon('gauge',true,16)} Bestemming</span><input id="travelTo" autocomplete="off" placeholder="Bijv. Antwerpen"></label>
      <label class="travel-time"><span>${icon('gauge',true,16)} Vertrektijd</span><div class="travel-time-row"><input id="travelTime" type="datetime-local"><button id="travelNow" type="button">Nu</button></div></label>
      <div class="travel-modes" role="group" aria-label="Vervoer"><button class="active" data-travel-mode="car" type="button">Auto</button><button data-travel-mode="bike" type="button">Fiets</button><button data-travel-mode="walk" type="button">Wandelen</button><button data-travel-mode="transit" type="button">Openbaar vervoer</button></div>
      <div class="travel-validation" id="travelValidation">Vul vertrekpunt en bestemming in.</div>
      <button class="smallbtn travel-calc" id="travelCalculate" type="button" disabled>Routeweer berekenen</button>
    </div>
    <div id="travelResult"></div>
  </div>`;
}
async function travelGeocode(q){
  const r=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=nl&format=json`,{cache:'no-store'});
  if(!r.ok) throw new Error('Plaats zoeken mislukt');
  const x=(await r.json()).results?.[0];
  if(!x) throw new Error(`Plaats niet gevonden: ${q}`);
  return {name:x.name,lat:Number(x.latitude),lon:Number(x.longitude)};
}
async function travelPointWeather(point, when){
  const date=new Date(when);
  const url=`https://api.open-meteo.com/v1/forecast?latitude=${point.lat}&longitude=${point.lon}&hourly=temperature_2m,weather_code,precipitation_probability,wind_speed_10m,wind_gusts_10m&forecast_days=3&timezone=auto`;
  const r=await fetch(url,{cache:'no-store'}); if(!r.ok) throw new Error('Weerdata niet beschikbaar');
  const d=await r.json(); const i=closestIndex(d.hourly.time,date.getTime());
  return {point,time:d.hourly.time[i],temperature:d.hourly.temperature_2m?.[i],code:d.hourly.weather_code?.[i],pop:d.hourly.precipitation_probability?.[i],wind:d.hourly.wind_speed_10m?.[i],gust:d.hourly.wind_gusts_10m?.[i]};
}
function travelResultCard(label,w){
  const info=wcInfo(w.code); return `<div class="travel-result-card"><small>${label}</small><b>${esc(w.point.name)} · ${new Date(w.time).toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit'})}</b><div>${icon(info.ic,true,30)}<strong>${fmtTemp(w.temperature)}</strong><span>${esc(info.l)}</span></div><p>${validNumber(w.pop)!=null?`${Math.round(w.pop)}% regen · `:''}${formatWindPair(w.wind,w.gust)}</p></div>`;
}
function wireTravelWeather(){
  const from=$('#travelFrom'),to=$('#travelTo'),time=$('#travelTime'),calc=$('#travelCalculate'),msg=$('#travelValidation'); if(!from||!to||!calc) return;
  let mode='car', validationTimer=null, validationSeq=0, fromPoint=null, toPoint=null;
  const localNowValue=()=>{ const d=new Date(Date.now()-new Date().getTimezoneOffset()*60000); return d.toISOString().slice(0,16); };
  if(time && !time.value) time.value=localNowValue();
  $('#travelNow')?.addEventListener('click',()=>{ if(time) time.value=localNowValue(); });
  const validate=()=>{
    clearTimeout(validationTimer); fromPoint=null; toPoint=null; calc.disabled=true;
    const a=from.value.trim(), b=to.value.trim();
    if(a.length<2||b.length<2){ msg.textContent='Vul vertrekpunt en bestemming in.'; return; }
    msg.textContent='Plaatsen controleren…';
    const seq=++validationSeq;
    validationTimer=setTimeout(async()=>{
      try{
        const [pa,pb]=await Promise.all([travelGeocode(a),travelGeocode(b)]);
        if(seq!==validationSeq) return;
        fromPoint=pa; toPoint=pb; calc.disabled=false; msg.textContent='Klaar om routeweer te berekenen.';
      }catch(e){ if(seq!==validationSeq) return; calc.disabled=true; msg.textContent='Controleer vertrekpunt en bestemming.'; }
    },350);
  };
  from.addEventListener('input',validate); to.addEventListener('input',validate);
  $('#travelSwap')?.addEventListener('click',()=>{[from.value,to.value]=[to.value,from.value];validate();});
  $$('.travel-modes [data-travel-mode]').forEach(b=>b.addEventListener('click',()=>{$$('.travel-modes [data-travel-mode]').forEach(x=>x.classList.remove('active'));b.classList.add('active');mode=b.dataset.travelMode;}));
  calc.addEventListener('click',async()=>{ const result=$('#travelResult'); result.innerHTML=wheaterflowStatus('loading','Gegevens worden geladen…'); calc.disabled=true; try{ const [a,b]=fromPoint&&toPoint?[fromPoint,toPoint]:await Promise.all([travelGeocode(from.value.trim()),travelGeocode(to.value.trim())]); const start=time.value?new Date(time.value):new Date(); if(!Number.isFinite(start.getTime())) throw new Error('Vertrektijd is ongeldig'); const km=kmDistance(a.lat,a.lon,b.lat,b.lon); const speeds={car:65,bike:17,walk:4.5,transit:45}; const minutes=Math.max(10,Math.round(km/(speeds[mode]||45)*60)); const mid={name:'Onderweg',lat:(a.lat+b.lat)/2,lon:(a.lon+b.lon)/2}; const [wa,wm,wb]=await Promise.all([travelPointWeather(a,start),travelPointWeather(mid,new Date(start.getTime()+minutes*30000)),travelPointWeather(b,new Date(start.getTime()+minutes*60000))]); result.innerHTML=`<div class="travel-result-grid">${travelResultCard('Vertrek',wa)}${travelResultCard('Onderweg',wm)}${travelResultCard('Aankomst',wb)}</div>`; }catch(e){ result.innerHTML=wheaterflowStatus('error',e.message||'Momenteel geen gegevens beschikbaar',{retryId:null}); }finally{calc.disabled=false;} }); validate();
}

function formatOfficialAlertPeriod(alert){
  if(!alert?.validFrom && !alert?.period) return '';
  const from = alert.validFrom ? new Date(alert.validFrom) : null;
  const to = alert.validTo ? new Date(alert.validTo) : null;
  const now = Date.now();
  const hm = d => d.toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit'});
  const day = d => d.toLocaleDateString('nl-BE',{day:'2-digit',month:'2-digit'});
  if(from && Number.isFinite(from.getTime())){
    if(now < from.getTime()){
      const sameDay = new Date().toDateString() === from.toDateString();
      return `${sameDay ? 'Vandaag' : day(from)} vanaf ${hm(from)}${to && Number.isFinite(to.getTime()) ? ` · tot ${day(to)} ${hm(to)}` : ''}`;
    }
    if(to && now <= to.getTime()) return `Nu actief · tot ${day(to)} ${hm(to)}`;
  }
  return alert.period || '';
}

function officialAlertCountdown(alert){
  const now=Date.now();
  const from=alert?.validFrom ? new Date(alert.validFrom).getTime() : NaN;
  const to=alert?.validTo ? new Date(alert.validTo).getTime() : NaN;
  const human=(ms)=>{ const m=Math.max(0,Math.round(ms/60000)); if(m<60) return `${m} min`; const h=Math.floor(m/60), r=m%60; return r ? `${h} u ${r} min` : `${h} u`; };
  if(Number.isFinite(from) && now<from) return `Begint over ${human(from-now)}`;
  if(Number.isFinite(to) && now<=to) return `Nog ${human(to-now)} actief`;
  return '';
}

function alertsCard(){
  const alert = (state.alerts && state.alerts[0]) || buildIndicativeAlert()[0];
  const level = ALERT_LEVELS[alert.level] || ALERT_LEVELS.green;
  const isGreen = alert.level === 'green';
  const official = Boolean(alert.official || state.alertsMeta?.official);
  const title = isGreen ? 'Weermelding' : official ? 'KMI waarschuwing' : 'Wheaterflow Alerts';
  const headline = isGreen ? 'Geen actieve weermelding' : alert.headline || level.title;
  const levelLabel = isGreen || official ? level.label : 'Slim signaal';
  const timing = official ? formatOfficialAlertPeriod(alert) : '';
  const countdown = official ? officialAlertCountdown(alert) : '';

  if(official && !isGreen){
    const phenomenon = esc(alert.phenomenon || String(headline).split('·')[0].trim() || 'Waarschuwing');
    return `<details class="card alert-card official-kmi kmi-compact ${level.cls}">
      <summary class="kmi-summary">
        <span class="kmi-level-rail" aria-hidden="true"></span>
        <span class="kmi-phenomenon-icon">${icon('wind',true,30)}</span>
        <span class="kmi-summary-copy">
          <strong>${phenomenon}</strong>
          <small>${timing || esc(alert.period || '')}</small>
        </span>
        <span class="kmi-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div class="kmi-expanded">
        <div class="kmi-expanded-top">
          <span class="kmi-code-pill">${levelLabel}</span>
          ${countdown ? `<span class="alert-countdown">${esc(countdown)}</span>` : ''}
        </div>
        <div class="alert-title">${esc(headline)}</div>
        ${alert.description ? `<div class="alert-text">${esc(alert.description)}</div>` : ''}
        ${alert.source ? `<div class="alert-source">Bron: ${esc(alert.source)}</div>` : ''}
      </div>
    </details>`;
  }

  return `<div class="card alert-card ${level.cls}">
    <div class="alert-head">
      <div>
        <div class="card-title">${icon('gauge',true,13)} ${title}</div>
        <div class="alert-code">${levelLabel}</div>
      </div>
    </div>
    <div class="alert-title">${esc(headline)}</div>
    ${countdown ? `<div class="alert-countdown">${esc(countdown)}</div>` : ''}
    ${timing ? `<div class="alert-period">${esc(timing)}</div>` : ''}
    ${isGreen ? '' : `<div class="alert-text">${esc(alert.description)}</div>`}
  </div>`;
}

function detailCard(ic, title, val, sub, extraClass=''){
  const className = `detail-card${extraClass ? ' ' + extraClass : ''}`;
  return `<div class="${className}"><div class="dt-title">${icon(ic,true,12)} ${title}</div><div class="dt-val mono">${val}</div><div class="dt-sub">${sub}</div></div>`;
}
function uvLabel(uv){
  if(uv<3) return 'Laag'; if(uv<6) return 'Matig'; if(uv<8) return 'Hoog'; if(uv<11) return 'Zeer hoog'; return 'Extreem';
}

function uvAdvice(uv){
  if(uv<3) return 'Geen bijzondere bescherming nodig.';
  if(uv<6) return 'Smeer je in bij langere tijd buiten.';
  if(uv<8) return 'Bescherm je huid tussen de middag.';
  if(uv<11) return 'Zoek schaduw en gebruik zonnebescherming.';
  return 'Vermijd felle zon rond de middag.';
}

/* ---------------- rich widgets: compass, gauge, uv bar, sun arc, moon ---------------- */
function windCompassCard(speed, gust, dir){
  const d = dir ?? 0;
  return `<div class="detail-card wide">
    <div class="dt-title">${icon('wind',true,12)} Wind</div>
    <div class="compass-row">
      <div>
        <div class="dt-val mono">${fmtWind(speed)}</div>
        <div class="dt-sub">Stoten ${fmtWind(gust)}</div>
      </div>
      <div class="compass">
        <div class="cdir n">N</div><div class="cdir o">O</div><div class="cdir z">Z</div><div class="cdir w">W</div>
        <div class="needle" style="transform:translate(-50%,-100%) rotate(${d}deg);"></div>
        <div class="chub"></div>
      </div>
    </div>
  </div>`;
}
function pressureGaugeCard(hpa){
  const min=970, max=1050;
  const clamped = Math.min(max, Math.max(min, hpa));
  const frac = (clamped-min)/(max-min); // 0..1
  const angle = -90 + frac*180; // -90(laag) .. +90(hoog)
  return `<div class="detail-card wide">
    <div class="dt-title">${icon('thermo',true,12)} Luchtdruk</div>
    <div class="gauge-row">
      <div class="semigauge">
        <svg viewBox="0 0 100 55">
          <path d="M5,52 A45,45 0 0,1 95,52" fill="none" stroke="#182543" stroke-width="7" stroke-linecap="round"/>
          <path d="M5,52 A45,45 0 0,1 95,52" fill="none" stroke="url(#pg)" stroke-width="7" stroke-linecap="round" stroke-dasharray="141.4" stroke-dashoffset="${141.4 - frac*141.4}"/>
          <defs><linearGradient id="pg" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#35d0c4"/><stop offset="100%" stop-color="#f5a524"/></linearGradient></defs>
          <line x1="50" y1="52" x2="50" y2="16" stroke="#e9eefb" stroke-width="2.5" stroke-linecap="round" transform="rotate(${angle} 50 52)"/>
          <circle cx="50" cy="52" r="3.5" fill="#e9eefb"/>
        </svg>
      </div>
      <div>
        <div class="dt-val mono">${fmtPress(hpa)}</div>
        <div class="dt-sub">${hpa>1013?'Hogedrukgebied':'Lagedrukgebied'}</div>
      </div>
    </div>
    <div class="gauge-labels"><span>Laag</span><span>Hoog</span></div>
  </div>`;
}
function uvBarCard(uv){
  const pct = Math.min(100, (uv/11)*100);
  return `<div class="detail-card">
    <div class="dt-title">${icon('uv',true,12)} UV-index</div>
    <div class="dt-val mono">${Math.round(uv)} <span style="font-size:14px;color:var(--dim);font-weight:600;">${uvLabel(uv)}</span></div>
    <div class="uvbar"><div class="uvdot" style="left:${pct}%;"></div></div>
    <div class="dt-sub">${uvAdvice(uv)}</div>
  </div>`;
}
function sunArcCard(sunrise, sunset){
  const toMin = t => { const [h,m] = t.slice(11,16).split(':').map(Number); return h*60+m; };
  const srMin = toMin(sunrise), ssMin = toMin(sunset);
  const nowLocal = new Date();
  const nowMin = nowLocal.getHours()*60 + nowLocal.getMinutes();
  let frac = (nowMin - srMin) / (ssMin - srMin);
  const isNight = frac < 0 || frac > 1;
  frac = Math.min(1, Math.max(0, frac));
  const progress = frac.toFixed(4);
  return `<div class="sun-path">
      <svg viewBox="0 0 100 84" role="img" aria-label="Zonnetraject" data-sun-progress="${progress}">
        <path class="sun-path-base" d="M8,78 C24,24 76,24 92,78" fill="none"/>
        <path class="sun-path-line" d="M8,78 C24,24 76,24 92,78" fill="none"/>
        <line class="sun-horizon" x1="5" x2="95" y1="78" y2="78"/>
        ${!isNight ? `<circle class="sun-position" cx="8" cy="78" r="4.8"/>` : '<circle class="sun-position night" cx="50" cy="82" r="3.4"/>'}
      </svg>
    </div>`;
}

function sunArcDetailCard(sunrise, sunset){
  return `<div class="detail-card wide">
    <div class="dt-title">${icon('sunrise',true,12)} Zon op / onder</div>
    ${sunArcCard(sunrise, sunset)}
    <div class="sunarc-labels"><span>${formatDayTime(sunrise)}</span><span>${formatDayTime(sunset)}</span></div>
  </div>`;
}

function compactAirQualityCard(){
  const a = state.air;
  const aqi = Number(a?.european_aqi);
  if(!Number.isFinite(aqi)) return '';
  const label = airQualityStatus(aqi).label;
  return `<div class="card compact-aq-card">
    <h3>AQI ${Math.round(aqi)} · ${label}</h3>
    <div class="aq-strip"><i style="left:${Math.min(100, Math.max(0, aqi))}%"></i></div>
    <p>${esc(airSummary(aqi, Math.max(a?.alder_pollen??0,a?.birch_pollen??0,a?.grass_pollen??0,a?.mugwort_pollen??0,a?.olive_pollen??0,a?.ragweed_pollen??0)))}</p>
  </div>`;
}

function moonVisual(moon){
  return `<img class="premium-moon moon-photo" src="${moonImageForPhase(moon)}" alt="${esc(moon.name)}">`;
}

function moonImageForPhase(moon){
  const p = Number(moon?.phase || 0);
  if(p < 0.03 || p > 0.97) return 'assets/moon/new-moon.jpg';
  if(p < 0.14) return 'assets/moon/young-crescent.jpg';
  if(p < 0.28) return 'assets/moon/first-quarter.jpg';
  if(p < 0.47) return 'assets/moon/waxing-moon.jpg';
  if(p < 0.53) return 'assets/moon/full-moon.jpg';
  if(p < 0.72) return 'assets/moon/waning-moon.jpg';
  if(p < 0.84) return 'assets/moon/last-quarter.jpg';
  return 'assets/moon/earthshine-moon.jpg';
}

function moonTimesForToday(){
  try{
    if(!window.SunCalc || !state.loc) return {rise:'-', set:'-'};
    const mt = window.SunCalc.getMoonTimes(new Date(), state.loc.lat, state.loc.lon);
    return {
      rise: mt.rise ? mt.rise.toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit'}) : '-',
      set: mt.set ? mt.set.toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit'}) : '-'
    };
  }catch(e){
    return {rise:'-', set:'-'};
  }
}

function addMinutesText(value, minutes){
  if(!value) return '-';
  const d = new Date(value);
  if(Number.isNaN(d.getTime())) return '-';
  d.setMinutes(d.getMinutes() + minutes);
  return d.toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit'});
}

function formatDuration(seconds){
  if(seconds == null || !isFinite(seconds)) return '-';
  const mins = Math.round(seconds / 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h} u ${m} min`;
}

function positionSunPaths(){
  $$('.sun-path svg').forEach(svg=>{
    const path = $('.sun-path-line', svg);
    const dot = $('.sun-position', svg);
    if(!path || !dot || dot.classList.contains('night')) return;
    const progress = Math.min(1, Math.max(0, Number(svg.dataset.sunProgress || 0)));
    try{
      const len = path.getTotalLength();
      const point = path.getPointAtLength(len * progress);
      dot.setAttribute('cx', point.x.toFixed(2));
      dot.setAttribute('cy', point.y.toFixed(2));
    }catch(e){}
  });
}
function moonCard(moon){
  const illumPct = Math.round(moon.illumination*100);
  return `<div class="detail-card wide">
    <div class="dt-title">${icon('cloud',true,12)} Asgrauwe maan</div>
    <div class="moon-row">
      <img class="moonvisual moon-photo" src="${moonImageForPhase(moon)}" alt="${esc(moon.name)}">
      <div style="flex:1;">
        <div class="moonline"><span>Verlichting</span><b>${illumPct}%</b></div>
        <div class="moonline"><span>Fase</span><b>${moon.name}</b></div>
        <div class="moonline"><span>Volgende volle maan</span><b>${moon.daysToFull} dagen</b></div>
      </div>
    </div>
  </div>`;
}
function moonPhase(date){
  const synodic = 29.53058867;
  const knownNewMoon = Date.UTC(2000,0,6,18,14,0);
  const diffDays = (date.getTime() - knownNewMoon) / 86400000;
  let phase = (diffDays % synodic) / synodic;
  if(phase < 0) phase += 1;
  const illumination = (1 - Math.cos(2*Math.PI*phase))/2;
  let name;
  if(phase < 0.03 || phase > 0.97) name='Nieuwe maan';
  else if(phase < 0.22) name='Wassende sikkel';
  else if(phase < 0.28) name='Eerste kwartier';
  else if(phase < 0.47) name='Wassende maan';
  else if(phase < 0.53) name='Volle maan';
  else if(phase < 0.72) name='Afnemende maan';
  else if(phase < 0.78) name='Laatste kwartier';
  else name='Afnemende sikkel';
  const daysToFull = Math.round(((0.5 - phase + 1) % 1) * synodic);
  return {phase, illumination, name, daysToFull};
}

// iOS/PWA mag een oude scrollpositie niet opnieuw bovenop de home-layout zetten.
// Binnen een actieve sessie blijft normaal scrollen gewoon behouden.
try{
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
}catch(e){}

let wheaterflowHiddenAt = 0;
function homeIsActive(){
  return state.activeTab === 'home' || document.querySelector('#home')?.classList.contains('active');
}
function resetHomeScroll({force=false}={}){
  if(!homeIsActive()) return;
  const y = window.scrollY || document.documentElement.scrollTop || 0;
  // Bij app-open/herstel altijd bovenaan. Zonder force alleen de typische
  // iOS-restpositie corrigeren waarbij de bovenste knoppen uit beeld vallen.
  if(force || (y > 70 && y < 520)) window.scrollTo({top:0, left:0, behavior:'auto'});
}
window.addEventListener('pageshow', (event)=>{
  requestAnimationFrame(()=>resetHomeScroll({force:event.persisted || !sessionStorage.getItem('wf-page-shown')}));
  sessionStorage.setItem('wf-page-shown','1');
});
document.addEventListener('visibilitychange', ()=>{
  if(document.hidden){
    wheaterflowHiddenAt = Date.now();
    return;
  }
  const hiddenFor = wheaterflowHiddenAt ? Date.now() - wheaterflowHiddenAt : 0;
  // Een echte terugkeer naar de app start op Vandaag bovenaan; een korte
  // Control Center/notificatie-onderbreking laat de leespositie ongemoeid.
  if(hiddenFor > 15000) requestAnimationFrame(()=>resetHomeScroll({force:true}));
});

/* ---------------- tabs ---------------- */
$$('.tabbtn').forEach(btn=>{
  btn.addEventListener('click', async ()=>{
    if(btn.dataset.tab === 'profile'){
      openAuthSheet();
      return;
    }
    $$('.tabbtn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    $$('.screen').forEach(s=>s.classList.remove('active'));
    $('#'+btn.dataset.tab).classList.add('active');
    state.activeTab = btn.dataset.tab;
    if(btn.dataset.tab === 'home' && btn.dataset.section){
      const target = btn.dataset.section;
      const moreTarget = btn.dataset.moreTarget;
      setTimeout(()=>{
        if(moreTarget){
          document.querySelector(`#moreWeatherTabs [data-more-tab="${moreTarget}"]`)?.click();
        }
        const el = document.querySelector(target);
        if(target === '#sec0') window.scrollTo({top:0, left:0, behavior:'auto'});
        else el?.scrollIntoView({behavior:'smooth', block:'start'});
      }, 80);
    }
    if(btn.dataset.tab === 'radarscreen') await activateRadarScreen();
    if(btn.dataset.tab === 'communityscreen'){
      loadCommunityPosts(true);
      subscribeCommunityRealtime();
      if(state.community.view === 'map') setTimeout(initCommunityMap,150);
    }
    if(btn.dataset.tab === 'stormscreen'){ updateStormTab(); }
  });
});
$('.scopebadge')?.addEventListener?.('click', ()=>{});

/* ---------------- settings sheet ---------------- */
let lockedScrollY = 0;
let pageScrollLocked = false;
function lockPageScroll(){
  if(pageScrollLocked) return;
  lockedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
  document.body.style.position = 'fixed';
  document.body.style.top = `-${lockedScrollY}px`;
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.width = '100%';
  pageScrollLocked = true;
}
function unlockPageScroll(){
  if(!pageScrollLocked) return;
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.width = '';
  pageScrollLocked = false;
  window.scrollTo(0, lockedScrollY);
}
function openSheet(){
  lockPageScroll();
  document.body.classList.add('settings-open');
  $('#settingsSheet').classList.add('show');
  $('#scrim').classList.add('show');
}
function closeSheet(){
  $('#settingsSheet').classList.remove('show');
  $('#scrim').classList.remove('show');
  document.body.classList.remove('settings-open');
  unlockPageScroll();
}
$('#closeSheet').addEventListener('click', closeSheet);
$('#openSheetBtn').addEventListener('click', openSheet);
$('#scrim').addEventListener('click', closeSheet);
$('#dayScrim')?.addEventListener('click', closeDayDetail);

let authHistoryOpen = false;
function syncProfileWeatherBackground(){
  const sheet = $('#authSheet');
  if(!sheet) return;
  const rootPhoto = document.documentElement.style.getPropertyValue('--weather-photo')
    || document.body?.style?.getPropertyValue('--weather-photo')
    || getComputedStyle(document.documentElement).getPropertyValue('--weather-photo');
  if(rootPhoto && rootPhoto.trim()) sheet.style.setProperty('--profile-weather-photo', rootPhoto.trim());
}

function openAuthSheet(){
  syncProfileWeatherBackground();
  lockPageScroll();
  $('#authSheet')?.classList.add('show');
  $('#authScrim')?.classList.add('show');
  document.body.classList.add('auth-open');
  updateAuthInterface(state.auth.session);
  if(!authHistoryOpen){
    history.pushState({weerscoopProfile:true}, '', location.href);
    authHistoryOpen = true;
  }
  setTimeout(()=>$('#closeAuthSheet')?.focus(), 60);
}
function closeAuthSheet(options={}){
  $('#authSheet')?.classList.remove('show');
  $('#authScrim')?.classList.remove('show');
  document.body.classList.remove('auth-open');
  unlockPageScroll();
  $('#profileBtn')?.focus();
  if(authHistoryOpen && !options.fromPopState){
    authHistoryOpen = false;
    history.back();
  }else if(options.fromPopState){
    authHistoryOpen = false;
  }
}
function userInitials(name='', email=''){
  const source = name || email || '?';
  const parts = source.trim().split(/\s+/).filter(Boolean);
  if(parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0,2).toUpperCase();
}
function setAuthMode(mode){
  const login = mode !== 'signup';
  $('#authLoginTab')?.classList.toggle('active', login);
  $('#authSignupTab')?.classList.toggle('active', !login);
  $('#loginForm')?.classList.toggle('hidden', !login);
  $('#signupForm')?.classList.toggle('hidden', login);
  updateAuthMessage('');
}
function updateAuthMessage(msg, type=''){
  const el = $('#authMessage');
  if(!el) return;
  el.textContent = msg || '';
  el.className = 'auth-message' + (type ? ' ' + type : '');
}
function updateProfileMessage(msg, type=''){
  const el = $('#profileMessage');
  if(!el) return;
  el.textContent = msg || '';
  el.className = 'auth-message' + (type ? ' ' + type : '');
}
function dutchAuthError(error){
  const msg = String(error?.message || error || '').toLowerCase();
  if(msg.includes('invalid login') || msg.includes('invalid credentials') || msg.includes('ongeldige login')) return 'E-mailadres of wachtwoord is onjuist.';
  if(msg.includes('already registered') || msg.includes('already been registered') || msg.includes('bestaat al') || msg.includes('in gebruik')) return 'Dit e-mailadres of deze gebruikersnaam is al in gebruik.';
  if(msg.includes('password')) return 'Controleer je wachtwoord. Het moet minstens 8 tekens bevatten.';
  if(msg.includes('email')) return 'Vul een geldig e-mailadres in.';
  if(msg.includes('network') || msg.includes('fetch')) return 'Er kon geen verbinding worden gemaakt. Probeer het later opnieuw.';
  return 'Er ging iets mis. Probeer het later opnieuw.';
}
function updateAuthInterface(session){
  const loggedIn = Boolean(session?.user);
  updateAuthMessage('');
  $('#authLoggedOut')?.classList.toggle('hidden', loggedIn);
  $('#authLoggedIn')?.classList.toggle('hidden', !loggedIn);
  $('#authSheet')?.classList.toggle('profile-mode', loggedIn);
  const profile = state.auth.profile;
  const email = session?.user?.email || '';
  const displayName = profile?.display_name || session?.user?.user_metadata?.display_name || email.split('@')[0] || 'Gast';
  const initials = userInitials(displayName, email);
  const avatarUrl = profile?.avatar_url || '';
  const mini = $('#profileAvatarMini');
  if(mini){
    mini.innerHTML = avatarUrl ? `<img src="${esc(avatarUrl)}" alt="">` : esc(initials);
  }
  $('#profileBtn')?.setAttribute('aria-label', loggedIn ? `Profiel openen van ${displayName}` : 'Inloggen of profiel openen');
  $('#profileBtn')?.setAttribute('title', loggedIn ? displayName : 'Inloggen');
  if($('#profileName')) $('#profileName').textContent = displayName;
  if($('#profileEmail')) $('#profileEmail').textContent = email;
  const homeName = profile?.home_location_name || locationDisplayName('Locatie bepalen…');
  if($('#profileHomeSummary')) $('#profileHomeSummary').textContent = homeName;
  if($('#profileDisplayName')) $('#profileDisplayName').value = profile?.display_name || displayName;
  if($('#profileHomeLocation')) $('#profileHomeLocation').value = homeName;
  if($('#profileFavoritesCount')) $('#profileFavoritesCount').textContent = state.favorites.length;
  const notifications = state.push.status === 'Ingeschakeld' ? 'Aan' : 'Uit';
  const enabledNotificationCount = Object.values(state.push.preferences || {}).filter(Boolean).length;
  if($('#profileNotificationsStatus')) $('#profileNotificationsStatus').textContent = String(enabledNotificationCount);
  if($('#profileNotificationsRowStatus')) $('#profileNotificationsRowStatus').textContent = `${notifications} ›`;
  const tvStatus = state.tvPairing.connected ? 'Gekoppeld' : 'Niet gekoppeld';
  if($('#profileTvStatus')) $('#profileTvStatus').textContent = tvStatus;
  if($('#profileTvRowStatus')) $('#profileTvRowStatus').textContent = `${tvStatus} ›`;
  if($('#profileCurrentLocationName')) $('#profileCurrentLocationName').textContent = 'Tik om GPS te bepalen';
  if($('#profileSyncStatus')) $('#profileSyncStatus').textContent = loggedIn ? 'Actief' : 'Gast';
  renderProfileWeatherToday();
  renderProfileFavorites();
  if($('#profileAvatarInitials')) $('#profileAvatarInitials').textContent = initials;
  $('#profileAvatarImage')?.classList.toggle('hidden', !avatarUrl);
  if($('#profileAvatarImage') && avatarUrl) $('#profileAvatarImage').src = avatarUrl;
  if($('#authSubtitle')) $('#authSubtitle').textContent = loggedIn ? 'Verbonden met je eigen Wheaterflow-server.' : 'Log in via je eigen Wheaterflow-server.';
}
function renderProfileFavorites(){
  const list = $('#profileFavoritesList');
  if(!list) return;
  if(!state.favorites.length){
    list.innerHTML = '<div class="profile-empty">Nog geen favoriete plaatsen. Zoek hierboven een plaats en tik op +.</div>';
    return;
  }
  list.innerHTML = state.favorites.map((f,i)=>`
    <div class="profile-favorite-row" data-i="${i}">
      <span class="profile-favorite-pin">⌖</span>
      <span class="profile-favorite-copy"><b>${esc(f.name)}</b><small>${esc(f.admin || f.country || 'Opgeslagen plaats')}</small></span>
      <button type="button" data-act="open" title="Openen">Open</button>
      <button type="button" data-act="delete" title="Verwijderen">×</button>
    </div>
  `).join('');
}
async function handleProfileFavoriteAction(target){
  const row = target.closest('.profile-favorite-row');
  if(!row) return;
  const i = +row.dataset.i;
  const act = target.dataset.act;
  const fav = state.favorites[i];
  if(!fav) return;
  if(act === 'open'){
    await setLocation(fav.lat, fav.lon, fav.name, fav.admin, fav.country || '', 'manual');
    closeAuthSheet();
  }else if(act === 'up' && i > 0){
    [state.favorites[i-1], state.favorites[i]] = [state.favorites[i], state.favorites[i-1]];
    await saveFavorites();
    renderProfileFavorites();
    renderFavChips();
    updateAuthInterface(state.auth.session);
  }else if(act === 'delete'){
    state.favorites.splice(i,1);
    await saveFavorites();
    renderProfileFavorites();
    renderFavChips();
    updateAuthInterface(state.auth.session);
  }
}

function renderProfileWeatherToday(){
  const cur = state.current || {};
  const code = effectiveCurrentWeatherCode(cur);
  const info = wcInfo(code);
  const temp = Number(cur.temperature_2m);
  const label = info?.l || 'Weer';
  const rain = Number(cur.precipitation || cur.rain || cur.showers || 0);
  const wind = Number(cur.wind_speed_10m || 0);
  if($('#profileWeatherTemp')) $('#profileWeatherTemp').textContent = Number.isFinite(temp) ? `${Math.round(temp)}°` : '--°';
  if($('#profileWeatherLabel')) $('#profileWeatherLabel').textContent = label;
  if($('#profileWeatherIcon')) $('#profileWeatherIcon').innerHTML = icon(info?.ic || 'cloud', true, 76);
  let advice = 'Bekijk je actuele weer voor vandaag.';
  if(rain > .1 || [51,53,55,61,63,65,80,81,82,95,96,99].includes(Number(code))) advice = 'Neem voor de zekerheid een paraplu mee.';
  else if(Number.isFinite(temp) && temp >= 25) advice = 'Warm weer: drink voldoende en zoek af en toe schaduw.';
  else if(wind >= 50) advice = 'Het waait stevig. Hou rekening met sterke wind.';
  else if(Number.isFinite(temp) && temp <= 5) advice = 'Fris buiten: een warme jas komt van pas.';
  else advice = 'Een prima moment om je planning op het weer af te stemmen.';
  if($('#profileWeatherAdvice')) $('#profileWeatherAdvice').textContent = advice;
}

let profileFavoriteSearchTimer = null;
async function searchProfileFavorites(query){
  const box = $('#profileFavoriteSuggestions');
  if(!box) return;
  const q = String(query || '').trim();
  if(q.length < 2){ box.innerHTML=''; box.classList.remove('show'); return; }
  box.innerHTML = '<div class="profile-favorite-loading">Plaatsen zoeken…</div>';
  box.classList.add('show');
  try{
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=nl&format=json`);
    if(!r.ok) throw new Error(`Zoeken ${r.status}`);
    const data = await r.json();
    const results = data.results || [];
    if(!results.length){ box.innerHTML='<div class="profile-favorite-loading">Geen plaatsen gevonden.</div>'; return; }
    box.innerHTML = results.map((res,i)=>`
      <button type="button" class="profile-favorite-suggestion" data-fav-search-i="${i}">
        <span><b>${esc(res.name)}</b><small>${esc([res.admin1,res.country].filter(Boolean).join(', '))}</small></span>
        <strong>+</strong>
      </button>`).join('');
    $$('[data-fav-search-i]', box).forEach(btn=>btn.addEventListener('click', async ()=>{
      const res = results[Number(btn.dataset.favSearchI)];
      if(!res) return;
      await addProfileFavorite({
        name:res.name,
        lat:Number(res.latitude),
        lon:Number(res.longitude),
        admin:[res.admin1,res.country].filter(Boolean).join(', '),
        country:res.country || ''
      });
      const input = $('#profileFavoriteSearch');
      if(input) input.value='';
      box.innerHTML=''; box.classList.remove('show');
    }));
  }catch(error){
    console.warn('Favoriete plaats zoeken mislukt', error);
    box.innerHTML='<div class="profile-favorite-loading">Zoeken mislukt. Probeer opnieuw.</div>';
  }
}

async function addProfileFavorite(place){
  const lat=Number(place?.lat), lon=Number(place?.lon);
  if(!Number.isFinite(lat) || !Number.isFinite(lon)) return;
  const duplicate = state.favorites.some(f=>Math.abs(Number(f.lat)-lat)<.01 && Math.abs(Number(f.lon)-lon)<.01);
  if(duplicate){ toast(`${place.name || 'Deze plaats'} staat al bij je favorieten.`); return; }
  state.favorites.push({
    id:place.id || `local-${Date.now()}`,
    name:place.name || 'Favoriet', lat, lon,
    admin:place.admin || '', country:place.country || ''
  });
  await saveFavorites();
  renderProfileFavorites();
  renderFavChips();
  updateAuthInterface(state.auth.session);
  toast(`${place.name || 'Plaats'} toegevoegd aan favorieten.`);
}

function scrollProfileFavoritesIntoView(){
  $('#profileFavoritesSection')?.scrollIntoView({behavior:'smooth', block:'start'});
  setTimeout(()=>$('#profileFavoriteSearch')?.focus(), 350);
}

function validateEmail(email){
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
async function signInWithEmail(email,password){
  if(!validateEmail(email)) return updateAuthMessage('Vul een geldig e-mailadres in.','error');
  if(!password) return updateAuthMessage('Vul je wachtwoord in.','error');
  updateAuthMessage('Inloggen...');
  try{ const data=await apiJson('/auth/login',{method:'POST',body:JSON.stringify({email,password})}); const session=makeLocalSession(data.token,data.user); saveOwnServerSession(session); await applyAuthSession(session); updateAuthMessage('Je bent ingelogd.','ok'); toast('Je bent ingelogd.'); }catch(error){ updateAuthMessage(dutchAuthError(error),'error'); }
}
async function signUpWithEmail(displayName,email,password,password2,privacyOk){
  displayName=String(displayName||'').trim();
  if(!displayName) return updateAuthMessage('Vul een weergavenaam in.','error');
  if(!validateEmail(email)) return updateAuthMessage('Vul een geldig e-mailadres in.','error');
  if(password.length<8) return updateAuthMessage('Het wachtwoord moet minstens 8 tekens bevatten.','error');
  if(password!==password2) return updateAuthMessage('De wachtwoorden komen niet overeen.','error');
  if(!privacyOk) return updateAuthMessage('Ga akkoord met de privacyvoorwaarden om verder te gaan.','error');
  updateAuthMessage('Account aanmaken...');
  try{ const base=displayName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_]+/g,'').slice(0,40)||email.split('@')[0].replace(/[^a-zA-Z0-9_]/g,'').slice(0,40); const username=`${base}${Math.floor(1000+Math.random()*9000)}`.slice(0,50); await apiJson('/auth/register',{method:'POST',body:JSON.stringify({username,email,password,displayName})}); const login=await apiJson('/auth/login',{method:'POST',body:JSON.stringify({email,password})}); const session=makeLocalSession(login.token,login.user); saveOwnServerSession(session); await applyAuthSession(session); updateAuthMessage('Account aangemaakt. Je bent ingelogd.','ok'); toast('Welkom bij Wheaterflow!'); }catch(error){ updateAuthMessage(dutchAuthError(error),'error'); }
}
async function resetPassword(email){
  if(!validateEmail(email)) return updateAuthMessage('Vul eerst je e-mailadres in.', 'error');
  updateAuthMessage('Resetmail versturen...');
  try{
    await apiJson('/auth/password-reset/request', {method:'POST', body:JSON.stringify({email})});
    updateAuthMessage('Als het account bestaat, is een resetlink verstuurd.', 'ok');
  }catch(e){
    updateAuthMessage(dutchAuthError(e), 'error');
  }
}
async function uploadAvatar(file){
  if(!state.auth.user) return;
  try{
    updateProfileMessage('Profielfoto uploaden...');
    const blob = await compressAvatar(file);
    const form = new FormData();
    form.append('avatar', blob, 'avatar.webp');
    const data = await apiForm('/profile/avatar', form);
    state.auth.profile = data.profile || state.auth.profile;
    updateAuthInterface(state.auth.session);
    updateProfileMessage('Profielfoto opgeslagen.', 'ok');
  }catch(e){ updateProfileMessage(e.message || 'Profielfoto kon niet worden opgeslagen.', 'error'); }
}

function wireAuthUi(){
  $('#profileBtn')?.addEventListener('click', openAuthSheet);
  $('#closeAuthSheet')?.addEventListener('click', ()=>closeAuthSheet());
  $('#authScrim')?.addEventListener('click', ()=>closeAuthSheet());
  $('#authLoginTab')?.addEventListener('click', ()=>setAuthMode('login'));
  $('#authSignupTab')?.addEventListener('click', ()=>setAuthMode('signup'));
  $('#loginForm')?.addEventListener('submit', e=>{
    e.preventDefault();
    signInWithEmail($('#loginEmail')?.value.trim() || '', $('#loginPassword')?.value || '');
  });
  $('#signupForm')?.addEventListener('submit', e=>{
    e.preventDefault();
    signUpWithEmail(
      $('#signupName')?.value || '',
      $('#signupEmail')?.value.trim() || '',
      $('#signupPassword')?.value || '',
      $('#signupPassword2')?.value || '',
      Boolean($('#signupPrivacy')?.checked)
    );
  });
  $('#forgotPasswordBtn')?.addEventListener('click', ()=>{
    const email = $('#loginEmail')?.value?.trim() || $('#signupEmail')?.value?.trim() || '';
    resetPassword(email);
  });
  $('#continueGuestBtn')?.addEventListener('click', ()=>closeAuthSheet());
  $('#showLoginPassword')?.addEventListener('change', e=>{
    const input = $('#loginPassword');
    if(input) input.type = e.target.checked ? 'text' : 'password';
  });
  $('#changeAvatarBtn')?.addEventListener('click', ()=>$('#avatarInput')?.click());
  $('#profileForm')?.addEventListener('submit', async e=>{
    e.preventDefault();
    if(!state.auth.user) return;
    updateProfileMessage('Profiel opslaan...');
    const previousHomeName = state.auth.profile?.home_location_name || '';
    const nextHomeName = $('#profileHomeLocation')?.value.trim() || '';
    state.auth.profile = {
      ...(state.auth.profile || {}),
      display_name: $('#profileDisplayName')?.value.trim() || state.auth.profile?.display_name,
      home_location_name: nextHomeName
    };
    // Als de naam handmatig is gewijzigd, behouden we niet per ongeluk de
    // coördinaten van een oude thuislocatie. De locatieknop hieronder bewaart
    // naam + coördinaten samen.
    if(nextHomeName !== previousHomeName){
      state.auth.profile.home_latitude = null;
      state.auth.profile.home_longitude = null;
    }
    await syncProfileSettingsToCloud(true);
    updateAuthInterface(state.auth.session);
    updateProfileMessage('Profiel opgeslagen op je Wheaterflow-account.', 'ok');
  });
  $('#profileUseCurrentLocation')?.addEventListener('click', async ()=>{
    const input = $('#profileHomeLocation');
    if(!input) return;
    updateProfileMessage('Actuele gps-locatie bepalen...');
    const gps=await getBrowserLocation();
    if(!gps){ updateProfileMessage('Gps-locatie kon niet worden opgehaald. Controleer je locatietoegang.', 'error'); return; }
    const resolved=await reverseGeocode(gps.lat,gps.lon);
    const name=cleanLocationName(resolved.name,'');
    if(!name){ updateProfileMessage('Plaatsnaam van je gps-locatie kon niet worden bepaald.', 'error'); return; }
    input.value=name;
    if($('#profileCurrentLocationName')) $('#profileCurrentLocationName').textContent=name;
    state.auth.profile={...(state.auth.profile||{}),home_location_name:name,home_latitude:gps.lat,home_longitude:gps.lon};
    updateProfileMessage(`Thuislocatie ${name} opslaan...`);
    await syncProfileSettingsToCloud(true);
    updateAuthInterface(state.auth.session);
    updateProfileMessage(`Thuislocatie ${name} is opgeslagen op je account.`, 'ok');
  });
  $('#profileTvDevicesBtn')?.addEventListener('click', ()=>{
    closeAuthSheet();
    openSheet();
    $('.tv-settings-group')?.scrollIntoView({block:'center', behavior:'smooth'});
  });
  $('#profileNotificationsRow')?.addEventListener('click', ()=>{
    closeAuthSheet();
    openSheet();
    $('.notification-settings')?.scrollIntoView({block:'center', behavior:'smooth'});
  });
  $('#profileEditToggle')?.addEventListener('click', ()=>{
    const panel=$('#profileEditPanel');
    panel?.classList.toggle('hidden');
    if(panel && !panel.classList.contains('hidden')) panel.scrollIntoView({behavior:'smooth', block:'start'});
  });
  ['profileFavoritesJump','profileFavoritesMenu'].forEach(id=>$('#'+id)?.addEventListener('click', scrollProfileFavoritesIntoView));
  ['profileNotificationsQuick','profileNotificationsMenu'].forEach(id=>$('#'+id)?.addEventListener('click', ()=>{
    closeAuthSheet(); openSheet();
    setTimeout(()=>$('.notification-settings')?.scrollIntoView({block:'center', behavior:'smooth'}), 160);
  }));
  $('#profileWeatherPrefsMenu')?.addEventListener('click', ()=>{
    closeAuthSheet(); openSheet();
  });
  $('#profileFavoriteSearch')?.addEventListener('input', e=>{
    clearTimeout(profileFavoriteSearchTimer);
    profileFavoriteSearchTimer=setTimeout(()=>searchProfileFavorites(e.target.value), 280);
  });
  $('#profileAddCurrentFavorite')?.addEventListener('click', ()=>addProfileFavorite({
    name:locationDisplayName('Huidige locatie'), lat:state.loc?.lat, lon:state.loc?.lon,
    admin:state.loc?.admin || '', country:state.loc?.country || ''
  }));
  $('#avatarInput')?.addEventListener('change', e=>{
    const file = e.target.files?.[0];
    if(file) uploadAvatar(file);
  });
  $('#profileFavoritesList')?.addEventListener('click', e=>{
    const button = e.target.closest('button[data-act]');
    if(button) handleProfileFavoriteAction(button);
  });
  $('#syncLocalBtn')?.addEventListener('click', ()=>{
    if(typeof syncEverythingToCloud === 'function') syncEverythingToCloud(true);
    else toast('Synchronisatie is nog niet beschikbaar.');
  });
  $('#resetPasswordLoggedInBtn')?.addEventListener('click', ()=>{
    const email = state.auth.user?.email || $('#loginEmail')?.value?.trim() || '';
    resetPassword(email);
  });
  $('#logoutBtn')?.addEventListener('click', async ()=>{
    clearOwnServerSession();
    await applyAuthSession(null);
    updateAuthMessage('Je bent uitgelogd.', 'ok');
    toast('Uitgelogd');
  });
  updateAuthInterface(state.auth.session);
}

/* ---------------- Mijn Klimaat ---------------- */
function initClimateUi(){
  ['climateBtn','profileClimateBtn'].forEach(id=>{
    $('#'+id)?.addEventListener('click', ()=>{
      closeAuthSheet();
      openClimateScreen();
    });
  });
  $('#climateBackBtn')?.addEventListener('click', ()=>showAppScreen('home'));
  $('#climateMode')?.addEventListener('change', async e=>{
    state.climate.settings.mode = e.target.value;
    await saveClimateSettings();
    updateClimateStatus();
    if(state.climate.settings.mode !== 'off') await captureTodayClimate('manual');
    renderClimateDashboard();
  });
  $('#climatePeriod')?.addEventListener('change', e=>{
    state.climate.period = e.target.value;
    renderClimateDashboard();
  });
  $('#climateLocationFilter')?.addEventListener('change', e=>{
    state.climate.location = e.target.value;
    renderClimateDashboard();
  });
  $('#climateSaveToday')?.addEventListener('click', ()=>captureTodayClimate('manual'));
  $('#climateExport')?.addEventListener('click', exportClimateData);
  $('#climateDeleteLocation')?.addEventListener('click', deleteClimateLocation);
  $('#climateDeleteAll')?.addEventListener('click', deleteAllClimateData);
  updateClimateStatus();
}

function showAppScreen(id){
  $$('.tabbtn').forEach(b=>b.classList.toggle('active', b.dataset.tab === id));
  $$('.screen').forEach(s=>s.classList.remove('active'));
  $('#'+id)?.classList.add('active');
  state.activeTab = id;
  if(id === 'climatescreen') renderClimateDashboard();
}

function openClimateScreen(){
  showAppScreen('climatescreen');
  renderClimateDashboard();
}

function climateLocalKey(row){
  return [row.date, row.location_name || 'Locatie', row.latitude_rounded ?? '', row.longitude_rounded ?? ''].join('|');
}

function normalizeClimateRecords(rows){
  const map = new Map();
  (Array.isArray(rows) ? rows : []).forEach(row=>{
    if(!row?.date) return;
    map.set(climateLocalKey(row), row);
  });
  return [...map.values()].sort((a,b)=>String(a.date).localeCompare(String(b.date)));
}

function climateLocationAllowed(){
  const mode = state.climate.settings.mode || 'off';
  if(mode === 'off') return false;
  if(mode === 'manual'){
    return state.favorites.some(f => Math.abs(+f.lat - +state.loc.lat) < .03 && Math.abs(+f.lon - +state.loc.lon) < .03);
  }
  if(mode === 'home' && state.auth.profile?.home_location_name){
    return String(state.auth.profile.home_location_name).toLowerCase() === String(state.loc.name).toLowerCase();
  }
  return true;
}

function roundedClimateCoord(value, mode){
  if(value == null) return null;
  if(mode === 'rounded') return Math.round(value * 10) / 10;
  if(mode === 'municipality' || mode === 'home' || mode === 'manual') return Math.round(value * 100) / 100;
  return null;
}

function buildClimateRecord(reason='auto'){
  if(!state.daily || !state.current) return null;
  const mode = state.climate.settings.mode || 'off';
  if(mode === 'off' || !climateLocationAllowed()) return null;
  const d = state.daily;
  const date = d.time?.[0] || new Date().toISOString().slice(0,10);
  const code = d.weather_code?.[0] ?? state.current.weather_code ?? null;
  const min = d.temperature_2m_min?.[0] ?? null;
  const max = d.temperature_2m_max?.[0] ?? null;
  const mean = min != null && max != null ? (Number(min) + Number(max)) / 2 : state.current.temperature_2m ?? null;
  const officialWarnings = state.alerts.filter(a=>a?.level && a.level !== 'green').length;
  return {
    date,
    location_name: mode === 'off' ? null : state.loc.name,
    latitude_rounded: mode === 'municipality' ? null : roundedClimateCoord(state.loc.lat, mode),
    longitude_rounded: mode === 'municipality' ? null : roundedClimateCoord(state.loc.lon, mode),
    min_temperature:min,
    max_temperature:max,
    mean_temperature:mean,
    precipitation_total:d.precipitation_sum?.[0] ?? state.current.precipitation ?? null,
    max_wind_gust:d.wind_gusts_10m_max?.[0] ?? state.current.wind_gusts_10m ?? null,
    uv_max:d.uv_index_max?.[0] ?? null,
    weather_code:code,
    warning_count:officialWarnings,
    source_name:state.observation?.source || (preferredWeatherModel()==='knmi_seamless' ? 'KNMI HARMONIE via Open-Meteo' : 'Open-Meteo'),
    data_quality:state.observation ? 'observatie + model' : 'model',
    capture_reason:reason,
    created_at:new Date().toISOString()
  };
}

async function captureTodayClimate(reason='auto'){
  const row = buildClimateRecord(reason);
  if(!row){
    if(reason === 'manual') setClimateMessage('Mijn Klimaat staat uit of deze locatie past niet bij je privacykeuze.', 'error');
    return;
  }
  const existingKey = climateLocalKey(row);
  state.climate.records = normalizeClimateRecords([...state.climate.records.filter(r=>climateLocalKey(r)!==existingKey), row]);
  await saveLocalClimateRecords();
  if(state.auth.user){
    const payload = {...row}; delete payload.capture_reason;
    try{ await apiJson('/climate', {method:'PUT', body:JSON.stringify({records:[payload]})}); }
    catch(error){ console.warn('Mijn Klimaat opslaan mislukt:', error.message); if(reason === 'manual') setClimateMessage('Bewaren op de server lukte niet. Lokaal staat de dag wel klaar.', 'error'); }
  }
  if(reason === 'manual') setClimateMessage('Vandaag is bewaard in Mijn Klimaat.', 'ok');
  renderClimateDashboard();
}

async function migrateLocalClimateToCloud(){
  if(!state.auth.user || !state.climate.records.length) return;
  const records = state.climate.records.map(r=>{ const row={...r}; delete row.capture_reason; return row; });
  await apiJson('/climate', {method:'PUT', body:JSON.stringify({records})}).catch(()=>undefined);
}

async function loadCloudClimateRecords(){
  if(!state.auth.user) return;
  try{
    const data = await apiJson('/climate');
    state.climate.records = normalizeClimateRecords(data.records || []);
    await saveLocalClimateRecords();
  }catch(e){ console.warn('Mijn Klimaat laden mislukt:', e?.message || e); }
  finally{ state.climate.loaded = true; }
}

function updateClimateStatus(){
  const mode = state.climate.settings.mode || 'off';
  if($('#climateMode')) $('#climateMode').value = mode;
  if($('#climateStatus')) $('#climateStatus').textContent = mode === 'off' ? 'Uit' : 'Aan';
}

function setClimateMessage(msg, type=''){
  const el = $('#climateMessage');
  if(!el) return;
  el.textContent = msg || '';
  el.className = 'auth-message' + (type ? ' ' + type : '');
}

function filteredClimateRecords(period=state.climate.period, location=state.climate.location){
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  return state.climate.records
    .filter(r=>r?.date)
    .filter(r=>{
      const d = new Date(r.date + 'T00:00:00');
      if(period === 'month') return d.getFullYear() === year && d.getMonth() === month;
      if(period === 'year') return d.getFullYear() === year;
      if(period === 'lastYear') return d.getFullYear() === year - 1;
      return true;
    })
    .filter(r=>location === 'all' || r.location_name === location)
    .sort((a,b)=>String(a.date).localeCompare(String(b.date)));
}

function climateRecordExtremes(rows){
  const byMax = rows.filter(r=>r.max_temperature != null).sort((a,b)=>b.max_temperature-a.max_temperature)[0];
  const byMin = rows.filter(r=>r.min_temperature != null).sort((a,b)=>a.min_temperature-b.min_temperature)[0];
  const byRain = rows.filter(r=>r.precipitation_total != null).sort((a,b)=>b.precipitation_total-a.precipitation_total)[0];
  const byWind = rows.filter(r=>r.max_wind_gust != null).sort((a,b)=>b.max_wind_gust-a.max_wind_gust)[0];
  const rainDays = rows.filter(r=>(r.precipitation_total || 0) >= 1).length;
  const frostDays = rows.filter(r=>(r.min_temperature ?? 99) < 0).length;
  const warmDays = rows.filter(r=>(r.max_temperature ?? -99) >= 25).length;
  const thunderDays = rows.filter(r=>[95,96,99].includes(Number(r.weather_code))).length;
  const warningDays = rows.filter(r=>(r.warning_count || 0) > 0).length;
  const sunnyMonth = climateSunniestMonth(rows);
  const streak = climateCurrentStreak(rows);
  return {byMax, byMin, byRain, byWind, rainDays, frostDays, warmDays, thunderDays, warningDays, sunnyMonth, streak};
}

function climateSunniestMonth(rows){
  const months = new Map();
  rows.forEach(r=>{
    if(r.uv_max == null) return;
    const key = String(r.date).slice(0,7);
    const item = months.get(key) || {sum:0, n:0};
    item.sum += Number(r.uv_max); item.n += 1;
    months.set(key,item);
  });
  return [...months.entries()].map(([k,v])=>({key:k, avg:v.sum/v.n})).sort((a,b)=>b.avg-a.avg)[0] || null;
}

function climateCurrentStreak(rows){
  const dates = new Set(rows.map(r=>r.date));
  let d = new Date();
  let n = 0;
  while(dates.has(d.toISOString().slice(0,10))){
    n += 1;
    d.setDate(d.getDate()-1);
  }
  return n;
}

function climateCompareText(){
  const current = filteredClimateRecords();
  if(!current.length) return 'Nog geen vergelijking beschikbaar.';
  const avg = arr => arr.length ? arr.reduce((s,v)=>s+v,0)/arr.length : null;
  const currentAvg = avg(current.map(r=>r.mean_temperature).filter(v=>v != null));
  if(currentAvg == null) return 'Nog geen temperatuurvergelijking beschikbaar.';
  const now = new Date();
  let comparePeriod = 'vorig jaar';
  let comparison = [];
  if(state.climate.period === 'month'){
    const prev = new Date(now.getFullYear(), now.getMonth()-1, 1);
    comparison = state.climate.records.filter(r=>{
      const d = new Date(r.date + 'T00:00:00');
      return d.getFullYear() === prev.getFullYear() && d.getMonth() === prev.getMonth() && (state.climate.location === 'all' || r.location_name === state.climate.location);
    });
    comparePeriod = 'vorige maand';
  }else{
    comparison = state.climate.records.filter(r=>{
      const d = new Date(r.date + 'T00:00:00');
      return d.getFullYear() === now.getFullYear()-1 && (state.climate.location === 'all' || r.location_name === state.climate.location);
    });
    comparePeriod = 'vorig jaar';
  }
  const cmpAvg = avg(comparison.map(r=>r.mean_temperature).filter(v=>v != null));
  if(cmpAvg == null) return `Er zijn nog te weinig bewaarde dagen voor vergelijking met ${comparePeriod}.`;
  const diff = currentAvg - cmpAvg;
  const warmer = diff >= 0 ? 'warmer' : 'kouder';
  const loc = state.climate.location === 'all' ? 'jouw opgeslagen locaties' : state.climate.location;
  return `Deze periode was op ${loc} tot nu toe ${Math.abs(diff).toFixed(1).replace('.',',')} °C ${warmer} dan ${comparePeriod}.`;
}

function formatClimateDate(date){
  return new Date(date + 'T00:00:00').toLocaleDateString('nl-BE',{day:'2-digit',month:'short',year:'numeric'});
}

function climateMetric(label, value, sub=''){
  return `<div class="climate-metric"><span>${esc(label)}</span><b>${value}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
}

function updateClimateLocationFilter(){
  const select = $('#climateLocationFilter');
  if(!select) return;
  const locations = [...new Set(state.climate.records.map(r=>r.location_name).filter(Boolean))].sort();
  const current = state.climate.location;
  select.innerHTML = '<option value="all">Alle locaties</option>' + locations.map(l=>`<option value="${esc(l)}">${esc(l)}</option>`).join('');
  select.value = locations.includes(current) ? current : 'all';
  state.climate.location = select.value;
}

function renderClimateDashboard(){
  if(!$('#climatescreen')) return;
  updateClimateStatus();
  if($('#climatePeriod')) $('#climatePeriod').value = state.climate.period;
  updateClimateLocationFilter();
  const rows = filteredClimateRecords();
  const summary = $('#climateSummary');
  if(!rows.length){
    if(summary) summary.innerHTML = `<div class="community-empty" style="grid-column:1/-1;">Nog geen persoonlijke klimaatdagen. Zet bewaren aan en open de app op dagen die je wilt archiveren.</div>`;
    renderClimateChart([]);
    renderClimateCalendar([]);
    renderClimateTimeline([]);
    renderClimateMemories();
    return;
  }
  const x = climateRecordExtremes(rows);
  if(summary) summary.innerHTML = [
    climateMetric('Warmste dag', x.byMax ? fmtTemp(x.byMax.max_temperature) : '-', x.byMax ? formatClimateDate(x.byMax.date) : ''),
    climateMetric('Koudste dag', x.byMin ? fmtTemp(x.byMin.min_temperature) : '-', x.byMin ? formatClimateDate(x.byMin.date) : ''),
    climateMetric('Natste dag', x.byRain ? fmtPrecip(x.byRain.precipitation_total) : '-', x.byRain ? formatClimateDate(x.byRain.date) : ''),
    climateMetric('Sterkste wind', x.byWind ? fmtWind(x.byWind.max_wind_gust) : '-', x.byWind ? formatClimateDate(x.byWind.date) : ''),
    climateMetric('Zonnigste maand', x.sunnyMonth ? new Date(x.sunnyMonth.key + '-01').toLocaleDateString('nl-BE',{month:'long',year:'numeric'}) : '-', x.sunnyMonth ? `Gem. UV ${x.sunnyMonth.avg.toFixed(1)}` : ''),
    climateMetric('Regendagen', x.rainDays, 'Minstens 1 mm'),
    climateMetric('Vorstdagen', x.frostDays, 'Minimum onder 0 °C'),
    climateMetric('Warme dagen', x.warmDays, 'Maximum vanaf 25 °C'),
    climateMetric('Onweersdagen', x.thunderDays, 'Code 95/96/99'),
    climateMetric('Waarschuwingsdagen', x.warningDays, 'Code geel of hoger'),
    climateMetric('Persoonlijke reeks', `${x.streak} dagen`, 'Aaneengesloten bewaard'),
    climateMetric('Vergelijking', climateCompareText(), 'Geen verklaring voor klimaatverandering')
  ].join('');
  renderClimateChart(rows);
  renderClimateCalendar(rows);
  renderClimateTimeline(rows);
  renderClimateMemories();
}

function renderClimateChart(rows){
  const canvas = $('#climateChart');
  if(!canvas || !window.Chart) return;
  if(state.climate.chart) state.climate.chart.destroy();
  const sorted = rows.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  state.climate.chart = new Chart(canvas, {
    type:'line',
    data:{
      labels:sorted.map(r=>r.date),
      datasets:[
        {label:'Gem. temperatuur (°C)', data:sorted.map(r=>r.mean_temperature ?? null), borderColor:'#8fe7ff', backgroundColor:'rgba(143,231,255,.12)', tension:.25, spanGaps:false, yAxisID:'y'},
        {label:'Neerslag (mm)', data:sorted.map(r=>r.precipitation_total ?? null), type:'bar', backgroundColor:'rgba(73,167,255,.38)', borderColor:'rgba(73,167,255,.85)', yAxisID:'y1'}
      ]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      interaction:{mode:'index', intersect:false},
      plugins:{legend:{labels:{color:'#e9eefb'}}, tooltip:{callbacks:{title:items=>formatClimateDate(items[0].label)}}},
      scales:{
        x:{ticks:{color:'rgba(233,238,251,.68)', maxTicksLimit:8}, grid:{color:'rgba(255,255,255,.06)'}},
        y:{title:{display:true,text:'°C',color:'#e9eefb'}, ticks:{color:'rgba(233,238,251,.68)'}, grid:{color:'rgba(255,255,255,.08)'}},
        y1:{position:'right', title:{display:true,text:'mm',color:'#e9eefb'}, ticks:{color:'rgba(233,238,251,.68)'}, grid:{drawOnChartArea:false}}
      }
    }
  });
}

function renderClimateCalendar(rows){
  const el = $('#climateCalendar');
  if(!el) return;
  if(!rows.length){ el.innerHTML = '<div class="climate-empty" style="grid-column:1/-1;">Geen kalenderdata.</div>'; return; }
  const byDate = new Map(rows.map(r=>[r.date,r]));
  const latest = rows[rows.length-1]?.date || new Date().toISOString().slice(0,10);
  const base = new Date(latest + 'T00:00:00');
  const first = new Date(base.getFullYear(), base.getMonth(), 1);
  const last = new Date(base.getFullYear(), base.getMonth()+1, 0);
  let html = '';
  const offset = (first.getDay()+6)%7;
  for(let i=0;i<offset;i++) html += '<div></div>';
  for(let day=1; day<=last.getDate(); day++){
    const date = `${base.getFullYear()}-${String(base.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const r = byDate.get(date);
    html += `<div class="climate-day ${r?'has-data':''}"><b>${day}</b>${r ? `${fmtTemp(r.max_temperature)}<br>${fmtPrecip(r.precipitation_total || 0)}` : ''}</div>`;
  }
  el.innerHTML = html;
}

function renderClimateTimeline(rows){
  const el = $('#climateTimeline');
  if(!el) return;
  const list = rows.slice(-10).reverse();
  el.innerHTML = list.length ? list.map(r=>{
    const wc = wcInfo(r.weather_code);
    return `<div class="climate-row">${icon(wc.ic,true,24)}<div><b>${formatClimateDate(r.date)} - ${esc(r.location_name || 'Locatie')}</b><span>${esc(wc.l)} - ${fmtTemp(r.min_temperature)} / ${fmtTemp(r.max_temperature)} - ${fmtPrecip(r.precipitation_total || 0)}</span></div><span>${r.data_quality || ''}</span></div>`;
  }).join('') : '<div class="climate-empty">Nog geen tijdlijn.</div>';
}

function renderClimateMemories(){
  const el = $('#climateMemories');
  if(!el) return;
  const today = new Date();
  const lastYearKey = `${today.getFullYear()-1}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const memories = [];
  state.climate.records.filter(r=>r.date === lastYearKey).forEach(r=>{
    memories.push(`<div class="climate-row">${icon(wcInfo(r.weather_code).ic,true,24)}<div><b>Een jaar geleden in ${esc(r.location_name || 'jouw locatie')}</b><span>${esc(wcInfo(r.weather_code).l)} - ${fmtTemp(r.min_temperature)} / ${fmtTemp(r.max_temperature)}</span></div></div>`);
  });
  state.community.posts.filter(p=>String(p.created_at || '').slice(0,10) === lastYearKey && p.user_id === state.auth.user?.id).forEach(p=>{
    const memoryMedia = p.photo_url
      ? `<img class="climate-memory-photo" src="${esc(p.photo_url)}" alt="">`
      : `<span class="climate-memory-icon">${icon('cloud', true, 24)}</span>`;
    memories.push(`<div class="climate-row">${memoryMedia}<div><b>Een jaar geleden deelde je deze ${p.photo_url ? 'weerfoto' : 'waarneming'}</b><span>${esc(p.location_name || '')} - ${esc(communityCategory(p.category).label)}</span></div></div>`);
  });
  el.innerHTML = memories.length ? memories.join('') : '<div class="climate-empty">Nog geen weerherinneringen voor vandaag.</div>';
}

function exportClimateData(){
  const rows = filteredClimateRecords('all', state.climate.location);
  if(!rows.length) return setClimateMessage('Er is nog niets om te exporteren.', 'error');
  const blob = new Blob([JSON.stringify(rows, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wheaterflow-mijn-klimaat-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
  setClimateMessage('Export klaar.', 'ok');
}

async function deleteClimateLocation(){
  const location = state.climate.location;
  if(location === 'all') return setClimateMessage('Kies eerst een specifieke locatie.', 'error');
  if(!confirm(`Alle klimaatdata voor ${location} verwijderen?`)) return;
  state.climate.records = state.climate.records.filter(r=>r.location_name !== location);
  await saveLocalClimateRecords();
  if(state.auth.user){ await apiJson('/climate/location', {method:'DELETE', body:JSON.stringify({location_name:location})}).catch(()=>undefined); }
  state.climate.location = 'all';
  setClimateMessage('Locatiegeschiedenis verwijderd.', 'ok');
  renderClimateDashboard();
}

async function deleteAllClimateData(){
  if(!confirm('Alle persoonlijke klimaatdata verwijderen?')) return;
  state.climate.records = [];
  await saveLocalClimateRecords();
  if(state.auth.user){ await apiJson('/climate', {method:'DELETE'}).catch(()=>undefined); }
  setClimateMessage('Alle klimaatdata verwijderd.', 'ok');
  renderClimateDashboard();
}

/* ---------------- Wheaterflow Community ---------------- */
const COMMUNITY_CATEGORIES = [
  {id:'thunder', label:'Onweer', color:'#ffd24d'},
  {id:'rain', label:'Regen', color:'#49a7ff'},
  {id:'shower', label:'Bui', color:'#35d0c4'},
  {id:'rainbow', label:'Regenboog', color:'#b971ff'},
  {id:'fog', label:'Mist', color:'#b8c2d4'},
  {id:'snow', label:'Sneeuw', color:'#f3fbff'},
  {id:'coast', label:'Kustweer', color:'#45d6ff'},
  {id:'seaspark', label:'Zeevonk', color:'#67f5d5'},
  {id:'sunset', label:'Zonsondergang', color:'#ff9a45'},
  {id:'sunrise', label:'Zonsopkomst', color:'#ffd36b'},
  {id:'clouds', label:'Bijzondere wolken', color:'#9fb5d4'},
  {id:'storm', label:'Storm', color:'#ef4b5f'},
  {id:'hail', label:'Hagel', color:'#dbe7ff'},
  {id:'other', label:'Overig', color:'#8fe7ff'}
];
const COMMUNITY_OBSERVATION_TYPES = [
  {id:'rain', label:'Regen', short:'Regen', category:'rain', icon:'☔', ttlMinutes:60},
  {id:'heavy_rain', label:'Zware regen', short:'Zware regen', category:'rain', icon:'🌧', ttlMinutes:60},
  {id:'hail', label:'Hagel', short:'Hagel', category:'hail', icon:'◌', ttlMinutes:45},
  {id:'seaspark', label:'Zeevonk', short:'Zeevonk', category:'seaspark', icon:'✦', ttlMinutes:240},
  {id:'snow', label:'Sneeuw', short:'Sneeuw', category:'snow', icon:'❄', ttlMinutes:120},
  {id:'fog', label:'Mist', short:'Mist', category:'fog', icon:'≋', ttlMinutes:180},
  {id:'thunder', label:'Onweer', short:'Onweer', category:'thunder', icon:'⚡', ttlMinutes:45},
  {id:'lightning', label:'Bliksem gezien', short:'Bliksem', category:'thunder', icon:'↯', ttlMinutes:30},
  {id:'strong_wind', label:'Harde wind', short:'Harde wind', category:'storm', icon:'〰', ttlMinutes:90},
  {id:'flooding', label:'Wateroverlast', short:'Wateroverlast', category:'rain', icon:'≋', ttlMinutes:240},
  {id:'ice', label:'Gladheid', short:'Gladheid', category:'other', icon:'◇', ttlMinutes:360},
  {id:'clearing', label:'Zon of opklaring', short:'Opklaring', category:'sunset', icon:'☀', ttlMinutes:90}
];
const communityCategory = id => COMMUNITY_CATEGORIES.find(c=>c.id===id) || COMMUNITY_CATEGORIES[COMMUNITY_CATEGORIES.length - 1];
const communityObservationType = id => COMMUNITY_OBSERVATION_TYPES.find(t=>t.id===id) || null;
const safeRandomId = () => (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

function initCommunityUi(){
  const catOptions = COMMUNITY_CATEGORIES.map(c=>`<option value="${c.id}">${c.label}</option>`).join('');
  const composerCatOptions = COMMUNITY_CATEGORIES.map(c=>`<option value="${c.id}" ${c.id === 'other' ? 'selected' : ''}>${c.label}</option>`).join('');
  if($('#communityCategorySelect')) $('#communityCategorySelect').innerHTML = composerCatOptions;
  if($('#communityCategoryFilter')) $('#communityCategoryFilter').innerHTML = '<option value="">Alle categorieen</option>' + catOptions;
  renderCommunityQuickObservations();
  $('#communityQuickObservations')?.addEventListener('click', handleQuickObservationClick);
  $('#communityUploadOpen')?.addEventListener('click', ()=>{ openCommunityComposer(); setCommunityComposerMode('photo'); });
  $('#communityObservationOpen')?.addEventListener('click', ()=>{ openCommunityComposer(); setCommunityComposerMode('observation'); });
  $('#communityComposerModes')?.addEventListener('click', e=>{ const b=e.target.closest('[data-community-mode]'); if(b) setCommunityComposerMode(b.dataset.communityMode); });
  $('#communityComposerClose')?.addEventListener('click', closeCommunityComposer);
  $('#communityScrim')?.addEventListener('click', closeCommunityComposer);
  $('#communitySubmitPost')?.addEventListener('click', createCommunityPost);
  $('#communityPhotoInput')?.addEventListener('change', handleCommunityPhotoSelect);
  $('#communityUseGps')?.addEventListener('change', updateCommunityCapturedWeather);
  $('#communityLoadMore')?.addEventListener('click', ()=>loadCommunityPosts(false));
  $('#communitySearch')?.addEventListener('input', debounce(e=>{
    state.community.query = e.target.value.trim();
    loadCommunityPosts(true);
  }, 350));
  $('#communityCategoryFilter')?.addEventListener('change', e=>{
    state.community.category = e.target.value;
    loadCommunityPosts(true);
  });
  $('#communityFilterChips')?.addEventListener('click', e=>{
    const btn = e.target.closest('button[data-community-filter]');
    if(!btn) return;
    $$('#communityFilterChips button').forEach(b=>b.classList.toggle('active', b === btn));
    const filter = btn.dataset.communityFilter || 'foryou';
    state.community.quickFilter = filter;
    state.community.category = filter === 'rain' ? 'rain' : filter === 'thunder' ? 'thunder' : '';
    if($('#communityCategoryFilter')) $('#communityCategoryFilter').value = state.community.category;
    loadCommunityPosts(true);
  });
  $$('.community-tabs button').forEach(btn=>btn.addEventListener('click', ()=>{
    $$('.community-tabs button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    state.community.view = btn.dataset.communityView;
    $$('.community-panel').forEach(panel=>panel.classList.remove('active'));
    $(`#community${state.community.view[0].toUpperCase()+state.community.view.slice(1)}Panel`)?.classList.add('active');
    if(state.community.view === 'map') setTimeout(initCommunityMap, 120);
    if(state.community.view === 'collection') renderCommunityCollection();
  }));
  $('#communityFeed')?.addEventListener('click', handleCommunityAction);
  $('#communityFeed')?.addEventListener('submit', handleCommunityCommentSubmit);
}

function communityWeatherIcon(typeOrCategory,size=22){
  const id=String(typeOrCategory||'other');
  const map={rain:'rain',heavy_rain:'rain',thunder:'storm',lightning:'storm',hail:'snow',snow:'snow',fog:'fog',strong_wind:'wind',flooding:'rain',ice:'snow',clearing:'partly',sunset:'sun',sunrise:'sun',clouds:'cloud',storm:'storm',shower:'rain',coast:'wind',seaspark:'drop'};
  return icon(map[id]||'cloud',true,size);
}
function renderCommunityQuickObservations(){
  const wrap=$('#communityQuickObservations'); if(!wrap) return;
  wrap.innerHTML=COMMUNITY_OBSERVATION_TYPES.map(type=>`<button type="button" data-observation-type="${esc(type.id)}" aria-label="${esc(type.label)} melden"><span>${communityWeatherIcon(type.id,22)}</span><b>${esc(type.short)}</b></button>`).join('');
}

function debounce(fn, wait){
  let t;
  return (...args)=>{ clearTimeout(t); t = setTimeout(()=>fn(...args), wait); };
}

function requireCommunityLogin(){
  if(state.auth.user) return true;
  toast('Log in om dit te gebruiken.');
  openAuthSheet();
  return false;
}

async function loadCommunityPosts(reset=false){
  if(state.community.loading) return;
  if(reset){ state.community.page=0; state.community.posts=[]; state.community.hasMore=true; }
  if(!state.community.hasMore) return;
  state.community.loading = true;
  renderCommunityLoading();
  try{
    const q = new URLSearchParams({page:String(state.community.page), pageSize:String(state.community.pageSize)});
    if(state.community.category) q.set('category', state.community.category);
    if(state.community.query) q.set('q', state.community.query);
    const data = await apiJson('/community/posts?' + q.toString(), {method:'GET'});
    const posts = normalizeCommunityPosts(data.posts || []);
    state.community.posts = reset ? posts : [...state.community.posts, ...posts];
    state.community.hasMore = Boolean(data.hasMore);
    state.community.page += 1;
    renderCommunityFeed(); renderCommunityLiveStats();
    if(state.community.view === 'map') renderCommunityMapMarkers();
  }catch(e){ console.error('Community feed load failed', e); renderCommunityEmpty('Community kon niet worden geladen. Controleer je verbinding of probeer later opnieuw.'); }
  finally{ state.community.loading=false; }
}

function normalizeCommunityPosts(posts){
  return posts
    .map(post=>normalizeCommunityObservationPost(post))
    .filter(isCommunityPostActive);
}

function normalizeCommunityObservationPost(post){
  const caption = String(post.caption || '');
  let typeId = post.observation_type || post.observationType || '';
  if(!typeId){
    if(/#?zeevonk|bioluminescentie|bioluminescence/i.test(caption)) typeId = 'seaspark';
    else if(/bliksem/i.test(caption)) typeId = 'lightning';
    else if(/onweer|donder/i.test(caption)) typeId = 'thunder';
    else if(/hagel/i.test(caption)) typeId = 'hail';
    else if(/sneeuw/i.test(caption)) typeId = 'snow';
    else if(/mist|nevel/i.test(caption)) typeId = 'fog';
    else if(/wateroverlast|overstrom/i.test(caption)) typeId = 'flooding';
    else if(/glad|ijzel|ijs/i.test(caption)) typeId = 'ice';
    else if(/zware regen|stortregen|hevige regen/i.test(caption)) typeId = 'heavy_rain';
    else if(/regen|bui|motregen/i.test(caption)) typeId = 'rain';
  }
  const type = communityObservationType(typeId);
  const createdMs = new Date(post.created_at || Date.now()).getTime();
  return {
    ...post,
    observation_type: type?.id || typeId || '',
    observation_ttl_minutes: post.observation_ttl_minutes || type?.ttlMinutes || null,
    expires_at: post.expires_at || (type ? new Date(createdMs + type.ttlMinutes * 60000).toISOString() : null)
  };
}

function isCommunityPostActive(post){
  if(!post.expires_at) return true;
  return new Date(post.expires_at).getTime() > Date.now();
}

function renderCommunityLoading(){
  if(state.community.posts.length) return;
  const feed = $('#communityFeed');
  if(feed) feed.innerHTML = '<div class="community-empty">Community laden...</div>';
}

function renderCommunityEmpty(text){
  const feed = $('#communityFeed');
  if(feed) feed.innerHTML = `<div class="community-empty">${esc(text)}</div>`;
  $('#communityLoadMore')?.classList.add('hidden');
  renderCommunityLiveStats();
}

function timeAgo(value){
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const min = Math.floor(diff/60000);
  if(min < 1) return 'net nu';
  if(min < 60) return `${min} min geleden`;
  const h = Math.floor(min/60);
  if(h < 24) return `${h} u geleden`;
  return `${Math.floor(h/24)} d geleden`;
}

function communityDistanceKm(lat1, lon1, lat2, lon2){
  const a1=Number(lat1), o1=Number(lon1), a2=Number(lat2), o2=Number(lon2);
  if(![a1,o1,a2,o2].every(Number.isFinite)) return null;
  const r=6371, toRad=v=>v*Math.PI/180;
  const dLat=toRad(a2-a1), dLon=toRad(o2-o1);
  const h=Math.sin(dLat/2)**2 + Math.cos(toRad(a1))*Math.cos(toRad(a2))*Math.sin(dLon/2)**2;
  return 2*r*Math.asin(Math.min(1,Math.sqrt(h)));
}
function filteredCommunityPosts(){
  const filter = state.community.quickFilter || 'foryou';
  if(filter === 'sun') return state.community.posts.filter(p=>['sunset','sunrise'].includes(p.category) || /zon|opklaring|zonsopkomst|zonsondergang/i.test(p.caption||''));
  if(filter === 'nearby') {
    const here = state.loc || {};
    const hereName = String(here.name || '').toLowerCase();
    return state.community.posts.filter(p=>{
      const d = communityDistanceKm(here.lat, here.lon, p.latitude ?? p.lat, p.longitude ?? p.lon);
      if(d != null) return d <= 50;
      return hereName && String(p.location_name || '').toLowerCase().includes(hereName);
    });
  }
  return state.community.posts;
}
function renderCommunityFeed(){
  const feed = $('#communityFeed');
  if(!feed) return;
  const posts = filteredCommunityPosts();
  if(!posts.length){
    const label = state.community.quickFilter === 'nearby' ? 'Geen recente weerposts in de buurt.' : state.community.quickFilter === 'sun' ? 'Nog geen recente zon- of opklaringsfoto’s.' : 'Nog geen communityposts. Deel de eerste weerfoto.';
    feed.innerHTML = `<div class="community-empty">${wheaterflowStatus('empty',label)}</div>`;
  }else{
    feed.innerHTML = posts.map(communityPostHtml).join('');
  }
  $('#communityLoadMore')?.classList.toggle('hidden', !state.community.hasMore);
}

function communityObservationMeta(post){
  const type = communityObservationType(post.observation_type);
  if(!type) return null;
  const expiresMs = post.expires_at ? new Date(post.expires_at).getTime() : null;
  const minutesLeft = expiresMs ? Math.max(0, Math.ceil((expiresMs - Date.now()) / 60000)) : null;
  const same = state.community.posts.filter(other=>{
    if(other.id === post.id) return false;
    if((other.observation_type || other.category) !== (post.observation_type || post.category)) return false;
    const sameLocation = post.location_name && other.location_name && post.location_name === other.location_name;
    const sameRoundedLat = post.latitude != null && other.latitude != null && Math.abs(+post.latitude - +other.latitude) <= 0.03;
    const sameRoundedLon = post.longitude != null && other.longitude != null && Math.abs(+post.longitude - +other.longitude) <= 0.03;
    return sameLocation || (sameRoundedLat && sameRoundedLon);
  }).length;
  const reliability = same >= 2 ? 'Sterk bevestigd' : same === 1 ? 'Bevestigd door buurt' : 'Nieuwe melding';
  return {type, minutesLeft, reliability};
}

function communityMiniIcon(name){
  const stroke='stroke="currentColor" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  if(name==='temp') return `<svg viewBox="0 0 24 24" ${stroke}><path d="M10 4a2 2 0 014 0v9.2a4 4 0 11-4 0V4z"/><path d="M12 14v4"/></svg>`;
  if(name==='wind') return `<svg viewBox="0 0 24 24" ${stroke}><path d="M3 8h11a2.5 2.5 0 10-2.2-3.7M3 12h15a2 2 0 10-1.8-2.9M3 16h12a2.5 2.5 0 11-2.2 3.7"/></svg>`;
  if(name==='rain') return `<svg viewBox="0 0 24 24" ${stroke}><path d="M12 3s6 7 6 11.3a6 6 0 11-12 0C6 10 12 3 12 3z"/></svg>`;
  if(name==='heart') return `<svg viewBox="0 0 24 24" ${stroke}><path d="M20.8 4.8a5.5 5.5 0 00-7.8 0L12 5.8l-1-1a5.5 5.5 0 00-7.8 7.8L12 21l8.8-8.4a5.5 5.5 0 000-7.8z"/></svg>`;
  if(name==='comment') return `<svg viewBox="0 0 24 24" ${stroke}><path d="M21 12a8 8 0 01-8 8H7l-4 2 1.2-4.3A8 8 0 1121 12z"/></svg>`;
  if(name==='share') return `<svg viewBox="0 0 24 24" ${stroke}><path d="M12 16V4m0 0L8 8m4-4 4 4"/><path d="M5 11v8h14v-8"/></svg>`;
  if(name==='save') return `<svg viewBox="0 0 24 24" ${stroke}><path d="M6 3h12v18l-6-4-6 4V3z"/></svg>`;
  return '';
}
function communityPostHtml(post){
  const cat=communityCategory(post.category), obs=communityObservationMeta(post), profile=post.profiles||{};
  const name=profile.display_name||'Wheaterflow gebruiker';
  const avatar=profile.avatar_url?`<img src="${esc(profile.avatar_url)}" alt="">`:esc(userInitials(name));
  const verified=Boolean(profile.verified||profile.is_verified||profile.verified_at);
  const liked=post.community_likes?.some(l=>l.user_id===state.auth.user?.id), saved=post.community_favorites?.some(f=>f.user_id===state.auth.user?.id);
  const comments=(post.community_comments||[]).slice(0,3), hasPhoto=Boolean(post.photo_url);
  const weatherParts=[];
  if(validNumber(post.temperature)!=null) weatherParts.push(`<span>${communityMiniIcon('temp')}<b>${fmtTemp(post.temperature)}</b></span>`);
  if(validNumber(post.wind_speed)!=null) weatherParts.push(`<span>${communityMiniIcon('wind')}<b>Wind ${fmtWind(post.wind_speed)}</b></span>`);
  if(validNumber(post.precipitation)!=null) weatherParts.push(`<span>${communityMiniIcon('rain')}<b>${fmtPrecip(post.precipitation)}</b></span>`);
  const media=hasPhoto?`<div class="community-photo-media"><img class="community-photo" src="${esc(post.photo_url)}" alt="${esc(post.caption||cat.label)}" loading="lazy"><div class="community-category">${communityWeatherIcon(obs?.type?.id||cat.id,18)}${esc(cat.label)}</div></div>`:'';
  return `<article class="community-post ${hasPhoto?'community-photo-post':'community-observation-post'}" data-post-id="${post.id}">
    <div class="community-post-head"><div class="community-avatar">${avatar}</div><div class="community-author-copy"><div class="community-post-name">${esc(name)}${verified?'<span class="community-verified" aria-label="Geverifieerd">✓</span>':''}</div><div class="community-post-place">${esc(post.location_name||'Locatie verborgen')} · ${timeAgo(post.created_at)}</div></div><button class="community-more" data-act="report" type="button" aria-label="Meer opties">•••</button></div>
    ${media}
    ${!hasPhoto?`<div class="community-observation-main"><div class="community-observation-icon">${communityWeatherIcon(obs?.type?.id||cat.id,38)}</div><div><b>${esc(obs?.type?.label||cat.label)}</b>${post.caption?`<p>${linkHashtags(esc(post.caption))}</p>`:''}</div></div>`:''}
    <div class="community-body">${hasPhoto&&post.caption?`<p class="community-caption">${linkHashtags(esc(post.caption))}</p>`:''}${weatherParts.length?`<div class="community-weather-line">${weatherParts.join('')}</div>`:''}</div>
    <div class="community-actions"><button class="${liked?'active':''}" data-act="like" aria-label="Vind ik leuk">${communityMiniIcon('heart')}<span>${post.like_count||0}</span></button><button data-act="comment" aria-label="Reageren">${communityMiniIcon('comment')}<span>${post.comment_count||0}</span></button><span class="community-action-spacer"></span><button data-act="share" aria-label="Delen">${communityMiniIcon('share')}</button><button class="${saved?'active':''}" data-act="save" aria-label="Bewaren">${communityMiniIcon('save')}</button></div>
    <div class="community-comments">${comments.map(c=>`<div class="community-comment"><b>${esc(c.profiles?.display_name||'Gebruiker')}</b> ${esc(c.body)}</div>`).join('')}<form class="community-comment-row"><input name="body" maxlength="240" placeholder="Reageer..." autocomplete="off"><button type="submit">Plaats</button></form></div>
  </article>`;
}

function linkHashtags(text){
  return text.replace(/(^|\s)(#[a-zA-Z0-9_]+)/g, (m, space, tag)=>`${space}<button class="linkbtn community-hashtag" data-tag="${esc(tag.slice(1).toLowerCase())}" type="button">${esc(tag)}</button>`);
}

async function handleQuickObservationClick(e){
  const btn = e.target.closest('button[data-observation-type]');
  if(!btn) return;
  await submitQuickObservation(btn.dataset.observationType, btn);
}

function communityPrivacyLocation(loc, privacy='municipality'){
  if(privacy === 'none') return {location_name:'', latitude:'', longitude:''};
  const name = loc.name || state.loc.name || 'Huidige locatie';
  if(privacy === 'exact') return {location_name:name, latitude:loc.lat, longitude:loc.lon};
  return {
    location_name:name,
    latitude:Number.isFinite(+loc.lat) ? Math.round(+loc.lat * 100) / 100 : '',
    longitude:Number.isFinite(+loc.lon) ? Math.round(+loc.lon * 100) / 100 : ''
  };
}

async function submitQuickObservation(typeId, button=null){
  if(!requireCommunityLogin()) return;
  const type = communityObservationType(typeId);
  if(!type) return;
  if(button){ button.disabled = true; button.classList.add('sending'); }
  try{
    const gps = await getBrowserLocation();
    const baseLoc = gps ? {lat:gps.lat, lon:gps.lon, ...(await reverseGeocode(gps.lat, gps.lon))} : {lat:state.loc.lat, lon:state.loc.lon, name:state.loc.name, admin:state.loc.admin};
    const safeLoc = communityPrivacyLocation(baseLoc, 'municipality');
    const cur = liveWeatherSnapshot();
    const expiresAt = new Date(Date.now() + type.ttlMinutes * 60000).toISOString();
    const caption = `${type.label} gemeld in ${safeLoc.location_name || 'de buurt'}.`;
    const form = new FormData();
    form.append('caption', caption);
    form.append('category', type.category);
    form.append('location_privacy', 'municipality');
    form.append('location_name', safeLoc.location_name);
    if(safeLoc.latitude !== '') form.append('latitude', String(safeLoc.latitude));
    if(safeLoc.longitude !== '') form.append('longitude', String(safeLoc.longitude));
    form.append('observation_type', type.id);
    form.append('observation_ttl_minutes', String(type.ttlMinutes));
    form.append('expires_at', expiresAt);
    form.append('data_quality', 'community-waarneming');
    form.append('temperature', cur?.temperature_2m ?? '');
    form.append('apparent_temperature', cur?.apparent_temperature ?? '');
    form.append('wind_speed', cur?.wind_speed_10m ?? '');
    form.append('precipitation', cur?.precipitation ?? '');
    form.append('humidity', cur?.relative_humidity_2m ?? '');
    form.append('uv_index', state.hourly?.uv_index?.[nowIndexInHourly()] ?? '');
    form.append('pressure', cur?.pressure_msl ?? '');
    form.append('weather_source', 'Community, niet officieel');
    let saved;
    try{
      saved = await apiForm('/community/posts', form);
    }catch(error){
      const fallback = new FormData();
      fallback.append('caption', `${caption} #${type.id} #communitywaarneming`);
      fallback.append('category', type.category);
      fallback.append('location_privacy', 'municipality');
      fallback.append('location_name', safeLoc.location_name);
      if(safeLoc.latitude !== '') fallback.append('latitude', String(safeLoc.latitude));
      if(safeLoc.longitude !== '') fallback.append('longitude', String(safeLoc.longitude));
      fallback.append('temperature', cur?.temperature_2m ?? '');
      fallback.append('apparent_temperature', cur?.apparent_temperature ?? '');
      fallback.append('wind_speed', cur?.wind_speed_10m ?? '');
      fallback.append('precipitation', cur?.precipitation ?? '');
      fallback.append('humidity', cur?.relative_humidity_2m ?? '');
      fallback.append('uv_index', state.hourly?.uv_index?.[nowIndexInHourly()] ?? '');
      fallback.append('pressure', cur?.pressure_msl ?? '');
      fallback.append('weather_source', 'Community, niet officieel');
      saved = await apiForm('/community/posts', fallback);
    }
    const optimisticPost = normalizeCommunityObservationPost({
      id:saved.post?.id || saved.id || safeRandomId(),
      user_id:state.auth.user?.id,
      profiles:{display_name:state.auth.profile?.display_name || state.auth.user?.email?.split('@')[0] || 'Wheaterflow gebruiker', avatar_url:state.auth.profile?.avatar_url},
      caption,
      category:type.category,
      observation_type:type.id,
      observation_ttl_minutes:type.ttlMinutes,
      expires_at:expiresAt,
      location_name:safeLoc.location_name,
      latitude:safeLoc.latitude,
      longitude:safeLoc.longitude,
      temperature:cur?.temperature_2m,
      apparent_temperature:cur?.apparent_temperature,
      wind_speed:cur?.wind_speed_10m,
      precipitation:cur?.precipitation,
      humidity:cur?.relative_humidity_2m,
      created_at:new Date().toISOString(),
      like_count:0,
      comment_count:0,
      community_likes:[],
      community_favorites:[],
      community_comments:[]
    });
    state.community.posts = [optimisticPost, ...state.community.posts.filter(p=>p.id !== optimisticPost.id)];
    renderCommunityFeed();
    renderCommunityLiveStats();
    if(state.community.view === 'map') renderCommunityMapMarkers();
    toast(`${type.label} gemeld.`);
    setTimeout(()=>loadCommunityPosts(true), 900);
  }catch(e){
    console.warn('Snelle communitywaarneming mislukt:', e?.message || e);
    toast(e?.status === 401 ? 'Log opnieuw in om te melden.' : 'Waarneming kon niet worden geplaatst.');
  }finally{
    if(button){ button.disabled = false; button.classList.remove('sending'); }
  }
}

async function handleCommunityAction(e){
  const tagButton = e.target.closest('.community-hashtag');
  if(tagButton){
    state.community.query = '#' + tagButton.dataset.tag;
    $('#communitySearch').value = state.community.query;
    loadCommunityPosts(true);
    return;
  }
  const btn = e.target.closest('button[data-act]');
  if(!btn) return;
  const postEl = btn.closest('.community-post');
  const postId = postEl?.dataset.postId;
  if(!postId) return;
  const act = btn.dataset.act;
  if(act === 'share') return shareCommunityPost(postId);
  if(!requireCommunityLogin()) return;
  if(act === 'like') await toggleCommunityRelation('community_likes', postId);
  if(act === 'save') await toggleCommunityRelation('community_favorites', postId);
  if(act === 'report') await reportCommunityPost(postId);
  if(act === 'comment'){
    postEl.classList.toggle('comments-open');
    if(postEl.classList.contains('comments-open')) setTimeout(()=>postEl.querySelector('input[name=body]')?.focus(), 40);
  }
}

async function toggleCommunityRelation(table, postId){
  const kind = table === 'community_likes' ? 'like' : 'save';
  try{ await apiJson(`/community/posts/${encodeURIComponent(postId)}/${kind}`, {method:'POST'}); await loadCommunityPosts(true); }
  catch(e){ toast('Actie kon niet worden uitgevoerd.'); }
}

async function handleCommunityCommentSubmit(e){
  const form = e.target.closest('.community-comment-row');
  if(!form) return; e.preventDefault();
  if(!requireCommunityLogin()) return;
  const postId = form.closest('.community-post')?.dataset.postId;
  const body = form.body.value.trim(); if(!postId || !body) return;
  try{ await apiJson(`/community/posts/${encodeURIComponent(postId)}/comments`, {method:'POST', body:JSON.stringify({body})}); form.reset(); await loadCommunityPosts(true); }
  catch(e){ toast('Reactie kon niet worden geplaatst.'); }
}

async function reportCommunityPost(postId){
  const reason = prompt('Waarom wil je deze post rapporteren?'); if(!reason) return;
  try{ await apiJson(`/community/posts/${encodeURIComponent(postId)}/report`, {method:'POST', body:JSON.stringify({reason:reason.slice(0,300)})}); toast('Bedankt, we bekijken deze melding.'); }
  catch(e){ toast('Rapport kon niet worden verzonden.'); }
}

function shareCommunityPost(postId){
  const url = `${location.origin}${location.pathname}#community-${postId}`;
  if(navigator.share) navigator.share({title:'Wheaterflow Community', url}).catch(()=>undefined);
  else navigator.clipboard?.writeText(url).then(()=>toast('Link gekopieerd.'));
}

function renderCommunityLiveStats(){
  const counts = state.community.posts.reduce((acc,p)=>{ acc[p.category]=(acc[p.category]||0)+1; return acc; }, {});
  const top = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([cat,n])=>`${n} ${communityCategory(cat).label.toLowerCase()}`).join(' - ');
  const text = state.community.posts.length ? `${state.community.posts.length} recente uploads${top ? ' - ' + top : ''}` : 'Nog geen live uploads';
  if($('#communityLiveStats b')) $('#communityLiveStats b').textContent = text;
}


function setCommunityComposerMode(mode='photo'){
  state.community.composerMode=mode;
  $$('#communityComposerModes [data-community-mode]').forEach(b=>b.classList.toggle('active',b.dataset.communityMode===mode));
  $('#communityPhotoPicker')?.classList.toggle('hidden',mode==='observation');
  if($('#communityComposerTitle')) $('#communityComposerTitle').textContent=mode==='photo'?'Weerfoto delen':'Waarneming melden';
  if($('#communityCaption')) $('#communityCaption').placeholder=mode==='photo'?'Wat zie je? Voeg een korte beschrijving toe.':'Beschrijf kort wat je waarneemt.';
}
function openCommunityComposer(){
  if(!requireCommunityLogin()) return;
  lockPageScroll();
  $('#communityComposer')?.classList.add('show');
  $('#communityScrim')?.classList.add('show');
  updateCommunityCapturedWeather();
}
function closeCommunityComposer(){
  $('#communityComposer')?.classList.remove('show');
  $('#communityScrim')?.classList.remove('show');
  unlockPageScroll();
}

function handleCommunityPhotoSelect(e){
  const file = e.target.files?.[0];
  state.community.selectedFile = file || null;
  const preview = $('#communityPhotoPreview');
  if(file && preview){
    preview.src = URL.createObjectURL(file);
    preview.classList.remove('hidden');
  }else if(preview){
    preview.removeAttribute('src');
    preview.classList.add('hidden');
  }
}

function updateCommunityCapturedWeather(){
  const cur = liveWeatherSnapshot();
  if(!cur || !$('#communityCapturedWeather')) return;
  $('#communityCapturedWeather').textContent = `${state.loc.name}: ${fmtTemp(cur.temperature_2m)}, voelt ${fmtTemp(cur.apparent_temperature)}, wind ${fmtWind(cur.wind_speed_10m)}, ${fmtPrecip(cur.precipitation || 0)}, ${cur.relative_humidity_2m}% vocht.`;
}

async function createCommunityPost(){
  if(!requireCommunityLogin()) return;
  const file = state.community.selectedFile;
  const caption = $('#communityCaption')?.value.trim() || '';
  if(state.community.composerMode==='photo' && !file) return setCommunityComposerMessage('Kies eerst een foto voor een weerfotobericht.', 'error');
  if(!file && caption.length < 3) return setCommunityComposerMessage('Beschrijf kort je waarneming.', 'error');
  try{
    setCommunityComposerMessage(file ? 'Foto voorbereiden...' : 'Bericht voorbereiden...');
    const blob = file ? await compressAvatar(file) : null;
    const gps = $('#communityUseGps')?.checked ? await getBrowserLocation() : null;
    const privacy = $('#communityLocationPrivacy')?.value || 'municipality';
    const loc = gps ? {lat:gps.lat, lon:gps.lon, ...(await reverseGeocode(gps.lat,gps.lon))} : {lat:state.loc.lat, lon:state.loc.lon, name:state.loc.name, admin:state.loc.admin};
    const cur = liveWeatherSnapshot();
    let category = $('#communityCategorySelect')?.value || 'other';
    if(category === 'other' && /(^|\s|#)(zeevonk|seaspark|bioluminescentie|bioluminescence)(\s|$|[.,!?])/i.test(caption)) category = 'seaspark';
    const form = new FormData();
    if(blob) form.append('photo', blob, 'weather.webp');
    form.append('caption', caption);
    form.append('category', category);
    form.append('location_privacy', privacy);
    form.append('location_name', privacy === 'none' ? '' : (loc.name || state.loc.name));
    if(privacy === 'exact'){ form.append('latitude', String(loc.lat)); form.append('longitude', String(loc.lon)); }
    form.append('temperature', cur?.temperature_2m ?? '');
    form.append('apparent_temperature', cur?.apparent_temperature ?? '');
    form.append('wind_speed', cur?.wind_speed_10m ?? '');
    form.append('precipitation', cur?.precipitation ?? '');
    form.append('humidity', cur?.relative_humidity_2m ?? '');
    form.append('uv_index', state.hourly?.uv_index?.[nowIndexInHourly()] ?? '');
    form.append('pressure', cur?.pressure_msl ?? '');
    form.append('weather_source', state.observation ? state.observation.source : 'KNMI HARMONIE');
    form.append('data_quality', 'community-waarneming');
    await apiForm('/community/posts', form);
    setCommunityComposerMessage('Geplaatst.', 'ok');
    $('#communityCaption').value=''; $('#communityPhotoInput').value=''; $('#communityPhotoPreview')?.classList.add('hidden');
    state.community.selectedFile=null; closeCommunityComposer(); await loadCommunityPosts(true); toast(file ? 'Weerfoto gedeeld.' : 'Weerbericht gedeeld.');
  }catch(e){ console.warn('Community upload mislukt:', e?.message || e); setCommunityComposerMessage('Uploaden lukte niet. Controleer je verbinding.', 'error'); }
}

function setCommunityComposerMessage(msg, type=''){
  const el = $('#communityComposerMessage');
  if(!el) return;
  el.textContent = msg || '';
  el.className = 'auth-message' + (type ? ' ' + type : '');
}

function initCommunityMap(){
  if(!window.L || !$('#communityMap')) return;
  if(!state.community.map){
    state.community.map = L.map('communityMap', {zoomControl:true, attributionControl:true, zoomSnap:.25}).setView([50.85,4.35], 7);
    addOpenFreeMapBase(state.community.map);
    state.community.markers = window.L.markerClusterGroup
      ? L.markerClusterGroup({showCoverageOnHover:false, maxClusterRadius:46, spiderfyOnMaxZoom:true})
      : L.layerGroup();
    state.community.markers.addTo(state.community.map);
  }
  state.community.map.invalidateSize();
  renderCommunityMapMarkers();
}

function renderCommunityMapMarkers(){
  if(!state.community.map || !state.community.markers) return;
  state.community.markers.clearLayers();
  state.community.posts.filter(p=>p.latitude != null && p.longitude != null).forEach(post=>{
    const cat = communityCategory(post.category);
    const marker = L.circleMarker([+post.latitude, +post.longitude], {radius:9, color:'#fff', weight:2, fillColor:cat.color, fillOpacity:.95});
    const popupMedia = post.photo_url
      ? `<img src="${esc(post.photo_url)}" style="width:150px;border-radius:10px;margin-top:6px;">`
      : (post.caption ? `<p style="max-width:170px;margin:6px 0 0;">${esc(post.caption)}</p>` : '');
    marker.bindPopup(`<b>${esc(cat.label)}</b><br>${esc(post.location_name || '')}<br>${popupMedia}`);
    marker.addTo(state.community.markers);
  });
}

function renderCommunityCollection(){
  const mine = state.community.posts.filter(p=>p.user_id === state.auth.user?.id);
  const likes = mine.reduce((sum,p)=>sum + (p.like_count || 0), 0);
  const counts = mine.reduce((acc,p)=>{ acc[p.category]=(acc[p.category]||0)+1; return acc; }, {});
  const topCat = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
  $('#communityCollection').innerHTML = `<div class="community-stat-grid">
    <div class="community-stat"><b>${mine.length}</b><span>Uploads</span></div>
    <div class="community-stat"><b>${likes}</b><span>Likes ontvangen</span></div>
    <div class="community-stat"><b>${topCat ? communityCategory(topCat[0]).label : '-'}</b><span>Meeste categorie</span></div>
    <div class="community-stat"><b>${state.loc.name}</b><span>Favoriete plaats</span></div>
  </div>`;
  renderCommunityLeaderboard();
}

function renderCommunityLeaderboard(){
  const byUser = new Map();
  state.community.posts.forEach(p=>{
    const name = p.profiles?.display_name || 'Gebruiker';
    const cur = byUser.get(name) || {uploads:0, likes:0};
    cur.uploads += 1; cur.likes += p.like_count || 0;
    byUser.set(name, cur);
  });
  const rows = [...byUser.entries()].sort((a,b)=>(b[1].likes+b[1].uploads)-(a[1].likes+a[1].uploads)).slice(0,5);
  $('#communityLeaderboard').innerHTML = `<div class="card"><div class="card-title">Top spotters</div>${rows.length ? rows.map(([name,v],i)=>`<div class="sheet-row"><span>${i+1}. ${esc(name)}</span><b>${v.uploads} uploads - ${v.likes} likes</b></div>`).join('') : '<div class="subtle">Nog geen leaderboarddata.</div>'}</div>`;
}

function subscribeCommunityRealtime(){
  if(state.community.realtimeChannel) return;
  state.community.realtimeChannel = setInterval(()=>{
    if(!document.hidden && state.activeTab === 'community') loadCommunityPosts(true);
  }, 20000);
}

function wireSeg(id, key){
  const seg = $(id);
  if(!seg) return;
  $$('button', seg).forEach(b=>{
    b.addEventListener('click', ()=>{
      $$('button', seg).forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      if(key==='days'){ state.units.days = +b.dataset.v; } else { state.units[key] = b.dataset.v; }
      saveUnits();
      if(key==='model'){
        saveUnits();
        loadWeather();
        const labels = {best_match:'Automatisch', ecmwf_ifs025:'ECMWF', icon_eu:'ICON-EU', gfs_seamless:'GFS', knmi_seamless:'Harmonie (Benelux)'};
        toast(`${labels[state.units.model] || 'Weermodel'} actief`);
        return;
      }
      if(state.current) renderHome();
      if($('#stormscreen').classList.contains('active')) updateStormTab();
    });
  });
}
wireSeg('#segTemp','temp'); wireSeg('#segWind','wind'); wireSeg('#segPrecip','precip'); wireSeg('#segPress','press'); wireSeg('#segDays','days'); wireSeg('#segModel','model');
$("#manualRefresh")?.addEventListener('click', ()=>{ loadWeather(); toast('Wordt ververst...'); });

function isStandaloneApp(){
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function supportsPushNotifications(){
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function registerAppServiceWorker(){
  if(!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.register(new URL('./service-worker.js', location.href), {scope:'./'});
  if(reg.waiting) showUpdateToast(reg.waiting);
  reg.addEventListener('updatefound', ()=>{
    const worker = reg.installing;
    worker?.addEventListener('statechange', ()=>{
      if(worker.state === 'installed' && navigator.serviceWorker.controller) showUpdateToast(worker);
    });
  });
  return reg;
}

function showUpdateToast(worker){
  const t = $('#toast');
  t.innerHTML = `Nieuwe versie beschikbaar <button id="reloadAppBtn" type="button">Vernieuwen</button>`;
  t.classList.add('show','update');
  $('#reloadAppBtn')?.addEventListener('click', ()=>{
    worker.postMessage?.({type:'SKIP_WAITING'});
    location.reload();
  });
}

async function getPushConfig(){
  try{
    const r = await fetch(PUSH_FUNCTION_BASE + 'push-config', {cache:'no-store'});
    if(!r.ok) return {configured:false};
    return await r.json();
  }catch(e){
    return {configured:false};
  }
}

function urlBase64ToUint8Array(base64String){
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for(let i=0;i<rawData.length;i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function collectPushPayload(subscription){
  return {
    installationId: state.push.installationId,
    subscription: subscription.toJSON ? subscription.toJSON() : subscription,
    location: state.loc,
    preferences: state.push.preferences,
    thresholds: state.push.thresholds
  };
}

async function enablePushNotifications(){
  updatePushUi('Controleren...');
  if(!supportsPushNotifications()){
    updatePushUi('Niet ondersteund');
    return toast('Meldingen worden niet ondersteund op dit toestel.');
  }
  state.push.standalone = isStandaloneApp();
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if(isIos && !state.push.standalone){
    updatePushUi('Installeer eerst de app');
    return;
  }
  const config = await getPushConfig();
  if(!config.configured || !config.vapidPublicKey){
    updatePushUi('Tijdelijk offline');
    return toast('Meldingen zijn nog niet volledig ingesteld op de Wheaterflow-server.');
  }
  const registration = await registerAppServiceWorker();
  const permission = await Notification.requestPermission();
  if(permission !== 'granted'){
    updatePushUi(permission === 'denied' ? 'Geblokkeerd' : 'Toestemming vereist');
    return;
  }
  const ready = await navigator.serviceWorker.ready;
  let subscription = await ready.pushManager.getSubscription();
  if(!subscription){
    subscription = await ready.pushManager.subscribe({
      userVisibleOnly:true,
      applicationServerKey:urlBase64ToUint8Array(config.vapidPublicKey)
    });
  }
  const r = await fetch(PUSH_FUNCTION_BASE + 'push-subscribe', {
    method:'POST',
    headers:{
      'content-type':'application/json',
      ...(state.auth.session?.access_token ? {authorization:`Bearer ${state.auth.session.access_token}`} : {})
    },
    body:JSON.stringify(collectPushPayload(subscription))
  });
  if(!r.ok) throw new Error(await pushErrorText(r, 'Meldingen konden niet worden ingesteld. Controleer de Wheaterflow-server.'));
  updatePushUi('Ingeschakeld');
  syncProfileSettingsToCloud();
  toast('Meldingen ingeschakeld');
}

async function disablePushNotifications(){
  if(!supportsPushNotifications()) return updatePushUi('Niet ondersteund');
  const registration = await navigator.serviceWorker.ready.catch(()=>null);
  const subscription = await registration?.pushManager.getSubscription();
  if(subscription){
    await fetch(PUSH_FUNCTION_BASE + 'push-unsubscribe', {
      method:'DELETE',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({endpoint:subscription.endpoint, installationId:state.push.installationId})
    }).catch(()=>undefined);
    await subscription.unsubscribe().catch(()=>undefined);
  }
  updatePushUi('Toestemming vereist');
  syncProfileSettingsToCloud();
  toast('Meldingen uitgeschakeld');
}

async function sendTestPushNotification(){
  const registration = await navigator.serviceWorker.ready.catch(()=>null);
  const subscription = await registration?.pushManager.getSubscription();
  if(!subscription) return toast('Schakel eerst meldingen in.');
  const r = await fetch(PUSH_FUNCTION_BASE + 'push-test', {
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({endpoint:subscription.endpoint, installationId:state.push.installationId})
  });
  if(!r.ok) return toast(await pushErrorText(r, 'Testmelding kon niet worden verzonden. Probeer het later opnieuw.'));
  toast('Testmelding verzonden. Sluit Wheaterflow om dit te testen.');
}

async function pushErrorText(response, fallback){
  try{
    const data = await response.json();
    if(data.error) console.warn('Pushmelding fout:', data.error);
    return fallback;
  }catch(e){
    return fallback;
  }
}

async function updatePushState(){
  state.push.supported = supportsPushNotifications();
  state.push.standalone = isStandaloneApp();
  if(!state.push.supported) return updatePushUi('Niet ondersteund');
  if(Notification.permission === 'denied') return updatePushUi('Geblokkeerd');
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if(isIos && !state.push.standalone) return updatePushUi('Installeer eerst de app');
  const config = await getPushConfig();
  state.push.configured = Boolean(config.configured);
  if(!state.push.configured) return updatePushUi('Tijdelijk offline');
  const reg = await registerAppServiceWorker().catch(()=>null);
  const sub = await reg?.pushManager.getSubscription().catch(()=>null);
  if(sub) return updatePushUi('Ingeschakeld');
  updatePushUi(Notification.permission === 'granted' ? 'Toestemming vereist' : 'Toestemming vereist');
}

function updatePushUi(status){
  state.push.status = status;
  const statusEl = $('#pushStatusText');
  if(statusEl) statusEl.textContent = status;
  const coastLabel = $('#pushCoastLabel');
  if(coastLabel) coastLabel.textContent = `Kustwaarschuwingen · ${locationDisplayName('Oostende')}`;
  $('#pushInstallCard')?.classList.toggle('show', status === 'Installeer eerst de app');
  const enabled = status === 'Ingeschakeld';
  if($('#enablePushBtn')) $('#enablePushBtn').disabled = enabled || status === 'Niet ondersteund' || status === 'Geblokkeerd';
  if($('#testPushBtn')) $('#testPushBtn').disabled = !enabled;
  if($('#disablePushBtn')) $('#disablePushBtn').disabled = !enabled;
}

function refreshPushSettingsControls(){
  $$('#pushPrefs input[type=checkbox]').forEach(input=>{
    input.checked = state.push.preferences[input.dataset.pref] !== false;
  });
  const thresholdMap = [
    ['pushRainThreshold','rainProbability'],
    ['pushWindThreshold','windGust'],
    ['pushHeatThreshold','heat'],
    ['pushFrostThreshold','frost']
  ];
  thresholdMap.forEach(([id,key])=>{
    const el = $('#'+id);
    if(el && state.push.thresholds[key] != null) el.value = state.push.thresholds[key];
  });
}

function initSettingsAccordion(){
  $$('#settingsSheet .settings-collapsible').forEach((section,index)=>{
    const head=$('.settings-section-head',section);
    if(!head) return;
    const requested=section.dataset.settingsOpen==='true';
    section.classList.toggle('settings-collapsed',!requested);
    head.setAttribute('aria-expanded',String(requested));
    const toggle=()=>{
      const willOpen=section.classList.contains('settings-collapsed');
      section.classList.toggle('settings-collapsed',!willOpen);
      section.dataset.settingsOpen=String(willOpen);
      head.setAttribute('aria-expanded',String(willOpen));
    };
    if(head.dataset.accordionWired==='1') return;
    head.dataset.accordionWired='1';
    head.addEventListener('click',event=>{
      if(event.target.closest('button,a,input,select,label')) return;
      toggle();
    });
    head.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){ event.preventDefault(); toggle(); }
    });
  });
}

function refreshSettingsSegments(){
  $$('#segTemp button').forEach(b=>b.classList.toggle('active', b.dataset.v===state.units.temp));
  $$('#segWind button').forEach(b=>b.classList.toggle('active', b.dataset.v===state.units.wind));
  $$('#segPrecip button').forEach(b=>b.classList.toggle('active', b.dataset.v===state.units.precip));
  $$('#segPress button').forEach(b=>b.classList.toggle('active', b.dataset.v===state.units.press));
  $$('#segDays button').forEach(b=>b.classList.toggle('active', +b.dataset.v===state.units.days));
  $$('#segModel button').forEach(b=>b.classList.toggle('active', b.dataset.v===state.units.model));
}

function wirePushSettings(){
  loadPushSettings();
  $$('#pushPrefs input[type=checkbox]').forEach(input=>{
    input.checked = state.push.preferences[input.dataset.pref] !== false;
    input.addEventListener('change', ()=>{
      state.push.preferences[input.dataset.pref] = input.checked;
      savePushSettings();
      syncProfileSettingsToCloud();
    });
  });
  const map = [
    ['pushRainThreshold','rainProbability'],
    ['pushWindThreshold','windGust'],
    ['pushHeatThreshold','heat'],
    ['pushFrostThreshold','frost']
  ];
  map.forEach(([id,key])=>{
    const el = $('#'+id);
    if(!el) return;
    el.value = state.push.thresholds[key];
    el.addEventListener('change', ()=>{
      state.push.thresholds[key] = Number(el.value);
      savePushSettings();
      syncProfileSettingsToCloud();
    });
  });
  $('#enablePushBtn')?.addEventListener('click', ()=>enablePushNotifications().catch(e=>{ console.warn(e); updatePushUi('Tijdelijk offline'); toast('Meldingen konden niet worden ingesteld. Probeer het later opnieuw.'); }));
  $('#disablePushBtn')?.addEventListener('click', ()=>disablePushNotifications().catch(e=>{ console.warn(e); toast('Meldingen konden niet worden uitgeschakeld. Probeer het later opnieuw.'); }));
  $('#testPushBtn')?.addEventListener('click', ()=>sendTestPushNotification().catch(e=>{ console.warn(e); toast('Testmelding kon niet worden verzonden. Probeer het later opnieuw.'); }));
  updatePushState();
}

// long-press / click on home hero opens settings quickly via a gear tap area (top-right)
$('#home').addEventListener('dblclick', openSheet);

/* =========================================================================
   OPENFREEMAP BASEMAP
   Eén universele kaart voor iPhone, Android, desktop en tv.
   OpenFreeMap gebruikt OpenStreetMap-data en vereist geen API-key.
   De MapLibre-laag blijft binnen Leaflet zodat bestaande radar-, marker-
   en Xweather-lagen ongewijzigd kunnen blijven werken.
   ========================================================================= */
const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const OPENSTREETMAP_FALLBACK = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

function addOpenFreeMapBase(map, options={}){
  if(!map || !window.L) return null;
  const attribution = options.attribution !== false;
  try{
    if(typeof L.maplibreGL === 'function' && window.maplibregl){
      const layer = L.maplibreGL({
        style: OPENFREEMAP_STYLE,
        attributionControl:false,
        interactive:false
      }).addTo(map);
      if(attribution && map.attributionControl){
        map.attributionControl.addAttribution('&copy; OpenStreetMap contributors · OpenFreeMap');
      }
      return layer;
    }
  }catch(error){
    console.warn('OpenFreeMap/MapLibre kon niet starten; OpenStreetMap fallback wordt gebruikt.', error);
  }
  return L.tileLayer(OPENSTREETMAP_FALLBACK, {
    maxZoom:19,
    attribution: attribution ? '&copy; OpenStreetMap contributors' : ''
  }).addTo(map);
}

/* =========================================================================
   RADAR MAP
   ========================================================================= */
const XWEATHER_LAYER_DEFS = [
  {id:'radar', code:'radar', label:'Radar', short:'Radar', time:true, legend:'Neerslagintensiteit in mm/u', icon:'rain'},
  {id:'satellite', code:'satellite', label:'Satelliet', short:'Satelliet', time:true, legend:'Satellietbeelden, bron Xweather', icon:'cloud'},
  {id:'wind-particles', code:'wind-particles', label:'Winddeeltjes', short:'Wind', time:true, legend:'Windrichting en windsnelheid in km/u', icon:'wind'},
  {id:'wind-speeds', code:'wind-speeds', label:'Windsnelheid', short:'Wind', time:true, legend:'Windsnelheid in km/u', icon:'wind'},
  {id:'temperatures', code:'temperatures', label:'Temperatuur', short:'Temp', time:true, legend:'Temperatuur in graden Celsius', icon:'thermo'},
  {id:'feels-like', code:'feels-like', label:'Gevoelstemperatuur', short:'Voelt', time:true, legend:'Gevoelstemperatuur in graden Celsius', icon:'thermo'},
  {id:'cloud-cover', code:'cloud-cover', label:'Bewolking', short:'Wolken', time:true, legend:'Bewolkingsgraad in procent', icon:'cloud'},
  {id:'lightning-strikes-icons', code:'lightning-strikes-icons', label:'Bliksem', short:'Bliksem', time:true, overlay:true, legend:'Recente bliksemontladingen', icon:'storm'},
  {id:'snow', code:'snow', label:'Sneeuw', short:'Sneeuw', time:true, legend:'Sneeuwval of sneeuwbedekking waar beschikbaar', icon:'snow'},
  {id:'pressure-msl', code:'pressure-msl', label:'Luchtdruk', short:'Druk', time:true, legend:'Luchtdruk op zeeniveau in hPa', icon:'gauge'},
  {id:'humidity', code:'humidity', label:'Luchtvochtigheid', short:'Vocht', time:true, legend:'Relatieve luchtvochtigheid in procent', icon:'drop'},
  {id:'air-quality-index', code:'air-quality-index', label:'Luchtkwaliteit', short:'AQI', time:true, legend:'Luchtkwaliteitsindex', icon:'gauge'},
  {id:'wave-heights', code:'wave-heights', label:'Golven', short:'Golven', time:true, legend:'Golfhoogte en zeetoestand waar beschikbaar', icon:'wave'}
];

const XWEATHER_PRIMARY_IDS = ['radar','satellite','wind-particles','wind-speeds','temperatures','feels-like','cloud-cover','snow','pressure-msl','humidity','air-quality-index','wave-heights'];
const XWEATHER_TIMELESS_IDS = new Set([]);

const RADAR_LAYER_ALIASES = Object.freeze({
  precip:'precip', precipitation:'precip', radar:'precip', rain:'precip', rainviewer:'precip',
  satellite:'satellite', sat:'satellite',
  clouds:'cloud-cover', cloud:'cloud-cover', 'cloud-cover':'cloud-cover',
  temperature:'temperatures', temp:'temperatures', temperatures:'temperatures',
  wind:'wind-speeds', 'wind-speeds':'wind-speeds', 'wind-particles':'wind-particles',
  lightning:'lightning-strikes-icons', 'lightning-strikes-icons':'lightning-strikes-icons'
});
function normalizeRadarLayerId(id='precip'){
  return RADAR_LAYER_ALIASES[String(id||'').toLowerCase()] || String(id||'precip');
}
function nextPaint(){ return new Promise(resolve=>requestAnimationFrame(()=>resolve())); }
function syncRadarLayerUi(layerId=state.radar.layer){
  const normalized=normalizeRadarLayerId(layerId);
  $('#chipPrecip')?.classList.toggle('active', normalized==='precip');
  $('#chipSat')?.classList.toggle('active', normalized==='satellite');
  const quick={precip:'chipPrecip',satellite:'chipSat',temperatures:'radarQuickTemp','wind-speeds':'radarQuickWind','cloud-cover':'radarQuickCloud','lightning-strikes-icons':'radarQuickLightning'};
  $$('.radar-primary-layers button').forEach(btn=>btn.classList.toggle('active',btn.id===quick[normalized]));
}
function rememberRadarLayer(layerId){
  try{ localStorage.setItem('weerscoop:radarLayerV2', normalizeRadarLayerId(layerId)); }catch(e){}
}
async function activateRadarScreen(){
  if(state.radar.activating) return;
  state.radar.activating=true;
  try{
    // De screen is al actief. Twee animation frames laten layout/Leaflet eerst
    // een echte meetbare container zien; dit vervangt de oude 150/650ms timers.
    await nextPaint();
    await nextPaint();
    initMapIfNeeded();
    refreshRadarLayout();

    let saved=null;
    if(state.radar.initialized){
      try{ saved=localStorage.getItem('weerscoop:radarLayerV2'); }catch(e){}
    }
    const target=normalizeRadarLayerId(saved || 'precip');

    // Absolute first-run invariant: Buienradar is niet alleen visueel actief,
    // maar de neerslagframes zijn ook werkelijk geladen voordat init klaar is.
    if(!state.radar.initialized || target==='precip' || target==='satellite'){
      state.radar.layer=!state.radar.initialized ? 'precip' : (target==='satellite'?'satellite':'precip');
      syncRadarLayerUi(state.radar.layer);
      await refreshRadarSource();
    }else{
      const ready=state.xweather.ready || await initXweatherMap(true);
      if(ready && await setXweatherLayer(target)) syncRadarLayerUi(target);
      else{ state.radar.layer='precip'; syncRadarLayerUi('precip'); await refreshRadarSource(); }
    }

    state.radar.initialized=true;
    rememberRadarLayer(normalizeRadarLayerId(state.xweather.ready && state.xweather.activeLayer ? state.xweather.activeLayer.id : state.radar.layer));
    updateRadarLocationUi();
    refreshRadarLayout();
  }catch(error){
    console.error('Radar initialisatie faalde:',error);
    state.dataStatus.radar.error=String(error?.message||error);
    showRadarInfo('Radar kon niet volledig laden. Probeer opnieuw.');
  }finally{
    state.radar.activating=false;
  }
}

function initMapIfNeeded(){
  if(state.map) return;
  state.map = L.map('map', {
    zoomControl:false,
    attributionControl:true,
    zoomSnap:.25,
    zoomDelta:.5,
    wheelPxPerZoomLevel:90,
    minZoom:6,
    maxZoom:14
  });
  const rv = radarView();
  let savedView = null;
  try{ savedView = JSON.parse(localStorage.getItem('weerscoop:mapView') || 'null'); }catch(e){}
  if(savedView?.lat && savedView?.lon && savedView?.zoom){
    state.map.setView([savedView.lat, savedView.lon], savedView.zoom);
  }else{
    state.map.setView(rv.center, rv.zoom);
  }
  state.map.createPane('radarPane');
  state.map.getPane('radarPane').style.zIndex = 420;
  state.map.createPane('labelPane');
  state.map.getPane('labelPane').style.zIndex = 650;
  state.map.getPane('labelPane').style.pointerEvents = 'none';
  L.control.zoom({position:'bottomright'}).addTo(state.map);
  addOpenFreeMapBase(state.map);

  placeMarker(state.loc.lat, state.loc.lon, locationDisplayName());

  state.map.on('click', async (e)=>{
    const {lat, lng} = e.latlng;
    showRadarInfo('Weer laden...', lat, lng);
    if(state.xweather.ready){
      if(state.xweather.pointMarker) state.map.removeLayer(state.xweather.pointMarker);
      state.xweather.pointMarker = L.circleMarker([lat,lng], {
        radius:7,
        color:'#ffffff',
        weight:2,
        fillColor:'#35d0c4',
        fillOpacity:.95
      }).addTo(state.map);
      const details = await queryXweatherPoint(lat, lng);
      showRadarInfo(`<b>${esc(state.xweather.activeLayer?.label || 'Kaartpunt')}</b><br>${formatXweatherPoint(details)}<br><span>${lat.toFixed(3)}, ${lng.toFixed(3)}</span>`, lat, lng);
      return;
    }
    try{
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto&models=knmi_seamless`);
      const d = await r.json();
      const wc = wcInfo(d.current.weather_code);
      showRadarInfo(`<b>${wc.l}</b><br>${fmtTemp(d.current.temperature_2m)} - ${fmtWind(d.current.wind_speed_10m)}<br><a href="#" id="useHereLink" style="color:#35d0c4;">Gebruik als locatie</a>`, lat, lng);
      $('#useHereLink')?.addEventListener('click', async (ev)=>{
        ev.preventDefault();
        const g = await reverseGeocode(lat,lng);
        setLocation(lat,lng,g.name,g.admin,g.country || '', 'manual');
        placeMarker(lat,lng,g.name);
      });
    }catch(err){ showRadarInfo('Kon puntgegevens niet laden.', lat,lng); }
  });

  clearInterval(state.radar.refreshTimer);
  state.radar.refreshTimer = setInterval(()=>{
    if(document.hidden) return;
    if(state.xweather.ready && state.xweather.controller && state.xweather.activeLayer?.id !== 'radar'){
      try{
        state.xweather.controller.setRefreshInterval?.(5, true);
        state.xweather.controller.refresh?.();
        updateXweatherTimelineUi();
      }catch(error){
        console.warn('Xweather weerlaag verversen faalde:', error);
      }
      return;
    }
    refreshRadarSource();
  }, 5*60*1000);
}

function startLegacyRadar(){
  state.xweather.fallback = true;
  $('#xweatherPanel')?.classList.add('hide');
  $('#xweatherLayerBar')?.classList.add('hide');
  $('#liveRadarPanel')?.classList.remove('hide');
  removeKnmiWmsRadarLayer();
  if(state.radar.animator){ state.radar.animator.destroy(); state.radar.animator = null; }
  state.radar.frames = [];
  $('#timeline').innerHTML = '';
  $('#timeLabel').textContent = 'Radar laden...';
  $('#radarNowBadge')?.classList.remove('show');
  const note = $('.radar-note');
  if(note) note.textContent = 'Live buienradar wordt geladen. Als de radarbron geen vers beeld geeft, gebruikt Wheaterflow automatisch Open-Meteo neerslag als fallback.';
  loadRadarFrames();
}

async function initXweatherMap(force=false){
  if(state.xweather.ready && !force) return true;
  if(state.xweather.loading) return false;
  if(!state.map || !window.L) return false;
  state.xweather.loading = true;
  setXweatherStatus('Xweather MapsGL laden...');
  try{
    const config = await fetchXweatherConfig();
    if(!config?.configured || !config.clientId || !config.clientSecret){
      setXweatherStatus('Xweather is nog niet geconfigureerd. De bestaande radar blijft actief.');
      return false;
    }
    state.xweather.configured = true;
    await ensureXweatherSdk();
    const maps = window.mapsgl;
    if(!maps?.Account || !maps?.LeafletMapController) throw new Error('MapsGL Leaflet-controller ontbreekt');
    stopPlaying();
    removeKnmiWmsRadarLayer();
    if(state.radar.animator){ state.radar.animator.destroy(); state.radar.animator = null; }
    state.radar.frames = [];
    $('#timeline').innerHTML = '';
    const account = new maps.Account(config.clientId, config.clientSecret);
    const controller = new maps.LeafletMapController(state.map, {
      account,
      units:{
        temperature:'C',
        speed:'km/h',
        pressure:'hPa',
        distance:'km',
        precipitation:'mm'
      },
      animation:{
        duration:6,
        endDelay:1.2,
        pauseWhileLoading:true,
        resumeOnMoveEnd:false,
        preloadData:false
      }
    });
    state.xweather.controller = controller;
    await controller.initialize();
    controller.setRefreshInterval(5, true);
    state.xweather.metadata = await controller.weatherProvider.getLayerMetadata().catch(()=>[]);
    state.xweather.availableCodes = new Set(
      state.xweather.metadata
        .map(m => m?.code || m?.id || m?.layer || m?.name)
        .filter(Boolean)
    );
    state.xweather.ready = true;
    state.xweather.fallback = false;
    setupXweatherUi();
    wireXweatherMapEvents();
    $('#xweatherPanel')?.classList.remove('hide');
    $('#xweatherLayerBar')?.classList.remove('hide');
    $('#liveRadarPanel')?.classList.add('hide');
    clearOpenMeteoRadarLayer();
    const saved = localStorage.getItem('weerscoop:xweatherLayer');
    const first = findAvailableXweatherLayer(saved) || findAvailableXweatherLayer('radar') || availableXweatherLayers()[0];
    if(!first) throw new Error('Geen Xweather-lagen beschikbaar voor dit abonnement');
    const layerOk = await setXweatherLayer(first.id);
    if(!layerOk) return false;
    updateXweatherTimelineUi();
    clearInterval(state.xweather.timelineUiTimer);
    state.xweather.timelineUiTimer = setInterval(updateXweatherTimelineUi, 1000);
    if(!state.xweather.visibilityWired){
      document.addEventListener('visibilitychange', handleXweatherVisibility, {passive:true});
      state.xweather.visibilityWired=true;
    }
    await nextPaint();
    state.xweather.controller?.resize?.();
    return true;
  }catch(err){
    console.warn('Xweather MapsGL kon niet starten', err);
    setXweatherStatus('De weerkaart kon niet worden geladen. De bestaande radar blijft actief.');
    toast('De weerkaart kon niet worden geladen.');
    teardownXweather(false);
    startLegacyRadar();
    return false;
  }finally{
    state.xweather.loading = false;
  }
}

async function fetchXweatherConfig(){
  const urls = [
    new URL('/api/xweather-config', location.origin).href,
    FUNCTION_BASE + 'xweather-config'
  ];
  for(const url of urls){
    try{
      const r = await fetch(url, {cache:'no-store'});
      if(r.ok) return await r.json();
      console.warn('Xweather config endpoint faalde', {url, status:r.status});
    }catch(error){
      console.warn('Xweather config endpoint onbereikbaar', {url, error});
    }
  }
  return {configured:false};
}

async function ensureXweatherSdk(){
  if(state.xweather.sdkLoaded && window.mapsgl) return;
  loadCssOnce(XWEATHER_SDK_BASE + 'mapsgl.css');
  await loadScriptOnce(XWEATHER_SDK_BASE + 'mapsgl.js');
  state.xweather.sdkLoaded = Boolean(window.mapsgl);
}

function availableXweatherLayers(){
  const provider = state.xweather.controller?.weatherProvider;
  return XWEATHER_LAYER_DEFS.filter(def=>{
    if(def.overlay) return false;
    if(state.xweather.disabledCodes.has(def.code)) return false;
    if(state.xweather.availableCodes.size && !xweatherLayerCodeCandidates(def).some(code=>state.xweather.availableCodes.has(code))){
      try{ return Boolean(resolveXweatherLayerCode(def)); }catch(e){ return false; }
    }
    return true;
  });
}

function findAvailableXweatherLayer(id){
  return availableXweatherLayers().find(def=>def.id === id || def.code === id) || null;
}

function findXweatherLayerDefinition(id){
  return XWEATHER_LAYER_DEFS.find(def=>def.id === id || def.code === id) || null;
}

function resolveXweatherLayerCode(def, controller=state.xweather.controller){
  if(!def || !controller) return null;
  const candidates = xweatherLayerCodeCandidates(def);
  for(const code of candidates){
    if(state.xweather.disabledCodes.has(code)) continue;
    if(state.xweather.availableCodes.size && state.xweather.availableCodes.has(code)) return code;
    try{
      if(controller.weatherProvider?.getWeatherLayerConfig(code)) return code;
    }catch(err){
      console.error('Xweather layer config lookup failed', {code, layer:def.id, err});
    }
  }
  return null;
}

function xweatherLayerCodeCandidates(def){
  const fallback = {
    'cloud-cover':['cloud-cover','clouds','cloud-cover-global'],
    'lightning-strikes-icons':['lightning-strikes-icons','lightning-strikes'],
    'wave-heights':['wave-heights','waves','wave-periods']
  };
  return [...new Set([def.code, def.id, ...(fallback[def.id] || [])].filter(Boolean))];
}


function wireRadarQuickLayers(){
  const mapping={
    chipPrecip:'precip',
    chipSat:'satellite',
    radarQuickTemp:'temperatures',
    radarQuickWind:'wind-speeds',
    radarQuickCloud:'cloud-cover',
    radarQuickLightning:'lightning-strikes-icons'
  };
  Object.entries(mapping).forEach(([id,layer])=>{
    const button=$('#'+id);
    if(!button || button.dataset.radarWired==='1') return;
    button.dataset.radarWired='1';
    button.addEventListener('click',async()=>{
      const normalized=normalizeRadarLayerId(layer);
      if(normalized==='precip' || normalized==='satellite'){
        await switchLayer(normalized);
        return;
      }
      const ready=state.xweather.ready || await initXweatherMap(true);
      if(!ready) return;
      const ok=await setXweatherLayer(normalized);
      if(ok){ syncRadarLayerUi(normalized); rememberRadarLayer(normalized); }
    });
  });
}

function refreshRadarLayout(){
  if(!state.map) return;
  requestAnimationFrame(()=>{
    state.map.invalidateSize?.({pan:false});
    const lat=validNumber(state.loc?.lat),lon=validNumber(state.loc?.lon);
    if(lat!=null&&lon!=null){ state.map.setView([lat,lon],state.map.getZoom?.()||8,{animate:false}); placeMarker(lat,lon,locationDisplayName()); }
  });
}
function setupXweatherUi(){
  renderXweatherLayerSelector();
  if(state.xweather.uiWired) return;
  state.xweather.uiWired=true;
  $('#xweatherRetry')?.addEventListener('click', async ()=>{
    const ok = await initXweatherMap(true);
    if(!ok) startLegacyRadar();
  });
  $('#xweatherPlay')?.addEventListener('click', toggleXweatherPlayback);
  $('#xweatherNow')?.addEventListener('click', ()=>goXweatherNow());
  $('#xweatherPrev')?.addEventListener('click', ()=>stepXweatherTimeline(-1));
  $('#xweatherNext')?.addEventListener('click', ()=>stepXweatherTimeline(1));
  $('#xweatherSpeed')?.addEventListener('change', e=>{
    const scale = Number(e.target.value || 1);
    if(state.xweather.controller?.timeline) state.xweather.controller.timeline.timeScale = scale;
  });
  $('#xweatherTimeSlider')?.addEventListener('input', e=>{
    const pct = Number(e.target.value || 0) / 100;
    const info = state.xweather.controller?.timeline?.info;
    if(!info) return;
    const t = info.startDate.getTime() + pct * (info.endDate.getTime() - info.startDate.getTime());
    state.xweather.controller.timeline.goToDate(new Date(t));
    updateXweatherTimelineUi();
  });
  ['windParticleSpeed','windParticleDensity','windParticleTrail','windParticleOpacity'].forEach(id=>{
    $('#'+id)?.addEventListener('input', applyWindParticleSettings);
  });
}

function renderXweatherLayerSelector(){
  const bar = $('#xweatherLayerBar');
  if(!bar) return;
  const layers = availableXweatherLayers();
  const lightning = XWEATHER_LAYER_DEFS.find(def=>def.id === 'lightning-strikes-icons');
  const hasLightning = lightning && canUseXweatherCode(lightning.code);
  bar.innerHTML = layers.map(def=>`
    <button class="xweather-layer-btn" type="button" data-xweather-layer="${def.id}" aria-label="${esc(def.label)}">
      <span>${esc(def.short)}</span>
      <b>${esc(def.label)}</b>
    </button>
  `).join('') + (hasLightning ? `
    <label class="xweather-overlay-toggle">
      <input id="xweatherLightningOverlay" type="checkbox">
      <span>Bliksem bovenop</span>
    </label>` : '');
  $$('[data-xweather-layer]', bar).forEach(btn=>{
    btn.addEventListener('click', ()=>setXweatherLayer(btn.dataset.xweatherLayer));
  });
  $('#xweatherLightningOverlay')?.addEventListener('change', e=>{
    state.xweather.overlayLightning = e.target.checked;
    refreshXweatherLayers();
  });
}

function canUseXweatherCode(code){
  if(state.xweather.disabledCodes.has(code)) return false;
  if(state.xweather.availableCodes.size && state.xweather.availableCodes.has(code)) return true;
  try{ return Boolean(state.xweather.controller?.weatherProvider?.getWeatherLayerConfig(code)); }catch(e){ return false; }
}

async function setXweatherLayer(id){
  const def = findAvailableXweatherLayer(id);
  if(!def){
    toast('Deze weerlaag is momenteel niet beschikbaar.');
    setXweatherStatus(`Laag "${id}" is niet beschikbaar met deze Xweather-configuratie.`);
    if(id === 'radar') startLegacyRadar();
    return false;
  }
  const previousLayer = state.xweather.activeLayer;
  state.xweather.activeLayer = def;
  localStorage.setItem('weerscoop:xweatherLayer', def.id);
  const ok = await refreshXweatherLayers();
  if(!ok){
    console.warn('Xweather laag faalde, fallback wordt gebruikt', {requested:id, layer:def});
    if(def.id === 'radar'){
      setXweatherStatus('Xweather-radar is niet bereikbaar. De bestaande radar wordt geladen.');
      startLegacyRadar();
      return false;
    }
    const fallback = findAvailableXweatherLayer('radar');
    if(fallback){
      return await setXweatherLayer(fallback.id);
    }
    state.xweather.activeLayer = previousLayer || null;
    setXweatherStatus(`${def.label} is niet beschikbaar. De bestaande radar wordt geladen.`);
    startLegacyRadar();
    return false;
  }
  $$('.xweather-layer-btn').forEach(btn=>btn.classList.toggle('active', btn.dataset.xweatherLayer === def.id));
  $('#chipPrecip')?.classList.toggle('active', def.id === 'radar');
  $('#chipSat')?.classList.toggle('active', def.id === 'satellite');
  if($('#xweatherLayerTitle')) $('#xweatherLayerTitle').textContent = def.label;
  if($('#xweatherWindSettings')) $('#xweatherWindSettings').open = def.id === 'wind-particles';
  updateXweatherLegend();
  updateXweatherTimelineUi();
  rememberRadarLayer(def.id);
  return true;
}

async function refreshXweatherLayers(){
  const controller = state.xweather.controller;
  const def = state.xweather.activeLayer;
  if(!controller || !def) return false;
  const primaryCode = resolveXweatherLayerCode(def, controller);
  if(!primaryCode){
    console.error('Xweather layer unavailable before add', {layer:def, metadata:state.xweather.metadata});
    state.xweather.disabledCodes.add(def.code);
    return false;
  }
  const wanted = [primaryCode];
  const lightning = XWEATHER_LAYER_DEFS.find(d=>d.id === 'lightning-strikes-icons');
  const lightningCode = lightning ? resolveXweatherLayerCode(lightning, controller) : null;
  if(state.xweather.overlayLightning && lightningCode && def.id !== lightning.id) wanted.push(lightningCode);
  state.xweather.activeCodes.forEach(code=>{
    if(!wanted.includes(code)){
      try{ controller.removeWeatherLayer(code); }catch(e){}
    }
  });
  state.xweather.activeCodes = [];
  for(const code of wanted){
    try{
      if(!controller.hasWeatherLayer(code)){
        controller.addWeatherLayer(code, xweatherLayerOverrides(code));
      }
      state.xweather.activeCodes.push(code);
    }catch(err){
      console.error('Xweather layer add failed', {
        code,
        requestedLayer:def.id,
        activeLayer:def,
        metadata:state.xweather.metadata,
        error:err
      });
      state.xweather.disabledCodes.add(code);
      if(code === def.code || code === primaryCode) state.xweather.disabledCodes.add(def.code);
      try{ controller.removeWeatherLayer(code); }catch(e){}
      if(code === primaryCode) return false;
    }
  }
  applyWindParticleSettings();
  try{ controller.redraw(); }catch(err){ console.error('Xweather redraw failed', err); }
  return state.xweather.activeCodes.includes(primaryCode);
}

function xweatherLayerOverrides(code){
  const weak = likelyWeakMapDevice();
  const opacity = code === 'radar' ? .86 : code === 'satellite' ? .82 : code === 'wind-particles' ? .74 : .78;
  return {
    opacity,
    data:{ quality: weak ? 'low' : 'normal' }
  };
}

function likelyWeakMapDevice(){
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  return reduced || mem <= 3 || cores <= 4 || Math.min(screen.width, screen.height) <= 430;
}

function applyWindParticleSettings(){
  const controller = state.xweather.controller;
  if(!controller || !controller.hasWeatherLayer('wind-particles')) return;
  const opacity = Number($('#windParticleOpacity')?.value || 75) / 100;
  try{ controller.setPaintProperty('wind-particles', 'opacity', opacity); }catch(e){}
}

function updateXweatherLegend(){
  const legend = $('#xweatherLegend');
  const def = state.xweather.activeLayer;
  if(!legend || !def) return;
  legend.innerHTML = `<b>${esc(def.label)}</b><span>${esc(def.legend)}</span><div class="xweather-colorbar ${esc(def.id)}"></div>`;
}

function updateXweatherTimelineUi(){
  const controller = state.xweather.controller;
  const info = controller?.timeline?.info;
  const def = state.xweather.activeLayer;
  const panel = $('#xweatherTimelinePanel');
  if(!controller || !info || !def){
    setXweatherStatus('Xweather MapsGL laden...');
    return;
  }
  const timeDependent = def.time && !XWEATHER_TIMELESS_IDS.has(def.id);
  panel?.classList.toggle('hide', !timeDependent);
  const start = info.startDate.getTime();
  const end = info.endDate.getTime();
  const current = info.currentDate.getTime();
  const pct = end > start ? Math.round(((current - start) / (end - start)) * 100) : 100;
  if($('#xweatherTimeSlider')) $('#xweatherTimeSlider').value = String(Math.max(0, Math.min(100, pct)));
  if($('#xweatherTimeLabel')) $('#xweatherTimeLabel').textContent = info.currentDate.toLocaleString('nl-BE',{weekday:'short',hour:'2-digit',minute:'2-digit'});
  const ageMin = Math.max(0, Math.round((Date.now() - current) / 60000));
  const ageLabel = current > Date.now() + 60000 ? 'verwachting' : `leeftijd ${ageMin} min`;
  setXweatherStatus(`Databron: Xweather MapsGL. Tijd: ${info.currentDate.toLocaleString('nl-BE')}. ${ageLabel}. Vertraging en resolutie hangen af van de gekozen Xweather-laag.`);
  $('#xweatherPlay')?.classList.toggle('active', info.isActive);
}

function setXweatherStatus(text){
  const meta = $('#xweatherLayerMeta');
  if(meta) meta.textContent = text;
}

function toggleXweatherPlayback(){
  const timeline = state.xweather.controller?.timeline;
  if(!timeline) return;
  if(timeline.info?.isActive){
    timeline.pause();
    $('#xweatherPlay').innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 20,12 6,20"/></svg>`;
  }else{
    timeline.play();
    $('#xweatherPlay').innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>`;
  }
  updateXweatherTimelineUi();
}

function goXweatherNow(){
  const timeline = state.xweather.controller?.timeline;
  if(!timeline) return;
  timeline.goToDate(new Date());
  updateXweatherTimelineUi();
}

function stepXweatherTimeline(dir){
  const timeline = state.xweather.controller?.timeline;
  const info = timeline?.info;
  if(!timeline || !info) return;
  const step = 10 * 60 * 1000;
  const next = Math.max(info.startDate.getTime(), Math.min(info.endDate.getTime(), info.currentDate.getTime() + dir * step));
  timeline.goToDate(new Date(next));
  updateXweatherTimelineUi();
}

function handleXweatherVisibility(){
  if(document.hidden) state.xweather.controller?.timeline?.pause();
}

function wireXweatherMapEvents(){
  if(state.xweather.mapClickWired || !state.map) return;
  state.xweather.mapClickWired = true;
  state.map.on('moveend zoomend', ()=>{
    try{
      const c = state.map.getCenter();
      localStorage.setItem('weerscoop:mapView', JSON.stringify({lat:c.lat, lon:c.lng, zoom:state.map.getZoom()}));
    }catch(e){}
  });
}

async function queryXweatherPoint(lat, lon){
  const controller = state.xweather.controller;
  if(!controller?.queryPromise) return null;
  try{
    return await controller.queryPromise({lat, lon});
  }catch(e){
    console.warn('Xweather puntquery faalde', e);
    return null;
  }
}

function formatXweatherPoint(data){
  if(!data || !Object.keys(data).length) return 'Geen gegevens beschikbaar';
  const bits = [];
  Object.entries(data).slice(0,4).forEach(([key,value])=>{
    const item = Array.isArray(value) ? value[0] : value;
    if(item == null) return;
    if(typeof item === 'object'){
      const props = item.properties || item.data || item;
      const found = Object.entries(props).find(([,v])=>typeof v === 'number' || typeof v === 'string');
      if(found) bits.push(`${key}: ${found[1]}`);
    }else{
      bits.push(`${key}: ${item}`);
    }
  });
  return bits.length ? bits.join('<br>') : 'Geen gegevens beschikbaar';
}

function teardownXweather(removeUi=true){
  clearInterval(state.xweather.timelineUiTimer);
  state.xweather.timelineUiTimer = null;
  try{ state.xweather.controller?.timeline?.pause(); }catch(e){}
  try{ state.xweather.controller?.dispose?.(); }catch(e){}
  state.xweather.controller = null;
  state.xweather.ready = false;
  state.xweather.activeCodes = [];
  if(state.xweather.visibilityWired){
    document.removeEventListener('visibilitychange', handleXweatherVisibility);
    state.xweather.visibilityWired=false;
  }
  if(removeUi){
    $('#xweatherPanel')?.classList.add('hide');
    $('#xweatherLayerBar')?.classList.add('hide');
  }
}

function showRadarInfo(html){
  const el = $('#radarInfo'); el.innerHTML = html; el.classList.add('show');
  clearTimeout(el._h); el._h = setTimeout(()=>el.classList.remove('show'), 9000);
}
function placeMarker(lat, lon, name){
  if(state.marker) state.map.removeLayer(state.marker);
  state.marker = L.circleMarker([lat,lon], {
    radius:8,
    color:'#ffffff',
    weight:3,
    fillColor:'#1677ff',
    fillOpacity:.95,
    opacity:1
  }).addTo(state.map);
}

$('#chipLocate').addEventListener('click', async ()=>{
  const p = await getBrowserLocation();
  if(!p){ toast('Locatie niet beschikbaar'); return; }
  const g = await reverseGeocode(p.lat,p.lon);
  setLocation(p.lat,p.lon,g.name,g.admin,g.country || '', 'gps');
  const rv = radarView();
  state.map.setView(rv.center, rv.zoom);
  placeMarker(p.lat, p.lon, g.name);
  if(state.xweather.ready){
    if(state.xweather.accuracy) state.map.removeLayer(state.xweather.accuracy);
    const radius = p.accuracy || 1200;
    state.xweather.accuracy = L.circle([p.lat,p.lon], {
      radius,
      color:'#35d0c4',
      weight:1,
      fillColor:'#35d0c4',
      fillOpacity:.12,
      opacity:.7
    }).addTo(state.map);
  }
});
$('#radarFullscreen')?.addEventListener('click', async ()=>{
  const target = $('#radarscreen') || document.documentElement;
  try{
    if(!document.fullscreenElement && target.requestFullscreen) await target.requestFullscreen();
    else if(document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
    setTimeout(()=>state.map?.invalidateSize(), 180);
  }catch(err){
    console.warn('Radar fullscreen niet beschikbaar', err);
    toast('Volledig scherm is niet beschikbaar');
  }
});
$('#xweatherLayersBtn')?.addEventListener('click', async ()=>{
  const ok = await initXweatherMap(true);
  if(ok) toast('Professionele weerlagen geladen');
});

/* ----- flikkervrije tegel-animator (dubbele buffer: nieuwe laag pas tonen als tegels geladen zijn) ----- */
function createRadarAnimator(map){
  const layers = [null, null];
  let active = 0;
  function ensureLayer(idx, url){
    if(!layers[idx]){
      layers[idx] = L.tileLayer(url, {
        opacity:0,
        maxZoom:14,
        maxNativeZoom:7,
        pane:'radarPane',
        className:'radar-tile-layer',
        crossOrigin:true,
        keepBuffer:4,
        updateWhenIdle:false,
        updateWhenZooming:false
      }).addTo(map);
      layers[idx].on('tileerror', err=>{
        console.error('Radar tegel kon niet laden', {url, error:err});
        showRadarInfo('Radarbeeld kon niet volledig laden. Probeer opnieuw of zoom iets uit.');
      });
    } else {
      layers[idx].setUrl(url);
    }
    return layers[idx];
  }
  return {
    showFrame(url, opacity){
      const next = 1-active;
      const nextLayer = ensureLayer(next, url);
      let done = false;
      const finish = ()=>{
        if(done) return; done = true;
        nextLayer.setOpacity(opacity);
        if(layers[active]) layers[active].setOpacity(0);
        active = next;
      };
      nextLayer.once('load', finish);
      setTimeout(finish, 1600); // vangnet als 'load' niet vuurt (bv. tegels al gecached)
    },
    setOpacity(opacity){
      if(layers[active]) layers[active].setOpacity(opacity);
    },
    destroy(){
      layers.forEach(l=>{ if(l) map.removeLayer(l); });
    }
  };
}

function wms3857Bbox(coords){
  const extent = 20037508.342789244;
  const tiles = Math.pow(2, coords.z);
  const span = (extent * 2) / tiles;
  const minx = -extent + coords.x * span;
  const maxx = minx + span;
  const maxy = extent - coords.y * span;
  const miny = maxy - span;
  return [minx, miny, maxx, maxy].join(',');
}

function createKnmiWmsGridLayer(){
  return L.GridLayer.extend({
    createTile(coords, done){
      const tile = document.createElement('img');
      tile.alt = '';
      tile.className = 'knmi-wms-tile';
      const params = new URLSearchParams({
        DATASET:'radar_forecast_2.0',
        SERVICE:'WMS',
        REQUEST:'GetMap',
        VERSION:'1.3.0',
        LAYERS:'precipitation_nowcast',
        STYLES:'rainrate-blue-to-purple/shaded',
        CRS:'EPSG:3857',
        BBOX:wms3857Bbox(coords),
        WIDTH:'256',
        HEIGHT:'256',
        FORMAT:'image/png',
        TRANSPARENT:'TRUE'
      });
      fetch(WHEATERFLOW_API_BASE + '/knmi/wms?' + params.toString()).then(r=>{
        if(!r.ok) throw new Error('KNMI WMS '+r.status);
        return r.blob();
      }).then(blob=>{
        const url = URL.createObjectURL(blob);
        tile.onload = ()=>{ URL.revokeObjectURL(url); done(null, tile); };
        tile.onerror = err=>done(err, tile);
        tile.src = url;
      }).catch(err=>done(err, tile));
      return tile;
    }
  });
}

function addKnmiWmsRadarLayer(){
  if(!state.map || state.radar.knmiLayer) return;
  if(state.radar.animator){ state.radar.animator.destroy(); state.radar.animator = null; }
  const KnmiLayer = createKnmiWmsGridLayer();
  state.radar.knmiLayer = new KnmiLayer({
    pane:'radarPane',
    opacity:state.radar.opacity,
    tileSize:256,
    maxZoom:10,
    className:'radar-tile-layer knmi-wms-layer',
    keepBuffer:3
  }).addTo(state.map);
  $('#timeline').innerHTML = '<div class="tframe active" title="KNMI radar nowcast"></div>';
  $('#timeLabel').textContent = 'KNMI live';
  const note = $('.radar-note');
  if(note) note.textContent = 'Officiële KNMI WMS radar-nowcast: 5-minuten neerslagverwachting tot 2 uur vooruit.';
}

function removeKnmiWmsRadarLayer(){
  if(state.radar.knmiLayer && state.map){
    state.map.removeLayer(state.radar.knmiLayer);
  }
  state.radar.knmiLayer = null;
}

async function refreshRadarSource(){
  if(!state.map) return false;
  stopPlaying();
  removeKnmiWmsRadarLayer();
  await loadRadarFrames(true);
  const note = $('.radar-note');
  if(note) note.textContent = state.radar.layer === 'precip'
    ? 'Buienradar actief · actuele RainViewer-frames met automatische Wheaterflow fallback.'
    : 'Satellietlaag actief.';
  state.dataStatus.radar.lastSuccess=Date.now();
  state.dataStatus.radar.error=null;
  return true;
}

/* ----- WeatherFlow radar-worker + satellietframes ----- */
let rainviewerMeta = null;
function weatherflowRadarTileUrl(offset){
  const minutes = Number.isFinite(Number(offset)) ? Number(offset) : 0;
  const refreshBucket = Math.floor(Date.now() / TV_RADAR_REFRESH_MS);
  return `${WEATHERFLOW_RADAR_WORKER}/radar/{z}/{x}/{y}/${minutes}?v=${refreshBucket}`;
}
function weatherflowRadarFrames(){
  const now = Date.now();
  return WEATHERFLOW_RADAR_OFFSETS.map(offset=>({
    offset,
    time:Math.round((now + offset * 60000) / 1000),
    isNow:offset === 0,
    source:'weatherflow-worker'
  }));
}
function tvOpenMeteoRadarColor(mm){
  if(mm >= 6) return '#e83cff';
  if(mm >= 3) return '#ff4a33';
  if(mm >= 1.5) return '#ffd23c';
  if(mm >= .6) return '#50e36d';
  if(mm >= .15) return '#25c7ff';
  return '#7fdcff';
}
function tvOpenMeteoRadarRadius(mm){
  if(mm >= 6) return 43000;
  if(mm >= 3) return 39000;
  if(mm >= 1.5) return 34000;
  if(mm >= .6) return 30000;
  return 25000;
}
function openMeteoRadarPoints(){
  const lat = Number(state.loc?.lat);
  const lon = Number(state.loc?.lon);
  const center = Number.isFinite(lat) && Number.isFinite(lon) ? {lat, lon} : {lat:50.85, lon:4.35};
  const points = [];
  for(let dLat = -1.2; dLat <= 1.2; dLat += 0.3){
    for(let dLon = -1.8; dLon <= 1.8; dLon += 0.3){
      points.push({
        lat:Number((center.lat + dLat).toFixed(2)),
        lon:Number((center.lon + dLon).toFixed(2))
      });
    }
  }
  return points;
}
async function fetchOpenMeteoRadar(points=openMeteoRadarPoints()){
  const latitudes = points.map(p=>p.lat).join(',');
  const longitudes = points.map(p=>p.lon).join(',');
  const url = 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${latitudes}&longitude=${longitudes}`
    + '&current=precipitation'
    + '&timezone=Europe%2FBrussels'
    + '&forecast_days=1';
  const r = await fetch(url, {cache:'no-store'});
  if(!r.ok) throw new Error('Open-Meteo radar ' + r.status);
  const payload = await r.json();
  const rows = Array.isArray(payload) ? payload : [payload];
  return rows.map((row, index)=>({
    lat:row.latitude ?? points[index]?.lat,
    lon:row.longitude ?? points[index]?.lon,
    precipitation:Number(row.current?.precipitation) || 0,
    time:row.current?.time || null
  })).filter(p=>Number.isFinite(p.lat) && Number.isFinite(p.lon));
}
function clearOpenMeteoRadarLayer(){
  if(state.radar.openMeteoLayer && state.map){
    state.map.removeLayer(state.radar.openMeteoLayer);
  }
  state.radar.openMeteoLayer = null;
}
async function refreshOpenMeteoRadarLayer(){
  if(!state.map || !window.L || state.radar.layer !== 'precip') return false;
  const rows = await fetchOpenMeteoRadar();
  clearOpenMeteoRadarLayer();
  const rainy = rows.filter(p=>p.precipitation > 0.02);
  const group = L.layerGroup();
  rainy.forEach(p=>{
    L.circle([p.lat, p.lon], {
      radius:tvOpenMeteoRadarRadius(p.precipitation),
      color:tvOpenMeteoRadarColor(p.precipitation),
      weight:1,
      opacity:.78,
      fillColor:tvOpenMeteoRadarColor(p.precipitation),
      fillOpacity:.24,
      pane:'radarPane',
      interactive:false
    }).addTo(group);
  });
  group.addTo(state.map);
  state.radar.openMeteoLayer = group;
  const latestTime = rows.find(p=>p.time)?.time;
  if($('#timeLabel')) $('#timeLabel').textContent = latestTime ? new Date(latestTime).toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit'}) : 'Nu';
  const note = $('.radar-note');
  if(note) note.textContent = rainy.length
    ? 'Open-Meteo neerslaglaag actief als fallback. De laag vernieuwt automatisch om de 5 minuten.'
    : 'Open-Meteo fallback actief: er wordt momenteel geen meetbare neerslag rond je locatie gevonden.';
  return true;
}
function webMercatorTilePoint(lat, lon, zoom){
  const n = 2 ** zoom;
  const x = (lon + 180) / 360 * n;
  const latRad = lat * Math.PI / 180;
  const y = (1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * n;
  return {x,y};
}
function angleDiff(a,b){
  const d = Math.abs((((a-b)+540)%360)-180);
  return d;
}
function radarBearingFromPixel(dx,dy){
  // canvas y loopt naar het zuiden; atan2(oost, noord)
  return (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
}
function radarColorToIntensity(r,g,b,a=255){
  if(a < 32) return null;
  if(r > 180 && g < 150) return 'heavy';
  if(r > 170 && g > 130 && b < 130) return 'heavy';
  if(g > 135 && r < 170 && b < 190) return 'moderate';
  return 'light';
}

async function refreshRadarProximity(meta=rainviewerMeta){
  try{
    const lat = Number(state.loc?.lat), lon = Number(state.loc?.lon);
    if(!Number.isFinite(lat) || !Number.isFinite(lon) || !meta?.host) return null;
    const latest = latestRainviewerObservedFrame(meta);
    if(!isFreshRadarFrame(latest)) return null;
    const z = 7;
    const t = webMercatorTilePoint(lat, lon, z);
    const baseX = Math.floor(t.x), baseY = Math.floor(t.y);
    const userPxX = t.x * 256, userPxY = t.y * 256;
    const groundMPerPx = 156543.03392 * Math.cos(lat*Math.PI/180) / (2**z);
    let best = null;
    const jobs=[];
    for(let oy=-1;oy<=1;oy++) for(let ox=-1;ox<=1;ox++) jobs.push([baseX+ox,baseY+oy]);
    const results = await Promise.allSettled(jobs.map(async ([x,y])=>{
      const url = `${meta.host}${latest.path}/256/${z}/${x}/${y}/4/1_1.png?prox=${latest.time}-${Date.now()}`;
      const r = await fetch(url,{cache:'no-store',mode:'cors'});
      if(!r.ok) throw new Error('radar tile '+r.status);
      const bmp = await createImageBitmap(await r.blob());
      const c = document.createElement('canvas'); c.width=256; c.height=256;
      const ctx=c.getContext('2d',{willReadFrequently:true}); ctx.drawImage(bmp,0,0);
      const data=ctx.getImageData(0,0,256,256).data;
      let local=null;
      let nearUser=null;
      const nearRadiusPx=Math.max(3,4000/groundMPerPx);
      for(let py=1;py<256;py+=3){
        for(let px=1;px<256;px+=3){
          const off=(py*256+px)*4;
          const r=data[off],g=data[off+1],b=data[off+2],a=data[off+3];
          if(a < 32) continue;
          const gx=x*256+px, gy=y*256+py;
          const dx=gx-userPxX, dy=gy-userPxY;
          const distPx=Math.hypot(dx,dy);
          const intensity=radarColorToIntensity(r,g,b,a);
          if(!local || distPx<local.distPx) local={distPx,dx,dy,intensity};
          if(distPx<=nearRadiusPx){
            const rank={light:1,moderate:2,heavy:3}[intensity]||1;
            if(!nearUser || rank>nearUser.rank) nearUser={rank,intensity,distPx};
          }
        }
      }
      bmp.close?.();
      return {local,nearUser};
    }));
    let nearUserBest=null;
    for(const res of results){
      if(res.status!=='fulfilled' || !res.value) continue;
      const local=res.value.local, near=res.value.nearUser;
      if(local && (!best || local.distPx<best.distPx)) best=local;
      if(near && (!nearUserBest || near.rank>nearUserBest.rank)) nearUserBest=near;
    }
    if(!best){ state.radar.proximity=null; return null; }
    const distanceKm=best.distPx*groundMPerPx/1000;
    const bearing=radarBearingFromPixel(best.dx,best.dy);
    const windFrom=Number(state.current?.wind_direction_10m);
    const upwind = !Number.isFinite(windFrom) || angleDiff(bearing,windFrom) <= 75;
    const gust=Math.max(Number(state.current?.wind_gusts_10m)||0, Number(state.current?.wind_speed_10m)||0);
    const motionKmh=Math.max(40,Math.min(75,gust*1.15 || 45));
    const etaMinutes=Math.max(1,Math.round(distanceKm/motionKmh*60));
    const proximity={distanceKm,etaMinutes,bearing,upwind,frameTime:latest.time*1000,checkedAt:Date.now(),intensity:best.intensity||'light',localIntensity:nearUserBest?.intensity||null,atLocation:Boolean(nearUserBest||distanceKm<=4)};
    state.radar.proximity=proximity;
    return proximity;
  }catch(error){
    console.warn('Radar-nabijheid kon niet worden bepaald:',error);
    state.radar.proximity=null;
    return null;
  }
}

async function refreshRadarProximityIfStale(){
  const last=Number(state.radar?.proximity?.checkedAt)||0;
  if(Date.now()-last < 4*60*1000) return state.radar.proximity;
  const meta=await fetchRainviewerMeta();
  rainviewerMeta=meta;
  return refreshRadarProximity(meta);
}

async function fetchRainviewerMeta(){
  const r = await fetch('https://api.rainviewer.com/public/weather-maps.json?ts=' + Date.now(), {cache:'no-store'});
  if(!r.ok) throw new Error('RainViewer '+r.status);
  return r.json();
}
function rainviewerRadarFrames(meta){
  const past = (meta?.radar && meta.radar.past) || [];
  const nowcast = (meta?.radar && meta.radar.nowcast) || [];
  const cutoff = (Date.now()/1000) - 2 * 60 * 60;
  const recentPast = past.filter(f=>f.time >= cutoff);
  const all = recentPast.concat(nowcast.map(f=>({...f, isNowcast:true})));
  const latestObservedTime = recentPast.length ? recentPast[recentPast.length - 1].time : null;
  return all.map(f=>({
    ...f,
    source:'rainviewer',
    isNow:latestObservedTime != null && f.time === latestObservedTime && !f.isNowcast
  }));
}
async function fetchLatestRainviewerRadarFrame(){
  const meta = await fetchRainviewerMeta();
  rainviewerMeta = meta;
  const frames = rainviewerRadarFrames(meta).filter(f=>!f.isNowcast);
  const latest = frames[frames.length - 1] || null;
  return isFreshRadarFrame(latest) ? latest : null;
}
function rainviewerTileUrl(frame, salt='radar'){
  if(!rainviewerMeta?.host || !frame?.path) return '';
  return `${rainviewerMeta.host}${frame.path}/256/{z}/{x}/{y}/4/1_1.png?${salt}=${frame.time}-${Date.now()}`;
}
function updateRadarLocationUi(){
  const place = $('#radarPlaceLabel');
  if(place) place.textContent = `Radar rond ${locationDisplayName('Belgie')}`;
  const eta = radarEtaText();
  if($('#radarEtaLine')) $('#radarEtaLine').textContent = eta;
  if($('#xweatherEtaLine')) $('#xweatherEtaLine').textContent = eta;
  if(state.radar.frames?.length || state.xweather.ready) state.dataStatus.radar.lastSuccess=Date.now();
}
async function loadRadarFrames(keepFrame=false){
  updateRadarLocationUi();
  if(state.radar.layer === 'precip'){
    try{
      rainviewerMeta = await fetchRainviewerMeta();
      refreshRadarProximity(rainviewerMeta).then(()=>{ try{ renderHome(); updateRadarLocationUi(); }catch(_){} });
      buildFrameList(keepFrame);
    }catch(e){
      console.error('RainViewer radarframes konden niet laden, worker-fallback wordt geprobeerd', e);
      rainviewerMeta = null;
      buildFrameList(keepFrame);
    }
    return;
  }
  try{
    rainviewerMeta = await fetchRainviewerMeta();
    buildFrameList(keepFrame);
  }catch(e){
    console.error('Satellietframes konden niet laden', e);
    $('#timeline').innerHTML = '';
    toast('Kaartdata kon niet geladen worden');
  }
}
function latestRainviewerObservedFrame(meta){
  const past = (meta?.radar && meta.radar.past) || [];
  return past[past.length - 1] || null;
}
function isFreshRadarFrame(frame){
  if(!frame || !frame.time) return false;
  const ageMinutes = (Date.now()/1000 - frame.time) / 60;
  return ageMinutes >= -10 && ageMinutes <= RADAR_MAX_AGE_MINUTES;
}
function currentFrameSet(){
  if(state.radar.layer === 'precip'){
    if(!rainviewerMeta) return weatherflowRadarFrames();
    const frames = rainviewerRadarFrames(rainviewerMeta);
    const observed = frames.filter(f=>!f.isNowcast);
    const latest = observed[observed.length - 1] || null;
    return isFreshRadarFrame(latest) ? frames : weatherflowRadarFrames();
  }
  if(!rainviewerMeta) return [];
  if(state.radar.layer === 'satellite'){
    return (rainviewerMeta.satellite && rainviewerMeta.satellite.infrared) || [];
  }
  const past = (rainviewerMeta.radar && rainviewerMeta.radar.past) || [];
  const nowcast = (rainviewerMeta.radar && rainviewerMeta.radar.nowcast) || [];
  let all = past.concat(nowcast.map(f=>({...f, isNowcast:true})));
  if(state.radar.duration === 1){
    // "1 uur": alleen de meest recente ~60 minuten historie + de volledige prognose
    const cutoff = (Date.now()/1000) - 60*60;
    const recentPast = past.filter(f=>f.time >= cutoff);
    all = recentPast.concat(nowcast.map(f=>({...f, isNowcast:true})));
  }
  return all;
}
function buildFrameList(keepFrame=false){
  const previousTime = state.radar.frames[state.radar.index]?.time;
  state.radar.frames = currentFrameSet();
  if(!state.radar.frames.length){
    $('#timeline').innerHTML = '';
    $('#timeLabel').textContent = '--:--';
    toast('Geen radarbeeld beschikbaar');
    return;
  }
  const pastShown = state.radar.frames.filter(f=>!f.isNowcast && !f.isNow);
  if(keepFrame && previousTime){
    const same = state.radar.frames.findIndex(f=>f.time === previousTime);
    state.radar.index = same >= 0 ? same : Math.max(0, state.radar.frames.findLastIndex?.(f=>!f.isNowcast) ?? state.radar.frames.length-1);
  } else {
    // Start op het nieuwste werkelijk geobserveerde frame (NU), niet op het
    // verste toekomstige nowcastframe. De gebruiker kan daarna vooruit scrubben.
    const nowFrame = state.radar.frames.findIndex(f=>f.isNow);
    const latestObserved = state.radar.frames.map((f,i)=>({f,i})).filter(x=>!x.f.isNowcast).at(-1)?.i;
    state.radar.index = nowFrame >= 0 ? nowFrame : (Number.isInteger(latestObserved) ? latestObserved : state.radar.frames.length-1);
  }
  renderTimeline();
  setFrame(state.radar.index);
}
function renderTimeline(){
  const tl = $('#timeline'); tl.innerHTML='';
  const observedCount = state.radar.frames.filter(f=>!f.isNowcast).length;
  tl.style.setProperty('--observed-count', observedCount || state.radar.frames.length);
  tl.style.setProperty('--frame-count', state.radar.frames.length || 1);
  const slider = $('#radarFrameSlider');
  if(slider){
    slider.max = String(Math.max(0, state.radar.frames.length - 1));
    slider.value = String(state.radar.index);
  }
  state.radar.frames.forEach((f,i)=>{
    const b = document.createElement('div');
    b.className = 'tframe' + (f.isNowcast ? ' nowcast':'') + (f.isNow ? ' now':'') + (i===state.radar.index?' active':'');
    const d = new Date(f.time*1000);
    b.title = state.radar.layer === 'precip'
      ? (f.source === 'rainviewer' ? d.toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit'}) : (f.isNow ? 'Nu' : `${Math.abs(f.offset)} min geleden`))
      : d.toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit'}) + (f.isNowcast ? ' verwacht' : ' gemeten');
    b.addEventListener('click', ()=>{ stopPlaying(); setFrame(i); });
    tl.appendChild(b);
  });
}
function setFrame(i){
  if(!state.radar.frames.length || !state.map) return;
  state.radar.index = i;
  const f = state.radar.frames[i];
  let url = '';
  if(state.radar.layer === 'precip'){
    url = f.source === 'rainviewer' ? rainviewerTileUrl(f) : weatherflowRadarTileUrl(f.offset);
    if(f.source === 'rainviewer'){
      clearOpenMeteoRadarLayer();
    }else{
      refreshOpenMeteoRadarLayer().catch(err=>console.warn('Open-Meteo radar fallback kon niet laden', err));
    }
  }else{
    clearOpenMeteoRadarLayer();
    if(!rainviewerMeta) return;
    const host = rainviewerMeta.host;
    url = `${host}${f.path}/256/{z}/{x}/{y}/0/0_0.png?rv=${f.time}-${Date.now()}`;
  }
  if(!state.radar.animator) state.radar.animator = createRadarAnimator(state.map);
  state.radar.animator.showFrame(url, state.radar.opacity);
  const d = new Date(f.time*1000);
  const label = state.radar.layer === 'precip'
    ? (f.source === 'rainviewer' ? d.toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit'}) : (f.isNow ? 'Nu' : `${Math.abs(f.offset)} min geleden`))
    : d.toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit'}) + (f.isNowcast?' verwacht':'');
  $('#timeLabel').textContent = label;
  $('#radarNowBadge')?.classList.toggle('show', state.radar.layer === 'precip' && f.isNow);
  if($('#radarFrameSlider')) $('#radarFrameSlider').value = String(i);
  $$('.tframe').forEach((el,idx)=>el.classList.toggle('active', idx===i));
}
function stopPlaying(){
  state.radar.playing = false;
  clearTimeout(state.radar.timer);
  $('#playBtn').innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 20,12 6,20"/></svg>`;
}
function scheduleRadarPlayback(){
  clearTimeout(state.radar.timer);
  const delay = state.radar.index >= state.radar.frames.length - 1 ? 1350 : 820;
  state.radar.timer = setTimeout(()=>{
    if(!state.radar.playing) return;
    const next = state.radar.index + 1 >= state.radar.frames.length ? 0 : state.radar.index + 1;
    setFrame(next);
    scheduleRadarPlayback();
  }, delay);
}
$('#playBtn').addEventListener('click', ()=>{
  if(state.radar.playing){ stopPlaying(); return; }
  state.radar.playing = true;
  $('#playBtn').innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>`;
  scheduleRadarPlayback();
});
$('#radarFrameSlider')?.addEventListener('input', (e)=>{
  stopPlaying();
  setFrame(Number(e.target.value || 0));
});
$('#opacitySlider').addEventListener('input', (e)=>{
  state.radar.opacity = (+e.target.value)/100;
  if(state.radar.knmiLayer) state.radar.knmiLayer.setOpacity(state.radar.opacity);
  if(state.radar.animator) state.radar.animator.setOpacity(state.radar.opacity);
});
async function switchLayer(layerId){
  const l=normalizeRadarLayerId(layerId);
  if(state.xweather.ready || state.xweather.controller){
    teardownXweather();
    state.xweather.fallback = true;
    $('#liveRadarPanel')?.classList.remove('hide');
  }
  state.radar.layer = l === 'satellite' ? 'satellite' : 'precip';
  syncRadarLayerUi(state.radar.layer);
  rememberRadarLayer(state.radar.layer);
  if(state.radar.animator){ state.radar.animator.destroy(); state.radar.animator = null; }
  clearOpenMeteoRadarLayer();
  if(state.radar.layer === 'precip') startLegacyRadar();
  else await loadRadarFrames();
}
const SCHEMES = [
  {v:4, l:'Helder'}, {v:2, l:'Universeel'}, {v:8, l:'Intens'}, {v:3, l:'Origineel'}, {v:6, l:'Zwart-wit'}
];
let schemeIdx = 0;
$('#chipScheme').addEventListener('click', ()=>{
  schemeIdx = (schemeIdx+1) % SCHEMES.length;
  state.radar.scheme = SCHEMES[schemeIdx].v;
  $('#schemeLabel').textContent = SCHEMES[schemeIdx].l;
  if(state.radar.layer==='precip') setFrame(state.radar.index);
});

/* ----- tijdsduur: 1 uur = live animatie, 6/12/24 uur = uurlijkse neerslagprognose ----- */
$$('#durationRow button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    $$('#durationRow button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    state.radar.duration = +btn.dataset.dur;
    if(state.radar.duration === 1){
      $('#liveRadarPanel').classList.remove('hide');
      $('#hourlyChartPanel').classList.remove('show');
      stopPlaying();
      buildFrameList();
    } else {
      stopPlaying();
      $('#liveRadarPanel').classList.add('hide');
      $('#hourlyChartPanel').classList.add('show');
      renderHourlyChart();
    }
  });
});
function renderHourlyChart(){
  const wrap = $('#hourlyChart');
  if(!state.hourly){ wrap.innerHTML = ''; return; }
  const n = state.radar.duration;
  const nowIdx = nowIndexInHourly();
  const slice = [];
  for(let i=nowIdx; i<Math.min(nowIdx+n, state.hourly.time.length); i++) slice.push(i);
  const maxMm = Math.max(1, ...slice.map(i=>state.hourly.precipitation[i]||0));
  let html = '';
  const step = n > 12 ? (n>18?3:2) : 1; // toon minder labels bij lange periodes, voorkomt overvolle as
  slice.forEach((i,pos)=>{
    const mm = state.hourly.precipitation[i] || 0;
    const pop = state.hourly.precipitation_probability[i] || 0;
    const wc = wcInfo(state.hourly.weather_code[i]);
    const h = Math.max(2, Math.round((mm/maxMm)*90));
    const t = new Date(state.hourly.time[i]);
    const label = pos % step === 0 ? (t.getHours()+'u') : '';
    html += `<div class="hbar-col">
      <div class="hpop">${pop>10?pop+'%':''}</div>
      <div class="hbar-track"><div class="hbar ${wc.severe?'storm':''}" style="height:${h}%;" title="${mm.toFixed(1)} mm"></div></div>
      <div class="hlabel">${label}</div>
    </div>`;
  });
  wrap.innerHTML = html || '<div class="subtle" style="padding:10px;">Geen data beschikbaar.</div>';
}


/* =========================================================================
   STORM CHASER TAB
   ========================================================================= */
function riskScore(cape, li, gust){
  const cScore = Math.min(Math.max(cape,0),3000)/3000;
  const lScore = Math.min(Math.max(-li,0)+2,12)/12;
  const gScore = Math.min(Math.max(gust,0),120)/120;
  return Math.round(Math.min(100, (cScore*55 + lScore*30 + gScore*15)));
}
function updateStormTab(){
  if(!state.hourly) return;
  const nowIdx = nowIndexInHourly();
  const cape = state.hourly.cape[nowIdx], li = state.hourly.lifted_index[nowIdx], gust = state.hourly.wind_gusts_10m[nowIdx];
  const storm = stormEngine();
  const score = Math.max(riskScore(cape, li, gust), storm.relevant ? 35 : 0);
  $('#riskLocName').textContent = locationDisplayName();
  $('#riskNum').textContent = score;
  $('#capeNow').textContent = Math.round(cape ?? 0);
  $('#liNow').textContent = li != null ? li.toFixed(1) : '0.0';
  $('#gustNow').textContent = fmtWindVal(gust);
  $('#frzNow').textContent = Math.round(state.hourly.freezing_level_height[nowIdx] ?? 0);
  const circumference = 389.6;
  const offset = circumference - (score/100)*circumference;
  $('#riskArc').style.strokeDashoffset = offset;
  $('#riskArc').style.stroke = score>65 ? '#ef4b5f' : score>35 ? '#f5a524' : '#4ade80';

  const riskCard = $('#riskLocName')?.closest('.card');
  if(riskCard){
    let note = riskCard.querySelector('.storm-engine-note');
    if(!note){
      note = document.createElement('div');
      note.className = 'storm-engine-note';
      riskCard.appendChild(note);
    }
    note.innerHTML = storm.relevant
      ? `<b>Live onweersmodus actief</b><span>Passage: ${storm.etaMinutes != null ? '±'+storm.etaMinutes+' min' : 'onzeker'} - bliksemafstand: ${storm.lightningDistanceKm == null ? 'niet beschikbaar' : storm.lightningDistanceKm.toFixed(1)+' km'}. ${esc(storm.limitation)}</span>`
      : `<b>Geen duidelijke onweersmodus</b><span>Er is geen echte bliksemdetectie gekoppeld; Wheaterflow gebruikt radar, CAPE, lifted index, windstoten en meldingen als indicatie.</span>`;
  }

  renderFavChips();
  renderHourTable();
}
function renderFavChips(){
  const wrap = $('#favchips'); wrap.innerHTML='';
  if(!state.favorites.length){
    wrap.innerHTML = `<span class="subtle" style="font-size:12.5px;">Nog geen locaties opgeslagen.</span>`;
    return;
  }
  state.favorites.forEach((f,i)=>{
    const active = f.lat===state.loc.lat && f.lon===state.loc.lon;
    const chip = document.createElement('span');
    chip.className = 'fav-chip' + (active?' active':'');
    chip.innerHTML = `${f.name} <span class="x" data-i="${i}">x</span>`;
    chip.addEventListener('click', (e)=>{
      if(e.target.classList.contains('x')){
        state.favorites.splice(i,1); saveFavorites(); renderFavChips(); return;
      }
      setLocation(f.lat, f.lon, f.name, f.admin, f.country || '', 'manual');
    });
    wrap.appendChild(chip);
  });
}
$('#addCurrentFav').addEventListener('click', ()=>{
  if(state.favorites.some(f=>f.lat===state.loc.lat && f.lon===state.loc.lon)){ toast('Al opgeslagen'); return; }
  state.favorites.push({...state.loc});
  saveFavorites(); renderFavChips();
  toast(`${state.loc.name} toegevoegd`);
});

let onlyHits = false;
$('#onlyHits').addEventListener('click', ()=>{ onlyHits = !onlyHits; $('#onlyHits').classList.toggle('active', onlyHits); $('#onlyHits').style.background = onlyHits?'#35d0c4':''; $('#onlyHits').style.color = onlyHits?'#04302c':''; renderHourTable(); });

['fCape','fLi','fGust','fPop'].forEach(id=>{
  $('#'+id).addEventListener('input', (e)=>{
    $('#'+id+'Val').textContent = e.target.value;
    renderHourTable();
  });
});

function renderHourTable(){
  if(!state.hourly) return;
  const nowIdx = nowIndexInHourly();
  const fCape = +$('#fCape').value, fLi = +$('#fLi').value, fGust = +$('#fGust').value, fPop = +$('#fPop').value;
  const rows = [];
  let hits = 0;
  for(let i=nowIdx; i<Math.min(nowIdx+48, state.hourly.time.length); i++){
    const cape = state.hourly.cape[i], li = state.hourly.lifted_index[i], gust = state.hourly.wind_gusts_10m[i], pop = state.hourly.precipitation_probability[i];
    const isHit = cape>=fCape && li<=fLi && gust>=fGust && pop>=fPop;
    if(isHit) hits++;
    if(onlyHits && !isHit) continue;
    const t = new Date(state.hourly.time[i]);
    const wc = wcInfo(state.hourly.weather_code[i]);
    rows.push(`<tr class="${isHit?'hit':''}">
      <td>${t.toLocaleDateString('nl-BE',{weekday:'short'})} ${t.getHours()}:00</td>
      <td>${wc.l}</td>
      <td>${Math.round(cape)}</td>
      <td>${li!=null?li.toFixed(1):'-'}</td>
      <td>${fmtWindVal(gust)}</td>
      <td>${pop}%</td>
    </tr>`);
  }
  $('#hourTableBody').innerHTML = rows.join('') || `<tr><td colspan="6" style="text-align:center;color:var(--dim);padding:20px;">Geen uren gevonden binnen deze filters.</td></tr>`;
  $('#hitCount').textContent = `${hits} uur voldoet aan filters (komende 48u)`;
}

/* =========================================================================
   TV MODE - volledig scherm dashboard voor laptop/tv
   ========================================================================= */
const TV_RADAR_REFRESH_MS = 5 * 60 * 1000;
const tv = {
  active:false,
  map:null,
  animator:null,
  radarLayer:null,
  knmiLayer:null,
  xweatherController:null,
  xweatherReady:false,
  frames:[],
  index:0,
  loopTimer:null,
  clockTimer:null,
  refreshTimer:null,
  baseMapLoaded:false,
  radarLayerLoaded:false,
  radarRefreshPromise:null,
  radarProvider:'rainviewer',
  resizeObserver:null,
  resizeFrame:null,
  resizeTimers:[]
};

async function enterTV(options={}){
  tv.active = true;
  document.getElementById('tvscreen').classList.add('active');
  const externalReceiver = Boolean(options.fromCast || options.fromPairing);
  document.body.classList.toggle('tv-cast-receiver', Boolean(options.fromCast));
  document.body.classList.toggle('tv-pairing-receiver', Boolean(options.fromPairing));
  if(!externalReceiver){
    try{
      if(document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else if(document.documentElement.webkitRequestFullscreen) document.documentElement.webkitRequestFullscreen();
    }catch(e){ /* fullscreen kan geweigerd zijn - dashboard blijft gewoon zichtbaar */ }
  }

  if(state.current) renderTV();
  tickClock();
  clearInterval(tv.clockTimer); clearInterval(tv.refreshTimer);
  tv.clockTimer = setInterval(tickClock, 1000);
  tv.refreshTimer = setInterval(()=>{ loadWeather(); }, 5*60*1000);

  initTvMap();
}
function exitTV(){
  if(state.cast.receiver || state.tvPairing.receiver) return;
  tv.active = false;
  document.getElementById('tvscreen').classList.remove('active');
  document.body.classList.remove('tv-cast-receiver');
  document.body.classList.remove('tv-pairing-receiver');
  clearInterval(tv.clockTimer); clearInterval(tv.refreshTimer); clearInterval(tv.loopTimer);
  disposeTvXweatherRadar();
  if(document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(()=>{});
}
$('#tvExitBtn').addEventListener('click', exitTV);
document.addEventListener('fullscreenchange', ()=>{
  if(!document.fullscreenElement && tv.active) exitTV();
});
document.addEventListener('keydown', (e)=>{
  if(e.key === 'Escape' && document.body.classList.contains('auth-open')) closeAuthSheet();
  if(e.key === 'Escape' && document.body.classList.contains('day-detail-open')) closeDayDetail();
  if(e.key === 'Escape' && document.body.classList.contains('tv-pair-open')) closeTvPairSheet();
  if(e.key === 'Escape' && tv.active) exitTV();
});
window.addEventListener('popstate', ()=>{
  if(document.body.classList.contains('auth-open')) closeAuthSheet({fromPopState:true});
});
document.addEventListener('visibilitychange', ()=>{
  if(!document.hidden && tv.active){
    if(tv.xweatherReady) refreshTvXweatherRadar();
    else refreshTvRadarFrame();
  }
});
window.addEventListener('focus', ()=>{
  if(tv.active){
    if(tv.xweatherReady) refreshTvXweatherRadar();
    else refreshTvRadarFrame();
  }
});
window.addEventListener('resize', ()=>{
  if(state.map) setTimeout(()=>state.map.invalidateSize(), 120);
  if(tv.map) resizeTvMap();
  positionSunPaths();
});
window.addEventListener('orientationchange', ()=>{
  if(state.map) setTimeout(()=>state.map.invalidateSize(), 350);
  if(tv.map) resizeTvMap();
  setTimeout(positionSunPaths, 350);
});

function tickClock(){
  const now = new Date();
  const opts = {hour:'2-digit', minute:'2-digit', timeZone: state.tz || undefined};
  const dopts = {weekday:'long', day:'numeric', month:'long', timeZone: state.tz || undefined};
  $('#tvClock').textContent = now.toLocaleTimeString('nl-BE', opts);
  $('#tvDate').textContent = now.toLocaleDateString('nl-BE', dopts);
}

function renderTV(){
  if(!state.current) return;
  const cur = liveWeatherSnapshot(), hourly = state.hourly, daily = state.daily;
  const intel = weatherIntelligence();
  const wc = wcInfo(cur.weather_code);
  const isDay = cur.is_day === 1;
  const nowIdx = nowIndexInHourly();
  const dewPoint = hourly?.dew_point_2m?.[nowIdx];
  const humidity = cur.relative_humidity_2m ?? hourly?.relative_humidity_2m?.[nowIdx];
  const pressure = cur.pressure_msl ?? hourly?.pressure_msl?.[nowIdx];
  const gust = cur.wind_gusts_10m ?? hourly?.wind_gusts_10m?.[nowIdx];

  $('#tvLocName').textContent = locationDisplayName();
  $('#tvAdmin').textContent = state.loc.admin || '';
  const tvStatus = $('#tvCastStatus');
  if(tvStatus){
    if(state.cast.receiver) tvStatus.textContent = 'Cast actief';
    else if(state.tvPairing.receiver || state.tvPairing.connected) tvStatus.textContent = 'TV gekoppeld';
    else tvStatus.textContent = 'Wheaterflow TV';
  }
  $('#tvIcon').innerHTML = icon(wc.ic, isDay, 110);
  $('#tvTemp').innerHTML = fmtTemp(cur.temperature_2m);
  $('#tvCond').textContent = wc.l;
  const sunrise = formatTvSunTime(daily.sunrise?.[0]);
  const sunset = formatTvSunTime(daily.sunset?.[0]);
  $('#tvHiLo').innerHTML = `H: <b>${fmtTemp(daily.temperature_2m_max[0])}</b> &nbsp; L: <b>${fmtTemp(daily.temperature_2m_min[0])}</b> &nbsp; Voelt als ${fmtTemp(cur.apparent_temperature)}<div class="tv-sunline">${icon('sunrise',true,18)} Zon op ${sunrise} &nbsp; Zon onder ${sunset}</div>`;

  try{
    $('#tvDetails').innerHTML = [
      tvMetricCard('wind','Wind', fmtWind(cur.wind_speed_10m), 'Stoten '+fmtWind(gust)),
      tvMetricCard('drop','Rain ETA', tvRainValue(intel.rain), tvRainSubtitle(intel.rain)),
      tvMetricCard('gauge','Vochtigheid', humidity != null ? humidity+'%' : '-', 'Dauwpunt '+fmtTemp(dewPoint)),
      tvMetricCard('thermo','Druk', fmtPress(pressure), pressure != null ? (pressure>1013?'Hoge druk':'Lage druk') : 'Niet beschikbaar'),
      tvMarineCard(),
      tvAlertCard()
    ].filter(Boolean).join('');
  }catch(error){
    console.warn('TV details render faalde:', error);
    $('#tvDetails').innerHTML = [
      tvMetricCard('wind','Wind', fmtWind(cur.wind_speed_10m), 'Stoten '+fmtWind(gust)),
      tvMetricCard('drop','Rain ETA','N.b.','Nowcast tijdelijk niet beschikbaar'),
      tvMetricCard('gauge','Vochtigheid', humidity != null ? humidity+'%' : '-', 'Dauwpunt '+fmtTemp(dewPoint)),
      tvMetricCard('thermo','Druk', fmtPress(pressure), 'Niet beschikbaar'),
      tvMetricCard('drop','Kust','N.b.','Geen kustdata beschikbaar'),
      tvMetricCard('gauge','Weermelding','Code groen','')
    ].join('');
  }

  let hh = '';
  for(let i=nowIdx; i<Math.min(nowIdx+8, hourly.time.length); i++){
    const t = new Date(hourly.time[i]);
    const label = i===nowIdx ? 'Nu' : t.getHours()+':00';
    const hwc = wcInfo(hourly.weather_code[i]);
    const hIsDay = isDayForTime(hourly.time[i]);
    hh += `<div class="hitem ${i===nowIdx?'now':''}"><div class="t">${label}</div>${icon(hwc.ic,hIsDay,24)}<div class="p">${hourly.precipitation_probability[i]>10?hourly.precipitation_probability[i]+'%':''}</div><div class="v">${fmtTemp(hourly.temperature_2m[i])}</div></div>`;
  }
  $('#tvHourly').innerHTML = hh;

  let dd = '';
  for(let i=0;i<6;i++){
    const dwc = wcInfo(daily.weather_code[i]);
    const d = new Date(daily.time[i]);
    const dn = i===0?'Vandaag':d.toLocaleDateString('nl-BE',{weekday:'short'});
    dd += `<div class="ditem"><div class="dn">${dn}</div>${icon(dwc.ic,true,22)}<div class="dv">${fmtTemp(daily.temperature_2m_max[i])} <span class="lo">${fmtTemp(daily.temperature_2m_min[i])}</span></div></div>`;
  }
  $('#tvDaily').innerHTML = dd;
}

function tvMetricCard(ic,title,val,sub){
  const extraClass = title === 'Rain ETA' ? ' tv-rain-eta' : '';
  return `<div class="dcard${extraClass}">${icon(ic,true,18)}<div><div class="dt-title">${title}</div><div class="dt-val">${val}</div><div class="dt-sub">${sub}</div></div></div>`;
}

function formatTvSunTime(value){
  if(!value) return '--:--';
  const text = String(value);
  if(text.length >= 16 && text.includes('T')) return text.slice(11,16);
  const d = new Date(value);
  if(Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('nl-BE', {hour:'2-digit', minute:'2-digit', timeZone:state.tz || undefined});
}

function tvAlertCard(){
  const alert = state.alerts?.[0] || buildIndicativeAlert()[0];
  const level = ALERT_LEVELS[alert.level] || ALERT_LEVELS.green;
  const official = alert.source === 'officieel' || alert.official === true || alert.region || alert.validFrom || alert.validTo;
  if(alert.level === 'green'){
    return `<div class="dcard tv-warning green">${icon('gauge',true,18)}<div><div class="dt-title">Weermelding</div><div class="dt-val">Code groen</div></div></div>`;
  }
  const label = official ? level.label : 'Slim signaal';
  return `<div class="dcard tv-warning ${level.cls}">${icon('gauge',true,18)}<div><div class="dt-title">Weermelding</div><div class="dt-val">${label}</div><div class="dt-sub">${esc(alert.headline)}</div></div></div>`;
}

function tvMarineCard(){
  if(!state.marine || !state.marine.tide) return tvMetricCard('drop','Kust','N.b.','Geen kustdata beschikbaar');
  const tide = state.marine.tide;
  const nextLabel = tide.nextType === 'hoogwater' ? 'vloed' : 'eb';
  const nextTime = tide.nextTime instanceof Date && !Number.isNaN(tide.nextTime.getTime())
    ? tide.nextTime.toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit'})
    : '--:--';
  const wave = state.marine.waveHeight != null ? `${state.marine.waveHeight.toFixed(1)} m` : 'n.b.';
  const spark = state.seaspark ? ` - zeevonk ${Math.round(state.seaspark.score)}/100` : '';
  return `<div class="dcard tv-marine">${icon('drop',true,18)}<div><div class="dt-title">Kust</div><div class="dt-val">${esc(tide.state || 'Kust')}</div><div class="dt-sub">Volgende ${nextLabel} ${nextTime} - golfhoogte ${wave}${spark}</div></div></div>`;
}

function resizeTvMap({refit=true}={}){
  if(!tv.map) return;
  const apply = ()=>{
    if(!tv.map || !document.querySelector('#tvscreen.active')) return;
    tv.map.invalidateSize({animate:false, pan:false, debounceMoveend:true});
    if(refit) setTvRadarViewForProvider(tv.radarProvider || 'rainviewer');
    tv.xweatherController?.resize?.();
  };
  if(tv.resizeFrame) cancelAnimationFrame(tv.resizeFrame);
  tv.resizeFrame = requestAnimationFrame(()=>{
    tv.resizeFrame = requestAnimationFrame(apply);
  });
  tv.resizeTimers.forEach(clearTimeout);
  tv.resizeTimers = [160, 480].map(delay=>setTimeout(apply, delay));
}

async function initTvMap(){
  if(!tv.map){
    const rv = tvRadarView();
    const range = RADAR_PROVIDER_ZOOMS.rainviewer;
    tv.map = L.map('tvmap', {
      zoomControl:false,
      attributionControl:false,
      dragging:false,
      scrollWheelZoom:false,
      doubleClickZoom:false,
      boxZoom:false,
      keyboard:false,
      touchZoom:false,
      tap:false,
      zoomSnap:.25,
      minZoom:range.min,
      maxZoom:range.max
    }).setView(rv.center, rv.zoom);
    tv.map.createPane('radarPane');
    tv.map.getPane('radarPane').style.zIndex = 420;
    tv.map.createPane('labelPane');
    tv.map.getPane('labelPane').style.zIndex = 650;
    tv.map.getPane('labelPane').style.pointerEvents = 'none';
    const base = addOpenFreeMapBase(tv.map, {attribution:false});
    if(base?.on) base.on('load', ()=>{ tv.baseMapLoaded = true; });
    // MapLibre vectorstijlen bevatten hun eigen labels, dus een aparte label-tegellaag is niet meer nodig.
    tv.locationMarker = L.circleMarker(rv.marker, {
      radius:6,
      color:'#fff',
      weight:2,
      fillColor:'#1677ff',
      fillOpacity:.98,
      pane:'labelPane'
    }).bindTooltip('Oostende', {
      permanent:true,
      direction:'left',
      offset:[-8, 0],
      className:'tv-location-label'
    }).addTo(tv.map);
    if(window.ResizeObserver){
      tv.resizeObserver = new ResizeObserver(()=>resizeTvMap());
      tv.resizeObserver.observe(document.getElementById('tvmap'));
    }
  } else {
    tv.locationMarker?.setLatLng(tvRadarView().marker);
  }
  setTvRadarViewForProvider('rainviewer');
  resizeTvMap();
  disposeTvXweatherRadar();
  clearInterval(tv.loopTimer);
  await refreshTvRadarFrame();
  resizeTvMap();
  tv.loopTimer = setInterval(refreshTvRadarFrame, TV_RADAR_REFRESH_MS);
}

function tvRainValue(rain){
  if(!rain || rain.status === 'unavailable') return 'N.b.';
  if(rain.status === 'dry') return 'Droog';
  if(rain.status === 'raining') return rain.intensityLabel;
  if(rain.startTime) return `Rond ${formatShortTime(rain.startTime)}`;
  return `Over ${Math.max(0, Math.round(Number(rain.startsInMinutes) || 0))} min`;
}

function tvRainSubtitle(rain){
  if(!rain || rain.status === 'unavailable') return 'Nowcast tijdelijk niet beschikbaar';
  if(rain.status === 'dry') return tvLaterRainTrend()?.detail || `Minstens ${rain.dryWindowMinutes} min droog`;
  if(rain.status === 'raining') return rain.endTime ? `Droger rond ${formatShortTime(rain.endTime)}` : 'Geen droog venster';
  return rain.endTime ? `${formatShortTime(rain.startTime)}-${formatShortTime(rain.endTime)}` : `${Math.round(rain.confidence * 100)}% zeker`;
}

async function initTvXweatherRadar(){
  if(!tv.map || !window.L) return false;
  if(tv.xweatherReady && tv.xweatherController){
    refreshTvXweatherRadar();
    return true;
  }
  try{
    const config = await fetchXweatherConfig();
    if(!config?.configured || !config.clientId || !config.clientSecret) return false;
    await ensureXweatherSdk();
    const maps = window.mapsgl;
    if(!maps?.Account || !maps?.LeafletMapController) return false;
    clearTvRadarLayer();
    if(tv.knmiLayer){
      tv.map.removeLayer(tv.knmiLayer);
      tv.knmiLayer = null;
    }
    const account = new maps.Account(config.clientId, config.clientSecret);
    const controller = new maps.LeafletMapController(tv.map, {
      account,
      units:{
        temperature:'C',
        speed:'km/h',
        pressure:'hPa',
        distance:'km',
        precipitation:'mm'
      },
      animation:{
        duration:0,
        endDelay:0,
        pauseWhileLoading:true,
        resumeOnMoveEnd:false,
        preloadData:false
      }
    });
    tv.xweatherController = controller;
    await controller.initialize();
    controller.setRefreshInterval(5, true);
    controller.addWeatherLayer('radar', xweatherLayerOverrides('radar'));
    tv.xweatherReady = true;
    await refreshTvXweatherRadar();
    setTimeout(()=>controller.resize?.(), 120);
    return true;
  }catch(err){
    console.warn('Xweather tv-radar kon niet starten', err);
    disposeTvXweatherRadar();
    return false;
  }
}

async function refreshTvXweatherRadar(){
  const controller = tv.xweatherController;
  if(!controller) return false;
  try{
    const timeline = controller.timeline;
    if(timeline?.goToDate) timeline.goToDate(new Date());
    if(timeline?.pause) timeline.pause();
    if(controller.setRefreshInterval) controller.setRefreshInterval(5, true);
    if(controller.refresh) await controller.refresh();
    if(controller.resize) controller.resize();
    updateTvRadarLabel(null, 'Live buienradar · NU');
    return true;
  }catch(err){
    console.warn('Xweather tv-radar kon niet verversen', err);
    updateTvRadarLabel(null, 'Radar tijdelijk niet beschikbaar');
    return false;
  }
}

function disposeTvXweatherRadar(){
  if(tv.xweatherController){
    try{ tv.xweatherController.timeline?.pause?.(); }catch(e){}
    try{ tv.xweatherController.removeWeatherLayer?.('radar'); }catch(e){}
    try{ tv.xweatherController.dispose?.(); }catch(e){}
  }
  tv.xweatherController = null;
  tv.xweatherReady = false;
}
async function refreshTvRadarFrame(){
  if(tv.radarRefreshPromise) return tv.radarRefreshPromise;
  const refresh = refreshTvRadarFrameNow();
  tv.radarRefreshPromise = refresh;
  try{
    return await refresh;
  }finally{
    if(tv.radarRefreshPromise === refresh) tv.radarRefreshPromise = null;
  }
}
async function refreshTvRadarFrameNow(){
  if(!tv.map) return;
  setTvRadarViewForProvider('rainviewer');
  tv.radarLayerLoaded = false;
  try{
    const frame = await fetchLatestRainviewerRadarFrame();
    if(frame){
      setTvRainviewerFrame(frame);
      resizeTvMap();
      return;
    }
  }catch(error){
    console.info('RainViewer tv-radar kon niet laden, WeatherFlow-radar wordt geprobeerd', error);
  }
  try{
    setTvFrame(0);
    resizeTvMap();
  }catch(error){
    console.warn('WeatherFlow tv-radar kon niet starten', error);
    updateTvRadarLabel(null, 'Live radar tijdelijk niet beschikbaar');
    setTvRadarFallback('Live radar tijdelijk niet beschikbaar');
  }
}
function setTvRainviewerFrame(frame){
  if(!tv.map || !frame) return;
  setTvRadarViewForProvider('rainviewer');
  clearTvRadarLayer();
  tv.radarLayerLoaded = false;
  let failed = false;
  let loaded = false;
  const layer = L.tileLayer(rainviewerTileUrl(frame, 'tv'), {
    opacity:0.9,
    minZoom:RADAR_PROVIDER_ZOOMS.rainviewer.min,
    maxZoom:RADAR_PROVIDER_ZOOMS.rainviewer.max,
    maxNativeZoom:RADAR_PROVIDER_ZOOMS.rainviewer.nativeMax,
    pane:'radarPane',
    className:'radar-tile-layer tv-radar-live-layer',
    crossOrigin:true,
    keepBuffer:1,
    updateWhenIdle:false,
    updateWhenZooming:false
  });
  tv.radarLayer = layer;
  layer.on('load', ()=>{
    if(failed) return;
    loaded = true;
    tv.radarLayerLoaded = true;
    setTvRadarFallback('');
    updateTvRadarLabel(frame.time, 'Radar bijgewerkt');
  });
  layer.on('tileerror', ()=>{
    if(failed) return;
    failed = true;
    layer.setOpacity(0);
    console.info('RainViewer-tegel faalde, WeatherFlow-radar wordt geprobeerd', {
      provider:'rainviewer',
      requestedZoom:tvRadarView().zoom,
      clampedZoom:clampRadarZoom('rainviewer', tvRadarView().zoom),
      frameTime:frame.time,
      center:tvRadarView().center
    });
    updateTvRadarLabel(null, 'Alternatieve radar laden');
    setTvRadarFallback('Radarlaag wordt geladen...');
    try{
      setTvFrame(0);
      resizeTvMap();
    }catch(error){
      console.warn('WeatherFlow tv-radar kon niet starten', error);
      updateTvRadarLabel(null, 'Live radar tijdelijk niet beschikbaar');
      setTvRadarFallback('Live radar tijdelijk niet beschikbaar');
    }
  });
  updateTvRadarLabel(null, 'Radarlaag laden');
  setTvRadarFallback('Radarlaag wordt geladen...');
  layer.addTo(tv.map);
  setTimeout(()=>{
    if(tv.radarLayer !== layer) return;
    if(!loaded && !failed){
      setTvRadarFallback('Radarlaag wordt geladen...');
    }
  }, 1200);
}
function setTvFrame(i){
  if(!tv.map) return;
  tv.index = i;
  setTvRadarViewForProvider('weatherflow');
  const offset = WEATHERFLOW_RADAR_OFFSETS[i] ?? 0;
  const url = weatherflowRadarTileUrl(offset);
  clearTvRadarLayer();
  tv.radarLayerLoaded = false;
  let failed = false;
  const layer = L.tileLayer(url, {
    opacity:0.9,
    minZoom:RADAR_PROVIDER_ZOOMS.weatherflow.min,
    maxZoom:RADAR_PROVIDER_ZOOMS.weatherflow.max,
    maxNativeZoom:RADAR_PROVIDER_ZOOMS.weatherflow.nativeMax,
    pane:'radarPane',
    className:'radar-tile-layer tv-radar-live-layer',
    crossOrigin:true,
    keepBuffer:1,
    updateWhenIdle:false,
    updateWhenZooming:false
  });
  layer.on('load', ()=>{
    if(failed) return;
    tv.radarLayerLoaded = true;
    setTvRadarFallback('');
    updateTvRadarLabel(Math.round(Date.now()/1000), 'Radar bijgewerkt');
  });
  layer.on('tileerror', ()=>{
    if(failed) return;
    failed = true;
    layer.setOpacity(0);
    tv.radarLayerLoaded = false;
    updateTvRadarLabel(null, 'Live radar tijdelijk niet beschikbaar');
    setTvRadarFallback('Live radar tijdelijk niet beschikbaar');
  });
  tv.radarLayer = layer.addTo(tv.map);
  setTvRadarFallback('');
  updateTvRadarLabel(null, 'Radarlaag laden');
}

function clearTvRadarLayer(){
  if(tv.radarLayer && tv.map){
    tv.map.removeLayer(tv.radarLayer);
  }
  tv.radarLayer = null;
}

function updateTvRadarLabel(epochSeconds, fallback='Live buienradar'){
  const el = document.querySelector('.tv-radar-label');
  if(!el) return;
  if(!epochSeconds){
    el.textContent = fallback;
    return;
  }
  const d = new Date(epochSeconds * 1000);
  const time = d.toLocaleTimeString('nl-BE', {hour:'2-digit', minute:'2-digit', timeZone:state.tz || undefined});
  const title = fallback && fallback !== 'Live buienradar' ? fallback : 'Radar bijgewerkt';
  el.textContent = `${title} ${time}`;
}

function setTvRadarFallback(text=''){
  const card = document.querySelector('.tv-radar-card');
  if(!card) return;
  let el = document.getElementById('tvRadarFallback');
  if(!el){
    el = document.createElement('div');
    el.id = 'tvRadarFallback';
    el.className = 'tv-radar-fallback hidden';
    card.appendChild(el);
  }
  el.textContent = text;
  el.classList.toggle('hidden', !text);
}

/* =========================================================================
   INIT
   ========================================================================= */

function wireProfileSafety(){
  $('#profileCommunityMenu')?.addEventListener('click',()=>{ closeAuthSheet(); showAppScreen('communityscreen'); loadCommunityPosts(true); });
  $('#deleteAccountBtn')?.addEventListener('click',async()=>{
    if(!state.auth.user) return;
    if(!confirm('Wil je je Wheaterflow-account echt verwijderen? Dit kan niet ongedaan worden gemaakt.')) return;
    const typed=prompt('Tweede bevestiging: typ VERWIJDEREN om je account definitief te verwijderen.');
    if(typed!=='VERWIJDEREN') return updateProfileMessage('Account verwijderen geannuleerd. Typ exact VERWIJDEREN om te bevestigen.','error');
    try{ await apiJson('/account',{method:'DELETE',body:JSON.stringify({confirmation:'VERWIJDEREN'})}); saveOwnServerSession(null); await applyAuthSession(null); closeAuthSheet(); toast('Account verwijderd.'); }catch(e){ updateProfileMessage('Account kon niet worden verwijderd. Probeer opnieuw.','error'); }
  });
}
async function safeInitStep(label, task){
  try{
    if(typeof task === 'function') return await task();
  }catch(error){
    console.warn(`${label} faalde, app start verder:`, error);
  }
  return undefined;
}

async function init(){
  await safeInitStep('Eenheden laden', loadStoredUnits);
  await safeInitStep('Klimaatdata laden', loadStoredClimate);
  await safeInitStep('Auth UI koppelen', wireAuthUi);
  await safeInitStep('Profielbeveiliging koppelen', wireProfileSafety);
  await safeInitStep('Community UI koppelen', initCommunityUi);
  await safeInitStep('Radar bediening koppelen', wireRadarQuickLayers);
  await safeInitStep('Instellingencategorieën koppelen', initSettingsAccordion);
  await safeInitStep('Klimaat UI koppelen', initClimateUi);
  await safeInitStep('Push instellingen koppelen', wirePushSettings);
  await safeInitStep('Favorieten laden', loadStoredFavorites);
  await safeInitStep('Auth starten', initAuth);
  await safeInitStep('Community realtime starten', subscribeCommunityRealtime);
  await safeInitStep('Google Cast starten', initCast);
  await safeInitStep('TV koppeling starten', initTvPairing);
  await safeInitStep('Instellingenknoppen herstellen', ()=>refreshSettingsSegments());

  await safeInitStep('Locatie ophalen', async ()=>{
    if(state.cast.receiver || state.tvPairing.receiver) return;
    state.locationStatus = 'detecting';
    state.loc = {...state.loc, name: cleanLocationName(state.loc?.name, 'Locatie bepalen...')};
    if(isFirstRunOnboarding()){
      state.locationStatus = 'onboarding';
      return;
    }
    const p = await getBrowserLocation();
    if(p){
      const g = await reverseGeocode(p.lat, p.lon);
      state.loc = {lat:p.lat, lon:p.lon, name:g.name, admin:g.admin, country:g.country};
      state.locationStatus = 'gps';
    }else{
      state.locationStatus = 'denied';
    }
  });
  await loadWeather();
  await safeInitStep('Cast locatie synchroniseren', notifyCastLocationChanged);
  await safeInitStep('TV koppeling synchroniseren', notifyTvPairingLocationChanged);
  safeInitStep('Eigen weermeldingen laden', laadWeerMeldingen);
  setInterval(()=>safeInitStep('Eigen weermeldingen verversen', laadWeerMeldingen), 5 * 60 * 1000);
  await safeInitStep('Auto refresh starten', startAutoRefresh);
}
init().catch(error=>{
  console.error('Fatale init-fout:', error);
  $('#homeLoader')?.classList.add('hide');
  hideAppSplash();
});
// Toevoegen aan script.js van wheaterflow.be
// Toont actieve meldingen bovenaan als banner(s)

async function laadWeerMeldingen() {
  try {
    const params = new URLSearchParams();

    // Land: pas 'België' aan of laat weg als je geen land-filtering nodig hebt
    if (state.loc && state.loc.country) {
      params.set('land', state.loc.country);
    }

    if (state.loc && state.loc.admin) {
      params.set('provincie', state.loc.admin);
    }
    if (state.loc && state.loc.name) {
      params.set('stad', state.loc.name);
    }

    const res = await fetch(`/api/alerts?${params.toString()}`);
    if (!res.ok) return;
    const alerts = await res.json();
    toonMeldingen(alerts);
  } catch (e) {
    console.error('Kon meldingen niet laden', e);
  }
}

function toonMeldingen(alerts) {
  const container = document.getElementById('alerts-container');
  if (!container) return;
  container.innerHTML = '';

  alerts.forEach(a => {
    const el = document.createElement('div');
    el.className = `weather-alert weather-alert--${a.type}`;
    el.innerHTML = `
      <strong>${a.title}</strong>
      <p>${a.message}</p>
    `;
    container.appendChild(el);
  });
}

// BELANGRIJK: verplaats deze aanroep naar NA de regel "await loadWeather();" in je init() functie,
// zodat state.loc al gevuld is met de locatie van de bezoeker vóór we filteren.
// Verwijder de losse "laadWeerMeldingen();" en "setInterval(...)" aanroepen die buiten init() stonden,
// en zet in plaats daarvan dit binnenin init(), net na "await loadWeather();":
//
//   await laadWeerMeldingen();
//   setInterval(laadWeerMeldingen, 5 * 60 * 1000);


/* Bijhorende CSS (voeg toe aan style.css):

.weather-alert {
  border-radius: 10px;
  padding: 12px 16px;
  margin-bottom: 10px;
  border-left: 4px solid #3b82f6;
  background: rgba(59,130,246,0.1);
}
.weather-alert--warning { border-left-color: #f59e0b; background: rgba(245,158,11,0.1); }
.weather-alert--danger  { border-left-color: #ef4444; background: rgba(239,68,68,0.1); }
.weather-alert strong { display: block; margin-bottom: 4px; }
.weather-alert p { margin: 0; font-size: 0.9rem; }

*/


// Interactive Liquid Glass highlight for the bottom navigation.
(() => {
  const bar = document.querySelector('.tabbar');
  if (!bar || bar.dataset.liquidGlassBound === '1') return;
  bar.dataset.liquidGlassBound = '1';

  const moveHighlight = (event) => {
    const rect = bar.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    bar.style.setProperty('--glass-x', `${x}px`);
    bar.style.setProperty('--glass-y', `${y}px`);
  };
  const begin = (event) => {
    moveHighlight(event);
    bar.classList.add('glass-touching');
    try { bar.setPointerCapture?.(event.pointerId); } catch (_) {}
  };
  const end = () => {
    bar.classList.remove('glass-touching');
    window.setTimeout(() => {
      bar.style.setProperty('--glass-x', '50%');
      bar.style.setProperty('--glass-y', '50%');
    }, 140);
  };

  bar.addEventListener('pointerdown', begin, {passive:true});
  bar.addEventListener('pointermove', (event) => {
    if (bar.classList.contains('glass-touching')) moveHighlight(event);
  }, {passive:true});
  bar.addEventListener('pointerup', end, {passive:true});
  bar.addEventListener('pointercancel', end, {passive:true});
  bar.addEventListener('lostpointercapture', end, {passive:true});
})();

// 2026-08-28 — profielinstellingen via glazen tandwiel rechtsboven.
document.getElementById('profileDoneBtn')?.addEventListener('click', ()=>{
  const panel=document.getElementById('profileEditPanel');
  if(!panel) return;
  panel.classList.remove('hidden');
  setTimeout(()=>panel.scrollIntoView({behavior:'smooth',block:'start'}),60);
});


/* =========================================================================
   FIRST RUN ONBOARDING
   ========================================================================= */
function initFirstRunOnboarding(force=false){
  const shell = document.getElementById('firstRunOnboarding');
  if(!shell || (!force && !isFirstRunOnboarding())) return;
  const pages = [...shell.querySelectorAll('[data-onboarding-page]')];
  const dots = [...shell.querySelectorAll('.onboarding-dots i')];
  let current = 0;
  let locationConfirmed = false;
  let pushConfirmed = false;
  let profileChoice = 'Niet ingesteld';
  const isIosDevice=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const shouldShowInstallPage = isIosDevice && !isStandaloneApp();
  const installPageIndex = 3;
  const profilePageIndex = 4;
  const finishPageIndex = 5;
  const normalizeStep=(target,dir=1)=>{
    target=Math.max(0,Math.min(pages.length-1,target));
    if(!shouldShowInstallPage && target===installPageIndex){
      target += dir >= 0 ? 1 : -1;
      target=Math.max(0,Math.min(pages.length-1,target));
    }
    return target;
  };
  const installPage=shell.querySelector('#onboardingInstallPage');
  if(installPage) installPage.classList.toggle('onboarding-step-disabled',!shouldShowInstallPage);
  shell.querySelector('[data-install-dot]')?.classList.toggle('onboarding-step-disabled',!shouldShowInstallPage);
  document.body.classList.add('onboarding-open');
  shell.classList.remove('hidden');
  shell.setAttribute('aria-hidden','false');
  shell.style.opacity=''; shell.style.transform='';

  const show = (next,dir=1)=>{
    next = normalizeStep(next,dir);
    const oldPage = pages[current];
    if(oldPage && next !== current){
      oldPage.classList.add('leaving');
      window.setTimeout(()=>oldPage.classList.remove('active','leaving'),260);
    }
    current = next;
    pages[current]?.classList.add('active');
    dots.forEach((d,i)=>d.classList.toggle('active',i===current));
    const skip=shell.querySelector('#onboardingSkipAll');
    if(skip) skip.classList.toggle('hidden',current!==0);
    shell.querySelector('#onboardingBackBtn')?.classList.toggle('hidden',current===0);
    shell.classList.toggle('onboarding-first-page', current===0);
  };
  const finish = ()=>{
    completeFirstRunOnboarding();
    shell.style.transition='opacity .35s ease, transform .35s ease';
    shell.style.opacity='0';
    shell.style.transform='scale(1.015)';
    window.setTimeout(()=>{
      shell.classList.add('hidden');
      document.body.classList.remove('onboarding-open');
      shell.style.opacity='';shell.style.transform='';
      if(onboardingPendingProfile){
        onboardingPendingProfile=false;
        try{ openAuthSheet(); setAuthMode('signup'); }catch(e){}
      }
    },350);
  };

  shell.querySelectorAll('[data-onboarding-next]').forEach(btn=>btn.onclick=()=>show(current+1,1));
  const backBtn=shell.querySelector('#onboardingBackBtn'); if(backBtn) backBtn.onclick=()=>show(current-1,-1);
  const skipAll=shell.querySelector('#onboardingSkipAll'); if(skipAll) skipAll.onclick=finish;
  const finishBtn=shell.querySelector('#onboardingFinishBtn'); if(finishBtn) finishBtn.onclick=finish;
  shell.querySelectorAll('[data-onboarding-edit]').forEach(btn=>btn.onclick=()=>show(Number(btn.dataset.onboardingEdit)||0));

  const locBtn=shell.querySelector('#onboardingLocationBtn');
  const locLater=shell.querySelector('#onboardingLocationLater');
  if(locLater) locLater.onclick=()=>{
    locationConfirmed=false;
    const sum=shell.querySelector('#onboardingSummaryLocation'); if(sum) sum.textContent='Niet ingesteld';
    show(2);
  };
  if(locBtn) locBtn.onclick=async()=>{
    if(locationConfirmed){ show(2); return; }
    if(locBtn.disabled) return;
    locBtn.disabled=true; locBtn.classList.add('onboarding-busy');
    const status=shell.querySelector('#onboardingLocationStatus');
    if(status) status.textContent='Locatie wordt opgehaald…';
    try{
      const p=await getBrowserLocation();
      if(!p) throw new Error('denied');
      const g=await reverseGeocode(p.lat,p.lon);
      await setLocation(p.lat,p.lon,g.name,g.admin,g.country,'gps');
      locationConfirmed=true;
      shell.querySelector('#onboardingLocationCard')?.classList.add('allowed');
      if(status) status.textContent=`Locatie gevonden: ${g.name || 'huidige locatie'} ✓`;
      const sum=shell.querySelector('#onboardingSummaryLocation'); if(sum) sum.textContent=g.name || 'Ingeschakeld';
      locBtn.textContent='Ga verder';
    }catch(e){
      if(status) status.textContent='Geen toegang — je kunt dit later instellen';
    }finally{
      locBtn.disabled=false; locBtn.classList.remove('onboarding-busy');
    }
  };

  const pushBtn=shell.querySelector('#onboardingPushBtn');
  const pushLater=shell.querySelector('#onboardingPushLater');
  const pushNote=shell.querySelector('#onboardingPushNote');
  const choiceBox=shell.querySelector('#onboardingNotificationChoices');
  const isIos=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  if(isIos && !isStandaloneApp() && pushNote){
    pushNote.textContent='Op iPhone werken pushmeldingen nadat Wheaterflow aan je beginscherm is toegevoegd.';
  }
  const applyOnboardingPushChoices=()=>{
    shell.querySelectorAll('[data-onboarding-pref]').forEach(input=>{
      const key=input.dataset.onboardingPref;
      if(key==='official'){
        state.push.preferences.codeYellow=input.checked;
        state.push.preferences.codeOrange=input.checked;
        state.push.preferences.codeRed=input.checked;
      }else{
        state.push.preferences[key]=input.checked;
      }
    });
    savePushSettings();
    try{ syncProfileSettingsToCloud(); }catch(e){}
    refreshPushSettingsControls();
  };
  shell.querySelectorAll('[data-onboarding-pref]').forEach(input=>input.onchange=applyOnboardingPushChoices);
  if(pushLater) pushLater.onclick=()=>{
    const sum=shell.querySelector('#onboardingSummaryPush'); if(sum) sum.textContent='Niet ingesteld';
    show(installPageIndex,1);
  };
  if(pushBtn) pushBtn.onclick=async()=>{
    if(pushConfirmed){ applyOnboardingPushChoices(); show(installPageIndex,1); return; }
    pushBtn.disabled=true;pushBtn.classList.add('onboarding-busy');
    try{
      await enablePushNotifications();
      const enabled=state.push.status==='Ingeschakeld' || window.Notification?.permission==='granted';
      const sum=shell.querySelector('#onboardingSummaryPush'); if(sum) sum.textContent=enabled?'Ingeschakeld':'Niet ingesteld';
      if(enabled){
        pushConfirmed=true;
        if(pushNote) pushNote.textContent='Meldingen zijn ingeschakeld. Kies hieronder welke meldingen je wilt ontvangen.';
        choiceBox?.classList.remove('hidden');
        pushBtn.textContent='Ga verder';
        applyOnboardingPushChoices();
      }else{
        if(pushNote) pushNote.textContent='Je kunt meldingen later instellen via Profiel of Instellingen.';
      }
    }catch(e){
      if(pushNote) pushNote.textContent='Meldingen konden nu niet worden ingeschakeld. Je kunt dit later opnieuw proberen.';
    }finally{pushBtn.disabled=false;pushBtn.classList.remove('onboarding-busy')}
  };

  const installLater=shell.querySelector('#onboardingInstallLater');
  const installDone=shell.querySelector('#onboardingInstallDone');
  if(installLater) installLater.onclick=()=>show(profilePageIndex,1);
  if(installDone) installDone.onclick=()=>show(profilePageIndex,1);

  const profileLater=shell.querySelector('#onboardingProfileLater');
  if(profileLater) profileLater.onclick=()=>{
    onboardingPendingProfile=false;
    profileChoice='Niet ingesteld';
    const sum=shell.querySelector('#onboardingSummaryProfile'); if(sum) sum.textContent=profileChoice;
    show(finishPageIndex,1);
  };
  const profileBtn=shell.querySelector('#onboardingProfileBtn');
  if(profileBtn) profileBtn.onclick=()=>{
    // Open het echte account-aanmaakscherm in plaats van meteen door te gaan.
    onboardingPendingProfile=true;
    try{
      openAuthSheet();
      setAuthMode('signup');
      setTimeout(()=>document.getElementById('signupName')?.focus(),180);
    }catch(e){
      onboardingPendingProfile=false;
    }
  };

  const onProfileCreated=()=>{
    if(!onboardingPendingProfile) return;
    onboardingPendingProfile=false;
    profileChoice='Ingesteld';
    const sum=shell.querySelector('#onboardingSummaryProfile');
    if(sum) sum.textContent=profileChoice;
    try{ closeAuthSheet(); }catch(e){}
    show(finishPageIndex,1);
  };
  window.addEventListener('wheaterflow:onboarding-profile-created', onProfileCreated);
  show(0);
}
window.addEventListener('DOMContentLoaded',()=>window.setTimeout(()=>initFirstRunOnboarding(false),80));

document.getElementById('replayOnboardingBtn')?.addEventListener('click',()=>{
  try{ localStorage.removeItem(ONBOARDING_STORAGE_KEY); }catch(e){}
  try{ closeSheet(); }catch(e){}
  window.setTimeout(()=>window.location.reload(),120);
});

// Apple-style Liquid Glass specular highlight for the search field.
(() => {
  const glass = document.querySelector('.searchbox');
  if (!glass || glass.dataset.liquidSearchBound === '1') return;
  glass.dataset.liquidSearchBound = '1';
  const move = (event) => {
    const r = glass.getBoundingClientRect();
    const x = Math.max(0, Math.min(r.width, event.clientX - r.left));
    glass.style.setProperty('--search-glass-x', `${x}px`);
  };
  glass.addEventListener('pointerdown', move, {passive:true});
  glass.addEventListener('pointermove', (e) => { if (e.buttons) move(e); }, {passive:true});
  glass.addEventListener('pointerup', () => setTimeout(() => glass.style.setProperty('--search-glass-x','22%'), 140), {passive:true});
  glass.addEventListener('pointercancel', () => glass.style.setProperty('--search-glass-x','22%'), {passive:true});
})();


/* ===== Wheaterflow forecast detail v1 ===== */
function forecastDayDetailCard(i){
  const d=state.daily; if(!d?.time?.[i]) return '';
  const date=new Date(d.time[i]); const wc=wcInfo(d.weather_code?.[i]);
  const name=i===0?'Vandaag':date.toLocaleDateString('nl-BE',{weekday:'long',day:'numeric',month:'long'});
  const pop=Number(d.precipitation_probability_max?.[i]||0);
  const rain=Number(d.precipitation_sum?.[i]||0);
  const gust=Number(d.wind_gusts_10m_max?.[i]||0);
  const uv=Number(d.uv_index_max?.[i]||0);
  return `<div class="forecast-day-sheet-backdrop" data-close-day-detail><section class="forecast-day-sheet liquid-panel" role="dialog" aria-modal="true"><button class="forecast-day-close" data-close-day-detail aria-label="Sluiten">×</button><div class="forecast-day-kicker">${esc(name)}</div><div class="forecast-day-main">${icon(wc.ic,true,54)}<div><strong>${esc(wc.l)}</strong><span>${fmtTemp(d.temperature_2m_min?.[i])} – ${fmtTemp(d.temperature_2m_max?.[i])}</span></div></div><div class="forecast-day-grid"><div><b>${pop}%</b><span>neerslagkans</span></div><div><b>${rain.toFixed(1)} mm</b><span>neerslag</span></div><div><b>${Math.round(gust)} km/u</b><span>windstoten</span></div><div><b>${uv.toFixed(1)}</b><span>UV-index</span></div></div><p>Tik buiten dit venster om terug te gaan naar de verwachting.</p></section></div>`;
}
function openForecastDayDetail(i){ document.querySelector('.forecast-day-sheet-backdrop')?.remove(); document.body.insertAdjacentHTML('beforeend',forecastDayDetailCard(i)); }
document.addEventListener('click',e=>{ const row=e.target.closest?.('.daily-row[data-day-index]'); if(row){ openForecastDayDetail(Number(row.dataset.dayIndex)); return; } if(e.target.matches?.('[data-close-day-detail]')) document.querySelector('.forecast-day-sheet-backdrop')?.remove(); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape') document.querySelector('.forecast-day-sheet-backdrop')?.remove(); if((e.key==='Enter'||e.key===' ')&&e.target.matches?.('.daily-row[data-day-index]')){e.preventDefault();openForecastDayDetail(Number(e.target.dataset.dayIndex));} });
