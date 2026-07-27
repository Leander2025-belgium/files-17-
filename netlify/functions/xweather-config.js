export async function handler(){
  const clientId = process.env.XWEATHER_CLIENT_ID || '';
  const clientSecret = process.env.XWEATHER_CLIENT_SECRET || '';

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
