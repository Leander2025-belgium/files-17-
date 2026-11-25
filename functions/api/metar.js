// Cloudflare Pages Function — /api/metar
// Proxy naar aviationweather.gov (die API stuurt zelf geen CORS-headers).

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const ids = (url.searchParams.get("ids") || "EBOS").replace(/[^A-Z0-9,]/gi, "");

  const upstream = await fetch(
    `https://aviationweather.gov/api/data/metar?ids=${encodeURIComponent(ids)}&format=json`,
    { headers: { "User-Agent": "Wheaterflow/1.0" } }
  );

  const headers = new Headers(upstream.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Cache-Control", "no-store");

  return new Response(upstream.body, { status: upstream.status, headers });
}
