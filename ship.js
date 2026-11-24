'use strict';
// ===== Lot kosmiczny – boczna strzelanka myśliwcem „Szpon” =====
// Wywoływane z game.js: startShip() w loadLevel(), updShip(dt) w update(), drawShip() w draw().
// Konfiguracja poziomu: LV.ship = { diff: 0|1, from: 'cytadela'|'pustynia', to: 'pustynia'|'ocean' }.

let SHIP = null;

// Statystyki wrogów
const SH_FOE = {
  eye: { hp: 2, r: 8, name: 'Sowa' },
  dart: { hp: 3, r: 8, name: 'Grot' },
  bomber: { hp: 6, r: 14, name: 'Taran' },
  rock: { hp: 4, r: 9, name: 'asteroida' },
};
const SH_MAXP = 300;                    // limit cząsteczek

// Deterministyczny „szum” (wygląd planet, kształty skał)
const shHash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// ===== Start poziomu =====
function startShip() {
  const cfg = LV.ship || {}, diff = cfg.diff ? 1 : 0;
  SHIP = {
    diff, from: cfg.from || 'cytadela', to: cfg.to || 'pustynia',
    D: diff ? 80 : 64,                  // czas lotu do pojawienia się krążownika [s]
    t: 0, x: 60, y: 90, vx: 0, vy: 0,
    hp: 6, max: 6, inv: 0, roll: 0, rollCd: 0, fireCd: 0, side: 0, torp: 3,
    shots: [], torps: [], bolts: [], foes: [], parts: [], picks: [], junk: [],
    queue: [], waves: shBuildWaves(diff), wi: 0,
    boss: null, phase: 'fly', jumpT: 0, done: false,
    dead: false, deadT: 0, kills: 0, sndCd: 0, junkT: 3,
    stars: [],
  };
  const sp = [6, 16, 38];
  for (let l = 0; l < 3; l++)
    for (let i = 0; i < 26 + l * 6; i++)
      SHIP.stars.push({ x: Math.random() * SW, y: Math.random() * 180, l, v: sp[l] * (0.8 + Math.random() * 0.4) });
  say(diff ? 'Blokada orbitalna – przebij się przez flotę!' : 'Ucieczka z orbity – zgub pościg!', 3);
}

// Scenariusz fal: lista wzorców rozłożonych w czasie
function shBuildWaves(diff) {
  const W = [], D = diff ? 80 : 64;
  const pats = diff
    ? ['eye', 'dart', 'rock', 'eye', 'bomber', 'dart', 'eye', 'rock', 'dart', 'bomber', 'eye', 'dart']
    : ['eye', 'rock', 'eye', 'dart', 'eye', 'rock', 'bomber', 'dart', 'eye', 'rock'];
  let t = 2.5, i = 0;
  while (t < D - 3) {
    W.push({ t, p: pats[i % pats.length], i });
    t += diff ? 3.1 : 3.7;
    i++;
  }
  return W;
}

// Dodaje wrogów wzorca do kolejki (z opóźnieniami)
function shPattern(w) {
  const S = SHIP, q = S.queue, d = S.diff, t = S.t;
  const y0 = 30 + Math.random() * 120;
  if (w.p === 'eye') {
    const n = 3 + d, ph = Math.random() * 6;
    for (let i = 0; i < n; i++) q.push({ at: t + i * 0.45, k: 'eye', y: y0, ph: ph + i * 0.6 });
  } else if (w.p === 'dart') {
    const n = 2 + d;
    for (let i = 0; i < n; i++) q.push({ at: t + i * 0.9, k: 'dart', y: 20 + Math.random() * 140 });
  } else if (w.p === 'bomber') {
    q.push({ at: t, k: 'bomber', y: 50 + Math.random() * 80 });
    if (d) for (let i = 0; i < 2; i++) q.push({ at: t + 1 + i * 0.5, k: 'eye', y: 20 + i * 140, ph: i * 3 });
  } else if (w.p === 'rock') {
    const n = 3 + d * 2;
    for (let i = 0; i < n; i++) q.push({ at: t + i * 0.7, k: 'rock', y: 15 + Math.random() * 150 });
  }
}

function shSpawn(k, y, o) {
  const st = SH_FOE[k], f = {
    k, x: SW + 20, y, by: y, ty: y, hp: st.hp, max: st.hp, r: st.r, t: 0, hitT: 0,
    cd: 1 + Math.random() * 2, ph: (o && o.ph) || 0, st: 'in', vx: 0, vy: 0, rot: 0, vr: 0, shots: 0,
  };
  if (k === 'eye') f.cd = 1.5 + Math.random() * 2.5;
  if (k === 'dart') { f.tx = 200 + Math.random() * 60; f.cd = 0.9; }
  if (k === 'bomber') { f.cd = 1.8; f.x = SW + 26; }
  if (k === 'rock') {
    f.r = 7 + Math.random() * 4; f.vx = -(40 + Math.random() * 35); f.vy = (Math.random() - 0.5) * 16;
    f.vr = (Math.random() - 0.5) * 3; f.seed = Math.random() * 100;
  }
  if (o) Object.assign(f, o);
  SHIP.foes.push(f);
  return f;
}

// ===== Efekty =====
function shPart(p) { if (SHIP.parts.length < SH_MAXP) SHIP.parts.push(p); }
function shSparks(x, y, n, rgb, sp) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = (0.3 + Math.random()) * (sp || 80);
    shPart({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: 0.25 + Math.random() * 0.35, rgb: rgb || '255,200,120' });
  }
}
function shExplode(x, y, size, quiet) {
  const S = SHIP;
  shPart({ k: 'boom', x, y, vx: 0, vy: 0, t: 0, life: 0.45 + size * 0.02, r: size });
  shSparks(x, y, Math.min(24, 6 + size), '255,190,110', 50 + size * 6);
  for (let i = 0; i < Math.min(8, 2 + size / 3); i++) {
    const a = Math.random() * Math.PI * 2, v = 15 + Math.random() * 45;
    shPart({ k: 'deb', x, y, vx: Math.cos(a) * v - 10, vy: Math.sin(a) * v, t: 0, life: 0.8 + Math.random() * 0.7,
      rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12, s: 1 + Math.random() * 1.8 });
  }
  if (!quiet && S.sndCd <= 0) { SND.crash(); S.sndCd = 0.08; }
  shake(Math.min(5, 1 + size / 5));
}

