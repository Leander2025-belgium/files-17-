# Je eigen AI-assistent

Een AI-assistent in je terminal die kan **programmeren**, **op het internet zoeken** en
**webpagina's lezen**. Er zijn twee versies:

| | `lokaal.js` (aanbevolen) | `assistent.js` |
|---|---|---|
| Waar draait de AI? | Op **je eigen computer** (Ollama) | Bij Anthropic (Claude) |
| API-sleutel / account | **Niet nodig** | Nodig |
| Kosten / limieten | **Gratis, onbeperkt gebruik** | Betalen per gebruik |
| Privacy | Alles blijft op je pc | Vragen gaan naar de server |
| Slimheid | Goed (hangt af van je pc) | Zeer sterk |

---

## Lokale versie: volledig van jezelf

### 1. Installeer Ollama
Download het via **https://ollama.com** (Windows, Mac en Linux) en installeer het.

### 2. Download een model (eenmalig)
Kies op basis van het werkgeheugen (RAM) van je computer:

| RAM | Commando | Download |
|---|---|---|
| 8 GB | `ollama pull qwen3:4b` | ~2,5 GB |
| 16 GB | `ollama pull qwen3:8b` *(standaard)* | ~5 GB |
| 32 GB+ | `ollama pull qwen3:30b` | ~19 GB |
| Vooral code | `ollama pull qwen3-coder:30b` | ~19 GB |

Elk model van [ollama.com/library](https://ollama.com/library) met **"tools"**-ondersteuning werkt.
Na de download heb je geen internet meer nodig. Alleen de zoekfunctie gebruikt het nog.

### 3. Starten
Je hebt [Node.js](https://nodejs.org) 20 of nieuwer nodig.

```bash
cd ai-assistent
npm install
node lokaal.js                     # werkt in de huidige map
node lokaal.js ~/mijn-project      # of geef een werkmap op
```

Een ander model kies je zo: `AI_MODEL=qwen3:4b node lokaal.js`
(Windows PowerShell: `$env:AI_MODEL="qwen3:4b"; node lokaal.js`).

Het zoeken op internet gaat via DuckDuckGo en heeft geen sleutel nodig.

---

## Claude-versie (optioneel, slimmer, betalend)

```bash
export ANTHROPIC_API_KEY="sk-ant-..."   # sleutel van console.anthropic.com
node assistent.js
```
Instellingen: `AI_MODEL` (standaard `claude-opus-5-5`) en `AI_EFFORT` (`low` … `max`).

---

## Gebruik

Voorbeelden:
- `Wat is het laatste nieuws over AI?`
- `Maak een Python-script dat mijn foto's hernoemt naar datum, en test het.`
- `Lees script.js en leg uit wat de functie loadRadar doet.`
- `Vat deze pagina samen: https://...`

`/nieuw` start een nieuw gesprek, `/stop` sluit af.

## Veiligheid
- De AI kan alleen bestanden **binnen de werkmap** lezen en schrijven.
- Commando's worden **nooit** uitgevoerd zonder dat jij `j` typt.
