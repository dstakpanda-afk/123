# Evolution ARPG

Roguelite hack'n'slash ARPG na Androida (Phaser 3 + TypeScript + Vite + Capacitor).

- `npm install && npm run dev` – gra w przeglądarce (WASD lub przeciąganie palcem)
- `npm run android` – build + synchronizacja z projektem Androida (`npx cap open android`, potrzebny Android Studio/SDK)

## Mechaniki
- Run trwa 6 minut; automatyczne ataki, sterowanie wirtualnym joystickiem.
- Broń (Ostrze, Kule, Pocisk) rozwija się do poz. 5; z odpowiednim pasywem pojawia się **ewolucja**:
  Ostrze+Siła → Ostrze Burzy, Kule+Szybkość ataku → Pierścień Ognia, Pocisk+Witalność → Grad Strzał.
- Meta-progresja: złoto z runów kupuje stałe ulepszenia w menu (zapis w localStorage).
