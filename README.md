# GOW – Rycerze Ostrza

Jednoekranowa platformówka pixel-art inspirowana klasycznym **Prince of Persia (1989)**,
osadzona w realiach kosmicznej opowieści o rycerzach z ostrzami energii.
Spadasz z nieba na dach cytadeli, odnajdujesz rękojeść ostrza (losowy kolor – nigdy czerwony),
przebijasz się przez 5 poziomów lochów pełnych żołnierzy z blasterami i karabinami,
a na końcu rozdziału staczasz pojedynek z **Mrocznym Lordem** o czerwonym ostrzu.
Grafika, dźwięki, postacie i nazwy są autorskie – z inspiracji zapożyczona jest tylko mechanika.

## Uruchomienie

Bez instalacji i serwera: otwórz `index.html` w przeglądarce (działa z `file://`, offline).
Na telefonie/tablecie pojawiają się przyciski dotykowe ◀ ▶ ▼ ▲ ⚔.

## Sterowanie

| Klawisz | Akcja |
|---|---|
| ← → | bieg / obrót |
| Shift + ← → | ostrożny krok (zatrzymuje się na krawędzi i przed kolcami) |
| ↑ | skok w górę / podciągnięcie / wyjście przez drzwi; z rozbiegu – skok w dal |
| ↓ | kucnięcie (unik strzału); przy krawędzi – zwis; w zwisie – puszczenie |
| A | podniesienie przedmiotu; w walce – cios (szybkie 2× = kombo) |
| ↑ w walce | zasłona – odbija strzały i paruje ciosy |
| R | powtórz poziom |

## Poziomy

Ekran 320×200 px, 3 rzędy × 10 kafli (kafel 32 px, rząd 60 px). Definicje w `LEVELS` (`game.js`):

1. **Dach Cytadeli** – luźna płyta, rękojeść ostrza, śpiący żołnierz z blasterem, płyta i krata (bez kolców).
2. **Blok więzienny** – blaster i karabin, kolce, krata przy drzwiach.
3. **Kuźnia reaktora** – wspinaczka, duża mikstura (+1 życia), karabin i blaster.
4. **Zalane tunele** – luźne płyty, trzech strzelców.
5. **Sala Mrocznego Lorda** – karabin i boss z czerwonym ostrzem; drzwi otwierają się po jego pokonaniu.

Legenda: `_` podłoga · spacja – przepaść · `#` mur · `L` luźna płyta · `S` kolce · `W` rękojeść ·
`H` mikstura · `M` duża mikstura · `P` płyta naciskowa · `G` krata · `D` drzwi.

## Zasady

- Życie: trójkąty (start 3). Upadek o 1 rząd – bez obrażeń, o 2 – −1, o 3+ – śmierć.
- Po trafieniu chwila nietykalności (miganie).
- Żołnierze strzelają (blaster – pojedynczo, karabin – serią 2); kucnięcie przepuszcza strzał,
  zasłona lub cios w odpowiednim momencie odbija go we wroga. Z bliska żołnierz uderza kolbą.
- Mroczny Lord paruje, wyprowadza pchnięcia i serie cięć; sparowany cios go ogłusza.
- Krata otwiera się po naciśnięciu płyty i po chwili opada.

## Pliki

| Plik | Opis |
|---|---|
| `index.html` | płótna, ekran tytułowy, przyciski dotykowe; ładuje `game.js?v=N` |
| `game.js` | cała gra: poziomy, stan, fizyka, gracz, wrogowie, pułapki, rysowanie, światło, dźwięk, pętla |

Kluczowe funkcje: `loadLevel`, `newGame`, `restart`, `finishLevel`, `update(dt)` (stały krok 1/60 s),
`updPlayer`, `updTrooper`, `updLord`, `boltHitsPlayer`, `buildBG` (tło wg `THEMES`), `drawFig`
(style postaci `STY`), `slashPose` (animacja ciosów), `lighting` (mrok, światła, winieta),
`drawEmissive` (ostrza ze smugą, strzały, iskry), `draw`.

Grafika rysowana jest w 320×200 i skalowana pikselowo; napisy (`txt()`) trafiają na warstwę `#txt`
w pełnej rozdzielczości ekranu, więc są gładkie.

## Test

W konsoli przeglądarki dostępny jest obiekt `window.GOW` (`P`, `FOES`, `BOLTS`, `gate`, `lvl`, `game`,
`K`, `PR`, `LEVELS`, `update`, `draw`, `loadLevel`, `newGame`, `restart`, `start`, `STEP`).
Szybka kontrola składni: `node --check game.js`.
