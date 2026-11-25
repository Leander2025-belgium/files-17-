// Cloudflare Pages Function — /api/xweather-conditions
// Xweather-observaties; de credentials blijven server-side.

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return json({ success: false, error: "invalid_coordinates" }, { status: 400 });
  }

  const id = env.XWEATHER_CLIENT_ID;
  const secret = env.XWEATHER_CLIENT_SECRET;
  if (!id || !secret) {
    return json({ success: false, error: "missing_credentials" }, { status: 503 });
  }

  try {
    const endpoint = new URL(`https://api.aerisapi.com/observations/${lat.toFixed(4)},${lon.toFixed(4)}`);
    endpoint.searchParams.set("client_id", id);
    endpoint.searchParams.set("client_secret", secret);
    endpoint.searchParams.set("limit", "1");

    const upstream = await fetch(endpoint.toString(), { headers: { Accept: "application/json" } });
    if (!upstream.ok) return json({ success: false, error: "upstream_" + upstream.status }, { status: 502 });

    const data = await upstream.json();
    const obs = data?.response?.ob;
    if (!data?.success || !obs) return json({ success: false, error: "no_observation" }, { status: 502 });

    return json({
      success: true,
      observation: {
        tempC: obs.tempC,
        windSpeedKPH: obs.windSpeedKPH,
        windGustKPH: obs.windGustKPH,
        windDirDEG: obs.windDirDEG,
        cloudCover: obs.cloudCover ?? null
      },
      source: "Xweather Conditions"
    }, { headers: { "Cache-Control": "public, max-age=180" } });
  } catch {
    return json({ success: false, error: "xweather_unavailable" }, { status: 502 });
  }
}
