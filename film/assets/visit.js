/* LILIEMA, FILMING COPY (28 October 2026): no visits, no research question, no question or reset after a pause.
   The same functions as the fair's visit.js, so that the pages work unchanged. Nothing is stored for research:
   every word and answer is sent with research_consent = false and without a visit number. */
(function () {
  'use strict';
  var endListeners = [];
  function ended() { endListeners.forEach(function (f) { try { f(); } catch (e) { /* the other pages still reset */ } }); }
  window.FairVisit = {
    IDLE_MS: 0, ASK_MS: 0,
    consent: function () { return false; },
    setConsent: function () {},
    stamp: function (row) { row.research_consent = false; delete row.visit_id; return row; },
    active: function () { return false; },
    current: function () { return true; },
    touch: function () {},
    end: ended,
    onEnd: function (f) { endListeners.push(f); },
    onPause: function () {},
    done: ended,
    guard: function () {}
  };
})();
