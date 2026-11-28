'use strict';
// ===== Zapis gry, osiągnięcia, kolekcja ostrzy i fabuła =====
// Ładowane PRZED game.js – na górnym poziomie nie korzysta ze stanu gry (game, P, LEVELS…),
// tylko definiuje funkcje wywoływane później przez game.js.
//
// localStorage:
//   gow_save – bieżący bieg (stan na początku poziomu): lvl, crys, spent, sk, slots, maxHp, time, blade, dark,
//     got (kryształy mapy zebrane na tym poziomie), ngp (cykl Nowej gry+), ship (ulepszenia myśliwca)
//   gow_voice – false = głosy lektora wyłączone
//   gow_meta – trwałe postępy: best (najdalszy poziom), achv {id: data}, blades [id], lords [imiona],
//     lv {poziom: {s: gwiazdki, t: rekord czasu}}, codex [klucze], outfit, wins, ngc (przeniesienie do NG+), rush {n, t}
//   gow_players – profile graczy: list [imiona], cur (wybrany gracz). Każdy gracz ma własne
//     gow_save:<imię> i gow_meta:<imię>; stare gow_save / gow_meta przejmuje pierwszy utworzony gracz.

function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
function lsSet(k, v) {
  try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
}

// ===== Profile graczy =====
const PLAYERS_KEY = 'gow_players';
const PL = Object.assign({ list: [], cur: '' }, lsGet(PLAYERS_KEY) || {});
if (!PL.list.includes(PL.cur)) PL.cur = PL.list[0] || '';
let SAVE_KEY = 'gow_save', META_KEY = 'gow_meta';
const META = {};
const saveMeta = () => lsSet(META_KEY, META);
function loadPlayer() {
  SAVE_KEY = PL.cur ? 'gow_save:' + PL.cur : 'gow_save'; META_KEY = PL.cur ? 'gow_meta:' + PL.cur : 'gow_meta';
  for (const k in META) delete META[k];
  Object.assign(META, { best: 0, achv: {}, blades: [], lords: [], lv: {}, codex: [], outfit: 'std', wins: 0, ngc: null, rush: null },
    lsGet(META_KEY) || {});
}
loadPlayer();
const savePlayers = () => lsSet(PLAYERS_KEY, PL);
function pickPlayer(n) { if (PL.list.includes(n)) { PL.cur = n; savePlayers(); loadPlayer(); } }
// Zwraca komunikat błędu albo '' po dodaniu gracza
function addPlayer(raw) {
  const n = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 16);
  if (!n) return 'Wpisz imię gracza';
  if (PL.list.some(x => x.toLowerCase() === n.toLowerCase())) return 'Taki gracz już jest';
  if (!PL.list.length) {                    // stary zapis sprzed profili trafia do pierwszego gracza
    const os = lsGet('gow_save'), om = lsGet('gow_meta');
    if (os) lsSet('gow_save:' + n, os);
    if (om) lsSet('gow_meta:' + n, om);
    lsSet('gow_save', null); lsSet('gow_meta', null);
  }
  PL.list.push(n); PL.cur = n; savePlayers(); loadPlayer();
  return '';
}
function delPlayer(n) {
  PL.list = PL.list.filter(x => x !== n);
  lsSet('gow_save:' + n, null); lsSet('gow_meta:' + n, null);
  if (PL.cur === n) PL.cur = PL.list[0] || '';
  savePlayers(); loadPlayer();
}
const escH = t => String(t).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');

// ===== Zapis biegu =====
function saveRun() {
  if (!game.live || game.rush) return;
  META.best = Math.max(META.best || 0, lvl); saveMeta();
  lsSet(SAVE_KEY, { v: 1, lvl, crys: game.crysLvl, spent: game.spent, sk: game.sk, slots: game.slots, maxHp: game.maxHp,
    time: game.time, blade: game.blade.id, dark: game.dark || 0, got: game.got, ngp: game.ngp || 0, ship: game.shipUp || null });
}
function runSave() { const s = lsGet(SAVE_KEY); return s && s.v === 1 && LEVELS[s.lvl] ? s : null; }
function applyRun(s) {
  game.crys = s.crys; game.spent = s.spent; game.sk = Object.assign({}, s.sk); game.slots = s.slots.slice();
  game.maxHp = s.maxHp; game.time = s.time; game.dark = s.dark || 0; game.blade = bladeById(s.blade); game.path = '';
  game.ngp = s.ngp || 0; game.shipUp = Object.assign(shipUp0(), s.ship || {});
}

// ===== Rozdziały =====
const chapOf = i => LEVELS.slice(0, i + 1).filter(l => l.chapter).length - 1;
const chapStarts = () => LEVELS.map((l, i) => (l.chapter ? i : -1)).filter(i => i >= 0);
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

// ===== Kolekcja ostrzy =====
// Kryształy ostrzy (kafel C) – jeden ukryty w każdym rozdziale; dają barwę i premię. Nigdy czerwony.
const XBLADES = [
  { id: 'amber', name: 'bursztynowym', col: '#ff9a30', rgb: '255,150,50', bonus: 'Aura odnawia się o 30% szybciej.' },
  { id: 'silver', name: 'srebrnym', col: '#d8e4f4', rgb: '215,228,245', dbl: true, bonus: 'Ostrze dwustronne – dłuższy zasięg cięcia.' },
  { id: 'teal', name: 'turkusowym', col: '#30e8b8', rgb: '50,230,185', dual: true, bonus: 'Dwa ostrza – +1 cios w kombinacji.' },
  { id: 'rose', name: 'różowym', col: '#ff70d0', rgb: '255,110,210', bonus: '+1 ◆ za każdego pokonanego wroga.' },
  { id: 'gold', name: 'złotym', col: '#ffd060', rgb: '255,210,90', bonus: '20% szans na podwójne trafienie.' },
  { id: 'prism', name: 'mieniącym się', col: '#ffffff', rgb: '255,255,255', prism: true, bonus: 'Barwa płynie jak tęcza; moce tańsze o 15%.' },
];
const allBlades = () => BLADES.concat(XBLADES);
const bladeById = id => allBlades().find(b => b.id === id) || BLADES[0];
const hasBlade = id => META.blades.includes(id);
function ownBlade(b) { if (!hasBlade(b.id)) { META.blades.push(b.id); saveMeta(); } }
const chapBlade = () => XBLADES[Math.max(0, chapOf(lvl)) % XBLADES.length];
// Premie ostrza
const bladeIs = k => !!(game.blade && game.blade[k]);
const bladeId = id => game.blade && game.blade.id === id;
const comboMax = () => Math.min(4, skl('combo') + (bladeIs('dual') ? 1 : 0));
// Wróg pokonany – osiągnięcia i premie (game.cause: 'bolt'/'choke'/'mirror'… ustawiane przed hitFoe)
function onKill(f) {
  achv('first');
  if (game.cause === 'bolt' || game.cause === 'choke') achv('aura');
  if (game.cause === 'mirror') achv('mirror');
  if (game.cause === 'stealth' && game.stealth >= 5) achv('shadow');
  if (bladeId('rose')) addCrys(1, f.x, f.y - 30);
  if (f.k === 'lord') lordDown(f);
}

