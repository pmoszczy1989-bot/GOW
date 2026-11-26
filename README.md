# GOW – Rycerze Ostrza

Platformówka inspirowana klasycznym **Prince of Persia (1989)**, osadzona w realiach kosmicznej opowieści
o rycerzach z ostrzami energii. Spadasz z nieba na dach cytadeli, odnajdujesz rękojeść ostrza
(losowy kolor – nigdy czerwony) i przechodzisz sześć rozdziałów: **Cytadelę**, **pustynię Sarrak**,
**głębiny Thalos**, **lodowy Krio**, **leśny Verdan** i **wulkaniczny Ignis**. Między planetami lecisz myśliwcem. Każdy rozdział kończy Lord z czerwonym ostrzem.
Grafika, dźwięki, postacie i nazwy są autorskie – z inspiracji zapożyczona jest tylko mechanika.

## Uruchomienie

Bez instalacji i serwera: otwórz `index.html` w przeglądarce (działa z `file://`, offline).
Przycisk ⛶ w prawym górnym rogu (albo klawisz **F**) przełącza pełny ekran. Na komputerze na dole
widać pasek z podpowiedziami klawiszy.

**Telefon / tablet** – wykrywane automatycznie (dotyk + gruby wskaźnik albo brak myszy → klasa `body.touch`).
Gra skaluje się do ekranu (w pionie jest u góry, sterowanie pod nią). W lewym dolnym rogu jest gałka
(mocne wychylenie w bok – bieg, lekkie – ostrożny krok, w górę – skok, w dół – zwis/kucnięcie),
w prawym przyciski z ikonami: ostrze/cios, skok, przyciągnięcie, odepchnięcie, bieg aury, mega skok, schowanie ostrza.
Przyciski Z/X zmieniają ikonę i podpis zależnie od mocy przypisanej do slotu. Każdy przycisk ma pod ikoną nazwę i odpowiednik klawisza w nawiasie, np. `CIOS (A)`, `SKOK (↑)`, `TARCZA (Z)` – ułatwia to zwarcie ostrzy, gdzie sekwencja pokazuje klawisze.

## Sterowanie

| Klawisz | Akcja |
|---|---|
| ← → | bieg / obrót; pod wodą – pływanie |
| Shift + ← → | ostrożny krok (zatrzymuje się na krawędzi i przed kolcami) |
| D + ← → (trzymaj) | bieg aury: ~1,9× szybciej, przez ruchome piaski bez grzęźnięcia, skok z biegu o 35% dalej (−10 aury); zużywa aurę, przycisk ⏩ na dotyku |
| C | **mega skok** aury (−20 aury): znacznie dalej niż zwykły skok – potrzebny nad przepaściami szerszymi niż 3 kafle (podpowiedź na dole); przycisk ⤴ na dotyku |
| ↑ | skok w górę / podciągnięcie / wyjście przez drzwi; z rozbiegu – skok w dal; w powietrzu (Zwinność 3) – podwójny skok; pod wodą – w górę, przy brzegu – wyjście |
| ↑ + ← → w walce | skok z wyciągniętym ostrzem (A w powietrzu = cięcie z wyskoku) |
| ↓ | kucnięcie (unik strzału); przy krawędzi – zwis; w zwisie – puszczenie; pod wodą – w dół |
| A | podniesienie / użycie terminala lub konsoli; z ostrzem – wyciągnięcie i cios (seria 2–5 = kombo); cięcie odbija strzały i rozbija skrzynie |
| S | schowanie ostrza |
| Z / X | moc z 1. / 2. slotu (start: Przyciąganie / Odepchnięcie); po przyciągnięciu wroga szybko **A** = cios aury |
| U | drzewko umiejętności (←→↑↓ wybór, A – ulepsz, Z/X – przypisz moc do slotu, Esc/U – zamknij) |
| ↑ w walce | zasłona – odbija strzały i paruje ciosy |
| O | kolekcja ostrzy i osiągnięcia (←→↑↓ wybór, A – załóż ostrze, O/Esc – zamknij) |
| R | powtórz poziom |
| F | pełny ekran |

Lot statkiem: ←→↑↓ ruch, **A** działa (przytrzymaj), **Z** torpeda, **X** beczka (unik).

## Poziomy

Ekran 320×200 px, komnata 3 rzędy × 10 kafli (kafel 32 px, rząd 60 px). Poziom może mieć kilka komnat –
wyjście za krawędź ekranu przenosi do sąsiedniej. Definicje w `levels.js` (`LEVELS`, 35 poziomów):

