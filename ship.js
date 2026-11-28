'use strict';
// ===== Lot myśliwcem „Szpon” – widok zza myśliwca (pseudo-3D) =====
// Wywoływane z game.js: startShip() w loadLevel(), updShip(dt) w update(), drawShip() w draw().
// Konfiguracja poziomu: LV.ship = { diff, from, to, speeder? } – scenariusz wybierany wg numeru lotu (SH_LV).
// Świat: x w bok, y w dół, z w głąb ekranu. Kamera tuż za myśliwcem (głębia SH_PZ), świat pędzi ku kamerze z prędkością S.V.
// Fazy: 'shop' (hangar – ulepszenia za kryształy) → 'fly' → 'boss' → 'jump' (skok) → 'won' (finishLevel()).
// Kadłub = P.hp (serca bohatera); tarcza pochłania trafienia i sama się odnawia.
// Ulepszenia: game.shipUp = { gun, shield, torp } (poziomy 0–3), koszt 10/20/30 kryształów.

let SHIP = null;

const SH_F = 220, SH_CX = 160, SH_CY = 78;      // ogniskowa i punkt zbiegu perspektywy
const SH_PZ = 34, SH_ZF = 820, SH_NEAR = 6;     // głębia myśliwca, horyzont, płaszczyzna bliska
const SH_AIM = 260;                             // głębia celownika
const SH_TW = 30, SH_RIM = -22, SH_TGY = 24;    // rów okrętu flagowego: pół-szerokość, krawędź, dno
const SH_GY = 12;                               // poziom gruntu w lesie
const SH_MAXP = 260;                            // limit cząsteczek
const SH_COST = [10, 20, 30];                   // koszt kolejnych poziomów ulepszeń

// ===== Ulepszenia myśliwca =====
const shUp = () => (game.shipUp = game.shipUp || { gun: 0, shield: 0, torp: 0 });
const shGunOf = l => ({ cd: [0.16, 0.135, 0.115, 0.095][l], dmg: [1, 1.25, 1.5, 2][l], quad: l >= 2, assist: 16 + l * 5 });
const shShieldOf = l => ({ max: [1, 2, 3, 5][l], regen: [6, 4.6, 3.6, 2.7][l] });
const shTorpOf = l => ({ n: [2, 3, 5, 7][l], turn: [2.4, 3.4, 4.6, 6.5][l], dmg: [6, 7, 8, 10][l], lock: [30, 36, 44, 52][l] });
const SH_UPS = [
  { id: 'gun', name: 'DZIAŁA', d: ['Szybszy ogień,', 'mocniejsze lasery'],
    st: l => 'siła ognia ×' + (shGunOf(l).dmg * 0.16 / shGunOf(l).cd).toFixed(1) + (l >= 2 ? ' · 4 lufy' : '') },
  { id: 'shield', name: 'TARCZA', d: ['Pochłania trafienia,', 'sama się odnawia'],
    st: l => 'pojemność ' + shShieldOf(l).max + ' · odnowa ' + shShieldOf(l).regen + ' s' },
  { id: 'torp', name: 'TORPEDY', d: ['Więcej torped,', 'celniejsze naprowadzanie'],
    st: l => 'zapas ' + shTorpOf(l).n + ' · obrażenia ' + shTorpOf(l).dmg },
];

// ===== Scenariusze lotów (indeks = numer lotu w grze) =====
const SH_LV = [
  { env: 'space', D: 60, gap: 3.4, V: 140,
    pats: ['eye', 'debris', 'eye', 'rocks', 'dart', 'eye', 'debris', 'bomber', 'eye', 'rocks', 'dart', 'eye'],
    intro: 'Ucieczka z orbity – zgub pościg i skacz w nadprzestrzeń!' },
  { env: 'space', D: 56, gap: 3.0, V: 145, boss: 'frigate',
    pats: ['eye', 'mines', 'dart', 'eye', 'bomber', 'mines', 'dart', 'eye', 'rocks', 'bomber', 'eye'],
    intro: 'Blokada orbitalna – przebij się przez kordon do krążownika!' },
  { env: 'nebula', D: 82, gap: 2.7, V: 150,
    pats: ['rocks', 'pillars', 'dart', 'arch', 'eye', 'rocks', 'pillars', 'bomber', 'arch', 'dart', 'rocks', 'pillars', 'eye', 'arch'],
    intro: 'Przełęcz Mgławicy – lawiruj między skałami!' },
  { env: 'forest', D: 74, gap: 2.4, V: 175, sp: true,
    pats: ['trees', 'bike', 'trees', 'logs', 'grove', 'bike', 'trees', 'logs', 'bike', 'grove', 'trees', 'bike'],
    intro: 'Pościg – zgub zwiadowców między drzewami!' },
  { env: 'space', D: 44, gap: 2.6, V: 150, boss: 'reactor',
    pats: ['eye', 'dart', 'bomber', 'eye', 'mines', 'dart', 'bomber', 'eye', 'rocks'],
    trench: { at: 44, D: 44, pats: ['wturs', 'beams', 'wturs', 'beams', 'eye', 'wturs', 'beams', 'dart', 'wturs', 'beams'] },
    intro: 'Szturm na flotę – dotrzyj do rowu okrętu flagowego!' },
];

// Rodzaje obiektów: hp 0 = niezniszczalne; ship = wrogi pojazd; solid = przeszkoda; box = prostopadłościan (hw, hh)
const SH_K = {
  eye: { hp: 2, r: 6, ship: true, name: 'Sowa' },
  dart: { hp: 3, r: 5, ship: true, name: 'Grot' },
  bomber: { hp: 7, r: 9, ship: true, name: 'Taran' },
  bike: { hp: 3, r: 4, ship: true, name: 'Zwiadowca' },
  wtur: { hp: 3, r: 4.5, name: 'wieżyczka' },
  rock: { hp: 4, r: 6, solid: true },
  deb: { hp: 3, r: 6, solid: true },
  mine: { hp: 1, r: 3.5, solid: true },
  girder: { hp: 0, box: true, solid: true },
  tree: { hp: 0, box: true, solid: true },
  pillar: { hp: 0, box: true, solid: true },
  arch: { hp: 0, box: true, solid: true },
  log: { hp: 0, box: true, solid: true },
  beam: { hp: 0, box: true, solid: true },
};

// Deterministyczny „szum” (wygląd planet, kształty skał)
const shHash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const shR = (a, b) => a + Math.random() * (b - a);
const shClamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Rzut perspektywiczny: [x ekranu, y ekranu, skala px/jednostkę]
function shP(x, y, z) {
  const S = SHIP, k = SH_F / Math.max(SH_NEAR, z);
  return [SH_CX + (x - S.cx) * k, SH_CY + (y - S.cy) * k, k];
}
// Kolor z mgłą odległości
function shCol(r, g, b, z, a) {
  const f = Math.min(0.88, Math.pow(Math.max(0, z) / SH_ZF, 1.25)), F = SHIP.fog;
  const c = [r + (F[0] - r) * f, g + (F[1] - g) * f, b + (F[2] - b) * f].map(v => v | 0);
  return a === undefined ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}
const shFade = z => shClamp((SH_ZF - z) / 160, 0, 1);

// Konfiguracja bieżącego lotu
function shCfg() {
  const n = LEVELS.slice(0, lvl).filter(l => l.ship).length, cfg = LV.ship || {};
  let c = SH_LV[Math.min(n, SH_LV.length - 1)];
  if (!!c.sp !== !!cfg.speeder) c = cfg.speeder ? SH_LV[3] : SH_LV[cfg.diff ? 1 : 0];
  return Object.assign({}, c, { n: SH_LV.indexOf(c) });
}

// Klawisz Enter w hangarze (game.js nie mapuje go w trakcie gry)
window.addEventListener('keydown', e => {
  if (e.key === 'Enter' && SHIP && SHIP.phase === 'shop' && game.mode === 'play' && LV && LV.ship) SHIP.go = true;
});

// ===== Start poziomu =====
function startShip() {
  const C = shCfg(), cfg = LV.ship || {}, prev = SHIP;
  SHIP = {
    C, env: C.env, sp: !!C.sp, n: C.n, from: cfg.from || 'cytadela', to: cfg.to || 'pustynia',
    dk: 0.85 + C.n * 0.1,               // mnożnik tempa ognia wrogów
    Dtot: C.trench ? C.trench.at + C.trench.D : C.D,
    fog: C.env === 'forest' ? [40, 62, 40] : C.env === 'nebula' ? [40, 18, 52] : [10, 8, 24],
    phase: 'shop', sel: prev && prev.lvl === lvl ? SH_UPS.length : 0, smsg: '', smsgT: 0, go: false, lvl,
    t: 0, T: 0, V: C.V, dist: 0,
    px: 0, py: C.sp ? SH_GY - 5 : 2, vx: 0, vy: 0, cx: 0, cy: 0, ang: 0, hopY: 0,
    inv: 0, roll: 0, rollCd: 0, rollDir: 1, fireCd: 0, side: 0,
    sh: 0, shMax: 0, shT: 0, shHit: 0, torp: 0,
    shots: [], torps: [], bolts: [], foes: [], parts: [], picks: [], queue: [],
    wi: 0, nextW: 2, boss: null, trZ: null, jumpT: 0, done: false,
    dead: false, deadT: 0, kills: 0, sndCd: 0, whooshCd: 0, lock: null, lightT: 4, light: 0,
    stars: [],
  };
  for (let i = 0; i < 130; i++) SHIP.stars.push(shStar(Math.random() * SH_ZF));
  shCam();
}
function shStar(z) { return { x: shR(-260, 260), y: shR(-190, 190), z: z || SH_ZF, l: Math.random() }; }
function shCam() {
  const S = SHIP;
  S.cx = S.px * 0.5;
  S.cy = (S.py + S.hopY) * 0.5 - 7;
}

// ===== Hangar (sklep z ulepszeniami) =====
function shShopMsg(s) { SHIP.smsg = s; SHIP.smsgT = 2.5; }
function shBuy(u) {
  const up = shUp(), l = up[u.id];
  if (l >= 3) { shShopMsg(u.name + ' – poziom maksymalny'); tone(180, 0.12, 'square', 0.03); return; }
  const c = SH_COST[l];
  if (game.crys < c) { shShopMsg('Za mało kryształów – potrzeba ' + c + ' ◆'); tone(180, 0.12, 'square', 0.03); return; }
  // Kryształy „zamrożone” w wydanych punktach umiejętności (skPts() nie może spaść poniżej zera)
  if (Math.floor((game.crys - c) / 10) < game.spent) {
    shShopMsg('Te kryształy są związane z wydanymi punktami umiejętności'); tone(180, 0.12, 'square', 0.03); return;
  }
  game.crys -= c;
  game.crysLvl = Math.max(0, game.crysLvl - c);   // zakup jest trwały – restart poziomu go nie cofa
  if (typeof saveRun === 'function') saveRun();
  up[u.id] = l + 1;
  SND.gem();
  shShopMsg(u.name + ' – poziom ' + (l + 1) + '!');
}
function shLaunch() {
  const S = SHIP, up = shUp(), sh = shShieldOf(up.shield);
  S.shMax = sh.max; S.sh = sh.max; S.shT = 0;
  S.torp = shTorpOf(up.torp).n;
  S.phase = 'fly'; S.T = 0; S.nextW = 2;
  for (const k in K) K[k] = false;
  noise(0.9, 0.1, 300, 2600, 'bandpass'); tone(110, 0.9, 'sawtooth', 0.04, 460);
  say(S.C.intro, 3);
}
function shShopUpd(dt) {
  const S = SHIP, n = SH_UPS.length + 1;
  if (S.smsgT > 0) S.smsgT -= dt;
  if (PR.left || PR.up) { S.sel = (S.sel + n - 1) % n; tone(520, 0.04, 'square', 0.025); }
  if (PR.right || PR.down) { S.sel = (S.sel + 1) % n; tone(520, 0.04, 'square', 0.025); }
  if (PR.act) { if (S.sel === SH_UPS.length) { shLaunch(); return; } shBuy(SH_UPS[S.sel]); }
  if (PR.sheathe || S.go) shLaunch();
}

