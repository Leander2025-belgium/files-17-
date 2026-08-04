// Cloudflare Pages Function — /api/alerts
// Vereist: KV-namespace gebonden als "ALERTS" in de Pages instellingen
// Vereist: environment variable/secret "ADMIN_TOKEN" (jouw eigen wachtwoord/token)

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

// Publiek: geeft alle actieve meldingen terug (verlopen meldingen worden eruit gefilterd)
export async function onRequestGet(context) {
  const { env } = context;
  const all = (await env.ALERTS.get(KV_KEY, { type: "json" })) || [];
  const now = new Date().toISOString();
  const active = all.filter(a => !a.endsAt || a.endsAt > now);
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

  const alerts = (await env.ALERTS.get(KV_KEY, { type: "json" })) || [];
  const newAlert = {
    id: crypto.randomUUID(),
    type: ["info", "warning", "danger"].includes(body.type) ? body.type : "info",
    title: body.title,
    message: body.message,
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
