'use strict';
// GOW – jednoekranowa platformówka pixel-art w hołdzie klasycznemu Prince of Persia (1989).
// Grafika, dźwięki i projekt poziomu są autorskie; wzorowana jest tylko mechanika
// (ostrożny krok, skok z rozbiegu, podciąganie na krawędzi, kruszące się płyty,
// kolce, krata z płytą naciskową, walka na miecze z zasłoną, mikstury, trójkąty życia).

// ===== Stałe =====
const SW = 320, SH = 200;           // wewnętrzna rozdzielczość (skalowana CSS-em)
const TW = 32, RH = 60;             // szerokość kafla, wysokość rzędu [px]
const COLS = 10, ROWS = 3;
const GRAV = 620;                   // grawitacja [px/s²]
const HW = 6;                       // połowa szerokości postaci
const HANG_DY = 33;                 // stopy wiszącej postaci poniżej krawędzi
const STEP = 1 / 60;

// Legenda: _ podłoga, spacja – brak podłogi, # mur, L luźna płyta, S kolce,
// W miecz, H mikstura, P płyta naciskowa, G krata, D drzwi wyjściowe.
const LEVEL0 = [
  '___L   __W',
  '##__S____ ',
  '#D__G_H__P',
];

const floorY = r => (r + 1) * RH - 5;
const colOf = x => Math.floor(x / TW);
const lerp = (a, b, k) => a + (b - a) * k;
const HANGST = ['hang', 'climb', 'climbdown', 'reach'];

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

// ===== Dźwięk (WebAudio, proste piski) =====
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
  clang: () => { tone(1500, 0.12, 'square', 0.04, 900); tone(2300, 0.09, 'square', 0.03, 1700); },
  swish: () => tone(700, 0.09, 'sawtooth', 0.025, 220),
  hit: () => tone(240, 0.16, 'square', 0.07, 70),
  crash: () => { tone(160, 0.35, 'sawtooth', 0.07, 40); tone(90, 0.3, 'triangle', 0.1, 30); },
  rattle: () => { for (let i = 0; i < 3; i++) tone(200 + i * 40, 0.04, 'square', 0.03, 0, i * 0.05); },
  click: () => tone(320, 0.06, 'square', 0.05, 160),
  tick: () => tone(150, 0.03, 'square', 0.025),
  die: () => melody([392, 330, 262, 196, 0, 131], 0.2, 'square', 0.05),
  wake: () => melody([196, 233, 196], 0.12, 'sawtooth', 0.04),
  sword: () => melody([392, 523, 659, 0, 523, 659, 784, 1047], 0.13, 'square', 0.05),
  drink: () => melody([523, 587, 659, 784, 880], 0.08, 'triangle', 0.07),
  win: () => melody([523, 659, 784, 1047, 0, 784, 1047, 1319], 0.16, 'square', 0.05),
};

// ===== Wejście =====
const K = {}, PR = {};
const KEYMAP = {
  ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right',
  ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down',
  Shift: 'act', ' ': 'act', Control: 'act',
};
function press(k) { if (!K[k]) PR[k] = true; K[k] = true; }
function release(k) { K[k] = false; }

window.addEventListener('keydown', e => {
  if (game.mode === 'title') { start(); e.preventDefault(); return; }
  if (e.key === 'r' || e.key === 'R' || (e.key === 'Enter' && game.mode !== 'play')) { reset(); return; }
  const k = KEYMAP[e.key];
  if (k) { e.preventDefault(); press(k); }
});
window.addEventListener('keyup', e => { const k = KEYMAP[e.key]; if (k) release(k); });
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
    if (k === 'act' && (game.mode === 'win' || (P.st === 'dead' && P.t > 1.5))) { reset(); return; }
    press(k); b.classList.add('on');
  };
  const off = e => { e.preventDefault(); release(k); b.classList.remove('on'); };
  b.addEventListener('pointerdown', on);
  b.addEventListener('pointerup', off);
  b.addEventListener('pointercancel', off);
  b.addEventListener('pointerleave', off);
});

// ===== Stan gry =====
let MAP, P, GD, loose, gate, gateT, gateTick, spikes, parts, msg, flash;
const game = { mode: 'title', time: 0, anim: 0 };

function say(text, sec) { msg = { text, t: sec || 3 }; }

function reset() {
  MAP = LEVEL0.map(s => s.split(''));
  P = {
    x: 48, y: -70, r: 0, dir: 1, st: 'fall', t: 0, vx: 0, vy: 0, air: true,
    fallY: -70, soft: true, hp: 3, max: 3, sword: false, hang: null, hit: false, fd: 0,
  };
  GD = {
    x: 284, y: floorY(1), r: 1, dir: -1, st: 'sleep', t: 0, hp: 3, max: 3,
    alive: true, cd: 1, vx: 0, vy: 0, air: false, hit: false,
  };
  loose = { r: 0, c: 3, st: 'ok', t: 0, y: 0, vy: 0, rr: -1 };
  gate = 0; gateT = 0; gateTick = 0;
  spikes = {};
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (MAP[r][c] === 'S') spikes[r + ',' + c] = 0;
  parts = []; flash = null;
  game.time = 0;
  if (game.mode !== 'title') game.mode = 'play';
  say('Spadasz z nocnego nieba...', 2.5);
}

function start() {
  audioOn();
  titleEl.classList.add('hide');
  game.mode = 'play';
  reset();
}

