const ALERTS_KEY = "alerts";

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function cors(response) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function authorized(request, env) {
  const auth = request.headers.get("Authorization") || "";
  return Boolean(env.ADMIN_TOKEN) && auth === `Bearer ${env.ADMIN_TOKEN}`;
}

async function handleAlerts(request, env) {
  if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
  if (!env.ALERTS) return json([], { status: 200, headers: { "Cache-Control": "no-store" } });

  if (request.method === "GET") {
    const all = (await env.ALERTS.get(ALERTS_KEY, { type: "json" })) || [];
    const now = new Date().toISOString();
    let active = all.filter(a => !a.endsAt || a.endsAt > now);
    const url = new URL(request.url);
    const norm = s => (s || "").trim().toLowerCase();
    const land = url.searchParams.get("land");
    const provincie = url.searchParams.get("provincie");
    const stad = url.searchParams.get("stad");
    if (land || provincie || stad) {
      active = active.filter(a => {
        const scope = a.scope || "all";
        if (scope === "all") return true;
        if (scope === "land") return norm(a.scopeValue) === norm(land);
        if (scope === "provincie") return norm(a.scopeValue) === norm(provincie);
        if (scope === "stad") return norm(a.scopeValue) === norm(stad);
        return true;
      });
    }
    return cors(json(active, { headers: { "Cache-Control": "no-store" } }));
  }

  if (request.method === "POST") {
    if (!authorized(request, env)) return cors(new Response("Unauthorized", { status: 401 }));
    let body;
    try { body = await request.json(); } catch { return cors(new Response("Ongeldige JSON", { status: 400 })); }
    if (!body.title || !body.message) return cors(new Response("title en message zijn verplicht", { status: 400 }));
    const validScopes = ["all", "land", "provincie", "stad"];
    const scope = validScopes.includes(body.scope) ? body.scope : "all";
    const scopeValue = scope === "all" ? null : (body.scopeValue || "").trim();
    if (scope !== "all" && !scopeValue) return cors(new Response("scopeValue is verplicht", { status: 400 }));
    const alerts = (await env.ALERTS.get(ALERTS_KEY, { type: "json" })) || [];
    const item = {
      id: crypto.randomUUID(),
      type: ["info", "warning", "danger"].includes(body.type) ? body.type : "info",
      title: body.title,
      message: body.message,
      scope,
      scopeValue,
      startsAt: body.startsAt || new Date().toISOString(),
      endsAt: body.endsAt || null,
      createdAt: new Date().toISOString()
    };
    alerts.unshift(item);
    await env.ALERTS.put(ALERTS_KEY, JSON.stringify(alerts));
    return cors(json(item, { status: 201 }));
  }

  if (request.method === "DELETE") {
    if (!authorized(request, env)) return cors(new Response("Unauthorized", { status: 401 }));
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return cors(new Response("id ontbreekt", { status: 400 }));
    let alerts = (await env.ALERTS.get(ALERTS_KEY, { type: "json" })) || [];
    alerts = alerts.filter(a => a.id !== id);
    await env.ALERTS.put(ALERTS_KEY, JSON.stringify(alerts));
    return cors(new Response(null, { status: 204 }));
  }

  return new Response("Method Not Allowed", { status: 405 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/xweather-config") {
      const clientId = env.XWEATHER_CLIENT_ID;
      const clientSecret = env.XWEATHER_CLIENT_SECRET;
      return json(
        clientId && clientSecret
          ? { configured: true, clientId, clientSecret }
          : { configured: false, reason: "missing_credentials" },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    if (url.pathname === "/api/metar") {
      const ids = (url.searchParams.get("ids") || "EBOS").replace(/[^A-Z0-9,]/gi, "");
      const upstream = await fetch(`https://aviationweather.gov/api/data/metar?ids=${encodeURIComponent(ids)}&format=json`, {
        headers: { "User-Agent": "Wheaterflow/1.0" }
      });
      const headers = new Headers(upstream.headers);
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set("Cache-Control", "no-store");
      return new Response(upstream.body, { status: upstream.status, headers });
    }

    if (url.pathname === "/api/alerts") return handleAlerts(request, env);

    return env.ASSETS.fetch(request);
  }
};
