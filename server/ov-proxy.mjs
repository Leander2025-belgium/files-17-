// OVFlow – kleine, beperkte proxy voor de publieke OV-API's.
// Alleen GET-verzoeken naar een vaste lijst hosts zijn toegestaan.

export const ALLOWED_HOSTS = new Set(["api.transitous.org", "api.irail.be"]);
const USER_AGENT = "OVFlow/1.0 (open source OV-app voor Belgie)";

export function validateTarget(raw) {
  let url;
  try { url = new URL(String(raw || "")); } catch { return null; }
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname) || url.port) return null;
  return url;
}

function cacheSeconds(url) {
  const p = url.pathname;
  if (p.includes("/stations") || p.includes("geocode")) return 3600;
  if (p.includes("/map/stops")) return 600;
  return 15;
}

/** Voert de upstream-aanvraag uit. Geeft { status, headers, body }. */
export async function proxyRequest(raw, { timeoutMs = 25_000 } = {}) {
  const base = { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*", "X-OVFlow-Proxy": "1" };
  const url = validateTarget(raw);
  if (!url) return { status: 400, headers: base, body: JSON.stringify({ error: "Ongeldige of niet-toegestane URL" }) };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const upstream = await fetch(url.toString(), {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: controller.signal
    });
    const body = await upstream.text();
    return {
      status: upstream.status,
      headers: { ...base, "Cache-Control": upstream.ok ? `public, max-age=${Math.min(60, cacheSeconds(url))}, s-maxage=${cacheSeconds(url)}` : "no-store" },
      body
    };
  } catch (error) {
    const timeout = error?.name === "AbortError";
    return { status: timeout ? 504 : 502, headers: base, body: JSON.stringify({ error: timeout ? "Time-out bij OV-server" : "OV-server niet bereikbaar" }) };
  } finally {
    clearTimeout(timer);
  }
}
