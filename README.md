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
- **Wrogowie stoją na mapie od początku** w grupach i budzą się, gdy podejdziesz; im głębiej od startu, tym silniejsi i bardziej zróżnicowani. Każdy biom ma własny zestaw (`src/enemies.ts`): wędrowcy, roje, szarżownicy, pluciele, łucznicy, osiłki, kamikadze, szamani i totemy, plus elity (pierścień pocisków albo wstrząsy) i boss łączący kilka ataków (`think`/`execute` w `src/game.ts`). Wyprawa kończy się, gdy pokonasz wszystkich, bez limitu czasu. Tryby: szybka (120 wrogów), wielka (500 wrogów, większa mapa, boss krainy, ×2 XP, ×3 złota) i **wolny** (bez końca: po wyczyszczeniu piętra otwiera się portal do nowej, losowej mapy, wrogowie rosną z każdym piętrem, boss co 3. piętro, kończysz sam przyciskiem ZAKOŃCZ albo śmiercią; rekord piętra daje osiągnięcia).
- **Każdy biom ma własnego bossa** z unikalnym wyglądem i zestawem ataków (`BOSSES` w `src/data.ts`, grafiki `boss_*` w `src/gfx.ts`). Pierwsze pokonanie każdego daje +3 pkt drzewka.
- **Poziomy zagrożenia 1–10** (strzałki w menu): wrogowie ×(1+0,45 za poziom) HP i ×(1+0,25) obrażeń, więcej elit, nagrody (XP, złoto, łup) ×(1+0,3). Kolejny poziom odblokowuje wygrana na obecnym (w trybie wolnym: 4. piętro). Bossowie mają fazę furii poniżej 50% zdrowia, szybciej atakują i strzelają, gdy się od nich uciekasz.
- **Gemy**: 3 sloty główne na ataki (po 5 supportów) i 3 pomocnicze na aury, wzmocnienia i sługi (po 2 supporty). 62 ataki, 30 gemów pomocniczych (aury, wzmocnienia, słudzy), 23 supporty. Nowe gemy są opisane danymi w `src/gemdata.ts` (15 archetypów ataków w `fireGen` w `src/game.ts`). Gemy mają poziom 1–8 i wymagany poziom postaci do wypadnięcia; nowe wypadają częściej niż duplikaty.
- **Tagi i zgodność supportów**: każdy gem ma tagi (rodzaj, mechanika, żywioł; `src/tags.ts`). Support działa tylko z gemami, które wykorzystują jego główny efekt (`supportFits` w `src/skills.ts`): niepasujący nie da się włożyć, a po zmianie gemu niepasujące wracają do torby. Listę gemów można filtrować tagiem.
- **Powody do powrotu**: dzienne zadania i seria logowań (`src/daily.ts`, ekran DZIENNE w menu), gem dnia u handlarza, kolekcja gemów (osiągnięcia za poznane gemy), poziomy zagrożenia, tryb wolny z rekordem piętra.
- **Przedmioty**: 5 slotów, 4 rzadkości; lepsze zakładają się same.
- Zapis w `localStorage` (klucz `szept-otchlani-save-v3`)
- Podsumowanie gemu z supportami: `src/skills.ts` (`describeSkill`) używa tych samych parametrów (`skillBase`) co walka w `src/game.ts`.. Zmiana generatora drzewka (`src/tree.ts`) unieważnia zapisane identyfikatory węzłów.