// ===== Mapa =====
function cell(r, c) {
  if (c < 0 || c >= COLS || r >= ROWS) return '#';
  if (r < 0) return ' ';
  return MAP[r][c];
}
function hasFloor(r, c) {
  const ch = cell(r, c);
  if (ch === ' ' || ch === '#') return false;
  if (ch === 'L' && loose.st !== 'ok' && loose.st !== 'shake') return false;
  return true;
}
const isWall = (r, c) => cell(r, c) === '#';
const gateBlocks = (r, c) => cell(r, c) === 'G' && gate < 0.8;

// Ruch poziomy z kolizją ze ścianami i kratą (krata blokuje tylko wejście na linię środka kafla).
function moveX(o, dx, r) {
  if (!dx) return true;
  const s = Math.sign(dx);
  let nx = o.x + dx;
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

// Fizyka lotu; zwraca numer rzędu, na którym wylądowano, albo -1.
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

// ===== Cząsteczki =====
function burst(x, y, n, col, sp, up) {
  for (let i = 0; i < n; i++) {
    parts.push({
      x, y, vx: (Math.random() - 0.5) * sp, vy: -Math.random() * (up || sp * 0.6),
      life: 0.4 + Math.random() * 0.5, col,
    });
  }
}

// ===== Gracz =====
function engaged() {
  return GD.alive && ['guard', 'wind', 'gstrike', 'gblock', 'ghurt', 'stun'].includes(GD.st) &&
    !P.air && HANGST.indexOf(P.st) < 0 && P.st !== 'dead' && P.r === GD.r && Math.abs(GD.x - P.x) < 100;
}

function die(kind) {
  if (P.st === 'dead') return;
  P.st = 'dead'; P.t = 0; P.hp = 0; P.air = false; P.vx = 0; P.vy = 0; P.kind = kind;
  SND.die();
  flash = { col: '#c00000', t: 0.25 };
  const txt = { kolce: 'Kolce przebiły cię na wylot.', upadek: 'Upadek z tej wysokości był zabójczy.',
    miecz: 'Strażnik cię pokonał.', gruz: 'Przygniótł cię gruz.' };
  say(txt[kind] || 'Zginąłeś.', 99);
}

function hurtPlayer(n, pushDir) {
  if (P.st === 'dead') return;
  P.hp -= n;
  flash = { col: '#ff0000', t: 0.12 };
  SND.hit();
  burst(P.x, P.y - 18, 6, '#c01010', 50);
  if (P.hp <= 0) { die('miecz'); return; }
  if (!P.air && HANGST.indexOf(P.st) < 0) {
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
  SND.swish();
}

function landP(r) {
  const rows = Math.round((floorY(r) - P.fallY) / RH);
  const c = colOf(P.x);
  P.vx = 0; P.vy = 0; P.st = 'land'; P.t = 0;
  if (r >= ROWS) { die('upadek'); return; }
  if (cell(r, c) === 'S') { spikes[r + ',' + c] = 1; die('kolce'); return; }
  burst(P.x, P.y, 6, '#a89878', 40, 20);
  if (P.soft) {
    P.soft = false; P.ld = 0.9; SND.thud();
    say('Dach pałacu... Gdzieś tu musi leżeć miecz.', 4);
    return;
  }
  if (rows >= 3) { die('upadek'); return; }
  if (rows === 2) {
    P.hp--; P.ld = 0.8; SND.thud(); SND.hit(); flash = { col: '#ff0000', t: 0.12 };
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
  if (ch === 'H') { P.st = 'drink'; P.t = 0; P.got = false; return true; }
  return false;
}

const atDoor = () => cell(P.r, colOf(P.x)) === 'D';

// Czy przed graczem stoi żywy strażnik (nie da się go przejść)?
function guardAhead(dir) {
  return GD.alive && !GD.air && GD.r === P.r && Math.sign(GD.x - P.x) === dir && Math.abs(GD.x - P.x) < 16;
}

function toFight() { P.st = 'fight'; P.t = 0; SND.swish(); }

function updPlayer(dt) {
  const p = P;
  p.t += dt;
  // Podłoga zniknęła pod stojącym graczem (luźna płyta)
  if (!p.air && p.st !== 'dead' && p.st !== 'exit' && HANGST.indexOf(p.st) < 0 && !hasFloor(p.r, colOf(p.x))) {
    startFall(0);
  }
  const fwd = p.dir > 0 ? K.right : K.left, back = p.dir > 0 ? K.left : K.right;

  switch (p.st) {
    case 'stand': {
      if (p.sword && engaged()) { toFight(); break; }
      if (PR.up) {
        if (atDoor()) { p.st = 'exit'; p.t = 0; SND.win(); break; }
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
      if (fwd && !guardAhead(p.dir)) { p.st = K.act ? 'step' : 'run'; p.t = 0; }
      break;
    }
    case 'turn': if (p.t > 0.12) p.st = 'stand'; break;
    case 'run': {
      if (p.sword && engaged() && Math.abs(GD.x - p.x) < 70) { toFight(); break; }
      if (PR.up) { jump(130); break; }
      if (back) { p.dir = -p.dir; p.st = 'turn'; p.t = 0; break; }
      if (!fwd || K.act || guardAhead(p.dir)) { p.st = 'stand'; break; }
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
        if (guardAhead(p.dir)) { p.st = 'stand'; break; }
        moveX(p, nx - p.x, p.r);
        groundCheck(false);
      } else {
        p.st = 'stand';
        if (fwd && K.act) { p.st = 'step'; p.t = 0; }
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
      // Animacja zdobycia miecza: przyklęk, chwyt, uniesienie nad głowę z błyskami
      if (!p.got && p.t >= 0.45) {
        p.got = true; MAP[p.r][colOf(p.x)] = '_';
        SND.sword();
        burst(p.x, p.y - 40, 16, '#fff6a0', 90, 70);
      }
      if (p.t >= 0.45 && p.t < 1.9 && Math.floor(p.t * 10) % 3 === 0) {
        burst(p.x + (Math.random() - 0.5) * 6, p.y - 50, 1, '#ffffff', 60, 40);
      }
      if (p.t >= 2.3) {
        p.sword = true; p.st = 'stand'; p.t = 0;
        say('Masz miecz! Teraz możesz walczyć.', 3);
      }
      break;
    }
    case 'drink': {
      if (!p.got && p.t >= 0.4) {
        p.got = true; MAP[p.r][colOf(p.x)] = '_';
        p.hp = Math.min(p.max, p.hp + 1); SND.drink();
        flash = { col: '#ff4060', t: 0.2 };
        say('Mikstura przywraca siły.', 2);
      }
      if (p.t >= 1.3) { p.st = 'stand'; p.t = 0; }
      break;
    }
    case 'fight': {
      if (!engaged()) { p.st = 'stand'; break; }
      p.dir = Math.sign(GD.x - p.x) || p.dir;
      if (PR.act) {
        p.st = 'strike'; p.t = 0; p.hit = false; SND.swish();
        if (GD.st === 'guard' && Math.abs(GD.x - p.x) < 50 && Math.random() < 0.35) { GD.st = 'gblock'; GD.t = 0; }
        break;
      }
      if (PR.up) { p.st = 'block'; p.t = 0; break; }
      const f = p.dir > 0 ? K.right : K.left, b = p.dir > 0 ? K.left : K.right;
      if (f || b) { p.st = 'fstep'; p.t = 0; p.fd = f ? 1 : -1; }
      break;
    }
    case 'fstep': {
      const d = Math.abs(GD.x - p.x);
      if (!(p.fd > 0 && d < 18)) {
        moveX(p, p.fd * p.dir * 44 * dt, p.r);
        if (!groundCheck(false)) break;
      }
      if (p.t > 0.22) p.st = engaged() ? 'fight' : 'stand';
      break;
    }
    case 'strike':
      if (!p.hit && p.t >= 0.14) { p.hit = true; resolveStrike(); }
      if (p.t > 0.38) p.st = engaged() ? 'fight' : 'stand';
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
      p.x += (48 - p.x) * Math.min(1, dt * 4);
      if (p.t > 1.6) game.mode = 'win';
      break;
    }
    case 'dead':
      if (PR.act && p.t > 1.5) reset();
      break;
  }
}

function resolveStrike() {
  const d = Math.abs(GD.x - P.x);
  if (!GD.alive || GD.air || GD.r !== P.r || d > 40 || Math.sign(GD.x - P.x) !== P.dir) return;
  if (GD.st === 'gblock') {
    SND.clang(); burst(P.x + P.dir * 18, P.y - 22, 5, '#ffffc0', 60);
    return;
  }
  GD.hp--; SND.hit();
  burst(GD.x, GD.y - 18, 8, '#c01010', 60);
  if (GD.hp <= 0) {
    GD.alive = false; GD.st = 'gdead'; GD.t = 0;
    say('Strażnik pokonany!', 3);
    guardPush(P.dir * 6);
  } else {
    GD.st = 'ghurt'; GD.t = 0;
    guardPush(P.dir * 10);
  }
}

// ===== Strażnik =====
function guardPush(dx) {
  moveX(GD, dx, GD.r);
  const c = colOf(GD.x);
  if (!hasFloor(GD.r, c)) {
    GD.st = 'gfall'; GD.air = true; GD.vy = 0; GD.vx = Math.sign(dx) * 30; GD.alive = false;
    say('Strażnik runął w przepaść!', 3);
  } else if (cell(GD.r, c) === 'S') {
    spikes[GD.r + ',' + c] = 1; GD.alive = false; GD.st = 'gdead'; SND.hit();
  }
}

function guardMove(dx) {
  const s = Math.sign(dx), c = colOf(GD.x + dx + s * 8);
  if (isWall(GD.r, c) || !hasFloor(GD.r, c) || cell(GD.r, c) === 'S' || gateBlocks(GD.r, c)) return;
  moveX(GD, dx, GD.r);
}

function updGuard(dt) {
  const g = GD;
  g.t += dt;
  const dx = P.x - g.x, d = Math.abs(dx);
  const same = !P.air && P.r === g.r && P.st !== 'dead' && HANGST.indexOf(P.st) < 0;
  switch (g.st) {
    case 'sleep':
      if (P.sword || (same && d < 70)) { g.st = 'wake'; g.t = 0; SND.wake(); say('Strażnik się budzi!', 2); }
      break;
    case 'wake': if (g.t > 0.8) { g.st = 'guard'; g.t = 0; g.cd = 0.8; } break;
    case 'guard': {
      if (!same || d > 110) break;
      g.dir = Math.sign(dx) || g.dir;
      if (d > 30) guardMove(g.dir * 26 * dt);
      else if (d < 18) guardMove(-g.dir * 20 * dt);
      g.cd -= dt;
      if (g.cd <= 0 && d < 44) { g.st = 'wind'; g.t = 0; }
      break;
    }
    case 'wind': if (g.t > 0.45) { g.st = 'gstrike'; g.t = 0; g.hit = false; SND.swish(); } break;
    case 'gstrike':
      if (!g.hit && g.t > 0.06) {
        g.hit = true;
        if (same && d < 44 && Math.sign(dx) === g.dir) {
          if (P.st === 'block') {
            SND.clang(); burst(g.x + g.dir * 18, g.y - 24, 6, '#ffffc0', 70);
            g.st = 'stun'; g.t = 0; break;
          }
          hurtPlayer(1, g.dir);
        }
      }
      if (g.t > 0.3) { g.st = 'guard'; g.t = 0; g.cd = 0.6 + Math.random() * 0.7; }
      break;
    case 'gblock': if (g.t > 0.35) { g.st = 'guard'; g.cd = Math.min(g.cd, 0.25); } break;
    case 'ghurt': if (g.t > 0.35) { g.st = 'guard'; g.cd = 0.5; } break;
    case 'stun': if (g.t > 0.6) { g.st = 'guard'; g.cd = 0.4; } break;
    case 'gfall': {
      const r = air(g, dt);
      if (r >= 0) { g.st = 'gdead'; g.t = 0; SND.thud(); }
      break;
    }
  }
}

// ===== Pułapki i mechanizmy =====
function updLoose(dt) {
  const L = loose;
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
      L.st = 'gone'; L.rr = tr; SND.crash();
      burst(L.c * TW + 16, ty, 14, '#8a8a9a', 80, 50);
      if (tr < ROWS && !P.air && P.r === tr && colOf(P.x) === L.c && P.st !== 'land' && P.st !== 'dead') {
        hurtPlayer(1, 0);
        if (P.st === 'dead') P.kind = 'gruz';
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
      (GD.r === r && Math.abs(GD.x - cx) < 30);
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
  if (game.mode !== 'play') return;
  if (P.st !== 'dead' && P.st !== 'exit') game.time += dt;
  if (msg.t > 0 && msg.t < 90) msg.t -= dt;
  updPlayer(dt);
  updGuard(dt);
  updLoose(dt);
  updGate(dt);
  updSpikes(dt);
  updParts(dt);
  if (flash) { flash.t -= dt; if (flash.t <= 0) flash = null; }
}

// ===== Rysowanie: tło (prerenderowane) =====
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const PAL_ROOF = ['#e0c488', '#a07c50', '#4a3420'];
const PAL_DUN = ['#b0b0c0', '#6a7290', '#262a3c'];

function slab(c2, x, y, w, pal) {
  c2.fillStyle = pal[0]; c2.fillRect(x, y, w, 2);
  c2.fillStyle = pal[1]; c2.fillRect(x, y + 2, w, 4);
  c2.fillStyle = pal[2]; c2.fillRect(x, y + 6, w, 1);
  c2.fillRect(x + w - 1, y + 2, 1, 4);         // szczelina między płytami
}

function buildBG() {
  const b = document.createElement('canvas');
  b.width = SW; b.height = SH;
  const c = b.getContext('2d');
  // Niebo nad dachem
  const gr = c.createLinearGradient(0, 0, 0, 62);
  gr.addColorStop(0, '#06061e'); gr.addColorStop(1, '#3a2456');
  c.fillStyle = gr; c.fillRect(0, 0, SW, 62);
  for (let i = 0; i < 70; i++) {
    c.fillStyle = rnd() < 0.3 ? '#ffffff' : '#8890b0';
    c.fillRect(Math.floor(rnd() * SW), Math.floor(rnd() * 44), 1, 1);
  }
  // Księżyc
  for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) {
    if (dx * dx + dy * dy <= 64) { c.fillStyle = (dx * dx + dy * dy > 49) ? '#c8c098' : '#f0e8c8'; c.fillRect(250 + dx, 16 + dy, 1, 1); }
  }
  c.fillStyle = '#d0c8a0'; c.fillRect(247, 13, 2, 2); c.fillRect(253, 19, 3, 2); c.fillRect(251, 11, 1, 1);
  // Sylwetka miasta i pałacu
  c.fillStyle = '#170f2e';
  c.fillRect(0, 46, SW, 16);
  const dome = (cx, base, r) => {
    for (let dy = 0; dy <= r; dy++) {
      const w = Math.round(Math.sqrt(r * r - dy * dy));
      c.fillRect(cx - w, base - dy, w * 2 + 1, 1);
    }
    c.fillRect(cx, base - r - 5, 1, 5);
  };
  const minaret = (x, top) => { c.fillRect(x, top, 4, 62 - top); dome(x + 2, top, 3); c.fillRect(x - 1, top + 6, 6, 1); };
  c.fillRect(120, 36, 64, 12); dome(152, 36, 15); dome(60, 46, 10); dome(225, 46, 9);
  minaret(18, 22); minaret(108, 16); minaret(192, 20); minaret(292, 26);
  c.fillStyle = '#f0c050';
  [[140, 42], [146, 42], [158, 42], [164, 42], [58, 50], [228, 50], [20, 34], [110, 28]].forEach(([x, y]) => c.fillRect(x, y, 1, 2));
  // Mur lochu
  c.fillStyle = '#141826'; c.fillRect(0, 62, SW, 118);
  const BR = ['#2c3550', '#283049', '#313a57', '#2a3350'];
  for (let y = 62, row = 0; y < 180; y += 8, row++) {
    const off = (row % 2) * 8;
    for (let x = -off; x < SW; x += 16) {
      c.fillStyle = BR[Math.floor(rnd() * BR.length)];
      c.fillRect(x + 1, y + 1, 15, 7);
      if (rnd() < 0.15) { c.fillStyle = '#3a4466'; c.fillRect(x + 2, y + 1, 6, 1); }
    }
  }
  // Mury, drzwi, podłogi
  for (let r = 0; r < ROWS; r++) for (let col = 0; col < COLS; col++) {
    const ch = LEVEL0[r][col], x = col * TW, fy = floorY(r);
    if (ch === '#') {
      const y0 = r * RH + 2, y1 = Math.min(180, fy + 7);
      c.fillStyle = '#1a1f30'; c.fillRect(x, y0, TW, y1 - y0);
      for (let y = y0, rr = 0; y < y1; y += 10, rr++) {
        const off = (rr % 2) * 8;
        for (let bx = x - off; bx < x + TW; bx += 16) {
          const lx = Math.max(x, bx + 1), rx = Math.min(x + TW, bx + 16);
          c.fillStyle = '#56607e'; c.fillRect(lx, y + 1, rx - lx, Math.min(9, y1 - y - 1));
          c.fillStyle = '#6c7898'; c.fillRect(lx, y + 1, rx - lx, 1);
        }
      }
      continue;
    }
    if (ch === 'D') {
      // Łukowe drzwi ze schodami prowadzącymi w górę – wyjście z poziomu
      const ox = x + 6, ow = 20, top = fy - 36;
      c.fillStyle = '#7a84a2';
      c.fillRect(ox - 3, top - 4, ow + 6, 40);
      c.fillStyle = '#05060c';
      c.fillRect(ox, top + 6, ow, 30);
      for (let dy = 0; dy < 10; dy++) {
        const w = Math.round(Math.sqrt(100 - (10 - dy) * (10 - dy)));
        c.fillRect(ox + 10 - w, top - 4 + dy + 1, w * 2, 1);
      }
      c.fillStyle = '#2a3048';
      for (let i = 0; i < 6; i++) c.fillRect(ox + 2 + i * 3, fy - 5 * (6 - i) + 2, ow - 2 - i * 3, 2);
      c.fillStyle = '#9aa4c0'; c.fillRect(ox - 3, top - 4, ow + 6, 1);
    }
    if (ch !== ' ' && ch !== 'L') slab(c, x, fy, TW, r === 0 ? PAL_ROOF : PAL_DUN);
  }
  return b;
}
const BG = buildBG();

// ===== Rysowanie: postacie (szkielet z „kości” o grubości 2 px) =====
// Pozy: [głowa, szyja, biodro, kolano1, stopa1, kolano2, stopa2, łokieć1, dłoń1, łokieć2, dłoń2, (czubek miecza)]
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
  fight: [1, -28, 0, -24, -1, -13, 4, -7, 5, 0, -3, -7, -5, 0, 4, -20, 7, -19, -3, -20, -5, -23, 17, -24],
  fstep: [1, -28, 0, -24, -1, -13, 5, -7, 7, 0, -3, -7, -4, 0, 4, -20, 7, -19, -3, -20, -5, -23, 17, -24],
  windup: [0, -28, -1, -24, -1, -13, 4, -7, 5, 0, -3, -7, -5, 0, 2, -22, 2, -27, -3, -20, -5, -23, -6, -36],
  strike: [4, -27, 3, -23, 1, -13, 7, -7, 9, 0, -3, -6, -6, 0, 8, -20, 12, -19, -2, -20, -5, -22, 25, -19],
  block: [0, -28, 0, -24, -1, -13, 3, -7, 4, 0, -3, -7, -5, 0, 3, -22, 5, -26, -3, -20, -5, -21, 9, -37],
  hurt: [-3, -28, -2, -24, 0, -13, 2, -7, 3, 0, -2, -7, -4, 0, 0, -19, 3, -16, -4, -20, -6, -17, 12, -12],
  dead: [12, -3, 8, -3, 0, -3, -5, -3, -11, -1, -5, -2, -11, 0, 8, -1, 13, 0, 6, -2, 4, 0],
  sleep: [4, -18, 2, -15, -2, -7, 5, -7, 8, 0, 4, -6, 7, 0, 4, -11, 6, -7, 0, -11, 4, -7],
};

const COL_P = { skin: '#eab080', skinB: '#b88058', body: '#f2f0e6', sleeve: '#e4e2d8', sleeveB: '#a8a69e',
  leg: '#dcdad0', legB: '#96949c', hair: '#2a1a10', sash: '#c42020', turban: false };
const COL_G = { skin: '#cc9468', skinB: '#9a6a48', body: '#2a8a7a', sleeve: '#2f9686', sleeveB: '#1a5a50',
  leg: '#3a3052', legB: '#252038', hair: '#8a3aa8', sash: '#e0b030', turban: true };

function seg(a, b, w, col) {
  ctx.fillStyle = col;
  const dx = b[0] - a[0], dy = b[1] - a[1], n = Math.max(Math.abs(dx), Math.abs(dy), 1);
  const o = Math.floor(w / 2);
  for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(a[0] + dx * i / n) - o, Math.round(a[1] + dy * i / n) - o, w, w);
}

function drawFig(x, y, dir, a, col, swd) {
  x = Math.round(x); y = Math.round(y) - 1;
  const J = i => [x + dir * a[i], y + a[i + 1]];
  const head = J(0), neck = J(2), hip = J(4), k1 = J(6), f1 = J(8), k2 = J(10), f2 = J(12);
  const e1 = J(14), h1 = J(16), e2 = J(18), h2 = J(20);
  // Pochwa z mieczem przy pasie (z tyłu postaci)
  if (swd === 'hip') seg([hip[0] - dir, hip[1] - 1], [hip[0] - dir * 9, hip[1] + 6], 1, '#8a6a30');
  // Tylna ręka i noga
  seg(neck, e2, 2, col.sleeveB); seg(e2, h2, 2, col.sleeveB);
  ctx.fillStyle = col.skinB; ctx.fillRect(h2[0] - 1, h2[1] - 1, 2, 2);
  seg(hip, k2, 2, col.legB); seg(k2, f2, 2, col.legB);
  ctx.fillRect(f2[0] - 1 + (dir > 0 ? 1 : -1), f2[1], 2, 1);
  // Tułów i pas
  seg(neck, hip, 4, col.body);
  ctx.fillStyle = col.sash; ctx.fillRect(hip[0] - 2, hip[1] - 3, 4, 2);
  // Przednia noga
  seg(hip, k1, 2, col.leg); seg(k1, f1, 2, col.leg);
  ctx.fillStyle = col.legB; ctx.fillRect(f1[0] - 1 + (dir > 0 ? 1 : -1), f1[1], 2, 1);
  // Głowa
  ctx.fillStyle = col.skin; ctx.fillRect(head[0] - 2, head[1] - 3, 5, 6);
  ctx.fillStyle = col.hair;
  if (col.turban) { ctx.fillRect(head[0] - 3, head[1] - 5, 7, 4); ctx.fillStyle = '#f0e0a0'; ctx.fillRect(head[0], head[1] - 4, 1, 1); }
  else { ctx.fillRect(head[0] - 2, head[1] - 4, 5, 2); ctx.fillRect(head[0] - dir * 2 - (dir < 0 ? 0 : 0), head[1] - 3, 1, 4); }
  ctx.fillStyle = '#1a1010'; ctx.fillRect(head[0] + dir, head[1] - 1, 1, 1);
  // Przednia ręka
  seg(neck, e1, 2, col.sleeve); seg(e1, h1, 2, col.sleeve);
  ctx.fillStyle = col.skin; ctx.fillRect(h1[0] - 1, h1[1] - 1, 2, 2);
  // Miecz w dłoni
  if (swd === 'hand' && a.length > 22) {
    const tip = [x + dir * a[22], y + a[23]];
    seg(h1, tip, 1, '#e2e8f4');
    ctx.fillStyle = '#e0b030'; ctx.fillRect(h1[0] - 1, h1[1] - 1, 3, 3);
  }
}

function lerpPose(a, b, k) { return a.map((v, i) => lerp(v, b[i] !== undefined ? b[i] : v, k)); }

function drawPlayer() {
  const p = P;
  let a = POSE.stand, x = p.x, y = p.y, swd = p.sword ? 'hip' : '';
  switch (p.st) {
    case 'run': a = POSE['run' + (Math.floor(p.t * 9) % 4)]; break;
    case 'step': a = (p.t % 0.45) < 0.22 ? POSE.step : POSE.stand; break;
    case 'jump': a = POSE.jump; break;
    case 'fall': a = p.soft ? POSE.fall : (p.vy < 120 ? POSE.jump : POSE.fall); break;
    case 'land': case 'crouch': a = POSE.crouch; break;
    case 'upjump': a = POSE.reach; y -= Math.sin(Math.PI * Math.min(1, p.t / 0.45)) * 9; break;
    case 'reach': a = POSE.reach; break;
    case 'hang': a = POSE.hang; break;
    case 'climb': case 'climbdown': {
      let k = p.st === 'climb' ? Math.min(1, p.t / 0.6) : 1 - Math.min(1, p.t / 0.5);
      const hx = p.hang.ex - p.dir * HW, hy = floorY(p.hang.r) + HANG_DY;
      const tx = p.hang.ex + p.dir * 8, ty = floorY(p.hang.r);
      a = lerpPose(POSE.hang, POSE.crouch, k);
      x = lerp(hx, tx, k); y = lerp(hy, ty, Math.min(1, k * 1.3));
      break;
    }
    case 'sword':
      if (p.t < 0.45) a = POSE.pick;
      else if (p.t < 0.7) { a = lerpPose(POSE.pick, POSE.raise, (p.t - 0.45) / 0.25); swd = 'hand'; }
      else if (p.t < 1.9) { a = POSE.raise; swd = 'hand'; }
      else { a = lerpPose(POSE.raise, POSE.stand, (p.t - 1.9) / 0.4); swd = 'hip'; }
      break;
    case 'drink': a = p.t < 0.4 ? POSE.pick : POSE.drink; break;
    case 'fight': a = POSE.fight; swd = 'hand'; break;
    case 'fstep': a = POSE.fstep; swd = 'hand'; break;
    case 'strike': a = p.t < 0.12 ? POSE.windup : POSE.strike; swd = 'hand'; break;
    case 'block': a = POSE.block; swd = 'hand'; break;
    case 'hurt': a = POSE.hurt; swd = p.sword ? 'hand' : ''; break;
    case 'dead': a = POSE.dead; break;
    case 'exit': ctx.globalAlpha = Math.max(0, 1 - p.t / 1.4); break;
  }
  drawFig(x, y, p.dir, a, COL_P, swd);
  ctx.globalAlpha = 1;
  // Smuga przy upadku z nieba
  if (p.soft && p.air) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 4; i++) ctx.fillRect(Math.round(x - 6 + i * 4), Math.round(y - 40 - (i % 2) * 6), 1, 8);
  }
  // Blask uniesionego miecza
  if (p.st === 'sword' && p.t >= 0.6 && p.t < 1.9) {
    const tx = Math.round(x + p.dir * 1), ty = Math.round(y - 55);
    const ph = Math.floor(p.t * 12) % 2;
    ctx.fillStyle = ph ? '#ffffff' : '#fff2a0';
    const L = ph ? 7 : 5;
    ctx.fillRect(tx - L, ty, L * 2 + 1, 1); ctx.fillRect(tx, ty - L, 1, L * 2 + 1);
    ctx.fillRect(tx - 2, ty - 2, 1, 1); ctx.fillRect(tx + 2, ty - 2, 1, 1);
    ctx.fillRect(tx - 2, ty + 2, 1, 1); ctx.fillRect(tx + 2, ty + 2, 1, 1);
  }
}

