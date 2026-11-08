# Blokstad

Een blokkenbouwspel in de browser, in een stad van **2,5 km × 25 km** (1 blok = 1 meter).

Open `/blokstad/` op de site (of lokaal met `python3 -m http.server` in de repo-map en ga naar `http://localhost:8000/blokstad/`).

## Hoe werkt het?

1. **Kies een stuk stad** op de overzichtskaart (noord boven, scroll naar beneden voor de hele 25 km), of gebruik de snelknoppen of x/z-coördinaten.
2. **Kies de grootte**: 64, 128 of 256 meter in het vierkant.
3. **Download** het stuk. Het wordt opgeslagen in je browser (IndexedDB), zodat je later verder kan bouwen.
4. **Spelen**: lopen, vliegen, blokken breken en plaatsen. Je werk wordt automatisch bewaard (bij pauze en elke 30 s).
5. Met **Bestand** exporteer je een stuk als `.blokstad`-bestand; met **Bestand importeren** laad je het weer in (ook op een ander toestel).

## De stad

De stad wordt procedureel en deterministisch opgebouwd: elk stuk past dus naadloos naast de stukken ernaast.

- Centrum met torens tot ~140 m (drie stadskernen), pleinen met fonteinen
- Stadswijken met gesloten bouwblokken en binnentuinen
- Woonwijken met huizen, tuinen, hagen en geparkeerde auto's
- Industrie met hallen en schoorstenen, havens met containers en dokken
- Parken met vijvers, paden en bomen, een rivier met kades en bruggen, en strand aan beide uiteinden

## Besturing

| Toets | Actie |
|---|---|
| W A S D | lopen |
| Spatie | springen / omhoog vliegen |
| Shift | sprinten / omlaag vliegen |
| F | vliegen aan/uit |
| Linkerklik / rechterklik | breken / plaatsen |
| Middelklik | blok oppakken |
| 1–9, muiswiel | blok kiezen |
| E | alle blokken |
| Esc | pauze, opslaan, terug naar kaart |

Op telefoon en tablet verschijnen een joystick en knoppen.

## Bestanden

- `js/city.js` — stadsgenerator (wegen, wijken, gebouwen, bomen)
- `js/worker.js` — berekent kaart, voorbeeld en 3D-gebied in de achtergrond
- `js/mesher.js` — zet blokken om in 3D-vlakken (greedy meshing + ambient occlusion)
- `js/game.js` — rendering (Three.js), besturing, natuurkunde, bouwen
- `js/storage.js` — opslag in IndexedDB en import/export
- `js/textures.js`, `js/blocks.js` — blokken en hun pixeltexturen
