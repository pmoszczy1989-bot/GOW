'use strict';
// GOW – jednoekranowa platformówka pixel-art w hołdzie klasycznemu Prince of Persia (1989),
// przeniesiona w autorski świat kosmicznych rycerzy walczących ostrzami energii.
// Grafika, dźwięki, fabuła i projekt poziomów są autorskie; z klasyka wzorowana jest tylko mechanika
// (ostrożny krok, skok z rozbiegu, podciąganie na krawędzi, kruszące się płyty, kolce,
// krata z płytą naciskową, pojedynek z zasłoną, mikstury, trójkąty życia).

// ===== Stałe =====
const SW = 320, SH = 200;           // wewnętrzna rozdzielczość (skalowana CSS-em)
const TW = 32, RH = 60;             // szerokość kafla, wysokość rzędu [px]
const COLS = 10, ROWS = 3;
const GRAV = 620;                   // grawitacja [px/s²]
const HW = 6;                       // połowa szerokości postaci
const HANG_DY = 33;                 // stopy wiszącej postaci poniżej krawędzi
const STEP = 1 / 60;

// Legenda map: _ podłoga, spacja – brak podłogi (w dolnym rzędzie przepaść), # mur,
// L luźna płyta, S kolce, W rękojeść ostrza, H mała mikstura, M duża mikstura (+1 życie),
// P płyta naciskowa (otwiera kraty), G krata, D drzwi wyjściowe,
// B skrzynia (cięcie ją rozbija – w środku kryształ lub mikstura), O kryształ (zbierany w biegu),
// T terminal z zapiskami (A – odczytaj), K konsola (A – wyłącza bariery i blokuje kraty w górze),
// E bariera energetyczna (pulsuje: włączona parzy i blokuje przejście oraz strzały).
// Przeciwnicy: blaster – pojedyncze strzały (3 trafienia), rifle – karabin, seria 2 strzałów
// (4 trafienia; od poziomu 4 obaj +1), lord – boss na końcu rozdziału z czerwonym ostrzem (10 trafień).
const LEVELS = [
  { name: 'Dach Cytadeli', theme: 0, sky: true,
    map: ['O__L   __W',
          '##__B____ ',
          '#DT_G_H__P'],
    start: { r: 0, c: 1, dir: 1 },
    lore: 'Dziennik strażnika: „Rękojeść ze skarbca leży na dachu. Lord zabronił jej dotykać.”',
    foes: [{ k: 'blaster', r: 1, c: 8, dir: -1, sleep: true }] },
  { name: 'Blok więzienny', theme: 1,
    map: ['#___O_ __#',
          ' __SK_E___',
          'B_P__ __GD'],
    start: { r: 0, c: 1, dir: 1 },
    foes: [{ k: 'blaster', r: 0, c: 8, dir: -1 }, { k: 'rifle', r: 1, c: 1, dir: 1 }] },
  { name: 'Kuźnia reaktora', theme: 2,
    map: ['TH_ ___PGD',
          'O_ _S___ M',
          '#__B__ __#'],
    start: { r: 2, c: 1, dir: 1 },
    lore: 'Rejestr kuźni: „Reaktor zasila ostrze Lorda. Zapasowe kryształy trzymamy w skrzyniach.”',
    foes: [{ k: 'rifle', r: 2, c: 8, dir: -1 }, { k: 'blaster', r: 0, c: 6, dir: -1 }] },
  { name: 'Zalane tunele', theme: 3,
    map: ['#__LO_L_ _',
          ' __G_B_P_K',
          '_H_S__E__D'],
    start: { r: 0, c: 1, dir: 1 },
    foes: [{ k: 'blaster', r: 1, c: 1, dir: 1 }, { k: 'rifle', r: 2, c: 5, dir: -1 }, { k: 'blaster', r: 2, c: 7, dir: -1 }] },
  { name: 'Sala Mrocznego Lorda', theme: 4, lock: true,
    map: ['#_OS___ ##',
          '#T_ __B_H#',
          '#________D'],
    start: { r: 0, c: 1, dir: 1 },
    lore: 'Ostatni wpis: „Gdy Lord uderza w twoją zasłonę, na chwilę traci równowagę. Wtedy tnij.”',
    foes: [{ k: 'rifle', r: 1, c: 5, dir: -1 }, { k: 'lord', r: 2, c: 7, dir: -1 }] },
];

// Kolory ostrza bohatera – losowane przy znalezieniu rękojeści (nigdy czerwony – to kolor Lordów)
const BLADES = [
  { name: 'niebieskim', col: '#3a9cff', rgb: '60,150,255' },
  { name: 'zielonym', col: '#40ff60', rgb: '70,255,100' },
  { name: 'fioletowym', col: '#b060ff', rgb: '170,90,255' },
  { name: 'żółtym', col: '#ffe040', rgb: '255,220,60' },
  { name: 'błękitnym', col: '#40f0ff', rgb: '60,235,255' },
  { name: 'białym', col: '#e8f0ff', rgb: '220,230,255' },
];
const RED = { col: '#ff3030', rgb: '255,40,40' };

const floorY = r => (r + 1) * RH - 5;
const colOf = x => Math.floor(x / TW);
const lerp = (a, b, k) => a + (b - a) * k;
const ease = k => 1 - (1 - k) * (1 - k);
const HANGST = ['hang', 'climb', 'climbdown', 'reach'];
const FIGHTST = ['fight', 'fstep', 'strike', 'block', 'fin'];

// ===== Płótno i skalowanie =====
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
// Renderowanie w wyższej rozdzielczości (RS pikseli płótna na 1 jednostkę gry) – gładka grafika
let RS = 2;
cv.width = SW * RS; cv.height = SH * RS;

// Warstwa tekstu w pełnej rozdzielczości ekranu – napisy są gładkie, nie pikselowe
const tv = document.getElementById('txt');
const tctx = tv.getContext('2d');
let TS = 1;                                 // piksele warstwy tekstu na 1 piksel gry

function fit() {
  const W = window.innerWidth, H = window.innerHeight;
  let s = Math.min(W / SW, H / SH);
  const i = Math.floor(s);
  if (i >= 1 && i >= s * 0.85) s = i;      // całkowita skala, jeśli niewiele tracimy
  const cw = Math.floor(SW * s), ch = Math.floor(SH * s), dpr = window.devicePixelRatio || 1;
  cv.style.width = tv.style.width = cw + 'px';
  cv.style.height = tv.style.height = ch + 'px';
  tv.width = Math.round(cw * dpr); tv.height = Math.round(ch * dpr);
  TS = tv.width / SW;
  RS = Math.min(4, Math.max(2, Math.ceil(TS)));
  if (cv.width !== SW * RS) { cv.width = SW * RS; cv.height = SH * RS; }
}
window.addEventListener('resize', fit);
fit();

// ===== Dźwięk (WebAudio, proste syntezy) =====
let AC = null;
function audioOn() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } }
  if (AC && AC.state === 'suspended') AC.resume();
}
function tone(f, d, type, v, f2, delay) {
  if (!AC) return;
  const t0 = AC.currentTime + (delay || 0);
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + d);
  g.gain.setValueAtTime(v || 0.05, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  o.connect(g); g.connect(AC.destination);
  o.start(t0); o.stop(t0 + d + 0.02);
}
const melody = (notes, len, type, v) => notes.forEach((f, i) => f && tone(f, len * 0.95, type, v, 0, i * len));
const SND = {
  thud: () => tone(110, 0.16, 'triangle', 0.14, 40),
  swing: () => { tone(150, 0.2, 'sawtooth', 0.035, 70); tone(310, 0.16, 'triangle', 0.03, 130); },
  clash: () => { tone(1800, 0.1, 'square', 0.04, 600); tone(2700, 0.08, 'sawtooth', 0.03, 900); tone(90, 0.15, 'sawtooth', 0.05, 60); },
  hit: () => { tone(220, 0.18, 'sawtooth', 0.07, 50); tone(900, 0.06, 'square', 0.03, 300); },
  blast: () => tone(1500, 0.13, 'square', 0.03, 160),
  deflect: () => { tone(2300, 0.08, 'square', 0.035, 700); tone(480, 0.12, 'sawtooth', 0.03, 1300); },
  ignite: () => { tone(70, 0.4, 'sawtooth', 0.05, 260); tone(140, 0.35, 'square', 0.02, 420); },
  crash: () => { tone(160, 0.35, 'sawtooth', 0.07, 40); tone(90, 0.3, 'triangle', 0.1, 30); },
  rattle: () => { for (let i = 0; i < 3; i++) tone(200 + i * 40, 0.04, 'square', 0.03, 0, i * 0.05); },
  click: () => tone(320, 0.06, 'square', 0.05, 160),
  gem: () => melody([988, 1319, 1760], 0.06, 'triangle', 0.05),
  zap: () => { tone(60, 0.25, 'sawtooth', 0.08, 120); tone(1200, 0.12, 'square', 0.03, 300); },
  slash: () => { tone(90, 0.5, 'sawtooth', 0.06, 40); tone(2600, 0.25, 'triangle', 0.03, 500); },
  tick: () => tone(150, 0.03, 'square', 0.025),
  alarm: () => melody([880, 660, 880, 660], 0.11, 'square', 0.03),
  die: () => melody([392, 330, 262, 196, 0, 131], 0.2, 'square', 0.05),
  lord: () => melody([110, 104, 98, 0, 73], 0.25, 'sawtooth', 0.05),
  sword: () => melody([392, 523, 659, 0, 523, 659, 784, 1047], 0.13, 'square', 0.05),
  drink: () => melody([523, 587, 659, 784, 880], 0.08, 'triangle', 0.07),
  win: () => melody([523, 659, 784, 1047, 0, 784, 1047, 1319], 0.16, 'square', 0.05),
};

// ===== Wejście =====
// Strzałki – ruch, A – wyciągnij ostrze / cios / podnieś / użyj, S – schowaj ostrze,
// Shift – ostrożny krok, R – powtórz poziom.
const K = {}, PR = {};
const KEYMAP = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Shift: 'walk' };
const keyOf = e => (e.code === 'KeyA' || e.key === 'a' || e.key === 'A') ? 'act'
  : (e.code === 'KeyS' || e.key === 's' || e.key === 'S') ? 'sheathe' : KEYMAP[e.key];
function press(k) { if (!K[k]) PR[k] = true; K[k] = true; }
function release(k) { K[k] = false; }

window.addEventListener('keydown', e => {
  if (game.mode === 'title') { start(); e.preventDefault(); return; }
  if (e.key === 'r' || e.key === 'R') { restart(); return; }
  const k = keyOf(e);
  if (game.mode === 'win' && (e.key === 'Enter' || k === 'act')) { newGame(); return; }
  if (k) { e.preventDefault(); press(k); }
});
window.addEventListener('keyup', e => { const k = keyOf(e); if (k) release(k); });
window.addEventListener('blur', () => { for (const k in K) K[k] = false; });

const titleEl = document.getElementById('title');
titleEl.addEventListener('pointerdown', e => { e.preventDefault(); start(); });
if ('ontouchstart' in window || (window.matchMedia && matchMedia('(pointer:coarse)').matches)) {
  document.body.classList.add('touch');
}
document.querySelectorAll('#touch button').forEach(b => {
  const k = b.dataset.k;
  const on = e => {
    e.preventDefault(); audioOn();
    if (k === 'act' && game.mode === 'win') { newGame(); return; }
    if (k === 'act' && P.st === 'dead' && P.t > 1.5) { restart(); return; }
    press(k); b.classList.add('on');
  };
  const off = e => { e.preventDefault(); release(k); b.classList.remove('on'); };
  b.addEventListener('pointerdown', on);
  b.addEventListener('pointerup', off);
  b.addEventListener('pointercancel', off);
  b.addEventListener('pointerleave', off);
});

// ===== Stan gry =====
let lvl = 0, LV, MAP, P, FOES, LOOSE, BOLTS, gate, gateT, gateTick, spikes, parts, msg, flash, lamps, DEBRIS, used;
const game = { mode: 'title', time: 0, anim: 0, blade: BLADES[0], maxHp: 3, lvlMax: 3, shake: 0, stop: 0, trans: 0, hud: null,
  crys: 0, crysLvl: 0, slowT: 0, bars: 0, finName: '' };

function say(text, sec) { msg = { text, t: sec || 3 }; }

function mkFoe(f) {
  const hp = f.k === 'lord' ? 10 : Math.min(5, (f.k === 'rifle' ? 4 : 3) + (lvl >= 3 ? 1 : 0));
  return {
    k: f.k, x: f.c * TW + 16, y: floorY(f.r), r: f.r, dir: f.dir, hx: f.c * TW + 16,
    st: f.sleep ? 'sleep' : f.k === 'lord' ? 'meditate' : 'idle', t: 0, hp, max: hp, alive: true,
    cd: 1.1 + Math.random() * 0.7, vx: 0, vy: 0, air: false, hit: false, shots: 0, ft: 0,
    white: 0, mf: 0, bb: 0, trail: [], aw: false, lost: 0, wait: Math.random(), mv: 0, sd: 0, sdt: 0, fury: false,
  };
}

function loadLevel(i) {
  lvl = i; LV = LEVELS[i];
  MAP = LV.map.map(s => s.split(''));
  game.lvlMax = game.maxHp;
  const s = LV.start, sky = !!LV.sky;
  P = {
    x: s.c * TW + 16, y: sky ? -70 : floorY(s.r), r: s.r, dir: s.dir, st: sky ? 'fall' : 'stand', t: 0,
    vx: 0, vy: 0, air: sky, fallY: sky ? -70 : floorY(s.r), soft: sky, hp: game.maxHp, max: game.maxHp,
    sword: i > 0, drawn: false, hang: null, hit: false, fd: 0, inv: 0, combo: 0, q: false, ign: 0, trail: [],
  };
  FOES = LV.foes.map(mkFoe);
  LOOSE = []; spikes = {}; lamps = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (MAP[r][c] === 'L') LOOSE.push({ r, c, st: 'ok', t: 0, y: 0, vy: 0, rr: -1 });
    if (MAP[r][c] === 'S') spikes[r + ',' + c] = 0;
  }
  for (let r = sky ? 1 : 0; r < ROWS; r++) for (const c of [1, 4, 8]) {
    const ch = MAP[r][c];
    if (ch !== '#' && ch !== 'D' && ch !== 'G') lamps.push({ x: c * TW + 16, y: floorY(r) - 36 });
  }
  BOLTS = []; parts = []; DEBRIS = []; flash = null; used = false;
  gate = 0; gateT = 0; gateTick = 0;
  game.shake = 0; game.stop = 0; game.hud = null; game.slowT = 0; game.bars = 0;
  game.crysLvl = game.crys;
  game.mode = 'play';
  if (!BGS[i]) BGS[i] = buildBG(LV);
  say(sky ? 'Spadasz z nocnego nieba...' : 'Poziom ' + (i + 1) + ': ' + LV.name, 2.5);
}

function newGame() { game.maxHp = 3; game.time = 0; game.crys = 0; loadLevel(0); }
function restart() {
  if (game.mode === 'title') { start(); return; }
  if (game.mode === 'win') { newGame(); return; }
  if (game.mode === 'trans') return;
  game.maxHp = game.lvlMax; game.crys = game.crysLvl; loadLevel(lvl);
}
function start() {
  audioOn();
  titleEl.classList.add('hide');
  newGame();
}
function finishLevel() {
  game.maxHp = P.max;
  if (lvl < LEVELS.length - 1) { game.mode = 'trans'; game.trans = 0; }
  else { game.mode = 'win'; SND.win(); }
}

