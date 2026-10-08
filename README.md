# Szept Otchłani

Eldritch-fantasy ARPG na Androida (Phaser 3 + TypeScript + Vite + Capacitor). Stała postać w stylu Path of Exile: wszystko zostaje między wyprawami.

- `npm install && npm run dev` – gra w przeglądarce (WASD; na telefonie przeciąganie palcem)
- `npm run docs` – build do `docs/` (GitHub Pages)
- `npm run android` – build + synchronizacja z projektem Androida (`npx cap open android`)

## Grafika
- Gra renderuje się w podwójnej rozdzielczości (`S = 2` w `src/gfx.ts`), a wszystkie sprite'y i ikony generuje kod (`makeTextures`), bez plików graficznych.

## Zasady
- **6 klas** startują w różnych miejscach **jednego drzewka** (~500 węzłów, 12 kamieni węgielnych). Do cudzych obszarów dochodzi się za punkty.
- **Poziom postaci jest stały.** XP z zabitych wrogów trafia od razu do postaci, koszt poziomu rośnie wykładniczo (`xpNeed` w `src/data.ts`). Każdy poziom daje 1 punkt drzewka. Start: 0 punktów.
- **Wyprawy kończą się liczbą pokonanych wrogów**, bez limitu czasu. Dwa tryby: szybka (mniej wrogów, 1–2 min) i wielka (więcej wrogów, boss, trudniejsza, ×2 XP i ×3 złota). Wrogowie skalują się z poziomem postaci.
- **Gemy**: 3 sloty główne na ataki (po 5 supportów) i 3 pomocnicze na aury, wzmocnienia i sługi (po 2 supporty). 12 ataków, 10 gemów pomocniczych, 12 supportów.
- **Przedmioty**: 5 slotów, 4 rzadkości; lepsze zakładają się same.
- Zapis w `localStorage` (klucz `szept-otchlani-save-v3`). Zmiana generatora drzewka (`src/tree.ts`) unieważnia zapisane identyfikatory węzłów.