// ===== Trafienie gracza =====
function shHurt(n) {
  const S = SHIP;
  if (S.dead || S.inv > 0 || S.roll > 0 || S.phase === 'jump' || S.phase === 'won') return false;
  S.hp = Math.max(0, S.hp - (n || 1));
  S.inv = 1;
  shake(4); flash = { col: '#ff2020', t: 0.12 };
  shSparks(S.x, S.y, 12, '255,170,90', 90);
  SND.hit();
  if (S.hp <= 0) {
    S.dead = true; S.deadT = 0;
    shExplode(S.x, S.y, 16); shExplode(S.x + 6, S.y - 4, 10, true);
    SND.die();
    say('Statek zniszczony…', 3);
  }
  return true;
}

// ===== Krążownik (boss) =====
function shStartBoss() {
  const S = SHIP, d = S.diff, th = d ? 9 : 8;
  const tur = [
    { dx: 45, top: true }, { dx: 115, top: true }, { dx: 70, top: false },
  ];
  if (d) tur.push({ dx: 140, top: false });
  for (const u of tur) { u.hp = th; u.max = th; u.cd = 1.5 + Math.random() * 1.5; u.hitT = 0; u.ang = Math.PI; }
  S.boss = {
    x: SW + 30, cy: 92, t: 0, tur, core: { hp: d ? 24 : 20, max: d ? 24 : 20, hitT: 0, cd: 2 },
    hangCd: 4, dead: false, dieT: 0, boomT: 0,
  };
  S.phase = 'boss';
  SND.alarm();
  say('Krążownik Klinga! Zniszcz wieżyczki, potem rdzeń reaktora.', 4);
}
// Geometria kadłuba (klin z rozwidlonym dziobem; rdzeń reaktora w wycięciu)
function shHull(b) {
  const x = b.x, y = b.cy + Math.sin(b.t * 0.6) * 3;
  return {
    y, pts: [[x, y - 16], [x + 170, y - 64], [x + 170, y + 60], [x + 4, y + 16], [x + 70, y]],
    core: [x + 60, y], hang: [x + 100, y + 16 + 44 * (96 / 166)],
  };
}
function shTurPos(b, u, H) {
  const dx = u.dx;
  if (u.top) return [b.x + dx, H.y - 16 - 48 * (dx / 170) - 3];
  return [b.x + dx, H.y + 16 + 44 * ((dx - 4) / 166) + 3];
}
function shInPoly(px, py, pts) {
  let ins = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], c = pts[j];
    if ((a[1] > py) !== (c[1] > py) && px < (c[0] - a[0]) * (py - a[1]) / (c[1] - a[1]) + a[0]) ins = !ins;
  }
  return ins;
}
const shTurAlive = b => b.tur.some(u => u.hp > 0);
function shBossHP(b) {
  let h = b.core.hp, m = b.core.max;
  for (const u of b.tur) { h += Math.max(0, u.hp); m += u.max; }
  return [h, m];
}

// Strzał wroga (czerwony)
function shBolt(x, y, vx, vy) {
  const k = SHIP.diff ? 1.2 : 1;
  SHIP.bolts.push({ x, y, vx: vx * k, vy: vy * k, t: 0 });
}
function shAimed(x, y, sp) {
  const S = SHIP, a = Math.atan2(S.y - y, S.x - x);
  shBolt(x, y, Math.cos(a) * sp, Math.sin(a) * sp);
}

// Obrażenia dla części bossa / wroga
function shDamageFoe(f, n) {
  f.hp -= n; f.hitT = 0.08;
  if (f.hp <= 0 && !f.gone) {
    f.gone = true; SHIP.kills++;
    shExplode(f.x, f.y, f.k === 'bomber' ? 16 : f.k === 'rock' ? 10 : 9);
    if (f.k === 'bomber') SHIP.picks.push({ x: f.x, y: f.y, t: 0 });
  }
}
function shDamageBoss(part, n, x, y) {
  const b = SHIP.boss;
  part.hp -= n; part.hitT = 0.08;
  shSparks(x, y, 3, '255,210,140', 50);
  if (part.hp <= 0) {
    part.hp = 0;
    if (part === b.core) {
      b.dead = true; b.dieT = 0; SHIP.kills++;
      shExplode(x, y, 22);
      flash = { col: '#ffffff', t: 0.3 };
    } else {
      shExplode(x, y, 12);
      if (!shTurAlive(b)) { say('Wieżyczki zniszczone – rdzeń odsłonięty!', 3); SND.zap(); }
    }
  }
}