// ===== Mapa =====
function cell(r, c) {
  if (c < 0 || c >= COLS || r >= ROWS) return '#';
  if (r < 0) return ' ';
  return MAP[r][c];
}
const looseAt = (r, c) => LOOSE.find(L => L.r === r && L.c === c);
function hasFloor(r, c) {
  const ch = cell(r, c);
  if (ch === ' ' || ch === '#') return false;
  if (ch === 'L') { const L = looseAt(r, c); return !L || L.st === 'ok' || L.st === 'shake'; }
  return true;
}
const isWall = (r, c) => cell(r, c) === '#';
const gateBlocks = (r, c) => cell(r, c) === 'G' && gate < 0.8;
// Bariera energetyczna pulsuje (2 s włączona, 1,2 s wyłączona); konsola K wyłącza ją na stałe
const barrierOn = c => !used && ((game.anim + c * 0.37) % 3.2) < 2;
const barBlocks = (r, c) => cell(r, c) === 'E' && barrierOn(c);
const doorOpen = () => !LV.lock || !FOES.some(f => f.k === 'lord' && f.alive);

// Czy między dwoma punktami w rzędzie nie ma muru, zamkniętej kraty ani bariery (linia strzału)?
function los(r, a, b) {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  for (let c = colOf(lo); c <= colOf(hi); c++) {
    if (isWall(r, c)) return false;
    if (gateBlocks(r, c) || barBlocks(r, c)) { const gx = c * TW + TW / 2; if (gx > lo && gx < hi) return false; }
  }
  return true;
}

// Ruch poziomy z kolizją ze ścianami, kratą i barierą (blokują tylko wejście na linię środka kafla).
function moveX(o, dx, r) {
  if (!dx) return true;
  const s = Math.sign(dx);
  const nx = o.x + dx;
  const c0 = colOf(o.x + s * HW), c1 = colOf(nx + s * HW);
  if (c1 !== c0 && isWall(r, c1)) {
    o.x = s > 0 ? c1 * TW - HW - 0.01 : (c1 + 1) * TW + HW + 0.01;
    return false;
  }
  for (let c = 0; c < COLS; c++) {
    const bar = barBlocks(r, c);
    if (!gateBlocks(r, c) && !bar) continue;
    const gx = c * TW + TW / 2;
    let hit = false;
    if (s > 0 && o.x + HW <= gx && nx + HW > gx) { o.x = gx - HW; hit = true; }
    if (s < 0 && o.x - HW >= gx && nx - HW < gx) { o.x = gx + HW; hit = true; }
    if (hit) { if (bar && o === P) zap(-s); return false; }
  }
  o.x = nx;
  return true;
}

// Fizyka lotu; zwraca numer rzędu, na którym wylądowano, ROWS przy upadku w przepaść, albo -1.
function air(o, dt) {
  const py = o.y;
  o.vy = Math.min(o.vy + GRAV * dt, 420);
  o.y += o.vy * dt;
  const br = Math.max(0, Math.floor((o.y - 14) / RH));
  if (!moveX(o, o.vx * dt, br)) o.vx = 0;
  if (o.vy > 0) {
    for (let r = 0; r < ROWS; r++) {
      const fy = floorY(r);
      if (py <= fy && o.y >= fy && hasFloor(r, colOf(o.x))) {
        o.y = fy; o.r = r; o.air = false; o.vy = 0;
        return r;
      }
    }
  }
  if (o.y > SH + 60) { o.air = false; return ROWS; }
  return -1;
}

// ===== Cząsteczki (e = świecące, rysowane po oświetleniu) =====
function burst(x, y, n, col, sp, up, e) {
  for (let i = 0; i < n; i++) {
    parts.push({
      x, y, vx: (Math.random() - 0.5) * sp, vy: -Math.random() * (up || sp * 0.6),
      life: 0.3 + Math.random() * 0.5, col, e: !!e,
    });
  }
}
function sparks(x, y, rgbCol, n) {
  burst(x, y, n || 10, rgbCol, 140, 90, true);
  burst(x, y, 4, '#ffffff', 90, 60, true);
}
const shake = v => { game.shake = Math.max(game.shake, v); };

// Unoszące się w górę żarzące się drobiny (rozpad Lorda)
function embers(x, y, n, col) {
  for (let i = 0; i < n; i++) {
    parts.push({ x: x + (Math.random() - 0.5) * 12, y: y - Math.random() * 30, vx: (Math.random() - 0.5) * 24,
      vy: -15 - Math.random() * 35, life: 0.6 + Math.random() * 0.9, col, e: true, g: -20 });
  }
}
// Odłamki (przecięta broń, deski skrzyni, rękojeść Lorda) – obracają się i odbijają od podłogi
function debris(x, y, r, vx, vy, len, col, hot) {
  DEBRIS.push({ x, y, r, vx, vy, a: Math.random() * 6, va: (Math.random() - 0.5) * 24, len, col, hot: hot || 0, life: 2.5 });
}
function updDebris(dt) {
  for (const d of DEBRIS) {
    d.vy = Math.min(d.vy + GRAV * dt, 400); d.x += d.vx * dt; d.y += d.vy * dt; d.a += d.va * dt;
    d.life -= dt; d.hot = Math.max(0, d.hot - dt);
    const fy = floorY(d.r);
    if (d.vy > 0 && d.y >= fy - 1 && d.y - d.vy * dt <= fy && hasFloor(d.r, colOf(d.x))) {
      d.y = fy - 1; d.vy *= -0.35; d.vx *= 0.55; d.va *= 0.5;
      if (Math.abs(d.vy) < 25) { d.vy = 0; d.vx *= 0.5; d.va = 0; }
    } else if (d.y > fy + 4 && d.r < ROWS - 1) d.r++;
  }
  DEBRIS = DEBRIS.filter(d => d.life > 0 && d.y < SH + 20);
}

// ===== Gracz =====
const playerOnRow = r => !P.air && P.r === r && P.st !== 'dead' && HANGST.indexOf(P.st) < 0;
const fightable = f => f.alive && !f.air && !['sleep', 'meditate', 'rise'].includes(f.st);

// Najbliższy przeciwnik, z którym gracz wchodzi w pozycję walki
function engaged() {
  if (P.air || HANGST.indexOf(P.st) >= 0 || P.st === 'dead') return null;
  let best = null, bd = 1e9;
  for (const f of FOES) {
    if (!fightable(f) || f.r !== P.r) continue;
    const d = Math.abs(f.x - P.x), rg = f.k === 'lord' ? 110 : 72;
    if (d < rg && d < bd && los(P.r, P.x, f.x)) { best = f; bd = d; }
  }
  return best;
}

function die(kind) {
  if (P.st === 'dead') return;
  P.st = 'dead'; P.t = 0; P.hp = 0; P.air = false; P.vx = 0; P.vy = 0; P.kind = kind;
  SND.die(); shake(3);
  flash = { col: '#c00000', t: 0.25 };
  const t = { kolce: 'Kolce przebiły cię na wylot.', upadek: 'Upadek z tej wysokości był zabójczy.',
    strzal: 'Strzał z blastera dosięgnął celu.', kolba: 'Żołnierz powalił cię kolbą.',
    lord: 'Mroczny Lord cię pokonał.', gruz: 'Przygniótł cię gruz.', bariera: 'Bariera energetyczna cię poraziła.' };
  say(t[kind] || 'Zginąłeś.', 99);
}

function hurtPlayer(n, pushDir, kind) {
  if (P.st === 'dead' || P.inv > 0) return;
  P.hp -= n; P.inv = 0.8;                     // krótka nietykalność – seria nie zabija od razu
  flash = { col: '#ff0000', t: 0.12 };
  SND.hit(); shake(2);
  burst(P.x, P.y - 18, 6, '#d8c8a0', 50);
  if (P.hp <= 0) { die(kind); return; }
  if (!P.air && HANGST.indexOf(P.st) < 0 && P.st !== 'sword' && P.st !== 'drink') {
    P.st = 'hurt'; P.t = 0;
    if (pushDir) { moveX(P, pushDir * 8, P.r); groundCheck(false); }
  }
}

function startFall(vx) {
  P.st = 'fall'; P.t = 0; P.air = true; P.vy = 0; P.vx = vx; P.fallY = floorY(P.r);
}

// Porażenie barierą energetyczną – odrzut i utrata życia
function zap(dir) {
  if (P.inv > 0 || P.st === 'dead') return;
  SND.zap(); sparks(P.x, P.y - 16, '#ffa040', 10);
  hurtPlayer(1, dir, 'bariera');
}

// Po ruchu po podłodze: brak podłogi → spadanie, kolce → śmierć (poza ostrożnym krokiem).
function groundCheck(running) {
  const c = colOf(P.x);
  if (!hasFloor(P.r, c)) { startFall(running ? P.dir * 40 : 0); return false; }
  if (cell(P.r, c) === 'S' && P.st !== 'step') {
    spikes[P.r + ',' + c] = 1; die('kolce'); return false;
  }
  return true;
}

function jump(vx) {
  P.st = 'jump'; P.t = 0; P.air = true;
  P.vx = P.dir * vx; P.vy = -165; P.fallY = floorY(P.r);
  SND.swing();
}

function landP(r) {
  const rows = Math.round((floorY(r) - P.fallY) / RH);
  const c = colOf(P.x);
  P.vx = 0; P.vy = 0; P.st = 'land'; P.t = 0;
  if (r >= ROWS) { die('upadek'); return; }
  if (cell(r, c) === 'S') { spikes[r + ',' + c] = 1; die('kolce'); return; }
  burst(P.x, P.y, 6, '#a89878', 40, 20);
  if (P.soft) {
    P.soft = false; P.ld = 0.9; SND.thud(); shake(2);
    say('Dach cytadeli... Gdzieś tu musi leżeć rękojeść ostrza.', 4);
    return;
  }
  if (rows >= 3) { die('upadek'); return; }
  if (rows === 2) {
    P.hp--; P.ld = 0.8; SND.thud(); SND.hit(); shake(2); flash = { col: '#ff0000', t: 0.12 };
    if (P.hp <= 0) die('upadek'); else say('Auć! Twardy upadek.', 2);
  } else if (rows === 1) { P.ld = 0.4; SND.thud(); }
  else P.ld = 0.08;
}

function tryUp() {
  const r = P.r, c = colOf(P.x);
  if (r < 1 || hasFloor(r - 1, c) || isWall(r - 1, c)) return false;
  if (!hasFloor(r - 1, c + P.dir)) return false;
  const ex = P.dir > 0 ? (c + 1) * TW : c * TW;
  if (Math.abs(ex - P.x) > 28) return false;
  P.hang = { r: r - 1, ex };
  P.st = 'reach'; P.t = 0; P.ry = P.y; P.x = ex - P.dir * HW;
  return true;
}

function tryHangDown() {
  const r = P.r, c = colOf(P.x);
  if (r >= ROWS - 1) return false;
  for (const s of [-P.dir, P.dir]) {
    const nc = c + s;
    if (nc < 0 || nc >= COLS || hasFloor(r, nc) || isWall(r, nc) || isWall(r + 1, nc)) continue;
    const ex = s > 0 ? (c + 1) * TW : c * TW;
    if (Math.abs(ex - P.x) > 16) continue;
    P.dir = -s; P.hang = { r, ex };
    P.st = 'climbdown'; P.t = 0;
    P.x = ex + s * HW; P.y = floorY(r) + HANG_DY;
    return true;
  }
  return false;
}

function tryPick() {
  const ch = cell(P.r, colOf(P.x));
  if (ch === 'W') { P.st = 'sword'; P.t = 0; P.got = false; return true; }
  if (ch === 'H' || ch === 'M') { P.st = 'drink'; P.t = 0; P.got = false; P.big = ch === 'M'; return true; }
  return false;
}

// Terminal z zapiskami i konsola sterująca
function tryUse() {
  const ch = cell(P.r, colOf(P.x));
  if (ch !== 'T' && ch !== 'K') return false;
  P.st = 'use'; P.t = 0; SND.click();
  if (ch === 'T') say(LV.lore || 'Terminal milczy.', 5);
  else if (used) say('Konsola jest już przełączona.', 1.5);
  else {
    used = true; SND.zap(); shake(1);
    sparks(colOf(P.x) * TW + 16 + P.dir * 4, P.y - 14, '#60ff80', 8);
    say('Konsola: bariery wyłączone, kraty zablokowane w górze.', 3);
  }
  return true;
}

// Skrzynia w zasięgu cięcia (ten sam kafel albo przed graczem)
function crateAhead() {
  for (let c = 0; c < COLS; c++) {
    if (cell(P.r, c) !== 'B') continue;
    const d = (c * TW + 16 - P.x) * P.dir;
    if (d > -10 && d < 34) return c;
  }
  return -1;
}
function breakCrate(c) {
  const r = P.r, x = c * TW + 16, fy = floorY(r), pot = P.hp < P.max;
  MAP[r][c] = pot ? 'H' : 'O';
  SND.crash(); shake(2); game.stop = 0.04;
  sparks(x, fy - 8, game.blade.col, 8);
  burst(x, fy - 6, 10, '#8a6a40', 90, 80);
  for (let i = 0; i < 5; i++) {
    debris(x + (Math.random() - 0.5) * 12, fy - 4 - Math.random() * 10, r, (Math.random() - 0.5) * 140 + P.dir * 40,
      -80 - Math.random() * 90, 3 + Math.random() * 4, i % 2 ? '#7a5430' : '#a07444', i < 2 ? 0.4 : 0);
  }
  say(pot ? 'Skrzynia pęka – w środku mikstura!' : 'Skrzynia pęka – w środku kryształ!', 2);
}

const atDoor = () => cell(P.r, colOf(P.x)) === 'D';

// Czy przed graczem stoi żywy przeciwnik (nie da się go przejść)?
function foeAhead(dir) {
  return FOES.some(f => f.alive && !f.air && f.r === P.r && Math.sign(f.x - P.x) === dir && Math.abs(f.x - P.x) < 16);
}

function toFight() {
  if (P.ign < 0.2) SND.ignite();
  P.st = 'fight'; P.t = 0;
}

// Po akcji bojowej: pozostań w pozycji walki, jeśli jest przeciwnik albo ostrze wyciągnięte ręcznie
const afterFight = () => (engaged() || P.drawn) ? 'fight' : 'stand';

function startStrike(chain) {
  const p = P;
  p.combo = chain ? p.combo ^ 1 : 0;
  p.st = 'strike'; p.t = 0; p.hit = false; p.q = false;
  SND.swing();
  const t = engaged();
  if (t && t.k === 'lord' && t.st === 'guard' && Math.abs(t.x - p.x) < 50 && Math.random() < 0.35 + t.bb) {
    t.st = 'gblock'; t.t = 0;
  }
}

// A bez przeciwnika: ostrze zapala się i od razu tnie (cięcie też odbija strzały)
function drawStrike() {
  if (P.ign < 0.2) SND.ignite();
  P.drawn = true; P.ign = Math.max(P.ign, 0.4);
  startStrike(false);
}

// Finiszer – efektowne ostatnie cięcie w zwolnionym tempie (bez krwi: iskry, odłamki, upadek)
const FIN = [
  { name: 'WIROWE CIĘCIE', dur: 0.8 },
  { name: 'CIOS Z WYSKOKU', dur: 0.85 },
  { name: 'PCHNIĘCIE', dur: 0.75 },
];
function startFinisher(f) {
  const lord = f.k === 'lord';
  P.st = 'fin'; P.t = 0; P.fv = Math.floor(Math.random() * FIN.length); P.fx = false;
  P.inv = Math.max(P.inv, 1.5); P.dir = Math.sign(f.x - P.x) || P.dir; P.ft = f;
  game.slowT = lord ? 1.6 : 0.9; game.finName = lord ? 'OSTATNIE CIĘCIE' : FIN[P.fv].name;
  game.stop = 0.1; flash = { col: '#ffffff', t: 0.12 }; shake(3); SND.slash();
}

