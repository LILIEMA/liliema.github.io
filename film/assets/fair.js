/* FILMING COPY (28 October 2026) of bookfair/assets/fair.js: page titles without the fair name; its own storage key. */
/* LILIEMA at the Helsinki Book Fair 2026: shared code for all pages.
   Interface languages: Finnish (default), Swedish, English, French.
   Plain script (no modules), so the pages also work when opened from the laptop's disk. */
(function () {
  'use strict';
  var LANGS = ['fi', 'sv', 'en', 'fr'];
  var LOCALES = { fi: 'fi-FI', sv: 'sv-FI', en: 'en-GB', fr: 'fr-FR' };
  var STORE_KEY = 'liliema-film-lang';
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
    'ƈ': 'c', 'ƭ': 't', 'ʼ': "'", '’': "'", '‘': "'", 'œ': 'oe', 'æ': 'ae'
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
      if (tk) document.title = Fair.t(tk) + ' · LILIEMA';   // filming copy: no fair name
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

    /* Credit line for the pictures in the interface language; empty until the name is set in the app data */
    pictureCredit: function () {
      var p = (window.FAIR_DATA || {}).picture_credit;
      return p && p.name ? Fair.t('credit.pictures', p.name, p.licence || '') : '';
    },

    number: function (n) {
      try { return Number(n).toLocaleString(LOCALES[lang]); } catch (e) { return String(n); }
    }
  };

  Fair.add({
    fi: { 'fair.name': 'Helsingin kirjamessut 2026', 'fair.langs': 'Kieli', 'site.label': 'LILIEMAn verkkosivut:',
      'credit.tools': 'LILIEMA-työkalut: tekninen kehitys Friederike Lüpke, kehitetty yhdessä vuoden 2026 LILIEMA-työpajojen osallistujien kanssa.',
      'credit.pictures': function (name, licence) { return 'Kuvat: ' + name + ' (LILIEMA)' + (licence ? ', ' + licence + ' (muokattu verkkoon)' : '') + '.'; } },
    sv: { 'fair.name': 'Helsingfors bokmässa 2026', 'fair.langs': 'Språk', 'site.label': 'LILIEMAs webbplats:',
      'credit.tools': 'LILIEMAs verktyg: teknisk utveckling Friederike Lüpke, utvecklade tillsammans med deltagarna i LILIEMAs workshoppar 2026.',
      'credit.pictures': function (name, licence) { return 'Bilder: ' + name + ' (LILIEMA)' + (licence ? ', ' + licence + ' (bearbetade för webben)' : '') + '.'; } },
    en: { 'fair.name': 'Helsinki Book Fair 2026', 'fair.langs': 'Language', 'site.label': 'LILIEMA website:',
      'credit.tools': 'LILIEMA tools: technical development by Friederike Lüpke, co-developed with the participants in the 2026 LILIEMA workshops.',
      'credit.pictures': function (name, licence) { return 'Pictures: ' + name + ' for LILIEMA' + (licence ? ', ' + licence + ' (adapted for the web)' : '') + '.'; } },
    fr: { 'fair.name': 'Salon du livre d’Helsinki 2026', 'fair.langs': 'Langue', 'site.label': 'Site web de LILIEMA :',
      'credit.tools': 'Outils LILIEMA : développement technique par Friederike Lüpke, co-développés avec les participants aux ateliers LILIEMA de 2026.',
      'credit.pictures': function (name, licence) { return 'Images : ' + name + ' pour LILIEMA' + (licence ? ', ' + licence + ' (adaptées pour le web)' : '') + '.'; } }
  });

  // Texts shared by the pages where visitors send words or answers (consent asked once per visit, see visit.js)
  Fair.add({
    fi: {
      'consent.title': 'Tutkimus ja opetus',
      'consent.text': 'Sanasi ja vastauksesi tallennetaan ilman nimeäsi. Suostumuksellasi LILIEMA ja Helsingin yliopisto voivat käyttää niitä myös tutkimuksessa ja opetuksessa. Silloin ne pidetään yhdessä satunnaisen numeron alla, jotta näemme, mitkä sanat ja kielet tulevat samalta kävijältä. Ilman suostumusta niitä käytetään vain messuilla. Koska niissä ei ole nimeä, niitä ei voi jälkikäteen yhdistää sinuun eikä poistaa.',
      'consent.box': 'Olen vähintään 15-vuotias ja annan suostumukseni.',
      'notice.entry': 'Sanasi näkyy näytöllä heti. Älä kirjoita nimiä tai muita henkilötietoja.',
      'kb.space': 'välilyönti', 'kb.all': 'kaikki', 'kb.lang': 'kielen', 'kb.shift': 'isot kirjaimet', 'kb.backspace': 'poista'
    },
    sv: {
      'consent.title': 'Forskning och undervisning',
      'consent.text': 'Dina ord och svar sparas utan ditt namn. Med ditt samtycke kan LILIEMA och Helsingfors universitet också använda dem i forskning och undervisning. Då hålls de samman under ett slumpmässigt nummer, så att vi kan se vilka ord och språk som kommer från samma besökare. Utan samtycke används de bara under mässan. Eftersom de inte har något namn kan de inte senare kopplas till dig eller tas bort.',
      'consent.box': 'Jag är 15 år eller äldre och ger mitt samtycke.',
      'notice.entry': 'Ditt ord visas genast på skärmen. Skriv inga namn eller andra personuppgifter.',
      'kb.space': 'mellanslag', 'kb.all': 'alla', 'kb.lang': 'språkets', 'kb.shift': 'versaler', 'kb.backspace': 'radera'
    },
    en: {
      'consent.title': 'Research and teaching',
      'consent.text': 'Your words and answers are stored without your name. With your agreement, LILIEMA and the University of Helsinki may also use them in research and teaching, kept together under a random number so that we can see which words and languages come from the same visitor. Without it, they are used only at the fair. As they carry no name, they cannot be traced back to you or withdrawn later.',
      'consent.box': 'I am 15 or older and I agree.',
      'notice.entry': 'Your word appears on the screen straight away. Please do not write names or other personal information.',
      'kb.space': 'space', 'kb.all': 'all', 'kb.lang': 'language', 'kb.shift': 'capitals', 'kb.backspace': 'delete'
    },
    fr: {
      'consent.title': 'Recherche et enseignement',
      'consent.text': 'Vos mots et vos réponses sont enregistrés sans votre nom. Avec votre accord, LILIEMA et l’Université d’Helsinki peuvent aussi les utiliser dans la recherche et l’enseignement ; ils sont alors regroupés sous un numéro aléatoire, afin que nous puissions voir quels mots et quelles langues viennent d’une même personne. Sans votre accord, ils ne servent que pendant le salon. Comme ils ne portent pas de nom, ils ne peuvent ni vous être rattachés ni être retirés par la suite.',
      'consent.box': 'J’ai 15 ans ou plus et je donne mon accord.',
      'notice.entry': 'Votre mot apparaît aussitôt à l’écran. Merci de ne pas écrire de noms ni d’autres informations personnelles.',
      'kb.space': 'espace', 'kb.all': 'toutes', 'kb.lang': 'langue', 'kb.shift': 'majuscules', 'kb.backspace': 'effacer'
    }
  });

  window.Fair = Fair;
})();
