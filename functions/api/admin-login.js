import { verifyPassword } from "../_lib/admin-password.js";
import { createSession, verifySession } from "../_lib/admin-session.js";

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers
    }
  });

function sameOrigin(request) {
  const origin = request.headers.get("Origin");
  return origin === new URL(request.url).origin;
}

export async function onRequestGet({ request, env }) {
  const authenticated = await verifySession(
    request,
    env.ADMIN_SESSION_SECRET
  );

  return json({ authenticated });
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) {
    return json({ error: "Ongeldige herkomst" }, 403);
  }

  if (!env.ADMIN_PASSWORD_HASH || !env.ADMIN_SESSION_SECRET) {
    return json({ error: "Login niet geconfigureerd" }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Ongeldige aanvraag" }, 400);
  }

  const password = body?.password;

  if (typeof password !== "string" || password.length > 1024) {
    return json({ error: "Ongeldige aanmelding" }, 401);
  }

  const store = env.WHEATERFLOW_ADMIN_SECURITY;
  if (!store) {
    return json({ error: "Loginbeveiliging niet geconfigureerd" }, 503);
  }

  const ip = request.headers.get("CF-Connecting-IP");
  if (!ip) {
    return json({ error: "IP-controle niet beschikbaar" }, 503);
  }

  const key = "login:" + ip;
  const attempts = Number(await store.get(key) || 0);

  if (attempts >= 5) {
    return json({ error: "Te veel pogingen. Probeer later opnieuw." }, 429);
  }

  const valid = await verifyPassword(
    password,
    env.ADMIN_PASSWORD_HASH
  );

  if (!valid) {
    await store.put(key, String(attempts + 1), {
      expirationTtl: 900
    });
    return json({ error: "Ongeldig wachtwoord" }, 401);
  }

  await store.delete(key);

  const session = await createSession(env.ADMIN_SESSION_SECRET);

  return json(
    { ok: true },
    200,
    {
      "Set-Cookie":
        `wf_admin_session=${session}; HttpOnly; Secure; ` +
        `SameSite=Strict; Path=/api; Max-Age=28800`
    }
  );
}

export async function onRequestDelete({ request }) {
  if (!sameOrigin(request)) {
    return json({ error: "Ongeldige herkomst" }, 403);
  }

  return json(
    { ok: true },
    200,
    {
      "Set-Cookie":
        "wf_admin_session=; HttpOnly; Secure; " +
        "SameSite=Strict; Path=/api; Max-Age=0"
    }
  );
}
