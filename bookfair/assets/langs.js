/* LILIEMA at the Helsinki Book Fair 2026: every language with words in the apps, for the language menus and for
   showing words of one language together.
   - The stall's languages (fair_data.js): the AI wrote words in them.
   - LILIEMA's languages: the languages of LILIEMA's own words under the pictures, by the names in LILIEMA's list,
     with their other names (for typing) and their letters (for the keyboard). Tagged LILIEMA.
   - Languages added by visitors: the names visitors gave to languages that are not in the menus, from approved
     words only (the stall team has seen them). Tagged as added by visitors, like the AI's words are tagged AI.
   A visitor's name for a language in the menus counts as that language (Gujaher is Baïnounk Gujaher).
   The visitors' languages are read from the database and kept on this device for the next visit. */
(function () {
  'use strict';
  var F = window.Fair, D = window.FAIR_DATA || {};
  var CACHE_KEY = 'liliema-bookfair-langs';
  var REFRESH_MS = 3 * 60 * 1000;

  // name in LILIEMA's list, other names, letters, countries (LILIEMA's language table)
  var LILIEMA = [
    ['Baïnounk Gujaher', ['Gujaher', 'Bainouk Gujaher', 'Bainunk Gujaher', 'Baïnunk Gujaher'], ['ë', 'ŋ', 'ñ', 'é', 'ó'], ['Senegal']],
    ['Baïnounk Gubëeher', ['Gubëeher', 'Gubeeher', 'Baïnounk Gubeeher', 'Bainouk Gubëeher', 'Bainouk Gubeeher', 'Bainunk Gubëeher', 'Baynunk Gubëeher'],
      ['ë', 'ŋ', 'ñ', 'é', 'ó'], ['Senegal']],
    ['Balanta', ['Balanta-Ganja', 'Balante', 'Balanta Ganja', 'Ganja'], ['ñ', 'ŋ'], ['Senegal', 'Guinea-Bissau']],
    ['Creole', ['Kriolu', 'Kriol', 'Kriyol', 'Kiriol', 'Crioulo', 'Créole', 'Casamance Creole', 'Portuguese Creole', 'Créole portugais',
      'Guinea-Bissau Creole', 'Upper Guinea Creole'], ['ñ'], ['Guinea-Bissau', 'Senegal', 'The Gambia']],
    ['Joola', ['Jola', 'Diola'], ['ë', 'ñ', 'ŋ'], ['Senegal', 'The Gambia']],
    ['Joola Eegimaa', ['Eegimaa', 'Banjal', 'Bandial', 'Jola-Bandial', 'Joola Banjal', 'Joola Bandial', 'Diola Bandial'], ['ë', 'ñ', 'ŋ'], ['Senegal']],
    ['Joola Fogny', ['Jola-Fonyi', 'Jola Fonyi', 'Jola Fogny', 'Joola Foñi', 'Jóola Fóoñi', 'Diola-Fogny', 'Diola Fogny', 'Fogny', 'Foñi', 'Kujamaat',
      'Kujamaat Joola'], ['ë', 'ñ', 'ŋ'], ['Senegal', 'The Gambia']],
    ['Joola Gusilay', ['Gusilay', 'Kusilay', 'Jola Gusilay', 'Joola Kusilay', 'Diola Gusilay'], ['ë', 'ñ', 'ŋ'], ['Senegal']],
    ['Joola Kujireray', ['Kujireray', 'Jola Kujireray', 'Diola Kujireray'], ['ë', 'ñ', 'ŋ'], ['Senegal']],
    ['Mankañ', ['Mankanya', 'Mankagne', 'Mancagne', 'Mancanha', 'Mankanha', 'Brame'], ['ë', 'ñ', 'ŋ'], ['Guinea-Bissau', 'Senegal']],
    ['Pulaar', ['Fula', 'Fulfulde', 'Peul', 'Peulh', 'Fulani', 'Haalpulaar', 'Halpulaar', 'Pulaar du Nord', 'Toucouleur', 'Tukuloor', 'Fulakunda',
      'Fula Kunda'], ['ɓ', 'ɗ', 'ñ', 'ŋ', 'ƴ', 'ʼ'], ['Senegal', 'Mauritania', 'The Gambia', 'Guinea-Bissau', 'Guinea', 'Mali']]
  ];
  var COUNTRIES = {   // names of countries the stall's languages do not have
    'Guinea-Bissau': { fi: 'Guinea-Bissau', sv: 'Guinea-Bissau', en: 'Guinea-Bissau', fr: 'Guinée-Bissau' },
    'Mauritania': { fi: 'Mauritania', sv: 'Mauretanien', en: 'Mauritania', fr: 'Mauritanie' },
    'Mali': { fi: 'Mali', sv: 'Mali', en: 'Mali', fr: 'Mali' },
    'Guinea': { fi: 'Guinea', sv: 'Guinea', en: 'Guinea', fr: 'Guinée' }
  };

  F.add({
    fi: { 'lang.tag.liliema': 'LILIEMA', 'lang.tag.visitors': 'kävijät',
      'lang.words': function (n) { return n === 1 ? '1 sana' : n + ' sanaa'; },
      'lang.legend': 'LILIEMA: LILIEMAn omien sanojen kieli · kävijät: kävijöiden lisäämä kieli',
      'lang.notgame': 'ei vielä pelissä' },
    sv: { 'lang.tag.liliema': 'LILIEMA', 'lang.tag.visitors': 'besökare',
      'lang.words': function (n) { return n === 1 ? '1 ord' : n + ' ord'; },
      'lang.legend': 'LILIEMA: språk i LILIEMAs egna ord · besökare: språk som besökare har lagt till',
      'lang.notgame': 'inte med i spelet ännu' },
    en: { 'lang.tag.liliema': 'LILIEMA', 'lang.tag.visitors': 'visitors',
      'lang.words': function (n) { return n === 1 ? '1 word' : n + ' words'; },
      'lang.legend': 'LILIEMA: a language of LILIEMA’s own words · visitors: a language added by visitors',
      'lang.notgame': 'not in the game yet' },
    fr: { 'lang.tag.liliema': 'LILIEMA', 'lang.tag.visitors': 'visiteurs',
      'lang.words': function (n) { return n === 1 ? '1 mot' : n + ' mots'; },
      'lang.legend': 'LILIEMA : langue des mots de LILIEMA · visiteurs : langue ajoutée par des visiteurs',
      'lang.notgame': 'pas encore dans le jeu' }
  });

  function fold(s) { return F.fold(String(s == null ? '' : s).normalize('NFC')).trim().replace(/\s+/g, ' '); }

  // the stall's languages and LILIEMA's, by every name (folded); a LILIEMA language the stall already lists is the stall's
  var stall = (D.languages || []).map(function (l) {
    return { kind: 'stall', slug: l.slug, name: l.name, aliases: l.aliases || [], letters: l.letters || [], countries: l.countries || [] };
  });
  var byName = {};
  stall.forEach(function (l) { [l.name].concat(l.aliases).forEach(function (n) { if (!byName[fold(n)]) byName[fold(n)] = l; }); });
  var liliema = [];
  LILIEMA.forEach(function (x) {
    var names = [x[0]].concat(x[1]);
    if (names.some(function (n) { return byName[fold(n)]; })) return;   // the stall lists it (the filming copy lists Gujaher)
    var l = { kind: 'liliema', slug: null, name: x[0], aliases: x[1], letters: x[2], countries: x[3] };
    liliema.push(l);
    names.forEach(function (n) { if (!byName[fold(n)]) byName[fold(n)] = l; });
  });

  // the visitors' languages: approved words in languages that are not in the menus, by their folded name
  var visitors = [], listeners = [], loading = null;
  function fromRows(rows) {
    var by = {}, out = [];
    (rows || []).forEach(function (r) {
      if (!r || r.language_slug || !r.language_label || r.source === 'liliema_list') return;
      var k = fold(r.language_label);
      if (!k || byName[k]) return;
      var v = by[k];
      if (!v) { v = by[k] = { kind: 'visitor', slug: null, name: null, aliases: [], letters: [], countries: [], count: 0, spellings: {} }; out.push(v); }
      v.count++;
      var sp = String(r.language_label).normalize('NFC').trim().replace(/\s+/g, ' ');
      v.spellings[sp] = (v.spellings[sp] || 0) + 1;
    });
    out.forEach(function (v) {   // the spelling most visitors used
      v.name = Object.keys(v.spellings).sort(function (a, b) { return v.spellings[b] - v.spellings[a]; })[0];
      v.aliases = Object.keys(v.spellings).filter(function (s) { return s !== v.name; });
      delete v.spellings;
    });
    return out;
  }
  function useRows(rows) {
    var next = fromRows(rows);
    var same = JSON.stringify(next) === JSON.stringify(visitors);
    visitors = next;
    if (!same) listeners.forEach(function (f) { try { f(); } catch (e) { /* the other menus still update */ } });
  }
  try {
    var cached = JSON.parse(window.localStorage.getItem(CACHE_KEY) || 'null');
    if (cached && cached.rows) visitors = fromRows(cached.rows);
  } catch (e) { /* none */ }

  function load() {
    if (loading || !window.FairDB || !window.FairDB.configured) return loading || Promise.resolve();
    loading = window.FairDB.selectAll('entries', 'select=language_slug,language_label,source&status=eq.approved&language_slug=is.null&order=id')
      .then(function (rows) {
        var keep = (rows || []).filter(function (r) { return !r.language_slug && r.source !== 'liliema_list'; })
          .map(function (r) { return { language_label: r.language_label, source: r.source }; });
        try { window.localStorage.setItem(CACHE_KEY, JSON.stringify({ at: new Date().toISOString(), rows: keep })); } catch (e) { /* this page only */ }
        useRows(keep);
      }, function (err) { if (window.console) console.warn('[LILIEMA] languages: could not fetch the visitors’ languages:', err && err.message); })
      .then(function () { loading = null; });
    return loading;
  }

  function sortByName(list) { return list.slice().sort(function (a, b) { return a.name.localeCompare(b.name, F.locale()); }); }
  function find(name) { var k = fold(name); return byName[k] || visitors.filter(function (v) { return fold(v.name) === k || v.aliases.some(function (a) { return fold(a) === k; }); })[0] || null; }

  window.FairLangs = {
    /* every language for a menu, in alphabetical order: { kind: 'stall' | 'liliema' | 'visitor', slug, name, aliases, letters, countries, count } */
    all: function () { return sortByName(stall.concat(liliema, visitors)); },
    others: function () { return sortByName(liliema.concat(visitors)); },
    /* the language a stored or typed word belongs to: by its slug, otherwise by its name */
    of: function (slug, label) {
      if (slug) return stall.filter(function (l) { return l.slug === slug; })[0] || null;
      return find(label);
    },
    /* the key and the name that keep one language's words together, whatever name a visitor gave it */
    keyOf: function (slug, label) {
      var l = this.of(slug, label);
      if (l && l.kind === 'stall') return 's:' + l.slug;
      if (l && l.kind === 'liliema') return 'l:' + fold(l.name);
      return 'o:' + fold(label);
    },
    nameOf: function (slug, label) {
      var l = this.of(slug, label);
      return l && l.kind !== 'visitor' ? l.name : String(label == null ? '' : label);
    },
    /* the tag after a language name: LILIEMA, or added by visitors; nothing for the stall's languages */
    badge: function (l) {
      if (!l || l.kind === 'stall') return '';
      return ' <span class="o-badge' + (l.kind === 'visitor' ? ' v' : '') + '">' + F.esc(F.t(l.kind === 'visitor' ? 'lang.tag.visitors' : 'lang.tag.liliema')) + '</span>';
    },
    countryNames: function (l) {
      return (l.countries || []).map(function (k) {
        var c = (D.countries || {})[k] || COUNTRIES[k];
        return c ? (c[F.lang] || c.en) : k;
      }).join(', ');
    },
    /* the line under a name in a menu: its countries, or for a visitors' language how many words it has */
    detail: function (l) { return l.kind === 'visitor' ? F.t('lang.words', l.count) : this.countryNames(l); },
    load: load,
    onChange: function (f) { listeners.push(f); },
    /* for tests */
    _fromRows: fromRows
  };
  // the menus follow new visitors' languages while the page is open
  setInterval(function () { if (listeners.length) load(); }, REFRESH_MS);
})();
