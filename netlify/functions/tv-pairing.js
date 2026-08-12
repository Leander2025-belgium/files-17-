import { randomInt, randomUUID } from "node:crypto";

const CODE_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 30 * 60 * 1000;
const CONTROLLER_TTL_MS = 2 * 60 * 1000;
const BAD_ATTEMPT_TTL_MS = 10 * 60 * 1000;
const BAD_ATTEMPT_LIMIT = 12;

const store = globalThis.__wheaterflowTvPairingStore || (globalThis.__wheaterflowTvPairingStore = {
  sessions: new Map(),
  codes: new Map(),
  attempts: new Map()
});

function json(event, statusCode, data) {
  const origin = event.headers?.origin || event.headers?.Origin || "";
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": origin || "*",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    },
    body: JSON.stringify(data)
  };
}

function parseBody(event) {
  if (!event.body) return {};
  try {
    return typeof event.body === "string" ? JSON.parse(event.body) : event.body;
  } catch {
    return {};
  }
}

function clientKey(event) {
  const forwarded = event.headers?.["x-forwarded-for"] || event.headers?.["X-Forwarded-For"] || "";
  return String(forwarded).split(",")[0].trim() || "unknown";
}

function cleanup() {
  const now = Date.now();
  for (const [id, session] of store.sessions.entries()) {
    if (now - session.tvLastSeen > SESSION_TTL_MS) {
      store.sessions.delete(id);
      if (session.code) store.codes.delete(session.code);
    }
  }
  for (const [code, sessionId] of store.codes.entries()) {
    const session = store.sessions.get(sessionId);
    if (!session || session.codeExpiresAt <= now) store.codes.delete(code);
  }
  for (const [key, attempt] of store.attempts.entries()) {
    if (attempt.resetAt <= now) store.attempts.delete(key);
  }
}

function createCode(session) {
  let code;
  do {
    code = String(randomInt(100000, 1000000));
  } while (store.codes.has(code));
  if (session.code) store.codes.delete(session.code);
  session.code = code;
  session.codeExpiresAt = Date.now() + CODE_TTL_MS;
  store.codes.set(code, session.id);
  return code;
}

function publicTvSession(session) {
  const now = Date.now();
  return {
    code: session.code,
    expiresAt: session.codeExpiresAt,
    expiresIn: Math.max(0, Math.round((session.codeExpiresAt - now) / 1000)),
    paired: Boolean(session.controllerToken),
    controllerConnected: Boolean(session.controllerToken && now - session.controllerLastSeen < CONTROLLER_TTL_MS),
    pollAfterMs: 1800
  };
}

function sessionByTvToken(tvToken) {
  for (const session of store.sessions.values()) {
    if (session.tvToken === tvToken) return session;
  }
  return null;
}

function sessionByControllerToken(controllerToken) {
  for (const session of store.sessions.values()) {
    if (session.controllerToken === controllerToken) return session;
  }
  return null;
}

