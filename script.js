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
const XWEATHER_SDK_VERSION = '1.9.3';
const XWEATHER_SDK_BASE = `https://cdn.jsdelivr.net/npm/@xweather/mapsgl@${XWEATHER_SDK_VERSION}/dist/`;
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

const state = {
  loc: { lat: 51.2405, lon: 2.9309, name: "Oostende", admin: "West-Vlaanderen, Belgie" },
  units: { temp:'C', wind:'kmh', precip:'mm', press:'hpa', days:7, model:'knmi_seamless' },
  current: null, hourly: null, daily: null, tz: 'Europe/Brussels', utcOffsetSec: 0,
  observation: null, marine: null, seaspark: null, air: null,
  alerts: [],
  alertsMeta: { source:'Indicatieve weercode', official:false, updated:null },
  knmiKey: null,
  lastUpdated: null,
  favorites: [],
  auth: { configured:false, ready:false, supabase:null, session:null, user:null, profile:null, syncing:false, guest:true },
  community: { posts: [], page: 0, pageSize: 12, hasMore: true, loading: false, view: 'feed', category: '', query: '', map: null, markers: null, selectedFile: null, realtimeChannel: null },
  climate: { records: [], settings: {mode:'off'}, period:'month', location:'all', chart:null, loaded:false },
  xweather: { configured:false, loading:false, ready:false, sdkLoaded:false, controller:null, legend:null, activeLayer:null, activeCodes:[], availableCodes:new Set(), disabledCodes:new Set(), metadata:[], marker:null, accuracy:null, pointMarker:null, timelineUiTimer:null, overlayLightning:false, fallback:false },
  push: { supported:false, standalone:false, configured:false, status:'Niet ondersteund', installationId:null, preferences:null, thresholds:null },
  radar: { frames: [], index: 0, playing: false, timer: null, refreshTimer: null, layer: 'precip', scheme: 4, opacity: 0.9, duration: 1, animator: null },
  map: null, marker: null, homeMap: { map:null, base:null, overlay:null, xweatherController:null, activeLayer:'radar' },
  activeTab: 'home',
  refreshTimer: null, clockTickTimer: null
};

const $ = (s,ctx=document)=>ctx.querySelector(s);
const $$ = (s,ctx=document)=>Array.from(ctx.querySelectorAll(s));
const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '"' ? '&quot;' : '&#39;');

