import { test } from "node:test";
import assert from "node:assert/strict";
import { htmlNaarTekst, parseDuckDuckGo } from "./web.js";

test("htmlNaarTekst haalt scripts en tags weg", () => {
  const tekst = htmlNaarTekst("<html><script>x()</script><h1>Titel</h1><p>Hallo &amp; welkom</p></html>");
  assert.match(tekst, /Titel/);
  assert.match(tekst, /Hallo & welkom/);
  assert.doesNotMatch(tekst, /x\(\)/);
});

test("parseDuckDuckGo leest resultaten en decodeert links", () => {
  const html = `
    <div class="result results_links"><div class="links_main result__body">
      <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.meteo.be%2Fnl&amp;rut=abc">KMI <b>weer</b></a>
      <a class="result__snippet" href="#">Het weer in <b>België</b>.</a>
    </div></div>`;
  const [r] = parseDuckDuckGo(html);
  assert.equal(r.url, "https://www.meteo.be/nl");
  assert.equal(r.titel, "KMI weer");
  assert.equal(r.samenvatting, "Het weer in België .");
});