function updPlayer(dt) {
  const p = P;
  p.t += dt;
  p.inv = Math.max(0, p.inv - dt);
  // Podłoga zniknęła pod stojącym graczem (luźna płyta)
  if (!p.air && p.st !== 'dead' && p.st !== 'exit' && HANGST.indexOf(p.st) < 0 && !hasFloor(p.r, colOf(p.x))) {
    startFall(0);
  }
  const fwd = p.dir > 0 ? K.right : K.left, back = p.dir > 0 ? K.left : K.right;
  if (p.air || p.st === 'dead') p.drawn = false;
  const lit = p.sword && (FIGHTST.includes(p.st) || (p.st === 'hurt' && (p.drawn || engaged())));
  p.ign = Math.max(0, Math.min(1, p.ign + (lit ? 7 : -4) * dt));
  // Kryształ zbierany w biegu
  if (!p.air && p.st !== 'dead' && HANGST.indexOf(p.st) < 0 && cell(p.r, colOf(p.x)) === 'O' &&
      Math.abs(colOf(p.x) * TW + 16 - p.x) < 12) {
    MAP[p.r][colOf(p.x)] = '_'; game.crys++; SND.gem();
    sparks(colOf(p.x) * TW + 16, p.y - 10, '#80f0ff', 10);
    say('Kryształ energii (' + game.crys + ')', 1.2);
  }

  switch (p.st) {
    case 'stand': {
      if (p.sword && engaged()) { toFight(); break; }
      if (PR.up) {
        if (atDoor()) {
          if (doorOpen()) { p.st = 'exit'; p.t = 0; SND.win(); }
          else say('Drzwi blokuje pole siłowe Lorda.', 2);
          break;
        }
        if (fwd) { jump(90); break; }
        if (!tryUp()) { p.st = 'upjump'; p.t = 0; }
        break;
      }
      if (PR.down || K.down) {
        if (PR.down && tryHangDown()) break;
        p.st = 'crouch'; p.t = 0; break;
      }
      if (PR.act && (tryPick() || tryUse())) break;
      if (PR.act && p.sword) { drawStrike(); break; }   // A – wyciągnięcie ostrza i od razu cios
      if (back) { p.dir = -p.dir; p.st = 'turn'; p.t = 0; break; }
      if (fwd && !foeAhead(p.dir)) { p.st = K.walk ? 'step' : 'run'; p.t = 0; }
      break;
    }
    case 'turn': if (p.t > 0.12) p.st = 'stand'; break;
    case 'use': if (p.t > 0.45) p.st = 'stand'; break;
    case 'run': {
      const t = p.sword && engaged();
      if (t && Math.abs(t.x - p.x) < 60) { toFight(); break; }
      if (PR.act && p.sword) { drawStrike(); break; }
      if (PR.up) { jump(130); break; }
      if (back) { p.dir = -p.dir; p.st = 'turn'; p.t = 0; break; }
      if (!fwd || K.walk || foeAhead(p.dir)) { p.st = 'stand'; break; }
      if (PR.down) { p.st = 'crouch'; p.t = 0; break; }
      moveX(p, p.dir * 64 * dt, p.r);
      groundCheck(true);
      break;
    }
    case 'step': {
      if (PR.act && p.sword) { drawStrike(); break; }
      if (p.t < 0.45) {
        const nx = p.x + p.dir * 22 * dt;
        const aNow = colOf(p.x + p.dir * 4), aNext = colOf(nx + p.dir * 4);
        if (aNext !== aNow && (!hasFloor(p.r, aNext) || cell(p.r, aNext) === 'S')) { p.st = 'stand'; break; }
        if (foeAhead(p.dir)) { p.st = 'stand'; break; }
        moveX(p, nx - p.x, p.r);
        groundCheck(false);
      } else {
        p.st = 'stand';
        if (fwd && K.walk) { p.st = 'step'; p.t = 0; }
      }
      break;
    }
    case 'crouch':
      if (PR.act && tryPick()) break;
      if (!K.down && p.t > 0.15) p.st = 'stand';
      break;
    case 'land': if (p.t > p.ld) p.st = 'stand'; break;
    case 'upjump': if (p.t > 0.45) p.st = 'stand'; break;
    case 'reach': {
      const k = Math.min(1, p.t / 0.25);
      p.y = lerp(p.ry, floorY(p.hang.r) + HANG_DY, k);
      if (k >= 1) { p.st = 'hang'; p.t = 0; }
      break;
    }
    case 'hang':
      if (PR.up || (K.up && p.t > 0.15)) { p.st = 'climb'; p.t = 0; }
      else if (PR.down || PR.act) { p.st = 'fall'; p.t = 0; p.air = true; p.vx = 0; p.vy = 0; p.fallY = floorY(p.hang.r); }
      break;
    case 'climb':
      if (p.t >= 0.6) {
        p.x = p.hang.ex + p.dir * 8; p.y = floorY(p.hang.r); p.r = p.hang.r;
        p.hang = null; p.st = 'land'; p.t = 0; p.ld = 0.12;
      }
      break;
    case 'climbdown': if (p.t >= 0.5) { p.st = 'hang'; p.t = 0; } break;
    case 'sword': {
      // Zdobycie ostrza: przyklęk, chwyt rękojeści, zapłon kryształu i uniesienie nad głowę
      if (!p.got && p.t >= 0.45) {
        p.got = true; MAP[p.r][colOf(p.x)] = '_';
        game.blade = BLADES[Math.floor(Math.random() * BLADES.length)];
        SND.ignite(); SND.sword(); shake(2);
        sparks(p.x, p.y - 44, game.blade.col, 18);
      }
      if (p.t >= 0.6 && p.t < 1.9 && Math.floor(p.t * 10) % 3 === 0) {
        burst(p.x + (Math.random() - 0.5) * 8, p.y - 52, 1, game.blade.col, 60, 40, true);
      }
      if (p.t >= 2.4) {
        p.sword = true; p.st = 'stand'; p.t = 0;
        say('Kryształ rozbłysnął ' + game.blade.name + ' światłem! A – ostrze / cios, S – schowaj.', 3.5);
      }
      break;
    }
    case 'drink': {
      if (!p.got && p.t >= 0.4) {
        p.got = true; MAP[p.r][colOf(p.x)] = '_';
        if (p.big) { p.max++; p.hp = p.max; say('Wielka mikstura – więcej życia!', 2.5); }
        else { p.hp = Math.min(p.max, p.hp + 1); say('Mikstura przywraca siły.', 2); }
        SND.drink();
        flash = { col: p.big ? '#ffd040' : '#ff4060', t: 0.2 };
      }
      if (p.t >= 1.3) { p.st = 'stand'; p.t = 0; }
      break;
    }
    case 'fight': {
      const t = engaged();
      if (PR.sheathe) { p.drawn = false; p.st = 'stand'; p.t = 0; SND.swing(); break; }   // S – schowanie ostrza
      if (!t && !p.drawn) { p.st = 'stand'; break; }
      if (t) p.dir = Math.sign(t.x - p.x) || p.dir;
      if (!t && PR.act && (tryPick() || tryUse())) break;
      if (!t && PR.up && atDoor()) {
        if (doorOpen()) { p.drawn = false; p.st = 'exit'; p.t = 0; SND.win(); }
        else say('Drzwi blokuje pole siłowe Lorda.', 2);
        break;
      }
      if (PR.act) { startStrike(false); break; }
      if (PR.up) { p.st = 'block'; p.t = 0; break; }
      const f = p.dir > 0 ? K.right : K.left, b = p.dir > 0 ? K.left : K.right;
      if (!t && (p.dir > 0 ? PR.left : PR.right)) { p.dir = -p.dir; break; }   // bez przeciwnika – obrót
      if (f || b) { p.st = 'fstep'; p.t = 0; p.fd = f ? 1 : -1; }
      break;
    }
    case 'fstep': {
      const t = engaged();
      const d = t ? Math.abs(t.x - p.x) : 99;
      if (!(p.fd > 0 && d < 18)) {
        moveX(p, p.fd * p.dir * 52 * dt, p.r);
        if (!groundCheck(false)) break;
      }
      if (PR.act) { startStrike(false); break; }
      if (p.t > 0.22) p.st = afterFight();
      break;
    }
    case 'strike':
      if (PR.act && p.t > 0.1) p.q = true;
      if (!p.hit && p.t >= 0.12) { p.hit = true; resolveStrike(); }
      if (p.q && p.t >= 0.24) { startStrike(true); break; }
      if (p.t > 0.34) p.st = afterFight();
      break;
    case 'block': if (p.t > 0.4) p.st = afterFight(); break;
    case 'fin': {
      const f = p.ft, t = p.t, v = p.fv;
      // Przesunięcie bohatera w trakcie finiszera (skok / wypad)
      const mv = v === 1 ? (t < 0.4 ? 30 : 0) : v === 2 ? (t > 0.12 && t < 0.24 ? 90 : 0) : 0;
      if (mv && Math.abs(f.x - p.x) > 8) { moveX(p, p.dir * mv * dt, p.r); if (!groundCheck(false)) break; }
      const hitAt = v === 0 ? 0.3 : v === 1 ? 0.45 : 0.2;
      if (!p.fx && t >= hitAt) {
        p.fx = true; shake(4); SND.clash();
        const lord = f.k === 'lord';
        sparks(f.x, f.y - 20, game.blade.col, 20);
        if (lord) sparks(f.x, f.y - 24, RED.col, 16);
        if (v === 1) burst(p.x + p.dir * 10, p.y, 12, '#a89878', 90, 30);
        if (v === 0) for (let i = 0; i < 12; i++) {
          const a = i / 12 * Math.PI * 2;
          burst(p.x + Math.cos(a) * 22, p.y - 20 + Math.sin(a) * 22, 1, game.blade.col, 40, 30, true);
        }
      }
      if (t >= FIN[v].dur) p.st = afterFight();
      break;
    }
    case 'hurt': if (p.t > 0.3) p.st = p.sword ? afterFight() : 'stand'; break;
    case 'jump':
    case 'fall': {
      const r = air(p, dt);
      if (r >= 0) landP(r);
      break;
    }
    case 'exit': {
      const dx = colOf(p.x) * TW + 16;
      p.x += (dx - p.x) * Math.min(1, dt * 4);
      if (p.t > 1.6) finishLevel();
      break;
    }
    case 'dead':
      if (PR.act && p.t > 1.5) restart();
      break;
  }
}

function resolveStrike() {
  let t = null, bd = 41;
  for (const f of FOES) {
    if (!f.alive || f.air || f.r !== P.r || Math.sign(f.x - P.x) !== P.dir) continue;
    const d = Math.abs(f.x - P.x);
    if (d < bd) { bd = d; t = f; }
  }
  if (!t) { const c = crateAhead(); if (c >= 0) breakCrate(c); return; }
  if (t.st === 'gblock') {
    SND.clash(); shake(2); game.stop = 0.05;
    const x = (P.x + t.x) / 2;
    sparks(x, P.y - 26, game.blade.col, 8); sparks(x, P.y - 26, RED.col, 8);
    t.cd = Math.min(t.cd, 0.15);
    return;
  }
  if (hitFoe(t, 1, P.dir) && t.st === 'fin') startFinisher(t);
}

// Zwraca true, gdy cios był śmiertelny
function hitFoe(f, n, dir) {
  f.hp -= n; f.white = 0.12; game.hud = f; game.hudT = 3; f.aw = true;
  SND.hit(); shake(2); game.stop = 0.06;
  burst(f.x, f.y - 20, 8, f.k === 'lord' ? '#3a2a36' : '#30343c', 70);
  sparks(f.x - dir * 4, f.y - 22, game.blade.col, 8);
  if (f.hp <= 0) {
    f.alive = false; f.st = 'fdead'; f.t = 0;
    if (f.k === 'lord') {
      say('Mroczny Lord pokonany! Pole siłowe gaśnie.', 4);
      SND.lord(); shake(4); flash = { col: '#ffffff', t: 0.3 };
      sparks(f.x, f.y - 30, RED.col, 30);
    } else say(f.k === 'rifle' ? 'Szturmowiec z karabinem pokonany.' : 'Strażnik z blasterem pokonany.', 2);
    foePush(f, dir * 6);
    if (f.st === 'fdead') {
      // Upadek zamiast natychmiastowej śmierci; broń szturmowca rozcięta na pół
      f.st = 'fin'; f.t = 0; f.fd = dir; f.hd = false;
      if (f.k !== 'lord') {
        const L = f.k === 'rifle' ? 6 : 4;
        debris(f.x + f.dir * 8, f.y - 21, f.r, dir * 50 + 20, -150, L, '#1e2026', 0.8);
        debris(f.x + f.dir * 12, f.y - 21, f.r, dir * 90 - 10, -110, L, '#2a2e36', 0.8);
        sparks(f.x + f.dir * 10, f.y - 21, '#ffb060', 8);
      }
    }
    return true;
  }
  f.st = f.k === 'lord' ? 'ghurt' : 'thurt'; f.t = 0;
  if (f.k === 'lord') f.bb = Math.min(0.4, f.bb + 0.2);
  foePush(f, dir * 10);
  return false;
}

// ===== Przeciwnicy =====
function foePush(f, dx) {
  moveX(f, dx, f.r);
  const c = colOf(f.x);
  if (!hasFloor(f.r, c)) {
    f.st = 'ffall'; f.air = true; f.vy = 0; f.vx = Math.sign(dx) * 30; f.alive = false;
    say('Przeciwnik runął w przepaść!', 3);
  } else if (cell(f.r, c) === 'S') {
    spikes[f.r + ',' + c] = 1; f.alive = false; f.st = 'fdead'; SND.hit();
  }
}

function foeMove(f, dx) {
  const s = Math.sign(dx), c = colOf(f.x + dx + s * 8);
  if (isWall(f.r, c) || !hasFloor(f.r, c) || cell(f.r, c) === 'S' || cell(f.r, c) === 'E' || gateBlocks(f.r, c)) return false;
  if (s === Math.sign(P.x - f.x) && playerOnRow(f.r) && Math.abs(P.x - f.x) < 16) return false;
  if (FOES.some(o => o !== f && o.alive && !o.air && o.r === f.r && Math.sign(o.x - f.x) === s && Math.abs(o.x - f.x) < 18)) return false;
  f.mv = 0.12;
  return moveX(f, dx, f.r);
}

// Patrol: spacer w tę i z powrotem wokół posterunku, z krótkimi postojami
function patrol(f, dt) {
  if (f.wait > 0) { f.wait -= dt; return; }
  const far = Math.abs(f.x - f.hx) > 70 && Math.sign(f.x - f.hx) === f.dir;
  if (far || !foeMove(f, f.dir * 18 * dt)) { f.dir = -f.dir; f.wait = 0.7 + Math.random() * 1.1; }
}

function shoot(f) {
  const v = f.k === 'rifle' ? 210 : 180;
  BOLTS.push({ x: f.x + f.dir * 14, y: f.y - 21, r: f.r, vx: f.dir * v, o: 'e', src: f });
  f.mf = 0.06; SND.blast();
}

function updFoe(f, dt) {
  f.t += dt;
  f.white = Math.max(0, f.white - dt); f.mf = Math.max(0, f.mf - dt); f.bb = Math.max(0, f.bb - dt * 0.05);
  f.mv = Math.max(0, f.mv - dt);
  if (f.st === 'ffall') {
    const r = air(f, dt);
    if (r >= 0) { f.st = 'fdead'; f.t = 0; SND.thud(); }
    return;
  }
  if (f.st === 'fin') {
    if (f.k === 'lord') {
      // Czerwone ostrze gaśnie, rękojeść upada, Lord klęka i rozpada się w żar
      if (!f.hd && f.t > 0.5) {
        f.hd = true; SND.thud();
        debris(f.x + f.dir * 8, f.y - 18, f.r, f.dir * 30, -60, 5, '#9aa4b4', 0.6);
      }
      if (f.t > 0.8) embers(f.x, f.y - 4, f.t > 1.2 ? 3 : 1, Math.random() < 0.5 ? '#ff5030' : '#ffb060');
      if (f.t > 2.7) { f.st = 'gone'; f.t = 0; }
    } else if (f.t > 0.7 && !f.hd) { f.hd = true; SND.thud(); burst(f.x + f.dir * 10, f.y, 8, '#a89878', 50, 20); }
    else if (f.t > 1.25) { f.st = 'fdead'; f.t = 0; }
    return;
  }
  if (!f.alive) return;
  if (f.k === 'lord') updLord(f, dt); else updTrooper(f, dt);
}