// ===== Fale wrogów i przeszkód =====
function shPattern(p) {
  const S = SHIP, n = S.n, t = S.T, tr = S.trZ !== null;
  const q = (dl, k, o) => S.queue.push({ at: t + dl, k, o });
  const xr = tr ? SH_TW - 8 : 26;
  if (p === 'eye') {
    const c = 3 + (n >= 2 ? 1 : 0) + (n >= 4 ? 1 : 0), bx = shR(-xr + 10, xr - 10), by = tr ? shR(-8, 10) : shR(-12, 6), ph = shR(0, 6);
    for (let i = 0; i < c; i++) q(i * 0.5, 'eye', { bx: shClamp(bx + (i - (c - 1) / 2) * 9, -xr, xr), by: by + (i % 2) * 6 - 3, ph: ph + i * 0.7 });
  } else if (p === 'dart') {
    for (let i = 0; i < 2 + (n >= 3 ? 1 : 0); i++) q(i * 1.0, 'dart', { x: shR(-xr, xr), y: tr ? shR(-8, 12) : shR(-12, 8) });
  } else if (p === 'bomber') {
    q(0, 'bomber', { x: shR(-12, 12), y: shR(-6, 4) });
    if (n >= 1) for (let i = 0; i < 2; i++) q(0.8, 'eye', { bx: i ? 18 : -18, by: shR(-8, 4), ph: i * 3 });
  } else if (p === 'rocks') {
    for (let i = 0; i < 6 + n * 2; i++) q(i * shR(0.22, 0.42), 'rock', { x: shR(-36, 36), y: shR(-22, 18), r: shR(4, 9) });
  } else if (p === 'debris') {
    for (let i = 0; i < 5; i++) q(i * 0.35, 'deb', { x: shR(-32, 32), y: shR(-18, 14), r: shR(4, 7) });
    q(1.1, 'girder', { y: shR(-10, 8) });
  } else if (p === 'mines') {
    for (let i = 0; i < 6 + n; i++) q(i * 0.3, 'mine', { x: shR(-30, 30), y: shR(-16, 14) });
  } else if (p === 'pillars') {
    const g = shR(-20, 20);
    for (let i = 0; i < 3 + (n >= 3 ? 1 : 0); i++) {
      let x; do x = shR(-38, 38); while (Math.abs(x - g) < 13);
      q(i * 0.6, 'pillar', { x, r: shR(5, 8) });
    }
  } else if (p === 'arch') {
    q(0, 'arch', { top: Math.random() < 0.5, lim: shR(-5, 5) });
  } else if (p === 'trees' || p === 'grove') {
    const c = p === 'grove' ? 12 + n * 2 : 6 + n, g = shR(-24, 24), dl = p === 'grove' ? 0.17 : 0.38;
    for (let i = 0; i < c; i++) {
      let x; do x = shR(-46, 46); while (Math.abs(x - g) < 9);
      q(i * dl * shR(0.8, 1.2), 'tree', { x, r: shR(3, 5) });
    }
  } else if (p === 'logs') {
    q(0, 'log', {});
    if (n >= 3) q(1.3, 'log', {});
  } else if (p === 'bike') {
    for (let i = 0; i < 2 + (n >= 3 ? 1 : 0); i++) q(i * 0.9, 'bike', { x: shR(-20, 20) });
  } else if (p === 'wturs') {
    for (let i = 0; i < 2 + (n >= 4 ? 1 : 0); i++) q(i * 0.7, 'wtur', { side: Math.random() < 0.5 ? -1 : 1, y: shR(-14, 16) });
  } else if (p === 'beams') {
    const r = Math.random();
    if (r < 0.25) q(0, 'beam', { x: 0, y: -15, hw: SH_TW, hh: 15 });                // górna połowa – leć dołem
    else if (r < 0.5) q(0, 'beam', { x: 0, y: 14, hw: SH_TW, hh: 11 });             // dolna połowa – leć górą
    else { const s = r < 0.75 ? -1 : 1; q(0, 'beam', { x: s * 15, y: 1, hw: 15, hh: 24 }); }  // połowa boczna
  }
}

function shSpawn(k, o) {
  const S = SHIP, B = SH_K[k], hp = B.ship || k === 'wtur' ? Math.round(B.hp * HARD) : B.hp;   // HARD – mnożnik trudności z game.js
  const f = {
    k, x: 0, y: 0, z: SH_ZF, pz: SH_ZF, hp, max: hp, r: B.r || 5, t: 0, hitT: 0, cd: shR(1, 2.5), st: 'in',
    ship: !!B.ship, solid: !!B.solid, inf: !B.hp, box: !!B.box, hw: 0, hh: 0, rot: Math.random() * 6, vr: 0,
    seed: Math.random() * 100, shots: 0,
  };
  Object.assign(f, o || {});
  if (k === 'eye') { f.bx = f.bx || 0; f.by = f.by || 0; f.ph = f.ph || 0; f.x = f.bx; f.y = f.by; f.zt = f.zt || shR(200, 340); f.life = shR(7, 10); f.cd = shR(1.2, 2.6); f.vr = 0.6; }
  else if (k === 'dart') f.cd = 0.5;
  else if (k === 'bomber') { f.bx = f.x; f.by = f.y; f.zt = 320; f.cd = 2; f.life = 15; }
  else if (k === 'bike') { f.z = f.pz = -15; f.zt = shR(70, 150); f.y = SH_GY - 4; f.cd = 0.8; }
  else if (k === 'wtur') { f.x = f.side * (SH_TW - 2); f.cd = shR(0.5, 1.5); }
  else if (k === 'rock') { f.vr = shR(-1, 1); f.hp = f.max = Math.round(2 + f.r * 0.6); }
  else if (k === 'deb') { f.vr = shR(-2, 2); f.vr2 = shR(1, 3); }
  else if (k === 'girder') { f.hw = 46; f.hh = 2.4; }
  else if (k === 'tree') { f.hw = f.r; f.hh = 100; f.y = SH_GY - 100; }
  else if (k === 'pillar') { f.hw = f.r; f.hh = 200; }
  else if (k === 'arch') { f.hw = 90; f.hh = 30; f.y = f.top ? f.lim - 30 : f.lim + 30; }
  else if (k === 'log') { f.hw = 70; f.hh = 2.6; f.y = SH_GY - 2.6; }
  S.foes.push(f);
  return f;
}

// ===== Efekty =====
function shPart(p) { if (SHIP.parts.length < SH_MAXP) SHIP.parts.push(p); }
function shSparks(x, y, z, n, rgb, sp) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, b = shR(-1, 1), v = (0.3 + Math.random()) * (sp || 20);
    shPart({ k: 'spark', x, y, z, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: b * v, t: 0, life: shR(0.25, 0.6), rgb: rgb || '255,200,120' });
  }
}
function shExplode(x, y, z, size, quiet) {
  const S = SHIP;
  shPart({ k: 'boom', x, y, z, vx: 0, vy: 0, vz: 0, t: 0, life: 0.45 + size * 0.03, r: size });
  shSparks(x, y, z, Math.min(22, 6 + size * 1.5), '255,190,110', 8 + size * 3);
  for (let i = 0; i < Math.min(7, 2 + size / 2); i++) {
    const a = Math.random() * Math.PI * 2, v = shR(4, 14);
    shPart({ k: 'deb', x, y, z, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: shR(-10, 10), t: 0, life: shR(0.8, 1.5),
      rot: Math.random() * 6, vr: shR(-12, 12), s: shR(0.4, 1.1) });
  }
  if (!quiet && S.sndCd <= 0) { SND.crash(); S.sndCd = 0.08; }
  if (z < 300) shake(Math.min(4, size / 3));
}

// ===== Trafienie gracza: najpierw tarcza, potem kadłub (P.hp) =====
function shHurt(n) {
  const S = SHIP;
  if (S.dead || S.inv > 0 || S.roll > 0 || S.phase === 'jump' || S.phase === 'won' || S.phase === 'shop') return false;
  game.hurtLvl++;
  if (S.sh >= 1) {
    S.sh--; S.shT = 0; S.inv = 0.35; S.shHit = 0.35;
    shSparks(S.px, S.py, SH_PZ + 2, 8, '120,200,255', 14);
    tone(900, 0.18, 'sine', 0.05, 300); noise(0.15, 0.04, 3000, 800, 'bandpass');
    if (S.sh < 1) say('Tarcza wyczerpana!', 1.5);
    return true;
  }
  P.hp = Math.max(0, P.hp - (n || 1));
  S.inv = 1.1; S.shT = 0;
  shake(4); flash = { col: '#ff2020', t: 0.12 };
  shSparks(S.px, S.py, SH_PZ + 2, 12, '255,170,90', 18);
  SND.hit();
  if (P.hp <= 0) {
    S.dead = true; S.deadT = 0; P.st = 'dead'; P.t = 0;
    shExplode(S.px, S.py, SH_PZ + 4, 10); shExplode(S.px + 3, S.py - 2, SH_PZ + 8, 6, true);
    SND.die();
    say(S.sp ? 'Ścigacz rozbity…' : 'Myśliwiec zniszczony…', 3);
  }
  return true;
}

// ===== Bossowie: krążownik blokady i reaktor okrętu flagowego =====
const shTurAlive = b => b.parts.some(p => !p.core && p.hp > 0);
function shBossHP(b) {
  let h = 0, m = 0;
  for (const p of b.parts) { h += Math.max(0, p.hp); m += p.max; }
  return [h, m];
}
function shStartBoss(kind) {
  const S = SHIP, fr = kind === 'frigate';
  const parts = fr ? [[-30, -5], [30, -5], [-17, 8], [17, 8]] : [[-14, -10], [14, -10], [-14, 12], [14, 12]];
  if (fr && S.n >= 2) parts.push([0, -15]);
  const P2 = parts.map(([dx, dy]) => ({ dx, dy, hp: fr ? 8 : 10, max: fr ? 8 : 10, r: 4.5, cd: shR(1.5, 3), hitT: 0, core: false }));
  const core = { dx: 0, dy: fr ? -1 : 1, hp: fr ? 26 : 34, max: fr ? 26 : 34, r: fr ? 6 : 7.5, cd: 2.5, hitT: 0, core: true };
  P2.push(core);
  S.boss = { k: kind, x: 0, y: fr ? -4 : 0, z: SH_ZF + 120, zt: fr ? 300 : 240, t: 0, parts: P2, core,
    hw: fr ? 42 : SH_TW, hh: fr ? 11 : 23, hangCd: 5, dead: false, dieT: 0, boomT: 0 };
  S.phase = 'boss';
  SND.alarm();
  say(fr ? 'Krążownik Klinga! Zniszcz wieżyczki, potem rdzeń.' : 'Reaktor okrętu flagowego! Zniszcz emitery osłony, potem rdzeń.', 4);
}
function shPartPos(b, p) { return [b.x + p.dx, b.y + p.dy, b.z]; }

function shUpdBoss(dt) {
  const S = SHIP, b = S.boss, fr = b.k === 'frigate';
  b.t += dt;
  for (const p of b.parts) if (p.hitT > 0) p.hitT -= dt;
  b.z += (b.zt - b.z) * Math.min(1, dt * 0.8);
  if (fr) { b.x = Math.sin(b.t * 0.35) * 10; b.y = -4 + Math.sin(b.t * 0.5) * 3; }
  if (b.dead) {
    b.dieT += dt; b.boomT -= dt; S.bolts = [];
    if (b.boomT <= 0) {
      b.boomT = 0.13;
      shExplode(b.x + shR(-b.hw, b.hw), b.y + shR(-b.hh, b.hh), b.z - 4, shR(5, 10), Math.random() < 0.5);
    }
    if (b.dieT > 2.6) {
      for (let i = 0; i < 6; i++) shExplode(b.x + shR(-b.hw, b.hw), b.y + shR(-b.hh, b.hh), b.z - 6, 14, i > 0);
      flash = { col: '#ffffff', t: 0.35 };
      S.boss = null;
      shJump(fr ? 'Kordon przerwany – skok nadprzestrzenny!' : 'Reaktor eksploduje – uciekaj z rowu!');
    }
    return;
  }
  if (b.z > b.zt + 60) return;
  for (const p of b.parts) {
    if (p.core || p.hp <= 0) continue;
    p.cd -= dt;
    if (p.cd <= 0) {
      p.cd = (fr ? 2.4 : 2.0) / S.dk + Math.random() * 0.8;
      const q = shPartPos(b, p);
      shBolt(q[0], q[1], q[2] - 4);
      tone(760, 0.07, 'square', 0.015, 260);
    }
  }
  if (fr) {
    b.hangCd -= dt;
    if (b.hangCd <= 0) {
      b.hangCd = 6 - S.n * 0.5;
      if (S.foes.filter(f => f.k === 'eye').length < 3) {
        shSpawn('eye', { bx: b.x + shR(-8, 8), by: b.y + 8, z: b.z - 10, pz: b.z - 10, zt: shR(150, 240), ph: Math.random() * 6 });
        tone(200, 0.3, 'sawtooth', 0.03, 500);
      }
    }
  }
  if (!shTurAlive(b)) {
    const c = b.core;
    c.cd -= dt;
    if (c.cd <= 0) {
      c.cd = (fr ? 2.6 : 2.2) / S.dk;
      const q = shPartPos(b, c);
      if (fr) for (let i = -2; i <= 2; i++) shBolt(q[0], q[1], q[2] - 6, S.px + i * 7, S.py);
      else {
        // Pierścień wyładowań: rozchodzi się wokół osi rdzenia
        const a0 = b.t;
        for (let i = 0; i < 8; i++) { const a = a0 + i / 8 * Math.PI * 2; shBolt(q[0], q[1], q[2] - 6, q[0] + Math.cos(a) * 22, q[1] + Math.sin(a) * 16); }
      }
      SND.zap();
    }
  }
}

// Strzał wroga (czerwony) – leci ku płaszczyźnie gracza, celując w punkt (tx, ty)
function shBolt(x, y, z, tx, ty) {
  const S = SHIP, sp = 200 + S.n * 18, tm = Math.max(0.3, (z - SH_PZ) / sp);
  if (tx === undefined) { tx = S.px + shR(-1.5, 1.5) + S.vx * 0.2; ty = S.py + S.hopY + shR(-1.2, 1.2); }
  S.bolts.push({ x, y, z, pz: z, vx: (tx - x) / tm, vy: (ty - y) / tm, vz: -sp });
}

// Obrażenia
function shDamage(f, n) {
  const S = SHIP;
  if (f.inf || f.gone) return;
  f.hp -= n; f.hitT = 0.08;
  if (f.hp <= 0) {
    f.gone = true;
    if (f.ship || f.k === 'wtur' || f.k === 'mine') S.kills++;
    shExplode(f.x, f.y, f.z, f.k === 'bomber' ? 12 : f.k === 'rock' ? f.r : f.k === 'mine' ? 7 : 6);
    if (f.k === 'bomber' || (f.k === 'bike' && Math.random() < 0.3)) {
      const k = P.hp < P.max ? 'rep' : S.sh < S.shMax ? 'cell' : 'torp';
      S.picks.push({ k, x: f.x, y: f.k === 'bike' ? SH_GY - 4 : f.y, z: f.z, t: 0 });
    }
  }
}
function shDamageBoss(p, n, x, y, z) {
  const S = SHIP, b = S.boss;
  p.hp -= n; p.hitT = 0.08;
  shSparks(x, y, z, 3, '255,210,140', 12);
  if (p.hp > 0) return;
  p.hp = 0;
  if (p.core) {
    b.dead = true; b.dieT = 0; S.kills += 5;
    shExplode(x, y, z - 2, 18);
    flash = { col: '#ffffff', t: 0.3 };
  } else {
    S.kills++;
    shExplode(x, y, z - 2, 9);
    if (!shTurAlive(b)) { say(b.k === 'frigate' ? 'Wieżyczki zniszczone – rdzeń odsłonięty!' : 'Osłona padła – ognia w rdzeń!', 3); SND.zap(); }
  }
}