// ===== Aktualizacja =====
function updShip(dt) {
  const S = SHIP;
  if (!S) return;
  S.t += dt;
  S.sndCd -= dt;
  const jump = S.phase === 'jump' || S.phase === 'won';

  // Gwiazdy i odłamki tła
  const sm = jump ? 1 + Math.min(1, S.jumpT / 0.6) * 40 : 1;
  for (const s of S.stars) {
    s.x -= s.v * sm * dt;
    if (s.x < -60) { s.x = SW + Math.random() * 20; s.y = Math.random() * 180; }
  }
  S.junkT -= dt;
  if (S.junkT <= 0 && !jump) {
    S.junkT = 5 + Math.random() * 6;
    S.junk.push({ x: SW + 10, y: 10 + Math.random() * 160, v: 10 + Math.random() * 12, rot: 0, vr: (Math.random() - 0.5) * 1.5, s: 2 + Math.random() * 3, seed: Math.random() * 50 });
  }
  for (const j of S.junk) { j.x -= j.v * sm * dt; j.rot += j.vr * dt; }
  S.junk = S.junk.filter(j => j.x > -20);

  // Cząsteczki
  for (const p of S.parts) {
    p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.k === 'spark') { p.vx *= 0.94; p.vy *= 0.94; }
    if (p.k === 'deb') { p.rot += p.vr * dt; p.vx *= 0.99; }
    if (p.k === 'trail') { p.vx *= 0.9; p.vy *= 0.9; }
  }
  S.parts = S.parts.filter(p => p.t < p.life);

  // Martwy pilot – czekamy na powtórkę
  if (S.dead) {
    S.deadT += dt;
    for (const b of S.bolts) { b.x += b.vx * dt; b.y += b.vy * dt; }
    shUpdFoes(dt, true);
    if (S.deadT > 1.5 && PR.act) restart();
    return;
  }

  // Skok nadprzestrzenny
  if (jump) {
    S.jumpT += dt;
    S.bolts = [];
    S.x += (S.jumpT > 0.9 ? 600 : 20) * dt;
    if (S.x < SW + 40 && S.parts.length < SH_MAXP)
      shPart({ k: 'trail', x: S.x - 13, y: S.y + (Math.random() - 0.5) * 4, vx: -260, vy: 0, t: 0, life: 0.25, rgb: game.blade.rgb });
    if (S.jumpT >= 1.5 && !S.done) { S.done = true; S.phase = 'won'; finishLevel(); }
    return;
  }

  // Sterowanie
  const tx = ((K.right ? 1 : 0) - (K.left ? 1 : 0)) * 110, ty = ((K.down ? 1 : 0) - (K.up ? 1 : 0)) * 110;
  const ek = Math.min(1, dt * 10);
  S.vx = lerp(S.vx, tx, ek); S.vy = lerp(S.vy, ty, ek);
  S.x += S.vx * dt; S.y += S.vy * dt;
  const xMax = S.boss ? Math.min(280, S.boss.x - 6) : 296;
  S.x = Math.max(14, Math.min(xMax, S.x));
  S.y = Math.max(8, Math.min(172, S.y));
  if (S.inv > 0) S.inv -= dt;
  if (S.roll > 0) S.roll = Math.max(0, S.roll - dt);
  if (S.rollCd > 0) S.rollCd -= dt;
  if (PR.push && S.rollCd <= 0) { S.roll = 0.45; S.rollCd = 1.45; tone(300, 0.25, 'sawtooth', 0.03, 900); }

  // Lasery (na zmianę z górnego i dolnego skrzydła)
  S.fireCd -= dt;
  if (K.act && S.fireCd <= 0) {
    S.fireCd = 0.125;
    S.side ^= 1;
    const oy = S.side ? -5.5 : 5.5;
    S.shots.push({ x: S.x + 6, y: S.y + oy, vx: 320 });
    shPart({ k: 'spark', x: S.x + 8, y: S.y + oy, vx: 30, vy: 0, t: 0, life: 0.06, rgb: game.blade.rgb });
    tone(1900, 0.05, 'square', 0.012, 900);
  }
  // Torpeda samonaprowadzająca
  if (PR.pull) {
    if (S.torp > 0) {
      S.torp--;
      S.torps.push({ x: S.x + 6, y: S.y + 3, a: 0, v: 90, t: 0 });
      tone(700, 0.45, 'triangle', 0.06, 120);
    } else say('Brak torped!', 1);
  }

  // Fale wrogów
  while (S.wi < S.waves.length && S.waves[S.wi].t <= S.t) shPattern(S.waves[S.wi++]);
  for (let i = S.queue.length - 1; i >= 0; i--) {
    const q = S.queue[i];
    if (q.at <= S.t) { S.queue.splice(i, 1); shSpawn(q.k, q.y, q.ph !== undefined ? { ph: q.ph } : null); }
  }
  if (S.phase === 'fly' && S.t >= S.D && (S.foes.length === 0 || S.t >= S.D + 6) && !S.queue.length) shStartBoss();

  shUpdFoes(dt, false);
  if (S.boss) shUpdBoss(dt);

  // Pociski gracza
  for (const s of S.shots) {
    s.x += s.vx * dt;
    if (s.x > SW + 10) { s.dead = true; continue; }
    for (const f of S.foes) {
      if (f.gone) continue;
      if (Math.abs(f.x - s.x) < f.r + 3 && Math.abs(f.y - s.y) < f.r) {
        shDamageFoe(f, 1); s.dead = true;
        shSparks(s.x, s.y, 2, game.blade.rgb, 40);
        break;
      }
    }
    if (!s.dead && S.boss && !S.boss.dead) shShotBoss(s, 1);
  }
  S.shots = S.shots.filter(s => !s.dead);

  // Torpedy
  for (const o of S.torps) {
    o.t += dt; o.v = Math.min(190, o.v + 260 * dt);
    const tg = shTorpTarget(o);
    if (tg) {
      let da = Math.atan2(tg[1] - o.y, tg[0] - o.x) - o.a;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      o.a += Math.max(-4 * dt, Math.min(4 * dt, da));
    }
    o.x += Math.cos(o.a) * o.v * dt; o.y += Math.sin(o.a) * o.v * dt;
    if (Math.random() < 0.7) shPart({ k: 'trail', x: o.x - Math.cos(o.a) * 4, y: o.y - Math.sin(o.a) * 4, vx: 0, vy: 0, t: 0, life: 0.35, rgb: '255,170,90' });
    if (o.t > 3.5 || o.x > SW + 20 || o.x < -20 || o.y < -20 || o.y > 200) { o.dead = true; continue; }
    for (const f of S.foes) {
      if (!f.gone && Math.hypot(f.x - o.x, f.y - o.y) < f.r + 4) { shDamageFoe(f, 6); o.dead = true; shExplode(o.x, o.y, 8, true); break; }
    }
    if (!o.dead && S.boss && !S.boss.dead) shShotBoss(o, 6, true);
  }
  S.torps = S.torps.filter(o => !o.dead);

  // Strzały wrogów
  for (const b of S.bolts) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.t += dt;
    if (b.x < -10 || b.x > SW + 30 || b.y < -10 || b.y > 190) { b.dead = true; continue; }
    if (Math.abs(b.x - S.x) < 10 && Math.abs(b.y - S.y) < 4.5) {
      if (S.roll > 0) continue;               // beczka – strzał przelatuje
      if (shHurt(1)) b.dead = true;
      if (S.dead) return;
    }
  }
  S.bolts = S.bolts.filter(b => !b.dead);

  // Zderzenia z wrogami
  for (const f of S.foes) {
    if (f.gone) continue;
    if (Math.abs(f.x - S.x) < f.r + 8 && Math.abs(f.y - S.y) < f.r + 3) {
      if (shHurt(1)) shDamageFoe(f, 3);
      if (S.dead) return;
    }
  }
  // Naprawa kadłuba
  for (const p of S.picks) {
    p.t += dt; p.x -= 28 * dt; p.y += Math.sin(p.t * 3) * 6 * dt;
    if (Math.hypot(p.x - S.x, p.y - S.y) < 13) {
      p.dead = true;
      if (S.hp < S.max) S.hp++;
      SND.drink(); say('Naprawa kadłuba +1', 1.5);
    }
    if (p.x < -10) p.dead = true;
  }
  S.picks = S.picks.filter(p => !p.dead);
}

