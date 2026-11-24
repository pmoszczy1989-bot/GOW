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
// P płyta naciskowa (otwiera kraty), G krata, D drzwi wyjściowe.
// Przeciwnicy: blaster – pojedyncze strzały (1 trafienie), rifle – karabin, seria 2 strzałów
// (2 trafienia), lord – boss na końcu rozdziału z czerwonym ostrzem.
const LEVELS = [
  { name: 'Dach Cytadeli', theme: 0, sky: true,
    map: ['___L   __W',
          '##_______ ',
          '#D__G_H__P'],
    start: { r: 0, c: 1, dir: 1 },
    foes: [{ k: 'blaster', r: 1, c: 8, dir: -1, sleep: true }] },
  { name: 'Blok więzienny', theme: 1,
    map: ['#_____ __#',
          ' __S______',
          '__P__ __GD'],
    start: { r: 0, c: 1, dir: 1 },
    foes: [{ k: 'blaster', r: 0, c: 8, dir: -1 }, { k: 'rifle', r: 1, c: 1, dir: 1 }] },
  { name: 'Kuźnia reaktora', theme: 2,
    map: ['_H_ ___PGD',
          '__ _S___ M',
          '#_____ __#'],
    start: { r: 2, c: 1, dir: 1 },
    foes: [{ k: 'rifle', r: 2, c: 8, dir: -1 }, { k: 'blaster', r: 0, c: 6, dir: -1 }] },
  { name: 'Zalane tunele', theme: 3,
    map: ['#__L__L_ _',
          ' __G___P__',
          '_H_S_____D'],
    start: { r: 0, c: 1, dir: 1 },
    foes: [{ k: 'blaster', r: 1, c: 1, dir: 1 }, { k: 'rifle', r: 2, c: 5, dir: -1 }, { k: 'blaster', r: 2, c: 7, dir: -1 }] },
  { name: 'Sala Mrocznego Lorda', theme: 4, lock: true,
    map: ['#__S___ ##',
          '#__ ____H#',
          '#________D'],
    start: { r: 0, c: 1, dir: 1 },
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
const FIGHTST = ['fight', 'fstep', 'strike', 'block'];

// ===== Płótno i skalowanie =====
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
cv.width = SW; cv.height = SH;

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
  tick: () => tone(150, 0.03, 'square', 0.025),
  alarm: () => melody([880, 660, 880, 660], 0.11, 'square', 0.03),
  die: () => melody([392, 330, 262, 196, 0, 131], 0.2, 'square', 0.05),
  lord: () => melody([110, 104, 98, 0, 73], 0.25, 'sawtooth', 0.05),
  sword: () => melody([392, 523, 659, 0, 523, 659, 784, 1047], 0.13, 'square', 0.05),
  drink: () => melody([523, 587, 659, 784, 880], 0.08, 'triangle', 0.07),
  win: () => melody([523, 659, 784, 1047, 0, 784, 1047, 1319], 0.16, 'square', 0.05),
};

// ===== Wejście =====
// Strzałki – ruch, A – cios / podnieś, Shift – ostrożny krok, R – powtórz poziom.
const K = {}, PR = {};
const KEYMAP = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Shift: 'walk' };
const keyOf = e => (e.code === 'KeyA' || e.key === 'a' || e.key === 'A') ? 'act' : KEYMAP[e.key];
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
let lvl = 0, LV, MAP, P, FOES, LOOSE, BOLTS, gate, gateT, gateTick, spikes, parts, msg, flash, lamps;
const game = { mode: 'title', time: 0, anim: 0, blade: BLADES[0], maxHp: 3, lvlMax: 3, shake: 0, stop: 0, trans: 0, hud: null };

function say(text, sec) { msg = { text, t: sec || 3 }; }

