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
| A | podniesienie przedmiotu / użycie terminala lub konsoli; z ostrzem – wyciągnięcie ostrza i od razu cios (szybkie 2× = kombo); cięcie odbija strzały i rozbija skrzynie |
| S | schowanie ostrza |
| ↑ w walce | zasłona – odbija strzały i paruje ciosy |
| R | powtórz poziom |

## Poziomy

Ekran 320×200 px, 3 rzędy × 10 kafli (kafel 32 px, rząd 60 px). Definicje w `LEVELS` (`game.js`):

1. **Dach Cytadeli** – luźna płyta, rękojeść ostrza, śpiący żołnierz z blasterem, skrzynia, terminal, płyta i krata.
2. **Blok więzienny** – blaster i karabin, kolce, konsola i bariera energetyczna, krata przy drzwiach.
3. **Kuźnia reaktora** – wspinaczka, duża mikstura (+1 życia), skrzynia, terminal, karabin i blaster.
4. **Zalane tunele** – luźne płyty, bariera i konsola, trzech strzelców.
5. **Sala Mrocznego Lorda** – karabin i boss z czerwonym ostrzem; drzwi otwierają się po jego pokonaniu.

Legenda: `_` podłoga · spacja – przepaść · `#` mur · `L` luźna płyta · `S` kolce · `W` rękojeść ·
`H` mikstura · `M` duża mikstura · `P` płyta naciskowa · `G` krata · `D` drzwi · `B` skrzynia ·
`O` kryształ energii · `T` terminal z zapiskami · `K` konsola · `E` bariera energetyczna.

## Zasady

- Życie: trójkąty (start 3). Upadek o 1 rząd – bez obrażeń, o 2 – −1, o 3+ – śmierć.
- Po trafieniu chwila nietykalności (miganie).
- Żołnierze patrolują swój odcinek; widzą tylko przed sobą (z bliska też słyszą). Gdy cię zauważą,
  trzymają dystans strzału, cofają się przed ostrzem, przestępują i po trafieniu czasem odskakują.
  Blaster – pojedyncze strzały, 3 trafienia; karabin – seria 2, 4 trafienia (od poziomu 4 obaj +1).
  Kucnięcie przepuszcza strzał, zasłona lub cięcie odbija go we wroga. Z bliska żołnierz uderza kolbą.
- Mroczny Lord (10 trafień) paruje, robi odskoki i pchnięcia; przy 5 życiach wpada w furię (szybszy).
- Ostatni cios uruchamia finiszer w zwolnionym tempie z pasami kinowymi (wirowe cięcie, cios z wyskoku
  albo pchnięcie): broń żołnierza zostaje rozcięta, a Lord gaśnie i rozpada się w żar – bez krwi.
- Krata otwiera się po naciśnięciu płyty i po chwili opada. Konsola `K` wyłącza bariery i blokuje kratę w górze.
- Bariera `E` pulsuje (2 s włączona, 1,2 s wyłączona, przed włączeniem miga); dotknięcie – −1 życia.
- Kryształy `O` zbiera się w biegu (licznik ◆ w rogu); skrzynie `B` rozbija cięcie – w środku
  mikstura (gdy brakuje życia) albo kryształ.

## Pliki

| Plik | Opis |
|---|---|
| `index.html` | płótna, ekran tytułowy, przyciski dotykowe; ładuje `game.js?v=N` |
| `game.js` | cała gra: poziomy, stan, fizyka, gracz, wrogowie, pułapki, rysowanie, światło, dźwięk, pętla |

Kluczowe funkcje: `loadLevel`, `newGame`, `restart`, `finishLevel`, `update(dt)` (stały krok 1/60 s),
`updPlayer`, `drawStrike`, `startFinisher` (`FIN`), `hitFoe`, `updTrooper` (`patrol`, `foeMove`), `updLord`,
`boltHitsPlayer`, `tryUse`, `breakCrate`, `updBarriers`, `debris`/`updDebris`, `buildBG` (tło wg `THEMES`),
`drawFig` (style postaci `STY`), `slashPose`/`finPose` (animacje ciosów), `lighting` (mrok, światła, winieta),
`drawEmissive` (ostrza ze smugą, strzały, iskry), `draw`.

Współrzędne gry to 320×200, ale płótno renderuje w 2–4× wyższej rozdzielczości (`RS`, wg ekranu) –
gładkie linie, zaokrąglone kształty i poświaty zamiast pikseli. Napisy (`txt()`) trafiają na warstwę `#txt`
w pełnej rozdzielczości ekranu, więc są gładkie.

## Test

W konsoli przeglądarki dostępny jest obiekt `window.GOW` (`P`, `FOES`, `BOLTS`, `gate`, `lvl`, `game`,
`K`, `PR`, `LEVELS`, `update`, `draw`, `loadLevel`, `newGame`, `restart`, `start`, `STEP`).
Szybka kontrola składni: `node --check game.js`.
