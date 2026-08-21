import { fetchRainETA } from "../../server/rain-eta-service.mjs";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, body: "" };
  if (event.httpMethod !== "GET") return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  const query = event.queryStringParameters || {};
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const rainETA = await fetchRainETA({
      latitude: query.lat ?? query.latitude,
      longitude: query.lon ?? query.longitude,
      name: String(query.name || "Mijn locatie").slice(0, 80),
      signal: controller.signal
    });
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify(rainETA)
    };
  } catch (error) {
    const statusCode = error instanceof TypeError ? 400 : error?.name === "AbortError" ? 504 : 502;
    return {
      statusCode,
      headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: statusCode === 400 ? error.message : "Rain ETA tijdelijk niet beschikbaar" })
    };
  } finally {
    clearTimeout(timeout);
  }
}