// Czy punkt (x, y) trafia w obiekt (z marginesem)
function shOverlap(f, x, y, pad) {
  if (f.box) return Math.abs(x - f.x) < f.hw + pad && Math.abs(y - f.y) < f.hh + pad * 0.7;
  return Math.hypot(x - f.x, y - f.y) < f.r + pad;
}

// Trafienie pociskiem gracza (s: x, y, z, pz); zwraca true, gdy pocisk się zatrzymał
function shShotHit(s, dmg, torp) {
  const S = SHIP, pad = torp ? 2 : 0.8;
  for (const f of S.foes) {
    if (f.gone || (f.k === 'bike' && f.z < SH_PZ)) continue;
    if (f.z < s.pz - 8 || f.z > s.z + 8) continue;
    if (!shOverlap(f, s.x, s.y, pad)) continue;
    if (f.inf) shSparks(s.x, s.y, f.z, torp ? 10 : 3, '255,210,150', 10);
    else { shDamage(f, dmg); shSparks(s.x, s.y, f.z, 2, game.blade.rgb, 10); }
    if (torp) shExplode(s.x, s.y, f.z, 6, true);
    return true;
  }
  const b = S.boss;
  if (b && !b.dead && b.z >= s.pz - 10 && b.z <= s.z + 10) {
    for (const p of b.parts) {
      if (p.hp <= 0) continue;
      const q = shPartPos(b, p);
      if (Math.hypot(q[0] - s.x, q[1] - s.y) > p.r + pad) continue;
      if (p.core && shTurAlive(b)) { shSparks(s.x, s.y, b.z, 4, '120,220,255', 12); if (torp) shExplode(s.x, s.y, b.z - 2, 5, true); return true; }
      shDamageBoss(p, dmg, s.x, s.y, b.z);
      if (torp) shExplode(s.x, s.y, b.z - 2, 7, true);
      return true;
    }
    const tower = b.k === 'frigate' && Math.abs(s.x - b.x) < 8 && s.y < b.y - 8 && s.y > b.y - 22;
    if ((Math.abs(s.x - b.x) < b.hw && Math.abs(s.y - b.y) < b.hh) || tower) {
      shSparks(s.x, s.y, b.z, torp ? 10 : 2, '255,220,160', 10);
      if (torp) shExplode(s.x, s.y, b.z - 2, 6, true);
      return true;
    }
  }
  // Ściany rowu
  if (S.trZ !== null && s.z > S.trZ && (Math.abs(s.x) > SH_TW || s.y > SH_TGY)) { shSparks(s.x, s.y, s.z, 2, '255,220,160', 8); return true; }
  return false;
}

// Pozycja celu (wróg albo moduł bossa); null, gdy cel zniknął
function shTgPos(tg) {
  if (!tg) return null;
  if (tg.f) return tg.f.gone ? null : [tg.f.x, tg.f.y, tg.f.z];
  const b = SHIP.boss;
  if (!b || b !== tg.b || b.dead || tg.p.hp <= 0) return null;
  return shPartPos(b, tg.p);
}

// Namierzanie: cel najbliżej celownika na ekranie
function shFindLock() {
  const S = SHIP, c = shP(S.px, S.py + S.hopY, SH_AIM), up = shUp();
  let best = null, bd = Math.max(shTorpOf(up.torp).lock, shGunOf(up.gun).assist);
  const test = (tg, x, y, z, pen) => {
    if (z < SH_PZ + 25 || z > SH_ZF - 60) return;
    const p = shP(x, y, z), d = Math.hypot(p[0] - c[0], p[1] - c[1]) + pen;
    if (d < bd) { bd = d; best = { tg, d, sx: p[0], sy: p[1], k: p[2], r: tg.f ? tg.f.r : tg.p.r }; }
  };
  for (const f of S.foes) if (!f.gone && !f.inf) test({ f }, f.x, f.y, f.z, f.ship || f.k === 'wtur' ? 0 : 8);
  const b = S.boss;
  if (b && !b.dead) {
    const open = !shTurAlive(b);
    for (const p of b.parts) if (p.hp > 0 && (!p.core || open)) { const q = shPartPos(b, p); test({ b, p }, q[0], q[1], q[2], 0); }
  }
  S.lock = best;
}

function shFire() {
  const S = SHIP, G = shGunOf(shUp().gun);
  S.fireCd = G.cd;
  S.side = (S.side + 1) % (G.quad ? 4 : 2);
  const sd = S.side % 2 ? 1 : -1, hi = S.side >= 2, ca = Math.cos(S.ang), sa = Math.sin(S.ang);
  const ox = sd * (S.sp ? 1.2 : hi ? 2.6 : 4.2), oy = S.sp ? -0.5 : hi ? -1.4 : 0.4;
  const x = S.px + ox * ca - oy * sa, y = S.py + S.hopY + ox * sa + oy * ca, vz = 560;
  let vx = 0, vy = 0;
  const L = S.lock;
  if (L && L.d < G.assist) {
    const tp = shTgPos(L.tg);
    if (tp) { const dz = Math.max(30, tp[2] - SH_PZ); vx = (tp[0] - x) / dz * vz; vy = (tp[1] - y) / dz * vz; }
  }
  S.shots.push({ x, y, z: SH_PZ + 2, pz: SH_PZ, vx, vy, vz, dmg: G.dmg });
  shPart({ k: 'spark', x, y, z: SH_PZ + 3, vx: 0, vy: 0, vz: 40, t: 0, life: 0.06, rgb: game.blade.rgb });
  tone(1700 + Math.random() * 200, 0.05, 'square', 0.012, 700);
}

function shJump(text) {
  const S = SHIP;
  S.phase = 'jump'; S.jumpT = 0; S.bolts = [];
  S.foes = S.foes.filter(f => !f.ship);
  SND.win();
  say(text, 2.5);
}

// ===== Aktualizacja =====
function updShip(dt) {
  const S = SHIP;
  if (!S) return;
  S.t += dt;
  S.sndCd -= dt; S.whooshCd -= dt;
  if (S.phase === 'shop') { shStarsUpd(dt, 0.12); shShopUpd(dt); return; }
  const jump = S.phase === 'jump' || S.phase === 'won';
  const V = S.V * (jump ? 1 + Math.min(8, S.jumpT * 7) : 1);
  S.dist += V * dt;
  shStarsUpd(dt, V / S.V);
  if (S.shHit > 0) S.shHit -= dt;

  // Cząsteczki (dryfują ku kamerze razem ze światem)
  for (const p of S.parts) {
    p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += (p.vz - S.V * 0.5) * dt;
    if (p.k === 'spark') { p.vx *= 0.95; p.vy *= 0.95; p.vz *= 0.95; }
    if (p.k === 'deb') p.rot += p.vr * dt;
  }
  S.parts = S.parts.filter(p => p.t < p.life && p.z > SH_NEAR);

  // Błyskawice w mgławicy
  if (S.env === 'nebula') {
    S.light = Math.max(0, S.light - dt * 3);
    if ((S.lightT -= dt) <= 0) { S.lightT = shR(4, 9); S.light = 1; S.lightX = shR(40, 280); noise(1.2, 0.08, 200, 60, 'lowpass'); }
  }

  // Zestrzelony – czekamy na powtórkę (A / R / dotknięcie)
  if (S.dead) {
    S.deadT += dt; P.t = S.deadT;
    for (const b of S.bolts) { b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; }
    S.bolts = S.bolts.filter(b => b.z > -5);
    shUpdFoes(dt, V, true);
    if (S.deadT > 1.5 && PR.act) restart();
    return;
  }

  // Skok / wyrwanie do przodu na koniec lotu
  if (jump) {
    S.jumpT += dt;
    for (const f of S.foes) f.z -= V * dt;
    S.foes = S.foes.filter(f => f.z > -20);
    S.px = lerp(S.px, 0, Math.min(1, dt * 2)); S.py = lerp(S.py, S.sp ? SH_GY - 5 : 0, Math.min(1, dt * 2));
    S.ang = lerp(S.ang, 0, Math.min(1, dt * 4)); S.hopY = 0;
    shCam();
    if (S.jumpT >= 1.6 && !S.done) {
      S.done = true; S.phase = 'won';
      game.crys += Math.min(12, Math.floor(S.kills / 3)) + (S.C.boss ? 3 : 0);
      finishLevel();
    }
    return;
  }
  S.T += dt;

  // Sterowanie
  const dx = (K.right ? 1 : 0) - (K.left ? 1 : 0), dy = (K.down ? 1 : 0) - (K.up ? 1 : 0);
  const ek = Math.min(1, dt * 8);
  S.vx = lerp(S.vx, dx * (S.sp ? 54 : 48), ek); S.vy = lerp(S.vy, dy * (S.sp ? 26 : 40), ek);
  if (S.roll > 0 && !S.sp) S.vx += S.rollDir * 90 * dt;
  S.px += S.vx * dt; S.py += S.vy * dt;
  const inTr = S.trZ !== null && S.trZ < SH_PZ + 90;
  let xr = 30, y0 = -17, y1 = 14;
  if (S.sp) { xr = 34; y0 = SH_GY - 9; y1 = SH_GY - 3; }
  if (inTr) { xr = SH_TW - 5; y0 = SH_RIM + 7; y1 = SH_TGY - 6; }
  const ck = inTr && S.trZ > SH_PZ ? Math.min(1, dt * 3) : 1;   // łagodne wciągnięcie do rowu
  S.px = lerp(S.px, shClamp(S.px, -xr, xr), ck); S.py = lerp(S.py, shClamp(S.py, y0, y1), ck);
  if (S.inv > 0) S.inv -= dt;
  if (S.rollCd > 0) S.rollCd -= dt;
  if (S.roll > 0) S.roll = Math.max(0, S.roll - dt);
  if (PR.push && S.rollCd <= 0) {
    S.roll = S.sp ? 0.6 : 0.5; S.rollCd = 1.3; S.rollDir = dx || (S.vx >= 0 ? 1 : -1);
    if (S.sp) tone(220, 0.3, 'triangle', 0.04, 520); else { tone(300, 0.25, 'sawtooth', 0.03, 900); noise(0.35, 0.04, 500, 2500, 'bandpass'); }
  }
  S.hopY = S.sp && S.roll > 0 ? -Math.sin((1 - S.roll / 0.6) * Math.PI) * 9 : 0;
  const rollA = !S.sp && S.roll > 0 ? (1 - S.roll / 0.5) * Math.PI * 2 * S.rollDir : 0;
  S.ang = lerp(S.ang, S.vx / 48 * 0.45, Math.min(1, dt * 10));
  S.rollA = rollA;
  shCam();

  // Tarcza – odnawianie
  if (S.sh < S.shMax) {
    S.shT += dt;
    if (S.shT >= shShieldOf(shUp().shield).regen) { S.sh++; S.shT = 0; tone(1200, 0.12, 'sine', 0.03, 1800); }
  }

  // Rów okrętu flagowego
  if (S.C.trench && S.trZ === null && S.T >= S.C.trench.at - 4) { S.trZ = SH_ZF; say('Rów okrętu flagowego – trzymaj się nisko!', 3); }
  if (S.trZ !== null) S.trZ = Math.max(-1e6, S.trZ - V * dt);

  // Broń
  shFindLock();
  S.fireCd -= dt;
  if (K.act && S.fireCd <= 0) shFire();
  if (PR.pull) {
    if (S.torp > 0) {
      S.torp--;
      const T = shTorpOf(shUp().torp), L = S.lock && S.lock.d < T.lock ? S.lock.tg : null;
      S.torps.push({ x: S.px, y: S.py + S.hopY + 1.5, z: SH_PZ + 2, pz: SH_PZ, vx: 0, vy: 0, vz: 160, t: 0, tg: L, turn: T.turn, dmg: T.dmg });
      tone(700, 0.45, 'triangle', 0.06, 120); noise(0.5, 0.06, 1200, 300, 'bandpass');
      if (!L) say('Torpeda bez namiaru – celuj celownikiem w wroga', 1.5);
    } else say(S.sp ? 'Brak rakiet!' : 'Brak torped!', 1);
  }

  // Fale
  const tr = S.C.trench, inTrW = tr && S.T >= tr.at;
  const pause = tr && S.T > tr.at - 5 && S.T < tr.at + 4;
  if (S.phase === 'fly' && S.T >= S.nextW && S.T < S.Dtot - 3 && !pause) {
    const L = inTrW ? tr.pats : S.C.pats;
    shPattern(L[S.wi++ % L.length]);
    S.nextW = S.T + S.C.gap * shR(0.85, 1.15) / HARD;
  }
  for (let i = S.queue.length - 1; i >= 0; i--) {
    const q = S.queue[i];
    if (q.at <= S.T) { S.queue.splice(i, 1); shSpawn(q.k, q.o); }
  }
  if (S.phase === 'fly' && S.T >= S.Dtot && !S.queue.length) {
    const hostile = S.foes.some(f => f.ship && !f.gone);
    if (!hostile || S.T >= S.Dtot + 8) {
      if (S.C.boss) shStartBoss(S.C.boss);
      else { shJump(S.sp ? 'Pościg zgubiony!' : 'Skok nadprzestrzenny!'); return; }
    }
  }

  shUpdFoes(dt, V, false);
  if (S.boss) shUpdBoss(dt);
  if (S.phase === 'jump') return;

  // Pociski gracza
  for (const s of S.shots) {
    s.pz = s.z; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
    if (s.z > SH_ZF) { s.dead = true; continue; }
    if (shShotHit(s, s.dmg, false)) s.dead = true;
  }
  S.shots = S.shots.filter(s => !s.dead);

  // Torpedy / rakiety
  for (const o of S.torps) {
    o.t += dt; o.vz = Math.min(470, o.vz + 520 * dt);
    const tp = shTgPos(o.tg);
    if (tp) {
      const dz = Math.max(12, tp[2] - o.z), k = Math.min(1, o.turn * dt);
      o.vx += ((tp[0] - o.x) / dz * o.vz - o.vx) * k;
      o.vy += ((tp[1] - o.y) / dz * o.vz - o.vy) * k;
    }
    o.pz = o.z; o.x += o.vx * dt; o.y += o.vy * dt; o.z += o.vz * dt;
    if (Math.random() < 0.8) shPart({ k: 'trail', x: o.x, y: o.y, z: o.z - 3, vx: 0, vy: 0, vz: 0, t: 0, life: 0.35, rgb: '255,170,90' });
    if (o.t > 3.5 || o.z > SH_ZF) { o.dead = true; continue; }
    if (shShotHit(o, o.dmg, true)) o.dead = true;
  }
  S.torps = S.torps.filter(o => !o.dead);

  // Strzały wrogów
  const hy = S.py + S.hopY;
  for (const b of S.bolts) {
    b.pz = b.z; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    if (b.pz > SH_PZ && b.z <= SH_PZ && Math.abs(b.x - S.px) < (S.sp ? 3.2 : 4.4) && Math.abs(b.y - hy) < (S.sp ? 3.6 : 2.8)) {
      if (S.roll > 0) { if (S.whooshCd <= 0) { tone(1500, 0.08, 'sine', 0.02, 600); S.whooshCd = 0.2; } continue; }
      if (shHurt(1)) b.dead = true;
      if (S.dead) return;
    }
    if (b.z < -5) b.dead = true;
  }
  S.bolts = S.bolts.filter(b => !b.dead);

  // Zderzenia z przeszkodami i wrogami
  for (const f of S.foes) {
    if (f.gone || !(f.pz > SH_PZ && f.z <= SH_PZ) || !(f.solid || f.ship) || f.k === 'bike') continue;
    const pad = f.k === 'mine' ? 5.5 : f.box ? 3.4 : 3;
    if (shOverlap(f, S.px, hy, pad)) {
      if (shHurt(1)) {
        if (f.inf) { shSparks(S.px, hy, SH_PZ + 2, 10, '200,170,120', 16); shake(3); }
        else shDamage(f, 99);
      }
      if (S.dead) return;
    } else if (shOverlap(f, S.px, hy, pad + 8) && S.whooshCd <= 0) {
      noise(0.3, 0.05, 600, 2400, 'bandpass'); S.whooshCd = 0.25;
    }
  }
  // Znajdźki: naprawa kadłuba, ogniwo tarczy, torpeda
  for (const p of S.picks) {
    p.t += dt; const pz = p.z; p.z -= S.V * 0.8 * dt;
    if (pz > SH_PZ && p.z <= SH_PZ && Math.abs(p.x - S.px) < 8 && Math.abs(p.y - hy) < 7) {
      p.dead = true;
      if (p.k === 'rep') { if (P.hp < P.max) P.hp++; say('Naprawa kadłuba +1', 1.5); }
      else if (p.k === 'cell') { S.sh = S.shMax; say('Tarcza naładowana', 1.5); }
      else { S.torp++; say((S.sp ? 'Rakieta' : 'Torpeda') + ' +1', 1.5); }
      SND.drink();
    }
    if (p.z < 0) p.dead = true;
  }
  S.picks = S.picks.filter(p => !p.dead);
}

