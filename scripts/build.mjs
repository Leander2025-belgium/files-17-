// Wheaterflow build: kopieert de site naar dist/ en zet JS/CSS om
// naar oudere syntaxis (voor TV-browsers zoals TCL) + minificatie.
//
//   npm run build   -> tests + dist/
//
// Cloudflare Pages: build command "npm run build", output directory "dist".
// De map functions/ blijft in de root; Cloudflare vindt die daar zelf.

import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transform } from "esbuild";
import * as acorn from "acorn";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");

// Oudere TV-browsers (Chromium < 80) kennen geen ?. en ??.
// es2017 + chrome61 dekt TCL/Android TV WebViews van de laatste jaren.
const JS_TARGET = ["es2017", "chrome61"];
const CSS_TARGET = ["chrome61", "safari12"];

// Alles wat niet naar de website hoort.
const EXCLUDE = new Set([
  ".git", "node_modules", "dist", "scripts", "backend", "server", "functions",
  "ios", "tests", "supabase", "package.json", "package-lock.json",
  ".env", ".env.example", ".gitignore", ".DS_Store"
]);
const EXCLUDE_EXT = new Set([".md"]);

function shouldCopy(src) {
  const rel = path.relative(ROOT, src);
  if (!rel) return true;
  const first = rel.split(path.sep)[0];
  if (EXCLUDE.has(first) || EXCLUDE.has(path.basename(src))) return false;
  if (EXCLUDE_EXT.has(path.extname(src).toLowerCase())) return false;
  return true;
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (path.relative(DIST, full).split(path.sep)[0] === "assets") continue;
      yield* walk(full);
    } else {
      yield full;
    }
  }
}

const kb = n => (n / 1024).toFixed(0) + " KB";

async function main() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  for (const name of await readdir(ROOT)) {
    const src = path.join(ROOT, name);
    if (!shouldCopy(src)) continue;
    await cp(src, path.join(DIST, name), { recursive: true, filter: shouldCopy });
  }

  let before = 0, after = 0, files = 0;

  for await (const file of walk(DIST)) {
    const ext = path.extname(file);
    if (ext !== ".js" && ext !== ".css") continue;

    const source = await readFile(file, "utf8");
    const rel = path.relative(DIST, file);

    const result = await transform(source, {
      loader: ext === ".js" ? "js" : "css",
      target: ext === ".js" ? JS_TARGET : CSS_TARGET,
      // Geen namen inkorten: de scripts delen globale variabelen
      // (state, functies voor onclick, ...) en esbuild-hulpfuncties
      // moeten in elk bestand dezelfde naam houden.
      minifyWhitespace: true,
      minifySyntax: true,
      minifyIdentifiers: false,
      legalComments: "none",
      sourcefile: rel
    }).catch(error => {
      throw new Error(`Build mislukt in ${rel}:\n${error.message}`);
    });

    // Controle: de JS moet echt als ES2017 te lezen zijn.
    if (ext === ".js") {
      try {
        acorn.parse(result.code, { ecmaVersion: 2017, sourceType: "script", allowAwaitOutsideFunction: true });
      } catch (error) {
        throw new Error(`${rel} bevat na de build nog te nieuwe syntaxis: ${error.message}`);
      }
    }

    await writeFile(file, result.code);
    before += Buffer.byteLength(source);
    after += Buffer.byteLength(result.code);
    files++;
  }

  console.log(`dist/ klaar: ${files} JS/CSS-bestanden, ${kb(before)} -> ${kb(after)}`);
}

main().catch(error => {
  console.error(error.message || error);
  process.exit(1);
});