function mkFoe(f) {
  const hp = f.k === 'lord' ? 6 : f.k === 'rifle' ? 2 : 1;
  return {
    k: f.k, x: f.c * TW + 16, y: floorY(f.r), r: f.r, dir: f.dir,
    st: f.sleep ? 'sleep' : f.k === 'lord' ? 'meditate' : 'idle', t: 0, hp, max: hp, alive: true,
    cd: 1.1 + Math.random() * 0.7, vx: 0, vy: 0, air: false, hit: false, shots: 0, ft: 0,
    white: 0, mf: 0, bb: 0, trail: [],
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
    sword: i > 0, hang: null, hit: false, fd: 0, inv: 0, combo: 0, q: false, ign: 0, trail: [],
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
  BOLTS = []; parts = []; flash = null;
  gate = 0; gateT = 0; gateTick = 0;
  game.shake = 0; game.stop = 0; game.hud = null;
  game.mode = 'play';
  if (!BGS[i]) BGS[i] = buildBG(LV);
  say(sky ? 'Spadasz z nocnego nieba...' : 'Poziom ' + (i + 1) + ': ' + LV.name, 2.5);
}

function newGame() { game.maxHp = 3; game.time = 0; loadLevel(0); }
function restart() {
  if (game.mode === 'title') { start(); return; }
  if (game.mode === 'win') { newGame(); return; }
  if (game.mode === 'trans') return;
  game.maxHp = game.lvlMax; loadLevel(lvl);
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
const doorOpen = () => !LV.lock || !FOES.some(f => f.k === 'lord' && f.alive);

// Czy między dwoma punktami w rzędzie nie ma muru ani zamkniętej kraty (linia strzału)?
function los(r, a, b) {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  for (let c = colOf(lo); c <= colOf(hi); c++) {
    if (isWall(r, c)) return false;
    if (gateBlocks(r, c)) { const gx = c * TW + TW / 2; if (gx > lo && gx < hi) return false; }
  }
  return true;
}

// Ruch poziomy z kolizją ze ścianami i kratą (krata blokuje tylko wejście na linię środka kafla).
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
    if (!gateBlocks(r, c)) continue;
    const gx = c * TW + TW / 2;
    if (s > 0 && o.x + HW <= gx && nx + HW > gx) { o.x = gx - HW; return false; }
    if (s < 0 && o.x - HW >= gx && nx - HW < gx) { o.x = gx + HW; return false; }
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
    lord: 'Mroczny Lord cię pokonał.', gruz: 'Przygniótł cię gruz.' };
  say(t[kind] || 'Zginąłeś.', 99);
}

function hurtPlayer(n, pushDir, kind) {
  if (P.st === 'dead' || P.inv > 0) return;
  P.hp -= n; P.inv = 0.8;                     // krótka nietykalność – seria nie zabija od razu
  flash = { col: '#ff0000', t: 0.12 };
  SND.hit(); shake(2);
  burst(P.x, P.y - 18, 6, '#c01010', 50);
  if (P.hp <= 0) { die(kind); return; }
  if (!P.air && HANGST.indexOf(P.st) < 0 && P.st !== 'sword' && P.st !== 'drink') {
    P.st = 'hurt'; P.t = 0;
    if (pushDir) { moveX(P, pushDir * 8, P.r); groundCheck(false); }
  }
}