function updTrooper(f, dt) {
  const dx = P.x - f.x, d = Math.abs(dx);
  const same = playerOnRow(f.r);
  // Nieświadomy strażnik widzi tylko przed sobą (albo słyszy z bliska)
  const see = same && d < 200 && los(f.r, f.x, P.x) && (f.aw || Math.sign(dx) === f.dir || d < 50);
  if (see) { if (!f.aw) { f.aw = true; f.cd = Math.max(f.cd, 0.5); } f.lost = 0; }
  else if (f.aw && (f.lost += dt) > 4) f.aw = false;
  switch (f.st) {
    case 'sleep':
      if (P.sword || (same && d < 60)) {
        f.st = 'idle'; f.t = 0; f.cd = 1; f.aw = true; SND.alarm(); say('Strażnik podnosi alarm!', 2);
      }
      break;
    case 'idle': {
      if (!see) { patrol(f, dt); break; }
      f.dir = Math.sign(dx) || f.dir;
      if (d < 22) { f.st = 'bash'; f.t = 0; f.hit = false; break; }
      // Taktyka: trzyma dystans strzału, cofa się przed ostrzem i przestępuje z nogi na nogę
      const pref = f.k === 'rifle' ? 110 : 85;
      if (d < 44 && P.sword) foeMove(f, -f.dir * 26 * dt);
      else if (d > pref + 25) foeMove(f, f.dir * 28 * dt);
      else {
        f.sdt -= dt;
        if (f.sdt <= 0) { f.sdt = 0.5 + Math.random() * 0.9; f.sd = [-1, 0, 0, 1][Math.floor(Math.random() * 4)]; }
        if (f.sd) foeMove(f, f.sd * 16 * dt);
      }
      f.cd -= dt;
      if (f.cd <= 0) { f.st = 'aim'; f.t = 0; }
      break;
    }
    case 'aim':
      if (!see) { f.st = 'idle'; break; }
      f.dir = Math.sign(dx) || f.dir;
      if (d < 22) { f.st = 'bash'; f.t = 0; f.hit = false; break; }
      if (f.t > 0.45) { f.st = 'fire'; f.t = 0; f.shots = f.k === 'rifle' ? 2 : 1; f.ft = 0; }
      break;
    case 'fire':
      f.ft -= dt;
      if (f.shots > 0 && f.ft <= 0) { shoot(f); f.shots--; f.ft = 0.14; }
      if (f.shots <= 0 && f.t > 0.3) {
        f.st = 'idle'; f.cd = f.k === 'rifle' ? 1.5 + Math.random() * 0.8 : 1.1 + Math.random() * 0.7;
      }
      break;
    case 'bash':
      if (!f.hit && f.t > 0.3) {
        f.hit = true;
        if (same && d < 26 && Math.sign(dx) === f.dir) {
          if (P.st === 'block') {
            SND.clash(); sparks(f.x + f.dir * 10, f.y - 22, game.blade.col, 6);
            f.st = 'tstun'; f.t = 0; break;
          }
          hurtPlayer(1, f.dir, 'kolba');
        }
      }
      if (f.t > 0.55) { f.st = 'idle'; f.cd = 0.5; }
      break;
    case 'thurt':
      if (f.t > 0.32) {
        // Po trafieniu czasem odskakuje do tyłu i od razu składa się do strzału
        if (d < 50 && Math.random() < 0.4) { f.st = 'dodge'; f.t = 0; SND.swing(); }
        else { f.st = 'idle'; f.cd = Math.max(f.cd, 0.4); }
      }
      break;
    case 'dodge':
      foeMove(f, -f.dir * 95 * dt);
      if (f.t > 0.34) { f.st = 'aim'; f.t = 0.1; }
      break;
    case 'tstun': if (f.t > 0.7) { f.st = 'idle'; f.cd = 0.3; } break;
  }
}

function updLord(f, dt) {
  const dx = P.x - f.x, d = Math.abs(dx);
  const same = playerOnRow(f.r);
  if (!f.fury && f.hp <= 5 && f.st !== 'meditate' && f.st !== 'rise') {
    f.fury = true; say('Mroczny Lord wpada w furię!', 2.5); SND.lord(); shake(3);
    sparks(f.x, f.y - 26, RED.col, 20);
  }
  const sp = f.fury ? 1.3 : 1;
  switch (f.st) {
    case 'meditate':
      if (same) {
        f.st = 'rise'; f.t = 0; SND.ignite(); SND.lord(); shake(2);
        say('Mroczny Lord: „Twoje światło zgaśnie w tych lochach.”', 3.5);
      }
      break;
    case 'rise': if (f.t > 1.1) { f.st = 'guard'; f.t = 0; f.cd = 0.6; } break;
    case 'guard': {
      if (!same || d > 150) break;
      f.dir = Math.sign(dx) || f.dir;
      if (d > 34) foeMove(f, f.dir * 34 * sp * dt);
      else if (d < 20) foeMove(f, -f.dir * 24 * dt);
      f.cd -= dt * sp;
      if (f.cd <= 0) {
        if (d < 30 && Math.random() < 0.3) { f.st = 'hop'; f.t = 0; SND.swing(); }   // odskok i wypad
        else if (d < 46) { f.st = 'wind'; f.t = 0; }
        else if (d < 110 && Math.random() < 0.5) { f.st = 'lunge'; f.t = 0; SND.swing(); }
        else f.cd = 0.3;
      }
      break;
    }
    case 'hop':
      foeMove(f, -f.dir * 120 * dt);
      if (f.t > 0.3) {
        if (Math.random() < 0.6) { f.st = 'lunge'; f.t = 0; SND.swing(); }
        else { f.st = 'guard'; f.t = 0; f.cd = 0.3; }
      }
      break;
    case 'lunge':
      foeMove(f, f.dir * 150 * sp * dt);
      if (f.t > 0.24 || d < 26) { f.st = 'gstrike'; f.t = 0; f.hit = false; SND.swing(); }
      break;
    case 'wind': if (f.t > (f.fury ? 0.24 : 0.32)) { f.st = 'gstrike'; f.t = 0; f.hit = false; SND.swing(); } break;
    case 'gstrike':
      if (!f.hit && f.t > 0.07) {
        f.hit = true;
        if (same && d < 44 && Math.sign(dx) === f.dir) {
          if (P.st === 'block') {
            SND.clash(); shake(2); game.stop = 0.05;
            const x = (P.x + f.x) / 2;
            sparks(x, f.y - 28, game.blade.col, 8); sparks(x, f.y - 28, RED.col, 8);
            f.st = 'stun'; f.t = 0; break;
          }
          hurtPlayer(1, f.dir, 'lord');
        }
      }
      if (f.t > 0.3) { f.st = 'guard'; f.t = 0; f.cd = 0.45 + Math.random() * 0.6; }
      break;
    case 'gblock': if (f.t > 0.3) { f.st = 'guard'; f.cd = Math.min(f.cd, 0.25); } break;
    case 'ghurt': if (f.t > 0.3) { f.st = 'guard'; f.cd = 0.35; } break;
    case 'stun': if (f.t > 0.55) { f.st = 'guard'; f.cd = 0.4; } break;
  }
}

// ===== Strzały z blasterów =====
function playerHeight() {
  if (['crouch', 'land', 'drink'].includes(P.st) || (P.st === 'sword' && P.t < 0.6)) return 17;
  if (P.st === 'dead') return 0;
  return 29;
}

function updBolts(dt) {
  for (const b of BOLTS) {
    const px = b.x;
    b.x += b.vx * dt;
    const lo = Math.min(px, b.x), hi = Math.max(px, b.x);
    const c = colOf(b.x);
    if (b.x < -10 || b.x > SW + 10) { b.dead = true; continue; }
    if (isWall(b.r, c) || ((gateBlocks(b.r, c) || barBlocks(b.r, c)) && lo <= c * TW + 16 && hi >= c * TW + 16)) {
      b.dead = true; burst(b.x, b.y, 5, '#ff6040', 60, 40, true); continue;
    }
    if (b.o === 'e') {
      const ph = playerHeight();
      if (ph && P.x >= lo - 5 && P.x <= hi + 5 && b.y > P.y - ph && b.y < P.y) boltHitsPlayer(b);
    } else {
      for (const f of FOES) {
        if (!f.alive || f.air || f.r !== b.r || f.x < lo - 5 || f.x > hi + 5) continue;
        b.dead = true;
        if (f.k === 'lord') { SND.deflect(); sparks(b.x, b.y, RED.col, 8); }   // Lord odbija strzały ostrzem
        else hitFoe(f, 1, Math.sign(b.vx));
        break;
      }
    }
  }
  BOLTS = BOLTS.filter(b => !b.dead);
}

function boltHitsPlayer(b) {
  const facing = Math.sign(b.vx) === -P.dir;
  const armed = P.sword && facing;
  if (armed && (P.st === 'block' || P.st === 'strike' || P.st === 'fin')) {
    // Cios lub zasłona odbija strzał prosto w strzelca
    b.vx = -b.vx * 1.15; b.o = 'p';
    SND.deflect(); shake(1);
    sparks(b.x, b.y, game.blade.col, 8);
    return;
  }
  b.dead = true;
  if (P.inv > 0) { burst(b.x, b.y, 4, '#ff6040', 60, 40, true); return; }
  if (armed && ['stand', 'fight', 'fstep', 'turn', 'run', 'step', 'land'].includes(P.st) && Math.random() < 0.6) {
    SND.deflect(); sparks(b.x, b.y, game.blade.col, 6);
    burst(b.x, b.y, 4, '#ff6040', 120, 120, true);
    if (FIGHTST.includes(P.st) || P.st === 'stand') { P.st = 'block'; P.t = 0.2; }
    return;
  }
  burst(b.x, b.y, 6, '#ff6040', 60, 40, true);
  hurtPlayer(1, Math.sign(b.vx), 'strzal');
}

// ===== Pułapki i mechanizmy =====
function updLoose(dt) {
  for (const L of LOOSE) {
    if (L.st === 'ok') {
      if (!P.air && P.st !== 'dead' && P.r === L.r && colOf(P.x) === L.c && HANGST.indexOf(P.st) < 0) {
        L.st = 'shake'; L.t = 0; SND.rattle();
      }
    } else if (L.st === 'shake') {
      L.t += dt;
      if (L.t > 0.15) { L.st = 'fall'; L.y = floorY(L.r); L.vy = 0; }
    } else if (L.st === 'fall') {
      L.vy += GRAV * dt; L.y += L.vy * dt;
      let tr = L.r + 1;
      while (tr < ROWS && !hasFloor(tr, L.c)) tr++;
      const ty = tr < ROWS ? floorY(tr) : SH + 20;
      if (L.y >= ty) {
        L.st = 'gone'; L.rr = tr; SND.crash(); shake(2);
        burst(L.c * TW + 16, ty, 14, '#8a8a9a', 80, 50);
        if (tr < ROWS && !P.air && P.r === tr && colOf(P.x) === L.c && P.st !== 'land' && P.st !== 'dead') {
          hurtPlayer(1, 0, 'gruz');
        }
      }
    }
  }
}

function plateDown() {
  return !P.air && P.st !== 'dead' && HANGST.indexOf(P.st) < 0 && cell(P.r, colOf(P.x)) === 'P';
}

function updGate(dt) {
  if (used) { gate = Math.min(1, gate + dt * 1.5); gateT = 1; return; }   // konsola otworzyła kratę na stałe
  const on = plateDown();
  if (on) {
    if (gateT <= 0) { SND.click(); if (gate < 0.8) say('Gdzieś zgrzytnęła krata...', 2); }
    gateT = 3;
  }
  if (gateT > 0) {
    gate = Math.min(1, gate + dt * 1.5);
    if (!on) gateT -= dt;
  } else if (gate > 0) {
    gate = Math.max(0, gate - 0.18 * dt);
    gateTick -= dt;
    if (gateTick <= 0) { gateTick = 0.25; SND.tick(); }
  }
}

function updSpikes(dt) {
  for (const k in spikes) {
    const [r, c] = k.split(',').map(Number);
    const cx = c * TW + TW / 2;
    const near = (Math.abs(P.x - cx) < 44 && (P.air ? Math.floor((P.y - 14) / RH) <= r : P.r === r)) ||
      FOES.some(f => f.r === r && Math.abs(f.x - cx) < 30);
    const deadOn = (P.st === 'dead' && P.kind === 'kolce' && P.r === r && colOf(P.x) === c);
    const tgt = near || deadOn ? 1 : 0;
    spikes[k] += Math.sign(tgt - spikes[k]) * Math.min(Math.abs(tgt - spikes[k]), dt * (tgt ? 8 : 1.5));
  }
}

function updParts(dt) {
  for (const q of parts) { q.vy += (q.g ?? 300) * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; }
  parts = parts.filter(q => q.life > 0);
}

// Bariera włączająca się na kimś – odpycha go (gracza dodatkowo razi)
function updBarriers() {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (!barBlocks(r, c)) continue;
    const cx = c * TW + 16;
    if (!P.air && P.r === r && P.st !== 'dead' && Math.abs(P.x - cx) < HW) {
      const s = P.x < cx ? -1 : 1;
      P.x = cx + s * (HW + 1); zap(s);
    }
    for (const f of FOES) if (f.alive && f.r === r && Math.abs(f.x - cx) < 10) f.x = cx + (f.x < cx ? -11 : 11);
  }
}

function update(dt) {
  game.anim += dt;
  game.shake = Math.max(0, game.shake - dt * 10);
  game.bars += ((game.slowT > 0 ? 1 : 0) - game.bars) * Math.min(1, dt * 8);
  if (game.mode === 'trans') {
    game.trans += dt;
    if (game.trans > 2.4) loadLevel(lvl + 1);
    return;
  }
  if (game.mode !== 'play') return;
  if (game.stop > 0) { game.stop -= dt; return; }       // „zatrzymanie klatki” przy trafieniu
  if (game.slowT > 0) { game.slowT -= dt; dt *= 0.35; }  // zwolnione tempo finiszera
  if (P.st !== 'dead' && P.st !== 'exit') game.time += dt;
  if (msg.t > 0 && msg.t < 90) msg.t -= dt;
  if (game.hudT > 0) game.hudT -= dt;
  updPlayer(dt);
  for (const f of FOES) updFoe(f, dt);
  updLoose(dt);
  updGate(dt);
  updSpikes(dt);
  updBolts(dt);
  updBarriers();
  updParts(dt);
  updDebris(dt);
  if (flash) { flash.t -= dt; if (flash.t <= 0) flash = null; }
}

// ===== Rysowanie: tło (prerenderowane osobno dla każdego poziomu) =====
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const PAL_ROOF = ['#c8ccd8', '#7a8094', '#2a2e3c'];
const THEMES = [
  { back: '#141826', brick: ['#2c3550', '#283049', '#313a57', '#2a3350'], hi: '#3a4466',
    wall: ['#1a1f30', '#56607e', '#6c7898'], slab: ['#b0b0c0', '#6a7290', '#262a3c'],
    lamp: 'fire', rgb: '255,150,60', dark: 0.3, deco: '#40c0ff' },
  { back: '#10141c', brick: ['#26303e', '#222a36', '#2c3644', '#242c3a'], hi: '#36445a',
    wall: ['#161c26', '#4a5668', '#64728a'], slab: ['#a8b4c4', '#5a6880', '#20283a'],
    lamp: 'tech', rgb: '110,180,255', dark: 0.4, deco: '#60b0ff' },
  { back: '#1a100c', brick: ['#3a2620', '#34221c', '#422a22', '#3a241e'], hi: '#5a3a2a',
    wall: ['#20140e', '#6a4a38', '#8a6450'], slab: ['#c8a890', '#7a5a48', '#2a1a12'],
    lamp: 'fire', rgb: '255,120,40', dark: 0.36, deco: '#ff7a20' },
  { back: '#0c1612', brick: ['#1e3028', '#1a2a22', '#22362c', '#1c2c24'], hi: '#2e4a3a',
    wall: ['#101a14', '#3e5a4a', '#567a64'], slab: ['#9ab8a4', '#4e6e5a', '#18261e'],
    lamp: 'tech', rgb: '120,255,170', dark: 0.42, deco: '#50ffa0' },
  { back: '#120a10', brick: ['#2a1622', '#24121c', '#301a26', '#26141e'], hi: '#42243a',
    wall: ['#160c14', '#4e2e44', '#6a3e5a'], slab: ['#b49aa8', '#6a4a5c', '#20121a'],
    lamp: 'tech', rgb: '255,50,60', dark: 0.46, deco: '#ff3040' },
];
const BGS = [];

