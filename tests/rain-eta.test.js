import test from "node:test";
import assert from "node:assert/strict";
import { computeRainETA } from "../server/rain-eta-service.mjs";

const now = new Date("2026-08-17T08:00:00.000Z");

function forecast(precipitation, weatherCode = precipitation.map(() => 0)) {
  const start = now.getTime();
  return {
    latitude: 51.2405,
    longitude: 2.9309,
    timezone: "Europe/Brussels",
    minutely_15: {
      time: precipitation.map((_, index) => Math.floor((start + index * 15 * 60_000) / 1000)),
      precipitation,
      weather_code: weatherCode
    },
    hourly: { weather_code: [0, 0, 0, 0, 0, 0] }
  };
}

test("meldt een droge periode van minstens twee uur", () => {
  const result = computeRainETA(forecast(Array(12).fill(0)), { now, name: "Oostende" });
  assert.equal(result.status, "dry");
  assert.equal(result.dryWindowMinutes, 120);
  assert.equal(result.location.name, "Oostende");
  assert.equal(result.schemaVersion, 1);
});

test("berekent de start en het einde van naderende regen", () => {
  const result = computeRainETA(forecast([0, 0, 0.4, 1.2, 0.5, 0, 0, 0]), { now });
  assert.equal(result.status, "rain_soon");
  assert.equal(result.startsInMinutes, 30);
  assert.equal(result.endsInMinutes, 75);
  assert.equal(result.intensity, "moderate");
  assert.match(result.title, /Regen over/);
});

test("markeert zware regen en onweer", () => {
  const result = computeRainETA(forecast([3.2, 2, 0], [95, 95, 0]), { now });
  assert.equal(result.status, "raining");
  assert.equal(result.heavyShower, true);
  assert.equal(result.thunderPossible, true);
  assert.match(result.summary, /Onweer mogelijk/);
});

test("weigert verouderde korte-termijndata", () => {
  const old = forecast([0.5, 0]);
  old.minutely_15.time = [
    Math.floor(new Date("2026-08-17T04:00:00Z").getTime() / 1000),
    Math.floor(new Date("2026-08-17T04:15:00Z").getTime() / 1000)
  ];
  const result = computeRainETA(old, { now });
  assert.equal(result.status, "unavailable");
  assert.equal(result.source, "Nowcast verouderd");
});