function drawGuard() {
  const g = GD;
  let a = POSE.fight, swd = 'hand', y = g.y;
  switch (g.st) {
    case 'sleep': a = POSE.sleep; swd = 'hip'; break;
    case 'wake': a = lerpPose(POSE.sleep, POSE.fight, Math.min(1, g.t / 0.6)); swd = g.t > 0.4 ? 'hand' : 'hip'; break;
    case 'wind': a = POSE.windup; break;
    case 'gstrike': a = POSE.strike; break;
    case 'gblock': a = POSE.block; break;
    case 'ghurt': case 'stun': a = POSE.hurt; break;
    case 'gfall': a = POSE.fall; swd = ''; break;
    case 'gdead': a = POSE.dead; swd = ''; break;
  }
  drawFig(g.x, y, g.dir, a, COL_G, swd);
  if (g.st === 'sleep') {
    const k = (game.anim * 0.8) % 1;
    txt('z', g.x - 2 + k * 4, g.y - 24 - k * 10, `rgba(220,220,255,${1 - k})`, 'center', 7 + k * 2, true);
  }
}

// ===== Rysowanie: elementy dynamiczne =====
function drawTorch(x, y) {
  const t = game.anim, f = Math.sin(t * 17 + x) + Math.sin(t * 23 + y);
  const gr = ctx.createRadialGradient(x, y - 3, 1, x, y - 3, 26);
  gr.addColorStop(0, 'rgba(255,160,60,0.22)'); gr.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = gr; ctx.fillRect(x - 26, y - 29, 52, 52);
  ctx.fillStyle = '#4a2e18'; ctx.fillRect(x - 1, y, 3, 7);
  ctx.fillStyle = '#6a4424'; ctx.fillRect(x - 2, y, 5, 1);
  const h = 4 + (f > 0 ? 1 : 0) + (f > 1 ? 1 : 0);
  ctx.fillStyle = '#e04010'; ctx.fillRect(x - 1, y - h, 3, h);
  ctx.fillStyle = '#ffa020'; ctx.fillRect(x - (f > 0.5 ? 1 : 0), y - h + 1, 2, h - 1);
  ctx.fillStyle = '#fff080'; ctx.fillRect(x, y - 2, 1, 2);
}