function slab(c2, x, y, w, pal) {
  c2.fillStyle = pal[0]; c2.fillRect(x, y, w, 2);
  c2.fillStyle = pal[1]; c2.fillRect(x, y + 2, w, 4);
  c2.fillStyle = pal[2]; c2.fillRect(x, y + 6, w, 1);
  c2.fillRect(x + w - 1, y + 2, 1, 4);         // szczelina między płytami
}
const slabPal = r => (LV.sky && r === 0) ? PAL_ROOF : THEMES[LV.theme].slab;

function drawSky(c) {
  const gr = c.createLinearGradient(0, 0, 0, 62);
  gr.addColorStop(0, '#04041a'); gr.addColorStop(0.7, '#251a4a'); gr.addColorStop(1, '#4a2850');
  c.fillStyle = gr; c.fillRect(0, 0, SW, 62);
  for (let i = 0; i < 90; i++) {
    c.fillStyle = rnd() < 0.3 ? '#ffffff' : rnd() < 0.5 ? '#8890c0' : '#c0a0d0';
    const sx = rnd() * SW, sy = rnd() * 46, sr = 0.3 + rnd() * 0.45;
    c.beginPath(); c.arc(sx, sy, sr, 0, Math.PI * 2); c.fill();
  }
  // Mgławica
  const ng = c.createRadialGradient(90, 18, 2, 90, 18, 50);
  ng.addColorStop(0, 'rgba(120,60,160,0.35)'); ng.addColorStop(1, 'rgba(60,20,90,0)');
  c.fillStyle = ng; c.fillRect(30, 0, 120, 50);
  // Planeta z pierścieniem (tylna połowa pierścienia → kula → przednia połowa)
  const ring = (a0, a1) => {
    c.strokeStyle = 'rgba(232,208,168,0.85)'; c.lineWidth = 1.2;
    c.beginPath(); c.ellipse(250, 18.5, 20, 4, 0.18, a0, a1); c.stroke();
    c.strokeStyle = 'rgba(160,130,110,0.6)'; c.lineWidth = 0.6;
    c.beginPath(); c.ellipse(250, 18.5, 16.5, 3.1, 0.18, a0, a1); c.stroke();
  };
  ring(Math.PI, Math.PI * 2);
  c.save();
  c.beginPath(); c.arc(250, 18, 11, 0, Math.PI * 2); c.clip();
  const pg = c.createLinearGradient(240, 8, 260, 28);
  pg.addColorStop(0, '#f0b47a'); pg.addColorStop(1, '#b07050');
  c.fillStyle = pg; c.fillRect(238, 6, 24, 24);
  for (let k = 0; k < 6; k++) {
    c.fillStyle = k % 2 ? 'rgba(255,220,170,0.25)' : 'rgba(120,60,40,0.22)';
    c.beginPath(); c.ellipse(250, 9 + k * 3.6, 14, 1.3, 0.18, 0, Math.PI * 2); c.fill();
  }
  const sh = c.createRadialGradient(245, 13, 4, 252, 20, 14);
  sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(30,10,30,0.75)');
  c.fillStyle = sh; c.fillRect(238, 6, 24, 24);
  c.restore();
  ring(0, Math.PI);
  // Księżyc
  c.fillStyle = '#d8d8e8'; c.beginPath(); c.arc(213.5, 11.5, 1.7, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(80,80,110,0.7)'; c.beginPath(); c.arc(214.3, 12.2, 1.1, 0, Math.PI * 2); c.fill();
  // Sylwetka cytadeli z wieżami i antenami
  c.fillStyle = '#140c26';
  c.fillRect(0, 48, SW, 14);
  const tower = (x, w, top) => {
    c.fillRect(x, top, w, 62 - top);
    c.fillRect(x - 2, top + 3, w + 4, 2);
    c.fillRect(x + Math.floor(w / 2), top - 8, 1, 8);
  };
  tower(14, 8, 26); tower(100, 12, 18); tower(150, 22, 30); tower(196, 10, 22); tower(286, 9, 30);
  c.fillRect(56, 40, 30, 10); c.fillRect(230, 42, 40, 8);
  c.fillStyle = '#f0c050';
  [[103, 26], [108, 30], [155, 36], [165, 36], [199, 30], [60, 44], [240, 45], [17, 34], [289, 38]]
    .forEach(([x, y]) => { c.beginPath(); c.arc(x + 0.5, y + 0.5, 0.6, 0, Math.PI * 2); c.fill(); });
}

function buildBG(L) {
  const T = THEMES[L.theme];
  seed = 7 + L.theme * 101;
  const b = document.createElement('canvas');
  b.width = SW * RS; b.height = SH * RS;
  const c = b.getContext('2d');
  c.scale(RS, RS);
  const top = L.sky ? 62 : 0;
  if (L.sky) drawSky(c);
  // Mur tła z cegieł
  c.fillStyle = T.back; c.fillRect(0, top, SW, 180 - top);
  for (let y = top, row = 0; y < 180; y += 8, row++) {
    const off = (row % 2) * 8;
    for (let x = -off; x < SW; x += 16) {
      c.fillStyle = T.brick[Math.floor(rnd() * T.brick.length)];
      c.fillRect(x + 1, y + 1, 15, 7);
      if (rnd() < 0.15) { c.fillStyle = T.hi; c.fillRect(x + 2, y + 1, 6, 1); }
      if (rnd() < 0.05) { c.fillStyle = T.back; c.fillRect(x + 4 + Math.floor(rnd() * 8), y + 2, 1, 4); }
    }
  }
  // Rury biegnące pionowo przez loch
  for (let i = 0; i < 2; i++) {
    const px = 40 + Math.floor(rnd() * 240);
    c.fillStyle = '#20242c'; c.fillRect(px, top, 5, 180 - top);
    c.fillStyle = '#4a505c'; c.fillRect(px + 1, top, 2, 180 - top);
    c.fillStyle = '#6a7280'; c.fillRect(px + 1, top, 1, 180 - top);
    for (let y = top + 10; y < 180; y += 22) { c.fillStyle = '#2c3038'; c.fillRect(px - 1, y, 7, 3); }
  }
  // Dekoracje rzędów: łańcuchy, panele, sztandary, mech
  for (let r = L.sky ? 1 : 0; r < ROWS; r++) for (let col = 0; col < COLS; col++) {
    const ch = L.map[r][col], x = col * TW, y0 = r * RH + 4;
    if (ch === '#' || ch === 'D') continue;
    const k = rnd();
    if (k < 0.18) {                                   // łańcuch z kajdanami
      c.fillStyle = '#5a5e68';
      for (let y = y0; y < y0 + 18; y += 3) c.fillRect(x + 10, y, 1, 2);
      c.fillRect(x + 8, y0 + 18, 5, 1); c.fillRect(x + 8, y0 + 19, 1, 2); c.fillRect(x + 12, y0 + 19, 1, 2);
    } else if (k < 0.34 && L.theme !== 0) {            // panel techniczny
      c.fillStyle = '#14161c'; c.fillRect(x + 6, y0 + 10, 14, 10);
      c.fillStyle = '#3a3e48'; c.fillRect(x + 7, y0 + 11, 12, 8);
      c.fillStyle = T.deco; c.fillRect(x + 9, y0 + 13, 8, 1);
      c.fillStyle = '#20232a'; c.fillRect(x + 9, y0 + 15, 8, 2);
    } else if (k < 0.44 && L.theme === 4) {            // sztandar Lorda
      c.fillStyle = '#5a0c18'; c.fillRect(x + 8, y0 + 2, 14, 26);
      c.fillStyle = '#7a1424'; c.fillRect(x + 9, y0 + 2, 2, 24);
      c.fillStyle = '#16080c';
      for (let i = 0; i < 6; i++) c.fillRect(x + 15 - i, y0 + 8 + i, 1 + i * 2 - (i > 0 ? i : 0) + i, 1);
      c.fillStyle = '#ff3040'; c.fillRect(x + 14, y0 + 11, 2, 1);
      c.fillStyle = '#5a0c18'; c.fillRect(x + 8, y0 + 28, 4, 2); c.fillRect(x + 18, y0 + 28, 4, 2);
    } else if (k < 0.6) {                              // pęknięcia / mech
      c.fillStyle = L.theme === 3 ? '#2a5a34' : T.back;
      for (let i = 0; i < 6; i++) c.fillRect(x + 4 + Math.floor(rnd() * 22), y0 + 30 + Math.floor(rnd() * 20), 2, 1);
    }
  }
  // Przepaście w dolnym rzędzie
  for (let col = 0; col < COLS; col++) {
    if (L.map[2][col] !== ' ') continue;
    const g = c.createLinearGradient(0, 160, 0, 180);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.95)');
    c.fillStyle = g; c.fillRect(col * TW, 160, TW, 20);
  }
  // Mury, drzwi, podłogi
  for (let r = 0; r < ROWS; r++) for (let col = 0; col < COLS; col++) {
    const ch = L.map[r][col], x = col * TW, fy = floorY(r);
    if (ch === '#') {
      const y0 = r === 0 ? 0 : r * RH + 2, y1 = Math.min(180, fy + 7);
      c.fillStyle = T.wall[0]; c.fillRect(x, y0, TW, y1 - y0);
      for (let y = y0, rr = 0; y < y1; y += 10, rr++) {
        const off = (rr % 2) * 8;
        for (let bx = x - off; bx < x + TW; bx += 16) {
          const lx = Math.max(x, bx + 1), rx = Math.min(x + TW, bx + 16);
          c.fillStyle = T.wall[1]; c.fillRect(lx, y + 1, rx - lx, Math.min(9, y1 - y - 1));
          c.fillStyle = T.wall[2]; c.fillRect(lx, y + 1, rx - lx, 1);
        }
      }
      continue;
    }
    if (ch === 'D') {
      // Łukowe wrota ze schodami w górę – wyjście z poziomu
      const ox = x + 6, ow = 20, tp = fy - 36;
      c.fillStyle = T.wall[2];
      c.fillRect(ox - 3, tp - 4, ow + 6, 40);
      c.fillStyle = '#05060c';
      c.fillRect(ox, tp + 6, ow, 30);
      for (let dy = 0; dy < 10; dy++) {
        const w = Math.round(Math.sqrt(100 - (10 - dy) * (10 - dy)));
        c.fillRect(ox + 10 - w, tp - 4 + dy + 1, w * 2, 1);
      }
      c.fillStyle = '#2a3048';
      for (let i = 0; i < 6; i++) c.fillRect(ox + 2 + i * 3, fy - 5 * (6 - i) + 2, ow - 2 - i * 3, 2);
      c.fillStyle = T.deco; c.fillRect(ox - 3, tp - 4, ow + 6, 1); c.fillRect(ox + 9, tp - 7, 2, 2);
    }
    if (ch !== ' ' && ch !== 'L') slab(c, x, fy, TW, (L.sky && r === 0) ? PAL_ROOF : T.slab);
  }
  // Sufit lochu
  if (!L.sky) {
    c.fillStyle = T.wall[0]; c.fillRect(0, 0, SW, 3);
    c.fillStyle = T.wall[1]; c.fillRect(0, 3, SW, 1);
  }
  return b;
}

// Winieta – przyciemnione brzegi ekranu
let VIG = null;
function vignette() {
  if (VIG && VIG.width === SW * RS) return VIG;
  const b = document.createElement('canvas');
  b.width = SW * RS; b.height = 180 * RS;
  const c = b.getContext('2d');
  c.scale(RS, RS);
  const g = c.createRadialGradient(SW / 2, 90, 60, SW / 2, 90, 200);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.6)');
  c.fillStyle = g; c.fillRect(0, 0, SW, 180);
  return (VIG = b);
}

// ===== Rysowanie: postacie (szkielet z „kości” o grubości 2 px) =====
// Pozy: [głowa, szyja, biodro, kolano1, stopa1, kolano2, stopa2, łokieć1, dłoń1, łokieć2, dłoń2, (czubek ostrza)]
// x dodatnie = przód postaci, y względem stóp (ujemne = w górę). Indeks 1 = kończyny bliższe widzowi.
const POSE = {
  stand: [0, -29, 0, -25, 0, -14, 1, -7, 1, 0, -1, -7, -2, 0, 1, -20, 2, -14, -1, -20, -2, -14],
  run0: [2, -29, 1, -25, 0, -14, 5, -9, 7, -2, -3, -7, -7, -2, 4, -20, 7, -17, -3, -20, -6, -16],
  run1: [2, -30, 1, -26, 0, -15, 3, -8, 1, 0, -1, -8, -4, -4, 2, -21, 4, -16, -1, -21, -3, -16],
  run2: [2, -29, 1, -25, 0, -14, -3, -7, -7, -2, 5, -9, 7, -2, -3, -20, -6, -16, 4, -20, 7, -17],
  run3: [2, -30, 1, -26, 0, -15, -1, -8, -4, -4, 3, -8, 1, 0, -1, -21, -3, -16, 2, -21, 4, -16],
  step: [1, -29, 0, -25, 0, -14, 3, -7, 4, 0, -2, -7, -3, 0, 1, -20, 3, -15, -1, -20, -2, -14],
  jump: [3, -30, 2, -26, 0, -15, 6, -12, 9, -6, -4, -10, -9, -8, 5, -23, 9, -27, -4, -21, -8, -23],
  fall: [0, -31, 0, -27, 0, -16, 2, -9, 3, -2, -2, -9, -2, -2, 4, -30, 6, -35, -4, -30, -6, -35],
  crouch: [2, -19, 1, -15, -1, -7, 5, -6, 4, 0, -2, -3, -5, 0, 3, -11, 5, -6, -1, -11, 0, -6],
  pick: [4, -20, 2, -16, -1, -7, 5, -6, 5, 0, -2, -2, -6, 0, 5, -10, 8, -1, 0, -11, 1, -6],
  reach: [0, -31, 0, -27, 0, -16, 1, -8, 1, -2, -1, -8, -1, -2, 2, -32, 3, -38, 1, -32, 2, -38],
  hang: [1, -29, 1, -25, 0, -14, 1, -7, 1, 0, -1, -7, 0, 0, 3, -30, 6, -33, 2, -30, 5, -33],
  raise: [0, -29, 0, -25, 0, -14, 2, -7, 3, 0, -2, -7, -3, 0, 2, -31, 1, -37, -2, -31, 0, -37, 1, -54],
  drink: [0, -29, 0, -25, 0, -14, 1, -7, 1, 0, -1, -7, -2, 0, 4, -20, 2, -27, -1, -20, -2, -14],
  fight: [1, -28, 0, -24, -1, -13, 4, -7, 5, 0, -3, -7, -5, 0, 4, -20, 7, -19, -3, -20, -5, -23, 17, -27],
  fstep: [1, -28, 0, -24, -1, -13, 5, -7, 7, 0, -3, -7, -4, 0, 4, -20, 7, -19, -3, -20, -5, -23, 17, -27],
  windup: [0, -28, -1, -24, -1, -13, 4, -7, 5, 0, -3, -7, -5, 0, 2, -22, 2, -27, -3, -20, -5, -23, -8, -38],
  strike: [4, -27, 3, -23, 1, -13, 7, -7, 9, 0, -3, -6, -6, 0, 8, -20, 12, -19, -2, -20, -5, -22, 27, -15],
  low: [1, -28, 0, -24, -1, -13, 4, -7, 5, 0, -3, -7, -5, 0, 3, -17, 5, -11, -3, -19, -5, -15, -10, -2],
  strike2: [3, -29, 2, -25, 0, -14, 6, -7, 8, 0, -3, -7, -5, 0, 6, -24, 9, -29, -2, -21, -5, -18, 22, -44],
  block: [0, -28, 0, -24, -1, -13, 3, -7, 4, 0, -3, -7, -5, 0, 3, -22, 5, -26, -3, -20, -5, -21, 9, -42],
  lunge: [5, -26, 4, -22, 1, -13, 9, -6, 12, 0, -4, -6, -9, 0, 9, -20, 13, -20, -1, -20, -4, -22, 30, -22],
  hurt: [-3, -28, -2, -24, 0, -13, 2, -7, 3, 0, -2, -7, -4, 0, 0, -19, 3, -16, -4, -20, -6, -17, 12, -10],
  dead: [12, -3, 8, -3, 0, -3, -5, -3, -11, -1, -5, -2, -11, 0, 8, -1, 13, 0, 6, -2, 4, 0],
  sleep: [4, -18, 2, -15, -2, -7, 5, -7, 8, 0, 4, -6, 7, 0, 4, -11, 6, -7, 0, -11, 4, -7],
  kneel: [1, -21, 0, -17, -1, -8, 5, -8, 9, -1, -3, -1, -7, 0, 3, -13, 6, -9, -1, -13, 3, -9],
  aim: [1, -29, 0, -25, 0, -14, 2, -7, 3, 0, -2, -7, -3, 0, 5, -22, 10, -22, 2, -21, 7, -21],
  bashw: [-1, -29, -1, -25, 0, -14, 3, -7, 4, 0, -2, -7, -4, 0, 1, -24, -3, -28, -2, -22, -5, -26],
  bash: [3, -28, 2, -24, 1, -14, 6, -7, 8, 0, -3, -7, -5, 0, 7, -22, 13, -19, 4, -21, 10, -20],
};