function shStarsUpd(dt, sm) {
  const S = SHIP;
  for (const s of S.stars) {
    s.pz = s.z; s.z -= S.V * sm * dt;
    if (s.z < SH_NEAR) Object.assign(s, shStar(SH_ZF + Math.random() * 40), { pz: undefined });
  }
}

function shUpdFoes(dt, V, idle) {
  const S = SHIP, tr = S.trZ !== null && S.trZ < SH_ZF;
  for (const f of S.foes) {
    if (f.gone) continue;
    f.pz = f.z;
    f.t += dt; if (f.hitT > 0) f.hitT -= dt;
    f.cd -= dt * HARD;
    const fire = !idle && f.z < 560 && f.z > SH_PZ + 50 && f.cd <= 0;
    if (f.k === 'eye') {
      f.rot += f.vr * dt;
      if (f.st === 'in') {
        f.z += (f.zt - f.z) * Math.min(1, dt * 0.9);
        f.x = f.bx + Math.sin(f.t * 1.3 + f.ph) * 10;
        f.y = f.by + Math.sin(f.t * 1.9 + f.ph) * 5;
        if (fire) { f.cd = shR(2.2, 3.6) / S.dk; shBolt(f.x, f.y, f.z - 3); tone(880, 0.07, 'square', 0.012, 300); }
        if (f.t > f.life) { f.st = 'out'; f.ox = f.x < S.px ? -1 : 1; }
      } else {
        f.bx += f.ox * 50 * dt; f.x = f.bx; f.z += 20 * dt; f.y -= 8 * dt;
        if (Math.abs(f.x - S.cx) > 140) f.gone = true;
      }
      if (tr) f.x = shClamp(f.x, -SH_TW + 4, SH_TW - 4);
    } else if (f.k === 'dart') {
      if (f.st === 'in') {
        f.z += (150 - f.z) * Math.min(1, dt * 1.5);
        f.x = lerp(f.x, idle ? f.x : S.px, Math.min(1, dt * 0.7));
        f.y = lerp(f.y, idle ? f.y : S.py, Math.min(1, dt * 0.7));
        if (f.z < 200) { f.st = 'aim'; f.cd = 0.3; }
      } else if (f.st === 'aim') {
        f.z += (150 - f.z) * Math.min(1, dt * 1.5);
        if (fire) {
          f.cd = 0.75 / S.dk; f.shots++;
          shBolt(f.x - 2, f.y, f.z - 3); shBolt(f.x + 2, f.y, f.z - 3);
          tone(900, 0.07, 'square', 0.015, 300);
          if (f.shots >= 2 + (S.n >= 3 ? 1 : 0)) { f.st = 'dive'; f.vz = 60; }
        }
      } else {
        f.vz += 300 * dt; f.z -= f.vz * dt; f.y -= 10 * dt;
      }
    } else if (f.k === 'bomber') {
      f.z += (f.zt - f.z) * Math.min(1, dt * 0.6);
      f.x = f.bx + Math.sin(f.t * 0.5) * 12; f.y = f.by + Math.sin(f.t * 0.8) * 4;
      if (fire) {
        f.cd = 2.6 / S.dk;
        for (let i = -1; i <= 1; i++) shBolt(f.x + i * 4, f.y, f.z - 5, S.px + i * 9, S.py + S.hopY);
        tone(500, 0.12, 'sawtooth', 0.02, 200);
      }
      if (f.t > f.life) { f.by -= 25 * dt; if (f.by < -80) f.gone = true; }
    } else if (f.k === 'bike') {
      // Zwiadowca: wyprzedza od tyłu, zrównuje tor z graczem i strzela do tyłu; omija pnie (nie zawsze skutecznie)
      if (f.st === 'in') {
        f.z += (f.zt - f.z) * Math.min(1, dt * 1.1) + 20 * dt;
        f.x = lerp(f.x, f.x + Math.sin(f.t * 2 + f.seed) * 3, 0.1);
        if (f.z > f.zt - 6) { f.st = 'aim'; f.cd = 0.6; }
      } else if (f.st === 'aim') {
        f.x = lerp(f.x, idle ? f.x : S.px + Math.sin(f.t * 1.4 + f.seed) * 8, Math.min(1, dt * (0.9 + S.n * 0.1)));
        if (fire) {
          f.cd = 1.15 / S.dk; f.shots++;
          shBolt(f.x, f.y - 1, f.z - 3);
          tone(820, 0.07, 'square', 0.015, 300);
          if (f.shots >= 4) { f.st = 'go'; f.vz = 20; }
        }
      } else { f.vz += 90 * dt; f.z += f.vz * dt; if (f.z > SH_ZF) f.gone = true; }
      for (const o of S.foes) {
        if (o.k !== 'tree' || o.gone) continue;
        const ahead = o.z - f.z;
        if (ahead > 0 && ahead < 70 && Math.abs(o.x - f.x) < o.r + 5 && Math.random() < 0.92) f.x += (f.x < o.x ? -1 : 1) * 60 * dt;
        if (o.pz > f.z && o.z <= f.z && Math.abs(o.x - f.x) < o.r + 1.5 && f.z > SH_NEAR) {
          shDamage(f, 99); shSparks(f.x, f.y, f.z, 8, '200,160,100', 14); break;
        }
      }
      f.y = SH_GY - 4 + Math.sin(f.t * 5 + f.seed) * 0.4;
      f.x = shClamp(f.x, -44, 44);
    } else {
      // Obiekty nieruchome w świecie: pędzą ku kamerze
      f.z -= V * dt;
      f.rot += f.vr * dt;
      if (f.k === 'wtur' && fire && f.z > SH_PZ + 80) { f.cd = shR(1.4, 2.2) / S.dk; shBolt(f.x - f.side * 2, f.y, f.z - 2); tone(700, 0.07, 'square', 0.015, 250); }
    }
    if (f.z < -20) f.gone = true;
  }
  S.foes = S.foes.filter(f => !f.gone);
}

// ===== Rysowanie: tła =====
function shDrawPlanet(kind, cx, cy, r) {
  if (cx + r * 1.3 < 0 || cx - r * 1.3 > SW || r < 1) return;
  const pal = {
    cytadela: { base: ['#6a4c9c', '#2a1840', '#0c0614'], atm: '170,120,255' },
    pustynia: { base: ['#f0b870', '#c06a30', '#401a08'], atm: '255,180,110' },
    ocean: { base: ['#4ac0d8', '#14608c', '#04162c'], atm: '110,200,255' },
    krio: { base: ['#f0f8ff', '#8ab4d8', '#1a3050'], atm: '200,230,255' },
    verdan: { base: ['#8ad070', '#2a6a3a', '#0a2010'], atm: '150,255,150' },
    ignis: { base: ['#ff9040', '#8a2010', '#200402'], atm: '255,100,40' },
  }[kind] || { base: ['#888', '#444', '#111'], atm: '200,200,200' };
  ctx.globalCompositeOperation = 'lighter';
  glow(cx, cy, r * 1.25, pal.atm, 0.18);
  ctx.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  const g = ctx.createRadialGradient(cx - r * 0.4, cy - r * 0.4, r * 0.1, cx, cy, r * 1.05);
  g.addColorStop(0, pal.base[0]); g.addColorStop(0.6, pal.base[1]); g.addColorStop(1, pal.base[2]);
  ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  const rot = (SHIP.t * 0.01) % 1;
  if (kind === 'pustynia') {
    for (let i = 0; i < 7; i++) {
      const by = cy - r + (i + 0.5) * (r * 2 / 7) + Math.sin(i * 2.1) * r * 0.05;
      ctx.fillStyle = i % 2 ? 'rgba(120,50,10,0.22)' : 'rgba(255,220,150,0.16)';
      ctx.beginPath(); ctx.ellipse(cx, by, r * 1.1, r * (0.05 + shHash(i) * 0.06), 0, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 6; i++) {
      const a = shHash(i + 10) * 6.28, dd = shHash(i + 20) * r * 0.8;
      dot(cx + Math.cos(a + rot * 6.28) * dd, cy + Math.sin(a) * dd * 0.8, r * 0.06, 'rgba(90,40,10,0.35)');
    }
  } else if (kind === 'ocean') {
    for (let i = 0; i < 8; i++) {
      const a = shHash(i + 3) * 6.28 + rot * 6.28, dd = shHash(i + 7) * r * 0.85, x = cx + Math.cos(a) * dd, y = cy + Math.sin(a * 1.3) * dd * 0.7;
      ctx.strokeStyle = 'rgba(230,250,255,0.35)'; ctx.lineWidth = Math.max(0.6, r * 0.04);
      ctx.beginPath(); ctx.arc(x, y, r * (0.1 + shHash(i + 1) * 0.12), a, a + 3.6); ctx.stroke();
      dot(x + r * 0.05, y, r * 0.05, 'rgba(230,250,255,0.25)');
    }
    for (let i = 0; i < 3; i++) {
      const a = shHash(i + 40) * 6.28, dd = shHash(i + 41) * r * 0.6;
      dot(cx + Math.cos(a) * dd, cy + Math.sin(a) * dd, r * 0.09, 'rgba(60,130,80,0.5)');
    }
  } else if (kind === 'krio') {
    for (let i = 0; i < 5; i++) {
      const a = shHash(i + 50) * 6.28, dd = shHash(i + 51) * r * 0.7;
      dot(cx + Math.cos(a + rot * 6.28) * dd, cy + Math.sin(a) * dd * 0.8, r * (0.08 + shHash(i) * 0.08), 'rgba(255,255,255,0.4)');
    }
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(cx - r, cy - r, r * 2, r * 0.35); ctx.fillRect(cx - r, cy + r * 0.7, r * 2, r * 0.3);
  } else if (kind === 'verdan') {
    for (let i = 0; i < 9; i++) {
      const a = shHash(i + 60) * 6.28 + rot * 6.28, dd = shHash(i + 61) * r * 0.85;
      dot(cx + Math.cos(a) * dd, cy + Math.sin(a * 1.2) * dd * 0.8, r * (0.1 + shHash(i + 2) * 0.12), 'rgba(20,70,30,0.5)');
    }
    ctx.strokeStyle = 'rgba(240,255,240,0.3)'; ctx.lineWidth = Math.max(0.6, r * 0.04);
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(cx + (shHash(i + 70) - 0.5) * r, cy + (shHash(i + 71) - 0.5) * r, r * 0.15, 0, 3); ctx.stroke(); }
  } else if (kind === 'ignis') {
    ctx.strokeStyle = 'rgba(255,220,80,0.75)'; ctx.lineWidth = Math.max(0.5, r * 0.03);
    for (let i = 0; i < 7; i++) {
      const a = shHash(i + 80) * 6.28 + rot * 6.28; let x = cx + Math.cos(a) * r * 0.2, y = cy + Math.sin(a) * r * 0.2;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += Math.cos(a + k) * r * 0.2; y += Math.sin(a + k * 0.7) * r * 0.2; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = 'rgba(20,10,40,0.35)';
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.6 + i * r * 0.4, r, r * 0.08, 0, 0, Math.PI * 2); ctx.fill(); }
    // Światła miast po nocnej stronie
    for (let i = 0; i < 40; i++) {
      const a = shHash(i) * 6.28, dd = Math.sqrt(shHash(i + 100)) * r * 0.95;
      const x = cx + Math.cos(a) * dd, y = cy + Math.sin(a) * dd;
      if (x - cx + (y - cy) * 0.5 > -r * 0.2) dot(x, y, Math.max(0.4, r * 0.015), i % 3 ? 'rgba(255,210,120,0.85)' : 'rgba(200,160,255,0.8)');
    }
  }
  // Cień (terminator)
  const sh = ctx.createRadialGradient(cx - r * 0.5, cy - r * 0.5, r * 0.4, cx - r * 0.3, cy - r * 0.3, r * 1.6);
  sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,8,0.75)');
  ctx.fillStyle = sh; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
}

