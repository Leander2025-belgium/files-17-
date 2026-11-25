export async function onRequestGet(context) {
  let clientId = context.env.XWEATHER_CLIENT_ID || "";
  let clientSecret = context.env.XWEATHER_CLIENT_SECRET || "";
  const combined = context.env.XWEATHER_API_KEY || context.env.XWEATHER_KEY || "";
  if ((!clientId || !clientSecret) && combined.includes("_")) {
    const parts = combined.split("_");
    clientId = clientId || parts[0] || "";
    clientSecret = clientSecret || parts.slice(1).join("_") || "";
  }

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