function validateLocation(location) {
  const lat = Number(location?.latitude ?? location?.lat);
  const lon = Number(location?.longitude ?? location?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return {
    name: String(location?.name || "Geselecteerde locatie").slice(0, 90),
    admin: String(location?.admin || "").slice(0, 120),
    country: String(location?.country || "").slice(0, 80),
    latitude: lat,
    longitude: lon
  };
}

function addMessage(session, type, data = {}) {
  session.messages.push({
    id: randomUUID(),
    type,
    createdAt: Date.now(),
    ...data
  });
  if (session.messages.length > 20) session.messages.splice(0, session.messages.length - 20);
}

function isRateLimited(key) {
  const now = Date.now();
  const attempt = store.attempts.get(key) || { count: 0, resetAt: now + BAD_ATTEMPT_TTL_MS };
  if (attempt.resetAt <= now) {
    attempt.count = 0;
    attempt.resetAt = now + BAD_ATTEMPT_TTL_MS;
  }
  return attempt.count >= BAD_ATTEMPT_LIMIT;
}

function recordBadAttempt(key) {
  const now = Date.now();
  const attempt = store.attempts.get(key) || { count: 0, resetAt: now + BAD_ATTEMPT_TTL_MS };
  attempt.count += 1;
  store.attempts.set(key, attempt);
}

function createTvSession(event) {
  const session = {
    id: randomUUID(),
    tvToken: randomUUID(),
    controllerToken: null,
    code: null,
    codeExpiresAt: 0,
    createdAt: Date.now(),
    tvLastSeen: Date.now(),
    controllerLastSeen: 0,
    pairedAt: null,
    lastLocation: null,
    messages: []
  };
  createCode(session);
  store.sessions.set(session.id, session);
  return json(event, 200, { ok: true, tvToken: session.tvToken, ...publicTvSession(session) });
}

function tvPoll(event, body) {
  const session = sessionByTvToken(body.tvToken);
  if (!session) return json(event, 404, { ok: false, error: "Deze TV-koppeling is verlopen. Herlaad de TV-pagina." });
  session.tvLastSeen = Date.now();
  if (!session.controllerToken && (!session.code || session.codeExpiresAt <= Date.now())) createCode(session);
  const messages = session.messages.splice(0);
  return json(event, 200, { ok: true, ...publicTvSession(session), messages });
}

function pairController(event, body) {
  const key = clientKey(event);
  if (isRateLimited(key)) {
    return json(event, 429, { ok: false, error: "Te veel pogingen. Wacht even en probeer opnieuw." });
  }

  const code = String(body.code || "").replace(/\D/g, "").slice(0, 6);
  const sessionId = store.codes.get(code);
  const session = sessionId ? store.sessions.get(sessionId) : null;
  if (!session || session.codeExpiresAt <= Date.now()) {
    recordBadAttempt(key);
    return json(event, 404, { ok: false, error: "Code niet gevonden of verlopen." });
  }
  if (session.controllerToken) {
    return json(event, 409, { ok: false, error: "Deze TV is al gekoppeld." });
  }

  session.controllerToken = randomUUID();
  session.controllerLastSeen = Date.now();
  session.pairedAt = Date.now();
  store.codes.delete(session.code);
  session.code = null;
  addMessage(session, "PAIRED");

  return json(event, 200, {
    ok: true,
    controllerToken: session.controllerToken,
    sessionId: session.id,
    tvConnected: Date.now() - session.tvLastSeen < CONTROLLER_TTL_MS
  });
}

function controllerPoll(event, body) {
  const session = sessionByControllerToken(body.controllerToken);
  if (!session) return json(event, 404, { ok: false, error: "TV-koppeling niet actief." });
  session.controllerLastSeen = Date.now();
  return json(event, 200, {
    ok: true,
    tvConnected: Date.now() - session.tvLastSeen < CONTROLLER_TTL_MS,
    lastLocation: session.lastLocation
  });
}

function controllerSetLocation(event, body) {
  const session = sessionByControllerToken(body.controllerToken);
  if (!session) return json(event, 404, { ok: false, error: "TV-koppeling niet actief." });
  const location = validateLocation(body.location);
  if (!location) return json(event, 400, { ok: false, error: "Geen geldige locatie ontvangen." });
  session.controllerLastSeen = Date.now();
  session.lastLocation = location;
  addMessage(session, "SET_LOCATION", { location });
  return json(event, 200, { ok: true, tvConnected: Date.now() - session.tvLastSeen < CONTROLLER_TTL_MS });
}

function controllerRefresh(event, body) {
  const session = sessionByControllerToken(body.controllerToken);
  if (!session) return json(event, 404, { ok: false, error: "TV-koppeling niet actief." });
  session.controllerLastSeen = Date.now();
  addMessage(session, "REFRESH_WEATHER");
  return json(event, 200, { ok: true });
}

function controllerDisconnect(event, body) {
  const session = sessionByControllerToken(body.controllerToken);
  if (!session) return json(event, 200, { ok: true });
  session.controllerToken = null;
  session.controllerLastSeen = 0;
  session.pairedAt = null;
  createCode(session);
  addMessage(session, "CONTROLLER_DISCONNECTED");
  return json(event, 200, { ok: true });
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json(event, 204, {});
  if (event.httpMethod !== "POST") return json(event, 405, { ok: false, error: "Gebruik POST." });

  cleanup();
  const body = parseBody(event);
  switch (body.action) {
    case "create-tv-session": return createTvSession(event);
    case "tv-poll": return tvPoll(event, body);
    case "pair-controller": return pairController(event, body);
    case "controller-poll": return controllerPoll(event, body);
    case "controller-set-location": return controllerSetLocation(event, body);
    case "controller-refresh": return controllerRefresh(event, body);
    case "controller-disconnect": return controllerDisconnect(event, body);
    default: return json(event, 400, { ok: false, error: "Onbekende TV-koppelactie." });
  }
}
