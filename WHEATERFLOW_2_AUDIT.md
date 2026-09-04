# Wheaterflow 2.0 — technische audit en implementatie

## Belangrijkste root causes

- **Radar eerste opening:** de tabhandler startte kaartinitialisatie en bronverversing los van elkaar, gebruikte vaste `setTimeout`-hermetingen en riep `refreshRadarSource().catch?.(...)` aan terwijl `refreshRadarSource` geen Promise retourneerde. Daardoor kon de UI al “Buienradar” tonen voordat de laag werkelijk klaar was.
- **Radar state/layers:** meerdere namen (`precip`, `radar`, `rain`, `rainviewer`) en meerdere controllers liepen door elkaar. Er waren bovendien dubbele eventroutes voor de primaire radarknoppen.
- **Xweather lifecycle:** UI/visibility listeners konden bij opnieuw initialiseren opnieuw gekoppeld worden en de controller kon langer leven dan de actieve laag.
- **Safe areas:** verspreide `env(safe-area-inset-*)` overrides en meerdere navigatiehoogtes maakten detailviews gevoelig voor iPhone-statusbalk- en Dynamic-Island-overlap.
- **CSS-cascade:** `style.css` bevat veel historische override-lagen en duizenden `!important`-declaraties. `wheaterflow.css` bestaat nog maar wordt door `index.html` niet geladen. Nieuwe Wheaterflow 2.0-regels zijn daarom bewust gescoped en er is een centrale actieve tokenlaag toegevoegd in plaats van globale resets te introduceren.
- **Informatiehiërarchie:** hero, Intelligence en regencommunicatie herhaalden dezelfde boodschap. Geavanceerde pagina's (14 dagen, Sky, Fotoweer, instellingen) waren cijfer-/tegelzwaar.

## Gewijzigde productieonderdelen

- `script.js`: radar lifecycle/state-normalisatie, genormaliseerde weather-state helper, kortere hero, contextuele Intelligence, 14-daagse verticale lijst, Sky/Fotoweer-context, settings-accordion, TV-code slots, listener-deduplicatie.
- `style.css`: centrale Wheaterflow 2.0 tokens, consistente safe areas, 14-daagse lijst, contextkaarten, settings-categorieën, TV pairing slots, community-form polish.
- `index.html`: Bliksem als hoofd-radarlaag, settings-categorie metadata, zes TV-code slots, cacheversie.
- `service-worker.js`: nieuwe cacheversie.
- `package.json` + `tests/wheaterflow2-static.test.js`: regressietests voor kritieke 2.0-invarianten.

## Bewust behouden

Backend/API-contracten, Supabase, pushmeldingen, TV mode/pairing-logica, Community dataflow, profielheader, Favoriete locaties, Accountbeheer-handlers/design, RainViewer fallback, Xweather, Rain ETA, Sea Mode, Zeevonk, Reisweer, grafieken, onboarding en Liquid Glass bottom navigation.

## Belangrijkste implementatiebeslissingen

1. Radar start bij eerste echte opening altijd op `precip`; pas na succesvolle initialisatie mag een eerder gekozen laag worden hersteld.
2. Geen arbitraire radar-init timers: twee `requestAnimationFrame`-cycli geven de actieve container een meetbare layout, daarna wordt de bron **awaited**.
3. Eén layer-adapter normaliseert aliases en één quick-layer wiring voorkomt dubbele clickhandlers.
4. Xweather wordt pas gestart voor professionele lagen en listeners worden gededupliceerd/opgeruimd.
5. Safe-area en glass-tokens zijn gecentraliseerd zonder de zwevende transparante bottom navigation dicht te maken.
6. Hero meldt alleen kernstatus; Intelligence interpreteert wat er de komende uren gebeurt.
7. De bestaande Rain-, 7-daagse-, 24-uurs- en Accountbeheer-verbeteringen blijven behouden.

## Tests

- `npm test` (syntax + Rain ETA tests + Wheaterflow 2.0 statische regressietests)
- `npm run check` in `backend/`
- statische controles op handler-ID's, eerste-radar-invariant, dubbele radar wiring, TV slots, safe-area tokens en instellingen-ID's

## Resterende beperkingen

Een echte end-to-end test van live radarframes/Xweather vereist bereikbare externe weather endpoints en geldige runtime credentials. De code behoudt daarom de bestaande fallbackketen en meldt fouten expliciet in plaats van dummydata te tonen.
