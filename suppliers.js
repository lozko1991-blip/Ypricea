/* ═══════════════════════════════════════════════════════════════
   suppliers.js — РЕЄСТР ПОСТАЧАЛЬНИКІВ (спільний для сайту)
   ───────────────────────────────────────────────────────────────
   Тут описано всіх постачальників і правило, як визначити, з якого
   постачальника товар/категорія. Щоб додати нового постачальника
   в майбутньому — просто додай запис у MASTEREVA_SUPPLIERS
   (префікс categoryId + назва + колір) і все.

   Як працює визначення джерела:
   • Товари ЯВШОКЕ беруться з allyavdata.json — у них немає поля src,
     тому за замовчуванням вони отримують src='yavshoke'.
   • Товари Mastereva беруться з mastereva.json — у кожного вже є
     поле src (його проставляє сервер у process.mjs за тим самим
     правилом, що й тут). Якщо раптом src немає — визначаємо по
     префіксу categoryId.

   Префікси categoryId беруться з masterevaxml.py:
     1111 → shkatulka, 2222 → opt-drop, 3333 → lugi,
     4444 → dropom, 5555 → royaltoys, без префіксу → kievopt
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  // ── ЯВШОКЕ (основний, дані з allyavdata.json) ──
  var YAVSHOKE = {
    key: 'yavshoke',
    label: 'ЯВШОКЕ',
    short: 'ЯВ',
    color: '#0ea5e9',     // блакитний
    bg: '#e0f2fe',
    text: '#0369a1',
  };

  // ── MASTEREVA: 6 джерел. prefix — початок categoryId. ──
  // Порядок важливий: довші/специфічніші префікси перевіряємо першими.
  var MASTEREVA_SUPPLIERS = [
    { key: 'ev_shkatulka', prefix: '1111', label: 'Mastereva · Shkatulka', short: 'SH', color: '#f59e0b', bg: '#fef3c7', text: '#b45309' },
    { key: 'ev_optdrop',   prefix: '2222', label: 'Mastereva · Opt-Drop',  short: 'OD', color: '#8b5cf6', bg: '#ede9fe', text: '#6d28d9' },
    { key: 'ev_lugi',      prefix: '3333', label: 'Mastereva · Lugi',      short: 'LU', color: '#ec4899', bg: '#fce7f3', text: '#be185d' },
    { key: 'ev_dropom',    prefix: '4444', label: 'Mastereva · Dropom',    short: 'DR', color: '#10b981', bg: '#d1fae5', text: '#047857' },
    { key: 'ev_royaltoys', prefix: '5555', label: 'Mastereva · RoyalToys', short: 'RT', color: '#ef4444', bg: '#fee2e2', text: '#b91c1c' },
  ];

  // kievopt — без префіксу категорії (фолбек для Mastereva-товарів,
  // що не підпали під жоден префікс).
  var MASTEREVA_DEFAULT = {
    key: 'ev_kievopt',
    label: 'Mastereva · KievOpt',
    short: 'KO',
    color: '#64748b',
    bg: '#e2e8f0',
    text: '#475569',
  };

  // Швидкий доступ по ключу
  var BY_KEY = {};
  BY_KEY[YAVSHOKE.key] = YAVSHOKE;
  MASTEREVA_SUPPLIERS.forEach(function (s) { BY_KEY[s.key] = s; });
  BY_KEY[MASTEREVA_DEFAULT.key] = MASTEREVA_DEFAULT;
  // загальний «Mastereva» — коли треба показати все одним бейджем
  var MASTEREVA_ANY = { key: 'mastereva', label: 'Mastereva', short: 'ME', color: '#7c3aed', bg: '#ede9fe', text: '#6d28d9' };
  BY_KEY[MASTEREVA_ANY.key] = MASTEREVA_ANY;

  /** Визначити постачальника Mastereva за categoryId (рядок або число). */
  function masterevaSrcByCat(categoryId) {
    var id = String(categoryId == null ? '' : categoryId);
    for (var i = 0; i < MASTEREVA_SUPPLIERS.length; i++) {
      if (id.indexOf(MASTEREVA_SUPPLIERS[i].prefix) === 0) return MASTEREVA_SUPPLIERS[i].key;
    }
    return MASTEREVA_DEFAULT.key; // kievopt / невідомий префікс
  }

  /** Чи є ключ джерела «Mastereva» (будь-яке з 6)? */
  function isMastereva(srcKey) {
    if (!srcKey || srcKey === YAVSHOKE.key) return false;
    return srcKey.indexOf('ev_') === 0 || srcKey === MASTEREVA_ANY.key;
  }

  /** Повний об'єкт постачальника за ключем (з фолбеком на ЯВШОКЕ). */
  function info(srcKey) {
    return BY_KEY[srcKey] || YAVSHOKE;
  }

  /** HTML-бейдж постачальника (маленький, для дерева/карток). */
  function badge(srcKey, opts) {
    var s = info(srcKey);
    opts = opts || {};
    var full = opts.full ? s.label : s.short;
    var title = s.label;
    var style = 'display:inline-flex;align-items:center;gap:3px;font-size:' + (opts.full ? '.62rem' : '.55rem') +
      ';font-weight:800;line-height:1;padding:' + (opts.full ? '2px 6px' : '1px 4px') +
      ';border-radius:6px;background:' + s.bg + ';color:' + s.text + ';white-space:nowrap;vertical-align:middle;';
    return '<span class="sup-badge" data-src="' + s.key + '" title="' + title + '" style="' + style + '">' +
      '<span style="width:6px;height:6px;border-radius:50%;background:' + s.color + ';display:inline-block;"></span>' + full + '</span>';
  }

  global.SUPPLIERS = {
    YAVSHOKE: YAVSHOKE,
    MASTEREVA_SUPPLIERS: MASTEREVA_SUPPLIERS,
    MASTEREVA_DEFAULT: MASTEREVA_DEFAULT,
    MASTEREVA_ANY: MASTEREVA_ANY,
    masterevaSrcByCat: masterevaSrcByCat,
    isMastereva: isMastereva,
    info: info,
    badge: badge,
    all: function () {
      return [YAVSHOKE].concat(MASTEREVA_SUPPLIERS).concat([MASTEREVA_DEFAULT]);
    },
  };

  // Для Node (process.mjs) — щоб сервер користувався тим самим правилом
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.SUPPLIERS;
  }
})(typeof window !== 'undefined' ? window : globalThis);
