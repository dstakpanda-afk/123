# Szept Otchłani

Eldritch-fantasy ARPG na Androida (Phaser 3 + TypeScript + Vite + Capacitor). Stała postać w stylu Path of Exile: wszystko zostaje między wyprawami.

- `npm install && npm run dev` – gra w przeglądarce (WASD; na telefonie przeciąganie palcem)
- `npm run docs` – build do `docs/` (GitHub Pages)
- `npm run android` – build + synchronizacja z projektem Androida (`npx cap open android`)

## Grafika
- Gra renderuje się w podwójnej rozdzielczości (`S = 2` w `src/gfx.ts`), a wszystkie sprite'y i ikony generuje kod (`makeTextures`), bez plików graficznych.

## Zasady
- **6 klas** startują w różnych miejscach **jednego drzewka** (456 węzłów: szprychy, pierścienie, klastry i 12 kamieni węgielnych w stylu PoE). Do cudzych obszarów dochodzi się za punkty. Układ generuje `src/tree.ts`; zmiana układu podbija `TREE_VERSION` i zwraca punkty w zapisach.
- **Poziom postaci jest stały.** XP z zabitych wrogów trafia od razu do postaci, koszt poziomu rośnie wykładniczo (`xpNeed` w `src/data.ts`). Każdy poziom daje 1 punkt drzewka. Start: 0 punktów. Dodatkowe punkty: 15 osiągnięć i pierwsze pokonanie każdego z 4 bossów (+3).
- **Wyprawa to losowo generowana mapa** (`src/map.ts`): 6 biomów (każdy ma własne kolory, ozdoby i układ: jaskinie, tunele, komnaty), różne kształty obszaru (elipsa, krzyż, L, pierścień, plama i inne), filary, pochodnie. Kafelki rysują się na bieżąco wokół kamery. Minimapa z mgłą.
- **Wrogowie stoją na mapie od początku** w grupach i budzą się, gdy podejdziesz; im głębiej od startu, tym silniejsi i bardziej zróżnicowani. Każdy biom ma własny zestaw (`src/enemies.ts`): wędrowcy, roje, szarżownicy, pluciele, łucznicy, osiłki, kamikadze, szamani i totemy, plus elity (pierścień pocisków albo wstrząsy) i boss łączący kilka ataków (`think`/`execute` w `src/game.ts`). Wyprawa kończy się, gdy pokonasz wszystkich, bez limitu czasu. Tryby: szybka (120 wrogów) i wielka (500 wrogów, większa mapa, boss, ×2 XP, ×3 złota).
- **Gemy**: 3 sloty główne na ataki (po 5 supportów) i 3 pomocnicze na aury, wzmocnienia i sługi (po 2 supporty). 12 ataków, 10 gemów pomocniczych, 12 supportów.
- **Przedmioty**: 5 slotów, 4 rzadkości; lepsze zakładają się same.
- Zapis w `localStorage` (klucz `szept-otchlani-save-v3`)
- Podsumowanie gemu z supportami: `src/skills.ts` (`describeSkill`) używa tych samych parametrów (`skillBase`) co walka w `src/game.ts`.. Zmiana generatora drzewka (`src/tree.ts`) unieważnia zapisane identyfikatory węzłów.