function drawDynamic() {
  // Luźna płyta
  const L = loose, lx = L.c * TW;
  if (L.st === 'ok' || L.st === 'shake') {
    const j = L.st === 'shake' ? (Math.random() < 0.5 ? -1 : 1) : 0;
    slab(ctx, lx, floorY(L.r) + j, TW, L.r === 0 ? PAL_ROOF : PAL_DUN);
    ctx.fillStyle = L.r === 0 ? PAL_ROOF[2] : PAL_DUN[2];
    ctx.fillRect(lx + 9, floorY(L.r) + j + 2, 1, 3); ctx.fillRect(lx + 21, floorY(L.r) + j + 3, 1, 3);
  } else if (L.st === 'fall') {
    slab(ctx, lx, Math.round(L.y), TW, PAL_ROOF);
  } else if (L.st === 'gone' && L.rr < ROWS) {
    const fy = floorY(L.rr);
    ctx.fillStyle = '#8a7a60';
    [[4, 2, 3], [9, 1, 4], [15, 2, 3], [20, 1, 5], [26, 2, 3]].forEach(([dx, h, w]) => ctx.fillRect(lx + dx, fy - h, w, h));
    ctx.fillStyle = '#5a4a38'; ctx.fillRect(lx + 6, fy - 1, 20, 1);
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
  // Płyta naciskowa, krata, przedmioty
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const ch = MAP[r][c], x = c * TW, fy = floorY(r);
    if (ch === 'P') {
      const d = plateDown() ? 1 : 0;
      ctx.fillStyle = '#8890a8'; ctx.fillRect(x + 5, fy - 2 + d, 22, 2 - d);
      ctx.fillStyle = '#c0c4d4'; ctx.fillRect(x + 5, fy - 2 + d, 22, 1);
    } else if (ch === 'G') {
      const top = floorY(r - 1) + 7, full = fy - top, len = Math.round(full * (1 - gate)) + 2;
      const gx = x + TW / 2 - 4;
      ctx.fillStyle = '#3a3e4c'; ctx.fillRect(gx - 2, top, 12, 3);
      ctx.fillStyle = '#7a8090';
      for (let i = 0; i < 4; i++) ctx.fillRect(gx + i * 2 + 1, top, 1, len);
      for (let yy = top + len - 1; yy > top; yy -= 6) ctx.fillRect(gx, yy, 8, 1);
      ctx.fillStyle = '#a8aebc'; ctx.fillRect(gx, top + len - 1, 8, 1);
    } else if (ch === 'W') {
      const y = fy - 2, sx = x + 8;
      ctx.fillStyle = '#e2e8f4'; ctx.fillRect(sx + 4, y, 14, 1);
      ctx.fillStyle = '#9aa2b8'; ctx.fillRect(sx + 4, y + 1, 14, 1);
      ctx.fillStyle = '#e0b030'; ctx.fillRect(sx + 2, y - 1, 2, 3); ctx.fillRect(sx, y, 2, 1);
      if (Math.floor(game.anim * 3) % 3 === 0) {
        const px = sx + 4 + Math.floor(game.anim * 7) % 14;
        ctx.fillStyle = '#ffffff'; ctx.fillRect(px, y - 2, 1, 1); ctx.fillRect(px - 1, y - 1, 3, 1);
      }
    } else if (ch === 'H') {
      const px = x + 14, y = fy;
      ctx.fillStyle = '#d0d8e8'; ctx.fillRect(px + 1, y - 9, 2, 3);
      ctx.fillStyle = '#c01830'; ctx.fillRect(px, y - 6, 4, 5);
      ctx.fillStyle = '#ff6078'; ctx.fillRect(px, y - 6, 1, 2);
      ctx.fillStyle = '#8a5030'; ctx.fillRect(px + 1, y - 10, 2, 1);
      const b = (game.anim * 1.5) % 1;
      ctx.fillStyle = `rgba(255,140,160,${1 - b})`; ctx.fillRect(px + 2, Math.round(y - 11 - b * 8), 1, 1);
    }
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
  const p = P, c = colOf(p.x);
  if (p.st === 'dead') return 'R lub ⚔ – zagraj od nowa';
  if (p.st === 'hang') return '↑ podciągnij się · ↓ puść krawędź';
  if (p.st === 'sword') return '';
  if (['fight', 'fstep', 'strike', 'block', 'hurt'].includes(p.st)) return 'Shift cios · ↑ zasłona · ←→ krok';
  if (!p.sword && engaged()) return 'Bez miecza nie masz szans – uciekaj!';
  if (p.r === 0) {
    if (cell(0, c) === 'W') return 'Shift – podnieś miecz';
    if (!p.sword) return c >= 7 ? 'Miecz leży na skraju dachu' : '←→ bieg · Shift+←→ ostrożny krok · ↑ skok';
    return '↓ przy krawędzi – zwiśnij · lub zeskocz';
  }
  if (p.r === 1) {
    if (!p.sword && c <= 3) return 'Rozbieg i ↑ – skok nad kolcami';
    if (!p.sword && c >= 5) return '↑ pod krawędzią – podciągnij się';
    if (GD.alive) return 'Strażnik czeka...';
    return '↓ przy krawędzi – zwiśnij i zeskocz';
  }
  if (p.r === 2) {
    if (atDoor()) return '↑ – wyjdź przez drzwi';
    if (cell(2, c) === 'H') return 'Shift – wypij miksturę';
    if (gate < 0.8 && c > 4) return 'Płyta naciskowa otwiera kratę';
    if (gate >= 0.8) return 'Krata się zamyka – biegnij!';
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
  if (GD.st !== 'sleep' && (GD.alive || GD.st === 'gdead' || GD.st === 'gfall')) {
    for (let i = 0; i < GD.max; i++) tri(SW - 11 - i * 9, 187, i < GD.hp && GD.alive, '#3070f0', '#102060');
  }
  const s = msg.t > 0 ? msg.text : hint();
  txt(s, SW / 2, 190, msg.t > 0 ? '#f0d890' : '#a0a0b0');
  const m = Math.floor(game.time / 60), sec = Math.floor(game.time % 60);
  txt(m + ':' + String(sec).padStart(2, '0'), SW - 4, 6, '#c8c0d8', 'right');
}

function draw() {
  TQ = [];
  ctx.drawImage(BG, 0, 0);
  [[112, 86], [240, 82], [104, 146], [272, 144]].forEach(([x, y]) => drawTorch(x, y));
  drawDynamic();
  if (game.mode !== 'title') {
    if (!(GD.st === 'gfall' && GD.y > SH)) drawGuard();
    drawPlayer();
  }
  for (const q of parts) { ctx.fillStyle = q.col; ctx.fillRect(Math.round(q.x), Math.round(q.y), 1, 1); }
  // Błysk przy zdobyciu miecza (jak w klasyku – ekran mruga na biało)
  if (P && P.st === 'sword' && P.t >= 0.45 && P.t < 1.1 && Math.floor(P.t * 14) % 2 === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(0, 0, SW, 180);
  }
  if (flash) { ctx.globalAlpha = Math.min(0.5, flash.t * 3); ctx.fillStyle = flash.col; ctx.fillRect(0, 0, SW, 180); ctx.globalAlpha = 1; }
  if (game.mode !== 'title') drawHUD();
  if (game.mode === 'play' && P.st === 'dead' && P.t > 1.2) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 70, SW, 34);
    txt('KONIEC', SW / 2, 80, '#e04030', 'center', 11);
    txt('R / ⚔ – spróbuj jeszcze raz', SW / 2, 94, '#e0d0b0');
  }
  if (game.mode === 'win') {
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, SW, 180);
    const m = Math.floor(game.time / 60), sec = Math.floor(game.time % 60);
    txt('WOLNOŚĆ!', SW / 2, 58, '#f0c040', 'center', 16);
    txt('Uciekłeś z lochów pałacu.', SW / 2, 80, '#e8d8b0');
    txt('Czas: ' + m + ':' + String(sec).padStart(2, '0') + '   Życie: ' + P.hp + '/' + P.max, SW / 2, 96, '#e8d8b0');
    txt('R / ⚔ – zagraj ponownie', SW / 2, 124, '#a0a0b0');
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

reset();
game.mode = 'title';
requestAnimationFrame(frame);

// Dostęp dla testów z konsoli / autopilota
window.GOW = { get P() { return P; }, get G() { return GD; }, get gate() { return gate; }, get loose() { return loose; },
  game, K, PR, update, reset, start, cell, STEP };
