# Szept Otchłani

Eldritch-fantasy ARPG na Androida (Phaser 3 + TypeScript + Vite + Capacitor). Stała postać w stylu Path of Exile: wszystko zostaje między wyprawami.

- `npm install && npm run dev` – gra w przeglądarce (WASD; na telefonie przeciąganie palcem)
- `npm run docs` – build do `docs/` (GitHub Pages)
- `npm run android` – build + synchronizacja z projektem Androida (`npx cap open android`)

## Zasady
- **6 klas** (Kultysta Krwi, Wyznawca Gwiazd, Łowca Pustki, Strażnik Głębin, Śniący, Kościany Kapłan) startują w różnych miejscach **jednego wielkiego drzewka** (~500 węzłów, 12 kamieni węgielnych). Do cudzych obszarów dochodzi się za punkty.
- **Wyprawa** trwa 6 minut. Poziom w trakcie wyprawy nic nie daje, ale po jej zakończeniu zamienia się w punkty drzewka.
- **Gemy**: 3 umiejętności główne po 5 supportów, 3 poboczne po 2 supporty. 9 umiejętności i 12 supportów, wypadają z wrogów lub kupisz u handlarza.
- **Przedmioty**: 5 slotów, 4 rzadkości; lepsze zakładają się same.
- Zapis w `localStorage` (klucz `szept-otchlani-save-v2`). Zmiana generatora drzewka (`src/tree.ts`) unieważnia zapisane identyfikatory węzłów.
