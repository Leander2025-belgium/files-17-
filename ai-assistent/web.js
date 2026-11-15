// Internet zoeken en pagina's lezen zonder API-sleutel.
// Zoeken gebruikt de gewone HTML-versie van DuckDuckGo; pagina's worden direct opgehaald.
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
const MAX_TEKST = 15_000;

export const webToolDefinities = [
  {
    name: "zoek_web",
    description: "Zoek op het internet. Geeft titels, links en korte samenvattingen terug.",
    input_schema: {
      type: "object",
      properties: { zoekterm: { type: "string", description: "Wat je wilt zoeken" } },
      required: ["zoekterm"],
    },
  },
  {
    name: "lees_webpagina",
    description: "Haal een webpagina op en geef de leesbare tekst terug.",
    input_schema: {
      type: "object",
      properties: { url: { type: "string", description: "Volledige URL (https://...)" } },
      required: ["url"],
    },
  },
];

function ontsnap(tekst) {
  return tekst
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x?([0-9a-f]+);/gi, (m, n) => {
      const code = m.startsWith("&#x") ? parseInt(n, 16) : parseInt(n, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    });
}

export function htmlNaarTekst(html) {
  return ontsnap(
    html
      .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

export function parseDuckDuckGo(html, max = 8) {
  const resultaten = [];
  const blokken = html.split(/class="result__body|class="result results_links/).slice(1);
  for (const blok of blokken) {
    const link = blok.match(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!link) continue;
    let url = ontsnap(link[1]);
    const uddg = url.match(/[?&]uddg=([^&]+)/);
    if (uddg) url = decodeURIComponent(uddg[1]);
    if (url.startsWith("//")) url = "https:" + url;
    if (url.includes("duckduckgo.com/y.js")) continue; // advertentie
    const snippet = blok.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
    resultaten.push({
      titel: htmlNaarTekst(link[2]),
      url,
      samenvatting: snippet ? htmlNaarTekst(snippet[1]) : "",
    });
    if (resultaten.length >= max) break;
  }
  return resultaten;
}

export async function zoekWeb(zoekterm) {
  const res = await fetch("https://html.duckduckgo.com/html/", {
    method: "POST",
    headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ q: zoekterm, kl: "be-nl" }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Zoeken mislukt (HTTP ${res.status})`);
  const resultaten = parseDuckDuckGo(await res.text());
  if (resultaten.length === 0) return "Geen resultaten gevonden.";
  return resultaten.map((r, i) => `${i + 1}. ${r.titel}\n   ${r.url}\n   ${r.samenvatting}`).join("\n\n");
}

export async function leesWebpagina(url) {
  if (!/^https?:\/\//i.test(url)) throw new Error("URL moet met http:// of https:// beginnen");
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Pagina ophalen mislukt (HTTP ${res.status})`);
  const type = res.headers.get("content-type") || "";
  const ruw = await res.text();
  const tekst = type.includes("html") ? htmlNaarTekst(ruw) : ruw;
  return tekst.length > MAX_TEKST ? tekst.slice(0, MAX_TEKST) + "\n… [ingekort]" : tekst;
}
