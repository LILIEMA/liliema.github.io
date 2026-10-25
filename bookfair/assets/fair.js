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

  // After the fair (25 October 2026) the pages are a read-only record: the database takes no new words, answers or
  // visit counts (liliema-ops sql/bookfair_close.sql). Texts with a key ending in @closed replace their open version,
  // Add a word shows a notice instead of the form, and Check the AI shows the results instead of the game. Set CLOSED
  // to false only after reopening the database with the lines in that script's header. (Tests of the open pages set
  // window.FAIR_TEST_OPEN before this file loads.)
  var CLOSED = window.FAIR_TEST_OPEN !== true;

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
    closed: CLOSED,
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
      if (CLOSED && (strings[lang][key + '@closed'] !== undefined || strings.en[key + '@closed'] !== undefined)) key += '@closed';
      var v = strings[lang][key];
      if (v === undefined) v = strings.en[key];
      if (v === undefined) return key;
      return typeof v === 'function' ? v.apply(null, args) : v;
    },

    /* A text in a given interface language (for lines shown in all four at once), with the same @closed rule as t */
    str: function (l, key) {
      var s = strings[l] || {};
      return CLOSED && s[key + '@closed'] !== undefined ? s[key + '@closed'] : s[key];
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
      'var.note': 'Omat sanasi voivat olla erilaisia kuin tässä näkyvät. Lisää oma versiosi!', 'var.link': 'Siirry sivulle Lisää sana',
      'credit.tools': 'LILIEMA-työkalut: tekninen kehitys Friederike Lüpke, kehitetty yhdessä vuoden 2026 LILIEMA-työpajojen osallistujien kanssa.',
      'credit.pictures': function (name, licence) { return 'Kuvat: ' + name + ' (LILIEMA)' + (licence ? ', ' + licence + ' (muokattu verkkoon)' : '') + '.'; } },
    sv: { 'fair.name': 'Helsingfors bokmässa 2026', 'fair.langs': 'Språk', 'site.label': 'LILIEMAs webbplats:',
      'var.note': 'Dina ord kan vara annorlunda än de som visas här. Lägg till din egen version!', 'var.link': 'Gå till Lägg till ett ord',
      'credit.tools': 'LILIEMAs verktyg: teknisk utveckling Friederike Lüpke, utvecklade tillsammans med deltagarna i LILIEMAs workshoppar 2026.',
      'credit.pictures': function (name, licence) { return 'Bilder: ' + name + ' (LILIEMA)' + (licence ? ', ' + licence + ' (bearbetade för webben)' : '') + '.'; } },
    en: { 'fair.name': 'Helsinki Book Fair 2026', 'fair.langs': 'Language', 'site.label': 'LILIEMA website:',
      'var.note': 'Your words may be different from the ones shown here. Please add your own version!', 'var.link': 'Go to Add a word',
      'credit.tools': 'LILIEMA tools: technical development by Friederike Lüpke, co-developed with the participants in the 2026 LILIEMA workshops.',
      'credit.pictures': function (name, licence) { return 'Pictures: ' + name + ' for LILIEMA' + (licence ? ', ' + licence + ' (adapted for the web)' : '') + '.'; } },
    fr: { 'fair.name': 'Salon du livre d’Helsinki 2026', 'fair.langs': 'Langue', 'site.label': 'Site web de LILIEMA :',
      'var.note': 'Vos mots peuvent être différents de ceux affichés ici. Ajoutez votre propre version !', 'var.link': 'Aller à Ajoutez un mot',
      'credit.tools': 'Outils LILIEMA : développement technique par Friederike Lüpke, co-développés avec les participants aux ateliers LILIEMA de 2026.',
      'credit.pictures': function (name, licence) { return 'Images : ' + name + ' pour LILIEMA' + (licence ? ', ' + licence + ' (adaptées pour le web)' : '') + '.'; } }
  });

  // Texts shared by the pages where visitors send words or answers (consent asked once per visit, see visit.js)
  Fair.add({
    fi: {
      'consent.title': 'Tutkimus ja opetus',
      'consent.text': 'Sanasi ja vastauksesi tallennetaan ilman nimeäsi. Suostumuksellasi LILIEMA ja Helsingin yliopisto voivat käyttää niitä myös tutkimuksessa ja opetuksessa. Silloin ne pidetään yhdessä satunnaisen numeron alla, jotta näemme, mitkä sanat ja kielet tulevat samalta kävijältä. Ilman suostumusta niitä käytetään vain messuilla. Koska niissä ei ole nimeä, niitä ei voi jälkikäteen yhdistää sinuun eikä poistaa.',
      'consent.box': 'Olen vähintään 15-vuotias ja annan suostumukseni.',
      'notice.entry': 'Sanasi tallennetaan messujen sanakokoelmaan (LILIEMA ja Helsingin yliopiston AfriStadi). Älä kirjoita nimiä tai muita henkilötietoja. Sanat näkyvät näytöllä, kun olemme tarkistaneet ne.',
      'kb.space': 'välilyönti', 'kb.all': 'kaikki', 'kb.lang': 'kielen', 'kb.shift': 'isot kirjaimet', 'kb.backspace': 'poista'
    },
    sv: {
      'consent.title': 'Forskning och undervisning',
      'consent.text': 'Dina ord och svar sparas utan ditt namn. Med ditt samtycke kan LILIEMA och Helsingfors universitet också använda dem i forskning och undervisning. Då hålls de samman under ett slumpmässigt nummer, så att vi kan se vilka ord och språk som kommer från samma besökare. Utan samtycke används de bara under mässan. Eftersom de inte har något namn kan de inte senare kopplas till dig eller tas bort.',
      'consent.box': 'Jag är 15 år eller äldre och ger mitt samtycke.',
      'notice.entry': 'Ditt ord sparas i mässans ordsamling (LILIEMA och AfriStadi, Helsingfors universitet). Skriv inga namn eller andra personuppgifter. Orden visas på skärmen när vi har granskat dem.',
      'kb.space': 'mellanslag', 'kb.all': 'alla', 'kb.lang': 'språkets', 'kb.shift': 'versaler', 'kb.backspace': 'radera'
    },
    en: {
      'consent.title': 'Research and teaching',
      'consent.text': 'Your words and answers are stored without your name. With your agreement, LILIEMA and the University of Helsinki may also use them in research and teaching, kept together under a random number so that we can see which words and languages come from the same visitor. Without it, they are used only at the fair. As they carry no name, they cannot be traced back to you or withdrawn later.',
      'consent.box': 'I am 15 or older and I agree.',
      'notice.entry': 'Your word goes into the fair’s word collection (LILIEMA and AfriStadi, University of Helsinki). Please do not write names or other personal information. Words appear on the screen once we have checked them.',
      'kb.space': 'space', 'kb.all': 'all', 'kb.lang': 'language', 'kb.shift': 'capitals', 'kb.backspace': 'delete'
    },
    fr: {
      'consent.title': 'Recherche et enseignement',
      'consent.text': 'Vos mots et vos réponses sont enregistrés sans votre nom. Avec votre accord, LILIEMA et l’Université d’Helsinki peuvent aussi les utiliser dans la recherche et l’enseignement ; ils sont alors regroupés sous un numéro aléatoire, afin que nous puissions voir quels mots et quelles langues viennent d’une même personne. Sans votre accord, ils ne servent que pendant le salon. Comme ils ne portent pas de nom, ils ne peuvent ni vous être rattachés ni être retirés par la suite.',
      'consent.box': 'J’ai 15 ans ou plus et je donne mon accord.',
      'notice.entry': 'Votre mot entre dans la collection de mots du salon (LILIEMA et AfriStadi, Université d’Helsinki). Merci de ne pas écrire de noms ni d’autres informations personnelles. Les mots apparaissent à l’écran une fois vérifiés.',
      'kb.space': 'espace', 'kb.all': 'toutes', 'kb.lang': 'langue', 'kb.shift': 'majuscules', 'kb.backspace': 'effacer'
    }
  });

  // After the fair (see CLOSED above): the notice, and the texts that no longer invite visitors to add words or answers
  Fair.add({
    fi: {
      'closed.notice': 'Helsingin kirjamessut 2026 ovat päättyneet: kiitos sanoistasi ja vastauksistasi! Sovelluksiin ei voi enää lisätä sanoja eikä vastauksia, mutta voit yhä etsiä sanoja, katsoa sanaseinää ja pelata Kielietsivää.',
      'closed.lookup': 'Etsi sana', 'closed.start': 'Etusivulle',
      'var.note@closed': 'Omat sanasi voivat olla erilaisia kuin tässä näkyvät.',
      'chk.tile@closed': 'Mitä puhujat vastasivat sanoista, jotka tekoäly kirjoitti afrikkalaisilla kielillä.',
      'wall.cta@closed': 'Etsi näitä sanoja puhelimellasi', 'wall.nowords@closed': 'Tälle kuvalle ei ole sanoja.',
      'ai.text@closed': 'Nämä sanat on kirjoittanut tekoäly (Anthropicin Claude). Messuilla puhujat kertoivat meille, ovatko ne oikein.',
      'lu.none.sub@closed': 'Kokeile toista kirjoitusasua.'
    },
    sv: {
      'closed.notice': 'Helsingfors bokmässa 2026 är över: tack för dina ord och svar! Det går inte längre att lägga till ord eller svar i apparna, men du kan fortfarande slå upp ord, titta på ordväggen och spela Språkdetektiven.',
      'closed.lookup': 'Slå upp ett ord', 'closed.start': 'Till startsidan',
      'var.note@closed': 'Dina ord kan vara annorlunda än de som visas här.',
      'chk.tile@closed': 'Vad talarna svarade om orden som en AI skrev på afrikanska språk.',
      'wall.cta@closed': 'Slå upp orden i din telefon', 'wall.nowords@closed': 'Inga ord för den här bilden.',
      'ai.text@closed': 'De här orden har skrivits av en AI (Claude, från Anthropic). På mässan berättade talare för oss om de stämmer.',
      'lu.none.sub@closed': 'Pröva en annan stavning.'
    },
    en: {
      'closed.notice': 'The Helsinki Book Fair 2026 is over: thank you for your words and answers! The apps no longer take new words or answers, but you can still look up words, watch the word wall and play the Language Detective.',
      'closed.lookup': 'Look up a word', 'closed.start': 'To the start page',
      'var.note@closed': 'Your words may be different from the ones shown here.',
      'chk.tile@closed': 'What speakers answered about the words an AI wrote in African languages.',
      'wall.cta@closed': 'Look up these words on your phone', 'wall.nowords@closed': 'No words for this picture.',
      'ai.text@closed': 'These words were written by an AI (Claude, made by Anthropic). At the fair, speakers told us whether they are right.',
      'lu.none.sub@closed': 'Try another spelling.'
    },
    fr: {
      'closed.notice': 'Le Salon du livre d’Helsinki 2026 est terminé : merci pour vos mots et vos réponses ! Les applications n’acceptent plus de nouveaux mots ni de nouvelles réponses, mais vous pouvez toujours chercher des mots, regarder le mur de mots et jouer au Détective des langues.',
      'closed.lookup': 'Cherchez un mot', 'closed.start': 'Vers la page d’accueil',
      'var.note@closed': 'Vos mots peuvent être différents de ceux affichés ici.',
      'chk.tile@closed': 'Ce que les locuteurs ont répondu sur les mots qu’une IA a écrits dans des langues africaines.',
      'wall.cta@closed': 'Cherchez ces mots sur votre téléphone', 'wall.nowords@closed': 'Pas de mots pour cette image.',
      'ai.text@closed': 'Ces mots ont été écrits par une IA (Claude, créée par Anthropic). Au salon, des locuteurs nous ont dit s’ils sont justes.',
      'lu.none.sub@closed': 'Essayez une autre orthographe.'
    }
  });

  // the notice at the top of every visitor page (not the word wall or the approval page); on Add a word only the notice
  function closedPage() {
    var page = window.location.pathname.split('/').pop() || 'index.html';
    if (!CLOSED || page === 'approve.html' || page === 'wall.html' || !document.body) return;
    document.body.classList.add('fair-closed');
    var main = document.querySelector('main.app');
    if (!main || main.querySelector('.closed-notice')) return;
    var box = document.createElement('div');
    box.className = 'closed-notice';
    box.setAttribute('role', 'status');
    box.innerHTML = '<p data-t="closed.notice"></p>' + (page === 'add.html'
      ? '<p class="closed-links"><a class="link-btn" href="lookup.html" data-t="closed.lookup"></a> <a class="link-btn" href="index.html" data-t="closed.start"></a></p>' : '');
    main.insertBefore(box, main.firstChild);
    if (page === 'add.html') document.body.classList.add('closed-add');
    Fair.apply(box);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', closedPage); else closedPage();

  window.Fair = Fair;
})();
