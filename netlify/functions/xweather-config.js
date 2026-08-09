export async function handler(){
  let clientId = process.env.XWEATHER_CLIENT_ID || '';
  let clientSecret = process.env.XWEATHER_CLIENT_SECRET || '';
  const combined = process.env.XWEATHER_API_KEY || process.env.XWEATHER_KEY || '';
  if((!clientId || !clientSecret) && combined.includes('_')){
    const parts = combined.split('_');
    clientId = clientId || parts[0] || '';
    clientSecret = clientSecret || parts.slice(1).join('_') || '';
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify({
      configured: Boolean(clientId && clientSecret),
      clientId: clientId || null,
      clientSecret: clientSecret || null
    })
  };
}