function toast(msg){
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(()=>t.classList.remove('show'), 2200);
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
  state.units.model = 'knmi_seamless';
}
async function saveUnits(){
  try{ await window.storage.set('weerscoop:units', JSON.stringify(state.units)); }catch(e){}
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
async function applyAuthSession(session,event=''){ state.auth.session=session||null; state.auth.user=session?.user||null; state.auth.guest=!state.auth.user; if(state.auth.user){ state.auth.profile={...(state.auth.profile||{}),display_name:state.auth.profile?.display_name||state.auth.user?.user_metadata?.display_name||state.auth.user?.username||state.auth.user?.email?.split('@')[0]||'Wheaterflow gebruiker'}; state.climate.loaded=true; } else { state.auth.profile=null; state.climate.loaded=true; } updateAuthInterface(state.auth.session); renderClimateDashboard(); }

function mapProfileToUnits(profile){
  if(!profile) return;
  if(profile.temperature_unit) state.units.temp = profile.temperature_unit;
  if(profile.wind_unit) state.units.wind = profile.wind_unit;
  if(profile.precipitation_unit) state.units.precip = profile.precipitation_unit;
  if(profile.pressure_unit) state.units.press = profile.pressure_unit;
  if(profile.forecast_days) state.units.days = Number(profile.forecast_days);
  state.units.model = 'knmi_seamless';
}

function profilePayload(){
  return {
    display_name: state.auth.profile?.display_name || state.auth.user?.user_metadata?.display_name || state.auth.user?.email?.split('@')[0] || 'Wheaterflow gebruiker',
    home_location_name: state.loc?.name || null,
    home_latitude: state.loc?.lat ?? null,
    home_longitude: state.loc?.lon ?? null,
    language:'nl',
    temperature_unit:state.units.temp,
    wind_unit:state.units.wind,
    pressure_unit:state.units.press,
    precipitation_unit:state.units.precip,
    forecast_days:state.units.days,
    weather_model:'knmi_seamless',
    notifications_enabled:state.push.status === 'Ingeschakeld'
  };
}

async function loadCloudProfileAndFavorites(){
  if(!state.auth.user) return;
  try{
    const data = await apiJson('/profile');
    state.auth.profile = data.profile || null;
    mapProfileToUnits(state.auth.profile);
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
    const data = await apiJson('/profile', {method:'PUT', body:JSON.stringify(profilePayload())});
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
  return Math.round(v) + '&deg;';
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
  return 'knmi_seamless';
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
  const currentPrecip = Number(state.current?.precipitation) || 0;
  signal.now = Math.max(signal.now, snapshotPrecip, currentPrecip);
  signal.soon = Math.max(signal.soon, snapshotPrecip, currentPrecip);

  const targetMs = Date.now();
  if(state.minutely?.time?.length){
    const idx = closestIndex(state.minutely.time, targetMs);
    const minuteAge = Math.abs(new Date(state.minutely.time[idx]).getTime() - targetMs) / 60000;
    if(minuteAge <= 35){
      const slots = state.minutely.precipitation.slice(idx, idx + 4).map(v=>Number(v) || 0);
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
  return signal;
}

function effectiveCurrentWeatherCode(cur=state.current || {}){
  const code = Number(cur.weather_code);
  const drizzleCodes = [51,53,55,56,57];
  const rainCodes = [61,63,65,66,67,80,81,82];
  const snowCodes = [71,73,75,77,85,86];
  const p = precipitationSignal(cur);

  // Fenomenen die niet door een gewone regen-intensiteit mogen worden vervangen.
  if([99,96,95].includes(code)) return code;
  if(snowCodes.includes(code)) return code;
  if([45,48].includes(code) && p.now < 0.1) return code;
  if(drizzleCodes.includes(code)) return code;
  if([66,67].includes(code)) return code; // ijzel behouden

  // Actuele neerslag heeft voorrang op een achterlopende 'bewolkt'-code.
  // De grenswaarden zijn bewust eenvoudig zodat achtergrond én label snel
  // reageren wanneer het lokaal daadwerkelijk begint te regenen.
  if(p.thunder && p.now >= 0.1) return 95;
  if(p.now >= 3.0) return 65;   // hevige regen
  if(p.now >= 1.0) return 63;   // regen
  if(p.now >= 0.1) return 61;   // lichte regen

  // Als de bron zelf een regencode meldt maar de hoeveelheid net op 0 staat,
  // behoud die regencode; zo verdwijnt regen niet tussen twee meetframes.
  if(rainCodes.includes(code)) return code;

  return Number.isFinite(code) ? code : 0;
}

function isNetherlandsLocation(){
  const {lat, lon} = state.loc;
  return lat >= 50.7 && lat <= 53.8 && lon >= 3.1 && lon <= 7.4;
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

function tvRadarView(){
  const lat = Number(state.loc?.lat);
  const lon = Number(state.loc?.lon);
  if(Number.isFinite(lat) && Number.isFinite(lon)) return {center:[lat, lon], zoom:7};
  return {center:[50.85, 4.55], zoom:7};
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
  return [{
    level,
    headline: ALERT_LEVELS[level].title,
    description: reasons.length ? reasons.join(', ') : 'Geen opvallende signalen in de komende 24 uur.',
    source: preferredWeatherModel()==='knmi_seamless' ? 'KNMI HARMONIE model' : 'weermodel',
    official:false
  }];
}

async function fetchKnmiWarnings(){
  if(!isNetherlandsLocation()) return null;
  const r = await fetch(WHEATERFLOW_API_BASE + '/knmi/warnings', {cache:'no-store'});
  if(!r.ok) throw new Error('KNMI waarschuwingen niet beschikbaar');
  const data = await r.json();
  return Array.isArray(data.alerts) ? data.alerts : null;
}

async function loadAlerts(){
  try{
    const official = await fetchKnmiWarnings();
    if(official && official.length){
      state.alerts = official;
      state.alertsMeta = {source:'KNMI Data Platform', official:true, updated:Date.now()};
      return;
    }
  }catch(e){
    // Valt hieronder terug op indicatieve code; bijvoorbeeld bij ontbrekende/ongeldige key of CORS.
  }
  state.alerts = buildIndicativeAlert();
  state.alertsMeta = {
    source: state.alerts[0]?.source || 'Indicatieve weercode',
    official:false,
    updated:Date.now()
  };
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
    case 'drizzle': return `<svg class="${c}" width="${s}" height="${s}" viewBox="0 0 24 24" ${stroke}><path d="M6.5 13h11a3.8 3.8 0 000-7.6 5.5 5.5 0 00-10.6-1.7A4 4 0 006.5 13z" style="color:#9fb0d1"/><path d="M9 17l-1 2.5M13 17l-1 2.5M17 17l-1 2.5" style="color:#35d0c4"/></svg>`;
    case 'rain': return `<svg class="${c}" width="${s}" height="${s}" viewBox="0 0 24 24" ${stroke}><path d="M6.5 12h11a3.8 3.8 0 000-7.6 5.5 5.5 0 00-10.6-1.7A4 4 0 006.5 12z" style="color:#9fb0d1"/><path d="M8 16l-1.5 4M13 16l-1.5 4M18 16l-1.5 4" style="color:#35d0c4"/></svg>`;
    case 'snow': return `<svg class="${c}" width="${s}" height="${s}" viewBox="0 0 24 24" ${stroke}><path d="M6.5 12h11a3.8 3.8 0 000-7.6 5.5 5.5 0 00-10.6-1.7A4 4 0 006.5 12z" style="color:#9fb0d1"/><path d="M9 17v4M7 19h4M15 17v4M13 19h4" style="color:#dfe9fb"/></svg>`;
    case 'storm': return `<svg class="${c}" width="${s}" height="${s}" viewBox="0 0 24 24" ${stroke}><path d="M6.5 11h11a3.8 3.8 0 000-7.6 5.5 5.5 0 00-10.6-1.7A4 4 0 006.5 11z" style="color:#9fb0d1"/><path d="M13 12l-3.5 5h3L11 21l4.5-6h-3z" fill="#f5a524" stroke="#f5a524"/></svg>`;
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
function getBrowserLocation(){
  return new Promise((resolve)=>{
    if(!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      pos => resolve({lat:pos.coords.latitude, lon:pos.coords.longitude, accuracy:pos.coords.accuracy}),
      () => resolve(null),
      {timeout:6000, maximumAge:600000}
    );
  });
}

async function reverseGeocode(lat, lon){
  try{
    const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=nl`);
    const d = await r.json();
   const name = d.city || d.locality || d.principalSubdivision || 'Onbekende locatie';
   const admin = d.principalSubdivision || '';
   const country = d.countryName || '';
return {name, admin, country};
}catch(e){ return {name:'Huidige locatie', admin:'', country:''}; }
}

/* ---------------- geocoding search ---------------- */
let searchTimer = null;
$('#searchInput').addEventListener('input', (e)=>{
  const q = e.target.value.trim();
  $('#clearSearch').style.display = q ? 'block' : 'none';
  clearTimeout(searchTimer);
  if(q.length < 2){ showLocationSuggestion(); return; }
  searchTimer = setTimeout(()=>doSearch(q), 300);
});
$('#searchInput').addEventListener('focus', ()=>{
  if(!$('#searchInput').value.trim()) showLocationSuggestion();
});
$('#clearSearch').addEventListener('click', ()=>{
  $('#searchInput').value=''; $('#clearSearch').style.display='none'; showLocationSuggestion();
});

function locationSuggestionHtml(){
  return `<div class="sugg-item sugg-location" data-use-current-location="true">
    <span class="sugg-location-icon">${icon('gauge',true,18)}</span>
    <span class="sugg-main"><span class="sugg-name">Gebruik mijn locatie</span><span class="sugg-sub">Laat Wheaterflow je huidige positie bepalen</span></span>
  </div>`;
}

function showLocationSuggestion(){
  const box = $('#suggestions');
  if(!box) return;
  box.innerHTML = locationSuggestionHtml();
  box.classList.add('show');
  wireCurrentLocationSuggestion(box);
}

function wireCurrentLocationSuggestion(box=$('#suggestions')){
  $('[data-use-current-location]', box)?.addEventListener('click', useCurrentBrowserLocation);
}

async function useCurrentBrowserLocation(){
  const box = $('#suggestions');
  if(box){
    box.innerHTML = `<div class="sugg-empty">Je locatie wordt opgehaald...</div>`;
    box.classList.add('show');
  }
  const p = await getBrowserLocation();
  if(!p){
    if(box) box.innerHTML = `<div class="sugg-empty">Locatie kon niet worden opgehaald. Controleer je toestemming voor locatie.</div>`;
    return;
  }
  const g = await reverseGeocode(p.lat, p.lon);
  await setLocation(p.lat, p.lon, g.name, g.admin);
  if(box) box.classList.remove('show');
  $('#searchInput').value='';
  $('#clearSearch').style.display='none';
}

async function doSearch(q){
  const box = $('#suggestions');
  try{
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=nl&format=json`);
    const d = await r.json();
    const results = d.results || [];
    if(!results.length){
      box.innerHTML = `<div class="sugg-empty">Geen plaatsen gevonden voor "${q}"</div>`;
      box.classList.add('show'); return;
    }
    box.innerHTML = locationSuggestionHtml() + results.map((res,i)=>`
      <div class="sugg-item" data-i="${i}">
        <span class="sugg-name">${res.name}</span>
        <span class="sugg-sub">${[res.admin1, res.country].filter(Boolean).join(', ')}</span>
      </div>`).join('');
    box.classList.add('show');
    wireCurrentLocationSuggestion(box);
    $$('.sugg-item', box).forEach(el=>{
      el.addEventListener('click', ()=>{
        const res = results[+el.dataset.i];
        setLocation(res.latitude, res.longitude, res.name, [res.admin1,res.country].filter(Boolean).join(', '));
        box.classList.remove('show');
        $('#searchInput').value=''; $('#clearSearch').style.display='none';
      });
    });
  }catch(e){
    box.innerHTML = `<div class="sugg-empty">Zoeken mislukt - controleer je verbinding.</div>`;
    box.classList.add('show');
  }
}
document.addEventListener('click', (e)=>{
  if(!e.target.closest('.searchwrap')) $('#suggestions').classList.remove('show');
});

async function setLocation(lat, lon, name, admin){
  state.loc = {lat, lon, name, admin};
  await loadWeather();
  if(state.map){ const rv = radarView(); state.map.setView(rv.center, rv.zoom); placeMarker(lat,lon,name); }
  refreshRadarSource();
  updateStormTab();
  toast(`${name} geladen`);
}

/* ---------------- weather fetch ---------------- */
function buildForecastUrl(model){
  const {lat, lon} = state.loc;
  return `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`+
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m`+
    `&minutely_15=precipitation,weather_code,temperature_2m,wind_speed_10m,wind_gusts_10m`+
    `&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,visibility,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,cape,lifted_index,freezing_level_height,relative_humidity_2m,dew_point_2m,uv_index`+
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
      loadAlerts()
    ]);
    optionalResults.forEach((result, index)=>{
      if(result.status === 'rejected'){
        console.warn(['METAR','Marine','Luchtkwaliteit','Meldingen'][index] + ' laden faalde:', result.reason);
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
  if(secs < 45) txt = 'Bijgewerkt zojuist';
  else if(secs < 90) txt = 'Bijgewerkt 1 minuut geleden';
  else if(secs < 3600) txt = `Bijgewerkt ${Math.round(secs/60)} minuten geleden`;
  else txt = `Bijgewerkt ${Math.round(secs/3600)} uur geleden`;
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
  document.addEventListener('visibilitychange', ()=>{
    if(!document.hidden && state.lastUpdated && Date.now()-state.lastUpdated > 60*1000){
      loadWeather();
    }
  });
}

function nowIndexInHourly(){
  if(!state.hourly) return 0;
  return closestIndex(state.hourly.time, Date.now());
}

function nowcastText(){
  if(!state.minutely || !state.minutely.time || !state.minutely.time.length) return null;
  let idx = closestIndex(state.minutely.time, Date.now());
  const slots = state.minutely.precipitation.slice(idx, idx+8); // komende ~2 uur, per 15 min
  const rainingNow = (slots[0]||0) >= 0.1;
  const firstRainIdx = slots.findIndex(v=>v>=0.1);
  const firstDryIdx = slots.findIndex(v=>v<0.1);
  if(rainingNow){
    if(firstDryIdx > 0){
      const t = new Date(state.minutely.time[idx+firstDryIdx]+':00');
      return `Neerslag stopt rond ${t.getHours()}:${String(t.getMinutes()).padStart(2,'0')}`;
    }
    return 'Neerslag houdt aan de komende 2 uur';
  } else if(firstRainIdx > 0){
    const t = new Date(state.minutely.time[idx+firstRainIdx]+':00');
    return `Neerslag verwacht rond ${t.getHours()}:${String(t.getMinutes()).padStart(2,'0')}`;
  }
  return 'Geen neerslag verwacht de komende 2 uur';
}

function rainNowcastCard(){
  if(!state.minutely?.time?.length) return '';
  const idx = closestIndex(state.minutely.time, Date.now());
  const slots = state.minutely.precipitation.slice(idx, idx + 12).map(v=>Number(v) || 0);
  const rainingNow = (slots[0] || 0) >= 0.1;
  const firstDryIdx = slots.findIndex(v=>v < 0.1);
  const firstRainIdx = slots.findIndex(v=>v >= 0.1);
  const title = rainingNow ? 'Het stopt met regenen' : firstRainIdx > 0 ? 'Regen op komst' : 'Geen regen verwacht';
  const body = rainingNow && firstDryIdx > 0
    ? `Lichte regen houdt naar verwachting over ${firstDryIdx * 15} min. op.`
    : rainingNow
      ? 'Neerslag houdt waarschijnlijk nog minstens 2 uur aan.'
      : firstRainIdx > 0
        ? `Neerslag wordt verwacht over ${firstRainIdx * 15} min.`
        : 'De komende 2 uur blijft het waarschijnlijk droog.';
  const maxRain = Math.max(.4, ...slots);
  const bars = slots.map((v,i)=>`<i class="${i===0?'now':''}" style="height:${Math.max(4, Math.round((v / maxRain) * 34))}px"></i>`).join('');
  return `<div class="card rain-now-card">
    <h3>${title}</h3>
    <p>${body}</p>
    <div class="rain-now-chart">${bars}</div>
    <div class="rain-now-axis"><span>Nu</span><span>30 min</span><span>60 min</span><span>90 min</span><span>2 u</span></div>
  </div>`;
}

/* ---------------- real photo background: matches current conditions ---------------- */
let lightningTimer = null;
function applyWeatherBG(code, isDay, cloudCover=0){
  const el = $('#weatherBG');
  if(!el) return;

  clearInterval(lightningTimer);
  lightningTimer = null;

  const cc = Math.max(0, Math.min(100, Number(cloudCover) || 0));
  let filename = DEFAULT_WEATHER_PHOTO;
  let scene = 'sunny';

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

  const safe = encodeURI(`./assets/backgrounds/${filename}`);
  const photoValue = `url("${safe}")`;
  el.style.backgroundImage = photoValue;
  el.style.setProperty('--weather-photo', photoValue);
  document.documentElement.style.setProperty('--weather-photo', photoValue);
  document.body?.style?.setProperty('--weather-photo', photoValue);
  $('#tvscreen')?.style?.setProperty('--weather-photo', photoValue);

  const scenes = ['sunny','cloudy','rainy','stormy','snowy'];
  scenes.forEach(s=>el.classList.toggle(s, s===scene));
  el.classList.toggle('night', !isDay);
  el.classList.toggle('cloud-cover-heavy', cc >= 86);
  el.classList.toggle('cloud-cover-light', scene === 'cloudy' && cc < 66);
  el.classList.add('photo-weather-bg');
}

function renderHome(){
  const cur = liveWeatherSnapshot(), hourly = state.hourly, daily = state.daily;
  const wc = wcInfo(cur.weather_code);
  const isDay = cur.is_day === 1;
  const nowIdx = nowIndexInHourly();
  const todayMax = daily.temperature_2m_max[0], todayMin = daily.temperature_2m_min[0];
  const currentSource = state.observation ? `${state.observation.source} - ${Math.round(state.observation.distanceKm)} km` : 'KNMI HARMONIE';

  applyWeatherBG(cur.weather_code, isDay, cur.cloud_cover);

  let html = '';
  html += `<div class="hero">
    <div class="hero-kicker">MIJN LOCATIE</div>
    <div class="locname">${state.loc.name}</div>
    <div class="bignum display">${fmtTemp(cur.temperature_2m)}</div>
    <div class="cond">${wc.l}</div>
    <div class="hilo">Max: <b>${fmtTemp(todayMax)}</b>&nbsp;&nbsp;Min: <b>${fmtTemp(todayMin)}</b></div>
    <div class="updated"><span id="updatedText">Bijgewerkt zojuist</span> - ${state.loc.admin||''} - ${currentSource}</div>
  </div>`;

  html += alertsCard();
  html += rainNowcastCard();
  html += compactAirQualityCard();

  // hourly
  html += `<div class="card"><div class="card-title">${icon('gauge',true,13)} Komende 24 uur</div><div class="hourly-scroll">`;
  for(let i=nowIdx; i<Math.min(nowIdx+24, hourly.time.length); i++){
    const t = new Date(hourly.time[i]);
    const label = i===nowIdx ? 'Nu' : t.getHours()+':00';
    const hwc = wcInfo(hourly.weather_code[i]);
    const hIsDay = isDayForTime(hourly.time[i]);
    html += `<div class="hour-item ${i===nowIdx?'now':''}">
      <div class="t">${label}</div>
      ${icon(hwc.ic, hIsDay, 26)}
      <div class="pop">${hourly.precipitation_probability[i]>10 ? hourly.precipitation_probability[i]+'%':''}</div>
      <div class="v">${fmtTemp(hourly.temperature_2m[i])}</div>
    </div>`;
  }
  html += `</div></div>`;

  // daily
  const nDays = state.units.days;
  const allMax = daily.temperature_2m_max.slice(0,nDays), allMin = daily.temperature_2m_min.slice(0,nDays);
  const gMax = Math.max(...allMax), gMin = Math.min(...allMin);
  html += `<div class="card"><div class="card-title">${icon('sunrise',true,13)} ${nDays}-daagse verwachting</div>`;
  for(let i=0;i<nDays;i++){
    const dwc = wcInfo(daily.weather_code[i]);
    const d = new Date(daily.time[i]);
    const dayName = i===0?'Vandaag': d.toLocaleDateString('nl-BE',{weekday:'short'});
    const lo = daily.temperature_2m_min[i], hi = daily.temperature_2m_max[i];
    const left = ((lo-gMin)/(gMax-gMin||1))*100;
    const width = ((hi-lo)/(gMax-gMin||1))*100;
    html += `<div class="daily-row">
      <div class="dname ${i===0?'today':''}">${dayName}</div>
      ${icon(dwc.ic,true,22,'dicon')}
      <div class="dpop">${daily.precipitation_probability_max[i]>10?daily.precipitation_probability_max[i]+'%':''}</div>
      <div class="dlow">${fmtTemp(lo)}</div>
      <div class="bar-track"><div class="bar-fill" style="left:${left}%;width:${Math.max(width,6)}%;"></div></div>
      <div class="dhigh">${fmtTemp(hi)}</div>
    </div>`;
  }
  html += `</div>`;

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
  html += detailCard('cloud','Bewolking', cur.cloud_cover+'%', cur.cloud_cover<30?'Overwegend helder':cur.cloud_cover<70?'Half bewolkt':'Bewolkt');
  html += moonCard(moon);
  html += seaSparkDetailCard();
  html += `</div>`;
  html += appSections();

  $('#homeInner').innerHTML = html;
  wireSectionNav();
  wireHomeMapLayers();
  wireDailyDetails();
  renderPremiumCharts();
  positionSunPaths();
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
      ${['Overzicht','Kaarten','Grafieken','14 dagen','Zon en maan','Luchtkwaliteit','Kust','Reisweer','Instellingen'].map((n,i)=>`<a href="#sec${i}">${n}</a>`).join('')}
    </nav>
    <section id="sec0" class="app-section">${smartBriefingCard()}</section>
    <section id="sec1" class="app-section">${mapLayerSection()}</section>
    <section id="sec2" class="app-section">${chartsSection()}</section>
    <section id="sec3" class="app-section">${fourteenDaySection()}</section>
    <section id="sec4" class="app-section">${sunMoonSection()}</section>
    <section id="sec5" class="app-section">${airQualitySection()}</section>
    <section id="sec6" class="app-section">${coastSection()}</section>
    <section id="sec7" class="app-section">${travelWeatherSection()}</section>
  `;
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
  if(state.minutely?.precipitation){
    const mi = closestIndex(state.minutely.time, Date.now());
    const rain = state.minutely.precipitation.slice(mi, mi+8).findIndex(v=>(v||0)>=0.1);
    if(rain > 0) msgs.push(`Over ongeveer ${rain*15} minuten bereikt neerslag jouw locatie.`);
  }
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
    </div>
    <div class="legend-row"><span>Legenda</span><i></i><span id="mapLayerTime">Actuele modeltijd</span></div>
  </div>`;
}

function wireHomeMapLayers(){
  const mapEl = $('#homeWeatherMap');
  if(!mapEl || !window.L) return;
  $$('.map-tabs [data-home-layer]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      $$('.map-tabs [data-home-layer]').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      setHomeMapLayer(btn.dataset.homeLayer);
    });
  });
  setTimeout(()=>{
    initHomeWeatherMap();
    setHomeMapLayer(state.homeMap.activeLayer || 'radar');
  }, 80);
}

function initHomeWeatherMap(){
  if(state.homeMap.map || !$('#homeWeatherMap') || !window.L) return;
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
    maxZoom:10
  }).setView(rv.center, Math.min(8, rv.zoom));
  state.homeMap.map = map;
  state.homeMap.base = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    subdomains:'abcd',
    maxZoom:19
  }).addTo(map);
  L.circleMarker([state.loc.lat,state.loc.lon], {radius:6,color:'#fff',weight:2,fillColor:'#1677ff',fillOpacity:.9}).addTo(map);
  setTimeout(()=>map.invalidateSize(), 120);
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
      const ok = await setHomeXweatherLayer('radar');
      if(!ok) throw new Error('Xweather radar niet geconfigureerd');
    }else if(layerId === 'satellite'){
      await setHomeLegacyLayer(layerId);
    }else{
      const ok = await setHomeXweatherLayer(layerId);
      if(!ok) throw new Error('Xweather laag niet beschikbaar');
    }
    setHomeMapStatus('');
    $('#mapLayerTime').textContent = new Date().toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit'});
  }catch(err){
    console.error('Home weather map layer failed', {layerId, err});
    setHomeMapStatus(homeMapLayerError(layerId));
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
    state.homeMap.overlay = L.tileLayer(weatherflowRadarTileUrl(0), {
      opacity:.86,
      maxZoom:10,
      maxNativeZoom:10,
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

function setHomeMapStatus(text){
  const el = $('#homeMapStatus');
  if(!el) return;
  el.textContent = text || '';
  el.classList.toggle('hidden', !text);
}

function homeMapLayerError(layerId){
  if(['cloud-cover','temperatures','wind-speeds','lightning-strikes-icons','wave-heights','snow'].includes(layerId)){
    return 'Deze Xweather-kaartlaag is niet beschikbaar met de huidige sleutel of verbinding.';
  }
  return 'Kaartlaag kon niet worden geladen.';
}

function chartsSection(){
  const idx = nowIndexInHourly();
  const points = Array.from({length:24},(_,n)=>idx+n).filter(i=>i<state.hourly.time.length);
  const stat = (label, vals, unit='') => {
    const clean = vals.filter(v=>v!=null && isFinite(v));
    if(!clean.length) return `<span>${label}<b>-</b></span>`;
    const min = Math.min(...clean), max = Math.max(...clean);
    return `<span>${label}<b>${Math.round(min)}-${Math.round(max)}${unit}</b></span>`;
  };
  return `<div class="card premium-chart-card"><div class="card-title">${icon('gauge',true,13)} Grafieken komende 24 uur</div>
    <div class="premium-chart-summary">
      ${stat('Temperatuur', points.map(i=>state.hourly.temperature_2m[i]), '&deg;')}
      ${stat('Neerslagkans', points.map(i=>state.hourly.precipitation_probability[i]), '%')}
      ${stat('Wind', points.map(i=>state.hourly.wind_speed_10m[i]), ' km/u')}
    </div>
    <div class="chart-grid premium-charts">
      ${premiumChartShell('temp','Temperatuur','Gevoelstemperatuur en luchttemperatuur','&deg;C')}
      ${premiumChartShell('rain','Neerslag','Kans en hoeveelheid per uur','% / mm')}
      ${premiumChartShell('uv','UV-index','Sterkte van de zon doorheen de dag','UV')}
      ${premiumChartShell('wind','Wind','Windsnelheid en windstoten','km/u')}
    </div>
  </div>`;
}

function premiumChartShell(id, title, sub, unit){
  return `<div class="mini-chart apple-chart-card" data-chart="${id}">
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
  const n = Math.min(14, state.daily.time.length);
  return `<div class="card"><div class="card-title">${icon('sunrise',true,13)} 14-daagse verwachting</div>
    <div class="days14">${Array.from({length:n},(_,i)=>day14Card(i)).join('')}</div>
  </div>`;
}

function day14Card(i){
  const d = new Date(state.daily.time[i]);
  const wc = wcInfo(state.daily.weather_code[i]);
  return `<button class="day14" data-day="${i}" type="button">
    <div class="forecast-card-top">
      <span class="forecast-day">${i===0?'Vandaag':d.toLocaleDateString('nl-BE',{weekday:'short'})}</span>
      <span class="forecast-icon">${icon(wc.ic,true,24)}</span>
    </div>
    <div class="forecast-temperatures">
      <strong class="forecast-max">${fmtTemp(state.daily.temperature_2m_max[i])}</strong>
      <span class="forecast-min">${fmtTemp(state.daily.temperature_2m_min[i])}</span>
    </div>
    <div class="forecast-meta">
      <span>${state.daily.precipitation_probability_max[i]??0}% regen</span>
      <span>${fmtWind(state.daily.wind_gusts_10m_max[i])}</span>
    </div>
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
      ${dayMetric('wind','Wind', windAvg == null ? '-' : fmtWind(windAvg), `Stoten ${fmtWind(daily.wind_gusts_10m_max[i])}`)}
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
          ${astroMetric('Gouden uur', `${morningGold} &middot; ${eveningGold}`)}
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
  </div>`;
}

function astroMetric(label, value){
  return `<div class="sun-metric"><span class="metric-label">${label}</span><strong class="metric-value">${value || '-'}</strong></div>`;
}

function airQualitySection(){
  const a = state.air;
  const rows = [
    ['AQI', a?.european_aqi, 100], ['PM2.5', a?.pm2_5, 50], ['PM10', a?.pm10, 100], ['NO2', a?.nitrogen_dioxide, 100], ['O3', a?.ozone, 180], ['CO', a?.carbon_monoxide, 1000]
  ];
  const pollen = Math.max(a?.alder_pollen??0,a?.birch_pollen??0,a?.grass_pollen??0,a?.mugwort_pollen??0,a?.olive_pollen??0,a?.ragweed_pollen??0);
  const aqi = a?.european_aqi;
  const aqStatus = aqi == null ? 'Onbekend' : aqi < 40 ? 'Goed' : aqi < 80 ? 'Matig' : 'Slecht';
  return `<div class="card"><div class="card-title">${icon('cloud',true,13)} Luchtkwaliteit</div>
    <div class="aq-hero">
      <div class="aq-ring" style="--aq:${Math.min(100, aqi ?? 0)}"><b>${aqi == null ? '-' : Math.round(aqi)}</b><span>AQI</span></div>
      <div><strong>${aqStatus}</strong><p>${a ? airSummary(a.european_aqi, pollen) : 'Luchtkwaliteitsdata is momenteel niet beschikbaar.'}</p></div>
    </div>
    <div class="aq-grid">${rows.map(([n,v,max])=>aqRow(n,v,max)).join('')}${aqRow('Pollen', pollen || null, 100)}</div>
  </div>`;
}

function aqRow(name, value, max){
  if(value==null) return `<div class="aq-row"><span>${name}</span><b>Niet beschikbaar</b></div>`;
  const pct = Math.min(100, (value/max)*100);
  return `<div class="aq-row"><span>${name}</span><b>${Math.round(value)}</b><i><em style="width:${pct}%"></em></i></div>`;
}
function airSummary(aqi, pollen){
  if(aqi == null) return 'Algemene luchtkwaliteitsindex niet beschikbaar.';
  const status = aqi < 40 ? 'goed' : aqi < 80 ? 'matig' : 'slecht';
  return `De luchtkwaliteit is ${status}.${pollen>50?' De pollenconcentratie is verhoogd.':' Buitenactiviteiten zijn normaal mogelijk.'}`;
}

function coastSection(){
  if(!state.marine) return `<div class="card"><div class="card-title">${icon('drop',true,13)} Kustmodus</div><div class="subtle">Geen kustdata voor deze locatie.</div></div>`;
  const m = state.marine, tide = m.tide;
  return `<div class="card"><div class="card-title">${icon('drop',true,13)} Kustmodus ${esc(m.place)}</div>
    <div class="coast-grid premium-coast-grid">
      <div><b>${m.waveHeight?.toFixed(1) ?? '-'} m</b><span>Golfhoogte</span></div><div><b>${m.wavePeriod?.toFixed(1) ?? '-'} s</b><span>Golfperiode</span></div>
      <div><b>${Math.round(m.waveDirection ?? 0)}&deg;</b><span>Golfrichting</span></div><div><b>${tide.state}</b><span>Getij</span></div>
      <div><b>${tide.nextTime.toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit'})}</b><span>Volgende ${tide.nextType}</span></div><div><b>${m.seaSurfaceTemperature?.toFixed(1) ?? '-'} &deg;C</b><span>Zeewater</span></div>
    </div><div class="tide-line"><span></span></div>
    ${seaSparkCoastPanel()}
  </div>`;
}

function seaSparkDetailCard(){
  if(!state.seaspark) return '';
  const s = state.seaspark;
  return `<div class="detail-card wide seaspark-card">
    <div class="dt-title">${icon('drop',true,12)} Zeevonk</div>
    <div class="seaspark-main">
      <div class="seaspark-ring" style="--score:${s.score}"><b>${s.score}%</b><span>${esc(s.level)}</span></div>
      <div>
        <div class="dt-val mono">${esc(s.level)} kans</div>
        <div class="dt-sub">${seaSparkBestTimeText(s)} - ${esc(s.place)}</div>
      </div>
    </div>
  </div>`;
}

function seaSparkCoastPanel(){
  if(!state.seaspark) return '';
  const s = state.seaspark;
  return `<div class="seaspark-panel">
    <div class="seaspark-head">
      <div>
        <div class="card-title">${icon('drop',true,13)} Zeevonk-kans vanavond</div>
        <p>${seaSparkSummary(s)}</p>
      </div>
      <div class="seaspark-ring" style="--score:${s.score}"><b>${s.score}%</b><span>${esc(s.level)}</span></div>
    </div>
    <div class="seaspark-factors">
      ${s.factors.map(f=>`<span>${esc(f)}</span>`).join('')}
    </div>
    <ul class="seaspark-advice">${s.advice.map(a=>`<li>${esc(a)}</li>`).join('')}</ul>
    <div class="subtle">Indicatie, geen officiele voorspelling. Zeevonk blijft afhankelijk van lokale algenbloei, stroming en lichtvervuiling.</div>
  </div>`;
}

function seaSparkBestTimeText(s){
  if(!s?.bestTime) return 'Beste moment: na zonsondergang';
  return 'Beste moment rond ' + s.bestTime.toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit'});
}

function seaSparkSummary(s){
  const parts = [];
  if(s.seaTemp != null) parts.push(`zeewater ${s.seaTemp.toFixed(1)} &deg;C`);
  if(s.wind != null) parts.push(`wind ${Math.round(s.wind)} km/u`);
  if(s.wave != null) parts.push(`golfhoogte ${s.wave.toFixed(1)} m`);
  const basis = parts.length ? parts.join(', ') : 'beperkte kustdata';
  return `${s.level} indicatie op basis van ${basis}. ${seaSparkBestTimeText(s)}.`;
}

function travelWeatherSection(){
  return `<div class="card"><div class="card-title">${icon('wind',true,13)} Reisweer</div>
    <div class="travel-panel">
      <div class="travel-form"><input placeholder="Vertrekpunt"><input placeholder="Bestemming"><input type="datetime-local"><select><option>Auto</option><option>Fiets</option><option>Te voet</option></select><button class="smallbtn" type="button">Bereken</button></div>
      <div class="route-preview"><span></span><i></i><span></span><i></i><span></span></div>
    </div>
    <div class="subtle">Routeweer wordt berekend zodra je vertrekpunt en bestemming invult. De app verzint geen routewaarden.</div>
  </div>`;
}

function alertsCard(){
  const alert = (state.alerts && state.alerts[0]) || buildIndicativeAlert()[0];
  const level = ALERT_LEVELS[alert.level] || ALERT_LEVELS.green;
  const isGreen = alert.level === 'green';
  return `<div class="card alert-card ${level.cls}">
    <div class="alert-head">
      <div>
        <div class="card-title">${icon('gauge',true,13)} ${isGreen ? 'Weermelding' : 'Extreem weer'}</div>
        <div class="alert-code">${level.label}</div>
      </div>
    </div>
    <div class="alert-title">${isGreen ? 'Geen actieve weermelding' : esc(alert.headline)}</div>
    ${isGreen ? '' : `<div class="alert-text">${esc(alert.description)}</div>`}
  </div>`;
}

function detailCard(ic, title, val, sub){
  return `<div class="detail-card"><div class="dt-title">${icon(ic,true,12)} ${title}</div><div class="dt-val mono">${val}</div><div class="dt-sub">${sub}</div></div>`;
}
function uvLabel(uv){
  if(uv<3) return 'Laag'; if(uv<6) return 'Matig'; if(uv<8) return 'Hoog'; if(uv<11) return 'Zeer hoog'; return 'Extreem';
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
  const label = aqi <= 20 ? 'Goed' : aqi <= 40 ? 'Redelijk' : aqi <= 60 ? 'Ondermaats' : aqi <= 80 ? 'Slecht' : 'Zeer slecht';
  return `<div class="card compact-aq-card">
    <h3>${aqi} - ${label}</h3>
    <div class="aq-strip"><i style="left:${Math.min(100, Math.max(0, aqi))}%"></i></div>
    <p>Luchtkwaliteit op basis van de huidige locatie.</p>
  </div>`;
}

function moonVisual(moon){
  const offset = Math.round((1 - moon.illumination * 2) * 42);
  return `<div class="premium-moon" style="--moon-shadow:${offset}px"><span></span></div>`;
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
      <div class="moonvisual"><div class="moonshadow" style="transform:translateX(${(1-moon.illumination*2)*50}%);"></div></div>
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

/* ---------------- tabs ---------------- */
$$('.tabbtn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    if(btn.dataset.tab === 'profile'){
      $$('.tabbtn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
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
      setTimeout(()=>{
        const el = document.querySelector(target);
        if(target === '#sec0') window.scrollTo({top:0, behavior:'smooth'});
        else el?.scrollIntoView({behavior:'smooth', block:'start'});
      }, 80);
    }
    if(btn.dataset.tab === 'radarscreen'){ initMapIfNeeded(); setTimeout(()=>state.map && state.map.invalidateSize(),150); }
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
function openSheet(){ lockPageScroll(); $('#settingsSheet').classList.add('show'); $('#scrim').classList.add('show'); }
function closeSheet(){ $('#settingsSheet').classList.remove('show'); $('#scrim').classList.remove('show'); unlockPageScroll(); }
$('#closeSheet').addEventListener('click', closeSheet);
$('#openSheetBtn').addEventListener('click', openSheet);
$('#scrim').addEventListener('click', closeSheet);
$('#dayScrim')?.addEventListener('click', closeDayDetail);

let authHistoryOpen = false;
function openAuthSheet(){
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
  if($('#profileDisplayName')) $('#profileDisplayName').value = profile?.display_name || displayName;
  if($('#profileHomeLocation')) $('#profileHomeLocation').value = profile?.home_location_name || state.loc.name || '';
  if($('#profileFavoritesCount')) $('#profileFavoritesCount').textContent = state.favorites.length;
  if($('#profileNotificationsStatus')) $('#profileNotificationsStatus').textContent = state.push.status === 'Ingeschakeld' ? 'Aan' : 'Uit';
  if($('#profileSyncStatus')) $('#profileSyncStatus').textContent = loggedIn ? 'Actief' : 'Gast';
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
    list.innerHTML = '<div class="subtle" style="font-size:12px;">Nog geen favoriete plaatsen.</div>';
    return;
  }
  list.innerHTML = state.favorites.map((f,i)=>`
    <div class="profile-favorite-row" data-i="${i}">
      <b>${esc(f.name)}</b>
      <button type="button" data-act="open" title="Openen">&gt;</button>
      <button type="button" data-act="up" title="Omhoog">^</button>
      <button type="button" data-act="delete" title="Verwijderen">x</button>
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
    await setLocation(fav.lat, fav.lon, fav.name, fav.admin);
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

/* ---------------- Mijn Klimaat ---------------- */
function initClimateUi(){
  $('#climateBtn')?.addEventListener('click', openClimateScreen);
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
    memories.push(`<div class="climate-row"><img class="climate-memory-photo" src="${esc(p.photo_url)}" alt=""><div><b>Een jaar geleden deelde je deze weerfoto</b><span>${esc(p.location_name || '')} - ${esc(communityCategory(p.category).label)}</span></div></div>`);
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
  {id:'sunset', label:'Zonsondergang', color:'#ff9a45'},
  {id:'sunrise', label:'Zonsopkomst', color:'#ffd36b'},
  {id:'clouds', label:'Bijzondere wolken', color:'#9fb5d4'},
  {id:'storm', label:'Storm', color:'#ef4b5f'},
  {id:'hail', label:'Hagel', color:'#dbe7ff'},
  {id:'other', label:'Overig', color:'#8fe7ff'}
];
const communityCategory = id => COMMUNITY_CATEGORIES.find(c=>c.id===id) || COMMUNITY_CATEGORIES[COMMUNITY_CATEGORIES.length - 1];
const safeRandomId = () => (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

function initCommunityUi(){
  const catOptions = COMMUNITY_CATEGORIES.map(c=>`<option value="${c.id}">${c.label}</option>`).join('');
  if($('#communityCategorySelect')) $('#communityCategorySelect').innerHTML = catOptions;
  if($('#communityCategoryFilter')) $('#communityCategoryFilter').innerHTML = '<option value="">Alle categorieen</option>' + catOptions;
  $('#communityUploadOpen')?.addEventListener('click', openCommunityComposer);
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
    const posts = data.posts || [];
    state.community.posts = reset ? posts : [...state.community.posts, ...posts];
    state.community.hasMore = Boolean(data.hasMore);
    state.community.page += 1;
    renderCommunityFeed(); renderCommunityLiveStats();
    if(state.community.view === 'map') renderCommunityMapMarkers();
  }catch(e){ console.error('Community feed load failed', e); renderCommunityEmpty('Community kon niet worden geladen.'); }
  finally{ state.community.loading=false; }
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

function renderCommunityFeed(){
  const feed = $('#communityFeed');
  if(!feed) return;
  if(!state.community.posts.length){
    feed.innerHTML = '<div class="community-empty">Nog geen communityposts. Deel de eerste weerfoto vanuit jouw buurt.</div>';
  }else{
    feed.innerHTML = state.community.posts.map(communityPostHtml).join('');
  }
  $('#communityLoadMore')?.classList.toggle('hidden', !state.community.hasMore);
}

function communityPostHtml(post){
  const cat = communityCategory(post.category);
  const profile = post.profiles || {};
  const name = profile.display_name || 'Wheaterflow gebruiker';
  const avatar = profile.avatar_url ? `<img src="${esc(profile.avatar_url)}" alt="">` : esc(userInitials(name));
  const liked = post.community_likes?.some(l=>l.user_id === state.auth.user?.id);
  const saved = post.community_favorites?.some(f=>f.user_id === state.auth.user?.id);
  const comments = (post.community_comments || []).slice(0,3);
  return `<article class="community-post" data-post-id="${post.id}">
    <div class="community-post-head">
      <div class="community-avatar">${avatar}</div>
      <div>
        <div class="community-post-name">${esc(name)}</div>
        <div class="community-post-place">${esc(post.location_name || 'Locatie verborgen')} - ${timeAgo(post.created_at)}</div>
      </div>
      <div class="community-category" style="box-shadow:inset 0 -2px 0 ${cat.color};">${esc(cat.label)}</div>
    </div>
    <img class="community-photo" src="${esc(post.photo_url)}" alt="${esc(post.caption || cat.label)}" loading="lazy">
    <div class="community-body">
      ${post.caption ? `<p class="community-caption">${linkHashtags(esc(post.caption))}</p>` : ''}
      <div class="community-weather-line">
        <span>${fmtTemp(post.temperature)}</span>
        <span>Voelt ${fmtTemp(post.apparent_temperature)}</span>
        <span>Wind ${fmtWind(post.wind_speed)}</span>
        <span>${fmtPrecip(post.precipitation || 0)}</span>
        <span>${post.humidity ?? '-'}% vocht</span>
      </div>
    </div>
    <div class="community-actions">
      <button class="${liked?'active':''}" data-act="like">${liked?'Geliked':'Like'} ${post.like_count || 0}</button>
      <button data-act="comment">Reacties ${post.comment_count || 0}</button>
      <button data-act="share">Delen</button>
      <button class="${saved?'active':''}" data-act="save">${saved?'Bewaard':'Opslaan'}</button>
      <button data-act="report">Rapport</button>
    </div>
    <div class="community-comments">
      ${comments.map(c=>`<div class="subtle"><b>${esc(c.profiles?.display_name || 'Gebruiker')}</b> ${esc(c.body)}</div>`).join('')}
      <form class="community-comment-row">
        <input name="body" maxlength="240" placeholder="Reageer..." autocomplete="off">
        <button type="submit">Plaats</button>
      </form>
    </div>
  </article>`;
}

function linkHashtags(text){
  return text.replace(/(^|\s)(#[a-zA-Z0-9_]+)/g, (m, space, tag)=>`${space}<button class="linkbtn community-hashtag" data-tag="${esc(tag.slice(1).toLowerCase())}" type="button">${esc(tag)}</button>`);
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
  if(act === 'comment') postEl.querySelector('input[name=body]')?.focus();
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
  if(!file) return setCommunityComposerMessage('Kies eerst een foto.', 'error');
  try{
    setCommunityComposerMessage('Foto voorbereiden...');
    const blob = await compressAvatar(file);
    const gps = $('#communityUseGps')?.checked ? await getBrowserLocation() : null;
    const privacy = $('#communityLocationPrivacy')?.value || 'municipality';
    const loc = gps ? {lat:gps.lat, lon:gps.lon, ...(await reverseGeocode(gps.lat,gps.lon))} : {lat:state.loc.lat, lon:state.loc.lon, name:state.loc.name, admin:state.loc.admin};
    const cur = liveWeatherSnapshot();
    const caption = $('#communityCaption')?.value.trim() || '';
    const form = new FormData();
    form.append('photo', blob, 'weather.webp');
    form.append('caption', caption);
    form.append('category', $('#communityCategorySelect')?.value || 'other');
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
    await apiForm('/community/posts', form);
    setCommunityComposerMessage('Geplaatst.', 'ok');
    $('#communityCaption').value=''; $('#communityPhotoInput').value=''; $('#communityPhotoPreview')?.classList.add('hidden');
    state.community.selectedFile=null; closeCommunityComposer(); await loadCommunityPosts(true); toast('Weerfoto gedeeld.');
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
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {subdomains:'abcd', maxZoom:19, attribution:'&copy; OpenStreetMap, &copy; CARTO'}).addTo(state.community.map);
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
    marker.bindPopup(`<b>${esc(cat.label)}</b><br>${esc(post.location_name || '')}<br>${post.photo_url ? `<img src="${esc(post.photo_url)}" style="width:150px;border-radius:10px;margin-top:6px;">` : ''}`);
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
        state.units.model = 'knmi_seamless';
        $$('#segModel button').forEach(x=>x.classList.toggle('active', x.dataset.v==='knmi_seamless'));
        saveUnits();
        loadWeather();
        toast('KNMI HARMONIE actief');
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
  $('#pushInstallCard')?.classList.toggle('show', status === 'Installeer eerst de app');
  const enabled = status === 'Ingeschakeld';
  if($('#enablePushBtn')) $('#enablePushBtn').disabled = enabled || status === 'Niet ondersteund' || status === 'Geblokkeerd';
  if($('#testPushBtn')) $('#testPushBtn').disabled = !enabled;
  if($('#disablePushBtn')) $('#disablePushBtn').disabled = !enabled;
}

function wirePushSettings(){
  loadPushSettings();
  $$('#pushPrefs input[type=checkbox]').forEach(input=>{
    input.checked = state.push.preferences[input.dataset.pref] !== false;
    input.addEventListener('change', ()=>{
      state.push.preferences[input.dataset.pref] = input.checked;
      savePushSettings();
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

function initMapIfNeeded(){
  if(state.map) return;
  state.map = L.map('map', {
    zoomControl:false,
    attributionControl:true,
    zoomSnap:.25,
    zoomDelta:.5,
    wheelPxPerZoomLevel:90,
    minZoom:6,
    maxZoom:10
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
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', {
    subdomains:'abcd', maxZoom:19,
    attribution:'&copy; OpenStreetMap, &copy; CARTO'
  }).addTo(state.map);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png', {
    subdomains:'abcd', maxZoom:19, pane:'labelPane'
  }).addTo(state.map);

  placeMarker(state.loc.lat, state.loc.lon, state.loc.name);

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
        setLocation(lat,lng,g.name,g.admin);
        placeMarker(lat,lng,g.name);
      });
    }catch(err){ showRadarInfo('Kon puntgegevens niet laden.', lat,lng); }
  });

  initXweatherMap().then(ok=>{
    if(ok) return;
    startLegacyRadar();
  });
  clearInterval(state.radar.refreshTimer);
  state.radar.refreshTimer = setInterval(()=>{
    if(document.hidden) return;
    if(state.xweather.ready && state.xweather.controller){
      try{
        state.xweather.controller.setRefreshInterval?.(5, true);
        state.xweather.controller.refresh?.();
        updateXweatherTimelineUi();
      }catch(error){
        console.warn('Xweather radar verversen faalde:', error);
      }
      return;
    }
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
  $('#timeLabel').textContent = 'Geen radar';
  $('#radarNowBadge')?.classList.remove('show');
  const note = $('.radar-note');
  if(note) note.textContent = 'Xweather radar is niet geconfigureerd of tijdelijk niet beschikbaar. De basiskaart blijft werken.';
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
    const saved = localStorage.getItem('weerscoop:xweatherLayer');
    const first = findAvailableXweatherLayer(saved) || findAvailableXweatherLayer('radar') || availableXweatherLayers()[0];
    if(!first) throw new Error('Geen Xweather-lagen beschikbaar voor dit abonnement');
    await setXweatherLayer(first.id);
    updateXweatherTimelineUi();
    clearInterval(state.xweather.timelineUiTimer);
    state.xweather.timelineUiTimer = setInterval(updateXweatherTimelineUi, 1000);
    document.addEventListener('visibilitychange', handleXweatherVisibility, {passive:true});
    setTimeout(()=>state.xweather.controller?.resize(), 120);
    return true;
  }catch(err){
    console.warn('Xweather MapsGL kon niet starten', err);
    setXweatherStatus('De weerkaart kon niet worden geladen. De bestaande radar blijft actief.');
    toast('De weerkaart kon niet worden geladen.');
    teardownXweather(false);
    return false;
  }finally{
    state.xweather.loading = false;
  }
}

async function fetchXweatherConfig(){
  const r = await fetch(FUNCTION_BASE + 'xweather-config', {cache:'no-store'});
  if(!r.ok) return {configured:false};
  return r.json();
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

function setupXweatherUi(){
  renderXweatherLayerSelector();
  $('#xweatherRetry')?.addEventListener('click', ()=>initXweatherMap(true));
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
    return;
  }
  const previousLayer = state.xweather.activeLayer;
  state.xweather.activeLayer = def;
  localStorage.setItem('weerscoop:xweatherLayer', def.id);
  const ok = await refreshXweatherLayers();
  if(!ok){
    setXweatherStatus(`${def.label} is niet beschikbaar met deze Xweather-sleutel of dit abonnement. Kies een andere kaartlaag.`);
    if(def.id !== 'radar'){
      const fallback = findAvailableXweatherLayer('radar');
      if(fallback){
        state.xweather.activeLayer = fallback;
        localStorage.setItem('weerscoop:xweatherLayer', fallback.id);
        await refreshXweatherLayers();
      }else{
        state.xweather.activeLayer = previousLayer || null;
      }
    }
    renderXweatherLayerSelector();
    updateXweatherLegend();
    return;
  }
  $$('.xweather-layer-btn').forEach(btn=>btn.classList.toggle('active', btn.dataset.xweatherLayer === def.id));
  $('#chipPrecip')?.classList.toggle('active', def.id === 'radar');
  $('#chipSat')?.classList.toggle('active', def.id === 'satellite');
  if($('#xweatherLayerTitle')) $('#xweatherLayerTitle').textContent = def.label;
  if($('#xweatherWindSettings')) $('#xweatherWindSettings').open = def.id === 'wind-particles';
  updateXweatherLegend();
  updateXweatherTimelineUi();
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
  setLocation(p.lat,p.lon,g.name,g.admin);
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
        maxZoom:10,
        maxNativeZoom:10,
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
  if(note) note.textContent = 'Officiele KNMI WMS radar-nowcast: 5-minuten neerslagverwachting tot 2 uur vooruit.';
}

function removeKnmiWmsRadarLayer(){
  if(state.radar.knmiLayer && state.map){
    state.map.removeLayer(state.radar.knmiLayer);
  }
  state.radar.knmiLayer = null;
}

function refreshRadarSource(){
  if(!state.map) return;
  stopPlaying();
  removeKnmiWmsRadarLayer();
  loadRadarFrames();
  const note = $('.radar-note');
  if(note) note.textContent = 'WeatherFlow radar: echte neerslagframes via de Xweather-worker, vernieuwd om de 5 minuten.';
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
function updateRadarLocationUi(){
  const place = $('#radarPlaceLabel');
  if(place) place.textContent = state.loc?.name ? `Radar rond ${state.loc.name}` : 'Radar rond Belgie';
}
async function loadRadarFrames(keepFrame=false){
  updateRadarLocationUi();
  if(state.radar.layer === 'precip'){
    rainviewerMeta = null;
    buildFrameList(keepFrame);
    return;
  }
  try{
    const r = await fetch('https://api.rainviewer.com/public/weather-maps.json?ts=' + Date.now(), {cache:'no-store'});
    if(!r.ok) throw new Error('RainViewer '+r.status);
    rainviewerMeta = await r.json();
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
  if(state.radar.layer === 'precip') return weatherflowRadarFrames();
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
    state.radar.index = same >= 0 ? same : Math.max(0, state.radar.frames.length-1);
  } else {
    state.radar.index = state.radar.frames.length-1;
  }
  renderTimeline();
  setFrame(state.radar.index);
}
function renderTimeline(){
  const tl = $('#timeline'); tl.innerHTML='';
  const observedCount = state.radar.layer === 'precip'
    ? state.radar.frames.length
    : state.radar.frames.filter(f=>!f.isNowcast).length;
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
      ? (f.isNow ? 'Nu' : `${Math.abs(f.offset)} min geleden`)
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
    url = weatherflowRadarTileUrl(f.offset);
  }else{
    if(!rainviewerMeta) return;
    const host = rainviewerMeta.host;
    url = `${host}${f.path}/256/{z}/{x}/{y}/0/0_0.png?rv=${f.time}-${Date.now()}`;
  }
  if(!state.radar.animator) state.radar.animator = createRadarAnimator(state.map);
  state.radar.animator.showFrame(url, state.radar.opacity);
  const d = new Date(f.time*1000);
  const label = state.radar.layer === 'precip'
    ? (f.isNow ? 'Nu' : `${Math.abs(f.offset)} min geleden`)
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
$('#chipPrecip').addEventListener('click', ()=>{
  if(state.xweather.ready){ setXweatherLayer('radar'); return; }
  switchLayer('precip');
});
$('#chipSat').addEventListener('click', ()=>{
  if(state.xweather.ready){ setXweatherLayer('satellite'); return; }
  switchLayer('satellite');
});
function switchLayer(l){
  if(state.xweather.ready || state.xweather.controller){
    teardownXweather();
    state.xweather.fallback = true;
    $('#liveRadarPanel')?.classList.remove('hide');
  }
  state.radar.layer = l;
  $('#chipPrecip').classList.toggle('active', l==='precip');
  $('#chipSat').classList.toggle('active', l==='satellite');
  if(state.radar.animator){ state.radar.animator.destroy(); state.radar.animator = null; }
  if(l === 'precip') startLegacyRadar();
  else loadRadarFrames();
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
  const score = riskScore(cape, li, gust);
  $('#riskLocName').textContent = state.loc.name;
  $('#riskNum').textContent = score;
  $('#capeNow').textContent = Math.round(cape ?? 0);
  $('#liNow').textContent = li != null ? li.toFixed(1) : '0.0';
  $('#gustNow').textContent = fmtWindVal(gust);
  $('#frzNow').textContent = Math.round(state.hourly.freezing_level_height[nowIdx] ?? 0);
  const circumference = 389.6;
  const offset = circumference - (score/100)*circumference;
  $('#riskArc').style.strokeDashoffset = offset;
  $('#riskArc').style.stroke = score>65 ? '#ef4b5f' : score>35 ? '#f5a524' : '#4ade80';

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
      setLocation(f.lat, f.lon, f.name, f.admin);
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
  refreshTimer:null
};

async function enterTV(){
  tv.active = true;
  document.getElementById('tvscreen').classList.add('active');
  try{
    if(document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    else if(document.documentElement.webkitRequestFullscreen) document.documentElement.webkitRequestFullscreen();
  }catch(e){ /* fullscreen kan geweigerd zijn - dashboard blijft gewoon zichtbaar */ }

  if(state.current) renderTV();
  tickClock();
  tv.clockTimer = setInterval(tickClock, 1000);
  tv.refreshTimer = setInterval(()=>{ loadWeather(); }, 5*60*1000);

  initTvMap();
}
function exitTV(){
  tv.active = false;
  document.getElementById('tvscreen').classList.remove('active');
  clearInterval(tv.clockTimer); clearInterval(tv.refreshTimer); clearInterval(tv.loopTimer);
  disposeTvXweatherRadar();
  if(document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(()=>{});
}
$('#tvBtn').addEventListener('click', enterTV);
$('#tvExitBtn').addEventListener('click', exitTV);
document.addEventListener('fullscreenchange', ()=>{
  if(!document.fullscreenElement && tv.active) exitTV();
});
document.addEventListener('keydown', (e)=>{
  if(e.key === 'Escape' && document.body.classList.contains('auth-open')) closeAuthSheet();
  if(e.key === 'Escape' && document.body.classList.contains('day-detail-open')) closeDayDetail();
  if(e.key === 'Escape' && tv.active) exitTV();
});
window.addEventListener('popstate', ()=>{
  if(document.body.classList.contains('auth-open')) closeAuthSheet({fromPopState:true});
});
document.addEventListener('visibilitychange', ()=>{
  if(!document.hidden && tv.active) refreshTvXweatherRadar();
});
window.addEventListener('focus', ()=>{
  if(tv.active) refreshTvXweatherRadar();
});
window.addEventListener('resize', ()=>{
  if(state.map) setTimeout(()=>state.map.invalidateSize(), 120);
  if(tv.map) setTimeout(()=>tv.map.invalidateSize(), 120);
  positionSunPaths();
});
window.addEventListener('orientationchange', ()=>{
  if(state.map) setTimeout(()=>state.map.invalidateSize(), 350);
  if(tv.map) setTimeout(()=>tv.map.invalidateSize(), 350);
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
  const wc = wcInfo(cur.weather_code);
  const isDay = cur.is_day === 1;
  const nowIdx = nowIndexInHourly();

  $('#tvLocName').textContent = state.loc.name;
  $('#tvAdmin').textContent = state.loc.admin || '';
  $('#tvIcon').innerHTML = icon(wc.ic, isDay, 110);
  $('#tvTemp').innerHTML = fmtTemp(cur.temperature_2m);
  $('#tvCond').textContent = wc.l;
  const sunrise = formatTvSunTime(daily.sunrise?.[0]);
  const sunset = formatTvSunTime(daily.sunset?.[0]);
  $('#tvHiLo').innerHTML = `H: <b>${fmtTemp(daily.temperature_2m_max[0])}</b> &nbsp; L: <b>${fmtTemp(daily.temperature_2m_min[0])}</b> &nbsp; Voelt als ${fmtTemp(cur.apparent_temperature)}<div class="tv-sunline">${icon('sunrise',true,18)} Zon op ${sunrise} &nbsp; Zon onder ${sunset}</div>`;

  $('#tvDetails').innerHTML = [
    tvMetricCard('wind','Wind', fmtWind(cur.wind_speed_10m), 'Stoten '+fmtWind(cur.wind_gusts_10m)),
    tvMetricCard('drop','Neerslag', fmtPrecip(cur.precipitation), 'Kans '+(hourly.precipitation_probability[nowIdx]??0)+'%'),
    tvMetricCard('gauge','Vochtigheid', cur.relative_humidity_2m+'%', 'Dauwpunt '+fmtTemp(hourly.dew_point_2m[nowIdx])),
    tvMetricCard('thermo','Druk', fmtPress(cur.pressure_msl), cur.pressure_msl>1013?'Hoge druk':'Lage druk'),
    tvMarineCard(),
    tvAlertCard()
  ].filter(Boolean).join('');

  let hh = '';
  for(let i=nowIdx; i<Math.min(nowIdx+8, hourly.time.length); i++){
    const t = new Date(hourly.time[i]);
    const label = i===nowIdx ? 'Nu' : t.getHours()+':00';
    const hwc = wcInfo(hourly.weather_code[i]);
    const hIsDay = isDayForTime(hourly.time[i]);
    hh += `<div class="hitem ${i===nowIdx?'now':''}"><div class="t">${label}</div>${icon(hwc.ic,hIsDay,34)}<div class="p">${hourly.precipitation_probability[i]>10?hourly.precipitation_probability[i]+'%':''}</div><div class="v">${fmtTemp(hourly.temperature_2m[i])}</div></div>`;
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
  return `<div class="dcard">${icon(ic,true,18)}<div><div class="dt-title">${title}</div><div class="dt-val">${val}</div><div class="dt-sub">${sub}</div></div></div>`;
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
  if(alert.level === 'green'){
    return `<div class="dcard tv-warning green">${icon('gauge',true,18)}<div><div class="dt-title">Weermelding</div><div class="dt-val">Code groen</div></div></div>`;
  }
  return `<div class="dcard tv-warning ${level.cls}">${icon('gauge',true,18)}<div><div class="dt-title">Weermelding</div><div class="dt-val">${level.label}</div><div class="dt-sub">${esc(alert.headline)}</div></div></div>`;
}

function tvMarineCard(){
  if(!state.marine) return '';
  const tide = state.marine.tide;
  const nextLabel = tide.nextType === 'hoogwater' ? 'vloed' : 'eb';
  const nextTime = tide.nextTime.toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit'});
  const wave = state.marine.waveHeight != null ? `${state.marine.waveHeight.toFixed(1)} m` : 'n.b.';
  const spark = state.seaspark ? ` - zeevonk ${state.seaspark.score}%` : '';
  return `<div class="dcard tv-marine">${icon('drop',true,18)}<div><div class="dt-title">Kust</div><div class="dt-val">${tide.state}</div><div class="dt-sub">Volgende ${nextLabel} ${nextTime} - golfhoogte ${wave}${spark}</div></div></div>`;
}

async function initTvMap(){
  if(!tv.map){
    const rv = tvRadarView();
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
      minZoom:rv.zoom,
      maxZoom:rv.zoom
    }).setView(rv.center, rv.zoom);
    tv.map.createPane('radarPane');
    tv.map.getPane('radarPane').style.zIndex = 420;
    tv.map.createPane('labelPane');
    tv.map.getPane('labelPane').style.zIndex = 650;
    tv.map.getPane('labelPane').style.pointerEvents = 'none';
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', {subdomains:'abcd', maxZoom:19}).addTo(tv.map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png', {subdomains:'abcd', maxZoom:19, pane:'labelPane'}).addTo(tv.map);
    L.circleMarker([state.loc.lat, state.loc.lon], {radius:7, color:'#fff', weight:3, fillColor:'#1677ff', fillOpacity:.95}).addTo(tv.map);
  } else {
    const rv = tvRadarView();
    tv.map.setView(rv.center, rv.zoom);
  }
  setTimeout(()=>tv.map.invalidateSize(), 200);
  const xweatherOk = await initTvXweatherRadar();
  clearInterval(tv.loopTimer);
  if(xweatherOk){
    tv.loopTimer = setInterval(refreshTvXweatherRadar, TV_RADAR_REFRESH_MS);
  }else{
    clearTvRadarLayer();
    updateTvRadarLabel(null, 'Radar niet beschikbaar');
  }
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
    const currentDate = timeline?.info?.currentDate || new Date();
    updateTvRadarLabel(Math.round(currentDate.getTime() / 1000), 'Live buienradar - Xweather');
    return true;
  }catch(err){
    console.warn('Xweather tv-radar kon niet verversen', err);
    updateTvRadarLabel(null, 'Radar vernieuwen mislukt');
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
  if(!tv.map) return;
  setTvFrame(WEATHERFLOW_RADAR_OFFSETS.length - 1);
  tv.map.invalidateSize();
}
function setTvFrame(i){
  if(!tv.map) return;
  tv.index = i;
  const offset = WEATHERFLOW_RADAR_OFFSETS[i] ?? 0;
  const url = weatherflowRadarTileUrl(offset);
  clearTvRadarLayer();
  tv.radarLayer = L.tileLayer(url, {
    opacity:0.9,
    maxZoom:10,
    maxNativeZoom:10,
    pane:'radarPane',
    className:'radar-tile-layer tv-radar-live-layer',
    crossOrigin:true,
    keepBuffer:1,
    updateWhenIdle:false,
    updateWhenZooming:false
  }).addTo(tv.map);
  updateTvRadarLabel(Math.round(Date.now()/1000), 'Live buienradar - Nu');
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
  el.textContent = `Live buienradar - ${time}`;
}

/* =========================================================================
   INIT
   ========================================================================= */
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
  await safeInitStep('Community UI koppelen', initCommunityUi);
  await safeInitStep('Klimaat UI koppelen', initClimateUi);
  await safeInitStep('Push instellingen koppelen', wirePushSettings);
  await safeInitStep('Favorieten laden', loadStoredFavorites);
  await safeInitStep('Auth starten', initAuth);
  await safeInitStep('Community realtime starten', subscribeCommunityRealtime);
  await safeInitStep('Instellingenknoppen herstellen', ()=>{
    $$('#segTemp button').forEach(b=>b.classList.toggle('active', b.dataset.v===state.units.temp));
    $$('#segWind button').forEach(b=>b.classList.toggle('active', b.dataset.v===state.units.wind));
    $$('#segPrecip button').forEach(b=>b.classList.toggle('active', b.dataset.v===state.units.precip));
    $$('#segPress button').forEach(b=>b.classList.toggle('active', b.dataset.v===state.units.press));
    $$('#segDays button').forEach(b=>b.classList.toggle('active', +b.dataset.v===state.units.days));
    $$('#segModel button').forEach(b=>b.classList.toggle('active', b.dataset.v===state.units.model));
  });

  await safeInitStep('Locatie ophalen', async ()=>{
    const p = await getBrowserLocation();
    if(p){
      const g = await reverseGeocode(p.lat, p.lon);
      state.loc = {lat:p.lat, lon:p.lon, name:g.name, admin:g.admin, country:g.country};
    }
  });
  await loadWeather();
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