function startFall(vx) {
  P.st = 'fall'; P.t = 0; P.air = true; P.vy = 0; P.vx = vx; P.fallY = floorY(P.r);
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

const atDoor = () => cell(P.r, colOf(P.x)) === 'D';

// Czy przed graczem stoi żywy przeciwnik (nie da się go przejść)?
function foeAhead(dir) {
  return FOES.some(f => f.alive && !f.air && f.r === P.r && Math.sign(f.x - P.x) === dir && Math.abs(f.x - P.x) < 16);
}

function toFight() {
  if (P.ign < 0.2) SND.ignite();
  P.st = 'fight'; P.t = 0;
}

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

function updPlayer(dt) {
  const p = P;
  p.t += dt;
  p.inv = Math.max(0, p.inv - dt);
  // Podłoga zniknęła pod stojącym graczem (luźna płyta)
  if (!p.air && p.st !== 'dead' && p.st !== 'exit' && HANGST.indexOf(p.st) < 0 && !hasFloor(p.r, colOf(p.x))) {
    startFall(0);
  }
  const fwd = p.dir > 0 ? K.right : K.left, back = p.dir > 0 ? K.left : K.right;
  const lit = p.sword && (FIGHTST.includes(p.st) || (p.st === 'hurt' && engaged()));
  p.ign = Math.max(0, Math.min(1, p.ign + (lit ? 7 : -4) * dt));

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
      if (PR.act && tryPick()) break;
      if (back) { p.dir = -p.dir; p.st = 'turn'; p.t = 0; break; }
      if (fwd && !foeAhead(p.dir)) { p.st = (K.walk || K.act) ? 'step' : 'run'; p.t = 0; }
      break;
    }
    case 'turn': if (p.t > 0.12) p.st = 'stand'; break;
    case 'run': {
      const t = p.sword && engaged();
      if (t && Math.abs(t.x - p.x) < 60) { toFight(); break; }
      if (PR.up) { jump(130); break; }
      if (back) { p.dir = -p.dir; p.st = 'turn'; p.t = 0; break; }
      if (!fwd || K.walk || K.act || foeAhead(p.dir)) { p.st = 'stand'; break; }
      if (PR.down) { p.st = 'crouch'; p.t = 0; break; }
      moveX(p, p.dir * 64 * dt, p.r);
      groundCheck(true);
      break;
    }
    case 'step': {
      if (p.t < 0.45) {
        const nx = p.x + p.dir * 22 * dt;
        const aNow = colOf(p.x + p.dir * 4), aNext = colOf(nx + p.dir * 4);
        if (aNext !== aNow && (!hasFloor(p.r, aNext) || cell(p.r, aNext) === 'S')) { p.st = 'stand'; break; }
        if (foeAhead(p.dir)) { p.st = 'stand'; break; }
        moveX(p, nx - p.x, p.r);
        groundCheck(false);
      } else {
        p.st = 'stand';
        if (fwd && (K.walk || K.act)) { p.st = 'step'; p.t = 0; }
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
        say('Kryształ rozbłysnął ' + game.blade.name + ' światłem! A – cios.', 3.5);
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
      if (!t) { p.st = 'stand'; break; }
      p.dir = Math.sign(t.x - p.x) || p.dir;
      if (PR.act) { startStrike(false); break; }
      if (PR.up) { p.st = 'block'; p.t = 0; break; }
      const f = p.dir > 0 ? K.right : K.left, b = p.dir > 0 ? K.left : K.right;
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
      if (p.t > 0.22) p.st = engaged() ? 'fight' : 'stand';
      break;
    }
    case 'strike':
      if (PR.act && p.t > 0.1) p.q = true;
      if (!p.hit && p.t >= 0.12) { p.hit = true; resolveStrike(); }
      if (p.q && p.t >= 0.24) { startStrike(true); break; }
      if (p.t > 0.34) p.st = engaged() ? 'fight' : 'stand';
      break;
    case 'block': if (p.t > 0.4) p.st = engaged() ? 'fight' : 'stand'; break;
    case 'hurt': if (p.t > 0.3) p.st = (p.sword && engaged()) ? 'fight' : 'stand'; break;
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
  if (!t) return;
  if (t.st === 'gblock') {
    SND.clash(); shake(2); game.stop = 0.05;
    const x = (P.x + t.x) / 2;
    sparks(x, P.y - 26, game.blade.col, 8); sparks(x, P.y - 26, RED.col, 8);
    t.cd = Math.min(t.cd, 0.15);
    return;
  }
  hitFoe(t, 1, P.dir);
}

function hitFoe(f, n, dir) {
  f.hp -= n; f.white = 0.12; game.hud = f; game.hudT = 3;
  SND.hit(); shake(2); game.stop = 0.06;
  burst(f.x, f.y - 20, 8, f.k === 'lord' ? '#601020' : '#30343c', 70);
  sparks(f.x - dir * 4, f.y - 22, game.blade.col, 8);
  if (f.hp <= 0) {
    f.alive = false; f.st = 'fdead'; f.t = 0;
    if (f.k === 'lord') {
      say('Mroczny Lord pokonany! Pole siłowe gaśnie.', 4);
      SND.lord(); shake(4); flash = { col: '#ffffff', t: 0.3 };
      sparks(f.x, f.y - 30, RED.col, 30);
    } else say(f.k === 'rifle' ? 'Szturmowiec z karabinem pokonany.' : 'Strażnik z blasterem pokonany.', 2);
    foePush(f, dir * 6);
  } else {
    f.st = f.k === 'lord' ? 'ghurt' : 'thurt'; f.t = 0;
    if (f.k === 'lord') f.bb = Math.min(0.4, f.bb + 0.2);
    foePush(f, dir * 10);
  }
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
  if (isWall(f.r, c) || !hasFloor(f.r, c) || cell(f.r, c) === 'S' || gateBlocks(f.r, c)) return;
  if (s === Math.sign(P.x - f.x) && playerOnRow(f.r) && Math.abs(P.x - f.x) < 16) return;
  moveX(f, dx, f.r);
}

function shoot(f) {
  const v = f.k === 'rifle' ? 210 : 180;
  BOLTS.push({ x: f.x + f.dir * 14, y: f.y - 21, r: f.r, vx: f.dir * v, o: 'e', src: f });
  f.mf = 0.06; SND.blast();
}

function updFoe(f, dt) {
  f.t += dt;
  f.white = Math.max(0, f.white - dt); f.mf = Math.max(0, f.mf - dt); f.bb = Math.max(0, f.bb - dt * 0.05);
  if (f.st === 'ffall') {
    const r = air(f, dt);
    if (r >= 0) { f.st = 'fdead'; f.t = 0; SND.thud(); }
    return;
  }
  if (!f.alive) return;
  if (f.k === 'lord') updLord(f, dt); else updTrooper(f, dt);
}

function updTrooper(f, dt) {
  const dx = P.x - f.x, d = Math.abs(dx);
  const same = playerOnRow(f.r);
  const see = same && d < 200 && los(f.r, f.x, P.x);
  switch (f.st) {
    case 'sleep':
      if (P.sword || (same && d < 60)) {
        f.st = 'idle'; f.t = 0; f.cd = 1; SND.alarm(); say('Strażnik podnosi alarm!', 2);
      }
      break;
    case 'idle':
      if (!see) break;
      f.dir = Math.sign(dx) || f.dir;
      if (d < 22) { f.st = 'bash'; f.t = 0; f.hit = false; break; }
      if (d < 44 && P.sword) foeMove(f, -f.dir * 20 * dt);   // cofa się przed ostrzem
      f.cd -= dt;
      if (f.cd <= 0) { f.st = 'aim'; f.t = 0; }
      break;
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
    case 'thurt': if (f.t > 0.35) { f.st = 'idle'; f.cd = Math.max(f.cd, 0.4); } break;
    case 'tstun': if (f.t > 0.7) { f.st = 'idle'; f.cd = 0.3; } break;
  }
}

function updLord(f, dt) {
  const dx = P.x - f.x, d = Math.abs(dx);
  const same = playerOnRow(f.r);
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
      if (d > 34) foeMove(f, f.dir * 34 * dt);
      else if (d < 20) foeMove(f, -f.dir * 24 * dt);
      f.cd -= dt;
      if (f.cd <= 0) {
        if (d < 46) { f.st = 'wind'; f.t = 0; }
        else if (d < 110 && Math.random() < 0.5) { f.st = 'lunge'; f.t = 0; SND.swing(); }
        else f.cd = 0.3;
      }
      break;
    }
    case 'lunge':
      foeMove(f, f.dir * 150 * dt);
      if (f.t > 0.24 || d < 26) { f.st = 'gstrike'; f.t = 0; f.hit = false; SND.swing(); }
      break;
    case 'wind': if (f.t > 0.32) { f.st = 'gstrike'; f.t = 0; f.hit = false; SND.swing(); } break;
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
    if (isWall(b.r, c) || (gateBlocks(b.r, c) && lo <= c * TW + 16 && hi >= c * TW + 16)) {
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
  if (armed && (P.st === 'block' || (P.st === 'strike' && P.t > 0.05 && P.t < 0.22))) {
    // Zasłona w odpowiednim momencie odbija strzał prosto w strzelca
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
  for (const q of parts) { q.vy += 300 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; }
  parts = parts.filter(q => q.life > 0);
}

function update(dt) {
  game.anim += dt;
  game.shake = Math.max(0, game.shake - dt * 10);
  if (game.mode === 'trans') {
    game.trans += dt;
    if (game.trans > 2.4) loadLevel(lvl + 1);
    return;
  }
  if (game.mode !== 'play') return;
  if (game.stop > 0) { game.stop -= dt; return; }       // „zatrzymanie klatki” przy trafieniu
  if (P.st !== 'dead' && P.st !== 'exit') game.time += dt;
  if (msg.t > 0 && msg.t < 90) msg.t -= dt;
  if (game.hudT > 0) game.hudT -= dt;
  updPlayer(dt);
  for (const f of FOES) updFoe(f, dt);
  updLoose(dt);
  updGate(dt);
  updSpikes(dt);
  updBolts(dt);
  updParts(dt);
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
    c.fillRect(Math.floor(rnd() * SW), Math.floor(rnd() * 46), 1, 1);
  }
  // Mgławica
  const ng = c.createRadialGradient(90, 18, 2, 90, 18, 50);
  ng.addColorStop(0, 'rgba(120,60,160,0.35)'); ng.addColorStop(1, 'rgba(60,20,90,0)');
  c.fillStyle = ng; c.fillRect(30, 0, 120, 50);
  // Planeta z pierścieniem
  for (let dy = -11; dy <= 11; dy++) for (let dx = -11; dx <= 11; dx++) {
    const q = dx * dx + dy * dy;
    if (q <= 121) {
      const band = Math.floor((dy + 11) / 4) % 2;
      c.fillStyle = q > 90 ? '#a87050' : (dx - dy > 8 ? '#6a4038' : band ? '#e0a070' : '#c88a60');
      c.fillRect(250 + dx, 18 + dy, 1, 1);
    }
  }
  c.fillStyle = '#e8d0a8';
  for (let dx = -20; dx <= 20; dx++) {
    const y = Math.round(18 + dx * 0.18 + Math.sqrt(Math.max(0, 1 - (dx / 20) ** 2)) * 3);
    if (Math.abs(dx) > 10 || y > 19) c.fillRect(250 + dx, y, 1, 1);
  }
  c.fillStyle = '#d8d8e8'; c.fillRect(212, 10, 3, 3); c.fillStyle = '#9898b0'; c.fillRect(214, 12, 1, 1);
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
    .forEach(([x, y]) => c.fillRect(x, y, 1, 1));
}

function buildBG(L) {
  const T = THEMES[L.theme];
  seed = 7 + L.theme * 101;
  const b = document.createElement('canvas');
  b.width = SW; b.height = SH;
  const c = b.getContext('2d');
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
const VIG = (() => {
  const b = document.createElement('canvas');
  b.width = SW; b.height = 180;
  const c = b.getContext('2d');
  const g = c.createRadialGradient(SW / 2, 90, 60, SW / 2, 90, 200);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.6)');
  c.fillStyle = g; c.fillRect(0, 0, SW, 180);
  return b;
})();

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

function seg(a, b, w, col) {
  ctx.fillStyle = col;
  const dx = b[0] - a[0], dy = b[1] - a[1], n = Math.max(Math.abs(dx), Math.abs(dy), 1);
  const o = Math.floor(w / 2);
  for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(a[0] + dx * i / n) - o, Math.round(a[1] + dy * i / n) - o, w, w);
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
    ctx.fillStyle = C(S.skin); ctx.fillRect(x - 2, y - 3, 5, 6);
    ctx.fillStyle = C(S.hair); ctx.fillRect(x - 2, y - 4, 5, 2); ctx.fillRect(x - dir * 2, y - 3, 1, 5);
    ctx.fillRect(x - dir * 3, y - 2, 1, 3);
    ctx.fillStyle = C('#1a1010'); ctx.fillRect(x + dir, y - 1, 1, 1);
    ctx.fillStyle = C(S.cloak); ctx.fillRect(n[0] - 3, n[1] - 1, 6, 2);        // kaptur zsunięty na ramiona
  } else if (S.type === 'trooper') {
    ctx.fillStyle = C(S.helm); ctx.fillRect(x - 3, y - 4, 6, 7);
    ctx.fillStyle = C(S.helmB); ctx.fillRect(x - 3, y + 2, 6, 1); ctx.fillRect(dir > 0 ? x - 3 : x + 2, y - 3, 1, 5);
    if (S.stripe) { ctx.fillStyle = C(S.stripe); ctx.fillRect(x - 3, y - 4, 6, 1); }
    ctx.fillStyle = C(S.visor); ctx.fillRect(dir > 0 ? x : x - 2, y - 1, 3, 1);
    EQ.push({ x: x + dir, y: y - 1, col: S.visor, r: 4, a: 0.25 });
  } else {
    ctx.fillStyle = C(S.hood); ctx.fillRect(x - 3, y - 5, 7, 9); ctx.fillRect(n[0] - 4, n[1] - 1, 8, 2);
    ctx.fillStyle = C(S.skin); ctx.fillRect(dir > 0 ? x : x - 2, y - 1, 3, 4);
    ctx.fillStyle = C('#3a2a30'); ctx.fillRect(dir > 0 ? x : x - 2, y - 1, 3, 1);
    EQ.push({ x: x + dir, y: y, col: S.eye, r: 5, a: 0.5 });
  }
}