function shTorpTarget(o) {
  const S = SHIP;
  let best = null, bd = 1e9;
  for (const f of S.foes) {
    if (f.gone || f.x > SW + 5) continue;
    const d = Math.hypot(f.x - o.x, f.y - o.y) + (f.x < o.x ? 120 : 0);
    if (d < bd) { bd = d; best = [f.x, f.y]; }
  }
  const b = S.boss;
  if (b && !b.dead) {
    const H = shHull(b);
    if (shTurAlive(b)) {
      for (const u of b.tur) if (u.hp > 0) {
        const p = shTurPos(b, u, H), d = Math.hypot(p[0] - o.x, p[1] - o.y) * 0.8;
        if (d < bd) { bd = d; best = p; }
      }
    } else { const d = Math.hypot(H.core[0] - o.x, H.core[1] - o.y) * 0.7; if (d < bd) { bd = d; best = H.core; } }
  }
  return best;
}

// Trafienie bossa pociskiem gracza (s.x, s.y); zwraca true, jeśli pocisk został zatrzymany
function shShotBoss(s, dmg, torp) {
  const b = SHIP.boss, H = shHull(b);
  for (const u of b.tur) {
    if (u.hp <= 0) continue;
    const p = shTurPos(b, u, H);
    if (Math.hypot(p[0] - s.x, p[1] - s.y) < (torp ? 9 : 7)) {
      shDamageBoss(u, dmg, s.x, s.y); s.dead = true;
      if (torp) shExplode(s.x, s.y, 8, true);
      return true;
    }
  }
  if (Math.hypot(H.core[0] - s.x, H.core[1] - s.y) < 10) {
    s.dead = true;
    if (shTurAlive(b)) { shSparks(s.x, s.y, 3, '120,220,255', 60); if (torp) shExplode(s.x, s.y, 6, true); }
    else { shDamageBoss(b.core, dmg, s.x, s.y); if (torp) shExplode(s.x, s.y, 8, true); }
    return true;
  }
  if (shInPoly(s.x, s.y, H.pts)) {
    s.dead = true;
    shSparks(s.x, s.y, torp ? 10 : 2, '255,220,160', 40);
    if (torp) shExplode(s.x, s.y, 7, true);
    return true;
  }
  return false;
}

function shUpdFoes(dt, idle) {
  const S = SHIP, d = S.diff;
  for (const f of S.foes) {
    if (f.gone) continue;
    f.t += dt; if (f.hitT > 0) f.hitT -= dt;
    f.cd -= dt;
    const onScr = f.x < SW - 6 && f.x > 10;
    if (f.k === 'eye') {
      f.x -= (55 + d * 12) * dt;
      f.by = lerp(f.by, f.ty, Math.min(1, dt * 1.5));
      f.y = f.by + Math.sin(f.t * 2.2 + f.ph) * 22;
      if (f.cd <= 0 && onScr && !idle) {
        f.cd = (d ? 2.2 : 2.6) + Math.random() * 2;
        shBolt(f.x - 6, f.y, -80, (S.y - f.y) * 0.15);
      }
    } else if (f.k === 'dart') {
      if (f.st === 'in') {
        f.x = lerp(f.x, f.tx, Math.min(1, dt * 2.5));
        if (f.x - f.tx < 4) { f.st = 'aim'; f.cd = 0.7; }
      } else if (f.st === 'aim') {
        f.y = lerp(f.y, idle ? f.y : S.y, Math.min(1, dt * (1.6 + d * 0.6)));
        if (f.cd <= 0 && !idle) {
          f.cd = 0.9; f.shots++;
          shBolt(f.x - 10, f.y - 3, -150, 0); shBolt(f.x - 10, f.y + 3, -150, 0);
          tone(900, 0.07, 'square', 0.015, 300);
          if (f.shots >= 2 + d) { f.st = 'go'; f.vx = -60; }
        }
      } else {
        f.vx -= 260 * dt; f.x += f.vx * dt;
      }
    } else if (f.k === 'bomber') {
      f.x -= (f.x > 250 ? 45 : 12) * dt;
      f.y = f.by + Math.sin(f.t * 0.8) * 14;
      if (f.cd <= 0 && onScr && !idle) {
        f.cd = d ? 1.7 : 2.3;
        for (let i = -1; i <= 1; i++) shBolt(f.x - 14, f.y, -85 * Math.cos(i * 0.32), 85 * Math.sin(i * 0.32));
      }
    } else if (f.k === 'rock') {
      f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt;
      if (f.y < 8 || f.y > 172) f.vy = -f.vy;
    }
    if (f.x < -30) f.gone = true;
  }
  S.foes = S.foes.filter(f => !f.gone);
}