// Już zebrany kryształ rozdziału zamienia się w zwykły kryształ energii
function stripBladeCrystals() {
  if (!hasBlade(chapBlade().id)) return;
  for (const R of ROOMS) for (const row of R.map) for (let c = 0; c < row.length; c++) if (row[c] === 'C') row[c] = 'O';
}
function pickBladeCrystal(r, c) {
  const b = chapBlade();
  MAP[r][c] = '_';
  ownBlade(b);
  SND.ignite(); SND.gem(); shake(2);
  flash = { col: b.col, t: 0.25 };
  burst(c * TW + 16, floorY(r) - 12, 24, b.col, 120, 90, true);
  if (P.sword) game.blade = b;
  say('Kryształ ostrza! Ostrze świeci ' + b.name + ' światłem. ' + b.bonus + ' (O – kolekcja)', 4);
  achv('crys1');
  if (XBLADES.every(x => hasBlade(x.id))) achv('crysall');
}
// Pokonany Lord zostawia kryształ – nowa barwa podstawowa do kolekcji
function unlockBase() {
  const free = BLADES.filter(b => !hasBlade(b.id));
  if (!free.length) return;
  const b = free[Math.floor(Math.random() * free.length)];
  ownBlade(b);
  toast('NOWA BARWA OSTRZA', 'Kryształ ' + b.name.replace(/m$/, '') + ' światła', 'Wybierz ją w kolekcji (O).');
}
// Ostrze „mieniące się” – barwa płynie w czasie
function bladeTick() {
  const b = game.blade;
  if (!b || !b.prism) return;
  const h = (game.anim * 80) % 360, f = n => { const k = (n + h / 30) % 12; return 0.65 - 0.35 * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  const rgb = [f(0), f(8), f(4)].map(v => Math.round(v * 255));
  b.rgb = rgb.join(','); b.col = '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
}

// ===== Osiągnięcia =====
const ACHV = [
  ['first', 'Pierwsze starcie', 'Pokonaj pierwszego przeciwnika.'],
  ['mirror', 'Lustro', 'Pokonaj wroga jego własnym, odbitym strzałem.'],
  ['aura', 'Siła aury', 'Pokonaj wroga piorunami lub uściskiem.'],
  ['qte', 'Cios aury', 'Wykończ przyciągniętego wroga szybkim A.'],
  ['lock', 'Mistrz zwarcia', 'Wygraj zwarcie ostrzy z Lordem.'],
  ['lords', 'Pogromca Lordów', 'Pokonaj wszystkich sześciu Lordów.'],
  ['shadow', 'Cień', 'Pokonaj 5 wrogów po cichu, zachodząc ich od tyłu.'],
  ['crys1', 'Iskra', 'Znajdź pierwszy ukryty kryształ ostrza.'],
  ['crysall', 'Pełne spektrum', 'Zbierz wszystkie 6 kryształów ostrzy.'],
  ['clean', 'Nietykalny', 'Ukończ poziom bez żadnej rany.'],
  ['pilot', 'As przestworzy', 'Ukończ przelot bez trafienia.'],
  ['master', 'Mistrz aury', 'Rozwiń dowolną umiejętność do poziomu 4.'],
  ['rich', 'Skarbnik', 'Zgromadź 100 kryształów energii.'],
  ['saga', 'Saga', 'Ukończ grę.'],
  ['light', 'Ścieżka światła', 'Oszczędź Arcylorda.'],
  ['dark', 'Ścieżka gniewu', 'Przyjmij moc Arcylorda.'],
  ['fast', 'Błyskawica', 'Ukończ grę w mniej niż 60 minut.'],
];
function achv(id) {
  if (!game.live || META.achv[id]) return;
  const a = ACHV.find(x => x[0] === id);
  if (!a) return;
  META.achv[id] = Date.now(); saveMeta();
  toast('★ OSIĄGNIĘCIE', a[1], a[2]);
  melody([660, 880, 1320], 0.09, 'triangle', 0.05);
}
function toast(head, name, desc) { game.toasts.push({ head, name, desc, t: 0 }); }
function lordDown(f) {
  const n = lordName(f);
  if (!META.lords.includes(n)) { META.lords.push(n); saveMeta(); }
  if (META.lords.length >= 6) achv('lords');
  unlockBase();
}
function drawToast() {
  const q = game.toasts[0];
  if (!q) return;
  const k = Math.max(0, Math.min(1, q.t / 0.3, (3.2 - q.t) / 0.3)), y = -28 + 50 * ease(k);
  rrect(SW / 2 - 84, y, 168, 26, 4, 'rgba(24,18,6,0.94)');
  ctx.strokeStyle = 'rgba(240,192,64,0.8)'; ctx.lineWidth = 1; ctx.strokeRect(SW / 2 - 83.5, y + 0.5, 167, 25);
  txt(q.head, SW / 2, y + 6, '#f0c040', 'center', 5.5);
  txt(q.name, SW / 2, y + 13.5, '#fff0c8', 'center', 7.5);
  txt(q.desc, SW / 2, y + 21, '#c8b890', 'center', 5.5);
}

// ===== Kolekcja (O): ostrza i osiągnięcia =====
function openGear() {
  if (game.mode === 'play' && P && P.st !== 'ship' && P.st !== 'dead' && !game.lock && !game.qte) {
    game.mode = 'gear'; game.gmsg = ''; for (const k in K) K[k] = false;
    const i = allBlades().indexOf(game.blade); if (i >= 0) game.gsel = i;
  } else if (game.mode === 'gear') game.mode = 'play';
}
function gearKey(k) {
  const n = allBlades().length;
  if (k === 'left') game.gsel = (game.gsel + n - 1) % n;
  else if (k === 'right') game.gsel = (game.gsel + 1) % n;
  else if (k === 'up' || k === 'down') game.gsel = (game.gsel + 6) % n;
  else if (k === 'act') equipBlade(allBlades()[game.gsel]);
  else if (k === 'sheathe' || k === 'gear') game.mode = 'play';
  game.gsel = Math.max(0, Math.min(n - 1, game.gsel));
}
function equipBlade(b) {
  if (!hasBlade(b.id)) { game.gmsg = 'Tego kryształu jeszcze nie odnaleziono.'; SND.click(); return; }
  if (!P.sword) { game.gmsg = 'Najpierw zdobądź rękojeść ostrza.'; SND.click(); return; }
  if (game.blade === b) { game.gmsg = 'To ostrze już nosisz.'; return; }
  game.blade = b; game.gmsg = 'Ostrze świeci teraz ' + b.name + ' światłem.'; SND.ignite();
}
const gearBox = i => ({ x: 9 + (i % 6) * 51, y: 22 + Math.floor(i / 6) * 25, w: 47, h: 21 });
function gearTap(e) {
  const r = cv.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width * SW, y = (e.clientY - r.top) / r.height * SH;
  if (y > 178) { game.mode = 'play'; return; }
  allBlades().forEach((b, i) => {
    const q = gearBox(i);
    if (x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h) { if (game.gsel === i) gearKey('act'); else { game.gsel = i; game.gmsg = ''; } }
  });
}
function drawBladeIcon(x, y, b, own) {
  const L = 30, h = [x + 8, y], t = [x + 8 + L, y];
  if (own) {
    const col = b.col;
    seg([h[0] + 2, y], t, 3.4, `rgba(${b.rgb},0.35)`); seg([h[0] + 2, y], t, 1.6, col); seg([h[0] + 2, y], [t[0] - 1, y], 0.6, '#ffffff');
    if (b.dbl) { seg([x - 12, y], [h[0] - 2, y], 3.4, `rgba(${b.rgb},0.35)`); seg([x - 12, y], [h[0] - 2, y], 1.6, col); }
    if (b.dual) { seg([h[0] + 2, y + 5], [t[0] - 6, y + 5], 1.4, col); seg([x, y + 5], [h[0] + 2, y + 5], 1.6, '#9aa4b4'); }
  }
  seg([x, y], [h[0] + 2, y], 2, own ? '#b8c0cc' : '#3a4050');
}
function drawGear() {
  ctx.fillStyle = 'rgba(4,6,16,0.92)'; ctx.fillRect(0, 0, SW, SH);
  txt('KOLEKCJA', SW / 2, 9, '#f0c040', 'center', 9);
  const B = allBlades();
  B.forEach((b, i) => {
    const q = gearBox(i), own = hasBlade(b.id), sel = i === game.gsel, cur = game.blade === b && P.sword;
    rrect(q.x, q.y, q.w, q.h, 3, cur ? 'rgba(40,56,84,0.95)' : 'rgba(18,22,34,0.95)');
    ctx.strokeStyle = sel ? '#ffffff' : cur ? '#80c8ff' : own ? 'rgba(160,180,220,0.4)' : '#262c3c';
    ctx.lineWidth = sel ? 1.5 : 1; ctx.strokeRect(q.x + 0.5, q.y + 0.5, q.w - 1, q.h - 1);
    drawBladeIcon(q.x + 6, q.y + 8, b, own);
    txt(own ? b.name.replace(/m$/, '').replace(/ się$/, '') : '?', q.x + q.w / 2, q.y + 16.5, own ? '#c8d0e0' : '#4a5064', 'center', 5);
    if (i >= BLADES.length) txt('◆', q.x + q.w - 5, q.y + 5, own ? '#ffe080' : '#3a4050', 'center', 5);
  });
  const b = B[game.gsel], own = hasBlade(b.id);
  const d = own ? (b.bonus || 'Klasyczne ostrze – bez dodatków.')
    : game.gsel >= BLADES.length ? 'Ukryty kryształ – szukaj go w rozdziale ' + ROMAN[game.gsel - BLADES.length] + '.'
      : 'Barwa do zdobycia – każdy pokonany Lord zostawia kryształ.';
  txt(game.gmsg || d, SW / 2, 75, game.gmsg ? '#ffe080' : '#c8c0b0', 'center', 6);
  const n = ACHV.filter(a => META.achv[a[0]]).length;
  txt('OSIĄGNIĘCIA ' + n + '/' + ACHV.length, SW / 2, 86, '#f0c040', 'center', 6.5);
  ACHV.forEach((a, i) => {
    const got = !!META.achv[a[0]], x = 10 + (i % 2) * 154, y = 95 + Math.floor(i / 2) * 9.2;
    txt((got ? '★ ' : '☆ ') + a[1], x, y, got ? '#ffe080' : '#5a6078', 'left', 5.5);
    txt(got ? a[2] : '', x + 62, y, '#9a9488', 'left', 4.2);
  });
  txt('←→↑↓ wybór · A załóż ostrze · O/S zamknij', SW / 2, 189, '#8890a8', 'center', 6.5);
}

// ===== Głosy: lektor czyta napisy, wiadomości Ael, kwestie Lordów i podpowiedzi (Web Speech API, offline) =====
// gow_voice – false = wyciszone. Brak polskiego głosu w systemie → czyta domyślny głos przeglądarki.
const VOICE = {
  on: lsGet('gow_voice') !== false, last: '', lastT: 0,
  ok: () => 'speechSynthesis' in window,
  pick(role) {
    const all = this.ok() ? speechSynthesis.getVoices() : [], pl = all.filter(v => /^pl/i.test(v.lang));
    const male = pl.find(v => /adam|marek|krzysztof|jacek|jan|male|mężczyzna/i.test(v.name));
    const fem = pl.find(v => /paulina|zofia|zosia|agnieszka|ewa|maja|female|kobieta/i.test(v.name));
    if (role === 'ael') return fem || pl[0] || null;
    if (role === 'lord' || role === 'nar') return male || pl[0] || null;
    return pl[0] || null;
  },
  // Barwa: lektor niski i spokojny, Ael jaśniej, Lord bardzo nisko i wolno, podpowiedzi szybciej
  STYLE: { nar: [0.75, 0.92, 1], ael: [1.2, 1.0, 1], lord: [0.1, 0.8, 1], hint: [1.0, 1.12, 0.85] },
  say(text, role, keep) {
    if (!this.on || !this.ok() || !text) return;
    if (!keep) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text).replace(/[„”"«»]/g, '').replace(/…/g, '...').replace(/ – /g, ', '));
    const st = this.STYLE[role] || this.STYLE.hint, v = this.pick(role);
    if (v) u.voice = v;
    u.lang = v ? v.lang : 'pl-PL'; u.pitch = st[0]; u.rate = st[1]; u.volume = st[2];
    speechSynthesis.speak(u);
  },
  // Komunikaty w grze – bez przerywania fabuły i bez powtórek tego samego zdania
  hint(text) {
    if (!this.on || !this.ok() || speechSynthesis.speaking) return;
    const now = Date.now();
    if (text === this.last && now - this.lastT < 6000) return;
    this.last = text; this.lastT = now;
    this.say(text, /Lord|Pani Burz|Królowa|Łowca|Arcylord/.test(text) && /„/.test(text) ? 'lord' : 'hint', true);
  },
  stop() { if (this.ok()) speechSynthesis.cancel(); },
  toggle() {
    this.on = !this.on; lsSet('gow_voice', this.on); if (!this.on) this.stop();
    const b = document.getElementById('voiceb'); if (b) b.textContent = this.on ? '🔊' : '🔇';
    return this.on;
  },
};
if (VOICE.ok()) { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices(); }
// Czytanie bieżącej strony fabuły
function storySpeak() {
  const S = game.story; if (!S) return;
  const pg = S.pages[S.i];
  if (pg.crawl) {
    VOICE.say('Dawno temu, wśród odległych gwiazd...', 'nar');
    VOICE.say(CRAWL.ep + '. ' + CRAWL.title + '.', 'nar', true);
    CRAWL.paras.forEach(p => VOICE.say(p, 'nar', true));
  } else if (pg.choice) VOICE.say(pg.lines.join(' ') + ' ' + pg.opts.join(', albo: ') + '?', 'nar');
  else VOICE.say(pg.lines.join(' '), pg.who === 'lord' ? 'lord' : pg.who === 'ael' ? 'ael' : 'nar');
}

// ===== Fabuła: napisy otwierające (przewijane w perspektywie) i holowiadomości mistrzyni Ael =====
// Świat autorski: 200 lat po śmierci Liry Sol odrodzony Zakon Mistrzów pilnuje młodej Republiki
const CRAWL = {
  ep: 'ROZDZIAŁ I', title: 'CIEŃ NA RUBIEŻACH',
  paras: [
    'Minęło dwieście lat od śmierci Liry Sol, wnuczki Imperatora, która zwróciła się przeciw własnej krwi, zgasiła mrok i odbudowała Zakon Mistrzów.',
    'Po upadku Imperium i jego następcy, Żelaznego Ładu, odrodzona Republika rośnie szybciej, niż potrafi się bronić. Senat spiera się o szlaki handlowe, a światy dalekich rubieży czują się zapomniane.',
    'W Nowej Radzie Zakonu zasiadają mistrz Davan Korr, prawnuk legendarnego mistrza Korra, oraz sędziwy mistrz Oko – maleńki strażnik, który pamięta jeszcze czasy Imperium.',
    'Z ruin dawnych twierdz powstał tajemniczy ARCYLORD. Jego uczniowie, Lordowie czerwonych ostrzy, przejmują sześć światów na rubieżach, a Senat zwleka z odpowiedzią.',
    'Rada wysyła na Cytadelę Mrocznego Lorda młodego rycerza. Nad celem jego myśliwiec zostaje trafiony, a ostrze przepada w ciemności…',
  ],
};
const STORY = {
  0: [
    { crawl: true },
    { who: 'ael', lines: ['Rycerzu, słyszysz mnie? Tu mistrzyni Ael z Nowej Rady Zakonu.',
      'Mistrz Korr i mistrz Oko czuwają nad tobą ze Świątyni na Coruvii.',
      'Arcylord gasi nasze placówki na rubieżach jedną po drugiej, a Senat Republiki wciąż debatuje.'] },
    { who: 'ael', lines: ['Twój myśliwiec spadł nad Cytadelą. Ostrze przepadło.',
      'W lochach leży stara rękojeść. Kryształ sam wybierze barwę.',
      'Aura płynie w tobie także bez ostrza – Z i X to twoje pierwsze moce.'] },
    { who: 'ael', lines: ['Każdy świat skrywa kryształ ostrza – szukaj w trudno dostępnych miejscach.',
      'Mistrz Oko kazał ci przekazać: „Gniew daje siłę szybko, ale zabiera wszystko”.'] },
  ],
  1: [
    { who: 'ael', lines: ['Mroczny Lord upadł. Cytadela znów oddycha, a Senat w końcu słucha Rady.',
      'Na pustyni Sarrak Pani Burz zbiera najemników – jej sztormy zasypują osady, o których Republika zapomniała.',
      'Uważaj na ruchome piaski i na strzelców w kanionach.'] },
  ],
  2: [
    { who: 'ael', lines: ['Burze ucichły, ludzie Sarrak wracają do studni. Republika obiecuje im pomoc.',
      'Thalos to stacja na dnie oceanu, która karmi pół sektora. Lord Głębin odciął ją od powierzchni.',
      'Pod wodą pilnuj tlenu – kratki z powietrzem ocalą ci życie.'] },
  ],
  3: [
    { who: 'ael', lines: ['Thalos znów wypuszcza statki. Dziękują ci, choć nie znają twojego imienia.',
      'Na lodowej Krio Królowa Mrozu więzi rycerzy, których Rada wysłała przed tobą.',
      'Lód jest śliski – nie biegnij na oślep.'] },
  ],
  4: [
    { who: 'ael', lines: ['Uwolnieni rycerze ruszają ci z pomocą, choć są jeszcze słabi.',
      'Na leśnym księżycu Verdan poluje Łowca – kiedyś uczeń mistrza Korra.',
      'Mistrz Oko wierzy, że każdy może wrócić do światła. Jeśli możesz, nie odbieraj mu nadziei.'] },
  ],
  5: [
    { who: 'ael', lines: ['To ostatni świat: Ignis, kuźnia floty Arcylorda. Flota Republiki czeka na orbicie na twój znak.',
      'Arcylord będzie cię kusił. Powie, że Republika jest słaba, a razem moglibyście rządzić gwiazdami.',
      'Rada ci ufa. Wybór zawsze należy do ciebie, rycerzu.'] },
  ],
  end: [
    { who: 'lord', lines: ['Pokonałeś mnie... ale spójrz na siebie.',
      'Republika gnije od środka, a Rada tylko się przygląda. Twoja aura płonie tak jak moja.',
      'Przyjmij mój tron, a cała galaktyka będzie twoja.'] },
    { choice: true, lines: ['Arcylord klęczy przed tobą. Co zrobisz?'],
      opts: ['Oszczędź go – zgaś ostrze', 'Przyjmij jego moc i tron'] },
  ],
};
const DARK_PAGE = { who: 'ael', lines: ['Czuję w tobie coraz więcej gniewu. Mistrz Oko też to czuje.',
  'Pioruny i uścisk to narzędzia Lordów. Uważaj, kim się stajesz.'] };
const ENDING = {
  light: ['Gasisz ostrze. Arcylord stanie przed sądem Republiki, a sześć światów rubieży znów ma głos w Senacie.',
    'Mistrz Korr proponuje ci miejsce w Nowej Radzie, a mistrz Oko po raz pierwszy od stu lat się uśmiecha.'],
  dark: ['Zasiadasz na tronie z popiołu. Floty rubieży kłaniają się nowemu władcy, a Republika drży.',
    'W Świątyni na Coruvii Rada milknie. Hologram Ael gaśnie na zawsze.'],
};
// Napisy otwierające: wiersze w „perspektywie” – im wyżej, tym mniejsze i ciemniejsze
const CRAWL_SPD = 9, CRAWL_SZ = 8;
function crawlLines() {
  if (CRAWL.lines) return CRAWL.lines;
  const out = [{ s: CRAWL.ep, h: 1 }, { s: CRAWL.title, h: 2 }, { s: '' }];
  for (const p of CRAWL.paras) { for (const l of wrapTxt(p, 250, CRAWL_SZ)) out.push({ s: l }); out.push({ s: '' }); }
  return (CRAWL.lines = out);
}
const crawlLen = () => crawlLines().length * 12 + 450;
function drawCrawl(S) {
  const t = S.t;
  if (t < 3) {   // wstęp na niebiesko, potem napisy
    const a = Math.min(1, t / 0.6) * Math.min(1, (3 - t) / 0.6);
    txt('Dawno temu, wśród odległych gwiazd…', SW / 2, SH / 2 - 4, `rgba(90,170,255,${a})`, 'center', 8);
    return;
  }
  const w0 = (t - 3) * CRAWL_SPD;   // przewinięcie w „metrach” płaszczyzny
  crawlLines().forEach((L, i) => {
    if (!L.s) return;
    const p = w0 - i * 12;   // odległość wiersza od dolnej krawędzi
    if (p < -10) return;
    // Rzut płaszczyzny: szerokość liter ~k, wysokość i odstęp wierszy ~k² – jak tekst leżący „w głąb”
    const k = 1 / (1 + Math.max(0, p) * 0.0052);
    const y = 26 + 182 * k, a = Math.max(0, Math.min(1, (k - 0.3) * 4));
    if (a <= 0 || y > SH + 8) return;
    const sz = (L.h === 2 ? 12 : L.h ? 9 : CRAWL_SZ) * k;
    TQ.push({ s: L.s, x: SW / 2, y, col: `rgba(255,214,${L.h ? 90 : 60},${a})`, align: 'center', size: sz, sy: k * 1.15 });
  });
  // Koniec napisów – czekamy, aż lektor skończy czytać
  if (w0 > crawlLen() && !(VOICE.on && VOICE.ok() && speechSynthesis.speaking && w0 < crawlLen() + 200)) storyNext();
}

function showStory(key, then, title) {
  const pages = (STORY[key] || []).slice();
  if (typeof key === 'number' && key >= 2 && (game.dark || 0) >= 10) pages.splice(pages.length, 0, DARK_PAGE);
  if (!pages.length) { then(); return; }
  game.story = { pages, i: 0, t: 0, sel: 0, then, title: title || '' };
  if (pages[0].crawl && SND.fanfare) SND.fanfare();
  storySpeak();
  game.mode = 'story';
  for (const k in K) K[k] = false;
}
function storyNext() {
  const S = game.story;
  S.i++; S.t = 0; SND.click();
  if (S.i >= S.pages.length) { game.story = null; VOICE.stop(); S.then(); return; }
  storySpeak();
}
function storyKey(k) {
  const S = game.story;
  if (!S) return;
  const pg = S.pages[S.i];
  if (pg.choice) {
    if (['up', 'down', 'left', 'right', 'pull', 'push'].includes(k)) { S.sel = 1 - S.sel; SND.click(); }
    else if (k === 'act' && S.t > 0.5) { game.path = S.sel ? 'dark' : 'light'; storyNext(); }
    return;
  }
  if (S.t < 0.35) return;
  if (k === 'sheathe') {
    const ci = S.pages.findIndex(p => p.choice);
    S.i = ci > S.i ? ci - 1 : S.pages.length - 1;
    storyNext(); return;
  }
  if (k === 'act' || k === 'up' || k === 'right') storyNext();
}
function storyTap(e) {
  const S = game.story;
  if (!S) return;
  const pg = S.pages[S.i];
  if (pg.choice) {
    const r = cv.getBoundingClientRect(), y = (e.clientY - r.top) / r.height * SH;
    const i = y < 132 ? 0 : 1;
    if (S.sel === i) storyKey('act'); else { S.sel = i; SND.click(); }
    return;
  }
  storyKey('act');
}
// Zawijanie wierszy według rzeczywistej szerokości czcionki
function wrapTxt(s, w, size) {
  tctx.font = `bold ${size}px "Segoe UI", Tahoma, Verdana, sans-serif`;
  const out = []; let line = '';
  for (const word of s.split(' ')) {
    const t = line ? line + ' ' + word : word;
    if (tctx.measureText(t).width > w && line) { out.push(line); line = word; } else line = t;
  }
  if (line) out.push(line);
  return out;
}
const HOLO = { type: 'hero', skin: '#a8e0ff', hand: '#a8e0ff', handB: '#5aa0d8', arm: '#70b8f0', armB: '#3a78b0',
  body: '#80c8ff', bodyB: '#4a90d0', leg: '#4a88c8', legB: '#2a5890', boot: '#2a5890', belt: '#3a70b0',
  cloak: '#4a90d8', cloakB: '#2a60a0', hair: '#c8f0ff', thick: 4 };
function drawStory() {
  const S = game.story, pg = S.pages[S.i], a = Math.min(1, S.t / 0.4);
  ctx.fillStyle = '#02030a'; ctx.fillRect(0, 0, SW, SH);
  for (let i = 0; i < 70; i++) {
    const x = (i * 97.3 + game.anim * (2 + i % 3)) % SW, y = (i * 53.7) % SH;
    ctx.fillStyle = `rgba(200,210,255,${0.25 + (i % 5) * 0.12})`; ctx.fillRect(x, y, 1, 1);
  }
  if (pg.crawl) {
    drawCrawl(S);
    if (game.story === S) txt('A – dalej · S – pomiń', SW / 2, 192, S.t > 0.35 ? '#5a6078' : '#30343c', 'center', 5.5);
    return;
  }
  if (S.title) txt(S.title, SW / 2, 16, `rgba(240,192,64,${a})`, 'center', 9);
  const fx = 62, fy = 142;
  if (pg.who === 'ael') {
    // Hologram: stożek światła z emitera, migotanie i linie skanowania
    ctx.fillStyle = '#20242c'; ctx.fillRect(fx - 14, fy, 28, 4);
    ctx.fillStyle = '#60c0ff'; ctx.fillRect(fx - 6, fy, 12, 1);
    ctx.fillStyle = 'rgba(90,180,255,0.12)';
    ctx.beginPath(); ctx.moveTo(fx - 4, fy); ctx.lineTo(fx - 26, fy - 78); ctx.lineTo(fx + 26, fy - 78); ctx.lineTo(fx + 4, fy); ctx.fill();
    ctx.save();
    ctx.globalAlpha = (0.7 + Math.sin(game.anim * 23) * 0.08 + (Math.random() < 0.04 ? -0.3 : 0)) * a;
    ctx.translate(fx + (Math.random() < 0.03 ? 2 : 0), fy - 2); ctx.scale(1.7, 1.7);
    drawFig(0, 0, 1, POSE.stand, HOLO, { blade: '' });
    ctx.restore();
    ctx.fillStyle = 'rgba(2,3,10,0.45)';
    for (let y = fy - 80; y < fy; y += 2) ctx.fillRect(fx - 28, y + (Math.floor(game.anim * 20) % 2), 56, 0.8);
    txt('AEL', fx, fy + 12, `rgba(140,210,255,${a})`, 'center', 7);
  } else if (pg.who === 'lord') {
    ctx.save(); ctx.globalAlpha = a;
    ctx.translate(fx, fy); ctx.scale(1.7, 1.7);
    drawFig(0, 0, 1, POSE.kneel, STY.lord6 || STY.lord, { blade: '' });
    ctx.restore();
    txt('ARCYLORD', fx, fy + 12, `rgba(255,120,110,${a})`, 'center', 7);
  }
  const x0 = pg.who ? 120 : SW / 2, al = pg.who ? 'left' : 'center', w = pg.who ? 190 : 280;
  let y = pg.choice ? 70 : 54;
  for (const s of pg.lines) for (const l of wrapTxt(s, w, 7)) { txt(l, x0, y, `rgba(232,224,200,${a})`, al, 7); y += 11; }
  if (pg.choice) {
    pg.opts.forEach((o, i) => {
      const by = 112 + i * 24, sel = S.sel === i;
      rrect(60, by, 200, 18, 3, sel ? (i ? 'rgba(90,24,24,0.95)' : 'rgba(24,52,90,0.95)') : 'rgba(18,20,30,0.95)');
      ctx.strokeStyle = sel ? (i ? '#ff7060' : '#80c8ff') : '#2c3244'; ctx.lineWidth = 1;
      ctx.strokeRect(60.5, by + 0.5, 199, 17);
      txt((i ? '↓ ' : '↑ ') + o, SW / 2, by + 9, sel ? '#ffffff' : '#8890a8', 'center', 7);
    });
    txt('↑↓ wybór · A zatwierdź', SW / 2, 188, '#8890a8', 'center', 6.5);
  } else {
    const blink = Math.floor(game.anim * 2) % 2 ? '#c8c0a8' : '#8890a8';
    txt('A – dalej · S – pomiń', SW / 2, 188, S.t > 0.35 ? blink : '#4a5064', 'center', 6.5);
  }
}

// ===== Ekran tytułowy: gracz / Kontynuuj / Nowa gra / wybór rozdziału =====
let menuAdd = false, menuErr = '';
function buildMenu() {
  const el = document.getElementById('menu');
  if (!el) return;
  if (menuAdd || !PL.cur) {
    el.innerHTML = `<div class="who">${PL.list.length ? 'Nowy gracz' : 'Witaj! Jak masz na imię?'}</div>` +
      `<div class="who"><input id="pname" maxlength="16" placeholder="imię gracza" autocomplete="off">` +
      `<button data-m="add" class="main">OK <kbd>Enter</kbd></button>${PL.list.length ? '<button data-m="back">Anuluj <kbd>Esc</kbd></button>' : ''}</div>` +
      (menuErr ? `<div class="err">${escH(menuErr)}</div>` : '');
    const inp = el.querySelector('#pname');
    const ok = () => { menuErr = addPlayer(inp.value); if (!menuErr) menuAdd = false; buildMenu(); };
    inp.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); ok(); }
      else if (e.key === 'Escape' && PL.list.length) { menuAdd = false; menuErr = ''; buildMenu(); }
    });
    el.querySelectorAll('button').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      if (b.dataset.m === 'add') ok(); else { menuAdd = false; menuErr = ''; buildMenu(); }
    }));
    setTimeout(() => inp.focus(), 0);
    return;
  }
  const s = runSave(), best = META.best || 0, n = ACHV.filter(a => META.achv[a[0]]).length;
  let h = '<div class="who">Gracz: ' + PL.list.map(p => {
    const ps = p === PL.cur ? s : lsGet('gow_save:' + p);
    return `<button data-m="pl" data-n="${escH(p)}"${p === PL.cur ? ' class="cur"' : ''} title="${ps && LEVELS[ps.lvl] ? 'Poziom ' + (ps.lvl + 1) : 'Bez zapisu'}">${escH(p)}</button>`;
  }).join('') + '<button data-m="addp" title="Dodaj gracza">+ Nowy</button>' +
    `<button data-m="del" title="Usuń gracza ${escH(PL.cur)}">✕</button>` +
    (PL.list.length > 1 ? ' <small>(↑↓ zmiana)</small>' : '') + '</div>';
  if (s) h += `<button data-m="cont" class="main">▶ Kontynuuj – poziom ${s.lvl + 1}: ${LEVELS[s.lvl].name} <kbd>Enter</kbd></button>`;
  h += `<button data-m="new"${s ? '' : ' class="main"'}>Nowa gra <kbd>${s ? 'N' : 'Enter'}</kbd></button>`;
  if (META.ngc) h += `<button data-m="ngp" title="Zachowujesz umiejętności, kryształy, ostrze i ulepszenia myśliwca; wrogowie są silniejsi">Nowa gra+ (cykl ${META.ngc.ngp}) <kbd>P</kbd></button>`;
  if (rushList().length && META.lords.length) h += `<button data-m="rush" title="Walki z pokonanymi Lordami jedna po drugiej">⚔ Starcia z Lordami (${rushList().length}) <kbd>B</kbd></button>`;
  const ch = chapStarts().filter(i => i <= best);
  if (ch.length > 1) {
    h += '<div class="chap">Rozdział: ' + ch.map((i, k) =>
      `<button data-m="ch" data-i="${i}" title="${LEVELS[i].chapter}">${ROMAN[k]}</button>`).join('') + ' <small>(klawisze 1–' + ch.length + ')</small></div>';
  }
  h += `<div class="stat">★ Osiągnięcia ${n}/${ACHV.length} · ◆ Kryształy ostrzy ${XBLADES.filter(b => hasBlade(b.id)).length}/${XBLADES.length}` +
    ` · ☆ Gwiazdki ${starSum()}/${LEVELS.length * 3}${META.rush ? ' · ⚔ ' + META.rush.n + ' Lordów: ' + fmtT(META.rush.t) : ''}</div>`;
  el.innerHTML = h;
  el.querySelectorAll('button').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const m = b.dataset.m;
    if (m === 'pl') { pickPlayer(b.dataset.n); buildMenu(); return; }
    if (m === 'addp') { menuAdd = true; menuErr = ''; buildMenu(); return; }
    if (m === 'del') { if (confirm('Usunąć gracza ' + PL.cur + ' i wszystkie jego postępy?')) { delPlayer(PL.cur); buildMenu(); } return; }
    if (m === 'cont') contGame(); else if (m === 'new') beginGame(); else if (m === 'ngp') ngGame(); else if (m === 'rush') rushGame();
    else chapGame(+b.dataset.i);
  }));
}
function titleKey(e) {
  if (!PL.cur || menuAdd) { const i = document.getElementById('pname'); if (i) i.focus(); return; }
  if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && PL.list.length > 1) {
    const i = PL.list.indexOf(PL.cur), d = e.key === 'ArrowUp' ? -1 : 1;
    pickPlayer(PL.list[(i + d + PL.list.length) % PL.list.length]); buildMenu(); return;
  }
  if (e.key === 'n' || e.key === 'N') { beginGame(); return; }
  if ((e.key === 'p' || e.key === 'P') && META.ngc) { ngGame(); return; }
  if ((e.key === 'b' || e.key === 'B') && rushList().length && META.lords.length) { rushGame(); return; }
  const d = parseInt(e.key, 10);
  if (d >= 1 && d <= 9) {
    const ch = chapStarts().filter(i => i <= (META.best || 0));
    if (ch[d - 1] !== undefined) { chapGame(ch[d - 1]); return; }
  }
  start();
}
function leaveTitle() { audioOn(); titleEl.classList.add('hide'); game.live = true; game.rush = null; }
function beginGame() { leaveTitle(); newGame(); }
function contGame() {
  const s = runSave();
  if (!s) { beginGame(); return; }
  leaveTitle(); applyRun(s);
  // Kryształy zebrane przed zapisem na tym poziomie nie pojawią się ponownie
  game.got = (s.got || []).slice(); game.crysLvl = s.crys; game.crys = s.crys + game.got.length; game.retry = true;
  loadLevel(s.lvl);
  say('Witaj, ' + PL.cur + '! Poziom ' + (s.lvl + 1) + ': ' + LV.name, 2.5);
}
function chapGame(i) {
  leaveTitle();
  const s = runSave();
  if (s) applyRun(s);
  else { game.maxHp = 3; game.time = 0; skReset(); game.crys = chapOf(i) * 25; game.dark = 0; game.path = ''; game.blade = BLADES[0]; game.ngp = 0; game.shipUp = shipUp0(); }
  if (!P || !game.blade) game.blade = BLADES[0];
  loadLevel(i);
  showStory(chapOf(i), () => { game.mode = 'play'; }, LEVELS[i].chapter);
}


