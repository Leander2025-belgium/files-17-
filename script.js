/* =========================================================================
   WEERSCOOP - live weer, radar en storm-chaser tool
   Databronnen: Open-Meteo (weer + geocoding, gratis, geen key) en
   RainViewer (radar/satelliet tegels, gratis, geen key).
   ========================================================================= */

const KNMI_OPEN_DATA_API_KEY = 'eyJvcmciOiI1ZTU1NGUxOTI3NGE5NjAwMDEyYTNlYjEiLCJpZCI6IjU0YWM2YmI3NmVmZDRhMTI4NzEwMmUxMWE2NzRlYmMwIiwiaCI6Im11cm11cjEyOCJ9';
const KNMI_WMS_API_KEY = 'eyJvcmciOiI1ZTU1NGUxOTI3NGE5NjAwMDEyYTNlYjEiLCJpZCI6ImI5YmEzN2M4ZWZiYjRhZjdhMjBkYjlmNzNhN2M1NmQwIiwiaCI6Im11cm11cjEyOCJ9';
const RADAR_MAX_AGE_MINUTES = 90;
const PUSH_FUNCTION_BASE = new URL('/.netlify/functions/', location.origin).href;

const state = {
  loc: { lat: 51.2405, lon: 2.9309, name: "Oostende", admin: "West-Vlaanderen, Belgie" },
  units: { temp:'C', wind:'kmh', precip:'mm', press:'hpa', days:7, model:'knmi_seamless' },
  current: null, hourly: null, daily: null, tz: 'Europe/Brussels', utcOffsetSec: 0,
  observation: null, marine: null, air: null,
  alerts: [],
  alertsMeta: { source:'Indicatieve weercode', official:false, updated:null },
  knmiKey: KNMI_OPEN_DATA_API_KEY,
  lastUpdated: null,
  favorites: [],
  auth: { configured:false, ready:false, supabase:null, session:null, user:null, profile:null, syncing:false, guest:true },
  push: { supported:false, standalone:false, configured:false, status:'Niet ondersteund', installationId:null, preferences:null, thresholds:null },
  radar: { frames: [], index: 0, playing: false, timer: null, refreshTimer: null, layer: 'precip', scheme: 4, opacity: 0.9, duration: 1, animator: null },
  map: null, marker: null,
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

/* ---------------- Supabase auth + profile sync ---------------- */
function authRedirectUrl(){
  return new URL('./', location.href).href;
}

async function loadSupabaseConfig(){
  try{
    const r = await fetch(PUSH_FUNCTION_BASE + 'supabase-config', {cache:'no-store'});
    if(r.ok){
      const data = await r.json();
      if(data.configured) return data;
    }
  }catch(e){}
  const local = window.WEERSCOOP_SUPABASE_CONFIG || {};
  return {
    configured:Boolean(local.supabaseUrl && local.supabaseAnonKey),
    supabaseUrl:local.supabaseUrl,
    supabaseAnonKey:local.supabaseAnonKey
  };
}

async function initAuth(){
  updateAuthMessage('Profiel laden...');
  try{
    const config = await loadSupabaseConfig();
    state.auth.configured = Boolean(config.configured);
    if(!state.auth.configured){
      state.auth.ready = true;
      updateAuthInterface(null);
      return;
    }
    const mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    state.auth.supabase = mod.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:true}
    });
    const { data:{ session } } = await state.auth.supabase.auth.getSession();
    await applyAuthSession(session);
    state.auth.supabase.auth.onAuthStateChange(async (event, session)=>{
      await applyAuthSession(session, event);
    });
  }catch(e){
    console.warn('Supabase auth niet beschikbaar:', e?.message || e);
    state.auth.configured = false;
    updateAuthInterface(null);
  }finally{
    state.auth.ready = true;
  }
}

