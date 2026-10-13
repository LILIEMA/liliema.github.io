/* LILIEMA at the Helsinki Book Fair 2026: talking to the fair database (Supabase, project liliema-bookfair).
   Plain REST calls with the publishable key; row-level security in the database decides what is allowed.
   Words and judgements that cannot be sent (no network) wait in a queue on this device and are sent later. */
(function () {
  'use strict';
  var cfg = (window.FAIR_DATA || {}).supabase || {};
  var QUEUE_KEY = 'liliema-bookfair-queue';
  var listeners = [];

  function readQueue() {
    try { return JSON.parse(window.localStorage.getItem(QUEUE_KEY) || '[]'); } catch (e) { return []; }
  }
  function writeQueue(q) {
    try { window.localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch (e) { /* storage unavailable */ }
    listeners.forEach(function (f) { f(q.length); });
  }

  function request(method, path, body, prefer) {
    var headers = { 'apikey': cfg.key, 'Accept': 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (prefer) headers['Prefer'] = prefer;
    return fetch(cfg.url + '/rest/v1/' + path, {
      method: method, headers: headers, body: body === undefined ? undefined : JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) {
        return r.text().then(function (t) {
          var err = new Error('HTTP ' + r.status + (t ? ': ' + t.slice(0, 300) : ''));
          err.status = r.status;
          throw err;
        });
      }
      return r.status === 204 || r.status === 201 ? null : r.json();
    });
  }

  // A rejected request (4xx) is not retried; a network failure or server error (5xx) is.
  function retryable(err) { return !err.status || err.status >= 500 || err.status === 429; }

  // The API returns a limited number of rows per request (1000 on Supabase), so long lists are read page by page,
  // until a page comes back empty.
  var PAGE = 1000;
  function withRange(query, offset) { return (query ? query + '&' : '') + 'limit=' + PAGE + '&offset=' + offset; }
  function allPages(get) {
    var rows = [];
    function next(offset) {
      return get(offset).then(function (batch) {
        batch = batch || [];
        rows = rows.concat(batch);
        return batch.length ? next(offset + batch.length) : rows;
      });
    }
    return next(0);
  }

  var flushing = false;
  function flush() {
    if (flushing) return Promise.resolve();
    var q = readQueue();
    if (!q.length) return Promise.resolve();
    flushing = true;
    var keep = [];
    var chain = Promise.resolve();
    q.forEach(function (item) {
      chain = chain.then(function () {
        return request('POST', item.table, item.row, 'return=minimal').catch(function (err) {
          if (retryable(err)) keep.push(item);
          else if (window.console) console.warn('[LILIEMA] dropped a queued item:', err.message);
        });
      });
    });
    return chain.then(function () {
      // items added while flushing are kept too
      var added = readQueue().slice(q.length);
      writeQueue(keep.concat(added));
      flushing = false;
    });
  }

  var FairDB = {
    configured: !!(cfg.url && cfg.key),

    /* Add a row (entries or ai_checks). Resolves with 'sent' or 'queued'; rejects on a refused row. */
    add: function (table, row) {
      return request('POST', table, row, 'return=minimal').then(function () { return 'sent'; }, function (err) {
        if (!retryable(err)) throw err;
        var q = readQueue();
        q.push({ table: table, row: row, at: new Date().toISOString() });
        writeQueue(q);
        return 'queued';
      });
    },

    /* Read rows: FairDB.select('entries', 'select=headword,language_label&status=eq.approved') */
    select: function (table, query) { return request('GET', table + (query ? '?' + query : '')); },

    /* Call a database function, for example FairDB.rpc('ai_scores') */
    rpc: function (fn, args) { return request('POST', 'rpc/' + fn, args || {}); },

    /* Read every row, page by page: FairDB.selectAll('entries', 'select=headword&order=id') (give an order) */
    selectAll: function (table, query) {
      return allPages(function (offset) { return request('GET', table + '?' + withRange(query, offset)); });
    },

    /* Every row of a database function that returns a table: FairDB.rpcAll('ai_scores', {}, 'order=draft_id') */
    rpcAll: function (fn, args, query) {
      return allPages(function (offset) { return request('POST', 'rpc/' + fn + '?' + withRange(query, offset), args || {}); });
    },

    queued: function () { return readQueue().length; },
    onQueue: function (f) { listeners.push(f); },
    flush: flush
  };

  window.addEventListener('online', flush);
  setInterval(flush, 30000);
  setTimeout(flush, 2000);
  window.FairDB = FairDB;
})();
