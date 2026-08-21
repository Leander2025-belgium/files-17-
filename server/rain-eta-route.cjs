// Mount in the existing api.wheaterflow.be Express app with:
// app.get('/api/rain-eta', require('./rain-eta-route.cjs'));
module.exports = async function rainETARoute(req, res) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const { fetchRainETA } = await import("./rain-eta-service.mjs");
    const rainETA = await fetchRainETA({
      latitude: req.query?.lat ?? req.query?.latitude,
      longitude: req.query?.lon ?? req.query?.longitude,
      name: String(req.query?.name || "Mijn locatie").slice(0, 80),
      signal: controller.signal
    });
    res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    res.json(rainETA);
  } catch (error) {
    const status = error instanceof TypeError ? 400 : error?.name === "AbortError" ? 504 : 502;
    res.status(status).json({ error: status === 400 ? error.message : "Rain ETA tijdelijk niet beschikbaar" });
  } finally {
    clearTimeout(timeout);
  }
};
