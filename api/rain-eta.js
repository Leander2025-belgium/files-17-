import { fetchRainETA } from "../server/rain-eta-service.mjs";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const rainETA = await fetchRainETA({
      latitude: req.query?.lat ?? req.query?.latitude,
      longitude: req.query?.lon ?? req.query?.longitude,
      name: String(req.query?.name || "Mijn locatie").slice(0, 80),
      signal: controller.signal
    });
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json(rainETA);
  } catch (error) {
    const status = error instanceof TypeError ? 400 : error?.name === "AbortError" ? 504 : 502;
    return res.status(status).json({
      error: status === 400 ? error.message : "Rain ETA tijdelijk niet beschikbaar"
    });
  } finally {
    clearTimeout(timeout);
  }
}
