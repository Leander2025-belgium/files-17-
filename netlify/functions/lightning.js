import { fetchLightning } from '../../server/lightning-service.mjs';
export async function handler(event){
  if(event.httpMethod === 'OPTIONS') return {statusCode:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,OPTIONS'}};
  if(event.httpMethod !== 'GET') return {statusCode:405,body:JSON.stringify({ok:false,error:'Method not allowed'})};
  const q=event.queryStringParameters||{};
  const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),8000);
  try{
    const data=await fetchLightning({latitude:q.lat??q.latitude,longitude:q.lon??q.longitude,radius:q.radius,signal:controller.signal});
    return {statusCode:200,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=30, s-maxage=60, stale-while-revalidate=120','Access-Control-Allow-Origin':'*'},body:JSON.stringify(data)};
  }catch(error){
    const status=error instanceof TypeError?400:error?.name==='AbortError'?504:502;
    return {statusCode:status,headers:{'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*'},body:JSON.stringify({ok:false,available:false,error:status===400?error.message:'Live bliksemdata tijdelijk niet beschikbaar'})};
  }finally{clearTimeout(timeout);}
}