// o: { blade: 'hand'|'hip'|'', ign, bc: kolor ostrza, trail, own, gun, mf, white, sway }
function drawFig(x, y, dir, a, S, o) {
  x = Math.round(x); y = Math.round(y) - 1;
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
    ctx.fillStyle = C('#2a2e38'); ctx.fillRect(hip[0] - dir * 6 - 1, hip[1] + 3, 2, 2);
  }
  // Tylna ręka i noga
  seg(neck, e2, 2, C(S.armB)); seg(e2, h2, 2, C(S.armB));
  ctx.fillStyle = C(S.handB); ctx.fillRect(h2[0] - 1, h2[1] - 1, 2, 2);
  seg(hip, k2, 2, C(S.legB)); seg(k2, f2, 2, C(S.legB));
  ctx.fillStyle = C(S.boot); ctx.fillRect(f2[0] - 1, f2[1] - 1, 2, 2); ctx.fillRect(f2[0] - 1 + dir, f2[1], 2, 1);
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
  ctx.fillStyle = C(S.belt); ctx.fillRect(hip[0] - 2, hip[1] - 3, 5, 2);
  // Przednia noga
  seg(hip, k1, 2, C(S.leg)); seg(k1, f1, 2, C(S.leg));
  ctx.fillStyle = C(S.boot); ctx.fillRect(f1[0] - 1, f1[1] - 1, 2, 2); ctx.fillRect(f1[0] - 1 + dir, f1[1], 2, 1);
  drawHead(head, neck, dir, S, C);
  // Przednia ręka
  seg(neck, e1, 2, C(S.arm)); seg(e1, h1, 2, C(S.arm));
  // Broń palna w dłoni
  if (o.gun) {
    const vx = h1[0] - e1[0], vy = h1[1] - e1[1], n = Math.hypot(vx, vy) || 1, ux = vx / n, uy = vy / n;
    const rifle = o.gun === 'rifle', L = rifle ? 12 : 7, bk = rifle ? 5 : 1;
    const tip = [h1[0] + ux * L, h1[1] + uy * L];
    seg([h1[0] - ux * bk, h1[1] - uy * bk], tip, 2, C('#1e2026'));
    seg([h1[0] + ux * 2, h1[1] + uy * 2 - 1], [tip[0], tip[1] - 1], 1, C('#4a4e58'));
    if (rifle) { ctx.fillStyle = C(S.stripe); ctx.fillRect(Math.round(h1[0] + ux * 6), Math.round(h1[1] + uy * 6) - 1, 2, 1); }
    if (o.mf > 0) EQ.push({ x: tip[0] + ux * 2, y: tip[1] + uy * 2 - 1, col: '#ffe0c0', r: 9, a: 0.8, star: true });
  }
  ctx.fillStyle = C(S.hand); ctx.fillRect(h1[0] - 1, h1[1] - 1, 2, 2);
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
  const S = STY[f.k];
  let a = POSE.stand, blade = '', ign = 1, tr = false, gun = f.k === 'lord' ? '' : f.k, y = f.y;
  if (f.k === 'lord') {
    blade = 'hand';
    switch (f.st) {
      case 'meditate': a = POSE.kneel; blade = 'hip'; break;
      case 'rise': a = lerpPose(POSE.kneel, POSE.fight, Math.min(1, f.t / 0.8)); ign = Math.min(1, f.t / 0.5); break;
      case 'guard': a = POSE.fight; break;
      case 'wind': a = lerpPose(POSE.fight, POSE.windup, Math.min(1, f.t / 0.2)); break;
      case 'lunge': a = POSE.lunge; tr = true; break;
      case 'gstrike': a = f.t < 0.08 ? lerpPose(POSE.windup, POSE.strike, ease(f.t / 0.08)) : POSE.strike; tr = f.t < 0.14; break;
      case 'gblock': a = POSE.block; break;
      case 'ghurt': case 'stun': a = POSE.hurt; break;
      case 'ffall': a = POSE.fall; blade = ''; break;
      case 'fdead': a = POSE.dead; blade = ''; break;
    }
  } else {
    switch (f.st) {
      case 'sleep': a = POSE.sleep; break;
      case 'idle': a = Math.abs(P.x - f.x) < 200 && playerOnRow(f.r) ? POSE.aim : POSE.stand; break;
      case 'aim': case 'fire': a = POSE.aim; y += (f.mf > 0 ? 0 : 0); break;
      case 'bash': a = f.t < 0.3 ? POSE.bashw : POSE.bash; break;
      case 'thurt': case 'tstun': a = POSE.hurt; break;
      case 'ffall': a = POSE.fall; gun = ''; break;
      case 'fdead': a = POSE.dead; gun = ''; break;
    }
  }
  drawFig(f.x, y, f.dir, a, S, { blade, ign, bc: RED, trail: tr, own: f, gun, mf: f.mf, white: f.white });
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
    if (P.st === 'dead' && P.kind === 'kolce' && P.r === r) {
      ctx.fillStyle = '#a01010'; ctx.fillRect(c * TW + 6, fy - 4, 20, 2);
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
  ctx.drawImage(VIG, 0, 0);
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
    seg(b.h, b.t, 3, `rgba(${b.bc.rgb},0.8)`);
    seg(b.h, b.t, 1, '#ffffff');
  }
  // Strzały
  for (const b of BOLTS) {
    const s = Math.sign(b.vx), x = Math.round(b.x), y = Math.round(b.y);
    ctx.fillStyle = 'rgba(255,60,40,0.8)'; ctx.fillRect(Math.min(x, x - s * 8), y - 1, 9, 3);
    ctx.fillStyle = '#ffe0d0'; ctx.fillRect(Math.min(x, x - s * 7), y, 8, 1);
  }
  // Iskry i świecące punkty
  for (const q of parts) if (q.e) { ctx.fillStyle = q.col; ctx.fillRect(Math.round(q.x), Math.round(q.y), 1, 1); }
  for (const e of EQ) {
    ctx.fillStyle = e.col; ctx.fillRect(Math.round(e.x), Math.round(e.y), 1, 1);
    if (e.star) { ctx.fillRect(Math.round(e.x) - 2, Math.round(e.y), 5, 1); ctx.fillRect(Math.round(e.x), Math.round(e.y) - 2, 1, 5); }
  }
}

