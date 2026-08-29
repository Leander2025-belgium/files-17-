"use strict";

const fs = require("fs");
const path = require("path");

const CACHE_DIR =
  process.env.WF_RADAR_CACHE ||
  "/srv/wheaterflow/radar/cache";

const FRAME_DIR =
  path.join(CACHE_DIR, "frames");

const STATE_FILE =
  path.join(CACHE_DIR, "state.json");

function ensureDirs() {
  fs.mkdirSync(FRAME_DIR, {
    recursive: true
  });
}

function readState() {
  ensureDirs();

  try {
    return JSON.parse(
      fs.readFileSync(
        STATE_FILE,
        "utf8"
      )
    );
  } catch {
    return {
      source: null,
      status: "initializing",
      latestFrame: null,
      latestTimestamp: null,
      updatedAt: null,
      error: null
    };
  }
}

function writeState(update) {
  ensureDirs();

  const current =
    readState();

  const state = {
    ...current,
    ...update,
    updatedAt:
      new Date().toISOString()
  };

  fs.writeFileSync(
    STATE_FILE,
    JSON.stringify(
      state,
      null,
      2
    )
  );

  return state;
}

function getStatus() {
  const state =
    readState();

  let ageSeconds = null;

  if (state.latestTimestamp) {
    ageSeconds =
      Math.max(
        0,
        Math.round(
          (
            Date.now() -
            new Date(
              state.latestTimestamp
            ).getTime()
          ) / 1000
        )
      );
  }

  return {
    ok:
      state.status === "ready",

    source:
      state.source,

    status:
      state.status,

    latestFrame:
      state.latestFrame,

    latestTimestamp:
      state.latestTimestamp,

    ageSeconds,

    stale:
      ageSeconds !== null
        ? ageSeconds > 900
        : true,

    updatedAt:
      state.updatedAt,

    error:
      state.error
  };
}

function listFrames() {
  ensureDirs();

  return fs
    .readdirSync(FRAME_DIR)
    .filter(file =>
      /\.(png|webp|tif|tiff)$/i
        .test(file)
    )
    .sort()
    .reverse();
}

module.exports = {
  CACHE_DIR,
  FRAME_DIR,
  STATE_FILE,
  ensureDirs,
  readState,
  writeState,
  getStatus,
  listFrames
};