const STY = {
  hero: { type: 'hero', skin: '#eab48a', hand: '#eab48a', handB: '#b47e5a', arm: '#d8c8a0', armB: '#9c8a64',
    body: '#e2d2aa', bodyB: '#bba67c', leg: '#7a5a3a', legB: '#54402a', boot: '#3a2616', belt: '#4a2c14',
    cloak: '#7a4e2c', cloakB: '#5a3820', hair: '#4a2a14', thick: 4 },
  blaster: { type: 'trooper', hand: '#2a2c32', handB: '#1c1e22', arm: '#8890a0', armB: '#5a6070',
    body: '#9aa2b2', plate: '#c8d0dc', leg: '#4a505e', legB: '#30343e', boot: '#18191d', belt: '#2a2c32',
    helm: '#5a6272', helmB: '#30343e', visor: '#ff3a30', thick: 5 },
  rifle: { type: 'trooper', hand: '#22241e', handB: '#16170f', arm: '#5e6454', armB: '#3e4438',
    body: '#6e7462', plate: '#9aa08a', leg: '#3a3e34', legB: '#26291f', boot: '#141510', belt: '#22241e',
    helm: '#4a5040', helmB: '#2a2e24', visor: '#ffb020', stripe: '#ff9020', thick: 5 },
  lord: { type: 'lord', skin: '#cfc4c4', hand: '#1a1418', handB: '#100c0f', arm: '#2a1e28', armB: '#1a1219',
    body: '#2a1e28', leg: '#1e161c', legB: '#120d11', boot: '#0a080a', belt: '#6a1420',
    cloak: '#1c1219', cloakB: '#0e0a0e', hood: '#120d12', eye: '#ff2020', thick: 5 },
};

// Kolejki elementów świecących – rysowane po nałożeniu ciemności, więc „świecą” w lochu
let BQ = [], EQ = [];

// Gładki odcinek z zaokrąglonymi końcami (kończyny, broń, ostrza)
function seg(a, b, w, col) {
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0] + 0.01, b[1]); ctx.stroke();
}
function dot(x, y, r, col) {
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}
function rrect(x, y, w, h, r, col) {
  ctx.fillStyle = col; ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  ctx.fill();
}
function poly(pts, col) {
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath(); ctx.fill();
}

function drawHead(h, n, dir, S, C) {
  const x = h[0], y = h[1];
  if (S.type === 'hero') {
    ctx.fillStyle = C(S.cloak); ctx.beginPath(); ctx.ellipse(n[0], n[1], 3.6, 1.6, 0, 0, Math.PI * 2); ctx.fill();   // kaptur zsunięty na ramiona
    ctx.fillStyle = C(S.skin); ctx.beginPath(); ctx.ellipse(x + dir * 0.4, y, 2.6, 3.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C(S.hair); ctx.beginPath(); ctx.ellipse(x - dir * 0.8, y - 1.8, 2.8, 1.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x - dir * 2.2, y, 1, 2.4, 0, 0, Math.PI * 2); ctx.fill();
    dot(x + dir * 1.4, y - 0.4, 0.5, C('#1a1010'));
  } else if (S.type === 'trooper') {
    rrect(x - 3, y - 4, 6, 7, 2.5, C(S.helm));
    rrect(x - 3, y + 1.6, 6, 1.4, 0.6, C(S.helmB));
    rrect(dir > 0 ? x - 3 : x + 2, y - 3, 1, 5, 0.5, C(S.helmB));
    if (S.stripe) rrect(x - 2.5, y - 4, 5, 1.2, 0.6, C(S.stripe));
    rrect(dir > 0 ? x - 0.2 : x - 2.8, y - 1.3, 3, 1.4, 0.7, C(S.visor));
    EQ.push({ x: x + dir, y: y - 0.6, col: S.visor, r: 4, a: 0.25 });
  } else {
    ctx.fillStyle = C(S.hood); ctx.beginPath(); ctx.ellipse(n[0], n[1], 4.2, 1.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - dir * 3.5, y + 4); ctx.quadraticCurveTo(x - dir * 4, y - 6, x + dir * 1, y - 5.2);
    ctx.quadraticCurveTo(x + dir * 4, y - 3, x + dir * 3.6, y + 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C(S.skin); ctx.beginPath(); ctx.ellipse(x + dir * 1.2, y + 0.8, 1.6, 2.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C('#3a2a30'); ctx.fillRect(x + dir * 1.2 - 1.6, y - 1.2, 3.2, 1);
    EQ.push({ x: x + dir * 1.5, y: y, col: S.eye, r: 5, a: 0.5 });
  }
}

// o: { blade: 'hand'|'hip'|'', ign, bc: kolor ostrza, trail, own, gun, mf, white, sway }
function drawFig(x, y, dir, a, S, o) {
  y -= 1;
  const J = i => [x + dir * a[i], y + a[i + 1]];
  const head = J(0), neck = J(2), hip = J(4), k1 = J(6), f1 = J(8), k2 = J(10), f2 = J(12);
  const e1 = J(14), h1 = J(16), e2 = J(18), h2 = J(20);
  const C = c => (o.white > 0 ? '#ffffff' : c);
  const upright = neck[1] < hip[1] - 6;
  // Płaszcz za postacią (faluje w ruchu)
  if (S.cloak && upright) {
    const sw = o.sway || 0;
    poly([[neck[0] + dir * 2, neck[1] - 1], [neck[0] - dir * 3, neck[1]],
      [hip[0] - dir * (6 + sw), hip[1] + 10], [hip[0] + dir * 2, hip[1] + 9]], C(S.cloakB));
  }
  // Rękojeść przy pasie
  if (o.blade === 'hip') {
    seg([hip[0] - dir * 2, hip[1] - 1], [hip[0] - dir * 6, hip[1] + 4], 2, C('#9aa4b4'));
    dot(hip[0] - dir * 6, hip[1] + 4, 1.2, C('#2a2e38'));
  }
  // Tylna ręka i noga
  seg(neck, e2, 2.2, C(S.armB)); seg(e2, h2, 2, C(S.armB));
  dot(h2[0], h2[1], 1.2, C(S.handB));
  seg(hip, k2, 2.6, C(S.legB)); seg(k2, f2, 2.2, C(S.legB));
  rrect(f2[0] - 1.4 + Math.min(0, dir), f2[1] - 1.2, 3.4, 2, 0.9, C(S.boot));
  // Tułów, tunika / szata / pancerz
  seg(neck, hip, S.thick, C(S.body));
  if (upright && S.type === 'hero') {
    poly([[hip[0] - 3, hip[1] - 3], [hip[0] + 3, hip[1] - 3], [hip[0] + 4 + dir, hip[1] + 6], [hip[0] - 4 + dir, hip[1] + 6]], C(S.bodyB));
  }
  if (upright && S.type === 'lord') {
    poly([[hip[0] - 3, hip[1] - 4], [hip[0] + 3, hip[1] - 4], [hip[0] + 6, hip[1] + 12], [hip[0] - 6, hip[1] + 12]], C(S.cloak));
  }
  if (S.type === 'trooper') {
    seg([neck[0] + dir, neck[1] + 2], [lerp(neck[0], hip[0], 0.6) + dir, lerp(neck[1], hip[1], 0.6)], 1, C(S.plate));
  }
  rrect(hip[0] - 2.5, hip[1] - 3, 5, 2, 0.8, C(S.belt));
  // Przednia noga
  seg(hip, k1, 2.6, C(S.leg)); seg(k1, f1, 2.2, C(S.leg));
  rrect(f1[0] - 1.4 + Math.min(0, dir), f1[1] - 1.2, 3.4, 2, 0.9, C(S.boot));
  drawHead(head, neck, dir, S, C);
  // Przednia ręka
  seg(neck, e1, 2.2, C(S.arm)); seg(e1, h1, 2, C(S.arm));
  // Broń palna w dłoni
  if (o.gun) {
    const vx = h1[0] - e1[0], vy = h1[1] - e1[1], n = Math.hypot(vx, vy) || 1, ux = vx / n, uy = vy / n;
    const rifle = o.gun === 'rifle', L = rifle ? 12 : 7, bk = rifle ? 5 : 1;
    const tip = [h1[0] + ux * L, h1[1] + uy * L];
    seg([h1[0] - ux * bk, h1[1] - uy * bk], tip, 2, C('#1e2026'));
    seg([h1[0] + ux * 2, h1[1] + uy * 2 - 1], [tip[0], tip[1] - 1], 1, C('#4a4e58'));
    if (rifle) seg([h1[0] + ux * 5.5, h1[1] + uy * 5.5 - 1], [h1[0] + ux * 7.5, h1[1] + uy * 7.5 - 1], 1, C(S.stripe));
    if (o.mf > 0) EQ.push({ x: tip[0] + ux * 2, y: tip[1] + uy * 2 - 1, col: '#ffe0c0', r: 9, a: 0.8, star: true });
  }
  dot(h1[0], h1[1], 1.2, C(S.hand));
  // Ostrze energii (rysowane później – świeci)
  if (o.blade === 'hand' && o.ign > 0.02) {
    let tx, ty;
    if (a.length > 22) { tx = x + dir * a[22]; ty = y + a[23]; }
    else { tx = h1[0] + (h1[0] - e1[0]) * 3; ty = h1[1] + (h1[1] - e1[1]) * 3; }
    const vx = tx - h1[0], vy = ty - h1[1], n = Math.hypot(vx, vy) || 1, ux = vx / n, uy = vy / n, L = 18 * o.ign;
    seg([h1[0] - ux * 2, h1[1] - uy * 2], [h1[0] + ux, h1[1] + uy], 2, C('#b8c0cc'));
    BQ.push({ h: [h1[0] + ux * 2, h1[1] + uy * 2], t: [h1[0] + ux * (2 + L), h1[1] + uy * (2 + L)],
      bc: o.bc, trail: o.trail, own: o.own });
  } else if (o.own) o.own.trail.length = 0;
}

function lerpPose(a, b, k) {
  const n = Math.max(a.length, b.length), r = [];
  for (let i = 0; i < n; i++) r.push(lerp(a[i] !== undefined ? a[i] : b[i], b[i] !== undefined ? b[i] : a[i], k));
  return r;
}

// Animacja cięcia: zamach → szybkie cięcie (ze smugą) → zatrzymanie → powrót do gardy
function slashPose(t, combo) {
  const A = combo ? POSE.low : POSE.windup, B = combo ? POSE.strike2 : POSE.strike;
  if (t < 0.07) return { a: lerpPose(POSE.fight, A, t / 0.07), tr: false };
  if (t < 0.17) return { a: lerpPose(A, B, ease((t - 0.07) / 0.1)), tr: true };
  if (t < 0.26) return { a: B, tr: t < 0.21 };
  return { a: lerpPose(B, POSE.fight, Math.min(1, (t - 0.26) / 0.08)), tr: false };
}

// Finiszery: 0 wirowe cięcie, 1 cios z wyskoku, 2 pchnięcie
function finPose(p) {
  const t = p.t, F = POSE.fight;
  if (p.fv === 0) {
    const k = Math.min(1, t / 0.55);
    if (k < 1) {
      const a = POSE.strike2.slice(), th = -Math.PI / 2 + ease(k) * Math.PI * 2;
      a[22] = a[16] + Math.cos(th) * 24; a[23] = a[17] + Math.sin(th) * 24;
      return { a, tr: true, dy: 0 };
    }
    return { a: lerpPose(POSE.strike2, F, Math.min(1, (t - 0.55) / 0.2)), tr: false, dy: 0 };
  }
  if (p.fv === 1) {
    const dy = -Math.sin(Math.PI * Math.min(1, t / 0.45)) * 14;
    if (t < 0.2) return { a: lerpPose(F, POSE.windup, t / 0.2), tr: false, dy };
    if (t < 0.45) return { a: lerpPose(POSE.windup, POSE.strike2, ease((t - 0.2) / 0.25)), tr: true, dy };
    if (t < 0.65) return { a: lerpPose(POSE.strike2, POSE.low, (t - 0.45) / 0.2), tr: false, dy };
    return { a: lerpPose(POSE.low, F, Math.min(1, (t - 0.65) / 0.2)), tr: false, dy };
  }
  if (t < 0.12) return { a: lerpPose(F, POSE.windup, t / 0.12), tr: false, dy: 0 };
  if (t < 0.24) return { a: lerpPose(POSE.windup, POSE.lunge, ease((t - 0.12) / 0.12)), tr: true, dy: 0 };
  if (t < 0.55) return { a: POSE.lunge, tr: false, dy: 0 };
  return { a: lerpPose(POSE.lunge, F, Math.min(1, (t - 0.55) / 0.2)), tr: false, dy: 0 };
}

// Nogi z animacji chodu, reszta z pozy (chód z bronią gotową do strzału / w gardzie)
function walkPose(base, t) {
  const r = POSE['run' + (Math.floor(t * 6) % 4)], a = base.slice();
  for (let i = 4; i < 14; i++) a[i] = r[i];
  return a;
}

function drawPlayer() {
  const p = P;
  let a = POSE.stand, x = p.x, y = p.y, blade = p.sword ? 'hip' : '', ign = p.ign, tr = false, sway = 0;
  switch (p.st) {
    case 'run': a = POSE['run' + (Math.floor(p.t * 9) % 4)]; sway = 3 + Math.sin(p.t * 18) * 1.5; break;
    case 'step': a = (p.t % 0.45) < 0.22 ? POSE.step : POSE.stand; break;
    case 'jump': a = POSE.jump; sway = 5; break;
    case 'fall': a = p.soft ? POSE.fall : (p.vy < 120 ? POSE.jump : POSE.fall); sway = -2; break;
    case 'land': case 'crouch': a = POSE.crouch; break;
    case 'upjump': a = POSE.reach; y -= Math.sin(Math.PI * Math.min(1, p.t / 0.45)) * 9; break;
    case 'reach': a = POSE.reach; break;
    case 'hang': a = POSE.hang; break;
    case 'climb': case 'climbdown': {
      const k = p.st === 'climb' ? Math.min(1, p.t / 0.6) : 1 - Math.min(1, p.t / 0.5);
      const hx = p.hang.ex - p.dir * HW, hy = floorY(p.hang.r) + HANG_DY;
      const tx = p.hang.ex + p.dir * 8, ty = floorY(p.hang.r);
      a = lerpPose(POSE.hang, POSE.crouch, k);
      x = lerp(hx, tx, k); y = lerp(hy, ty, Math.min(1, k * 1.3));
      break;
    }
    case 'sword':
      blade = '';
      if (p.t < 0.45) a = POSE.pick;
      else if (p.t < 0.75) { a = lerpPose(POSE.pick, POSE.raise, (p.t - 0.45) / 0.3); blade = 'hand'; ign = Math.min(1, (p.t - 0.5) / 0.25); }
      else if (p.t < 1.9) { a = POSE.raise; blade = 'hand'; ign = 1; }
      else { a = lerpPose(POSE.raise, POSE.stand, Math.min(1, (p.t - 1.9) / 0.4)); blade = 'hand'; ign = Math.max(0, 1 - (p.t - 1.9) / 0.35); }
      break;
    case 'drink': a = p.t < 0.4 ? POSE.pick : POSE.drink; break;
    case 'fight': a = POSE.fight; blade = 'hand'; break;
    case 'fstep': a = POSE.fstep; blade = 'hand'; break;
    case 'strike': { const s = slashPose(p.t, p.combo); a = s.a; tr = s.tr; blade = 'hand'; break; }
    case 'block': a = POSE.block; blade = 'hand'; break;
    case 'fin': { const s = finPose(p); a = s.a; tr = s.tr; y += s.dy; blade = 'hand'; break; }
    case 'use': a = POSE.aim; break;
    case 'hurt': a = POSE.hurt; blade = p.sword && p.ign > 0.02 ? 'hand' : blade; break;
    case 'dead': a = POSE.dead; blade = ''; break;
    case 'exit': ctx.globalAlpha = Math.max(0, 1 - p.t / 1.4); break;
  }
  if (p.inv > 0 && p.st !== 'dead' && Math.floor(p.inv * 20) % 2) ctx.globalAlpha = 0.35;
  if (blade === 'hand' && ign <= 0.02 && p.st !== 'sword') blade = p.sword ? 'hip' : '';
  drawFig(x, y, p.dir, a, STY.hero, { blade, ign, bc: game.blade, trail: tr, own: p, sway });
  ctx.globalAlpha = 1;
  // Smuga przy upadku z nieba
  if (p.soft && p.air) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 4; i++) ctx.fillRect(Math.round(x - 6 + i * 4), Math.round(y - 40 - (i % 2) * 6), 1, 8);
  }
}

function drawFoe(f) {
  if (f.st === 'gone') return;
  const S = STY[f.k];
  let a = POSE.stand, blade = '', ign = 1, tr = false, gun = f.k === 'lord' ? '' : f.k, y = f.y, alpha = 1;
  if (f.k === 'lord') {
    blade = 'hand';
    switch (f.st) {
      case 'meditate': a = POSE.kneel; blade = 'hip'; break;
      case 'rise': a = lerpPose(POSE.kneel, POSE.fight, Math.min(1, f.t / 0.8)); ign = Math.min(1, f.t / 0.5); break;
      case 'guard': a = f.mv > 0 ? walkPose(POSE.fight, f.t) : POSE.fight; break;
      case 'hop': a = POSE.jump; y -= Math.sin(Math.PI * Math.min(1, f.t / 0.3)) * 8; break;
      case 'wind': a = lerpPose(POSE.fight, POSE.windup, Math.min(1, f.t / 0.2)); break;
      case 'lunge': a = POSE.lunge; tr = true; break;
      case 'gstrike': a = f.t < 0.08 ? lerpPose(POSE.windup, POSE.strike, ease(f.t / 0.08)) : POSE.strike; tr = f.t < 0.14; break;
      case 'gblock': a = POSE.block; break;
      case 'ghurt': case 'stun': a = POSE.hurt; break;
      case 'fin':
        // Ostrze gaśnie, Lord klęka i rozpływa się w żarze
        a = f.t < 0.3 ? POSE.hurt : lerpPose(POSE.hurt, POSE.kneel, Math.min(1, (f.t - 0.3) / 0.5));
        ign = Math.max(0, 1 - f.t / 0.5); if (f.t >= 0.5) blade = '';
        alpha = f.t < 1 ? 1 : Math.max(0, 1 - (f.t - 1) / 1.5);
        break;
      case 'ffall': a = POSE.fall; blade = ''; break;
      case 'fdead': a = POSE.dead; blade = ''; break;
    }
  } else {
    switch (f.st) {
      case 'sleep': a = POSE.sleep; break;
      case 'idle':
        a = f.aw ? POSE.aim : POSE.stand;
        if (f.mv > 0) a = f.aw ? walkPose(POSE.aim, f.t) : POSE['run' + (Math.floor(f.t * 5) % 4)];
        break;
      case 'aim': case 'fire': a = POSE.aim; break;
      case 'dodge': a = POSE.jump; y -= Math.sin(Math.PI * Math.min(1, f.t / 0.34)) * 7; break;
      case 'bash': a = f.t < 0.3 ? POSE.bashw : POSE.bash; break;
      case 'thurt': case 'tstun': a = POSE.hurt; break;
      case 'fin':
        // Rozcięta broń wypada z rąk, żołnierz osuwa się na kolana i pada
        gun = '';
        a = f.t < 0.3 ? POSE.hurt : f.t < 0.7 ? lerpPose(POSE.hurt, POSE.kneel, (f.t - 0.3) / 0.4)
          : lerpPose(POSE.kneel, POSE.dead, Math.min(1, (f.t - 0.7) / 0.5));
        break;
      case 'ffall': a = POSE.fall; gun = ''; break;
      case 'fdead': a = POSE.dead; gun = ''; break;
    }
  }
  const eq0 = EQ.length;
  ctx.globalAlpha = alpha;
  drawFig(f.x, y, f.dir, a, S, { blade, ign, bc: RED, trail: tr, own: f, gun, mf: f.mf, white: f.white });
  ctx.globalAlpha = 1;
  if (alpha < 1) for (let i = eq0; i < EQ.length; i++) EQ[i].a *= alpha;
  if (f.st === 'sleep') {
    const k = (game.anim * 0.8) % 1;
    txt('z', f.x - 2 + k * 4, f.y - 24 - k * 10, `rgba(220,220,255,${1 - k})`, 'center', 7 + k * 2, true);
  }
  if (f.st === 'fdead' && f.t < 1.5 && f.k !== 'lord' && Math.random() < 0.15) {
    burst(f.x + (Math.random() - 0.5) * 10, f.y - 3, 1, '#80c0ff', 30, 30, true);   // iskrzący pancerz
  }
}

// ===== Rysowanie: elementy dynamiczne =====
function drawLamp(x, y) {
  const T = THEMES[LV.theme], t = game.anim, f = Math.sin(t * 17 + x) + Math.sin(t * 23 + y);
  if (T.lamp === 'fire') {
    ctx.fillStyle = '#4a2e18'; ctx.fillRect(x - 1, y, 3, 7);
    ctx.fillStyle = '#6a4424'; ctx.fillRect(x - 2, y, 5, 1);
    const h = 4 + (f > 0 ? 1 : 0) + (f > 1 ? 1 : 0);
    ctx.fillStyle = '#e04010'; ctx.fillRect(x - 1, y - h, 3, h);
    ctx.fillStyle = '#ffa020'; ctx.fillRect(x - (f > 0.5 ? 1 : 0), y - h + 1, 2, h - 1);
    ctx.fillStyle = '#fff080'; ctx.fillRect(x, y - 2, 1, 2);
  } else {
    ctx.fillStyle = '#1a1c22'; ctx.fillRect(x - 4, y - 3, 9, 7);
    ctx.fillStyle = '#3a3e48'; ctx.fillRect(x - 3, y - 2, 7, 5);
    const k = 0.75 + Math.sin(t * 3 + x) * 0.25;
    ctx.fillStyle = `rgba(${T.rgb},${k})`; ctx.fillRect(x - 2, y - 1, 5, 3);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1);
  }
}

