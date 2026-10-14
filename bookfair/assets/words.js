/* LILIEMA at the Helsinki Book Fair 2026: the fair's words, for the pages that only read them (Look up, Language Detective).
   Visitors' words approved by the stall team, the AI's words in the game (not withheld) and what visitors have answered.
   The last data are kept on this device, so the pages keep working without a network; they are fetched every 2 minutes.
   Needs fair_data.js, fair.js, db.js and checkai.js. */
(function () {
  'use strict';
  var F = window.Fair, D = window.FAIR_DATA, S = window.FairScores;
  var CACHE_KEY = 'liliema-bookfair-words';
  var REFRESH_MS = 2 * 60 * 1000;
  var TIMEOUT_MS = 20 * 1000;       // a fetch that hangs counts as no connection after 20 seconds
  // grave, acute, circumflex, macron, caron: tone marks in Yoruba, Igbo, Ewe, Lingala and Naijá
  var TONES = /[\u0300\u0301\u0302\u0304\u030C]/g;
  var HAS_TONE = /[\u0300\u0301\u0302\u0304\u030C]/;
  var TWO_LETTER = { aka: 'ak', ewe: 'ee', hau: 'ha', yor: 'yo', ibo: 'ig', swa: 'sw', kik: 'ki', som: 'so', lin: 'ln', wol: 'wo' };

  var conceptBySlug = {}, langBySlug = {}, conceptOrder = {};
  D.concepts.forEach(function (c, i) { conceptBySlug[c.slug] = c; conceptOrder[c.slug] = i; });
  D.languages.forEach(function (l) { langBySlug[l.slug] = l; });

  // Clue letters: each language's special letters (its keyboard letters), except letters with an accent that other
  // languages write as a tone mark (Wolof à, é, ó are letters, but Yoruba ilé has a high tone on e)
  function clueLetter(ch) { return !HAS_TONE.test(ch.normalize('NFD')); }
  var OWN = {}, LETTER_LANGS = {};   // language -> its clue letters; letter -> the languages that write it
  D.languages.forEach(function (l) {
    OWN[l.slug] = {};
    (l.letters || []).forEach(function (ch) {
      var k = ch.normalize('NFC').toLowerCase();
      if (!clueLetter(k)) return;
      OWN[l.slug][k] = true;
      (LETTER_LANGS[k] = LETTER_LANGS[k] || []).push(l.slug);
    });
  });

  var segmenter = null;
  try { segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' }); } catch (e) { segmenter = null; }

  var listeners = [];
  var byConcept = {};
  var scoresList = [];

  var W = {
    entries: [],      // approved: id, concept_slug, language_slug (null for another language), language_label, headword, example_phrase
    drafts: [],       // in the game: id, concept_slug, language_slug, draft, confidence
    scores: {},       // draft id -> row of ai_scores()
    updated: null,    // time of the data shown (from the network or the device)
    online: null,     // true after a successful fetch, false after a failed one
    tried: false,     // the network has been tried at least once
    loaded: false,    // there are data to show (fetched or kept on the device)

    concept: function (slug) { return conceptBySlug[slug]; },
    language: function (slug) { return langBySlug[slug]; },
    /* Tag for the lang attribute: the two-letter code where there is one (BCP 47), otherwise ISO 639-3 */
    bcp47: function (slug) { var l = langBySlug[slug]; return l ? (TWO_LETTER[l.iso] || l.iso) : ''; },
    conceptOrder: function (slug) { return conceptOrder[slug] == null ? 999 : conceptOrder[slug]; },

    /* Approved words and AI words for one concept */
    forConcept: function (slug) { return byConcept[slug] || { entries: [], drafts: [] }; },

    /* The concept's label in the interface language, and the other three in a fixed order */
    label: function (c) { return c ? (c[F.lang] || c.en) : ''; },
    otherLabels: function (c) {
      var order = { fi: ['sv', 'en', 'fr'], sv: ['fi', 'en', 'fr'], en: ['fi', 'sv', 'fr'], fr: ['fi', 'sv', 'en'] }[F.lang];
      return order.map(function (l) { return { lang: l, text: c[l] }; });
    },

    countryNames: function (l) {
      return (l.countries || []).map(function (k) { var c = D.countries[k]; return c ? c[F.lang] : k; });
    },

    /* "A, B and C" in the interface language */
    list: function (items) {
      try { return new Intl.ListFormat(F.locale(), { style: 'long', type: 'conjunction' }).format(items); }
      catch (e) {
        if (items.length < 2) return items.join('');
        var and = { fi: ' ja ', sv: ' och ', en: ' and ', fr: ' et ' }[F.lang];
        return items.slice(0, -1).join(', ') + and + items[items.length - 1];
      }
    },

    /* Exact form for matching: NFC, lower case, every apostrophe as ʼ (U+02BC), the Yoruba vertical line below
       as a dot below (as the database stores it), single spaces */
    exact: function (s) {
      return String(s == null ? '' : s).normalize('NFD').replace(/\u0329/g, '\u0323').normalize('NFC')
        .replace(/['’‘]/g, 'ʼ').replace(/\s+/g, ' ').trim().toLowerCase();
    },

    /* User-perceived letters: a letter with its marks is one (ẹ́ counts once) */
    graphemes: function (s) {
      s = String(s == null ? '' : s).normalize('NFC');
      if (segmenter) return Array.from(segmenter.segment(s), function (x) { return x.segment; });
      return s.match(/\P{M}\p{M}*|\p{M}+/gu) || [];
    },

    /* The special letters of the word's own language that occur in the word, each with the fair's languages
       that write it. A letter with a tone mark counts as the letter (Yoruba ẹ́ is ẹ). */
    clues: function (word, langSlug) {
      var own = OWN[langSlug];
      if (!own) return [];
      var found = [], seen = {};
      W.graphemes(word).forEach(function (g) {
        var k = clueKey(g, own);
        if (k && !seen[k]) { seen[k] = true; found.push({ letter: k, langs: LETTER_LANGS[k] || [langSlug] }); }
      });
      return found;
    },

    /* The clue letters grouped by the languages that write them: [{ letters: ['ɛ', 'ɔ'], langs: [...] }] */
    clueGroups: function (word, langSlug) {
      var groups = [];
      W.clues(word, langSlug).forEach(function (c) {
        var key = c.langs.join(',');
        var g = groups.filter(function (x) { return x.key === key; })[0];
        if (g) g.letters.push(c.letter); else groups.push({ key: key, letters: [c.letter], langs: c.langs });
      });
      return groups;
    },

    /* The word as HTML, with its clue letters marked */
    markClues: function (word, langSlug) {
      var own = OWN[langSlug] || {};
      return W.graphemes(word).map(function (g) {
        return clueKey(g, own) ? '<mark class="clue">' + F.esc(g) + '</mark>' : F.esc(g);
      }).join('');
    },

    /* What visitors have answered about an AI word: counts and 'right', 'wrong' or 'open' */
    counts: function (d) {
      var r = W.scores[d.id] || {};
      return { right: Number(r.n_right) || 0, wrong: Number(r.n_wrong) || 0, not_sure: Number(r.n_not_sure) || 0 };
    },
    status: function (d) {
      var s = S.status(W.scores[d.id] || {});
      return s === 'right' || s === 'wrong' ? s : 'open';
    },
    /* "The AI's word · unchecked" until speakers have decided, then just "The AI's word" */
    aiLabel: function (d) { return F.t(W.status(d) === 'open' ? 'w.ai' : 'w.ai.short'); },

    onUpdate: function (f) { listeners.push(f); },
    refresh: refresh,
    start: function () {
      loadCache();
      notify();
      refresh();
      setInterval(refresh, REFRESH_MS);
      window.addEventListener('online', refresh);
    },

    /* Status line: fetching / updated at / no connection, last updated at */
    statusText: function () {
      var t = '', d = '';
      if (W.updated) {
        t = W.updated.toLocaleTimeString(F.locale(), { hour: '2-digit', minute: '2-digit' });
        if (W.updated.toDateString() !== new Date().toDateString()) d = W.updated.toLocaleDateString(F.locale(), { day: 'numeric', month: 'numeric' });
      }
      if (!W.loaded) return W.tried ? F.t('w.offline', '', '') : F.t('w.loading');
      return W.online === false ? F.t('w.offline', t, d) : F.t('w.updated', t, d);
    }
  };

  function clueKey(g, own) {
    var lower = g.toLowerCase();
    if (own[lower]) return lower;
    var base = lower.normalize('NFD').replace(TONES, '').normalize('NFC');
    return own[base] ? base : null;
  }

  function index() {
    byConcept = {};
    var get = function (slug) { return byConcept[slug] || (byConcept[slug] = { entries: [], drafts: [] }); };
    W.entries.forEach(function (e) { if (conceptBySlug[e.concept_slug]) get(e.concept_slug).entries.push(e); });
    W.drafts.forEach(function (d) {
      if (conceptBySlug[d.concept_slug] && langBySlug[d.language_slug]) get(d.concept_slug).drafts.push(d);
    });
  }

  function use(entries, drafts, scores) {
    W.entries = entries || [];
    W.drafts = drafts || [];
    scoresList = scores || [];
    W.scores = {};
    scoresList.forEach(function (r) { W.scores[r.draft_id] = r; });
    index();
    W.loaded = true;
  }

  function loadCache() {
    try {
      var c = JSON.parse(window.localStorage.getItem(CACHE_KEY) || 'null');
      if (c && c.drafts) { use(c.entries, c.drafts, c.scores); W.updated = c.at ? new Date(c.at) : null; }
    } catch (e) { /* nothing kept on this device */ }
  }

  function saveCache() {
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify({
        at: W.updated.toISOString(), entries: W.entries, drafts: W.drafts, scores: scoresList
      }));
    } catch (e) { /* storage full or unavailable: the page still works with what it has */ }
  }

  function notify() { listeners.forEach(function (f) { try { f(); } catch (e) { if (window.console) console.error(e); } }); }

  function timeout(p) {
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () { reject(new Error('no answer within ' + TIMEOUT_MS / 1000 + ' s')); }, TIMEOUT_MS);
      p.then(function (v) { clearTimeout(t); resolve(v); }, function (e) { clearTimeout(t); reject(e); });
    });
  }

  var busy = null;
  function refresh() {
    if (busy) return busy;
    busy = timeout(Promise.all([
      window.FairDB.selectAll('entries', 'select=id,concept_slug,language_slug,language_label,headword,example_phrase&status=eq.approved&order=id'),
      window.FairDB.selectAll('ai_drafts', 'select=id,concept_slug,language_slug,draft,confidence&order=id'),
      S.fetch()
    ])).then(function (r) {
      use(r[0], r[1], r[2]);
      W.updated = new Date();
      W.online = true;
      saveCache();
    }, function (err) {
      W.online = false;
      if (window.console) console.warn('[LILIEMA] could not fetch the words:', err && err.message);
    }).then(function () {
      W.tried = true;
      busy = null;
      notify();
    });
    return busy;
  }

  F.add({
    fi: {
      'w.loading': 'Haetaan sanoja…',
      'w.updated': function (t, d) { return 'Päivitetty ' + (d ? d + ' ' : '') + t; },
      'w.offline': function (t, d) { return t ? 'Ei yhteyttä. Viimeksi päivitetty ' + (d ? d + ' ' : '') + t + '.' : 'Ei yhteyttä.'; },
      'w.visitor': 'Kävijän sana',
      'w.visitor.long': 'Kävijän sana, osaston henkilökunnan tarkistama',
      'w.ai': 'Tekoälyn sana · tarkistamaton',
      'w.ai.short': 'Tekoälyn sana',
      'w.said.right': 'Useimmat puhujat pitävät sitä oikeana.',
      'w.said.wrong': 'Useimmat puhujat pitävät sitä vääränä.',
      'w.said.open': 'Puhujat tarkistavat sitä vielä.'
    },
    sv: {
      'w.loading': 'Hämtar ord…',
      'w.updated': function (t, d) { return 'Uppdaterad ' + (d ? d + ' ' : '') + t; },
      'w.offline': function (t, d) { return t ? 'Ingen anslutning. Senast uppdaterad ' + (d ? d + ' ' : '') + t + '.' : 'Ingen anslutning.'; },
      'w.visitor': 'En besökares ord',
      'w.visitor.long': 'En besökares ord, granskat av personalen i montern',
      'w.ai': 'AI:ns ord · ogranskat',
      'w.ai.short': 'AI:ns ord',
      'w.said.right': 'De flesta talare anser att det stämmer.',
      'w.said.wrong': 'De flesta talare anser att det är fel.',
      'w.said.open': 'Talarna granskar det fortfarande.'
    },
    en: {
      'w.loading': 'Fetching words…',
      'w.updated': function (t, d) { return 'Updated ' + (d ? d + ' ' : '') + t; },
      'w.offline': function (t, d) { return t ? 'No connection. Last updated ' + (d ? d + ' ' : '') + t + '.' : 'No connection.'; },
      'w.visitor': 'A visitor’s word',
      'w.visitor.long': 'A visitor’s word, checked by the stall team',
      'w.ai': 'The AI’s word · unchecked',
      'w.ai.short': 'The AI’s word',
      'w.said.right': 'Most speakers say it is right.',
      'w.said.wrong': 'Most speakers say it is wrong.',
      'w.said.open': 'Speakers are still checking it.'
    },
    fr: {
      'w.loading': 'Chargement des mots…',
      'w.updated': function (t, d) { return 'Mis à jour ' + (d ? 'le ' + d + ' ' : '') + 'à ' + t; },
      'w.offline': function (t, d) { return t ? 'Pas de connexion. Dernière mise à jour ' + (d ? 'le ' + d + ' ' : '') + 'à ' + t + '.' : 'Pas de connexion.'; },
      'w.visitor': 'Le mot d’un visiteur',
      'w.visitor.long': 'Le mot d’un visiteur, vérifié par l’équipe du stand',
      'w.ai': 'Le mot de l’IA · non vérifié',
      'w.ai.short': 'Le mot de l’IA',
      'w.said.right': 'La plupart des locuteurs disent qu’il est juste.',
      'w.said.wrong': 'La plupart des locuteurs disent qu’il est faux.',
      'w.said.open': 'Les locuteurs sont encore en train de le vérifier.'
    }
  });

  window.FairWords = W;
})();
