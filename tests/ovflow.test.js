import test from "node:test";
import assert from "node:assert/strict";
import { decodePolyline, encodePolyline, detectOperator, vehiclePosition, pointAlong, delayMin, modeGroup, duration, lineColors } from "../ovflow/js/util.js";
import { validateTarget } from "../server/ov-proxy.mjs";

test("polyline encode/decode round-trip (precisie 5, 6 en 7)", () => {
  const pts = [[50.8466, 4.3528], [51.0536, 3.7304], [50.6326, 5.5797]];
  for (const p of [5, 6, 7]) {
    const out = decodePolyline(encodePolyline(pts, p), p);
    out.forEach((x, i) => { assert.ok(Math.abs(x[0] - pts[i][0]) < 1e-4); assert.ok(Math.abs(x[1] - pts[i][1]) < 1e-4); });
  }
  assert.deepEqual(decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@"), [[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]]);
});

test("vervoerder herkennen uit Transitous-ID's en namen", () => {
  assert.equal(detectOperator("20261120_08:00_be-delijn_123").id, "delijn");
  assert.equal(detectOperator("be-tec_X123").id, "tec");
  assert.equal(detectOperator("be-stib_8012").id, "mivb");
  assert.equal(detectOperator("be-sncb_8814001").id, "nmbs");
  assert.equal(detectOperator(null, "SNCB").id, "nmbs");
  assert.equal(detectOperator(null, "De Lijn").id, "delijn");
  assert.equal(detectOperator("something-else").id, "other");
  assert.equal(detectOperator("protected-stop").id, "other");
});

test("voertuigpositie interpoleert tussen haltes", () => {
  const t0 = Date.UTC(2026, 10, 20, 8, 0);
  const stops = [
    { lat: 50, lon: 4, arr: t0, dep: t0 },
    { lat: 51, lon: 4, arr: t0 + 10 * 60000, dep: t0 + 11 * 60000 },
    { lat: 52, lon: 4, arr: t0 + 21 * 60000, dep: t0 + 21 * 60000 }
  ];
  assert.equal(vehiclePosition(stops, null, t0 - 1000).state, "before");
  const mid = vehiclePosition(stops, null, t0 + 5 * 60000);
  assert.equal(mid.state, "running");
  assert.ok(Math.abs(mid.pos[0] - 50.5) < 0.01);
  assert.equal(vehiclePosition(stops, null, t0 + 10.5 * 60000).state, "at-stop");
  assert.equal(vehiclePosition(stops, null, t0 + 30 * 60000).state, "after");
});

test("pointAlong en hulpfuncties", () => {
  const p = pointAlong([[0, 0], [0, 1], [0, 2]], 0.75);
  assert.ok(Math.abs(p.pos[1] - 1.5) < 1e-6);
  assert.equal(delayMin("2026-11-20T08:05:00Z", "2026-11-20T08:00:00Z"), 5);
  assert.equal(modeGroup("REGIONAL_RAIL"), "train");
  assert.equal(modeGroup("SUBWAY"), "metro");
  assert.equal(modeGroup("BUS"), "bus");
  assert.equal(duration(65 * 60), "1 u 05");
  assert.equal(lineColors({ routeColor: "FFD400" }).fg, "#111");
});

test("proxy staat alleen Transitous en iRail toe", () => {
  assert.ok(validateTarget("https://api.transitous.org/api/v1/geocode?text=Gent"));
  assert.ok(validateTarget("https://api.irail.be/liveboard/?id=x"));
  assert.equal(validateTarget("http://api.irail.be/x"), null);
  assert.equal(validateTarget("https://evil.example.com/"), null);
  assert.equal(validateTarget("https://api.irail.be.evil.com/"), null);
  assert.equal(validateTarget("https://api.irail.be:8443/"), null);
  assert.equal(validateTarget("not a url"), null);
});
