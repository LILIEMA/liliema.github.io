/* LILIEMA at the Helsinki Book Fair 2026: Check the AI, parts shared by the game and the word wall.
   Scores: a word counts as right or wrong when most of at least MIN judgements say so;
   until then the screening verdict stands (rule proposed in the plan, section 6.3, to be confirmed by LILIEMA). */
(function () {
  'use strict';
  var MIN = 3;

  function n(x) { return Number(x) || 0; }
  function total(r) { return n(r.n_right) + n(r.n_wrong) + n(r.n_not_sure); }

  /* 'right', 'wrong', or the screening verdict ('right', 'partly', 'wrong') */
  function status(r) {
    var t = total(r);
    if (t >= MIN) {
      if (n(r.n_right) * 2 > t) return 'right';
      if (n(r.n_wrong) * 2 > t) return 'wrong';
    }
    return r.checker_verdict || 'partly';
  }

  /* Per language: words in the game, right / partly / wrong, and the number of judgements */
  function byLanguage(rows) {
    var out = {};
    (rows || []).forEach(function (r) {
      var o = out[r.language_slug] || (out[r.language_slug] = { words: 0, right: 0, partly: 0, wrong: 0, judgements: 0 });
      o.words++;
      o[status(r)]++;
      o.judgements += total(r);
    });
    return out;
  }

  window.FairScores = {
    MIN: MIN,
    MODEL: 'claude-opus-5-5',     // the model and date of the drafts in bookfair_ai_drafts.sql
    DRAFTED_ON: '2026-10-08',
    total: total,
    status: status,
    byLanguage: byLanguage,
    fetch: function () { return window.FairDB.rpcAll('ai_scores', {}, 'order=draft_id'); }
  };

  window.Fair.add({
    fi: {
      'ai.name': 'Tarkista tekoäly',
      'ai.text': 'Nämä sanat on kirjoittanut tekoäly (Anthropicin Claude). Kaltaisesi puhujat kertovat meille, ovatko ne oikein.',
      'credit.ai': function (model, date) {
        return 'Tekoälyn sanat: Claude (Anthropic, malli ' + model + '), ' + date + ', mallin omasta tietämyksestä ilman sanakirjoja; LILIEMA kävi ne läpi ennen messuja.';
      }
    },
    sv: {
      'ai.name': 'Granska AI:n',
      'ai.text': 'De här orden har skrivits av en AI (Claude, från Anthropic). Talare som du berättar för oss om de stämmer.',
      'credit.ai': function (model, date) {
        return 'AI:ns ord: Claude (Anthropic, modell ' + model + '), ' + date + ', ur modellens egen kunskap utan ordböcker; LILIEMA gick igenom dem före mässan.';
      }
    },
    en: {
      'ai.name': 'Check the AI',
      'ai.text': 'These words were written by an AI (Claude, made by Anthropic). Speakers like you tell us whether they are right.',
      'credit.ai': function (model, date) {
        return 'The AI’s words: Claude (Anthropic, model ' + model + '), ' + date + ', from the model’s own knowledge without dictionaries; screened by LILIEMA before the fair.';
      }
    },
    fr: {
      'ai.name': 'Vérifiez l’IA',
      'ai.text': 'Ces mots ont été écrits par une IA (Claude, créée par Anthropic). Des locuteurs comme vous nous disent s’ils sont justes.',
      'credit.ai': function (model, date) {
        return 'Les mots de l’IA : Claude (Anthropic, modèle ' + model + '), ' + date + ', d’après les connaissances propres du modèle, sans dictionnaire ; vérifiés par LILIEMA avant le salon.';
      }
    }
  });

  /* The drafting date in the interface language */
  window.FairScores.date = function (iso) {
    var d = iso ? new Date(iso + 'T12:00:00') : null;
    if (!d || isNaN(d)) return '';
    return d.toLocaleDateString(window.Fair.locale(), { day: 'numeric', month: window.Fair.lang === 'fi' ? 'numeric' : 'long', year: 'numeric' });
  };
})();