function tri(x, y, full, col, dark) {
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = full ? col : dark;
    if (full || i === 3) ctx.fillRect(x + 3 - i, y + i, 1 + i * 2, 1);
    else { ctx.fillRect(x + 3 - i, y + i, 1, 1); ctx.fillRect(x + 3 + i, y + i, 1, 1); }
  }
}

function hint() {
  const p = P, ch = cell(p.r, colOf(p.x));
  if (p.st === 'dead') return 'R lub A – spróbuj ponownie';
  if (p.st === 'hang') return '↑ podciągnij się · ↓ puść krawędź';
  if (p.st === 'sword' || p.st === 'exit') return '';
  if (FIGHTST.includes(p.st) || p.st === 'hurt') return 'A cios (2× kombo) · ↑ zasłona – odbija strzały · ←→ krok';
  if (ch === 'W') return 'A – podnieś rękojeść';
  if (ch === 'H' || ch === 'M') return 'A – wypij miksturę';
  if (atDoor()) return doorOpen() ? '↑ – wyjdź przez wrota' : 'Pokonaj Lorda, by zgasić pole siłowe';
  if (!p.sword) return '←→ bieg · Shift+←→ ostrożny krok · ↑ skok · ↓ zwis';
  if (gate >= 0.8 && gateT <= 0) return 'Krata się zamyka – biegnij!';
  if (FOES.some(f => f.alive && f.k !== 'lord' && f.r === p.r && (f.st === 'aim' || f.st === 'fire'))) {
    return 'Strzelec! Podejdź bliżej – ostrze odbija strzały';
  }
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
    const col = f.k === 'lord' ? '#ff3040' : f.k === 'rifle' ? '#f0a020' : '#80a0f0';
    for (let i = 0; i < f.max; i++) tri(SW - 11 - i * 9, 187, i < f.hp && f.alive, col, '#302030');
  }
  const s = msg.t > 0 ? msg.text : hint();
  txt(s, SW / 2, 190, msg.t > 0 ? '#f0d890' : '#a0a0b0', 'center', s.length > 44 ? 6.5 : 8);
  const m = Math.floor(game.time / 60), sec = Math.floor(game.time % 60);
  txt(m + ':' + String(sec).padStart(2, '0'), SW - 4, 6, '#c8c0d8', 'right');
  txt((lvl + 1) + '/' + LEVELS.length + '  ' + LV.name, 4, 6, '#a8a0c0', 'left', 7);
}

