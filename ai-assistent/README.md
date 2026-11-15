# Persoonlijke AI-assistent

Een AI-assistent in je terminal, aangedreven door Claude. Hij kan:

- **Informatie zoeken** op het internet en webpagina's lezen (met bronvermelding)
- **Programmeren**: bestanden in je werkmap bekijken, lezen en schrijven
- **Code uitvoeren en testen** via shell-commando's — elk commando vraagt eerst jouw toestemming (`j` = ja)

## Installatie

Je hebt [Node.js](https://nodejs.org) 20 of nieuwer nodig, plus een API-sleutel van
[console.anthropic.com](https://console.anthropic.com) (Settings → API Keys).

```bash
cd ai-assistent
npm install
export ANTHROPIC_API_KEY="sk-ant-..."     # Windows PowerShell: $env:ANTHROPIC_API_KEY="sk-ant-..."
```

## Gebruiken

```bash
node assistent.js                 # werkt in de huidige map
node assistent.js ~/mijn-project  # of geef een werkmap op
```

Voorbeelden van vragen:

- `Wat is het laatste nieuws over de Belgische weerberichten?`
- `Maak een Python-script dat alle .jpg-bestanden in deze map hernoemt naar datum, en test het.`
- `Lees script.js en leg uit wat de functie loadRadar doet.`
- `Vat deze pagina samen: https://...`

In het gesprek: `/nieuw` start een nieuw gesprek, `/stop` sluit af.

## Instellingen (optioneel)

| Variabele   | Standaard         | Uitleg                                              |
|-------------|-------------------|-----------------------------------------------------|
| `AI_MODEL`  | `claude-opus-5-5` | Bv. `claude-sonnet-5-5` (goedkoper) of `claude-haiku-5-5` (goedkoopst) |
| `AI_EFFORT` | `high`            | `low`, `medium`, `high`, `xhigh`, `max` — hoe grondig hij nadenkt |

## Veiligheid

- De assistent kan alleen bestanden **binnen de werkmap** lezen en schrijven.
- Commando's worden **nooit** uitgevoerd zonder dat jij `j` typt.
- Zet je API-sleutel nooit in code of in git; gebruik de omgevingsvariabele.
- Kosten: elk antwoord kost een klein bedrag per gebruik op je Anthropic-account; zoeken op het web kost extra per zoekopdracht.
- Als Claude een verzoek weigert, probeert de API automatisch een ander model (server-side fallback).
