// Cloudflare Pages Function — /api/xweather-config
//
// MapsGL draait in de browser en heeft daarom een client id + secret nodig.
// Gebruik hiervoor een APARTE Xweather-applicatie met namespace
// "wheaterflow.be,*.wheaterflow.be" (zie README):
//   XWEATHER_MAPS_CLIENT_ID / XWEATHER_MAPS_CLIENT_SECRET  -> publiek, domein-beperkt
//   XWEATHER_CLIENT_ID / XWEATHER_CLIENT_SECRET            -> alleen server-side
// Zolang de MAPS-sleutels ontbreken, valt dit terug op de serversleutels.

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Vary": "Origin, Referer"
    }
  });
}

function hostOf(value) {
  try { return new URL(value).hostname; } catch { return ""; }
}

// Alleen de eigen site (en lokaal ontwikkelen) krijgt de sleutels.
function requestFromOwnSite(request) {
  const ownHost = new URL(request.url).hostname;
  const callerHost = hostOf(request.headers.get("Origin")) || hostOf(request.headers.get("Referer"));
  if (!callerHost) return false;
  return callerHost === ownHost || callerHost === "localhost" || callerHost === "127.0.0.1";
}

export async function onRequestGet({ request, env }) {
  if (!requestFromOwnSite(request)) {
    return json({ configured: false, error: "forbidden" }, 403);
  }

  const clientId = env.XWEATHER_MAPS_CLIENT_ID || env.XWEATHER_CLIENT_ID || "";
  const clientSecret = env.XWEATHER_MAPS_CLIENT_SECRET || env.XWEATHER_CLIENT_SECRET || "";

  if (!clientId || !clientSecret) {
    return json({ configured: false });
  }

  return json({ configured: true, clientId, clientSecret });
}