function draw() {
  TQ = []; BQ = []; EQ = [];
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
  if (game.shake > 0.3) ctx.translate(Math.round((Math.random() - 0.5) * game.shake * 2), Math.round((Math.random() - 0.5) * game.shake * 2));
  ctx.drawImage(BGS[lvl], 0, 0);
  drawDynamic();
  if (game.mode !== 'title') {
    for (const f of FOES) if (!f.alive && !(f.st === 'ffall' && f.y > SH)) drawFoe(f);
    for (const f of FOES) if (f.alive) drawFoe(f);
    drawPlayer();
  }
  for (const q of parts) if (!q.e) { ctx.fillStyle = q.col; ctx.fillRect(Math.round(q.x), Math.round(q.y), 1, 1); }
  lighting();
  drawEmissive();
  ctx.restore();
  // Błysk przy zapłonie ostrza (ekran mruga kolorem kryształu)
  if (P && P.st === 'sword' && P.t >= 0.45 && P.t < 1.1 && Math.floor(P.t * 14) % 2 === 0) {
    ctx.fillStyle = `rgba(${game.blade.rgb},0.4)`; ctx.fillRect(0, 0, SW, 180);
  }
  if (flash) { ctx.globalAlpha = Math.min(0.5, flash.t * 3); ctx.fillStyle = flash.col; ctx.fillRect(0, 0, SW, 180); ctx.globalAlpha = 1; }
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
    txt('Czas: ' + m + ':' + String(sec).padStart(2, '0') + '   Życie: ' + P.hp + '/' + P.max, SW / 2, 96, '#e8d8b0');
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
