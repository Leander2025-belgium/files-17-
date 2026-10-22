const encoder = new TextEncoder();

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

async function signingKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function createSession(secret) {
  const payload = toBase64Url(
    encoder.encode(JSON.stringify({
      exp: Date.now() + 8 * 60 * 60 * 1000,
      nonce: crypto.randomUUID()
    }))
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(secret),
    encoder.encode(payload)
  );

  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifySession(request, secret) {
  if (!secret) return false;

  const cookie = request.headers.get("Cookie") || "";
  const value = cookie.split(";")
    .map(v => v.trim())
    .find(v => v.startsWith("wf_admin_session="))
    ?.slice("wf_admin_session=".length);

  if (!value) return false;

  try {
    const [payload, signature] = value.split(".");
    if (!payload || !signature) return false;

    const valid = await crypto.subtle.verify(
      "HMAC",
      await signingKey(secret),
      fromBase64Url(signature),
      encoder.encode(payload)
    );

    if (!valid) return false;

    const data = JSON.parse(
      new TextDecoder().decode(fromBase64Url(payload))
    );

    return Number.isFinite(data.exp) && data.exp > Date.now();
  } catch {
    return false;
  }
}
