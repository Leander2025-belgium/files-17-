import http from "node:http";
import { randomInt, randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const CODE_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 30 * 60 * 1000;
const CONTROLLER_TTL_MS = 2 * 60 * 1000;
const BAD_ATTEMPT_TTL_MS = 10 * 60 * 1000;
const BAD_ATTEMPT_LIMIT = 12;
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || "https://wheaterflow.be,https://www.wheaterflow.be,http://localhost:5500,http://127.0.0.1:5500,http://localhost:5505,http://127.0.0.1:5505")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean)
);

const sessions = new Map();
const codes = new Map();
const attempts = new Map();

function send(ws, data) {
  if (ws?.readyState === ws.OPEN) ws.send(JSON.stringify(data));
}

function reply(ws, message, status) {
  send(ws, { replyTo: message.id, ...status });
}

function cleanup() {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.tvLastSeen > SESSION_TTL_MS) {
      sessions.delete(id);
      if (session.code) codes.delete(session.code);
    }
  }
  for (const [code, sessionId] of codes.entries()) {
    const session = sessions.get(sessionId);
    if (!session || session.codeExpiresAt <= now) codes.delete(code);
  }
  for (const [key, attempt] of attempts.entries()) {
    if (attempt.resetAt <= now) attempts.delete(key);
  }
}

function createCode(session) {
  let code;
  do {
    code = String(randomInt(100000, 1000000));
  } while (codes.has(code));
  if (session.code) codes.delete(session.code);
  session.code = code;
  session.codeExpiresAt = Date.now() + CODE_TTL_MS;
  codes.set(code, session.id);
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
  for (const session of sessions.values()) {
    if (session.tvToken === tvToken) return session;
  }
  return null;
}

