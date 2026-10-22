/* LILIEMA at the Helsinki Book Fair 2026: anonymous visit counts (database table app_events).
   Each visitor page sends one small row when it opens ('page') and one when a new visit starts ('visit'): the app,
   the interface language, the kind of device (phone, tablet, computer) and, for a visit that arrives through one of
   the stall's QR codes, which code (?via=wall or ?via=banner in the address). No visit number, name or address is
   sent, and nothing is kept on the device: a visit is recognised from the page the browser came from (another page
   of the fair app, or not), and on a shared screen the next touch after "I'm done", "No, I'm new here" or two minutes
   without use starts a new one, as in visit.js. A row that cannot be sent (no network) is not counted. The database
   sets the time. Not on the word wall or the approval page. Plain script; needs fair.js; uses visit.js if present. */
(function () {
  'use strict';
  var F = window.Fair;
  // the fair's database and publishable key (also in data/fair_data.js, which the home page does not load)
  var cfg = (window.FAIR_DATA || {}).supabase || { url: 'https://xwnvvbsziguatvlpkliu.supabase.co', key: 'sb_publishable_IMM0hg6aq8zyQ79ltXtcUQ_AdQNDaCs' };
  var PAGES = { '': 'home', 'index.html': 'home', 'add.html': 'add', 'check.html': 'check', 'lookup.html': 'lookup',
    'detective.html': 'detective', 'liliema.html': 'liliema' };
  var IDLE_MS = 2 * 60 * 1000;   // as visit.js: two minutes without use end a visit
  var page = PAGES[location.pathname.split('/').pop()];
  if (!F || !page || !cfg.url || !cfg.key) return;

  function device() {
    var coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    var small = Math.min(window.screen.width || 0, window.screen.height || 0);
    if (!coarse) return 'computer';
    return small > 0 && small < 600 ? 'phone' : 'tablet';
  }
  function via() {
    var m = /[?&]via=([a-z0-9-]{1,20})(?=&|$)/.exec(location.search);
    return m ? m[1] : null;
  }
  function send(kind, tag) {
    var row = { kind: kind, page: page, lang: F.lang, device: device(), via: tag || null };
    try {
      window.fetch(cfg.url + '/rest/v1/app_events', {
        method: 'POST', keepalive: true,
        headers: { 'apikey': cfg.key, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify(row)
      }).catch(function () { /* no network: not counted */ });
    } catch (e) { /* not counted */ }
  }

  // arriving from outside the fair app (a QR code, a link, a typed address) starts a visit; a reload or going back does not
  var nav = (window.performance && performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || {};
  var inside = false;
  try { var from = new URL(document.referrer); inside = from.origin === location.origin && /\/bookfair\//.test(from.pathname); }
  catch (e) { /* no referrer: from outside */ }
  if (!inside && nav.type !== 'reload' && nav.type !== 'back_forward') send('visit', via());
  send('page');

  // on a shared screen: after an ended visit or two minutes without use, the next touch is a new visit
  var lastUse = Date.now(), ended = false;
  if (window.FairVisit && window.FairVisit.onEnd) window.FairVisit.onEnd(function () { ended = true; });
  ['pointerdown', 'keydown'].forEach(function (ev) {
    window.addEventListener(ev, function () {
      var t = Date.now();
      if (ended || t - lastUse >= IDLE_MS) { ended = false; send('visit'); }
      lastUse = t;
    }, { capture: true, passive: true });
  });

  // one line in the footer saying what is counted
  F.add({
    fi: { 'stats.note': 'Laskemme käynnit nimettömästi: sovellus, käyttöliittymän kieli, laitteen tyyppi ja se, käytettiinkö osaston QR-koodia. Laskennassa ei tallenneta nimiä, IP-osoitteita eikä muita tunnisteita.' },
    sv: { 'stats.note': 'Vi räknar besöken anonymt: appen, gränssnittets språk, typ av enhet och om en QR-kod i montern användes. Räkningen sparar inga namn, IP-adresser eller andra identifierare.' },
    en: { 'stats.note': 'We count visits anonymously: the app, the interface language, the kind of device and whether one of the stall’s QR codes was used. The counts contain no names, IP addresses or other identifiers.' },
    fr: { 'stats.note': 'Nous comptons les visites de façon anonyme : l’application, la langue de l’interface, le type d’appareil et l’usage éventuel d’un code QR du stand. Ces comptages n’enregistrent ni noms, ni adresses IP, ni autres identifiants.' }
  });
  function note() {
    var foot = document.querySelector('.fair-footer');
    if (!foot) return;
    var p = document.createElement('p');
    p.className = 'stats-note';
    p.textContent = F.t('stats.note');
    foot.appendChild(p);
    F.onLang(function () { p.textContent = F.t('stats.note'); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', note); else note();
})();
