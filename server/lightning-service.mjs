const XWEATHER_BASE = 'https://data.api.xweather.com';

function credentials(env = process.env){
  let clientId = env.XWEATHER_CLIENT_ID || '';
  let clientSecret = env.XWEATHER_CLIENT_SECRET || '';
  const combined = env.XWEATHER_API_KEY || env.XWEATHER_KEY || '';
  if((!clientId || !clientSecret) && combined.includes('_')){
    const parts = combined.split('_');
    clientId ||= parts.shift() || '';
    clientSecret ||= parts.join('_');
  }
  return {clientId, clientSecret};
}
function num(v){ const n=Number(v); return Number.isFinite(n)?n:null; }
function haversineKm(a,b,c,d){
  const R=6371, r=x=>x*Math.PI/180;
  const dLat=r(c-a), dLon=r(d-b);
  const q=Math.sin(dLat/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(q));
}
function pointInRing(lat,lon,ring=[]){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [xi,yi]=ring[i]||[], [xj,yj]=ring[j]||[];
    if(![xi,yi,xj,yj].every(Number.isFinite)) continue;
    const cross=((yi>lat)!==(yj>lat)) && (lon < (xj-xi)*(lat-yi)/((yj-yi)||1e-12)+xi);
    if(cross) inside=!inside;
  }
  return inside;
}
function pointInPolygon(lat,lon,polygon){
  const rings=polygon?.coordinates;
  return Array.isArray(rings) && rings.length ? pointInRing(lat,lon,rings[0]) : false;
}
async function getJson(url, signal){
  const r=await fetch(url,{signal,headers:{Accept:'application/json'}});
  const data=await r.json().catch(()=>({}));
  if(!r.ok || data?.success===false) throw new Error(data?.error?.description || data?.error || `Xweather ${r.status}`);
  return Array.isArray(data?.response) ? data.response : [];
}
function strikeView(s){
  const lat=num(s?.loc?.lat), lon=num(s?.loc?.long);
  return {
    id:s?.id || null, lat, lon,
    distanceKm:num(s?.relativeTo?.distanceKM),
    bearing:num(s?.relativeTo?.bearing), direction:s?.relativeTo?.bearingENG || null,
    ageSec:num(s?.ob?.age), time:s?.ob?.dateTimeISO || null,
    type:String(s?.ob?.pulse?.type || '').toUpperCase() || null,
    peakAmp:num(s?.ob?.pulse?.peakamp)
  };
}
function threatView(t,lat,lon){
  const periods=Array.isArray(t?.periods)?t.periods:[];
  const now=Math.floor(Date.now()/1000);
  let etaMinutes=null, affectsNow=false, nearestDistanceKm=null;
  for(const p of periods){
    const inside=pointInPolygon(lat,lon,p?.polygon);
    const minTs=num(p?.range?.minTimestamp), maxTs=num(p?.range?.maxTimestamp);
    if(inside){
      if(minTs!=null && maxTs!=null && now>=minTs && now<=maxTs) affectsNow=true;
      const eta=minTs==null?null:Math.max(0,Math.round((minTs-now)/60));
      if(eta!=null && (etaMinutes==null || eta<etaMinutes)) etaMinutes=eta;
    }
    const coords=p?.centroid?.coordinates;
    if(Array.isArray(coords) && coords.length>=2){
      const d=haversineKm(lat,lon,Number(coords[1]),Number(coords[0]));
      if(Number.isFinite(d) && (nearestDistanceKm==null || d<nearestDistanceKm)) nearestDistanceKm=d;
    }
  }
  const m=t?.details?.movement || {};
  return {
    id:t?.id || t?.details?.stormId || null,
    severe:Boolean(t?.details?.severe), affectsNow, etaMinutes,
    nearestDistanceKm,
    movement:{dir:m.dir||null,dirTo:m.dirTo||null,speedKph:num(m.speedKPH),reliability:m.reliability||null},
    issued:t?.details?.issuedDateTimeISO || null,
    validUntil:t?.details?.range?.maxDateTimeISO || null
  };
}
export async function fetchLightning({latitude,longitude,radius=100,signal,env=process.env}={}){
  const lat=num(latitude), lon=num(longitude), rad=Math.min(100,Math.max(5,num(radius)||100));
  if(lat==null || lon==null || lat < -90 || lat > 90 || lon < -180 || lon > 180) throw new TypeError('Ongeldige latitude/longitude');
  const {clientId,clientSecret}=credentials(env);
  if(!clientId || !clientSecret) return {ok:true,available:false,configured:false,updated:new Date().toISOString(),strikes:[],nearest:null,summary:{count:0,radiusKm:rad},threat:null,source:'Xweather Vaisala lightning',provider:'xweather',error:'XWEATHER_CLIENT_ID/XWEATHER_CLIENT_SECRET ontbreken'};
  const auth=`client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`;
  const p=`${lat.toFixed(5)},${lon.toFixed(5)}`;
  const strikesUrl=`${XWEATHER_BASE}/lightning/closest?p=${encodeURIComponent(p)}&radius=${rad}km&limit=1000&filter=all&${auth}`;
  const threatsUrl=`${XWEATHER_BASE}/lightning/threats/closest?p=${encodeURIComponent(p)}&radius=${rad}km&limit=5&${auth}`;
  const [strikesResult,threatsResult]=await Promise.allSettled([getJson(strikesUrl,signal),getJson(threatsUrl,signal)]);
  const rawStrikes=strikesResult.status==='fulfilled'?strikesResult.value:[];
  const strikes=rawStrikes.map(strikeView).filter(s=>s.lat!=null&&s.lon!=null).sort((a,b)=>(a.distanceKm??9999)-(b.distanceKm??9999));
  const rawThreats=threatsResult.status==='fulfilled'?threatsResult.value:[];
  const threats=rawThreats.map(t=>threatView(t,lat,lon)).sort((a,b)=>(a.etaMinutes??9999)-(b.etaMinutes??9999)||(a.nearestDistanceKm??9999)-(b.nearestDistanceKm??9999));
  const threat=threats[0]||null;
  const available=strikesResult.status==='fulfilled' || threatsResult.status==='fulfilled';
  return {ok:true,available,configured:true,updated:new Date().toISOString(),strikes,nearest:strikes[0]||null,summary:{count:strikes.length,radiusKm:rad,cloudToGround:strikes.filter(s=>s.type==='CG').length,intracloud:strikes.filter(s=>s.type==='IC').length},threat,source:'Xweather · Vaisala lightning',provider:'xweather',fallback:false,error:available?null:'Live bliksemdata tijdelijk niet beschikbaar'};
}