- **Rozdział I – Cytadela**: Dach Cytadeli, Blok więzienny, Kuźnia reaktora, Zalane tunele, Sala Mrocznego Lorda.
- **Przelot**: Ucieczka z orbity (myśliwiec, eskadry, krążownik).
- **Rozdział II – Sarrak (pustynia)**: Wydmy Sarrak, Kanion Echa, Ruiny Świątyni Słońca, Grobowiec Burz, Tron Pani Burz
  (ruchome piaski, platformy, najeźdźcy w zawojach, Lord z dwustronnym ostrzem).
- **Przelot**: Blokada orbitalna (trudniejsza).
- **Rozdział III – Thalos (podwodna stacja)**: Stacja Thalos – śluza, Zatopione hangary, Rafa wraków, Kopuła Głębin,
  Leże Lorda Głębin (pływanie, tlen, wyloty powietrza, miny, drony, Lord z dwoma ostrzami).
- **Przelot**: Przełęcz Mgławicy.
- **Rozdział IV – Krio (lodowa planeta)**: Lodowe pustkowia, Jaskinie lodowe, Kriogeniczna forteca, Lodowy most,
  Tron Królowej Mrozu (śliski lód, żołnierze w bieli).
- **Pościg**: Pościg w lasach Verdan (ścigacz między pniami, zwiadowcy na ścigaczach strzelają do tyłu, X = skok).
- **Rozdział V – Verdan (planeta-las)**: Korony drzew, Wioska na palach, Świątynia w pniu, Bagna Verdanu,
  Gniazdo Łowcy (grzyby-trampoliny, zwiadowcy, bagna).
- **Przelot**: Szturm na flotę Arcylorda.
- **Rozdział VI – Ignis (planeta lawy)**: Pola lawy, Kuźnie Arcylorda, Rzeka ognia, Cytadela Popiołu,
  Tron Arcylorda (lawa, dysze ognia, żołnierze w popiele, finałowy Arcylord).

Każdy kolejny poziom jest trochę trudniejszy (więcej i silniejszych wrogów, krótsze okna, więcej pułapek).

Legenda: `_` podłoga · spacja – brak podłogi (w dolnym rzędzie przepaść, pod wodą dno) · `#` mur ·
`L` luźna płyta · `S` kolce · `W` rękojeść · `H` mikstura · `M` duża mikstura · `A` eliksir wigoru (zielony: +1 serce jednorazowo, znika przy pierwszej ranie lub z końcem poziomu) · `P` płyta naciskowa ·
`G` krata · `D` drzwi · `B` skrzynia · `O` kryształ · `C` kryształ ostrza (jeden na rozdział) · `T` terminal · `K` konsola · `E` bariera energetyczna ·
`Q` ruchome piaski · `U` wylot powietrza · `N` mina podwodna · `I` lód (ślizga się) · `J` grzyb-trampolina ·
`F` dysza ognia (parzy co kilka sekund) · `V` lawa (śmierć) · `X` blok aury · `Y` dźwignia. Motywy `theme` 0–11.
Wrogowie `k`: `blaster`, `rifle`, `shield` (tarczownik), `sniper` (snajper), `jet` (łowca z plecakiem odrzutowym), `drone`, `lord`.
Komnata: `{ map, foes, plats, wl, lore }` – `plats` ruchome platformy `{ r, c0, c1, sp }` (szerokie, 52 px),
`wl` poziom wody w px (125 – zalany dolny rząd, -100 – cała komnata pod wodą).

## Zasady

- Życie: trójkąty (start 3). Upadek o 1 rząd – bez obrażeń, o 2 – −1, o 3+ – śmierć.
- Wrogowie widzą cię dopiero z bliższej odległości (znak `?` – coś słyszą, `!` – zauważyli).
  Patrolują, trzymają dystans strzału, cofają się przed ostrzem. Blaster 3 trafienia, karabin 4 (później więcej).
  Kucnięcie przepuszcza strzał, zasłona lub cięcie odbija go we wroga.
- **Nowi wrogowie**: *tarczownik* blokuje ciosy i odbite strzały z przodu – zajdź go od tyłu albo ogłusz aurą;
  *snajper* celuje czerwonym laserem z daleka szybkim, mocnym strzałem i ucieka przed ostrzem;
  *łowca* lata na plecaku odrzutowym i strzela ukośnie – zestrzel go odbitym strzałem lub cięciem w powietrzu.
- **Skradanie**: wróg, który cię nie zauważył (śpi albo stoi tyłem), pada od jednego **cichego ciosu** (A).
  Bieg i lądowanie słychać z bliska – podchodź krokiem (Shift).
- **Zagadki aury**: blok `X` przesuwasz odepchnięciem (pchnij) i przyciągnięciem (do siebie); wepchnięty w szczelinę
  tworzy most, postawiony na płycie `P` trzyma kratę otwartą. Dźwignię `Y` przestawisz klawiszem A albo przyciągnięciem z daleka.