function shDrawSpaceBG() {
  const S = SHIP, jump = S.phase === 'jump' || S.phase === 'won';
  const neb = S.env === 'nebula';
  const g = ctx.createLinearGradient(0, 0, 0, 180);
  g.addColorStop(0, neb ? '#0c0618' : '#03020a'); g.addColorStop(0.5, neb ? '#1c0c2a' : '#07051a'); g.addColorStop(1, neb ? '#100818' : '#0a0618');
  ctx.fillStyle = g; ctx.fillRect(0, 0, SW, 180);
  const ox = -S.cx * 0.5, oy = -S.cy * 0.5;
  ctx.globalCompositeOperation = 'lighter';
  const N = neb
    ? [[70, 50, 130, '170,60,200', 0.28], [250, 110, 150, '40,150,190', 0.24], [160, 70, 90, '230,90,160', 0.18], [20, 150, 110, '90,60,200', 0.2]]
    : [[60, 40, 100, '110,60,170', 0.16], [260, 130, 120, '40,90,170', 0.14], [200, 30, 80, '160,50,110', 0.1]];
  for (const n of N) glow(n[0] + ox * 0.4, n[1] + oy * 0.4, n[2], n[3], n[4]);
  if (neb && S.light > 0) glow(S.lightX + ox, 60 + oy, 160, '220,180,255', S.light * 0.35);
  ctx.globalCompositeOperation = 'source-over';
  // Planeta docelowa rośnie przed nami
  if (!neb || S.T > S.Dtot - 15) {
    const prog = Math.min(1, S.T / (S.Dtot + 20));
    shDrawPlanet(S.to, SH_CX + 46 + ox * 0.6, SH_CY - 26 + oy * 0.6, 8 + ease(prog) * 50);
  }
  // Okręt flagowy na horyzoncie (przed rowem)
  if (S.C.trench && S.T > S.C.trench.at - 16 && S.trZ === null) {
    const k = Math.min(1, (S.T - S.C.trench.at + 16) / 12), w = 30 + k * 150, x = SH_CX + ox, y = SH_CY + oy;
    poly([[x - w, y + 4], [x - w * 0.6, y - w * 0.12], [x + w * 0.6, y - w * 0.12], [x + w, y + 4], [x + w * 0.7, y + w * 0.1], [x - w * 0.7, y + w * 0.1]], '#2a2c3a');
    seg([x - w * 0.6, y - w * 0.12], [x + w * 0.6, y - w * 0.12], 0.6, 'rgba(180,190,220,0.4)');
    for (let i = 0; i < 12; i++) dot(x - w * 0.6 + i * w * 0.11, y - w * 0.05, 0.6, 'rgba(255,200,120,0.7)');
    ctx.fillStyle = '#0a0a12'; ctx.fillRect(x - w * 0.05, y - w * 0.12, w * 0.1, w * 0.22);
  }
  shDrawStars(jump ? Math.min(1, S.jumpT / 0.5) : 0);
}

function shDrawStars(sm) {
  const S = SHIP, forest = S.env === 'forest';
  for (const s of S.stars) {
    if (s.z > SH_ZF) continue;
    const p = shP(s.x, s.y, s.z);
    if (p[0] < -5 || p[0] > SW + 5 || p[1] < -5 || p[1] > 185) continue;
    const a = Math.min(1, (SH_ZF - s.z) / 200) * (0.4 + s.l * 0.6);
    if (forest) { dot(p[0], p[1], Math.min(1.6, 0.25 + p[2] * 0.12), `rgba(170,230,140,${a * 0.6})`); continue; }
    const q = shP(s.x, s.y, s.z + 6 + sm * 160 + (S.V / 140) * 4);
    const c = s.l > 0.7 ? `rgba(255,255,255,${a})` : `rgba(190,205,255,${a})`;
    seg([q[0], q[1]], [p[0], p[1]], Math.min(1.8, 0.35 + p[2] * 0.06), c);
  }
}

function shDrawForestBG() {
  const S = SHIP, ox = -S.cx * 2, hz = shP(0, SH_GY, SH_ZF)[1];
  // Półmrok pod koronami
  let g = ctx.createLinearGradient(0, 0, 0, hz);
  g.addColorStop(0, '#08140a'); g.addColorStop(1, '#2c4a2a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, SW, hz + 1);
  // Smugi światła
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const x = ((i * 83 + ox * 0.5) % 400 + 400) % 400 - 40;
    ctx.fillStyle = 'rgba(200,255,170,0.05)';
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 16, 0); ctx.lineTo(x + 50, 180); ctx.lineTo(x + 24, 180); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  // Daleka ściana pni
  for (let i = 0; i < 26; i++) {
    const x = ((i * 23 + shHash(i) * 20 + ox * 0.25) % 360 + 360) % 360 - 20, w = 2 + shHash(i + 5) * 3;
    ctx.fillStyle = i % 2 ? '#1a2c1a' : '#20321e'; ctx.fillRect(x - w / 2, 0, w, hz);
  }
  // Grunt: pasy pędzące ku kamerze
  ctx.fillStyle = '#34482a'; ctx.fillRect(0, hz, SW, 180 - hz);
  const step = 26, off = S.dist % step;
  for (let j = Math.floor((SH_ZF + off) / step); j > 0; j--) {
    const za = Math.max(SH_NEAR, j * step - off), zb = Math.min(SH_ZF, (j + 1) * step - off);
    if (zb <= za || j % 2) continue;
    const ya = shP(0, SH_GY, za)[1], yb = shP(0, SH_GY, zb)[1];
    ctx.fillStyle = shCol(58, 78, 40, za); ctx.fillRect(0, yb, SW, ya - yb);
  }
  // Mgła przy horyzoncie
  g = ctx.createLinearGradient(0, hz - 14, 0, hz + 22);
  g.addColorStop(0, 'rgba(60,90,60,0)'); g.addColorStop(0.45, 'rgba(60,90,60,0.65)'); g.addColorStop(1, 'rgba(60,90,60,0)');
  ctx.fillStyle = g; ctx.fillRect(0, hz - 14, SW, 36);
  shDrawStars(0);
}

// Rów okrętu flagowego: ściany i dno z panelami pędzącymi ku kamerze
function shDrawTrench() {
  const S = SHIP, z0 = Math.max(SH_NEAR, S.trZ), step = 40, off = S.dist % step;
  if (z0 >= SH_ZF) return;
  const L = (x, y, z) => shP(x, y, z);
  for (let j = Math.floor((SH_ZF + off) / step); ; j--) {
    const zs = j * step - off, za = Math.max(z0, zs), zb = Math.min(SH_ZF, zs + step);
    if (zb > za) {
      const fz = za, sh = j % 2 ? 1 : 0.86;
      const a = L(-SH_TW, SH_TGY, za), b = L(SH_TW, SH_TGY, za), c = L(SH_TW, SH_TGY, zb), d = L(-SH_TW, SH_TGY, zb);
      const e = L(-SH_TW, SH_RIM, za), g = L(-SH_TW, SH_RIM, zb), h = L(SH_TW, SH_RIM, za), i = L(SH_TW, SH_RIM, zb);
      poly([a, b, c, d], shCol(46 * sh, 48 * sh, 60 * sh, fz));
      poly([e, a, d, g], shCol(96 * sh, 98 * sh, 116 * sh, fz));
      poly([h, b, c, i], shCol(72 * sh, 74 * sh, 90 * sh, fz));
      // Krawędzie rowu
      seg([e[0], e[1]], [g[0], g[1]], Math.max(0.4, e[2] * 0.6), shCol(170, 175, 195, fz));
      seg([h[0], h[1]], [i[0], i[1]], Math.max(0.4, h[2] * 0.6), shCol(150, 155, 175, fz));
      if (j % 3 === 0) {
        const m = L(-SH_TW, 2, za), n = L(SH_TW, 2, za);
        dot(m[0], m[1], Math.max(0.5, m[2] * 0.9), shCol(255, 190, 110, fz));
        dot(n[0], n[1], Math.max(0.5, n[2] * 0.9), shCol(120, 190, 255, fz));
      }
      if (j % 5 === 0) { const u = L(-SH_TW, -8, za), v = L(-SH_TW, 14, za); seg([u[0], u[1]], [v[0], v[1]], Math.min(4, Math.max(0.5, u[2] * 1.2)), shCol(40, 40, 52, fz)); }
    }
    if (zs <= z0) break;
  }
  // Rury biegnące wzdłuż ścian
  for (const yy of [-12, 9]) {
    for (const sx of [-1, 1]) {
      const x = sx * (SH_TW - 0.3);
      poly([L(x, yy - 0.7, z0), L(x, yy + 0.7, z0), L(x, yy + 0.7, SH_ZF), L(x, yy - 0.7, SH_ZF)], 'rgba(30,32,44,0.75)');
    }
  }
  // Wlot rowu – czoło konstrukcji
  if (S.trZ > SH_NEAR) {
    const e = L(-SH_TW, SH_RIM, S.trZ), a = L(-SH_TW, SH_TGY, S.trZ), b = L(SH_TW, SH_TGY, S.trZ), h = L(SH_TW, SH_RIM, S.trZ);
    const k = e[2], W = 90;
    const c = shCol(70, 72, 88, S.trZ);
    ctx.fillStyle = c;
    ctx.fillRect(e[0] - W * k, e[1], W * k, (a[1] - e[1]) + 40 * k);
    ctx.fillRect(h[0], h[1], W * k, (b[1] - h[1]) + 40 * k);
    ctx.fillRect(a[0] - W * k, a[1], (b[0] - a[0]) + 2 * W * k, 40 * k);
  }
}

