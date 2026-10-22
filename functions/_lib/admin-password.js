const encoder = new TextEncoder();

function decodeBase64(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

export async function verifyPassword(password, storedHash) {
  if (typeof password !== "string" || !storedHash) return false;

  const parts = storedHash.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;

  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) ||
      iterations < 100000 || iterations > 1000000) return false;

  try {
    const salt = decodeBase64(parts[2]);
    const expected = decodeBase64(parts[3]);

    if (salt.length < 16 || expected.length !== 32) return false;

    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );

    const derived = new Uint8Array(await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt,
        iterations
      },
      key,
      256
    ));

    let difference = 0;
    for (let i = 0; i < 32; i++) {
      difference |= derived[i] ^ expected[i];
    }

    return difference === 0;
  } catch {
    return false;
  }
}
