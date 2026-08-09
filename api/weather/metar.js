const CACHE_SECONDS = 180;

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const ids = String(req.query?.ids || "").replace(/[^A-Z0-9,]/gi, "").toUpperCase();
  if (!ids) {
    res.status(400).json({ error: "ids ontbreekt" });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const upstream = new URL("https://aviationweather.gov/api/data/metar");
    upstream.searchParams.set("ids", ids);
    upstream.searchParams.set("format", "json");
    const response = await fetch(upstream.href, {
      signal: controller.signal,
      headers: { accept: "application/json" }
    });
    const text = await response.text();
    res.setHeader("Cache-Control", `s-maxage=${CACHE_SECONDS}, stale-while-revalidate=300`);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    if (!response.ok) {
      res.status(response.status).send(JSON.stringify({ error: "METAR upstream niet beschikbaar" }));
      return;
    }
    res.status(200).send(text || "[]");
  } catch (error) {
    console.warn("METAR proxy failed:", error.message);
    res.status(504).json({ error: "METAR tijdelijk niet beschikbaar" });
  } finally {
    clearTimeout(timeout);
  }
}