function shUpdBoss(dt) {
  const S = SHIP, b = S.boss, d = S.diff;
  b.t += dt;
  for (const u of b.tur) if (u.hitT > 0) u.hitT -= dt;
  if (b.core.hitT > 0) b.core.hitT -= dt;
  if (b.x > 150.5) b.x = lerp(b.x, 150, Math.min(1, dt * 0.9));
  const H = shHull(b), arrived = b.x < 175;

  if (b.dead) {
    b.dieT += dt; b.boomT -= dt;
    S.bolts = [];
    if (b.boomT <= 0) {
      b.boomT = 0.12;
      shExplode(b.x + 20 + Math.random() * 150, H.y + (Math.random() - 0.5) * 90, 8 + Math.random() * 10, Math.random() < 0.5);
    }
    if (b.dieT > 2.6 && S.phase === 'boss') {
      S.phase = 'jump'; S.jumpT = 0;
      for (let i = 0; i < 6; i++) shExplode(b.x + 30 + i * 25, H.y + (Math.random() - 0.5) * 60, 18, i > 0);
      flash = { col: '#ffffff', t: 0.35 };
      S.boss = null; S.foes = []; S.bolts = [];
      SND.win();
      say('Skok nadprzestrzenny!', 2);
    }
    return;
  }
  if (!arrived) return;

  // Wieżyczki – celowane strzały
  for (const u of b.tur) {
    if (u.hp <= 0) continue;
    const p = shTurPos(b, u, H);
    u.ang = Math.atan2(S.y - p[1], S.x - p[0]);
    u.cd -= dt;
    if (u.cd <= 0) {
      u.cd = (d ? 1.6 : 2.2) + Math.random() * 0.8;
      shAimed(p[0] + Math.cos(u.ang) * 6, p[1] + Math.sin(u.ang) * 6, 85);
    }
  }
  // Hangar wypuszcza Sowy
  b.hangCd -= dt;
  if (b.hangCd <= 0) {
    b.hangCd = d ? 5 : 7;
    if (S.foes.filter(f => f.k === 'eye').length < 3 + d) {
      shSpawn('eye', H.hang[1], { x: H.hang[0] - 4, by: H.hang[1], ty: 20 + Math.random() * 140, ph: Math.random() * 6 });
      tone(200, 0.3, 'sawtooth', 0.03, 500);
    }
  }
  // Odsłonięty rdzeń – wachlarz strzałów
  if (!shTurAlive(b)) {
    b.core.cd -= dt;
    if (b.core.cd <= 0) {
      b.core.cd = d ? 2.0 : 2.6;
      const n = 5;
      for (let i = 0; i < n; i++) {
        const a = Math.PI + (i - (n - 1) / 2) * 0.28;
        shBolt(H.core[0] - 10, H.core[1], Math.cos(a) * 75, Math.sin(a) * 75);
      }
      SND.zap();
    }
  }
  // Zderzenie z kadłubem
  if (shInPoly(S.x + 10, S.y, H.pts) || shInPoly(S.x, S.y - 4, H.pts) || shInPoly(S.x, S.y + 4, H.pts)) {
    shHurt(1);
    S.x -= 12; S.vx = -60;
  }
}

