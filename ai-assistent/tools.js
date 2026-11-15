// Lokale tools die de assistent op jouw computer mag gebruiken.
// Alle paden blijven binnen de werkmap (WERKMAP); commando's vragen eerst toestemming.
import fs from "node:fs/promises";
import nodePath from "node:path";
import { exec } from "node:child_process";

const MAX_UITVOER = 30_000; // tekens; langere uitvoer wordt ingekort met een melding

export const toolDefinities = [
  {
    name: "lees_bestand",
    description: "Lees de inhoud van een tekstbestand in de werkmap.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: { pad: { type: "string", description: "Pad relatief aan de werkmap" } },
      required: ["pad"],
    },
  },
  {
    name: "schrijf_bestand",
    description:
      "Maak of overschrijf een tekstbestand in de werkmap met de volledige nieuwe inhoud. Mappen worden automatisch aangemaakt.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: {
        pad: { type: "string", description: "Pad relatief aan de werkmap" },
        inhoud: { type: "string", description: "Volledige inhoud van het bestand" },
      },
      required: ["pad", "inhoud"],
    },
  },
  {
    name: "toon_map",
    description: "Toon de bestanden en submappen van een map in de werkmap.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: { pad: { type: "string", description: "Pad relatief aan de werkmap; '.' voor de werkmap zelf" } },
      required: ["pad"],
    },
  },
  {
    name: "voer_commando_uit",
    description:
      "Voer een shell-commando uit in de werkmap (bv. code draaien, tests, npm, git). De gebruiker moet elk commando eerst goedkeuren.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: { commando: { type: "string", description: "Het shell-commando" } },
      required: ["commando"],
    },
  },
];

// Eenvoudige schemacontrole: alle verplichte velden moeten strings zijn.
export function controleerInvoer(naam, invoer) {
  const def = toolDefinities.find((t) => t.name === naam);
  if (!def) return `Onbekende tool: ${naam}`;
  if (!invoer || typeof invoer !== "object") return "Invoer ontbreekt of is geen object";
  for (const veld of def.input_schema.required) {
    if (typeof invoer[veld] !== "string") return `Veld '${veld}' ontbreekt of is geen tekst`;
  }
  return null;
}

// Houd modelpaden binnen de werkmap (geen '..' of absolute paden erbuiten).
export function veiligPad(werkmap, pad) {
  const root = nodePath.resolve(werkmap);
  const doel = nodePath.resolve(root, pad);
  const rel = nodePath.relative(root, doel);
  if (rel === ".." || rel.startsWith(".." + nodePath.sep) || nodePath.isAbsolute(rel)) {
    throw new Error("Pad valt buiten de werkmap");
  }
  return doel;
}

function inkorten(tekst) {
  if (tekst.length <= MAX_UITVOER) return tekst;
  return tekst.slice(0, MAX_UITVOER) + `\n… [ingekort: ${tekst.length - MAX_UITVOER} tekens weggelaten]`;
}

/**
 * Voer een tool uit. `vraagToestemming(commando)` moet een Promise<boolean> teruggeven.
 * Geeft { inhoud, fout } terug.
 */
export async function voerToolUit(naam, invoer, { werkmap, vraagToestemming }) {
  try {
    switch (naam) {
      case "lees_bestand": {
        const tekst = await fs.readFile(veiligPad(werkmap, invoer.pad), "utf8");
        return { inhoud: inkorten(tekst), fout: false };
      }
      case "schrijf_bestand": {
        const doel = veiligPad(werkmap, invoer.pad);
        await fs.mkdir(nodePath.dirname(doel), { recursive: true });
        await fs.writeFile(doel, invoer.inhoud, "utf8");
        return { inhoud: `Opgeslagen: ${invoer.pad} (${invoer.inhoud.length} tekens)`, fout: false };
      }
      case "toon_map": {
        const items = await fs.readdir(veiligPad(werkmap, invoer.pad), { withFileTypes: true });
        const lijst = items
          .filter((i) => i.name !== "node_modules" && i.name !== ".git")
          .map((i) => (i.isDirectory() ? `${i.name}/` : i.name))
          .sort();
        return { inhoud: lijst.join("\n") || "(lege map)", fout: false };
      }
      case "voer_commando_uit": {
        if (!(await vraagToestemming(invoer.commando))) {
          return { inhoud: "De gebruiker heeft dit commando geweigerd.", fout: true };
        }
        return await new Promise((resolve) => {
          exec(invoer.commando, { cwd: werkmap, timeout: 120_000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
            const code = err ? (err.code ?? 1) : 0;
            const tekst = `exitcode: ${code}\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`;
            resolve({ inhoud: inkorten(tekst), fout: code !== 0 });
          });
        });
      }
      default:
        return { inhoud: `Onbekende tool: ${naam}`, fout: true };
    }
  } catch (e) {
    return { inhoud: `Fout: ${e.message}`, fout: true };
  }
}