// ===== Gwiazdki i rekordy poziomów =====
// ★ ukończenie · ★ bez rany (przelot: najwyżej 2 trafienia) · ★ czas w normie (przelot: bez trafienia)
const shipUp0 = () => ({ gun: 0, shield: 0, torp: 0 });
const fmtT = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
const parT = i => 30 + (LEVELS[i].rooms || [0]).length * 35;
const starSum = () => Object.values(META.lv).reduce((a, o) => a + (o.s || 0), 0);
function levelStars() {
  const t = game.lvlT || 0, sh = !!LV.ship, h = game.hurtLvl;
  const a = sh ? h <= 2 : !h, b = sh ? !h : t <= parT(lvl), s = 1 + (a ? 1 : 0) + (b ? 1 : 0);
  const o = META.lv[lvl] || { s: 0, t: 0 }, rec = !!o.t && t < o.t;
  META.lv[lvl] = { s: Math.max(o.s || 0, s), t: !o.t || t < o.t ? Math.round(t * 10) / 10 : o.t }; saveMeta();
  const d = sh ? (a ? '★ ' : '☆ ') + 'max 2 trafienia   ' + (b ? '★ ' : '☆ ') + 'bez trafienia'
    : (a ? '★ ' : '☆ ') + 'bez rany   ' + (b ? '★ ' : '☆ ') + 'czas ≤ ' + fmtT(parT(lvl));
  toast('★'.repeat(s) + '☆'.repeat(3 - s), LV.name + ' – ' + fmtT(t) + (rec ? '  NOWY REKORD!' : ''), d);
}

