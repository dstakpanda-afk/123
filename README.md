# Evolution ARPG

Roguelite hack'n'slash ARPG na Androida (Phaser 3 + TypeScript + Vite + Capacitor).

- `npm install && npm run dev` – gra w przeglądarce (WASD, T = drzewko, I = ekwipunek; na telefonie przeciąganie palcem)
- `npm run docs` – build do `docs/` (GitHub Pages)
- `npm run android` – build + synchronizacja z projektem Androida (`npx cap open android`)

## Mechaniki
- **Klimat: eldritch fantasy.** Cztery klasy (Kultysta Krwi, Wyznawca Gwiazd, Łowca Pustki, Strażnik Głębin) z własną umiejętnością startową i bonusami.
- Drzewko: pinch-zoom na telefonie, 4 gałęzie nazwane od klas (Krew, Gwiazdy, Pustka, Głębia).
- Run 6 minut, ataki automatyczne. Poziom daje **punkt umiejętności** (zamiast kart).
- **Drzewko**: 4 gałęzie (Łowca, Strażnik, Wojownik, Mag), 61 węzłów, węzły znaczące i kamienie węgielne z kompromisami.
- **Przedmioty** (5 slotów, 4 rzadkości, losowe afiksy) wypadają z wrogów; elity co 40 s dają łup gwarantowany.
- **Umiejętności** (8, 3 sloty) wypadają jako księgi; duplikat podnosi poziom do 5.
- **Ewolucja**: umiejętność na poz. 5 + węzeł-katalizator w drzewku → przycisk EWOLUCJA w ekwipunku.
- Meta: złoto z runów kupuje stałe ulepszenia w menu.
