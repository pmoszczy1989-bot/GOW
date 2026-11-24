# GOW

Jednoekranowa platformówka pixel-art w hołdzie klasycznemu **Prince of Persia (1989)**.
Spadasz z nocnego nieba na dach pałacu, zdobywasz miecz, pokonujesz strażnika lochu
i uciekasz przez drzwi. Grafika, dźwięki i poziom są autorskie – z oryginału zapożyczona
jest tylko mechanika.

## Uruchomienie

Bez instalacji i serwera: otwórz `index.html` w przeglądarce (działa z `file://`, offline).
Na telefonie/tablecie pojawiają się przyciski dotykowe ◀ ▶ ▼ ▲ ⚔.

## Sterowanie

| Klawisz | Akcja |
|---|---|
| ← → (A D) | bieg / obrót |
| Shift + ← → | ostrożny krok (zatrzymuje się na krawędzi i przed kolcami) |
| ↑ (W) | skok w górę / podciągnięcie na krawędzi nad głową / wyjście przez drzwi |
| ↑ podczas biegu | skok z rozbiegu (~2 kafle) |
| ↑ + kierunek (stojąc) | skok w dal z miejsca |
| ↓ (S) | kucnięcie; przy krawędzi – zwis; w zwisie – puszczenie |
| Shift (Spacja) | podniesienie przedmiotu; w walce – cios |
| ↑ w walce | zasłona (sparowany cios ogłusza strażnika) |
| R | od nowa |

## Poziom

Grafika jest rysowana w 320×200 i skalowana pikselowo; napisy (`txt()`) trafiają na osobną warstwę `#txt` w pełnej rozdzielczości ekranu, więc są gładkie.

Ekran 320×200 px, 3 rzędy × 10 kafli (kafel 32 px, rząd 60 px). Definicja w `LEVEL0` (`game.js`):

```
'___L   __W'   dach pałacu
'##__S____ '   górny loch
'#D__G_H__P'   dolny loch
```

`_` podłoga · spacja – przepaść · `#` mur · `L` luźna płyta · `S` kolce · `W` miecz ·
`H` mikstura · `P` płyta naciskowa · `G` krata · `D` drzwi wyjściowe.

Przejście: lądowanie na dachu → luźna płyta zapada się do lochu → skok z rozbiegu nad kolcami →
podciągnięcie na dach → podniesienie miecza (animacja: przyklęk, uniesienie miecza nad głowę,
błyski i fanfara) → budzi się strażnik → walka → zwis i zeskok na płytę naciskową →
krata otwiera się na kilka sekund → bieg do drzwi.

## Zasady

- Życie: 3 trójkąty. Upadek o 1 rząd – bez obrażeń, o 2 – traci się trójkąt, o 3+ – śmierć.
- Kolce wysuwają się, gdy się do nich zbliżysz; wbiegnięcie lub skok na nie zabija.
- Luźna płyta spada chwilę po wejściu; gruz rani stojącego pod nią.
- Bez miecza strażnik jest nie do pokonania. Strażnik czasem paruje ciosy; zepchnięty w przepaść ginie.
- Mikstura przywraca 1 trójkąt życia.
- Krata otwiera się po naciśnięciu płyty, po 3 s powoli opada.

## Pliki

| Plik | Opis |
|---|---|
| `index.html` | płótno, ekran tytułowy, przyciski dotykowe; ładuje `game.js?v=N` |
| `game.js` | cała gra: stan, fizyka, gracz, strażnik, pułapki, rysowanie, dźwięk, pętla |

Kluczowe funkcje: `reset`, `update(dt)` (stały krok 1/60 s), `updPlayer`, `updGuard`, `updLoose`,
`updGate`, `draw`, `drawFig` (postacie z „kości” wg tabeli `POSE`), `buildBG` (prerenderowane tło).

## Test

W konsoli przeglądarki dostępny jest obiekt `window.GOW` (`P`, `G`, `K`, `PR`, `update`, `reset`, `start`).
Szybka kontrola składni: `node --check game.js`.
