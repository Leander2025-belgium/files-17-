'use strict';

const { runVerification } = require('./forecast-verifier');

const INTERVAL_MS =
  Number(process.env.WHEATERFLOW_LEARNING_INTERVAL_MS) ||
  60 * 60 * 1000;

const START_DELAY_MS =
  Number(process.env.WHEATERFLOW_LEARNING_START_DELAY_MS) ||
  90 * 1000;

const VERIFY_LIMIT =
  Number(process.env.WHEATERFLOW_LEARNING_VERIFY_LIMIT) ||
  250;

let running = false;

async function runLearning() {
  if (running) {
    console.log('[WF Learning] vorige run is nog bezig, overslaan');
    return;
  }

  running = true;

  const started = Date.now();

  try {
    console.log(
      `[WF Learning] verificatie gestart, limit=${VERIFY_LIMIT}`
    );

    const result =
      await runVerification(VERIFY_LIMIT);

    console.log(
      '[WF Learning] klaar:',
      JSON.stringify({
        ...result,
        durationMs: Date.now() - started
      })
    );

  } catch (error) {
    console.error(
      '[WF Learning] run mislukt:',
      error?.stack || error?.message || error
    );
  } finally {
    running = false;
  }
}

console.log(
  `[WF Learning] worker actief; interval=${Math.round(INTERVAL_MS / 60000)} min`
);

setTimeout(() => {
  runLearning().catch(() => {});

  setInterval(() => {
    runLearning().catch(() => {});
  }, INTERVAL_MS);

}, START_DELAY_MS);

process.on('SIGTERM', () => {
  console.log('[WF Learning] SIGTERM ontvangen');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[WF Learning] SIGINT ontvangen');
  process.exit(0);
});