- **Droid BIP** (od rozdziału II) leci za tobą, co kilka sekund razi pobliskiego wroga i wskazuje ukryty kryształ ostrza w komnacie.
- Lord paruje i odskakuje. Pierwszy ma 5 żyć, każdy kolejny o 1 więcej (do 10). Pierwszy walczy sam, bez przeszkadzajek.
  **Fazy** dochodzą z kolejnymi planetami: od 2. Lorda (przy 70% życia) rzut wirującym ostrzem, które wraca do ręki
  (kucnij, żeby uniknąć; zasłona/cios odbija je w Lorda: −2), od 3. (przy 50%) furia i 2 drony,
  od 4. (przy 30%) sypie się strop – cień na podłodze ostrzega przed spadającym głazem.
  W walce szybkie wciśnięcie kierunku do tyłu obraca bohatera ku pomocnikowi (dronowi) za plecami.
- **Zwarcie ostrzy** (tylko Lordowie): gdy zasłonisz się przed ciosem, Lord sparuje twój cios albo sam naciera,
  ostrza mogą się sczepić. Świat prawie staje, a nad sceną pojawia się sekwencja klawiszy:
  **A** cięcie, **↑** nacisk, **Z**/**X** moc ze slotu (3–4 klawisze). Najpierw zapowiedź „ZWARCIE” z odliczaniem (1,3 s) pokazuje całą sekwencję,
  potem każdy klawisz trzeba wcisnąć w oknie 1–1,8 s (krótszym na późniejszych planetach i w furii, dłuższym ze Skupieniem).
  Wygrana zadaje 2 obrażenia (3 przy co najmniej dwóch mocach). Nazwa i efekt finiszera zależą od mocy
  (np. „BURZA + FALA”: Fala odrzuca Lorda, Burza/Zwód/Uścisk ogłuszają, Odnowa leczy, Tarcza osłania).
  Zły klawisz lub zwłoka: Lord przełamuje zwarcie i rani – tylko −1 życie, potem chwila ochrony.
- **Aura działa bez ostrza** – od początku możesz przyciągać i odpychać (tylko Rzut ostrzem wymaga rękojeści).
- **Dźwięk** syntezowany na żywo (WebAudio): buczenie zapalonego ostrza, „wuuum” przy cięciach, trzask zwarcia,
  „piu” blasterów, szum fali aury – w klimacie filmów, ale autorski.
- **Aura** (pasek pod życiem, odnawia się): przyciągnięcie uruchamia quick time event – szybkie **A**
  daje efektowne zakończenie; Lordowi zabiera 2 życia, ale Lord potrafi się opierać przyciąganiu
  i kontratakuje, gdy zareagujesz za wolno. Odepchnięcie odrzuca wrogów i strzały.
- **Kryształy**: dron +1, żołnierz +2, Lord +10, kryształ `O` na mapie, w locie statkiem premia za zestrzelenia.
  Każde 10 kryształów = 1 punkt umiejętności (**U**). Każda umiejętność ma 4 poziomy (start: poziom 1 – najmniejszy zasięg).
- **Drzewko umiejętności** (3 gałęzie): *Obrona* – Odepchnięcie, Tarcza aury, Omamienie, Uzdrowienie;
  *Ostrze* – Kombinacje (seria 2–5 cięć), Zwinność (dalsze skoki, miękkie lądowanie, podwójny skok),
  Rzut ostrzem, Skupienie (regeneracja aury); *Gniew* – Przyciąganie, Uścisk (duszenie), Pioruny aury, Witalność (bez wymagań, +1 maks. życie na poziom, do +4 – liczy się osobno od wielkich mikstur).
  Pod klawiszami Z i X można mieć maksymalnie **dwie moce**.
- Skoki: chwilowy zapas po zejściu z krawędzi (0,15 s) i zapamiętanie wciśnięcia ↑ przed lądowaniem, chwyt krawędzi w locie (z większą tolerancją).
- Wygodne sterowanie: **bufor wejścia** – ↑ lub A wciśnięte w trakcie lądowania, obrotu, zasłony czy użycia wykonuje się zaraz po animacji;
  szybki obrót przechodzi od razu w bieg; ↑ + kierunek do tyłu = skok z obrotem; z wyciągniętym ostrzem i bez wroga
  można biegać i zawracać; kolejny cios serii można wcisnąć wcześniej.
- Ostatni cios uruchamia finiszer w zwolnionym tempie – bez krwi (iskry, rozcięta broń, żar).
- Woda: pod wodą ubywa tlenu (pasek O₂); uzupełnia go powierzchnia i wylot `U`. Bez tlenu tracisz życie.
- Lód `I` ślizga się, grzyb `J` wybija wysoko, dysza `F` zieje ogniem cyklicznie, lawa `V` zabija.
- Ruchome piaski `Q` spowalniają i wciągają – nie zatrzymuj się. Miny `N` wybuchają przy dotyku (cięcie pod wodą je rozbraja).
- Krata otwiera się po naciśnięciu płyty, konsola `K` wyłącza bariery i blokuje kratę w górze.
- **Zapis**: gra zapisuje się na początku każdego poziomu (`localStorage` `gow_save`). Menu tytułowe: *Kontynuuj*,
  *Nowa gra* (N), wybór odblokowanego rozdziału (1–6). Postęp trwały – osiągnięcia, ostrza, rekordy – w `gow_meta`.
- **Kolekcja ostrzy** (**O**): kolory bazowe (rękojeść losuje nieczerwony kolor, pokonany Lord zostawia nowy) oraz
  6 ostrzy specjalnych z ukrytych kryształów `C` (po jednym na rozdział): bursztynowe (szybsza aura),
  srebrne (dłuższy zasięg), turkusowe (dwa ostrza, +1 kombo), różane (+1 kryształ za wroga),
  złote (szansa na podwójne obrażenia), pryzmatyczne (zmienia kolor, tańsze moce).
- **Osiągnięcia** (17) – wyskakują jako komunikat u góry ekranu, lista w kolekcji.
- **Fabuła**: przekazy holograficzne Ael przed każdym rozdziałem. Pioruny i uścisk przybliżają ku ciemności;
  w finale wybierasz zakończenie (światło / gniew).

## Pliki

| Plik | Opis |
|---|---|
| `index.html` | płótna, ekran tytułowy, przycisk ⛶, pasek klawiszy `#keys`, sterowanie dotykowe `#touch` (`#stick`/`#knob`, `button[data-k]`); ładuje skrypty `?v=N` |
| `meta.js` | zapis (`saveRun`/`runSave`), menu tytułowe (`buildMenu`), kolekcja ostrzy (`XBLADES`, `drawGear`), osiągnięcia (`ACHV`/`achv`), fabuła (`STORY`, `showStory`) – ładowany pierwszy |
| `levels.js` | `LEVELS` – definicje poziomów i komnat |
| `game.js` | silnik: wejście (klawiatura, dotyk, pełny ekran), stan, komnaty, fizyka, gracz, wrogowie, aura, QTE, pływanie, pułapki, rysowanie, światło, dźwięk, pętla |
| `ship.js` | poziomy lotu statkiem (`startShip`, `updShip`, `drawShip`, `shipHint`, `SHIP`) |

Kolejność skryptów: `meta.js → levels.js → game.js → ship.js`.

Kluczowe funkcje: `loadLevel`, `mkRoom`/`enterRoom`/`roomCheck` (komnaty), `update(dt)` (krok 1/60 s),
`updPlayer`, `SKILLS`/`skl`/`drawTree` (drzewko, sloty `game.slots`), `auraPull`/`auraPush`/`updQte`, `ventOn`, `startSwim`/`updO2`, `updPlats`, `updMines`, `startFinisher`,
`hitFoe`, `updTrooper`, `updLord`, `buildBG` (tło wg `THEMES`, klucz `BGS[lvl:komnata]`), `drawFig` (style `STY`),
`gait` (chód/bieg z kinematyką nóg), `drawWater`, `drawAuraFx`, `lighting`, `drawEmissive`, `draw`, `drawWin`, `fit`.

Współrzędne gry to 320×200; płótno renderuje w 2–4× wyższej rozdzielczości (`RS`). Napisy (`txt()`) trafiają na
warstwę `#txt` w pełnej rozdzielczości ekranu.

## Test

W konsoli przeglądarki dostępny jest obiekt `window.GOW` (`P`, `FOES`, `BOLTS`, `gate`, `lvl`, `ROOMS`, `ri`, `RD`,
`MINES`, `PLATS`, `SHIP`, `game`, `K`, `PR`, `LEVELS`, `update`, `draw`, `loadLevel`, `enterRoom`, `newGame`,
`restart`, `start`, `STEP`). Przykład – każdy poziom bez wyjątków:

```js
window.requestAnimationFrame = () => {};
for (let i = 0; i < GOW.LEVELS.length; i++) {
  GOW.loadLevel(i);
  for (let s = 0; s < 600; s++) { GOW.update(GOW.STEP); for (const k in GOW.PR) delete GOW.PR[k]; }
  GOW.draw();
}
```

Szybka kontrola składni: `node --check meta.js game.js levels.js ship.js` (każdy plik osobno).