async function applyAuthSession(session, event=''){
  state.auth.session = session || null;
  state.auth.user = session?.user || null;
  state.auth.guest = !state.auth.user;
  if(event === 'PASSWORD_RECOVERY') showPasswordResetPrompt();
  if(state.auth.user){
    await loadCloudProfileAndFavorites();
  }else{
    state.auth.profile = null;
  }
  updateAuthInterface(state.auth.session);
}

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
    display_name: state.auth.profile?.display_name || state.auth.user?.user_metadata?.display_name || state.auth.user?.email?.split('@')[0] || 'Weerscoop gebruiker',
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
  const supabase = state.auth.supabase;
  const user = state.auth.user;
  if(!supabase || !user) return;
  try{
    let { data:profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if(!profile){
      const payload = { id:user.id, ...profilePayload() };
      const res = await supabase.from('profiles').upsert(payload).select('*').single();
      profile = res.data;
    }
    state.auth.profile = profile || null;
    mapProfileToUnits(profile);
    const { data:favorites } = await supabase.from('favorite_locations')
      .select('id,name,latitude,longitude,country,sort_order')
      .eq('user_id', user.id)
      .order('sort_order', {ascending:true})
      .order('created_at', {ascending:true});
    if(Array.isArray(favorites) && favorites.length){
      state.favorites = favorites.map(f=>({id:f.id, name:f.name, lat:+f.latitude, lon:+f.longitude, admin:f.country || ''}));
      await window.storage.set('weerscoop:favorites', JSON.stringify(state.favorites)).catch(()=>undefined);
    }else if(state.favorites.length){
      await syncFavoritesToCloud(true);
    }
  }catch(e){
    console.warn('Profielsync mislukt:', e?.message || e);
    toast('Profiel kon niet worden gesynchroniseerd.');
  }
}

async function syncProfileSettingsToCloud(){
  if(state.auth.syncing || !state.auth.supabase || !state.auth.user) return;
  state.auth.syncing = true;
  try{
    const { data, error } = await state.auth.supabase.from('profiles')
      .upsert({id:state.auth.user.id, ...profilePayload()})
      .select('*')
      .single();
    if(error) throw error;
    state.auth.profile = data;
    updateAuthInterface(state.auth.session);
  }catch(e){
    console.warn('Instellingen niet gesynchroniseerd:', e?.message || e);
  }finally{
    state.auth.syncing = false;
  }
}

async function syncFavoritesToCloud(force=false){
  if(!force && state.auth.syncing) return;
  if(!state.auth.supabase || !state.auth.user) return;
  try{
    const supabase = state.auth.supabase;
    await supabase.from('favorite_locations').delete().eq('user_id', state.auth.user.id);
    if(!state.favorites.length) return;
    const rows = state.favorites.map((f,i)=>({
      user_id:state.auth.user.id,
      name:String(f.name || 'Favoriet').slice(0,80),
      latitude:+f.lat,
      longitude:+f.lon,
      country:String(f.admin || '').slice(0,120),
      sort_order:i
    }));
    const { error } = await supabase.from('favorite_locations').insert(rows);
    if(error) throw error;
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
  const coast = nearestCoastalPlace();
  if(!coast || coast.dist > 18) return;
  try{
    const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${coast.lat}&longitude=${coast.lon}&hourly=wave_height,wave_period,wave_direction&timezone=auto&forecast_days=2`;
    const r = await fetch(url);
    if(!r.ok) return;
    const d = await r.json();
    const idx = closestIndex(d.hourly.time, Date.now());
    state.marine = {
      place:coast.name,
      waveHeight:d.hourly.wave_height?.[idx] ?? null,
      wavePeriod:d.hourly.wave_period?.[idx] ?? null,
      waveDirection:d.hourly.wave_direction?.[idx] ?? null,
      tide:tideStateForOostende(new Date())
    };
  }catch(e){}
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
    const r = await fetch(`https://aviationweather.gov/api/data/metar?ids=${station.id}&format=json`);
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
  }catch(e){}
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
  return cur;
}

function isNetherlandsLocation(){
  const {lat, lon} = state.loc;
  return lat >= 50.7 && lat <= 53.8 && lon >= 3.1 && lon <= 7.4;
}

function shouldUseKnmiWmsRadar(){
  return !!KNMI_WMS_API_KEY && isNetherlandsLocation();
}

function radarView(){
  if(isBeneluxLocation()) return {center:[50.85, 4.35], zoom:7};
  return {center:[state.loc.lat, state.loc.lon], zoom:7};
}

function tvRadarView(){
  return {center:[50.85, 4.35], zoom:7};
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
  if(!state.knmiKey || !isNetherlandsLocation()) return null;
  const base = 'https://api.dataplatform.knmi.nl/open-data/v1/datasets/waarschuwingen_nederland_48h/versions/1.0/files';
  const headers = {Authorization: state.knmiKey};
  const listRes = await fetch(base, {headers});
  if(!listRes.ok) throw new Error('KNMI waarschuwingen niet beschikbaar');
  const list = await listRes.json();
  const files = list.files || [];
  const file = files
    .map(f => f.filename || f.name || f)
    .filter(Boolean)
    .filter(name => /\.(xml|txt)$/i.test(name))
    .sort()
    .pop();
  if(!file) return null;
  const urlRes = await fetch(`${base}/${encodeURIComponent(file)}/url`, {headers});
  if(!urlRes.ok) throw new Error('KNMI downloadlink niet beschikbaar');
  const urlData = await urlRes.json();
  const downloadUrl = urlData.temporaryDownloadUrl || urlData.url || urlData.href;
  if(!downloadUrl) return null;
  const dataRes = await fetch(downloadUrl);
  if(!dataRes.ok) throw new Error('KNMI waarschuwingen konden niet geladen worden');
  const text = await dataRes.text();
  const level = alertLevelFromText(text);
  const cleaned = text.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  return [{
    level,
    headline: ALERT_LEVELS[level].title,
    description: cleaned.slice(0, 260) || 'Officiele KNMI-waarschuwing geladen.',
    source:'KNMI Data Platform',
    official:true
  }];
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
      pos => resolve({lat:pos.coords.latitude, lon:pos.coords.longitude}),
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
    const admin = [d.principalSubdivision, d.countryName].filter(Boolean).join(', ');
    return {name, admin};
  }catch(e){ return {name:'Huidige locatie', admin:''}; }
}