// ===== Encyklopedia (E): wrogowie, planety, stroje, rekordy =====
const CODEX = [
  ['blaster', 'Strażnik z blasterem', 'Podstawowy żołnierz Lordów. Strzela z bliska – odbij strzał ostrzem (A), a wróci do strzelca.'],
  ['rifle', 'Szturmowiec z karabinem', 'Więcej pancerza i dłuższe serie. Podejdź zasłonięty i tnij, zanim przeładuje.'],
  ['shield', 'Tarczownik', 'Ciężka tarcza zatrzymuje cięcia z przodu. Odepchnij go aurą albo zajdź od tyłu.'],
  ['sniper', 'Snajper', 'Celuje długo z drugiego końca komnaty, ale trafia mocno. Skracaj dystans albo się kryj.'],
  ['drone', 'Dron bojowy', 'Mała sonda strzelająca z powietrza. Przyciągnij ją albo strąć piorunami aury.'],
  ['jet', 'Łowca z plecakiem', 'Najemnik z plecakiem odrzutowym. Krąży nad komnatą – ściągnij go aurą na ziemię.'],
  ['raider', 'Najemnicy z Sarrak', 'Pustynni rabusie w goglach i chustach, wynajęci przez Panią Burz.'],
  ['aqua', 'Żołnierze głębin', 'Kombinezony z kopułą hełmu – strzegą zatopionych stacji Thalos.'],
  ['snow', 'Szturmowcy mrozu', 'Białe płyty i futrzane kołnierze. Walczą na śliskim lodzie Krio.'],
  ['scout', 'Zwiadowcy Verdanu', 'Myśliwi w maskujących pelerynach – czają się między pniami leśnego księżyca.'],
  ['ash', 'Gwardia popiołu', 'Elita Ignis w czarnych płytach z żarzącym się wizjerem. Najtwardsi z żołnierzy.'],
  ['droid', 'Droid wartowniczy', 'Mechaniczny strażnik Cytadeli. Strzela seriami po trzy i nigdy nie robi uników – odbijaj i tnij.'],
  ['saur', 'Jaszczur z Sarraku', 'Zwinny gad pustyni. Po trafieniu prawie zawsze odskakuje i strzela dubletem. Przyciśnij go do ściany.'],
  ['gill', 'Skrzelak z Thalos', 'Pluje kwasem i odnawia życie, gdy przestajesz go ranić. Nie dawaj mu wytchnienia.'],
  ['yeti', 'Mroźny olbrzym', 'Bez broni, ale z pięściami jak głazy. Szarżuje przez całą komnatę – zasłoń się (blok) i kontruj.'],
  ['mantis', 'Modliszak z Verdanu', 'Owadzi łowca w kamuflażu – prawie niewidoczny, dopóki cię nie wypatrzy. Tnie pazurami błyskawicznie.'],
  ['magma', 'Magmowiec z Ignis', 'Żywa skała z żarem w szczelinach. Kul magmy nie da się odbić – ostrze tylko je rozprasza.'],
  ['Mroczny Lord', 'Mroczny Lord', 'Pan Cytadeli i najmłodszy z uczniów Arcylorda. „Twoje światło zgaśnie w tych lochach.”'],
  ['Pani Burz', 'Pani Burz', 'Władczyni wydm Sarrak, walczy ostrzem dwustronnym. „Piasek pogrzebie twoje światło.”'],
  ['Lord Głębin', 'Lord Głębin', 'Strażnik zatopionych ruin Thalos, walczy dwoma ostrzami. „Ocean nie oddaje tego, co pochłonie.”'],
  ['Królowa Mrozu', 'Królowa Mrozu', 'Pani lodowego Krio z ostrzem dwustronnym. „Twoje serce zamarznie szybciej niż ostrze.”'],
  ['Łowca Verdanu', 'Łowca Verdanu', 'Myśliwy w skórach i rogach, walczy dwoma ostrzami. „W tym lesie to ja poluję.”'],
  ['Arcylord', 'Arcylord', 'Mistrz wszystkich Lordów, władca wulkanicznego Ignis. „Wszyscy moi uczniowie upadli. Ja nie upadnę.”'],
];
const PLANETS = [
  ['#8a7a9a', 'Mroczna twierdza na skalnej grani. Lochy pełne pułapek, kolców i strażników – tu zaczyna się droga rycerza.'],
  ['#e0b060', 'Pustynna planeta wydm i ruin. Ruchome piaski, burze i najemnicy w służbie Pani Burz.'],
  ['#3090b0', 'Oceaniczny świat zatopionych stacji. Pływanie pod wodą – pilnuj tlenu.'],
  ['#c8e0f0', 'Skuta lodem planeta. Śliskie posadzki, mróz i szturmowcy w bieli.'],
  ['#50a050', 'Leśny księżyc gigantycznych drzew. Pnącza, platformy i łowcy w cieniu liści.'],
  ['#e05020', 'Wulkaniczna twierdza Arcylorda. Rzeki lawy, popiół i ostatnia bitwa sagi.'],
];
const CTABS = ['WROGOWIE', 'PLANETY', 'STROJE', 'REKORDY'];
const seen = k => META.codex.includes(k);
function codexSee() {
  if (!game.live || game.rush) return;
  let ch = false;
  for (const f of FOES) for (const k of [f.k === 'lord' ? lordName(f) : f.k, f.k === 'lord' ? '' : f.sty]) {
    if (k && CODEX.some(e => e[0] === k) && !seen(k)) { META.codex.push(k); ch = true; }
  }
  if (ch) saveMeta();
}
const codexLen = () => [CODEX.length, PLANETS.length, OUTFITS.length, 0][game.ctab];
function openCodex() {
  if (game.mode === 'play' && P && P.st !== 'ship' && P.st !== 'dead' && !game.lock && !game.qte) {
    game.mode = 'codex'; game.ctab = game.ctab || 0; game.csel = 0; game.cmsg = ''; for (const k in K) K[k] = false;
  } else if (game.mode === 'codex') game.mode = 'play';
}
function codexKey(k) {
  const n = CTABS.length;
  if (k === 'left' || k === 'right') { game.ctab = (game.ctab + (k === 'left' ? n - 1 : 1)) % n; game.csel = 0; game.cmsg = ''; }
  else if (k === 'up' || k === 'down') { const m = codexLen(); if (m) game.csel = (game.csel + (k === 'up' ? m - 1 : 1)) % m; game.cmsg = ''; }
  else if (k === 'act' && game.ctab === 2) wearOutfit(OUTFITS[game.csel]);
  else if (k === 'sheathe' || k === 'codex') game.mode = 'play';
}
function codexTap(e) {
  const r = cv.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width * SW, y = (e.clientY - r.top) / r.height * SH;
  if (y > 180) { game.mode = 'play'; return; }
  if (y >= 14 && y <= 27) { const t = Math.floor((x - 20) / 70); if (t >= 0 && t < CTABS.length) { game.ctab = t; game.csel = 0; game.cmsg = ''; } return; }
  const i = Math.floor((y - 31) / codexRow()), m = codexLen();
  if (x < 124 && i >= 0 && i < m) { if (game.csel === i && game.ctab === 2) codexKey('act'); else { game.csel = i; game.cmsg = ''; } }
}
const codexRow = () => (game.ctab === 0 ? Math.min(8.6, 146 / CODEX.length) : 12);
// Postać w dużej skali (bez świecących elementów – kolejki EQ/BQ nie są tu rysowane)
function codexFig(f, x, y, sc) {
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); ctx.translate(-f.x, -f.y);
  try { drawFoe(f); } catch (er) {}
  ctx.restore();
}
function drawCodex() {
  ctx.fillStyle = 'rgba(4,6,16,0.94)'; ctx.fillRect(0, 0, SW, SH);
  txt('ENCYKLOPEDIA ZAKONU', SW / 2, 7, '#f0c040', 'center', 8);
  CTABS.forEach((t, i) => {
    const on = i === game.ctab;
    rrect(20 + i * 70, 14, 66, 12, 2, on ? 'rgba(60,70,110,0.95)' : 'rgba(20,24,38,0.95)');
    txt(t, 53 + i * 70, 20.5, on ? '#ffe080' : '#8890a8', 'center', 6.5);
  });
  const row = codexRow(), list = (items) => items.forEach((it, i) => {
    const y = 31 + i * row, sel = i === game.csel;
    if (sel) rrect(6, y, 116, row - 1, 2, 'rgba(60,70,110,0.9)');
    txt(it[0], 10, y + row / 2 - 0.5, it[1], 'left', row > 10 ? 6.5 : row > 8 ? 6 : 5.5);
  });
  const desc = (s, y, col) => { for (const l of wrapTxt(s, 176, 6)) { txt(l, 220, y, col || '#c8c0b0', 'center', 6); y += 8; } return y; };
  if (game.ctab === 0) {
    list(CODEX.map(e => seen(e[0]) ? [e[1], META.lords.includes(e[0]) ? '#ff9090' : '#c8d0e0'] : ['???', '#4a5064']));
    const li = game.csel - CODEX.findIndex(q => q[0] === 'Mroczny Lord'), e = CODEX[game.csel], ok = seen(e[0]), lord = li >= 0;
    if (ok) {
      const ty = lord ? 'lord' : ['blaster', 'rifle', 'shield', 'sniper', 'drone', 'jet'].includes(e[0]) ? e[0] : 'blaster';
      const sty = lord ? ['lord', 'lord2', 'lord3', 'lord4', 'lord5', 'lord6'][li] : ty === e[0] ? '' : e[0];
      const f = mkFoe({ k: ty, sty: sty || undefined, name: lord ? e[0] : undefined, r: 2, c: 5, dir: -1,
        dbl: lord && [1, 3].includes(li), dual: lord && [2, 4, 5].includes(li) });
      f.st = 'idle';
      codexFig(f, 220, ty === 'drone' || ty === 'jet' ? 80 : 112, 2.4);
      txt(e[1], 220, 124, lord ? '#ff9090' : '#ffe080', 'center', 8);
      desc(e[2], 136);
      if (lord) txt(META.lords.includes(e[0]) ? '✓ pokonany' : 'jeszcze niepokonany', 220, 170, META.lords.includes(e[0]) ? '#90ffb0' : '#a08080', 'center', 6);
    } else { txt('???', 220, 90, '#4a5064', 'center', 14); desc('Jeszcze nie spotkany. Encyklopedia uzupełnia się sama, gdy wejdziesz do komnaty z nowym przeciwnikiem.', 120, '#6a7088'); }
  } else if (game.ctab === 1) {
    const ch = chapStarts(), best = META.best || 0;
    list(ch.map((i, k) => i <= best ? [ROMAN[k] + '. ' + LEVELS[i].chapter.replace(/^ROZDZIAŁ \S+ [–-] /i, ''), '#c8d0e0'] : [ROMAN[k] + '. ???', '#4a5064']));
    const i = ch[game.csel], P_ = PLANETS[game.csel] || PLANETS[0];
    if (i <= best) {
      const cx = 220, cy = 70;
      ctx.fillStyle = P_[0]; ctx.beginPath(); ctx.arc(cx, cy, 26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(cx + 9, cy + 6, 24, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.arc(cx - 9, cy - 9, 8, 0, Math.PI * 2); ctx.fill();
      txt(LEVELS[i].chapter, cx, 108, '#ffe080', 'center', 7.5);
      const y = desc(P_[1], 120);
      const end = ch[game.csel + 1] || LEVELS.length;
      let st = 0; for (let q = i; q < end; q++) st += (META.lv[q] && META.lv[q].s) || 0;
      txt('☆ gwiazdki w rozdziale: ' + st + '/' + (end - i) * 3, cx, y + 6, '#c8b890', 'center', 6);
    } else { txt('???', 220, 90, '#4a5064', 'center', 14); desc('Planeta jeszcze nieodkryta.', 120, '#6a7088'); }
  } else if (game.ctab === 2) {
    const cur = outfit();
    list(OUTFITS.map(o => o.ok() ? [(o === cur ? '► ' : '') + o.name, o === cur ? '#90ffb0' : '#c8d0e0'] : ['🔒 ' + o.name, '#4a5064']));
    const o = OUTFITS[game.csel];
    ctx.save(); ctx.translate(220, 112); ctx.scale(2.6, 2.6);
    try { drawFig(0, 0, 1, POSE.stand, Object.assign({}, STY.hero, o.s), { blade: 'hip', bc: game.blade }); } catch (er) {}
    ctx.restore();
    if (!o.ok()) { ctx.fillStyle = 'rgba(4,6,16,0.7)'; ctx.fillRect(170, 26, 100, 90); }
    txt(o.name, 220, 124, '#ffe080', 'center', 8);
    desc(o.ok() ? o.d : 'Odblokuj: ' + o.need, 136, o.ok() ? '#c8c0b0' : '#a08080');
    if (game.cmsg) txt(game.cmsg, 220, 168, '#ffe080', 'center', 6);
  } else {
    const ch = chapStarts();
    ch.forEach((i, k) => {
      const x = 8 + k * 52, end = ch[k + 1] || LEVELS.length;
      txt(ROMAN[k], x + 24, 33, '#f0c040', 'center', 7);
      for (let q = i; q < end; q++) {
        const o = META.lv[q], y = 42 + (q - i) * 13;
        txt(String(q + 1), x + 2, y, '#8890a8', 'left', 5.5);
        txt(o ? '★'.repeat(o.s) + '☆'.repeat(3 - o.s) : '☆☆☆', x + 12, y, o ? '#ffe080' : '#3a4050', 'left', 5.5);
        if (o && o.t) txt(fmtT(o.t), x + 50, y, '#a8b0c8', 'right', 5);
      }
    });
    txt('☆ Gwiazdki: ' + starSum() + '/' + LEVELS.length * 3 + '    ✦ Sagi ukończone: ' + (META.wins || 0) +
      (META.ngc ? '  (NG+ cykl ' + META.ngc.ngp + ')' : ''), SW / 2, 132, '#c8d0e0', 'center', 6.5);
    txt('⚔ Starcia z Lordami: ' + (META.rush ? META.rush.n + ' Lordów w ' + fmtT(META.rush.t) : 'brak rekordu'), SW / 2, 144, '#ff9090', 'center', 6.5);
    txt('Gwiazdki: ukończenie · bez rany · czas w normie (przelot: ≤2 trafienia · bez trafienia)', SW / 2, 158, '#6a7088', 'center', 5);
  }
  txt('←→ zakładka · ↑↓ wybór' + (game.ctab === 2 ? ' · A załóż' : '') + ' · E/S zamknij', SW / 2, 189, '#8890a8', 'center', 6.5);
}

// ===== Stroje bohatera =====
const OUTFITS = [
  { id: 'std', name: 'Płaszcz zakonu', need: '', ok: () => true, d: 'Klasyczny strój rycerza Zakonu Mistrzów.', s: {} },
  { id: 'sand', name: 'Strój z Sarrak', need: 'dotrzyj do rozdziału II.', ok: () => (META.best || 0) >= 6, d: 'Lekka tkanina chroniąca przed piaskiem pustyni.',
    s: { cloak: '#c8a060', cloakB: '#9a7840', body: '#eadcb4', bodyB: '#c0a878', arm: '#dcc494', armB: '#a89060', hair: '#6a4020' } },
  { id: 'deep', name: 'Kombinezon głębin', need: 'dotrzyj do rozdziału III.', ok: () => (META.best || 0) >= 12, d: 'Szczelny kombinezon nurków z Thalos.',
    s: { cloak: '#1e5060', cloakB: '#143a46', body: '#4a8a98', bodyB: '#326a78', arm: '#5a9aa8', armB: '#3a7080', leg: '#24404a', legB: '#18303a' } },
  { id: 'fur', name: 'Futro z Krio', need: 'dotrzyj do rozdziału IV.', ok: () => (META.best || 0) >= 18, d: 'Ciepłe futro tropicieli lodowej planety.',
    s: { cloak: '#e8eef4', cloakB: '#b0bcc8', body: '#c8d4e0', bodyB: '#98a8b8', arm: '#d0dce8', armB: '#a0b0c0', belt: '#5a6a7a' } },
  { id: 'pilot', name: 'Kombinezon pilota', need: 'osiągnięcie „As przestworzy”.', ok: () => !!META.achv.pilot, d: 'Pomarańczowy kombinezon pilotów Republiki.',
    s: { cloak: '#c85020', cloakB: '#903818', body: '#e07030', bodyB: '#b05020', arm: '#e07030', armB: '#b05020', belt: '#e8e8e8' } },
  { id: 'white', name: 'Biała szata mistrza', need: 'ukończ grę.', ok: () => !!META.achv.saga, d: 'Szata członków Nowej Rady Zakonu.',
    s: { cloak: '#f0ece0', cloakB: '#c8c0b0', body: '#fffaf0', bodyB: '#d8d0c0', arm: '#f4f0e4', armB: '#c8c0b0', leg: '#d8d0c0', legB: '#a8a090', belt: '#c0a060' } },
  { id: 'shadow', name: 'Czarny pancerz', need: 'osiągnięcie „Ścieżka gniewu”.', ok: () => !!META.achv.dark, d: 'Zbroja tych, którzy przyjęli moc gniewu.',
    s: { cloak: '#1a1418', cloakB: '#0e0a0e', body: '#2a242a', bodyB: '#1a161a', arm: '#2a242a', armB: '#1a161a', leg: '#1a161a', legB: '#0e0c0e', belt: '#8a1420' } },
  { id: 'gold', name: 'Złota zbroja Rady', need: 'pokonaj wszystkich sześciu Lordów.', ok: () => !!META.achv.lords, d: 'Ceremonialna zbroja pogromców Lordów.',
    s: { cloak: '#8a2020', cloakB: '#601414', body: '#e8c050', bodyB: '#b89030', arm: '#e0b848', armB: '#a88028', belt: '#6a4010' } },
];
const outfit = () => OUTFITS.find(o => o.id === META.outfit && o.ok()) || OUTFITS[0];
const HEROS = {};
const heroSty = () => { const o = outfit(); return HEROS[o.id] || (HEROS[o.id] = Object.assign({}, STY.hero, o.s)); };
function wearOutfit(o) {
  if (!o.ok()) { game.cmsg = 'Strój zablokowany – ' + o.need; SND.click(); return; }
  META.outfit = o.id; saveMeta(); game.cmsg = 'Założono: ' + o.name; SND.ignite();
}

// ===== Nowa gra+ =====
// Po ukończeniu sagi umiejętności, kryształy, ostrze i ulepszenia myśliwca przechodzą do kolejnego cyklu;
// wrogowie mają +1 życie, Lordowie +2 (z każdym cyklem).
function sagaWon() {
  META.wins = (META.wins || 0) + 1;
  META.ngc = { ngp: (game.ngp || 0) + 1, crys: game.crys, spent: game.spent, sk: Object.assign({}, game.sk), slots: game.slots.slice(),
    maxHp: game.maxHp, blade: game.blade.id, ship: Object.assign({}, game.shipUp || {}) };
  saveMeta();
}
function ngGame() {
  const c = META.ngc;
  if (!c) { beginGame(); return; }
  leaveTitle(); newGame();
  game.crys = game.crysLvl = c.crys; game.spent = c.spent; game.sk = Object.assign({}, c.sk); game.slots = c.slots.slice();
  game.maxHp = game.lvlMax = c.maxHp; game.blade = bladeById(c.blade); game.shipUp = Object.assign(shipUp0(), c.ship || {});
  game.ngp = c.ngp; game.lp = undefined; game.snap = skSnap(); updLabels();
  P.max = P.hp = hpMax();
  saveRun();
}

// ===== Starcia z Lordami (boss rush) =====
// Kolejni pokonani Lordowie (do najdalszego poziomu), start od razu w ich sali. Życie przechodzi dalej (+1 po każdym).
const lordRoom = i => (LEVELS[i].rooms || []).findIndex(R => (R.foes || []).some(f => f.k === 'lord'));
const rushList = () => LEVELS.map((l, i) => i).filter(i => i <= (META.best || 0) && lordRoom(i) >= 0);
function rushGame() {
  const list = rushList();
  if (!list.length) return;
  leaveTitle();
  game.vEnd = false; game.dark = 0; game.path = ''; game.lp = undefined; game.ngp = 0; game.shipUp = shipUp0();
  game.maxHp = 5; game.time = 0; game.crys = 0; game.spent = 0; game.blade = BLADES[0];
  game.sk = {}; SKILLS.forEach(c => c.nodes.forEach(n => { game.sk[n.id] = n.free ? 0 : 2; }));
  game.slots = ['pull', 'bolt'];
  game.rush = { list, i: 0, hp: 0 };
  loadLevel(list[0]);
}
function rushNext() {
  const R = game.rush;
  R.hp = Math.min(P.max, P.hp + 1); R.i++;
  if (R.i < R.list.length) { loadLevel(R.list[R.i]); toast('⚔ LORD POKONANY', 'Starcie ' + (R.i + 1) + '/' + R.list.length, '+1 życie przed kolejną walką'); return; }
  const n = R.list.length, t = game.time, o = META.rush;
  R.rec = !o || n > o.n || (n === o.n && t < o.t);
  if (R.rec) { META.rush = { n, t: Math.round(t * 10) / 10 }; saveMeta(); }
  game.mode = 'win'; SND.win();
}
function drawRushWin() {
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, SW, 180);
  const R = game.rush;
  txt('STARCIA Z LORDAMI', SW / 2, 60, '#ff7060', 'center', 13);
  txt('Pokonani Lordowie: ' + R.list.length + '   Czas: ' + fmtT(game.time), SW / 2, 84, '#e8d8b0', 'center', 8);
  txt(R.rec ? 'NOWY REKORD!' : 'Rekord: ' + META.rush.n + ' Lordów w ' + fmtT(META.rush.t), SW / 2, 100, R.rec ? '#ffe080' : '#a8a0c0', 'center', 8);
  txt('A – menu główne', SW / 2, 124, '#a0a0b0');
}