function drawDynamic() {
  // Luźne płyty
  for (const L of LOOSE) {
    const lx = L.c * TW, pal = slabPal(L.r);
    if (L.st === 'ok' || L.st === 'shake') {
      const j = L.st === 'shake' ? (Math.random() < 0.5 ? -1 : 1) : 0;
      slab(ctx, lx, floorY(L.r) + j, TW, pal);
      ctx.fillStyle = pal[2];
      ctx.fillRect(lx + 9, floorY(L.r) + j + 2, 1, 3); ctx.fillRect(lx + 21, floorY(L.r) + j + 3, 1, 3);
    } else if (L.st === 'fall') {
      slab(ctx, lx, Math.round(L.y), TW, pal);
    } else if (L.st === 'gone' && L.rr < ROWS) {
      const fy = floorY(L.rr);
      ctx.fillStyle = '#8a7a60';
      [[4, 2, 3], [9, 1, 4], [15, 2, 3], [20, 1, 5], [26, 2, 3]].forEach(([dx, h, w]) => ctx.fillRect(lx + dx, fy - h, w, h));
      ctx.fillStyle = '#5a4a38'; ctx.fillRect(lx + 6, fy - 1, 20, 1);
    }
  }
  // Kolce
  for (const k in spikes) {
    const [r, c] = k.split(',').map(Number), fy = floorY(r), h = Math.round(1 + spikes[k] * 8);
    for (let i = 0; i < 5; i++) {
      const sx = c * TW + 3 + i * 6;
      for (let j = 0; j < h; j++) {
        ctx.fillStyle = j > h - 3 ? '#e8ecf8' : '#9aa0b4';
        const w = Math.max(1, Math.round(3 * (1 - j / (h + 1))));
        ctx.fillRect(sx + 1 - Math.floor(w / 2), fy - 1 - j, w, 1);
      }
    }
  }
  // Płyta naciskowa, krata, przedmioty, blokada drzwi
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const ch = MAP[r][c], x = c * TW, fy = floorY(r);
    if (ch === 'P') {
      const d = plateDown() ? 1 : 0;
      ctx.fillStyle = '#8890a8'; ctx.fillRect(x + 5, fy - 2 + d, 22, 2 - d);
      ctx.fillStyle = '#c0c4d4'; ctx.fillRect(x + 5, fy - 2 + d, 22, 1);
      ctx.fillStyle = d ? '#60ff80' : '#ff5040'; ctx.fillRect(x + 15, fy - 2 + d, 2, 1);
    } else if (ch === 'G') {
      const top = floorY(r - 1) + 7, full = fy - top, len = Math.round(full * (1 - gate)) + 2;
      const gx = x + TW / 2 - 4;
      ctx.fillStyle = '#3a3e4c'; ctx.fillRect(gx - 2, Math.max(0, top), 12, 3);
      ctx.fillStyle = '#7a8090';
      for (let i = 0; i < 4; i++) ctx.fillRect(gx + i * 2 + 1, top, 1, len);
      for (let yy = top + len - 1; yy > top; yy -= 6) ctx.fillRect(gx, yy, 8, 1);
      ctx.fillStyle = '#a8aebc'; ctx.fillRect(gx, top + len - 1, 8, 1);
    } else if (ch === 'W') {
      // Rękojeść ostrza z pulsującym kryształem
      const y = fy - 2, sx = x + 11;
      ctx.fillStyle = '#9aa4b4'; ctx.fillRect(sx, y, 10, 2);
      ctx.fillStyle = '#d8e0ec'; ctx.fillRect(sx, y, 10, 1);
      ctx.fillStyle = '#2a2e38'; ctx.fillRect(sx + 3, y, 1, 2); ctx.fillRect(sx + 6, y, 1, 2);
      ctx.fillStyle = '#5a6070'; ctx.fillRect(sx + 10, y - 1, 2, 4);
      EQ.push({ x: sx + 12, y: y + 1, col: '#ffffff', r: 8 + Math.sin(game.anim * 4) * 2, a: 0.5, rgb: '200,220,255' });
    } else if (ch === 'H' || ch === 'M') {
      const big = ch === 'M', px = x + 14, y = fy, col = big ? '#e0a020' : '#c01830';
      ctx.fillStyle = '#d0d8e8'; ctx.fillRect(px + 1, y - (big ? 11 : 9), 2, 3);
      ctx.fillStyle = col; ctx.fillRect(px - (big ? 1 : 0), y - (big ? 8 : 6), big ? 6 : 4, big ? 7 : 5);
      ctx.fillStyle = big ? '#ffe080' : '#ff6078'; ctx.fillRect(px - (big ? 1 : 0), y - (big ? 8 : 6), 1, 2);
      ctx.fillStyle = '#8a5030'; ctx.fillRect(px + 1, y - (big ? 12 : 10), 2, 1);
      const b = (game.anim * 1.5) % 1;
      ctx.fillStyle = big ? `rgba(255,220,120,${1 - b})` : `rgba(255,140,160,${1 - b})`;
      ctx.fillRect(px + 2, Math.round(y - 13 - b * 8), 1, 1);
      EQ.push({ x: px + 2, y: y - 4, col, r: 10, a: 0.25, rgb: big ? '255,200,60' : '255,60,90' });
    } else if (ch === 'D' && !doorOpen()) {
      // Pole siłowe Lorda zamyka wrota
      for (let yy = fy - 30; yy < fy; yy += 2) {
        const k = 0.4 + 0.4 * Math.sin(game.anim * 9 + yy * 0.7);
        ctx.fillStyle = `rgba(255,40,60,${k})`; ctx.fillRect(x + 6, yy, 20, 1);
      }
      EQ.push({ x: x + 16, y: fy - 16, col: '#ff3040', r: 24, a: 0.3, rgb: '255,40,60' });
    } else if (ch === 'B') {
      // Skrzynia z zaopatrzeniem
      const bx = x + 8, by = fy - 14;
      ctx.fillStyle = '#3a2614'; ctx.fillRect(bx, by, 16, 14);
      ctx.fillStyle = '#8a6034'; ctx.fillRect(bx + 1, by + 1, 14, 12);
      ctx.fillStyle = '#6a4626'; ctx.fillRect(bx + 1, by + 4, 14, 1); ctx.fillRect(bx + 1, by + 9, 14, 1);
      ctx.fillStyle = '#a87c4a'; ctx.fillRect(bx + 1, by + 1, 14, 1);
      ctx.fillStyle = '#c8a040'; ctx.fillRect(bx + 3, by + 6, 3, 2); ctx.fillRect(bx + 10, by + 6, 3, 2);
      ctx.fillStyle = '#2a2a30'; ctx.fillRect(bx + 7, by + 5, 2, 4);
    } else if (ch === 'O') {
      // Kryształ energii (unosi się i pulsuje)
      const cx = x + 16, cy = fy - 8 + Math.sin(game.anim * 3 + c) * 1.5;
      poly([[cx, cy - 5], [cx + 3, cy], [cx, cy + 5], [cx - 3, cy]], '#40c8ff');
      poly([[cx, cy - 5], [cx + 3, cy], [cx, cy]], '#c0f4ff');
      EQ.push({ x: cx, y: cy, col: '#a0f0ff', r: 12 + Math.sin(game.anim * 5) * 2, a: 0.45, rgb: '80,200,255' });
    } else if (ch === 'T') {
      // Terminal z zapiskami
      const tx = x + 11;
      ctx.fillStyle = '#20242c'; ctx.fillRect(tx + 4, fy - 10, 3, 10);
      ctx.fillStyle = '#2e333e'; ctx.fillRect(tx, fy - 20, 11, 11);
      const k = 0.6 + 0.3 * Math.sin(game.anim * 7) + (Math.random() < 0.05 ? -0.4 : 0);
      ctx.fillStyle = `rgba(90,170,255,${k})`; ctx.fillRect(tx + 1, fy - 19, 9, 8);
      ctx.fillStyle = 'rgba(220,240,255,0.7)';
      for (let i = 0; i < 3; i++) ctx.fillRect(tx + 2, fy - 18 + i * 2.5, 3 + ((i * 5 + Math.floor(game.anim * 2)) % 5), 0.8);
      EQ.push({ x: tx + 5, y: fy - 15, col: '#80c0ff', r: 14, a: 0.3, rgb: '90,170,255' });
    } else if (ch === 'K') {
      // Konsola sterująca barierami i kratą
      const kx = x + 9, on = used;
      ctx.fillStyle = '#262a34'; ctx.fillRect(kx, fy - 12, 14, 12);
      ctx.fillStyle = '#3e4452'; ctx.fillRect(kx - 1, fy - 13, 16, 3);
      ctx.fillStyle = '#5a6070'; ctx.fillRect(kx + 2, fy - 9, 10, 1);
      ctx.fillStyle = '#9aa0b0'; ctx.fillRect(kx + (on ? 9 : 3), fy - 12, 2, 2);   // przełącznik
      const lc = on ? '#60ff80' : (Math.floor(game.anim * 3) % 2 ? '#ff4030' : '#802018');
      ctx.fillStyle = lc; ctx.fillRect(kx + 6, fy - 6, 2, 2);
      EQ.push({ x: kx + 7, y: fy - 5, col: lc, r: 8, a: 0.4, rgb: on ? '96,255,128' : '255,64,48' });
    } else if (ch === 'E') {
      // Bariera energetyczna (pulsuje cyklicznie)
      const cx = x + 16, top = fy - 30, on = barrierOn(c);
      ctx.fillStyle = '#3a3e4c'; ctx.fillRect(cx - 3, top - 2, 6, 3); ctx.fillRect(cx - 3, fy - 2, 6, 2);
      ctx.fillStyle = used ? '#30343c' : on ? '#ffa040' : '#6a4020';
      ctx.fillRect(cx - 1, top + 1, 2, 1); ctx.fillRect(cx - 1, fy - 3, 2, 1);
      if (on) {
        for (let yy = top + 1; yy < fy - 2; yy += 1) {
          const k = 0.35 + 0.35 * Math.sin(game.anim * 30 + yy * 1.3);
          ctx.fillStyle = `rgba(255,140,40,${k})`; ctx.fillRect(cx - 1.5 + Math.sin(yy + game.anim * 20) * 0.6, yy, 3, 1);
        }
        EQ.push({ x: cx, y: fy - 16, col: '#ffc080', r: 22, a: 0.35, rgb: '255,140,40' });
      } else if (!used && ((game.anim + c * 0.37) % 3.2) > 2.8) {
        // Ostrzeżenie: bariera zaraz się włączy
        ctx.fillStyle = 'rgba(255,140,40,0.5)'; ctx.fillRect(cx - 0.5, top + 1, 1, fy - top - 3);
      }
    }
  }
  for (const l of lamps) drawLamp(l.x, l.y);
}