/* ---------------- geocoding search ---------------- */
let searchTimer = null;
$('#searchInput').addEventListener('input', (e)=>{
  const q = e.target.value.trim();
  $('#clearSearch').style.display = q ? 'block' : 'none';
  clearTimeout(searchTimer);
  if(q.length < 2){ $('#suggestions').classList.remove('show'); return; }
  searchTimer = setTimeout(()=>doSearch(q), 300);
});
$('#clearSearch').addEventListener('click', ()=>{
  $('#searchInput').value=''; $('#clearSearch').style.display='none'; $('#suggestions').classList.remove('show');
});
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
    box.innerHTML = results.map((res,i)=>`
      <div class="sugg-item" data-i="${i}">
        <span class="sugg-name">${res.name}</span>
        <span class="sugg-sub">${[res.admin1, res.country].filter(Boolean).join(', ')}</span>
      </div>`).join('');
    box.classList.add('show');
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

async function loadWeather(){
  $('#homeLoader')?.classList.remove('hide');
  try{
    let requestedModel = preferredWeatherModel();
    let r = await fetch(buildForecastUrl(requestedModel));
    let d;
    if(r.ok){
      d = await r.json();
    }
    if(!r.ok || d.error) throw new Error('KNMI HARMONIE niet beschikbaar');
    state.current = d.current; state.hourly = d.hourly; state.daily = d.daily; state.minutely = d.minutely_15;
    state.tz = d.timezone; state.utcOffsetSec = d.utc_offset_seconds;
    state.lastUpdated = Date.now();
    await loadCurrentObservation();
    await loadMarine();
    await loadAirQuality();
    await loadAlerts();
    renderHome();
    updateLastUpdatedText();
    if(tv.active) renderTV();
    if($('#stormscreen').classList.contains('active')) updateStormTab();
    if($('#radarscreen').classList.contains('active') && state.radar.duration>1) renderHourlyChart();
  }catch(e){
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

/* ---------------- animated background: matches current conditions ---------------- */
let lightningTimer = null;
function applyWeatherBG(code, isDay, cloudCover=0){
  const el = $('#weatherBG');
  if(!el) return;
  const scenes = ['sunny','cloudy','rainy','stormy','snowy'];
  let scene = 'sunny';
  if([95,96,99].includes(code)) scene = 'stormy';
  else if([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code)) scene = 'rainy';
  else if([71,73,75,77,85,86].includes(code)) scene = 'snowy';
  else if(code===45||code===48||code===1||code===2||code===3 || cloudCover >= 45) scene = 'cloudy';
  else scene = 'sunny';
  scenes.forEach(s=>el.classList.toggle(s, s===scene));
  el.classList.toggle('night', !isDay);
  el.classList.toggle('cloud-cover-heavy', cloudCover >= 70 || code === 3);
  el.classList.toggle('cloud-cover-light', scene === 'cloudy' && cloudCover < 70 && code !== 3);

  clearInterval(lightningTimer);
  if(scene === 'stormy'){
    const flashEl = $('.wbg-lightning', el);
    lightningTimer = setInterval(()=>{
      if(Math.random() < 0.4){
        flashEl.classList.add('flash');
        setTimeout(()=>flashEl.classList.remove('flash'), 120);
        if(Math.random() < 0.3) setTimeout(()=>{
          flashEl.classList.add('flash');
          setTimeout(()=>flashEl.classList.remove('flash'), 90);
        }, 220);
      }
    }, 2500);
  }
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
    <div class="locname">${icon('drop',true,15,'pin')}${state.loc.name}</div>
    <div class="bignum display">${fmtTemp(cur.temperature_2m)}</div>
    <div class="cond">${wc.l}</div>
    <div class="hilo">H:<b>${fmtTemp(todayMax)}</b>&nbsp;&nbsp;L:<b>${fmtTemp(todayMin)}</b>&nbsp;&nbsp;Voelt als ${fmtTemp(cur.apparent_temperature)}</div>
    <div class="nowcast" id="nowcastLine">${nowcastText()||''}</div>
    <div class="updated"><span id="updatedText">Bijgewerkt zojuist</span> - ${state.loc.admin||''} - ${currentSource}</div>
  </div>`;

  html += alertsCard();

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
  html += `</div>`;
  html += appSections();

  $('#homeInner').innerHTML = html;
  wireSectionNav();
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
  const layers = ['Buienradar','Temperatuur','Wind','Bewolking','Onweer','Zeetemperatuur','Sneeuw','Satelliet'];
  return `<div class="card"><div class="card-title">${icon('gauge',true,13)} Interactieve weerkaart</div>
    <div class="map-tabs">${layers.map((l,i)=>`<button class="${i===0?'active':''}" type="button">${l}</button>`).join('')}</div>
    <div class="map-preview">
      <div>${icon('cloud',true,42)}<b>Kaartlagen voorbereid</b><span>Buienradar gebruikt de bestaande radarkaart. Extra lagen worden pas geladen wanneer je ze opent.</span></div>
    </div>
    <div class="legend-row"><span>Legenda</span><i></i><span id="mapLayerTime">Actuele modeltijd</span></div>
  </div>`;
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
      ${premiumChartShell('temp','Temperatuur','Gevoelstemperatuur en luchttemperatuur','°C')}
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
      <div><b>${tide.nextTime.toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit'})}</b><span>Volgende ${tide.nextType}</span></div><div><b>Geen officiele vlaginformatie beschikbaar</b><span>Vlagkleur</span></div>
    </div><div class="tide-line"><span></span></div>
  </div>`;
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
        <div class="card-title">${icon('gauge',true,13)} Weercode & meldingen</div>
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
    $$('.tabbtn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    $$('.screen').forEach(s=>s.classList.remove('active'));
    $('#'+btn.dataset.tab).classList.add('active');
    state.activeTab = btn.dataset.tab;
    if(btn.dataset.tab === 'radarscreen'){ initMapIfNeeded(); setTimeout(()=>state.map && state.map.invalidateSize(),150); }
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
  if(msg.includes('invalid login') || msg.includes('invalid credentials')) return 'E-mailadres of wachtwoord is onjuist.';
  if(msg.includes('already registered') || msg.includes('already been registered')) return 'Dit e-mailadres is al in gebruik.';
  if(msg.includes('password')) return 'Controleer je wachtwoord. Het moet minstens 8 tekens bevatten.';
  if(msg.includes('email')) return 'Vul een geldig e-mailadres in.';
  if(msg.includes('network') || msg.includes('fetch')) return 'Er kon geen verbinding worden gemaakt. Probeer het later opnieuw.';
  return 'Er ging iets mis. Probeer het later opnieuw.';
}
function updateAuthInterface(session){
  const loggedIn = Boolean(session?.user);
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
  if(!state.auth.configured && $('#authSubtitle')) $('#authSubtitle').textContent = 'Accountsync is nog niet gekoppeld. Vul eerst Supabase in Netlify in.';
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
async function signInWithEmail(email, password){
  if(!state.auth.supabase) return updateAuthMessage('Accountsync is nog niet ingesteld.', 'error');
  if(!validateEmail(email)) return updateAuthMessage('Vul een geldig e-mailadres in.', 'error');
  updateAuthMessage('Inloggen...');
  const { error } = await state.auth.supabase.auth.signInWithPassword({email, password});
  if(error) return updateAuthMessage(dutchAuthError(error), 'error');
  updateAuthMessage('Je bent ingelogd.', 'ok');
  toast('Je bent ingelogd.');
}
async function signUpWithEmail(displayName, email, password, password2, privacyOk){
  if(!state.auth.supabase) return updateAuthMessage('Accountsync is nog niet ingesteld.', 'error');
  if(!displayName.trim()) return updateAuthMessage('Vul een weergavenaam in.', 'error');
  if(!validateEmail(email)) return updateAuthMessage('Vul een geldig e-mailadres in.', 'error');
  if(password.length < 8) return updateAuthMessage('Het wachtwoord moet minstens 8 tekens bevatten.', 'error');
  if(password !== password2) return updateAuthMessage('De wachtwoorden komen niet overeen.', 'error');
  if(!privacyOk) return updateAuthMessage('Ga akkoord met de privacyvoorwaarden om verder te gaan.', 'error');
  updateAuthMessage('Account aanmaken...');
  const { error } = await state.auth.supabase.auth.signUp({
    email,
    password,
    options:{data:{display_name:displayName.trim()}, emailRedirectTo:authRedirectUrl()}
  });
  if(error) return updateAuthMessage(dutchAuthError(error), 'error');
  updateAuthMessage('Controleer je mailbox om je account te bevestigen.', 'ok');
}
async function resetPassword(email){
  if(!state.auth.supabase) return updateAuthMessage('Accountsync is nog niet ingesteld.', 'error');
  if(!validateEmail(email)) return updateAuthMessage('Vul eerst je e-mailadres in.', 'error');
  updateAuthMessage('Resetmail versturen...');
  const { error } = await state.auth.supabase.auth.resetPasswordForEmail(email, {redirectTo:authRedirectUrl()});
  if(error) return updateAuthMessage(dutchAuthError(error), 'error');
  updateAuthMessage('Controleer je mailbox om je wachtwoord opnieuw in te stellen.', 'ok');
}
async function showPasswordResetPrompt(){
  const pw = prompt('Kies een nieuw wachtwoord van minstens 8 tekens.');
  if(!pw) return;
  if(pw.length < 8) return toast('Het wachtwoord moet minstens 8 tekens bevatten.');
  const { error } = await state.auth.supabase.auth.updateUser({password:pw});
  toast(error ? 'Wachtwoord kon niet worden gewijzigd.' : 'Wachtwoord gewijzigd.');
}
async function updateProfileFromForm(){
  if(!state.auth.supabase || !state.auth.user) return updateProfileMessage('Je bent niet ingelogd.', 'error');
  const name = $('#profileDisplayName')?.value.trim();
  if(!name) return updateProfileMessage('Vul een weergavenaam in.', 'error');
  updateProfileMessage('Opslaan...');
  const payload = {...profilePayload(), display_name:name, home_location_name:$('#profileHomeLocation')?.value.trim() || state.loc.name};
  const { data, error } = await state.auth.supabase.from('profiles')
    .upsert({id:state.auth.user.id, ...payload})
    .select('*')
    .single();
  if(error) return updateProfileMessage('Profiel kon niet worden opgeslagen.', 'error');
  state.auth.profile = data;
  updateAuthInterface(state.auth.session);
  updateProfileMessage('Profiel opgeslagen.', 'ok');
}
async function compressAvatar(file){
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)) throw new Error('Gebruik PNG, JPEG of WebP.');
  if(file.size > 5 * 1024 * 1024) throw new Error('De afbeelding mag maximaal 5 MB zijn.');
  const bitmap = await createImageBitmap(file);
  const size = Math.min(512, Math.max(bitmap.width, bitmap.height));
  const scale = size / Math.max(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return await new Promise(resolve=>canvas.toBlob(resolve, 'image/webp', .86));
}
async function uploadAvatar(file){
  if(!state.auth.supabase || !state.auth.user) return;
  try{
    updateProfileMessage('Profielfoto uploaden...');
    const blob = await compressAvatar(file);
    const path = `${state.auth.user.id}/avatar.webp`;
    const { error } = await state.auth.supabase.storage.from('avatars').upload(path, blob, {contentType:'image/webp', upsert:true});
    if(error) throw error;
    const { data } = state.auth.supabase.storage.from('avatars').getPublicUrl(path);
    const avatarUrl = `${data.publicUrl}?v=${Date.now()}`;
    const res = await state.auth.supabase.from('profiles').upsert({id:state.auth.user.id, ...profilePayload(), avatar_url:avatarUrl}).select('*').single();
    if(res.error) throw res.error;
    state.auth.profile = res.data;
    updateAuthInterface(state.auth.session);
    updateProfileMessage('Profielfoto opgeslagen.', 'ok');
  }catch(e){
    updateProfileMessage(e.message || 'Profielfoto kon niet worden opgeslagen.', 'error');
  }
}
async function deleteAccount(){
  if(!state.auth.session) return;
  const confirmation = prompt('Typ VERWIJDEREN om je account definitief te verwijderen.');
  if(confirmation !== 'VERWIJDEREN') return;
  updateProfileMessage('Account verwijderen...');
  const r = await fetch(PUSH_FUNCTION_BASE + 'delete-account', {
    method:'POST',
    headers:{'content-type':'application/json', authorization:`Bearer ${state.auth.session.access_token}`},
    body:JSON.stringify({confirmation})
  });
  if(!r.ok) return updateProfileMessage('Account kon niet worden verwijderd. Probeer het later opnieuw.', 'error');
  await state.auth.supabase.auth.signOut().catch(()=>undefined);
  closeAuthSheet();
  toast('Account verwijderd.');
}
function wireAuthUi(){
  $('#profileBtn')?.addEventListener('click', openAuthSheet);
  $('#authScrim')?.addEventListener('click', closeAuthSheet);
  $('#closeAuthSheet')?.addEventListener('click', closeAuthSheet);
  $('#profileDoneBtn')?.addEventListener('click', closeAuthSheet);
  $('#continueGuestBtn')?.addEventListener('click', ()=>{ closeAuthSheet(); toast('Je gebruikt Weerscoop als gast.'); });
  $('#authLoginTab')?.addEventListener('click', ()=>setAuthMode('login'));
  $('#authSignupTab')?.addEventListener('click', ()=>setAuthMode('signup'));
  $('#showLoginPassword')?.addEventListener('change', e=>{ $('#loginPassword').type = e.target.checked ? 'text' : 'password'; });
  $('#loginForm')?.addEventListener('submit', e=>{
    e.preventDefault();
    signInWithEmail($('#loginEmail').value.trim(), $('#loginPassword').value);
  });
  $('#signupForm')?.addEventListener('submit', e=>{
    e.preventDefault();
    signUpWithEmail($('#signupName').value, $('#signupEmail').value.trim(), $('#signupPassword').value, $('#signupPassword2').value, $('#signupPrivacy').checked);
  });
  $('#forgotPasswordBtn')?.addEventListener('click', ()=>resetPassword($('#loginEmail').value.trim()));
  $('#profileForm')?.addEventListener('submit', e=>{ e.preventDefault(); updateProfileFromForm(); });
  $('#syncLocalBtn')?.addEventListener('click', async ()=>{ await syncProfileSettingsToCloud(); await syncFavoritesToCloud(true); updateProfileMessage('Lokale gegevens gekopieerd naar je account.', 'ok'); });
  $('#resetPasswordLoggedInBtn')?.addEventListener('click', ()=>resetPassword(state.auth.user?.email || ''));
  $('#logoutBtn')?.addEventListener('click', async ()=>{
    if(state.push.status === 'Ingeschakeld' && !confirm('Meldingen blijven actief op dit toestel. Wil je uitloggen?')) return;
    await state.auth.supabase?.auth.signOut();
    toast('Je bent uitgelogd.');
    closeAuthSheet();
  });
  $('#deleteAccountBtn')?.addEventListener('click', deleteAccount);
  $('#changeAvatarBtn')?.addEventListener('click', ()=>$('#avatarInput')?.click());
  $('#avatarInput')?.addEventListener('change', e=>{ const file = e.target.files?.[0]; if(file) uploadAvatar(file); e.target.value=''; });
  $('#profileFavoritesList')?.addEventListener('click', e=>{
    if(e.target.matches('button[data-act]')) handleProfileFavoriteAction(e.target);
  });
}

function wireSeg(id, key){
  const seg = $(id);
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
$("#manualRefresh").addEventListener('click', ()=>{ loadWeather(); toast('Wordt ververst...'); });

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
    return toast('Meldingen zijn nog niet volledig ingesteld in Netlify.');
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
  if(!r.ok) throw new Error(await pushErrorText(r, 'Meldingen konden niet worden ingesteld. Controleer Supabase en Netlify.'));
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
  toast('Testmelding verzonden. Sluit Weerscoop om dit te testen.');
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
  state.map.setView(rv.center, rv.zoom);
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

  if(shouldUseKnmiWmsRadar()){
    addKnmiWmsRadarLayer();
  } else {
    loadRadarFrames();
  }
  clearInterval(state.radar.refreshTimer);
  state.radar.refreshTimer = setInterval(()=>{
    if(document.hidden) return;
    if(state.radar.knmiLayer && shouldUseKnmiWmsRadar()) state.radar.knmiLayer.redraw();
    else loadRadarFrames(true);
  }, 5*60*1000);
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
      fetch('https://api.dataplatform.knmi.nl/wms/adaguc-server?' + params.toString(), {
        headers:{Authorization:KNMI_WMS_API_KEY}
      }).then(r=>{
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
  if(shouldUseKnmiWmsRadar()){
    addKnmiWmsRadarLayer();
  } else {
    removeKnmiWmsRadarLayer();
    loadRadarFrames();
    const note = $('.radar-note');
    if(note) note.textContent = 'Europees radarbeeld voor Belgie: recent verleden + korte prognose, per 10 minuten.';
  }
}

/* ----- RainViewer radar/satellite frames ----- */
let rainviewerMeta = null;
async function loadRadarFrames(keepFrame=false){
  try{
    const r = await fetch('https://api.rainviewer.com/public/weather-maps.json?ts=' + Date.now(), {cache:'no-store'});
    if(!r.ok) throw new Error('RainViewer '+r.status);
    rainviewerMeta = await r.json();
    const latest = latestRainviewerObservedFrame(rainviewerMeta);
    if(state.radar.layer === 'precip' && !isFreshRadarFrame(latest)){
      throw new Error('RainViewer radarbeeld is te oud');
    }
    buildFrameList(keepFrame);
  }catch(e){
    $('#timeline').innerHTML = '';
    toast('Radardata kon niet geladen worden');
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
  const pastShown = state.radar.frames.filter(f=>!f.isNowcast);
  if(keepFrame && previousTime){
    const same = state.radar.frames.findIndex(f=>f.time === previousTime);
    state.radar.index = same >= 0 ? same : Math.max(0, state.radar.frames.length-1);
  } else {
    state.radar.index = state.radar.layer==='satellite' ? state.radar.frames.length-1 : Math.max(0, pastShown.length-1);
  }
  renderTimeline();
  setFrame(state.radar.index);
}
function renderTimeline(){
  const tl = $('#timeline'); tl.innerHTML='';
  const observedCount = state.radar.frames.filter(f=>!f.isNowcast).length;
  tl.style.setProperty('--observed-count', observedCount || state.radar.frames.length);
  tl.style.setProperty('--frame-count', state.radar.frames.length || 1);
  state.radar.frames.forEach((f,i)=>{
    const b = document.createElement('div');
    b.className = 'tframe' + (f.isNowcast ? ' nowcast':'') + (i===state.radar.index?' active':'');
    const d = new Date(f.time*1000);
    b.title = d.toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit'}) + (f.isNowcast ? ' verwacht' : ' gemeten');
    b.addEventListener('click', ()=>{ stopPlaying(); setFrame(i); });
    tl.appendChild(b);
  });
}
function setFrame(i){
  if(!rainviewerMeta || !state.radar.frames.length || !state.map) return;
  state.radar.index = i;
  const f = state.radar.frames[i];
  const host = rainviewerMeta.host;
  const color = state.radar.scheme;
  const url = state.radar.layer === 'satellite'
    ? `${host}${f.path}/256/{z}/{x}/{y}/0/0_0.png?rv=${f.time}-${Date.now()}`
    : `${host}${f.path}/256/{z}/{x}/{y}/${color}/1_1.png?rv=${f.time}-${Date.now()}`;
  if(!state.radar.animator) state.radar.animator = createRadarAnimator(state.map);
  state.radar.animator.showFrame(url, state.radar.opacity);
  const d = new Date(f.time*1000);
  const latestObserved = !f.isNowcast && i === state.radar.frames.filter(x=>!x.isNowcast).length-1;
  $('#timeLabel').textContent = (latestObserved ? 'Nu ' : '') + d.toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit'}) + (f.isNowcast?' verwacht':'');
  $$('.tframe').forEach((el,idx)=>el.classList.toggle('active', idx===i));
}
function stopPlaying(){
  state.radar.playing = false;
  clearInterval(state.radar.timer);
  $('#playBtn').innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 20,12 6,20"/></svg>`;
}
$('#playBtn').addEventListener('click', ()=>{
  if(state.radar.playing){ stopPlaying(); return; }
  state.radar.playing = true;
  $('#playBtn').innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>`;
  state.radar.timer = setInterval(()=>{
    let next = state.radar.index + 1;
    if(next >= state.radar.frames.length) next = 0;
    setFrame(next);
  }, 520);
});
$('#opacitySlider').addEventListener('input', (e)=>{
  state.radar.opacity = (+e.target.value)/100;
  if(state.radar.knmiLayer) state.radar.knmiLayer.setOpacity(state.radar.opacity);
  if(state.radar.animator) state.radar.animator.setOpacity(state.radar.opacity);
});
$('#chipPrecip').addEventListener('click', ()=>switchLayer('precip'));
$('#chipSat').addEventListener('click', ()=>switchLayer('satellite'));
function switchLayer(l){
  state.radar.layer = l;
  $('#chipPrecip').classList.toggle('active', l==='precip');
  $('#chipSat').classList.toggle('active', l==='satellite');
  buildFrameList();
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
const tv = { active:false, map:null, animator:null, radarLayer:null, frames:[], index:0, loopTimer:null, clockTimer:null, refreshTimer:null };

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
  if(!document.hidden && tv.active) refreshTvRadarFrame();
});
window.addEventListener('focus', ()=>{
  if(tv.active) refreshTvRadarFrame();
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
  return `<div class="dcard tv-marine">${icon('drop',true,18)}<div><div class="dt-title">Kust</div><div class="dt-val">${tide.state}</div><div class="dt-sub">Volgende ${nextLabel} ${nextTime} - golfhoogte ${wave}</div></div></div>`;
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
    if(shouldUseKnmiWmsRadar()){
      const KnmiLayer = createKnmiWmsGridLayer();
      tv.knmiLayer = new KnmiLayer({
        pane:'radarPane',
        opacity:.9,
        tileSize:256,
        maxZoom:10,
        className:'radar-tile-layer knmi-wms-layer',
        keepBuffer:3
      }).addTo(tv.map);
    }
  } else {
    const rv = tvRadarView();
    tv.map.setView(rv.center, rv.zoom);
  }
  setTimeout(()=>tv.map.invalidateSize(), 200);

  if(tv.knmiLayer){
    tv.knmiLayer.redraw();
    clearInterval(tv.loopTimer);
    tv.loopTimer = setInterval(()=>{
      if(!tv.knmiLayer) return;
      tv.knmiLayer.redraw();
      tv.map.invalidateSize();
    }, 60*1000);
    return;
  }

  await refreshTvRadarFrame();
  clearInterval(tv.loopTimer);
  tv.loopTimer = setInterval(refreshTvRadarFrame, 60*1000);
}
async function refreshTvRadarFrame(){
  try{
    const r = await fetch('https://api.rainviewer.com/public/weather-maps.json?ts=' + Date.now(), {cache:'no-store'});
    if(!r.ok) throw new Error('RainViewer '+r.status);
    rainviewerMeta = await r.json();
    const past = (rainviewerMeta.radar && rainviewerMeta.radar.past) || [];
    const latest = past[past.length - 1] || null;
    if(!isFreshRadarFrame(latest)) throw new Error('Radarbeeld is niet actueel');
    tv.frames = past;
    setTvFrame(Math.max(0, past.length-1));
    if(tv.map) tv.map.invalidateSize();
  }catch(e){
    clearTvRadarLayer();
    updateTvRadarLabel(null, 'Radar niet actueel');
  }
}
function setTvFrame(i){
  if(!tv.frames.length || !tv.map) return;
  tv.index = i;
  const f = tv.frames[i];
  const url = `${rainviewerMeta.host}${f.path}/256/{z}/{x}/{y}/4/1_1.png?tv=${f.time}-${Date.now()}`;
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
  updateTvRadarLabel(f.time);
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
async function init(){
  await loadStoredUnits();
  wireAuthUi();
  wirePushSettings();
  await loadStoredFavorites();
  await initAuth();
  $$('#segTemp button').forEach(b=>b.classList.toggle('active', b.dataset.v===state.units.temp));
  $$('#segWind button').forEach(b=>b.classList.toggle('active', b.dataset.v===state.units.wind));
  $$('#segPrecip button').forEach(b=>b.classList.toggle('active', b.dataset.v===state.units.precip));
  $$('#segPress button').forEach(b=>b.classList.toggle('active', b.dataset.v===state.units.press));
  $$('#segDays button').forEach(b=>b.classList.toggle('active', +b.dataset.v===state.units.days));
  $$('#segModel button').forEach(b=>b.classList.toggle('active', b.dataset.v===state.units.model));

  const p = await getBrowserLocation();
  if(p){
    const g = await reverseGeocode(p.lat, p.lon);
    state.loc = {lat:p.lat, lon:p.lon, name:g.name, admin:g.admin};
  }
  await loadWeather();
  startAutoRefresh();
}
init();
