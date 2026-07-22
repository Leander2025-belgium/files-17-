import { createClient } from "@supabase/supabase-js";
import { json, removeSubscriptionsForUser } from "./push-utils.js";

function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("Supabase admin environment ontbreekt.");
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const authorization = event.headers.authorization || event.headers.Authorization || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!token) return json(401, { error: "Niet ingelogd." });

    const body = JSON.parse(event.body || "{}");
    if (body.confirmation !== "VERWIJDEREN") {
      return json(400, { error: "Bevestiging ontbreekt." });
    }

    const supabase = adminClient();
    const { data, error: userError } = await supabase.auth.getUser(token);
    if (userError || !data?.user?.id) return json(401, { error: "Sessie is verlopen." });

    const userId = data.user.id;
    await supabase.from("favorite_locations").delete().eq("user_id", userId);
    await supabase.from("push_subscriptions").delete().eq("user_id", userId);
    await supabase.from("profiles").delete().eq("id", userId);
    await supabase.storage.from("avatars").remove([`${userId}/avatar.webp`]).catch(() => undefined);
    await removeSubscriptionsForUser(userId).catch(() => undefined);

    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    return json(200, { ok: true });
  } catch (error) {
    console.error("delete-account failed", error);
    return json(500, { error: "Account kon niet worden verwijderd. Probeer het later opnieuw." });
  }
}