function glow(x, y, rad, rgb, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
}
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16)).join(',');

// Ciemność lochu + światła (lampy, ostrza, strzały, iskry)
function lighting() {
  const T = THEMES[LV.theme], top = LV.sky ? 62 : 0;
  ctx.fillStyle = `rgba(2,2,12,${T.dark})`; ctx.fillRect(0, top, SW, 180 - top);
  ctx.globalCompositeOperation = 'lighter';
  for (const l of lamps) {
    const fl = 1 + Math.sin(game.anim * 13 + l.x) * 0.06;
    glow(l.x, l.y - 2, 42 * fl, T.rgb, 0.22);
  }
  for (const b of BQ) glow((b.h[0] + b.t[0]) / 2, (b.h[1] + b.t[1]) / 2, 30, b.bc.rgb, 0.3);
  for (const b of BOLTS) glow(b.x, b.y, 16, '255,60,40', 0.35);
  for (const e of EQ) glow(e.x, e.y, e.r, e.rgb || hexRgb(e.col), e.a);
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(vignette(), 0, 0, SW, 180);
}

function drawEmissive() {
  // Smugi i ostrza
  for (const b of BQ) {
    const own = b.own;
    if (own) {
      if (b.trail) { own.trail.push([b.h[0], b.h[1], b.t[0], b.t[1]]); if (own.trail.length > 7) own.trail.shift(); }
      else own.trail.splice(0, 2);
      const tr = own.trail, n = tr.length;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 1; i < n; i++) {
        const p0 = tr[i - 1], p1 = tr[i];
        ctx.fillStyle = `rgba(${b.bc.rgb},${0.1 + 0.4 * i / n})`;
        ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p0[2], p0[3]); ctx.lineTo(p1[2], p1[3]); ctx.lineTo(p1[0], p1[1]);
        ctx.closePath(); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalCompositeOperation = 'lighter';
    seg(b.h, b.t, 5, `rgba(${b.bc.rgb},0.25)`);
    ctx.globalCompositeOperation = 'source-over';
    seg(b.h, b.t, 2.6, `rgba(${b.bc.rgb},0.9)`);
    seg(b.h, b.t, 1.1, '#ffffff');
  }
  // Strzały
  ctx.globalCompositeOperation = 'lighter';
  for (const b of BOLTS) {
    const s = Math.sign(b.vx);
    seg([b.x, b.y], [b.x - s * 8, b.y], 4, 'rgba(255,60,40,0.35)');
    seg([b.x, b.y], [b.x - s * 7, b.y], 2, 'rgba(255,80,50,0.9)');
    seg([b.x, b.y], [b.x - s * 6, b.y], 0.8, '#fff0e8');
  }
  // Iskry i świecące punkty
  for (const q of parts) if (q.e) dot(q.x, q.y, 0.7, q.col);
  for (const e of EQ) {
    dot(e.x, e.y, 0.7, e.col);
    if (e.star) { seg([e.x - 3, e.y], [e.x + 3, e.y], 0.8, e.col); seg([e.x, e.y - 3], [e.x, e.y + 3], 0.8, e.col); }
  }
  ctx.globalCompositeOperation = 'source-over';
}

function tri(x, y, full, col, dark) {
  ctx.beginPath(); ctx.moveTo(x + 0.5, y + 0.5); ctx.lineTo(x + 6.5, y + 0.5); ctx.lineTo(x + 3.5, y + 4.5); ctx.closePath();
  if (full) { ctx.fillStyle = col; ctx.fill(); }
  else { ctx.strokeStyle = dark; ctx.lineWidth = 0.8; ctx.lineJoin = 'round'; ctx.stroke(); }
}

function hint() {
  const p = P, ch = cell(p.r, colOf(p.x));
  if (p.st === 'dead') return 'R lub A – spróbuj ponownie';
  if (p.st === 'hang') return '↑ podciągnij się · ↓ puść krawędź';
  if (p.st === 'sword' || p.st === 'exit' || p.st === 'fin') return '';
  const shooter = FOES.some(f => f.alive && f.k !== 'lord' && f.r === p.r && (f.st === 'aim' || f.st === 'fire'));
  if (FIGHTST.includes(p.st) || p.st === 'hurt') {
    if (shooter && !engaged()) return 'Strzelec! A – cięcie odbija strzały · S schowaj';
    return 'A cios (2× kombo) · ↑ zasłona · ←→ krok' + (p.drawn ? ' · S schowaj' : '');
  }
  if (ch === 'W') return 'A – podnieś rękojeść';
  if (ch === 'H' || ch === 'M') return 'A – wypij miksturę';
  if (ch === 'T') return 'A – odczytaj terminal';
  if (ch === 'K') return used ? '' : 'A – użyj konsoli';
  if (atDoor()) return doorOpen() ? '↑ – wyjdź przez wrota' : 'Pokonaj Lorda, by zgasić pole siłowe';
  if (crateAhead() >= 0) return p.sword ? 'A – rozbij skrzynię' : 'Skrzynię rozetnie tylko ostrze';
  if (!p.sword) return '←→ bieg · Shift+←→ ostrożny krok · ↑ skok · ↓ zwis';
  if (gate >= 0.8 && gateT <= 0 && !used) return 'Krata się zamyka – biegnij!';
  if (shooter) return 'Strzelec! A – cięcie odbija strzały';
  return '';
}

// Tekst trafia do kolejki i jest rysowany na gładkiej warstwie #txt (współrzędne w pikselach gry)
let TQ = [];
function txt(s, x, y, col, align, size, noShadow) {
  TQ.push({ s, x, y, col, align: align || 'center', size: size || 8, sh: !noShadow });
}
function drawText() {
  tctx.setTransform(1, 0, 0, 1, 0, 0);
  tctx.clearRect(0, 0, tv.width, tv.height);
  tctx.setTransform(TS, 0, 0, TS, 0, 0);
  tctx.textBaseline = 'middle';
  for (const q of TQ) {
    tctx.font = `bold ${q.size}px "Segoe UI", Tahoma, Verdana, sans-serif`;
    tctx.textAlign = q.align;
    if (q.sh) { tctx.fillStyle = 'rgba(0,0,0,0.85)'; tctx.fillText(q.s, q.x + 0.6, q.y + 0.6); }
    tctx.fillStyle = q.col; tctx.fillText(q.s, q.x, q.y);
  }
  TQ = [];
}

function drawHUD() {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 180, SW, 20);
  for (let i = 0; i < P.max; i++) tri(4 + i * 9, 187, i < P.hp, '#e82020', '#701010');
  let f = engaged();
  if (!f && game.hud && game.hudT > 0) f = game.hud;
  if (f) {
    const col = f.k === 'lord' ? '#ff3040' : f.k === 'rifle' ? '#f0a020' : '#80a0f0', sp = f.max > 6 ? 7 : 9;
    for (let i = 0; i < f.max; i++) tri(SW - 11 - i * sp, 187, i < f.hp && f.alive, col, '#302030');
  }
  const s = msg.t > 0 ? msg.text : hint();
  txt(s, SW / 2, 190, msg.t > 0 ? '#f0d890' : '#a0a0b0', 'center', s.length > 44 ? 6.5 : 8);
  const m = Math.floor(game.time / 60), sec = Math.floor(game.time % 60);
  txt(m + ':' + String(sec).padStart(2, '0'), SW - 4, 6, '#c8c0d8', 'right');
  txt('◆ ' + game.crys, SW - 30, 6, '#80e0ff', 'right', 7);
  txt((lvl + 1) + '/' + LEVELS.length + '  ' + LV.name, 4, 6, '#a8a0c0', 'left', 7);
}

// Odłamki: rozcięta broń, deski, rękojeść Lorda (gorący koniec żarzy się)
function drawDebris() {
  for (const d of DEBRIS) {
    const ux = Math.cos(d.a) * d.len / 2, uy = Math.sin(d.a) * d.len / 2;
    ctx.globalAlpha = Math.min(1, d.life * 2);
    seg([d.x - ux, d.y - uy], [d.x + ux, d.y + uy], 1.8, d.col);
    if (d.hot > 0) {
      dot(d.x + ux, d.y + uy, 1, `rgba(255,170,80,${Math.min(1, d.hot * 2)})`);
      EQ.push({ x: d.x + ux, y: d.y + uy, col: '#ffb060', r: 6, a: 0.5 * Math.min(1, d.hot * 2), rgb: '255,150,60' });
    }
  }
  ctx.globalAlpha = 1;
}

function draw() {
  TQ = []; BQ = []; EQ = [];
  ctx.setTransform(RS, 0, 0, RS, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  if (game.mode === 'trans') {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SW, SH);
    const k = Math.min(1, game.trans / 0.6, (2.4 - game.trans) / 0.4);
    const n = LEVELS[lvl + 1];
    txt('POZIOM ' + (lvl + 2), SW / 2, 84, `rgba(240,192,64,${k})`, 'center', 14);
    txt(n.name, SW / 2, 104, `rgba(232,216,176,${k})`, 'center', 9);
    drawText();
    return;
  }
  ctx.save();
  if (game.shake > 0.3) ctx.translate((Math.random() - 0.5) * game.shake * 2, (Math.random() - 0.5) * game.shake * 2);
  if (BGS[lvl].width !== SW * RS) BGS[lvl] = buildBG(LV);   // zmiana rozdzielczości (obrót / okno)
  ctx.drawImage(BGS[lvl], 0, 0, SW, SH);
  drawDynamic();
  if (game.mode !== 'title') {
    for (const f of FOES) if (!f.alive && !(f.st === 'ffall' && f.y > SH)) drawFoe(f);
    for (const f of FOES) if (f.alive) drawFoe(f);
    drawPlayer();
    drawDebris();
  }
  for (const q of parts) if (!q.e) dot(q.x, q.y, 0.7, q.col);
  lighting();
  drawEmissive();
  ctx.restore();
  // Błysk przy zapłonie ostrza (ekran mruga kolorem kryształu)
  if (P && P.st === 'sword' && P.t >= 0.45 && P.t < 1.1 && Math.floor(P.t * 14) % 2 === 0) {
    ctx.fillStyle = `rgba(${game.blade.rgb},0.4)`; ctx.fillRect(0, 0, SW, 180);
  }
  if (flash) { ctx.globalAlpha = Math.min(0.5, flash.t * 3); ctx.fillStyle = flash.col; ctx.fillRect(0, 0, SW, 180); ctx.globalAlpha = 1; }
  // Kinowe pasy przy finiszerze
  if (game.bars > 0.01) {
    const h = 16 * game.bars;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SW, h); ctx.fillRect(0, 180 - h, SW, h);
    if (game.bars > 0.5 && game.finName) txt(game.finName, SW / 2, 8, `rgba(255,230,170,${(game.bars - 0.5) * 2})`, 'center', 9);
  }
  if (game.mode !== 'title') drawHUD();
  if (game.mode === 'play' && P.st === 'dead' && P.t > 1.2) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 70, SW, 34);
    txt('KONIEC', SW / 2, 80, '#e04030', 'center', 11);
    txt('R / A – powtórz poziom', SW / 2, 94, '#e0d0b0');
  }
  if (game.mode === 'win') {
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, SW, 180);
    const m = Math.floor(game.time / 60), sec = Math.floor(game.time % 60);
    txt('ROZDZIAŁ I UKOŃCZONY', SW / 2, 56, '#f0c040', 'center', 14);
    txt('Mroczny Lord upadł, a cytadela jest wolna.', SW / 2, 80, '#e8d8b0');
    txt('Czas: ' + m + ':' + String(sec).padStart(2, '0') + '   Życie: ' + P.hp + '/' + P.max + '   Kryształy: ' + game.crys, SW / 2, 96, '#e8d8b0');
    txt('A – zagraj ponownie', SW / 2, 124, '#a0a0b0');
  }
  drawText();
}

// ===== Pętla =====
let last = 0, acc = 0;
function frame(t) {
  const now = t / 1000;
  const dt = Math.min(0.1, now - (last || now));
  last = now; acc += dt;
  while (acc >= STEP) {
    update(STEP);
    for (const k in PR) PR[k] = false;
    acc -= STEP;
  }
  draw();
  requestAnimationFrame(frame);
}

loadLevel(0);
game.mode = 'title';
requestAnimationFrame(frame);

// Uchwyt do testów automatycznych (konsola / Node)
window.GOW = {
  get P() { return P; }, get FOES() { return FOES; }, get BOLTS() { return BOLTS; }, get gate() { return gate; },
  get lvl() { return lvl; }, game, K, PR, LEVELS, update, draw, loadLevel, newGame, restart, start, cell, STEP,
};
