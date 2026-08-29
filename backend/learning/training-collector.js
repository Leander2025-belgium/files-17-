'use strict';

const { getWeather } = require('../weather-engine');

const LOCATIONS = [
  { name: 'Oostende', latitude: 51.2300, longitude: 2.9200 },
  { name: 'Brugge', latitude: 51.2093, longitude: 3.2247 },
  { name: 'Gent', latitude: 51.0543, longitude: 3.7174 },
  { name: 'Antwerpen', latitude: 51.2194, longitude: 4.4025 },
  { name: 'Brussel', latitude: 50.8503, longitude: 4.3517 },
  { name: 'Hasselt', latitude: 50.9307, longitude: 5.3325 },
  { name: 'Luik', latitude: 50.6326, longitude: 5.5797 },
  { name: 'Namen', latitude: 50.4674, longitude: 4.8718 },
  { name: 'Charleroi', latitude: 50.4108, longitude: 4.4446 },
  { name: 'Aarlen', latitude: 49.6833, longitude: 5.8167 }
];

async function runCollector() {
  const started = Date.now();

  console.log(
    `[WF Training] collector gestart voor ${LOCATIONS.length} locaties`
  );

  let ok = 0;
  let failed = 0;

  for (const location of LOCATIONS) {
    try {
      await getWeather(
        location.latitude,
        location.longitude
      );

      ok++;

      console.log(
        `[WF Training] ✅ ${location.name}`
      );

      // Kleine pauze zodat we Open-Meteo niet onnodig belasten.
      await new Promise(resolve =>
        setTimeout(resolve, 1500)
      );

    } catch (error) {
      failed++;

      console.error(
        `[WF Training] ❌ ${location.name}:`,
        error.message
      );
    }
  }

  const durationMs =
    Date.now() - started;

  console.log(
    `[WF Training] klaar: ok=${ok}, failed=${failed}, durationMs=${durationMs}`
  );

  return {
    ok,
    failed,
    durationMs
  };
}

if (require.main === module) {
  runCollector()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(
        '[WF Training] collector fout:',
        error
      );

      process.exit(1);
    });
}

module.exports = {
  runCollector,
  LOCATIONS
};
