import { json } from "./push-utils.js";

export async function handler() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || "";
  return json(200, {
    vapidPublicKey: publicKey,
    configured: Boolean(publicKey && process.env.VAPID_PRIVATE_KEY)
  });
}