// ===== Rysowanie =====
function shDrawPlanet(kind, cx, cy, r) {
  if (cx + r * 1.3 < 0 || cx - r * 1.3 > SW || r < 1) return;
  const pal = {
    cytadela: { base: ['#6a4c9c', '#2a1840', '#0c0614'], atm: '170,120,255' },
    pustynia: { base: ['#f0b870', '#c06a30', '#401a08'], atm: '255,180,110' },
    ocean: { base: ['#4ac0d8', '#14608c', '#04162c'], atm: '110,200,255' },
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

function shDrawBG() {
  const S = SHIP, jump = S.phase === 'jump' || S.phase === 'won';
  const g = ctx.createLinearGradient(0, 0, 0, 180);
  g.addColorStop(0, '#04030c'); g.addColorStop(1, '#0a0618');
  ctx.fillStyle = g; ctx.fillRect(0, 0, SW, 180);
  // Mgławica
  ctx.globalCompositeOperation = 'lighter';
  const neb = [[60, 50, 90, '120,60,160', 0.16], [200, 130, 110, '40,90,170', 0.14], [330, 60, 80, '160,50,110', 0.12], [420, 140, 90, '60,120,160', 0.12]];
  for (const n of neb) {
    const x = ((n[0] - S.t * 3) % 520 + 520) % 520 - 100;
    glow(x, n[1], n[2], n[3], n[4]);
  }
  ctx.globalCompositeOperation = 'source-over';
  // Planety: źródłowa ucieka w lewo, docelowa rośnie po prawej
  const prog = Math.min(1, S.t / S.D);
  const ft = Math.min(S.t, 40);
  shDrawPlanet(S.from, 40 - ft * 5.5, 110 + ft * 0.6, Math.max(10, 80 - ft * 1.2));
  shDrawPlanet(S.to, SW + 30 - ease(prog) * 90, 92, 14 + ease(prog) * 70);
  // Gwiazdy (3 warstwy)
  const sm = jump ? Math.min(1, S.jumpT / 0.6) : 0;
  for (const s of S.stars) {
    const a = [0.45, 0.7, 1][s.l], c = s.l === 2 ? `rgba(255,255,255,${a})` : s.l ? `rgba(200,215,255,${a})` : `rgba(170,170,220,${a})`;
    if (sm > 0) seg([s.x, s.y], [s.x + 2 + sm * (30 + s.l * 40), s.y], 0.5 + s.l * 0.3, c);
    else dot(s.x, s.y, 0.35 + s.l * 0.3, c);
  }
  // Odległe szczątki
  for (const j of S.junk) {
    ctx.save(); ctx.translate(j.x, j.y); ctx.rotate(j.rot);
    poly([[-j.s, -j.s * 0.4], [j.s * 0.6, -j.s * 0.7], [j.s, j.s * 0.3], [-j.s * 0.3, j.s * 0.6]], '#3a3c4c');
    seg([-j.s * 0.5, 0], [j.s * 0.5, -j.s * 0.2], 0.4, '#5a5e72');
    ctx.restore();
  }
}

// Myśliwiec „Szpon” (bok, dziób w prawo)
function shDrawSzpon(x, y, sy, roll) {
  const fl = 0.75 + Math.random() * 0.25;
  ctx.save(); ctx.translate(x, y); ctx.scale(1, sy);
  // Płomień silników
  ctx.globalCompositeOperation = 'lighter';
  glow(-14, -2, 9 * fl, game.blade.rgb, 0.45);
  glow(-14, 2, 9 * fl, game.blade.rgb, 0.45);
  seg([-13, -2], [-17 - fl * 4, -2], 1.6, `rgba(${game.blade.rgb},0.8)`);
  seg([-13, 2], [-17 - fl * 4, 2], 1.6, `rgba(${game.blade.rgb},0.8)`);
  ctx.globalCompositeOperation = 'source-over';
  const back = roll ? '#6a6e7c' : '#8c909e';
  // Tylne skrzydła (dalsza para – ciemniejsza)
  poly([[-9, -1], [-1, -1], [-4, -6], [-10, -6]], '#4c505e');
  poly([[-9, 1], [-1, 1], [-4, 6], [-10, 6]], '#3c404c');
  // Kadłub
  poly([[-13, -3], [4, -3], [13, 0], [4, 3], [-13, 3]], '#c8ccd6');
  poly([[-13, 0.5], [13, 0], [4, 3], [-13, 3]], '#8a8e9c');
  seg([-11, -0.6], [8, -0.4], 0.7, game.blade.col);
  // Silniki
  rrect(-14, -3.4, 5, 2.6, 0.8, '#5a5e6c');
  rrect(-14, 0.8, 5, 2.6, 0.8, '#4a4e5a');
  dot(-14, -2.1, 1.1, '#fff8e0'); dot(-14, 2.1, 1.1, '#fff8e0');
  // Przednie skrzydła (rozłożone jak litera X z boku)
  poly([[-8, -2], [0, -2], [-3, -8], [-9, -8]], back);
  poly([[-8, -2], [0, -2], [-2, -4], [-8, -4]], '#b4b8c4');
  poly([[-8, 2], [0, 2], [-3, 8], [-9, 8]], '#6a6e7a');
  // Działka na końcach skrzydeł
  seg([-9, -8], [5, -8], 0.9, '#d0d4dc');
  seg([-9, 8], [5, 8], 0.9, '#9a9eaa');
  dot(5.4, -8, 0.6, '#ff8060'); dot(5.4, 8, 0.6, '#ff8060');
  // Kabina
  poly([[0, -3], [5, -3], [8, -1.2], [1, -1.2]], '#1a2a40');
  seg([2, -2.6], [5, -2.6], 0.5, 'rgba(180,220,255,0.8)');
  ctx.restore();
}

function shDrawFoe(f) {
  const x = f.x, y = f.y, hit = f.hitT > 0;
  if (f.k === 'eye') {
    // Sowa – kula kokpitu przed wysokim sześciokątnym panelem
    const pc = hit ? '#ffffff' : '#3c4252';
    poly([[x - 1, y - 11], [x + 5, y - 11], [x + 8, y], [x + 5, y + 11], [x - 1, y + 11], [x - 4, y]], pc);
    if (!hit) {
      poly([[x, y - 9], [x + 4, y - 9], [x + 6, y], [x + 4, y + 9], [x, y + 9], [x - 2, y]], '#2a2e3a');
      for (let i = -2; i <= 2; i++) seg([x - 1.5 + Math.abs(i) * 0.6, y + i * 3.6], [x + 5.5 - Math.abs(i) * 0.6, y + i * 3.6], 0.4, '#555c70');
    }
    seg([x - 4, y], [x + 1, y], 1.6, '#5a6070');
    dot(x - 4, y, 4.2, hit ? '#ffffff' : '#9aa0b0');
    dot(x - 4.6, y - 0.6, 2.6, '#c8ccd6');
    dot(x - 5.5, y, 1.9, '#141822');
    dot(x - 6, y - 0.4, 0.7, '#ff4030');
  } else if (f.k === 'dart') {
    ctx.globalCompositeOperation = 'lighter';
    glow(x + 9, y, 7, '255,90,60', 0.5);
    ctx.globalCompositeOperation = 'source-over';
    poly([[x - 13, y], [x + 9, y - 8], [x + 5, y], [x + 9, y + 8]], hit ? '#ffffff' : '#7a7e8e');
    poly([[x - 13, y], [x + 5, y], [x + 9, y + 8]], hit ? '#ffffff' : '#4e5262');
    seg([x - 6, y - 1], [x + 1, y - 2.6], 1, '#ff5040');
    seg([x - 2, y], [x + 8, y], 0.6, '#30333e');
  } else if (f.k === 'bomber') {
    ctx.globalCompositeOperation = 'lighter';
    glow(x + 15, y - 6, 8, '255,120,60', 0.45); glow(x + 15, y + 6, 8, '255,120,60', 0.45);
    ctx.globalCompositeOperation = 'source-over';
    rrect(x - 4, y - 5, 8, 10, 1.5, hit ? '#ffffff' : '#3c4050');
    rrect(x - 14, y - 10, 29, 8, 4, hit ? '#ffffff' : '#8a8a96');
    rrect(x - 14, y + 2, 29, 8, 4, hit ? '#ffffff' : '#6a6a78');
    if (!hit) {
      rrect(x - 12, y - 6, 25, 3, 1.5, '#5c5c6a');
      rrect(x - 12, y + 6, 25, 3, 1.5, '#4a4a58');
      for (let i = 0; i < 3; i++) { dot(x - 4 + i * 6, y - 8, 0.8, '#ffb040'); dot(x - 4 + i * 6, y + 4, 0.8, '#ffb040'); }
    }
    dot(x - 12, y - 6.5, 2.4, '#1c2436');
    dot(x - 12.6, y - 7.2, 0.8, '#ff6040');
  } else if (f.k === 'rock') {
    ctx.save(); ctx.translate(x, y); ctx.rotate(f.rot);
    const pts = [];
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2, rr = f.r * (0.75 + shHash(f.seed + i) * 0.35);
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    poly(pts, hit ? '#ffffff' : '#5c4a3e');
    if (!hit) {
      poly(pts.slice(0, 5).map(p => [p[0] * 0.8 - 1, p[1] * 0.8 - 1]), '#7a6452');
      dot(f.r * 0.3, f.r * 0.2, f.r * 0.2, '#3e3028');
      dot(-f.r * 0.35, f.r * 0.35, f.r * 0.13, '#3e3028');
    }
    ctx.restore();
  }
}

function shDrawBoss(b) {
  const H = shHull(b), x = b.x, y = H.y, P = H.pts;
  const g = ctx.createLinearGradient(0, y - 64, 0, y + 60);
  g.addColorStop(0, '#9a9eac'); g.addColorStop(0.45, '#5e6272'); g.addColorStop(1, '#262834');
  ctx.globalCompositeOperation = 'lighter';
  glow(x + 175, y - 30, 24, '120,170,255', 0.5); glow(x + 175, y + 30, 24, '120,170,255', 0.5);
  ctx.globalCompositeOperation = 'source-over';
  poly(P, '#1a1c26');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]);
  for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]);
  ctx.closePath(); ctx.fill();
  // Pasy poszycia
  for (let i = 1; i < 6; i++) {
    const dx = i * 28, ty = y - 16 - 48 * (dx / 170), by = y + 16 + 44 * ((dx - 4) / 166);
    seg([x + dx, ty + 2], [x + dx, by - 2], 0.5, 'rgba(20,22,30,0.5)');
  }
  seg([x + 70, y], [x + 170, y], 0.6, 'rgba(200,210,230,0.35)');
  for (let i = 0; i < 14; i++) dot(x + 80 + i * 6.5, y - 8 - (i % 3) * 7, 0.55, i % 4 ? 'rgba(255,220,150,0.7)' : 'rgba(150,200,255,0.8)');
  // Mostek na grzbiecie
  poly([[x + 120, y - 50], [x + 132, y - 62], [x + 160, y - 66], [x + 166, y - 60]], '#7a7e8c');
  rrect(x + 136, y - 74, 22, 9, 2, '#8c90a0');
  seg([x + 139, y - 71], [x + 155, y - 71], 1, 'rgba(160,220,255,0.8)');
  // Hangar
  const hx = H.hang[0], hy = H.hang[1];
  poly([[hx - 9, hy - 6], [hx + 9, hy + 1], [hx + 9, hy - 4], [hx - 9, hy - 11]], '#141018');
  ctx.globalCompositeOperation = 'lighter';
  glow(hx, hy - 5, 9, '255,150,60', 0.35 + Math.sin(b.t * 4) * 0.1);
  ctx.globalCompositeOperation = 'source-over';
  // Rdzeń reaktora w wycięciu dziobu
  const open = !shTurAlive(b), pul = 0.7 + Math.sin(b.t * 6) * 0.3, c = H.core;
  ctx.globalCompositeOperation = 'lighter';
  glow(c[0], c[1], 16 + pul * 6, open ? '255,120,60' : '120,200,255', 0.55);
  ctx.globalCompositeOperation = 'source-over';
  dot(c[0], c[1], 6, b.core.hitT > 0 ? '#ffffff' : open ? '#ffb070' : '#a0e0ff');
  dot(c[0], c[1], 3, '#ffffff');
  if (!open) {
    ctx.strokeStyle = `rgba(140,220,255,${0.4 + pul * 0.3})`; ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI * 2 + b.t; const px = c[0] + Math.cos(a) * 10, py = c[1] + Math.sin(a) * 10; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.stroke();
  }
  // Wieżyczki
  for (const u of b.tur) {
    const p = shTurPos(b, u, H);
    if (u.hp <= 0) {
      dot(p[0], p[1], 3.5, '#201814');
      if (Math.random() < 0.3) shPart({ k: 'smoke', x: p[0], y: p[1], vx: -15, vy: u.top ? -10 : 10, t: 0, life: 0.8 });
      continue;
    }
    seg(p, [p[0] + Math.cos(u.ang) * 8, p[1] + Math.sin(u.ang) * 8], 1.8, '#30323e');
    dot(p[0], p[1], 4.2, u.hitT > 0 ? '#ffffff' : '#a8acb8');
    dot(p[0] - 1, p[1] - 1, 2, '#d4d8e0');
    dot(p[0] + Math.cos(u.ang) * 2, p[1] + Math.sin(u.ang) * 2, 1, '#ff4030');
  }
}

