/* LILIEMA at the Helsinki Book Fair 2026: shared code for all pages.
   Interface languages: Finnish (default), Swedish, English, French.
   Plain script (no modules), so the pages also work when opened from the laptop's disk. */
(function () {
  'use strict';
  var LANGS = ['fi', 'sv', 'en', 'fr'];
  var LOCALES = { fi: 'fi-FI', sv: 'sv-FI', en: 'en-GB', fr: 'fr-FR' };
  var STORE_KEY = 'liliema-bookfair-lang';
  var lang = 'fi';
  try {
    var saved = window.localStorage.getItem(STORE_KEY);
    if (LANGS.indexOf(saved) >= 0) lang = saved;
  } catch (e) { /* storage unavailable: keep the default */ }
  try {
    var q = new URLSearchParams(window.location.search).get('lang');
    if (LANGS.indexOf(q) >= 0) lang = q;
  } catch (e) { /* ignore */ }

  var strings = { fi: {}, sv: {}, en: {}, fr: {} };
  var listeners = [];

  // Letters that do not decompose under NFD, folded for searching
  var FOLD = {
    'ŋ': 'ng', 'ɓ': 'b', 'ɗ': 'd', 'ƴ': 'y', 'ɲ': 'ny',
    'ɛ': 'e', 'ɔ': 'o', 'ʃ': 'sh', 'ƒ': 'f', 'ʋ': 'v',
    'ɣ': 'g', 'ɖ': 'd', 'ʒ': 'zh', 'ƙ': 'k', 'ƥ': 'p',
    'ƈ': 'c', 'ƭ': 't', 'ʼ': "'", '’': "'", '‘': "'"
  };
  var COMBINING = /[̀-ͯ]/g;

  function foldChar(ch) {
    var d = ch.normalize('NFD').replace(COMBINING, '').toLowerCase();
    var out = '';
    for (var i = 0; i < d.length; i++) out += (FOLD[d[i]] !== undefined ? FOLD[d[i]] : d[i]);
    return out;
  }

  var Fair = {
    LANGS: LANGS,
    get lang() { return lang; },
    strings: strings,   // read-only use: lets the checking workbook list every text

    /* Register strings: Fair.add({ fi: {...}, sv: {...}, en: {...}, fr: {...} }) */
    add: function (dict) {
      LANGS.forEach(function (l) {
        var d = dict[l] || {};
        Object.keys(d).forEach(function (k) { strings[l][k] = d[k]; });
      });
    },

    /* Translate a key; a string value or a function of the extra arguments */
    t: function (key) {
      var args = Array.prototype.slice.call(arguments, 1);
      var v = strings[lang][key];
      if (v === undefined) v = strings.en[key];
      if (v === undefined) return key;
      return typeof v === 'function' ? v.apply(null, args) : v;
    },

    setLang: function (l) {
      if (LANGS.indexOf(l) < 0) return;
      lang = l;
      try { window.localStorage.setItem(STORE_KEY, l); } catch (e) { /* ignore */ }
      Fair.apply();
      listeners.forEach(function (f) { f(l); });
    },

    onLang: function (f) { listeners.push(f); },

    /* Fill elements marked data-t (text), data-t-placeholder, data-t-aria, data-t-title */
    apply: function (root) {
      root = root || document;
      document.documentElement.lang = lang;
      root.querySelectorAll('[data-t]').forEach(function (el) { el.textContent = Fair.t(el.getAttribute('data-t')); });
      root.querySelectorAll('[data-t-placeholder]').forEach(function (el) { el.placeholder = Fair.t(el.getAttribute('data-t-placeholder')); });
      root.querySelectorAll('[data-t-aria]').forEach(function (el) { el.setAttribute('aria-label', Fair.t(el.getAttribute('data-t-aria'))); });
      root.querySelectorAll('[data-t-title]').forEach(function (el) { el.title = Fair.t(el.getAttribute('data-t-title')); });
      document.querySelectorAll('.lang-btn').forEach(function (b) {
        var on = b.getAttribute('data-lang') === lang;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      var tk = document.body && document.body.getAttribute('data-title');
      if (tk) document.title = Fair.t(tk) + ' · ' + Fair.t('fair.name');
    },

    /* Wire the language buttons in the header */
    initHeader: function () {
      document.querySelectorAll('.lang-btn').forEach(function (b) {
        b.addEventListener('click', function () { Fair.setLang(b.getAttribute('data-lang')); });
      });
    },

    /* Key used to match glosses: NFC, trimmed, single spaces, straight apostrophes, lower case */
    key: function (s) {
      return String(s == null ? '' : s).normalize('NFC').trim().replace(/\s+/g, ' ')
        .replace(/[’‘]/g, "'").toLowerCase();
    },

    /* Search form: no tones, dots or other diacritics; special letters folded (ŋ = ng, ɓ = b ...) */
    fold: function (s) {
      var str = String(s == null ? '' : s);
      var out = '';
      for (var ch of str) out += foldChar(ch);
      return out;
    },

    /* Folded text plus a map from each folded position to the original position (for highlighting) */
    foldMap: function (s) {
      var str = String(s == null ? '' : s);
      var out = '', map = [], pos = 0;
      for (var ch of str) {
        var f = foldChar(ch);
        for (var i = 0; i < f.length; i++) { out += f[i]; map.push(pos); }
        pos += ch.length;
      }
      map.push(pos);
      return { text: out, map: map };
    },

    esc: function (s) {
      return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },

    /* Escaped text with the first match of the (folded) query marked */
    highlight: function (text, query) {
      var t = String(text == null ? '' : text);
      var fq = Fair.fold(query).trim();
      if (!fq) return Fair.esc(t);
      var fm = Fair.foldMap(t);
      var i = fm.text.indexOf(fq);
      if (i < 0) return Fair.esc(t);
      // Extend the end to cover the whole original letter (ŋ folds to two letters)
      var last = fm.map[i + fq.length - 1], j = i + fq.length;
      while (j < fm.map.length - 1 && fm.map[j] === last) j++;
      var a = fm.map[i], b = fm.map[j];
      return Fair.esc(t.slice(0, a)) + '<mark>' + Fair.esc(t.slice(a, b)) + '</mark>' + Fair.esc(t.slice(b));
    },

    locale: function () { return LOCALES[lang]; },

    number: function (n) {
      try { return Number(n).toLocaleString(LOCALES[lang]); } catch (e) { return String(n); }
    }
  };

  Fair.add({
    fi: { 'fair.name': 'Helsingin kirjamessut 2026', 'fair.langs': 'Kieli' },
    sv: { 'fair.name': 'Helsingfors bokmässa 2026', 'fair.langs': 'Språk' },
    en: { 'fair.name': 'Helsinki Book Fair 2026', 'fair.langs': 'Language' },
    fr: { 'fair.name': 'Salon du livre d’Helsinki 2026', 'fair.langs': 'Langue' }
  });

  window.Fair = Fair;
})();
