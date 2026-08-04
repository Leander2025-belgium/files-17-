// Cloudflare Pages Function — /api/alerts
// Vereist: KV-namespace gebonden als "ALERTS"
// Vereist: environment variable/secret "ADMIN_TOKEN"

const KV_KEY = "alerts";

function cors(resp) {
  resp.headers.set("Access-Control-Allow-Origin", "*");
  resp.headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  resp.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return resp;
}

function isAuthorized(request, env) {
  const auth = request.headers.get("Authorization") || "";
  return auth === `Bearer ${env.ADMIN_TOKEN}`;
}

export async function onRequestOptions() {
  return cors(new Response(null, { status: 204 }));
}

// Publiek: geeft alle actieve meldingen terug
// Optioneel filterbaar via query params: ?land=...&provincie=...&stad=...
export async function onRequestGet(context) {
  const { env, request } = context;
  const all = (await env.ALERTS.get(KV_KEY, { type: "json" })) || [];
  const now = new Date().toISOString();
  let active = all.filter(a => !a.endsAt || a.endsAt > now);

  const url = new URL(request.url);
  const land = url.searchParams.get("land");
  const provincie = url.searchParams.get("provincie");
  const stad = url.searchParams.get("stad");

  if (land || provincie || stad) {
    const norm = s => (s || "").trim().toLowerCase();
    active = active.filter(a => {
      const scope = a.scope || "all";
      if (scope === "all") return true;
      if (scope === "land") return norm(a.scopeValue) === norm(land);
      if (scope === "provincie") return norm(a.scopeValue) === norm(provincie);
      if (scope === "stad") return norm(a.scopeValue) === norm(stad);
      return true;
    });
  }

  return cors(
    new Response(JSON.stringify(active), {
      headers: { "Content-Type": "application/json" },
    })
  );
}

// Beheer: nieuwe melding toevoegen (auth vereist)
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!isAuthorized(request, env)) {
    return cors(new Response("Unauthorized", { status: 401 }));
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return cors(new Response("Ongeldige JSON", { status: 400 }));
  }

  if (!body.title || !body.message) {
    return cors(new Response("title en message zijn verplicht", { status: 400 }));
  }

  const validScopes = ["all", "land", "provincie", "stad"];
  const scope = validScopes.includes(body.scope) ? body.scope : "all";
  const scopeValue = scope === "all" ? null : (body.scopeValue || "").trim();

  if (scope !== "all" && !scopeValue) {
    return cors(new Response("scopeValue is verplicht als scope niet 'all' is", { status: 400 }));
  }

  const alerts = (await env.ALERTS.get(KV_KEY, { type: "json" })) || [];
  const newAlert = {
    id: crypto.randomUUID(),
    type: ["info", "warning", "danger"].includes(body.type) ? body.type : "info",
    title: body.title,
    message: body.message,
    scope,
    scopeValue,
    startsAt: body.startsAt || new Date().toISOString(),
    endsAt: body.endsAt || null,
    createdAt: new Date().toISOString(),
  };

  alerts.unshift(newAlert);
  await env.ALERTS.put(KV_KEY, JSON.stringify(alerts));

  return cors(
    new Response(JSON.stringify(newAlert), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    })
  );
}

// Beheer: melding verwijderen via ?id=... (auth vereist)
export async function onRequestDelete(context) {
  const { request, env } = context;
  if (!isAuthorized(request, env)) {
    return cors(new Response("Unauthorized", { status: 401 }));
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return cors(new Response("id ontbreekt", { status: 400 }));

  let alerts = (await env.ALERTS.get(KV_KEY, { type: "json" })) || [];
  alerts = alerts.filter(a => a.id !== id);
  await env.ALERTS.put(KV_KEY, JSON.stringify(alerts));

  return cors(new Response(null, { status: 204 }));
}
