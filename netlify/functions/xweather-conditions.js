export async function handler(event){
 const lat=Number(event.queryStringParameters?.lat),lon=Number(event.queryStringParameters?.lon);
 const respond=(code,body)=>({statusCode:code,headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=180'},body:JSON.stringify(body)});
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return respond(400,{success:false,error:'invalid_coordinates'});
 const id=process.env.XWEATHER_CLIENT_ID,secret=process.env.XWEATHER_CLIENT_SECRET;
 if(!id||!secret)return respond(503,{success:false,error:'missing_credentials'});
 try{const u=new URL(`https://api.aerisapi.com/observations/${lat.toFixed(4)},${lon.toFixed(4)}`);u.searchParams.set('client_id',id);u.searchParams.set('client_secret',secret);u.searchParams.set('limit','1');
 const r=await fetch(u);if(!r.ok)return respond(502,{success:false,error:'upstream_'+r.status});const d=await r.json(),o=d?.response?.ob;
 if(!d?.success||!o)return respond(502,{success:false,error:'no_observation'});
 return respond(200,{success:true,source:'Xweather Conditions',observation:{tempC:o.tempC,windSpeedKPH:o.windSpeedKPH,windGustKPH:o.windGustKPH,windDirDEG:o.windDirDEG,cloudCover:o.cloudCover??null}});
 }catch(e){return respond(502,{success:false,error:'xweather_unavailable'});}
}