// ===== Rysowanie: obiekty =====
function shDrawFoe(f) {
  const p = shP(f.x, f.y, f.z), x = p[0], y = p[1], s = p[2], hit = f.hitT > 0, z = f.z;
  if (x < -300 || x > SW + 300) return;
  const C = (r, g, b) => hit ? '#ffffff' : shCol(r, g, b, z);
  ctx.globalAlpha = shFade(z);
  if (f.k === 'eye') {
    // Sowa – kulisty kokpit z trzema płetwami
    for (let i = 0; i < 3; i++) {
      const a = f.rot + i * 2.094;
      poly([[x + Math.cos(a - 0.35) * 2.4 * s, y + Math.sin(a - 0.35) * 2.4 * s], [x + Math.cos(a - 0.08) * 7 * s, y + Math.sin(a - 0.08) * 7 * s],
        [x + Math.cos(a + 0.12) * 6.6 * s, y + Math.sin(a + 0.12) * 6.6 * s], [x + Math.cos(a + 0.35) * 2.4 * s, y + Math.sin(a + 0.35) * 2.4 * s]], C(70, 74, 92));
      seg([x + Math.cos(a) * 3 * s, y + Math.sin(a) * 3 * s], [x + Math.cos(a) * 6.4 * s, y + Math.sin(a) * 6.4 * s], Math.max(0.3, 0.5 * s), C(130, 136, 156));
    }
    dot(x, y, 3 * s, C(150, 156, 172));
    dot(x - 0.6 * s, y - 0.6 * s, 1.8 * s, C(190, 196, 210));
    dot(x, y, 1.4 * s, '#141822');
    ctx.globalCompositeOperation = 'lighter';
    glow(x, y, 3.5 * s, '255,60,40', 0.7);
    ctx.globalCompositeOperation = 'source-over';
  } else if (f.k === 'dart') {
    // Grot – grot strzały widziany z przodu
    poly([[x, y - 4.5 * s], [x + 1.6 * s, y], [x + 7 * s, y + 2.6 * s], [x + 1.4 * s, y + 1.8 * s], [x, y + 3 * s], [x - 1.4 * s, y + 1.8 * s], [x - 7 * s, y + 2.6 * s], [x - 1.6 * s, y]], C(122, 126, 142));
    poly([[x, y - 4.5 * s], [x + 1.6 * s, y], [x, y + 3 * s], [x - 1.6 * s, y]], C(78, 82, 98));
    seg([x - 6 * s, y + 2.4 * s], [x - 2 * s, y + 1.2 * s], Math.max(0.3, 0.6 * s), C(255, 80, 64));
    seg([x + 6 * s, y + 2.4 * s], [x + 2 * s, y + 1.2 * s], Math.max(0.3, 0.6 * s), C(255, 80, 64));
    ctx.globalCompositeOperation = 'lighter';
    glow(x, y + 0.4 * s, 2.6 * s, '255,90,60', 0.6);
    ctx.globalCompositeOperation = 'source-over';
  } else if (f.k === 'bomber') {
    // Taran – dwa kadłuby na szerokim skrzydle
    rrect(x - 11 * s, y - 1 * s, 22 * s, 2.4 * s, 1 * s, C(100, 100, 116));
    rrect(x - 11 * s, y - 3.5 * s, 5 * s, 7 * s, 2 * s, C(138, 138, 150));
    rrect(x + 6 * s, y - 3.5 * s, 5 * s, 7 * s, 2 * s, C(118, 118, 132));
    rrect(x - 3 * s, y - 3 * s, 6 * s, 6 * s, 1.5 * s, C(70, 72, 86));
    dot(x, y, 1.4 * s, C(28, 36, 54));
    if (!hit) for (let i = 0; i < 3; i++) { dot(x - 8.5 * s, y - 2 * s + i * 2 * s, 0.4 * s, '#ffb040'); dot(x + 8.5 * s, y - 2 * s + i * 2 * s, 0.4 * s, '#ffb040'); }
    ctx.globalCompositeOperation = 'lighter';
    glow(x, y, 2 * s, '255,90,60', 0.5);
    ctx.globalCompositeOperation = 'source-over';
  } else if (f.k === 'rock' || f.k === 'deb') {
    ctx.save(); ctx.translate(x, y); ctx.rotate(f.rot);
    if (f.k === 'rock') {
      const pts = [];
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, rr = f.r * (0.75 + shHash(f.seed + i) * 0.35) * s; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
      poly(pts, S_neb() ? C(92, 70, 96) : C(92, 74, 62));
      if (!hit) {
        poly(pts.slice(3, 8).map(q => [q[0] * 0.85 + 0.6 * s, q[1] * 0.85 + 0.6 * s]), shCol(52, 40, 40, z));
        poly(pts.slice(0, 4).concat([[0, 0]]).map(q => [q[0] * 0.8 - 0.5 * s, q[1] * 0.8 - 0.5 * s]), S_neb() ? shCol(130, 104, 140, z) : shCol(128, 104, 84, z));
        dot(f.r * 0.25 * s, -f.r * 0.2 * s, f.r * 0.18 * s, shCol(60, 46, 42, z));
      }
    } else {
      const sq = Math.cos(f.t * f.vr2);
      poly([[-f.r * s, -f.r * 0.4 * s * sq], [f.r * 0.6 * s, -f.r * 0.7 * s * sq], [f.r * s, f.r * 0.3 * s * sq], [-f.r * 0.3 * s, f.r * 0.6 * s * sq]], C(76, 78, 92));
      seg([-f.r * 0.5 * s, 0], [f.r * 0.5 * s, -f.r * 0.2 * s * sq], Math.max(0.3, 0.5 * s), C(130, 134, 152));
      if (!hit) dot(f.r * 0.3 * s, 0, 0.5 * s, '#ff9040');
    }
    ctx.restore();
  } else if (f.k === 'mine') {
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + f.rot; seg([x, y], [x + Math.cos(a) * 5 * s, y + Math.sin(a) * 5 * s], Math.max(0.3, 0.6 * s), C(110, 110, 120)); }
    dot(x, y, 3.2 * s, C(70, 70, 82));
    const on = Math.sin(f.t * 8) > 0;
    dot(x, y, 1.2 * s, on ? '#ff4030' : '#601010');
    if (on) { ctx.globalCompositeOperation = 'lighter'; glow(x, y, 5 * s, '255,60,40', 0.5); ctx.globalCompositeOperation = 'source-over'; }
  } else if (f.k === 'girder') {
    // Dźwigar rozbitej stacji
    const a = shP(f.x - f.hw, f.y, z), b = shP(f.x + f.hw, f.y, z), h = f.hh * s;
    ctx.fillStyle = C(92, 94, 108); ctx.fillRect(a[0], a[1] - h, b[0] - a[0], h * 2);
    ctx.fillStyle = shCol(56, 58, 70, z); ctx.fillRect(a[0], a[1] + h * 0.2, b[0] - a[0], h * 0.8);
    for (let i = 0; i < 12; i++) {
      const u = a[0] + (b[0] - a[0]) * i / 12, v = a[0] + (b[0] - a[0]) * (i + 1) / 12;
      seg([u, a[1] - h], [v, a[1] + h], Math.max(0.3, 0.4 * s), shCol(40, 40, 50, z));
    }
    if (!hit) { ctx.globalCompositeOperation = 'lighter'; glow(a[0] + (b[0] - a[0]) * 0.3, a[1], 4 * s, '255,140,60', 0.5); ctx.globalCompositeOperation = 'source-over'; }
  } else if (f.k === 'pillar') {
    // Skalna kolumna w mgławicy
    const w = f.r * s;
    ctx.fillStyle = shCol(70, 54, 78, z); ctx.fillRect(x - w, -5, w * 2, 190);
    ctx.fillStyle = shCol(100, 80, 110, z); ctx.fillRect(x - w, -5, w * 0.6, 190);
    ctx.fillStyle = shCol(40, 30, 48, z); ctx.fillRect(x + w * 0.5, -5, w * 0.5, 190);
    for (let i = 0; i < 6; i++) { const yy = (shHash(f.seed + i) * 180); poly([[x - w, yy], [x - w - w * 0.4, yy + 6 * s], [x - w, yy + 12 * s]], shCol(70, 54, 78, z)); }
  } else if (f.k === 'arch') {
    const a = shP(f.x - f.hw, f.y - f.hh, z), b = shP(f.x + f.hw, f.y + f.hh, z);
    ctx.fillStyle = shCol(82, 62, 90, z); ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
    const ey = f.top ? b[1] : a[1], d = f.top ? 1 : -1;
    const pts = [[a[0], ey]];
    for (let i = 0; i <= 14; i++) pts.push([a[0] + (b[0] - a[0]) * i / 14, ey + d * shHash(f.seed + i) * 4 * s]);
    pts.push([b[0], ey - d * 6 * s], [a[0], ey - d * 6 * s]);
    poly(pts, shCol(110, 86, 120, z));
  } else if (f.k === 'log') {
    // Zwalony pień w poprzek drogi
    const a = shP(f.x - f.hw, f.y, z), b = shP(f.x + f.hw, f.y, z), h = f.hh * s;
    ctx.fillStyle = shCol(84, 60, 38, z); ctx.fillRect(a[0], a[1] - h, b[0] - a[0], h * 2);
    ctx.fillStyle = shCol(110, 82, 52, z); ctx.fillRect(a[0], a[1] - h, b[0] - a[0], h * 0.6);
    for (let i = 0; i < 10; i++) dot(a[0] + (b[0] - a[0]) * shHash(f.seed + i), a[1] - h * 0.8, h * 0.4, shCol(60, 110, 50, z));
  } else if (f.k === 'tree') {
    const g = shP(f.x, SH_GY, z), w = f.r * s;
    ctx.fillStyle = shCol(78, 56, 36, z); ctx.fillRect(g[0] - w, 0, w * 2, g[1]);
    ctx.fillStyle = shCol(104, 78, 50, z); ctx.fillRect(g[0] - w, 0, w * 0.6, g[1]);
    ctx.fillStyle = shCol(46, 32, 20, z); ctx.fillRect(g[0] + w * 0.45, 0, w * 0.55, g[1]);
    poly([[g[0] - w * 1.8, g[1]], [g[0] - w, g[1] - 4 * s], [g[0] + w, g[1] - 4 * s], [g[0] + w * 1.8, g[1]]], shCol(70, 50, 32, z));
    for (let i = 0; i < 4; i++) { const yy = g[1] - (12 + i * 14) * s; if (yy > 0) seg([g[0] - w * 0.3, yy], [g[0] + w * 0.2, yy - 5 * s], Math.max(0.3, 0.4 * s), shCol(40, 28, 18, z)); }
  } else if (f.k === 'bike') {
    if (z > SH_NEAR + 2) shDrawSpeeder(x, y, Math.sin(f.t * 2 + f.seed) * 0.15, s * 0.25, true, hit, shP(f.x, SH_GY, z)[1]);
  } else if (f.k === 'wtur') {
    // Wieżyczka na ścianie rowu
    const tx = SH_CX + (SHIP.px - SHIP.cx) * 6.5 - x, ty = 140 - y, a = Math.atan2(ty, tx);
    rrect(x - 3.5 * s, y - 3 * s, 7 * s, 6 * s, 1 * s, C(110, 112, 128));
    seg([x, y], [x + Math.cos(a) * 5 * s, y + Math.sin(a) * 5 * s], Math.max(0.4, 1.3 * s), C(50, 52, 64));
    dot(x, y, 1.8 * s, C(150, 152, 168));
    dot(x, y, 0.8 * s, '#ff4030');
  } else if (f.k === 'beam') {
    // Zapora w rowie (pasy ostrzegawcze)
    const a = shP(f.x - f.hw, f.y - f.hh, z), b = shP(f.x + f.hw, f.y + f.hh, z);
    ctx.save();
    ctx.beginPath(); ctx.rect(a[0], a[1], b[0] - a[0], b[1] - a[1]); ctx.clip();
    ctx.fillStyle = shCol(120, 110, 60, z); ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
    ctx.strokeStyle = shCol(30, 28, 24, z); ctx.lineWidth = 3 * s;
    for (let u = a[0] - (b[1] - a[1]); u < b[0]; u += 8 * s) { ctx.beginPath(); ctx.moveTo(u, b[1]); ctx.lineTo(u + (b[1] - a[1]), a[1]); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = shCol(200, 200, 210, z); ctx.lineWidth = Math.max(0.4, 0.6 * s); ctx.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
  }
  ctx.globalAlpha = 1;
}
const S_neb = () => SHIP.env === 'nebula';

function shDrawBoss(b) {
  const p = shP(b.x, b.y, b.z), x = p[0], y = p[1], s = p[2], fr = b.k === 'frigate';
  ctx.globalAlpha = shFade(b.z);
  const ship = shP(SHIP.px, SHIP.py, SH_PZ);
  if (fr) {
    // Krążownik Klinga – widok z przodu
    const g = ctx.createLinearGradient(0, y - 12 * s, 0, y + 12 * s);
    g.addColorStop(0, '#a4a8b6'); g.addColorStop(0.5, '#5e6272'); g.addColorStop(1, '#262834');
    const pts = [[-42, 1], [-30, -8], [30, -8], [42, 1], [30, 11], [-30, 11]].map(q => [x + q[0] * s, y + q[1] * s]);
    ctx.globalCompositeOperation = 'lighter';
    glow(x, y, 50 * s, '120,170,255', 0.15);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = g; ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath(); ctx.fill();
    // Wieża mostka
    rrect(x - 8 * s, y - 22 * s, 16 * s, 15 * s, 2 * s, '#7a7e8e');
    rrect(x - 10 * s, y - 24 * s, 20 * s, 5 * s, 1.5 * s, '#9498a8');
    seg([x - 7 * s, y - 21.5 * s], [x + 7 * s, y - 21.5 * s], Math.max(0.4, 0.8 * s), 'rgba(160,220,255,0.85)');
    seg([x - 42 * s, y + 1 * s], [x + 42 * s, y + 1 * s], Math.max(0.3, 0.5 * s), 'rgba(200,210,230,0.4)');
    for (let i = 0; i < 16; i++) dot(x + (-34 + i * 4.5) * s, y + (4 + (i % 3)) * s, Math.max(0.3, 0.4 * s), i % 4 ? 'rgba(255,220,150,0.7)' : 'rgba(150,200,255,0.8)');
    // Hangar
    rrect(x - 9 * s, y + 5 * s, 18 * s, 5 * s, 1 * s, '#140f16');
    ctx.globalCompositeOperation = 'lighter';
    glow(x, y + 7.5 * s, 9 * s, '255,150,60', 0.35 + Math.sin(b.t * 4) * 0.1);
    ctx.globalCompositeOperation = 'source-over';
  } else {
    // Reaktor: masywna ściana zamykająca rów
    const a = shP(-SH_TW, SH_RIM, b.z), c = shP(SH_TW, SH_TGY, b.z);
    const g = ctx.createLinearGradient(0, a[1], 0, c[1]);
    g.addColorStop(0, '#6a6e80'); g.addColorStop(1, '#2a2c38');
    ctx.fillStyle = g; ctx.fillRect(a[0], a[1], c[0] - a[0], c[1] - a[1]);
    ctx.strokeStyle = 'rgba(20,22,30,0.6)'; ctx.lineWidth = Math.max(0.4, 0.5 * s);
    for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.arc(x, y + b.core.dy * s, i * 4.5 * s, 0, Math.PI * 2); ctx.stroke(); }
    for (let i = 0; i < 8; i++) { const an = i / 8 * Math.PI * 2; seg([x + Math.cos(an) * 8 * s, y + Math.sin(an) * 8 * s], [x + Math.cos(an) * 24 * s, y + Math.sin(an) * 24 * s], Math.max(0.4, 1.2 * s), 'rgba(30,32,44,0.7)'); }
  }
  // Rdzeń
  const open = !shTurAlive(b), pul = 0.7 + Math.sin(b.t * 6) * 0.3, c = b.core, cx = x + c.dx * s, cy = y + c.dy * s;
  if (c.hp > 0 || b.dead) {
    ctx.globalCompositeOperation = 'lighter';
    glow(cx, cy, (c.r + 6 + pul * 4) * s, open ? '255,120,60' : '120,200,255', 0.6);
    ctx.globalCompositeOperation = 'source-over';
    dot(cx, cy, c.r * s, c.hitT > 0 ? '#ffffff' : open ? '#ffb070' : '#a0e0ff');
    dot(cx, cy, c.r * 0.45 * s, '#ffffff');
    if (!open) {
      ctx.strokeStyle = `rgba(140,220,255,${0.4 + pul * 0.3})`; ctx.lineWidth = Math.max(0.5, 0.7 * s);
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI * 2 + b.t; const px = cx + Math.cos(a) * (c.r + 3) * s, py = cy + Math.sin(a) * (c.r + 3) * s; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.stroke();
    }
  }
  // Wieżyczki / emitery
  for (const u of b.parts) {
    if (u.core) continue;
    const ux = x + u.dx * s, uy = y + u.dy * s;
    if (u.hp <= 0) { dot(ux, uy, 3 * s, '#201814'); if (Math.random() < 0.3) shPart({ k: 'smoke', x: b.x + u.dx, y: b.y + u.dy, z: b.z - 2, vx: shR(-2, 2), vy: -6, vz: 0, t: 0, life: 0.8 }); continue; }
    const a = Math.atan2(ship[1] - uy, ship[0] - ux);
    if (fr) {
      seg([ux, uy], [ux + Math.cos(a) * 6 * s, uy + Math.sin(a) * 6 * s], Math.max(0.5, 1.6 * s), '#30323e');
      dot(ux, uy, u.r * s, u.hitT > 0 ? '#ffffff' : '#a8acb8');
      dot(ux - 1 * s, uy - 1 * s, 2 * s, '#d4d8e0');
      dot(ux + Math.cos(a) * 2 * s, uy + Math.sin(a) * 2 * s, Math.max(0.4, 1 * s), '#ff4030');
    } else {
      rrect(ux - u.r * s, uy - u.r * s, u.r * 2 * s, u.r * 2 * s, 1.5 * s, u.hitT > 0 ? '#ffffff' : '#8a8e9e');
      ctx.globalCompositeOperation = 'lighter';
      glow(ux, uy, 5 * s, '120,220,255', 0.5 + Math.sin(b.t * 5 + u.dx) * 0.2);
      ctx.globalCompositeOperation = 'source-over';
      dot(ux, uy, 1.5 * s, '#e0f8ff');
      // Wiązka osłony do rdzenia
      seg([ux, uy], [cx, cy], Math.max(0.3, 0.5 * s), `rgba(140,220,255,${0.25 + pul * 0.2})`);
    }
  }
  ctx.globalAlpha = 1;
}

