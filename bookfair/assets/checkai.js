/* LILIEMA at the Helsinki Book Fair 2026: Check the AI, parts shared by the game and the word wall.
   The AI's words are not screened before the fair: the visitors check them (decided 13 October 2026).
   Scores: a word counts as right or wrong when most of at least MIN judgements say so; until then it is
   undecided (rule proposed in the plan, section 6.3). A screening verdict, if one is ever entered, fills the gap. */
(function () {
  'use strict';
  var MIN = 3;

  function n(x) { return Number(x) || 0; }
  function total(r) { return n(r.n_right) + n(r.n_wrong) + n(r.n_not_sure); }

  /* 'right' or 'wrong' by the visitors' majority; otherwise a screening verdict if any, or 'open' (undecided) */
  function status(r) {
    var t = total(r);
    if (t >= MIN) {
      if (n(r.n_right) * 2 > t) return 'right';
      if (n(r.n_wrong) * 2 > t) return 'wrong';
    }
    return r.checker_verdict || 'open';
  }

  /* Per language: words in the game, right / partly / wrong / open, and the number of judgements */
  function byLanguage(rows) {
    var out = {};
    (rows || []).forEach(function (r) {
      var o = out[r.language_slug] || (out[r.language_slug] = { words: 0, right: 0, partly: 0, wrong: 0, open: 0, judgements: 0 });
      o.words++;
      o[status(r)]++;
      o.judgements += total(r);
    });
    return out;
  }

  window.FairScores = {
    MIN: MIN,
    MODEL: 'claude-opus-5-5',     // the model and dates of the drafts in bookfair_ai_drafts.sql
    DRAFTED_ON: ['2026-10-08', '2026-10-19'],   // sweet potato on 19 October 2026
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
        return 'Tekoälyn sanat: Claude (Anthropic, malli ' + model + '), ' + date + ', mallin omasta tietämyksestä ilman sanakirjoja. Niitä ei ole tarkistettu ennen messuja: messuvieraat tarkistavat ne.';
      }
    },
    sv: {
      'ai.name': 'Granska AI:n',
      'ai.text': 'De här orden har skrivits av en AI (Claude, från Anthropic). Talare som du berättar för oss om de stämmer.',
      'credit.ai': function (model, date) {
        return 'AI:ns ord: Claude (Anthropic, modell ' + model + '), ' + date + ', ur modellens egen kunskap utan ordböcker. De har inte granskats före mässan: mässans besökare granskar dem.';
      }
    },
    en: {
      'ai.name': 'Check the AI',
      'ai.text': 'These words were written by an AI (Claude, made by Anthropic). Speakers like you tell us whether they are right.',
      'credit.ai': function (model, date) {
        return 'The AI’s words: Claude (Anthropic, model ' + model + '), ' + date + ', from the model’s own knowledge without dictionaries. They were not checked before the fair: the visitors check them.';
      }
    },
    fr: {
      'ai.name': 'Vérifiez l’IA',
      'ai.text': 'Ces mots ont été écrits par une IA (Claude, créée par Anthropic). Des locuteurs comme vous nous disent s’ils sont justes.',
      'credit.ai': function (model, date) {
        return 'Les mots de l’IA : Claude (Anthropic, modèle ' + model + '), ' + date + ', d’après les connaissances propres du modèle, sans dictionnaire. Ils n’ont pas été vérifiés avant le salon : ce sont les visiteurs qui les vérifient.';
      }
    }
  });

  /* The drafting date or dates in the interface language: '8 and 19 October 2026', '8. ja 19.10.2026' */
  window.FairScores.date = function (iso) {
    var L = window.Fair.lang;
    var list = [].concat(iso || []).map(function (s) { return new Date(s + 'T12:00:00'); })
      .filter(function (d) { return !isNaN(d); });
    if (!list.length) return '';
    var full = function (d) {
      return d.toLocaleDateString(window.Fair.locale(), { day: 'numeric', month: L === 'fi' ? 'numeric' : 'long', year: 'numeric' });
    };
    var last = list[list.length - 1];
    if (list.length === 1) return full(last);
    var sameMonth = list.every(function (d) { return d.getMonth() === last.getMonth() && d.getFullYear() === last.getFullYear(); });
    var and = { fi: ' ja ', sv: ' och ', en: ' and ', fr: ' et ' }[L] || ' and ';
    return list.slice(0, -1).map(function (d) {
      return sameMonth ? d.getDate() + (L === 'fi' ? '.' : '') : full(d);
    }).join(', ') + and + full(last);
  };
})();