function sessionByControllerToken(controllerToken) {
  for (const session of sessions.values()) {
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

function clientKey(request) {
  const forwarded = request.headers["x-forwarded-for"] || "";
  return String(forwarded).split(",")[0].trim() || request.socket.remoteAddress || "unknown";
}

function isRateLimited(key) {
  const now = Date.now();
  const attempt = attempts.get(key) || { count: 0, resetAt: now + BAD_ATTEMPT_TTL_MS };
  if (attempt.resetAt <= now) {
    attempt.count = 0;
    attempt.resetAt = now + BAD_ATTEMPT_TTL_MS;
  }
  return attempt.count >= BAD_ATTEMPT_LIMIT;
}

function recordBadAttempt(key) {
  const now = Date.now();
  const attempt = attempts.get(key) || { count: 0, resetAt: now + BAD_ATTEMPT_TTL_MS };
  attempt.count += 1;
  attempts.set(key, attempt);
}

function handleMessage(ws, request, raw) {
  cleanup();
  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    return send(ws, { ok: false, error: "Ongeldig bericht." });
  }

  if (message.action === "create-tv-session") {
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
      tvSocket: ws,
      controllerSocket: null
    };
    createCode(session);
    sessions.set(session.id, session);
    return reply(ws, message, { ok: true, tvToken: session.tvToken, ...publicTvSession(session) });
  }

  if (message.action === "tv-poll") {
    const session = sessionByTvToken(message.tvToken);
    if (!session) return reply(ws, message, { ok: false, error: "Deze TV-koppeling is verlopen. Herlaad de TV-pagina." });
    session.tvSocket = ws;
    session.tvLastSeen = Date.now();
    if (!session.controllerToken && (!session.code || session.codeExpiresAt <= Date.now())) createCode(session);
    return reply(ws, message, { ok: true, ...publicTvSession(session) });
  }

  if (message.action === "pair-controller") {
    const key = clientKey(request);
    if (isRateLimited(key)) return reply(ws, message, { ok: false, error: "Te veel pogingen. Wacht even en probeer opnieuw." });
    const code = String(message.code || "").replace(/\D/g, "").slice(0, 6);
    const sessionId = codes.get(code);
    const session = sessionId ? sessions.get(sessionId) : null;
    if (!session || session.codeExpiresAt <= Date.now()) {
      recordBadAttempt(key);
      return reply(ws, message, { ok: false, error: "Code niet gevonden of verlopen." });
    }
    if (session.controllerToken) return reply(ws, message, { ok: false, error: "Deze TV is al gekoppeld." });
    session.controllerToken = randomUUID();
    session.controllerSocket = ws;
    session.controllerLastSeen = Date.now();
    session.pairedAt = Date.now();
    codes.delete(session.code);
    session.code = null;
    send(session.tvSocket, { type: "PAIRED", ...publicTvSession(session) });
    return reply(ws, message, {
      ok: true,
      controllerToken: session.controllerToken,
      sessionId: session.id,
      tvConnected: Date.now() - session.tvLastSeen < CONTROLLER_TTL_MS
    });
  }

  if (message.action === "controller-poll") {
    const session = sessionByControllerToken(message.controllerToken);
    if (!session) return reply(ws, message, { ok: false, error: "TV-koppeling niet actief." });
    session.controllerSocket = ws;
    session.controllerLastSeen = Date.now();
    return reply(ws, message, {
      ok: true,
      tvConnected: Date.now() - session.tvLastSeen < CONTROLLER_TTL_MS,
      lastLocation: session.lastLocation
    });
  }

  if (message.action === "controller-set-location") {
    const session = sessionByControllerToken(message.controllerToken);
    if (!session) return reply(ws, message, { ok: false, error: "TV-koppeling niet actief." });
    const location = validateLocation(message.location);
    if (!location) return reply(ws, message, { ok: false, error: "Geen geldige locatie ontvangen." });
    session.controllerSocket = ws;
    session.controllerLastSeen = Date.now();
    session.lastLocation = location;
    send(session.tvSocket, { type: "SET_LOCATION", location, createdAt: Date.now() });
    return reply(ws, message, { ok: true, tvConnected: Date.now() - session.tvLastSeen < CONTROLLER_TTL_MS });
  }

  if (message.action === "controller-refresh") {
    const session = sessionByControllerToken(message.controllerToken);
    if (!session) return reply(ws, message, { ok: false, error: "TV-koppeling niet actief." });
    session.controllerSocket = ws;
    session.controllerLastSeen = Date.now();
    send(session.tvSocket, { type: "REFRESH_WEATHER", createdAt: Date.now() });
    return reply(ws, message, { ok: true });
  }

  if (message.action === "controller-disconnect") {
    const session = sessionByControllerToken(message.controllerToken);
    if (session) {
      session.controllerToken = null;
      session.controllerSocket = null;
      session.controllerLastSeen = 0;
      session.pairedAt = null;
      createCode(session);
      send(session.tvSocket, { type: "CONTROLLER_DISCONNECTED", ...publicTvSession(session) });
    }
    return reply(ws, message, { ok: true });
  }

  reply(ws, message, { ok: false, error: "Onbekende TV-koppelactie." });
}

const server = http.createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ ok: true, service: "wheaterflow-tv-pairing", sessions: sessions.size }));
    return;
  }
  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not found");
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const origin = request.headers.origin || "";
  const pathname = new URL(request.url, "http://localhost").pathname;
  if (pathname !== "/tv-pairing" || (origin && !ALLOWED_ORIGINS.has(origin))) {
    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
    socket.destroy();
    return;
  }
  wss.handleUpgrade(request, socket, head, ws => {
    ws.on("message", raw => handleMessage(ws, request, raw));
    ws.on("close", () => {
      for (const session of sessions.values()) {
        if (session.tvSocket === ws) session.tvSocket = null;
        if (session.controllerSocket === ws) session.controllerSocket = null;
      }
    });
    send(ws, { type: "READY", service: "wheaterflow-tv-pairing" });
  });
});

setInterval(cleanup, 60 * 1000).unref();
server.listen(PORT, HOST, () => {
  console.log(`Wheaterflow TV pairing websocket draait op ${HOST}:${PORT}`);
});
