#!/usr/bin/env node
// Je eigen AI, volledig lokaal via Ollama: geen API-sleutel, geen account, geen kosten,
// geen gebruikslimieten. Je gesprekken blijven op je eigen computer.
//
// Gebruik:  node lokaal.js [werkmap]
// Vereist:  Ollama (https://ollama.com) en een model, bv.  ollama pull qwen3:8b
import readline from "node:readline/promises";
import nodePath from "node:path";
import { stdin, stdout } from "node:process";
import { toolDefinities, controleerInvoer, voerToolUit } from "./tools.js";
import { webToolDefinities, zoekWeb, leesWebpagina } from "./web.js";

const MODEL = process.env.AI_MODEL || "qwen3:8b";
const OLLAMA = (process.env.OLLAMA_HOST || "http://localhost:11434").replace(/\/$/, "");
const WERKMAP = nodePath.resolve(process.argv[2] || process.cwd());
const MAX_STAPPEN = 25; // max. tool-rondes per vraag, tegen eindeloze lussen

const SYSTEEM = `Je bent de persoonlijke AI-assistent van de gebruiker en draait lokaal op hun eigen computer. Antwoord in het Nederlands, tenzij de gebruiker een andere taal gebruikt.

Je hebt tools:
- zoek_web en lees_webpagina: gebruik deze voor actuele informatie of feiten waar je niet zeker van bent. Vermeld bronnen met links.
- toon_map, lees_bestand, schrijf_bestand: werken met bestanden in de werkmap.
- voer_commando_uit: code uitvoeren en testen (de gebruiker keurt elk commando goed).

Lees bestaande code voor je die wijzigt, en test je code waar mogelijk. Wees beknopt en concreet, en zeg eerlijk als je iets niet weet.
Werkmap: ${WERKMAP}`;

const alleTools = [...webToolDefinities, ...toolDefinities];
const ollamaTools = alleTools.map((t) => ({
  type: "function",
  function: { name: t.name, description: t.description, parameters: t.input_schema },
}));

const rl = readline.createInterface({ input: stdin, output: stdout });
let berichten = [{ role: "system", content: SYSTEEM }];

const kleur = {
  grijs: (s) => `\x1b[90m${s}\x1b[0m`,
  blauw: (s) => `\x1b[36m${s}\x1b[0m`,
  geel: (s) => `\x1b[33m${s}\x1b[0m`,
  rood: (s) => `\x1b[31m${s}\x1b[0m`,
};

async function vraagToestemming(commando) {
  const antwoord = await rl.question(kleur.geel(`\nCommando uitvoeren?  ${commando}\n[j/N] `));
  return /^j(a)?$/i.test(antwoord.trim());
}

async function voerUit(naam, invoer) {
  const def = alleTools.find((t) => t.name === naam);
  if (!def) return { inhoud: `Onbekende tool: ${naam}`, fout: true };
  for (const veld of def.input_schema.required) {
    if (typeof invoer?.[veld] !== "string") return { inhoud: `Veld '${veld}' ontbreekt`, fout: true };
  }
  try {
    if (naam === "zoek_web") return { inhoud: await zoekWeb(invoer.zoekterm), fout: false };
    if (naam === "lees_webpagina") return { inhoud: await leesWebpagina(invoer.url), fout: false };
  } catch (e) {
    return { inhoud: `Fout: ${e.message}`, fout: true };
  }
  const fout = controleerInvoer(naam, invoer);
  if (fout) return { inhoud: fout, fout: true };
  return voerToolUit(naam, invoer, { werkmap: WERKMAP, vraagToestemming });
}

// Eén aanroep naar Ollama, met de tekst live op het scherm.
async function chat() {
  const res = await fetch(`${OLLAMA}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, messages: berichten, tools: ollamaTools, stream: true, think: false }),
  });
  if (!res.ok) throw new Error(`Ollama gaf HTTP ${res.status}: ${await res.text()}`);

  let inhoud = "";
  const toolCalls = [];
  let buffer = "";
  const decoder = new TextDecoder();
  for await (const stuk of res.body) {
    buffer += decoder.decode(stuk, { stream: true });
    const regels = buffer.split("\n");
    buffer = regels.pop();
    for (const regel of regels) {
      if (!regel.trim()) continue;
      const data = JSON.parse(regel);
      if (data.error) throw new Error(data.error);
      const m = data.message;
      if (m?.content) {
        stdout.write(m.content);
        inhoud += m.content;
      }
      if (m?.tool_calls) toolCalls.push(...m.tool_calls);
    }
  }
  return { inhoud, toolCalls };
}

async function beurt() {
  for (let stap = 0; stap < MAX_STAPPEN; stap++) {
    const { inhoud, toolCalls } = await chat();
    berichten.push({ role: "assistant", content: inhoud, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) });
    if (toolCalls.length === 0) return;

    for (const call of toolCalls) {
      const naam = call.function?.name;
      let args = call.function?.arguments ?? {};
      if (typeof args === "string") {
        try { args = JSON.parse(args); } catch { args = {}; }
      }
      const label = args.zoekterm ?? args.url ?? args.pad ?? "";
      if (naam !== "voer_commando_uit") stdout.write(kleur.grijs(`\n[${naam}: ${label}]\n`));
      const { inhoud: resultaat } = await voerUit(naam, args);
      berichten.push({ role: "tool", tool_name: naam, content: resultaat });
    }
  }
  stdout.write(kleur.rood(`\n[Gestopt na ${MAX_STAPPEN} stappen.]`));
}

async function controleerOllama() {
  try {
    const res = await fetch(`${OLLAMA}/api/tags`);
    const { models = [] } = await res.json();
    if (!models.some((m) => m.name === MODEL || m.name === `${MODEL}:latest`)) {
      console.log(kleur.geel(`Model '${MODEL}' is nog niet gedownload. Voer eerst uit:  ollama pull ${MODEL}`));
      return false;
    }
    return true;
  } catch {
    console.log(kleur.rood(`Ollama draait niet op ${OLLAMA}. Installeer het via https://ollama.com en start het.`));
    return false;
  }
}

async function main() {
  console.log(kleur.blauw(`Lokale AI (${MODEL} via Ollama): werkmap ${WERKMAP}`));
  if (!(await controleerOllama())) {
    rl.close();
    process.exit(1);
  }
  console.log(kleur.grijs("Alles draait op je eigen computer. /nieuw = nieuw gesprek, /stop = afsluiten\n"));

  while (true) {
    let invoer;
    try {
      invoer = (await rl.question(kleur.blauw("\nJij> "))).trim();
    } catch {
      break;
    }
    if (!invoer) continue;
    if (invoer === "/stop" || invoer === "/exit") break;
    if (invoer === "/nieuw") {
      berichten = [berichten[0]];
      console.log(kleur.grijs("Nieuw gesprek gestart."));
      continue;
    }
    const lengteVoor = berichten.length;
    berichten.push({ role: "user", content: invoer });
    stdout.write(kleur.blauw("\nAI> "));
    try {
      await beurt();
      stdout.write("\n");
    } catch (err) {
      berichten.length = lengteVoor;
      console.error(kleur.rood(`\nFout: ${err.message}`));
    }
  }
  rl.close();
}

main();
