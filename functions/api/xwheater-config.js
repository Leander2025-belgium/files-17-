export async function onRequestGet(context) {
  const clientId = context.env.XWEATHER_CLIENT_ID;
  const clientSecret = context.env.XWEATHER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return Response.json({
      configured: false
    }, { status: 200 });
  }

  return Response.json({
    configured: true,
    clientId,
    clientSecret
  }, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