function shDrawPick(o) {
  const p = shP(o.x, o.y, o.z), s = p[2], col = o.k === 'rep' ? '80,255,120' : o.k === 'cell' ? '110,190,255' : '255,170,80';
  ctx.globalCompositeOperation = 'lighter';
  glow(p[0], p[1], 6 * s, col, 0.4 + Math.sin(o.t * 6) * 0.15);
  ctx.globalCompositeOperation = 'source-over';
  rrect(p[0] - 2.5 * s, p[1] - 2.5 * s, 5 * s, 5 * s, 1 * s, '#f0f8ff');
  const c = `rgb(${col})`, w = Math.max(0.4, 0.9 * s);
  if (o.k === 'rep') { seg([p[0] - 1.6 * s, p[1]], [p[0] + 1.6 * s, p[1]], w, c); seg([p[0], p[1] - 1.6 * s], [p[0], p[1] + 1.6 * s], w, c); }
  else if (o.k === 'cell') { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(p[0], p[1], 1.5 * s, 0, Math.PI * 2); ctx.stroke(); }
  else seg([p[0] - 1.5 * s, p[1]], [p[0] + 1.5 * s, p[1]], w * 1.4, c);
}

function shDrawItem(it) {
  const S = SHIP, o = it[2], t = it[1];
  if (t === 0) shDrawFoe(o);
  else if (t === 1) shDrawBoss(o);
  else if (t === 2) shDrawPick(o);
  else {
    ctx.globalCompositeOperation = 'lighter';
    if (t === 3) {
      const p = shP(o.x, o.y, o.z), s = p[2];
      glow(p[0], p[1], 4 * s + 2, '255,170,90', 0.7);
      dot(p[0], p[1], Math.max(0.6, 0.9 * s), '#fff4e0');
    } else if (t === 4) {
      const p = shP(o.x, o.y, o.z), q = shP(o.x - o.vx * 0.03, o.y - o.vy * 0.03, o.z + 10), s = p[2];
      glow(p[0], p[1], 2.8 * s + 1, RED.rgb, 0.45);
      seg([q[0], q[1]], [p[0], p[1]], Math.max(0.6, 1.1 * s), `rgba(${RED.rgb},0.9)`);
      seg([q[0], q[1]], [p[0], p[1]], Math.max(0.3, 0.4 * s), '#fff0e8');
    } else {
      const kk = Math.max(0, Math.min(0.028, (o.z - SH_PZ - 1) / o.vz));
      const p = shP(o.x, o.y, o.z), q = shP(o.x - o.vx * kk, o.y - o.vy * kk, o.z - o.vz * kk), s = p[2];
      seg([q[0], q[1]], [p[0], p[1]], Math.max(0.6, 1.1 * s), `rgba(${game.blade.rgb},0.85)`);
      seg([q[0], q[1]], [p[0], p[1]], Math.max(0.3, 0.4 * s), '#ffffff');
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}

function shDrawParts() {
  const S = SHIP;
  for (const p of S.parts) {
    if (p.z <= SH_NEAR) continue;
    const k = p.t / p.life, q = shP(p.x, p.y, p.z), s = q[2];
    if (p.k === 'deb') {
      ctx.save(); ctx.translate(q[0], q[1]); ctx.rotate(p.rot); ctx.globalAlpha = 1 - k;
      ctx.fillStyle = '#6a6c78'; ctx.fillRect(-p.s * s, -p.s * 0.5 * s, p.s * 2 * s, p.s * s);
      ctx.globalAlpha = 1; ctx.restore();
    } else if (p.k === 'smoke') dot(q[0], q[1], (1 + k * 2) * s, `rgba(60,60,70,${0.4 * (1 - k)})`);
  }
  ctx.globalCompositeOperation = 'lighter';
  for (const p of S.parts) {
    if (p.z <= SH_NEAR) continue;
    const k = p.t / p.life, q = shP(p.x, p.y, p.z), s = q[2];
    if (p.k === 'boom') {
      glow(q[0], q[1], p.r * s * (0.6 + k * 1.6) + 1, '255,150,60', 0.8 * (1 - k));
      if (k < 0.4) glow(q[0], q[1], p.r * 0.7 * s + 1, '255,250,220', 0.9 * (1 - k / 0.4));
    } else if (p.k === 'spark') {
      const e = shP(p.x - p.vx * 0.04, p.y - p.vy * 0.04, p.z - p.vz * 0.04);
      seg([q[0], q[1]], [e[0], e[1]], Math.max(0.4, 0.3 * s), `rgba(${p.rgb},${1 - k})`);
    } else if (p.k === 'trail') {
      dot(q[0], q[1], Math.max(0.3, (0.6 * (1 - k) + 0.2) * s), `rgba(${p.rgb},${0.6 * (1 - k)})`);
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}

// Myśliwiec „Szpon” od tyłu: skrzydła skośne do przodu, działka na końcówkach, dwa silniki
function shDrawFighter(x, y, ang, sc, hit) {
  const fl = 0.75 + Math.random() * 0.25, rgb = game.blade.rgb, up = shUp();
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(sc, sc);
  const w1 = hit ? '#ffffff' : '#a4a8b6', w2 = hit ? '#ffffff' : '#6c7080', b1 = hit ? '#ffffff' : '#c8ccd6';
  // Skrzydła (górna powierzchnia)
  for (const d of [-1, 1]) {
    poly([[d * 3, -2], [d * 23, -1], [d * 26, 3], [d * 4, 4]], d < 0 ? w1 : w2);
    poly([[d * 4, 2.2], [d * 25.5, 2], [d * 26, 3], [d * 4, 4]], '#4a4e5c');
    seg([d * 8, 0.2], [d * 21, 0.6], 0.8, game.blade.col);
    // Działka
    rrect(d * 26 - 1.5, -2, 3, 6, 1, '#5a5e6c');
    seg([d * 26, -2], [d * 26, -5 - (up.gun >= 1 ? 1.5 : 0)], 0.9, '#d0d4dc');
    if (up.gun >= 2) { rrect(d * 17 - 1, -3, 2, 4, 0.8, '#5a5e6c'); seg([d * 17, -3], [d * 17, -5.5], 0.7, '#d0d4dc'); }
  }
  // Kadłub
  poly([[-5, -4], [5, -4], [6.5, 4.5], [-6.5, 4.5]], b1);
  poly([[-6.5, 2], [6.5, 2], [6.5, 4.5], [-6.5, 4.5]], '#8a8e9c');
  poly([[-1.2, -4], [1.2, -4], [0, -11]], '#8a8e9c');
  dot(0, -4.5, 2.6, '#1a2a40');
  dot(-0.8, -5.2, 0.9, 'rgba(180,220,255,0.8)');
  // Torpedy pod kadłubem
  if (up.torp >= 1) { rrect(-8.5, 1, 2, 4, 0.8, '#7a7e8c'); rrect(6.5, 1, 2, 4, 0.8, '#7a7e8c'); }
  // Silniki
  for (const d of [-1, 1]) {
    dot(d * 3.2, 2.8, 2.6, '#2e323e');
    dot(d * 3.2, 2.8, 1.8, '#fff4e0');
  }
  ctx.globalCompositeOperation = 'lighter';
  glow(-3.2, 2.8, 7 * fl, rgb, 0.6); glow(3.2, 2.8, 7 * fl, rgb, 0.6);
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

// Ścigacz od tyłu (gracz albo wróg); gy = y ekranu gruntu pod nim (cień)
function shDrawSpeeder(x, y, ang, sc, enemy, hit, gy) {
  const fl = 0.7 + Math.random() * 0.3, rgb = enemy ? '255,110,60' : game.blade.rgb;
  if (gy !== undefined) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(x, gy, 9 * sc, 2 * sc, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(sc, sc);
  const c1 = hit ? '#ffffff' : enemy ? '#5a5e6a' : '#c8ccd6', c2 = hit ? '#ffffff' : enemy ? '#3a3c46' : '#8a8e9c';
  // Wysięgnik i łopatki sterowe z przodu
  seg([0, -1], [0, -10], 1.3, c2);
  poly([[-4.5, -12], [4.5, -12], [3.5, -9.5], [-3.5, -9.5]], c1);
  // Kadłub
  poly([[-6.5, -1], [6.5, -1], [5.5, 4], [-5.5, 4]], c1);
  poly([[-5.5, 2], [5.5, 2], [5.5, 4], [-5.5, 4]], c2);
  rrect(-3.5, 3, 7, 3, 1, enemy ? '#2a2c34' : '#4a4e5a');
  // Kierowca
  const sk = enemy ? '#2a2830' : '#d8d0c0', hel = enemy ? '#e8e8ec' : '#4a4058';
  poly([[-3, -1], [3, -1], [2.4, -8], [-2.4, -8]], sk);
  seg([-2.4, -7], [-4.6, -2], 1.3, sk); seg([2.4, -7], [4.6, -2], 1.3, sk);
  dot(0, -10, 2.6, hel);
  if (enemy) seg([-1.5, -10], [1.5, -10], 0.8, '#20242c');
  ctx.globalCompositeOperation = 'lighter';
  glow(0, 5, 7 * fl, rgb, 0.55);
  ctx.globalCompositeOperation = 'source-over';
  dot(0, 4.8, 1.2, enemy ? '#ffd0b0' : '#ffffff');
  ctx.restore();
}

function shDrawPlayer() {
  const S = SHIP, jump = S.phase === 'jump' || S.phase === 'won';
  const p = shP(S.px, S.py + S.hopY, SH_PZ);
  let x = p[0], y = p[1], sc = 1;
  if (jump) { const e = Math.min(1, S.jumpT / 1.3); x = lerp(x, SH_CX, e * e); y = lerp(y, SH_CY, e * e); sc = 1 - e * e * 0.95; }
  if (sc < 0.06) return;
  const blink = S.inv > 0.4 && Math.floor(S.inv * 14) % 2 === 0;
  if (blink) return;
  if (S.sp) {
    const g = shP(S.px, SH_GY, SH_PZ);
    shDrawSpeeder(x, y, S.ang * 0.7, 1.6 * sc, false, false, jump ? undefined : g[1]);
  } else {
    shDrawFighter(x, y, S.ang + (S.rollA || 0), 0.85 * sc, false);
    if (jump) { ctx.globalCompositeOperation = 'lighter'; glow(x, y, 30 * sc, game.blade.rgb, 0.4 * (1 - sc)); ctx.globalCompositeOperation = 'source-over'; }
  }
  // Tarcza
  if (S.shHit > 0 || (S.sh > 0 && !jump)) {
    const a = S.shHit > 0 ? S.shHit * 1.8 : 0.1 + Math.sin(S.t * 3) * 0.04;
    ctx.strokeStyle = `rgba(130,200,255,${Math.min(0.7, a)})`; ctx.lineWidth = S.shHit > 0 ? 1.4 : 0.6;
    ctx.beginPath(); ctx.ellipse(x, y - (S.sp ? 3 : 0), (S.sp ? 14 : 27) * sc, (S.sp ? 16 : 11) * sc, S.ang * 0.5, 0, Math.PI * 2); ctx.stroke();
  }
}

// Celownik i namiar
function shDrawReticle() {
  const S = SHIP, rgb = game.blade.rgb;
  if (S.phase !== 'fly' && S.phase !== 'boss') return;
  const c = shP(S.px, S.py + S.hopY, SH_AIM), c2 = shP(S.px, S.py + S.hopY, SH_AIM * 2.2);
  ctx.strokeStyle = `rgba(${rgb},0.75)`; ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.arc(c[0], c[1], 6, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; seg([c[0] + Math.cos(a) * 4, c[1] + Math.sin(a) * 4], [c[0] + Math.cos(a) * 8.5, c[1] + Math.sin(a) * 8.5], 0.7, `rgba(${rgb},0.75)`); }
  ctx.beginPath(); ctx.arc(c2[0], c2[1], 3, 0, Math.PI * 2); ctx.stroke();
  dot(c2[0], c2[1], 0.6, `rgba(${rgb},0.8)`);
  const L = S.lock;
  if (!L) return;
  const T = shTorpOf(shUp().torp), G = shGunOf(shUp().gun), tl = L.d < T.lock && S.torp > 0;
  if (!tl && L.d >= G.assist) return;
  const r = Math.max(5, (L.r + 2) * L.k), col = tl ? 'rgba(255,90,60,0.9)' : `rgba(${rgb},0.8)`, q = r * 0.45;
  ctx.strokeStyle = col; ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    ctx.moveTo(L.sx + sx * r, L.sy + sy * (r - q)); ctx.lineTo(L.sx + sx * r, L.sy + sy * r); ctx.lineTo(L.sx + sx * (r - q), L.sy + sy * r);
  }
  ctx.stroke();
  if (tl) txt('CEL', L.sx, L.sy - r - 4, '#ff7050', 'center', 5, true);
}

function drawShip() {
  const S = SHIP;
  if (!S) return;
  if (S.phase === 'shop') { shDrawShop(); return; }
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, SW, 180); ctx.clip();
  if (game.shake > 0.3) ctx.translate((Math.random() - 0.5) * game.shake * 2, (Math.random() - 0.5) * game.shake * 2);
  if (S.env === 'forest') shDrawForestBG(); else shDrawSpaceBG();
  if (S.trZ !== null) shDrawTrench();
  // Obiekty od najdalszych do najbliższych
  const L = [];
  for (const f of S.foes) if (f.z > SH_NEAR && f.z < SH_ZF + 5) L.push([f.z, 0, f]);
  if (S.boss && S.boss.z < SH_ZF + 5) L.push([S.boss.z, 1, S.boss]);
  for (const o of S.picks) if (o.z > SH_NEAR) L.push([o.z, 2, o]);
  for (const o of S.torps) if (o.z > SH_NEAR) L.push([o.z, 3, o]);
  for (const o of S.bolts) if (o.z > SH_NEAR) L.push([o.z, 4, o]);
  for (const o of S.shots) if (o.z > SH_NEAR) L.push([o.z, 5, o]);
  L.sort((a, b) => b[0] - a[0]);
  let i = 0;
  for (; i < L.length && L[i][0] >= SH_PZ; i++) shDrawItem(L[i]);
  shDrawParts();
  if (!S.dead) shDrawPlayer();
  for (; i < L.length; i++) shDrawItem(L[i]);
  shDrawReticle();
  if (S.env === 'nebula' && S.light > 0.5) { ctx.fillStyle = `rgba(230,210,255,${(S.light - 0.5) * 0.3})`; ctx.fillRect(0, 0, SW, 180); }
  ctx.restore();

  if (S.T < 2 && S.phase === 'fly') {
    const a = Math.min(1, (2 - S.T) * 2);
    txt(S.sp ? 'GAZ DO DECHY!' : 'START!', SW / 2, 60, `rgba(240,192,64,${a})`, 'center', 14);
  }
  if (S.dead && S.deadT > 1) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 70, SW, 34);
    txt(S.sp ? 'ŚCIGACZ ROZBITY' : 'MYŚLIWIEC ZNISZCZONY', SW / 2, 80, '#e04030', 'center', 11);
    txt('R / A – powtórz lot', SW / 2, 94, '#e0d0b0');
  }
  shDrawHUD();
}

function shDrawHUD() {
  const S = SHIP;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 180, SW, 20);
  // Kadłub (serca) i tarcza
  for (let i = 0; i < P.max; i++) tri(4 + i * 9, 182, i < P.hp, '#e82020', '#701010');
  for (let i = 0; i < S.shMax; i++) {
    const on = i < S.sh, part = i === S.sh ? S.shT / shShieldOf(shUp().shield).regen : 0;
    rrect(4 + i * 8, 188.5, 6.5, 2.2, 0.8, on ? '#70c8ff' : '#1c3040');
    if (part > 0) rrect(4 + i * 8, 188.5, 6.5 * part, 2.2, 0.8, '#3a6888');
  }
  // Torpedy
  for (let i = 0; i < Math.max(S.torp, 1); i++) {
    const x = 5 + i * 8, y = 195, on = i < S.torp;
    seg([x, y], [x + 5, y], 1.8, on ? '#c8ccd8' : '#303440');
    if (on) dot(x, y, 1, '#ffa050');
  }
  // Pasek postępu albo pasek bossa
  const b = S.boss, bx0 = 104, bw = 112;
  if (b && !b.dead) {
    const hm = shBossHP(b);
    ctx.fillStyle = '#301010'; ctx.fillRect(bx0, 182, bw, 3);
    ctx.fillStyle = shTurAlive(b) ? '#e05030' : '#ff9040';
    ctx.fillRect(bx0, 182, bw * hm[0] / hm[1], 3);
    txt(b.k === 'frigate' ? 'KLINGA' : 'REAKTOR', bx0 - 4, 183.5, '#e06050', 'right', 5.5, true);
  } else {
    const prog = Math.min(1, S.T / S.Dtot);
    const pc = { cytadela: '#8a60d0', pustynia: '#e09050', ocean: '#40b0d8', krio: '#c0e0ff', verdan: '#70d060', ignis: '#ff6020' };
    ctx.fillStyle = '#1c1c2c'; ctx.fillRect(bx0, 183, bw, 1.5);
    ctx.fillStyle = '#5a5a7a'; ctx.fillRect(bx0, 183, bw * prog, 1.5);
    dot(bx0 - 3, 183.7, 2.2, pc[S.from] || '#888');
    dot(bx0 + bw + 3, 183.7, 2.2, pc[S.to] || '#888');
    poly([[bx0 + bw * prog - 2, 181.7], [bx0 + bw * prog + 2.5, 183.7], [bx0 + bw * prog - 2, 185.7]], game.blade.col);
  }
  const s = msg && msg.t > 0 ? msg.text : shipHint();
  txt(s, SW / 2, 193, msg && msg.t > 0 ? '#f0d890' : '#a0a0b0', 'center', s.length > 44 ? 6 : 7);
  txt('✦ ' + S.kills, SW - 4, 186, '#c0b8d8', 'right', 7);
  if (LV && LV.name) txt((lvl + 1) + '/' + LEVELS.length + '  ' + LV.name, 4, 6, '#a8a0c0', 'left', 7);
}

// ===== Hangar – ekran ulepszeń =====
function shDrawShop() {
  const S = SHIP, t = S.t, up = shUp();
  let g = ctx.createLinearGradient(0, 0, 0, 180);
  g.addColorStop(0, '#0a0c14'); g.addColorStop(1, '#1c1e2a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, SW, 180);
  // Wrota hangaru z widokiem na planetę
  ctx.save();
  ctx.beginPath(); ctx.rect(96, 22, 128, 46); ctx.clip();
  ctx.fillStyle = '#02020a'; ctx.fillRect(96, 22, 128, 46);
  for (let i = 0; i < 40; i++) dot(96 + shHash(i) * 128, 22 + shHash(i + 50) * 46, 0.3 + shHash(i + 9) * 0.4, 'rgba(220,225,255,0.8)');
  if (S.env === 'forest') {
    ctx.fillStyle = '#2c4a2a'; ctx.fillRect(96, 50, 128, 18);
    for (let i = 0; i < 14; i++) { ctx.fillStyle = '#16241a'; ctx.fillRect(98 + i * 9 + shHash(i) * 4, 22, 3, 40); }
  } else shDrawPlanet(S.from, 190, 82, 44);
  ctx.restore();
  ctx.strokeStyle = '#4a4e62'; ctx.lineWidth = 2; ctx.strokeRect(96, 22, 128, 46);
  // Podłoga i sufit w perspektywie
  for (let i = -8; i <= 8; i++) {
    seg([160 + i * 8, 68], [160 + i * 48, 180], 0.5, 'rgba(90,100,130,0.35)');
    seg([160 + i * 8, 22], [160 + i * 48, -40], 0.5, 'rgba(90,100,130,0.2)');
  }
  for (let i = 0; i < 6; i++) { const y = 68 + Math.pow(i / 5, 2) * 112; seg([0, y], [SW, y], 0.5, 'rgba(90,100,130,0.3)'); }
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) { glow(40 + i * 60, 6, 14, '255,220,160', 0.25); }
  glow(160, 96, 46, game.blade.rgb, 0.12);
  ctx.globalCompositeOperation = 'source-over';
  // Maszyna na stanowisku
  ctx.strokeStyle = `rgba(${game.blade.rgb},0.5)`; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(160, 100, 40, 6, 0, 0, Math.PI * 2); ctx.stroke();
  if (S.sp) shDrawSpeeder(160, 84 + Math.sin(t * 2) * 1.5, Math.sin(t * 0.8) * 0.05, 2.4, false, false, 100);
  else shDrawFighter(160, 84 + Math.sin(t * 2) * 1.5, Math.sin(t * 0.8) * 0.06, 1.6, false);

  txt('HANGAR', SW / 2, 8, '#f0c040', 'center', 9);
  txt((lvl + 1) + '/' + LEVELS.length + '  ' + LV.name, SW / 2, 17, '#c8c0e0', 'center', 6.5);
  txt('◆ ' + game.crys, SW - 6, 8, '#f0c040', 'right', 8);
  txt('punkty umiejętności: ' + skPts(), SW - 6, 17, '#9090b0', 'right', 5.5);
  txt('Kadłub: ' + P.hp + '/' + P.max, 6, 8, '#e07060', 'left', 6.5);
  txt(S.sp ? 'Ścigacz' : 'Myśliwiec „Szpon”', 6, 17, '#9090b0', 'left', 5.5);
  if (S.smsgT > 0) txt(S.smsg, SW / 2, 108, '#f0d890', 'center', 6.5);

  const n = SH_UPS.length + 1, W = 74, G = 4, x0 = (SW - (n * W + (n - 1) * G)) / 2, y = 114, h = 62;
  for (let i = 0; i < n; i++) {
    const x = x0 + i * (W + G), sel = i === S.sel;
    rrect(x, y, W, h, 3, sel ? 'rgba(40,44,72,0.95)' : 'rgba(16,18,30,0.9)');
    ctx.strokeStyle = sel ? game.blade.col : '#3a3e52'; ctx.lineWidth = sel ? 1.2 : 0.6;
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, W, h, 3); else ctx.rect(x, y, W, h); ctx.stroke();
    const cx = x + W / 2;
    if (i < SH_UPS.length) {
      const u = SH_UPS[i], l = up[u.id];
      txt(u.name, cx, y + 8, sel ? '#f0d890' : '#c8c0e0', 'center', 7.5);
      for (let j = 0; j < 3; j++) rrect(cx - 16 + j * 11, y + 14, 9, 3.2, 1, j < l ? game.blade.col : '#30344a');
      txt(u.d[0], cx, y + 25, '#a8a8c0', 'center', 5.2);
      txt(u.d[1], cx, y + 32, '#a8a8c0', 'center', 5.2);
      txt(u.st(l), cx, y + 41, '#90d0ff', 'center', 4.8);
      if (l < 3) {
        const c = SH_COST[l], ok = game.crys >= c && Math.floor((game.crys - c) / 10) >= game.spent;
        txt('→ ' + u.st(l + 1), cx, y + 48, '#70a070', 'center', 4.5);
        txt('Koszt: ' + c + ' ◆', cx, y + 56, ok ? '#f0c040' : '#806050', 'center', 6);
      } else txt('MAKS', cx, y + 54, '#80ff90', 'center', 7);
    } else {
      txt('START', cx, y + 22, sel ? '#80ff90' : '#60c070', 'center', 11);
      txt('S / Enter', cx, y + 38, '#a8a8c0', 'center', 6);
      txt(S.sp ? 'Rozpocznij pościg' : 'Rozpocznij lot', cx, y + 47, '#a8a8c0', 'center', 5.5);
    }
  }
  ctx.fillStyle = '#000'; ctx.fillRect(0, 180, SW, 20);
  txt(shipHint(), SW / 2, 190, '#a0a0b0', 'center', 7);
}

function shipHint() {
  const S = SHIP;
  if (!S) return '';
  if (S.phase === 'shop') return '←→ wybór · A kup ulepszenie · S / Enter – start';
  if (S.dead) return 'R lub A – powtórz ' + (S.sp ? 'pościg' : 'lot');
  if (S.phase === 'jump' || S.phase === 'won') return '';
  const b = S.boss;
  if (b && !b.dead) return shTurAlive(b) ? (b.k === 'frigate' ? 'Zestrzel wieżyczki' : 'Zniszcz emitery osłony') + ' · Z torpeda (' + S.torp + ') · X beczka' : 'Rdzeń odsłonięty – ognia! · Z torpeda (' + S.torp + ')';
  if (S.sp) return '←→ ster · ↑↓ wysokość · A działko · Z rakieta (' + S.torp + ') · X skok';
  return '←→↑↓ lot · A działa · Z torpeda (' + S.torp + ') · X beczka';
}
