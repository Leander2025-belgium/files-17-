import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import nodePath from "node:path";
import { veiligPad, controleerInvoer, voerToolUit } from "./tools.js";

test("veiligPad blokkeert paden buiten de werkmap", () => {
  assert.throws(() => veiligPad("/tmp/x", "../geheim"));
  assert.throws(() => veiligPad("/tmp/x", "/etc/passwd"));
  assert.equal(veiligPad("/tmp/x", "a/b.txt"), "/tmp/x/a/b.txt");
});

test("controleerInvoer controleert verplichte velden", () => {
  assert.equal(controleerInvoer("lees_bestand", { pad: "a" }), null);
  assert.match(controleerInvoer("schrijf_bestand", { pad: "a" }), /inhoud/);
  assert.match(controleerInvoer("bestaat_niet", {}), /Onbekende/);
});

test("schrijven, lezen, map tonen en commando weigeren", async () => {
  const werkmap = await fs.mkdtemp(nodePath.join(os.tmpdir(), "ai-test-"));
  const ctx = { werkmap, vraagToestemming: async () => false };
  assert.equal((await voerToolUit("schrijf_bestand", { pad: "sub/x.txt", inhoud: "hallo" }, ctx)).fout, false);
  assert.equal((await voerToolUit("lees_bestand", { pad: "sub/x.txt" }, ctx)).inhoud, "hallo");
  assert.equal((await voerToolUit("toon_map", { pad: "." }, ctx)).inhoud, "sub/");
  const geweigerd = await voerToolUit("voer_commando_uit", { commando: "echo hoi" }, ctx);
  assert.equal(geweigerd.fout, true);
  const ok = await voerToolUit("voer_commando_uit", { commando: "echo hoi" }, { werkmap, vraagToestemming: async () => true });
  assert.match(ok.inhoud, /hoi/);
});
