/* LILIEMA at the Helsinki Book Fair 2026: one visit at a time on a shared screen.
   A visit begins when a visitor answers the research question or sends a word or an answer. It ends with
   "I'm done", "No, I'm new here", "Someone else? Start afresh", or after two minutes without use. If the visitor has
   agreed to research use, everything sent during the visit carries the same random visit number (visit_id), so that
   research can see which words and languages come from one visitor; without consent no number is sent (the database
   refuses it).
   The visit is kept for this browser tab only (sessionStorage): it carries over between Add a word, Check the AI and
   the other pages opened in the same tab, but two tabs or windows are two separate visits. The number is never shown.
   After 45 seconds without use during a visit, the page asks whether the same person is still there. Pages are told
   (onEnd) whenever the visit they were showing has ended, also when it ran out while nobody touched the screen.
   Plain script; needs fair.js. */
(function () {
  'use strict';
  var F = window.Fair;
  var KEY = 'liliema-bookfair-visit';
  var IDLE_MS = 2 * 60 * 1000;   // a visit ends after two minutes without use, like the pages' own reset
  var ASK_MS = 45 * 1000;        // after this pause the page asks whether the same person is still there
  var THANKS_MS = 4000;
  var memory = null;             // used when the browser's storage is unavailable
  var known = null;              // the visit this page last saw (its number), to notice when it has ended
  var endListeners = [], pauseListeners = [];

  function now() { return Date.now(); }
  function store(v) {
    memory = v;
    known = v ? v.id : null;
    try { if (v) window.sessionStorage.setItem(KEY, JSON.stringify(v)); else window.sessionStorage.removeItem(KEY); }
    catch (e) { /* this page only */ }
  }
  function read() {
    var v;
    try { v = JSON.parse(window.sessionStorage.getItem(KEY) || 'null'); } catch (e) { v = memory; }
    if (v && (typeof v.last !== 'number' || now() - v.last >= IDLE_MS)) {
      v = null;
      try { window.sessionStorage.removeItem(KEY); } catch (e) { /* ignore */ }
      memory = null;
    }
    return v;
  }
  function notifyEnd() { endListeners.slice().forEach(function (f) { try { f(); } catch (e) { /* keep going */ } }); }

  // the visit this page was showing has ended (run out, ended in another page of this tab, or replaced)
  function sync() {
    var v = read(), id = v ? v.id : null;
    if (known && id !== known) { known = id; hideAsk(); notifyEnd(); return false; }
    known = id;
    return true;
  }

  function uuid() {
    var c = window.crypto;
    if (c && c.randomUUID) return c.randomUUID();
    var b = new Uint8Array(16), i;
    if (c && c.getRandomValues) c.getRandomValues(b);
    else for (i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    var h = Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }
  function ensure() { return read() || { id: uuid(), consent: null, started: now(), last: now(), sent: 0 }; }

  var FairVisit = {
    IDLE_MS: IDLE_MS,
    ASK_MS: ASK_MS,

    /* The answer to the research question in this visit: true, false, or null (not asked yet) */
    consent: function () { var v = read(); return v ? v.consent : null; },

    setConsent: function (c) {
      var v = ensure();
      v.consent = c === null ? null : !!c;
      v.last = now();
      store(v);
    },

    /* Before sending a row: research_consent from this visit, and the visit number only with consent */
    stamp: function (row) {
      var v = ensure();
      v.sent = (v.sent || 0) + 1;
      v.last = now();
      store(v);
      row.research_consent = v.consent === true;
      if (row.research_consent) row.visit_id = v.id; else delete row.visit_id;
      return row;
    },

    /* A visit is under way once the research question is answered or something has been sent */
    active: function () { var v = read(); return !!v && (v.consent !== null || v.sent > 0); },

    /* false if the visit this page was showing has ended in the meantime (the page then resets itself) */
    current: function () { return sync(); },

    touch: function () {
      var v = read();
      if (v && now() - v.last > 1000) { v.last = now(); store(v); }
    },

    /* End the visit (I'm done, a new person, idle); every page resets itself through onEnd */
    end: function () {
      store(null);
      hideAsk();
      notifyEnd();
    },

    onEnd: function (f) { endListeners.push(f); },

    /* Called once after 45 seconds without use of this page (for example to untick a box nobody sent) */
    onPause: function (f) { pauseListeners.push(f); },

    /* "I'm done": end the visit and thank the visitor for a moment */
    done: function () {
      FairVisit.end();
      showThanks();
    },

    /* On every visitor page: keep the visit alive while the screen is used, and ask after a pause */
    guard: function () {
      if (guarded) return;
      guarded = true;
      ['pointerdown', 'keydown', 'touchstart', 'input', 'wheel'].forEach(function (ev) {
        window.addEventListener(ev, function (e) {
          lastUse = now();
          paused = false;
          if (askEl && !askEl.hidden) return;   // answering the question is not use of the page
          if (thanksEl && !thanksEl.hidden && !thanksEl.contains(e.target)) hideThanks();
          FairVisit.touch();
        }, { capture: true, passive: true });
      });
      // a page shown again from the browser's back-forward cache checks whether its visit still exists
      window.addEventListener('pageshow', function (e) { if (e.persisted) check(); });
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') check(); });
      setInterval(check, 1000);
      check();
      F.onLang(function () { if (askEl) fillAsk(); if (thanksEl) fillThanks(); });
    }
  };

  // ------------------------------------------------------------ "Are you the person who was here a moment ago?"
  var guarded = false, askEl = null, thanksEl = null, thanksTimer = null, lastUse = now(), paused = false;

  function check() {
    if (!sync()) return;                                  // the visit ended: the page has reset itself
    if (!paused && now() - lastUse >= ASK_MS) {
      paused = true;
      pauseListeners.slice().forEach(function (f) { try { f(); } catch (e) { /* keep going */ } });
    }
    var v = read();
    if (!v || !(v.consent !== null || v.sent > 0)) return;
    if (document.visibilityState !== 'visible') return;
    if ((!askEl || askEl.hidden) && now() - v.last >= ASK_MS) showAsk();
  }

  function styles() {
    if (document.getElementById('fv-style')) return;
    var s = document.createElement('style');
    s.id = 'fv-style';
    s.textContent =
      // below the page header (z-index 200), so that the interface language can still be changed
      '.fv-overlay{position:fixed;inset:0;z-index:150;background:rgba(0,40,40,.55);display:flex;align-items:center;justify-content:center;padding:76px 16px 16px}' +
      '.fv-overlay[hidden]{display:none}' +
      '.fv-box{background:#fff;border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,.3);max-width:560px;width:100%;padding:26px 24px;text-align:center;border-top:6px solid var(--gold,#C5A028)}' +
      '.fv-box:focus{outline:none}' +
      '.fv-box h2{font-family:var(--font-display,Georgia,serif);color:var(--teal-dark,#005a5a);font-size:26px;line-height:1.2;margin:0 0 10px}' +
      '.fv-box p{margin:0 0 18px;color:var(--muted,#5b6470);font-size:17px}' +
      '.fv-actions{display:flex;flex-direction:column;gap:12px}' +
      '.fv-btn{padding:14px 22px;min-height:58px;border-radius:30px;border:2px solid var(--teal,#007878);background:#fff;color:var(--teal-dark,#005a5a);font-weight:700;font-size:19px;cursor:pointer;font-family:inherit}' +
      '.fv-btn.primary{background:var(--teal,#007878);color:#fff}' +
      '.fv-btn:focus-visible{outline:3px solid var(--gold,#C5A028);outline-offset:2px}' +
      '.fv-thanks .fv-box{border-top-color:var(--teal,#007878)}';
    document.head.appendChild(s);
  }

  function fillAsk() {
    askEl.querySelector('h2').textContent = F.t('visit.ask.title');
    askEl.querySelector('p').textContent = F.t('visit.ask.text');
    askEl.querySelector('[data-a="new"]').textContent = F.t('visit.ask.new');
    askEl.querySelector('[data-a="same"]').textContent = F.t('visit.ask.same');
  }

  function showAsk() {
    styles();
    if (!askEl) {
      askEl = document.createElement('div');
      askEl.className = 'fv-overlay';
      askEl.id = 'visitAsk';
      askEl.setAttribute('role', 'dialog');
      askEl.setAttribute('aria-modal', 'true');
      askEl.setAttribute('aria-labelledby', 'visitAskTitle');
      askEl.innerHTML = '<div class="fv-box" tabindex="-1"><h2 id="visitAskTitle"></h2><p></p><div class="fv-actions">' +
        '<button type="button" class="fv-btn primary" data-a="new"></button>' +
        '<button type="button" class="fv-btn" data-a="same"></button></div></div>';
      askEl.querySelector('[data-a="new"]').addEventListener('click', function () { hideAsk(); FairVisit.end(); });
      askEl.querySelector('[data-a="same"]').addEventListener('click', function () {
        var v = read();
        if (v) { v.last = now(); store(v); }
        hideAsk();
        if (!v) { known = null; notifyEnd(); }            // it ran out just now: start afresh all the same
      });
      document.body.appendChild(askEl);
    }
    fillAsk();
    askEl.hidden = false;
    // the dialog itself takes the focus, not a button: a stray Enter or tap does not end anyone's visit
    askEl.querySelector('.fv-box').focus({ preventScroll: true });
  }

  function hideAsk() { if (askEl) askEl.hidden = true; }

  function fillThanks() {
    thanksEl.querySelector('h2').textContent = F.t('visit.thanks.title');
    thanksEl.querySelector('p').textContent = F.t('visit.thanks.text');
  }

  function showThanks() {
    styles();
    if (!thanksEl) {
      thanksEl = document.createElement('div');
      thanksEl.className = 'fv-overlay fv-thanks';
      thanksEl.id = 'visitThanks';
      thanksEl.setAttribute('role', 'status');
      thanksEl.innerHTML = '<div class="fv-box"><h2></h2><p></p></div>';
      thanksEl.addEventListener('click', hideThanks);
      document.body.appendChild(thanksEl);
    }
    fillThanks();
    thanksEl.hidden = false;
    clearTimeout(thanksTimer);
    thanksTimer = setTimeout(hideThanks, THANKS_MS);
  }

  function hideThanks() { if (thanksEl) thanksEl.hidden = true; clearTimeout(thanksTimer); }

  known = (read() || {}).id || null;

  F.add({
    fi: {
      'visit.ask.title': 'Oletko sama henkilö kuin äsken?',
      'visit.ask.text': 'Näin kunkin kävijän sanat ja vastaukset pysyvät erillään.',
      'visit.ask.new': 'En, olen uusi kävijä',
      'visit.ask.same': 'Kyllä, jatkan',
      'visit.thanks.title': 'Kiitos!',
      'visit.thanks.text': 'Seuraava kävijä voi aloittaa.',
      'visit.notyou': 'Joku muu? Aloita alusta'
    },
    sv: {
      'visit.ask.title': 'Är du samma person som nyss?',
      'visit.ask.text': 'Så hålls varje besökares ord och svar isär.',
      'visit.ask.new': 'Nej, jag är en ny besökare',
      'visit.ask.same': 'Ja, jag fortsätter',
      'visit.thanks.title': 'Tack!',
      'visit.thanks.text': 'Nästa besökare kan börja.',
      'visit.notyou': 'Någon annan? Börja om'
    },
    en: {
      'visit.ask.title': 'Are you the person who was here a moment ago?',
      'visit.ask.text': 'This keeps each visitor’s words and answers separate.',
      'visit.ask.new': 'No, I’m new here',
      'visit.ask.same': 'Yes, I’ll continue',
      'visit.thanks.title': 'Thank you!',
      'visit.thanks.text': 'The next person can start now.',
      'visit.notyou': 'Someone else? Start afresh'
    },
    fr: {
      'visit.ask.title': 'Êtes-vous la personne qui était là il y a un instant ?',
      'visit.ask.text': 'Ainsi, les mots et les réponses de chaque visiteur restent séparés.',
      'visit.ask.new': 'Non, je viens d’arriver',
      'visit.ask.same': 'Oui, je continue',
      'visit.thanks.title': 'Merci !',
      'visit.thanks.text': 'La personne suivante peut commencer.',
      'visit.notyou': 'Quelqu’un d’autre ? Recommencez'
    }
  });

  window.FairVisit = FairVisit;
})();
