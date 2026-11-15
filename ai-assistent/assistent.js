#!/usr/bin/env node
// Persoonlijke AI-assistent in de terminal.
// Kan: programmeren (bestanden lezen/schrijven, commando's uitvoeren),
// op het web zoeken en webpagina's lezen.
//
// Gebruik:  node assistent.js [werkmap]
import Anthropic from "@anthropic-ai/sdk";
import readline from "node:readline/promises";
import nodePath from "node:path";
import { stdin, stdout } from "node:process";
import { toolDefinities, controleerInvoer, voerToolUit } from "./tools.js";

const MODEL = process.env.AI_MODEL || "claude-opus-5-5";
const EFFORT = process.env.AI_EFFORT || "high"; // low | medium | high | xhigh | max
const WERKMAP = nodePath.resolve(process.argv[2] || process.cwd());

const SYSTEEM = `Je bent de persoonlijke AI-assistent van de gebruiker. Antwoord standaard in het Nederlands, tenzij de gebruiker een andere taal gebruikt.

Je kunt:
- Op het internet zoeken (web_search) en webpagina's lezen (web_fetch) voor actuele informatie. Vermeld je bronnen met links.
- Programmeren in de werkmap: bestanden bekijken (toon_map, lees_bestand), schrijven (schrijf_bestand) en commando's uitvoeren (voer_commando_uit), bv. om code te testen.

Werkwijze:
- Lees bestaande code voordat je die wijzigt, en test je code waar mogelijk.
- Wees beknopt en concreet. Zeg eerlijk wanneer je iets niet zeker weet.
- Werkmap: ${WERKMAP}`;

const tools = [
  { type: "web_search_20260209", name: "web_search", max_uses: 8 },
  { type: "web_fetch_20260209", name: "web_fetch", max_uses: 8 },
  ...toolDefinities,
];

const client = new Anthropic(); // leest ANTHROPIC_API_KEY uit de omgeving
const rl = readline.createInterface({ input: stdin, output: stdout });
let berichten = [];

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

function toonServerTool(blok) {
  if (blok.type === "server_tool_use") {
    const doel = blok.input?.query ?? blok.input?.url ?? "";
    stdout.write(kleur.grijs(`\n[${blok.name === "web_search" ? "zoeken" : "pagina lezen"}: ${doel}]\n`));
  }
}

// Eén gebruikersbeurt: blijf het model aanroepen tot het klaar is.
async function beurt() {
  let jsonPogingen = 0;
  while (true) {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      system: SYSTEEM,
      cache_control: { type: "ephemeral" },
      output_config: { effort: EFFORT },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default", // bij een weigering automatisch een ander model proberen
      tools,
      messages: berichten,
    });
    stream.on("text", (delta) => stdout.write(delta));
    stream.on("contentBlock", toonServerTool);

    let bericht;
    try {
      bericht = await stream.finalMessage();
      jsonPogingen = 0;
    } catch (err) {
      if (err instanceof Anthropic.APIError || jsonPogingen++ >= 2) throw err;
      continue; // tool-invoer was onleesbare JSON: beurt opnieuw proberen
    }

    if (bericht.stop_reason === "refusal") {
      stdout.write(kleur.rood("\n[Het model weigerde dit verzoek.]\n"));
      return;
    }
    berichten.push({ role: "assistant", content: bericht.content });

    if (bericht.stop_reason === "pause_turn") continue; // lange server-tool-run: doorgaan
    const toolBlokken = bericht.content.filter((b) => b.type === "tool_use");
    if (toolBlokken.length === 0) return; // klaar
    if (bericht.stop_reason === "max_tokens") {
      berichten.pop(); // onvolledige tool-invoer niet uitvoeren
      stdout.write(kleur.rood("\n[Antwoord te lang afgebroken; probeer de taak op te splitsen.]\n"));
      return;
    }

    const resultaten = [];
    for (const tool of toolBlokken) {
      const fout = controleerInvoer(tool.name, tool.input);
      if (fout) {
        resultaten.push({ type: "tool_result", tool_use_id: tool.id, is_error: true, content: fout });
        continue;
      }
      const label = tool.input.pad ?? tool.input.commando ?? "";
      if (tool.name !== "voer_commando_uit") stdout.write(kleur.grijs(`\n[${tool.name}: ${label}]\n`));
      const { inhoud, fout: isFout } = await voerToolUit(tool.name, tool.input, { werkmap: WERKMAP, vraagToestemming });
      resultaten.push({ type: "tool_result", tool_use_id: tool.id, is_error: isFout, content: inhoud });
    }
    berichten.push({ role: "user", content: resultaten }); // alle resultaten in één bericht
  }
}

async function main() {
  console.log(kleur.blauw(`AI-assistent (${MODEL}) — werkmap: ${WERKMAP}`));
  console.log(kleur.grijs("Commando's: /nieuw = nieuw gesprek, /stop = afsluiten\n"));

  while (true) {
    let invoer;
    try {
      invoer = (await rl.question(kleur.blauw("\nJij> "))).trim();
    } catch {
      break; // Ctrl+D / invoer gesloten
    }
    if (!invoer) continue;
    if (invoer === "/stop" || invoer === "/exit") break;
    if (invoer === "/nieuw") {
      berichten = [];
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
      berichten.length = lengteVoor; // mislukte beurt terugdraaien
      if (err instanceof Anthropic.AuthenticationError) {
        console.error(kleur.rood("\nOngeldige of ontbrekende API-sleutel. Zet ANTHROPIC_API_KEY (zie README)."));
      } else if (err instanceof Anthropic.RateLimitError) {
        console.error(kleur.rood("\nTe veel verzoeken — wacht even en probeer opnieuw."));
      } else if (err instanceof Anthropic.APIError) {
        console.error(kleur.rood(`\nAPI-fout ${err.status}: ${err.message}`));
      } else {
        console.error(kleur.rood(`\nFout: ${err.message}`));
      }
    }
  }
  rl.close();
}

main();