function shDrawParts(below) {
  const S = SHIP;
  for (const p of S.parts) {
    const k = p.t / p.life;
    if (below) {
      if (p.k === 'deb') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = 1 - k;
        ctx.fillStyle = '#6a6c78'; ctx.fillRect(-p.s, -p.s * 0.5, p.s * 2, p.s);
        ctx.globalAlpha = 1; ctx.restore();
      } else if (p.k === 'smoke') dot(p.x, p.y, 1.5 + k * 3, `rgba(60,60,70,${0.4 * (1 - k)})`);
      continue;
    }
    if (p.k === 'boom') {
      glow(p.x, p.y, p.r * (0.6 + k * 1.6), '255,150,60', 0.8 * (1 - k));
      if (k < 0.4) glow(p.x, p.y, p.r * 0.7, '255,250,220', 0.9 * (1 - k / 0.4));
    } else if (p.k === 'spark') {
      seg([p.x, p.y], [p.x - p.vx * 0.03, p.y - p.vy * 0.03], 0.8, `rgba(${p.rgb},${1 - k})`);
    } else if (p.k === 'trail') {
      dot(p.x, p.y, 1.4 * (1 - k) + 0.3, `rgba(${p.rgb},${0.6 * (1 - k)})`);
    }
  }
}

function drawShip() {
  const S = SHIP;
  if (!S) return;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, SW, 180); ctx.clip();
  if (game.shake > 0.3) ctx.translate((Math.random() - 0.5) * game.shake * 2, (Math.random() - 0.5) * game.shake * 2);
  shDrawBG();
  if (S.boss) shDrawBoss(S.boss);
  shDrawParts(true);
  // Naprawy
  for (const p of S.picks) {
    ctx.globalCompositeOperation = 'lighter';
    glow(p.x, p.y, 10, '80,255,120', 0.4 + Math.sin(p.t * 6) * 0.15);
    ctx.globalCompositeOperation = 'source-over';
    rrect(p.x - 4.5, p.y - 4.5, 9, 9, 2, '#e8fff0');
    seg([p.x - 2.8, p.y], [p.x + 2.8, p.y], 1.8, '#20c050');
    seg([p.x, p.y - 2.8], [p.x, p.y + 2.8], 1.8, '#20c050');
  }
  for (const f of S.foes) shDrawFoe(f);
  // Torpedy
  for (const o of S.torps) {
    const cx = Math.cos(o.a), cy = Math.sin(o.a);
    seg([o.x - cx * 4, o.y - cy * 4], [o.x + cx * 2, o.y + cy * 2], 2, '#c8ccd8');
    ctx.globalCompositeOperation = 'lighter';
    glow(o.x - cx * 5, o.y - cy * 5, 6, '255,170,90', 0.6);
    ctx.globalCompositeOperation = 'source-over';
  }
  // Statek gracza
  if (!S.dead && S.x < SW + 30) {
    const blink = S.inv > 0 && Math.floor(S.inv * 14) % 2 === 0;
    const sy = S.roll > 0 ? Math.cos((1 - S.roll / 0.45) * Math.PI * 2) : 1;
    if (!blink) shDrawSzpon(S.x, S.y + S.vy * 0.01, Math.abs(sy) < 0.12 ? 0.12 * Math.sign(sy || 1) : sy, S.roll > 0);
  }
  // Światła: lasery, strzały wrogów, eksplozje
  ctx.globalCompositeOperation = 'lighter';
  for (const s of S.shots) {
    glow(s.x, s.y, 7, game.blade.rgb, 0.35);
    seg([s.x, s.y], [s.x - 9, s.y], 2.4, `rgba(${game.blade.rgb},0.85)`);
    seg([s.x, s.y], [s.x - 7, s.y], 0.9, '#ffffff');
  }
  for (const b of S.bolts) {
    const v = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / v * 6, uy = b.vy / v * 6;
    glow(b.x, b.y, 8, RED.rgb, 0.4);
    seg([b.x, b.y], [b.x - ux, b.y - uy], 2.6, `rgba(${RED.rgb},0.9)`);
    seg([b.x, b.y], [b.x - ux * 0.7, b.y - uy * 0.7], 0.9, '#fff0e8');
  }
  shDrawParts(false);
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();

  if (S.dead && S.deadT > 1) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 70, SW, 34);
    txt('STATEK ZNISZCZONY', SW / 2, 80, '#e04030', 'center', 11);
    txt('R / A – powtórz lot', SW / 2, 94, '#e0d0b0');
  }
  shDrawHUD();
}

function shDrawHUD() {
  const S = SHIP;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 180, SW, 20);
  for (let i = 0; i < S.max; i++) tri(4 + i * 9, 182.5, i < S.hp, '#e82020', '#701010');
  // Torpedy
  for (let i = 0; i < 3; i++) {
    const x = 5 + i * 10, y = 195, on = i < S.torp;
    seg([x, y], [x + 6, y], 2, on ? '#c8ccd8' : '#303440');
    if (on) dot(x, y, 1.1, '#ffa050');
  }
  // Pasek postępu (planeta → planeta) lub pasek krążownika
  const b = S.boss;
  const bx0 = 100, bw = 120;
  if (b && !b.dead) {
    const hm = shBossHP(b);
    ctx.fillStyle = '#301010'; ctx.fillRect(bx0, 182, bw, 3);
    ctx.fillStyle = shTurAlive(b) ? '#e05030' : '#ff9040';
    ctx.fillRect(bx0, 182, bw * hm[0] / hm[1], 3);
    txt('KLINGA', bx0 - 4, 183.5, '#e06050', 'right', 5.5, true);
  } else {
    const prog = Math.min(1, S.t / S.D);
    const pc = { cytadela: '#8a60d0', pustynia: '#e09050', ocean: '#40b0d8' };
    ctx.fillStyle = '#1c1c2c'; ctx.fillRect(bx0, 183, bw, 1.5);
    ctx.fillStyle = '#5a5a7a'; ctx.fillRect(bx0, 183, bw * prog, 1.5);
    dot(bx0 - 3, 183.7, 2.2, pc[S.from] || '#888');
    dot(bx0 + bw + 3, 183.7, 2.2, pc[S.to] || '#888');
    poly([[bx0 + bw * prog - 2, 181.7], [bx0 + bw * prog + 2.5, 183.7], [bx0 + bw * prog - 2, 185.7]], game.blade.col);
  }
  const s = msg && msg.t > 0 ? msg.text : shipHint();
  txt(s, SW / 2, 193, msg && msg.t > 0 ? '#f0d890' : '#a0a0b0', 'center', s.length > 40 ? 6 : 7);
  txt('✦ ' + S.kills, SW - 4, 186, '#c0b8d8', 'right', 7);
  if (LV && LV.name) txt((lvl + 1) + '/' + LEVELS.length + '  ' + LV.name, 4, 6, '#a8a0c0', 'left', 7);
}

function shipHint() {
  const S = SHIP;
  if (!S) return '';
  if (S.dead) return 'R lub A – powtórz lot';
  if (S.phase === 'jump' || S.phase === 'won') return '';
  if (S.boss && !S.boss.dead) return shTurAlive(S.boss) ? 'Zestrzel wieżyczki · Z torpeda (' + S.torp + ') · X beczka' : 'Strzelaj w rdzeń reaktora!';
  return '←↑↓→ lot · A lasery · Z torpeda (' + S.torp + ') · X beczka';
}
