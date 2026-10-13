/* LILIEMA on-screen keyboard for the fair pages.
   Letters a–z, the special letters of the chosen language (with an "all letters" switch),
   tone and diacritic keys (combining marks) and the letter apostrophe ʼ (U+02BC).
   On wide screens it replaces the device's own keyboard (inputmode="none");
   on phones only the special letters and marks are shown, next to the phone's keyboard. */
(function () {
  'use strict';
  var ALL_SPECIAL = ['ɛ', 'ɔ', 'ŋ', 'ñ', 'ɖ', 'ƒ', 'ɣ', 'ʋ', 'ʒ', 'ɓ', 'ɗ', 'ƙ', 'ƴ', 'ẹ', 'ọ', 'ṣ', 'ị', 'ụ', 'ṅ',
    'ĩ', 'ũ', 'à', 'é', 'ë', 'ó', 'å', 'ä', 'ö'];
  var MARKS = [
    ['́', 'acute'], ['̀', 'grave'], ['̂', 'circumflex'], ['̌', 'caron'],
    ['̄', 'macron'], ['̃', 'tilde'], ['̣', 'dot below']
  ];
  var ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  var APOSTROPHE = 'ʼ';

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function LiliemaKeyboard(container, opts) {
    this.c = container;
    this.opts = opts || {};
    this.letters = [];
    this.showAll = false;
    this.shift = false;
    this.target = null;
    this.compact = false;
    var self = this;
    // keep the focus in the text field while keys are pressed
    container.addEventListener('pointerdown', function (e) { if (e.target.closest('button')) e.preventDefault(); });
    container.addEventListener('mousedown', function (e) { if (e.target.closest('button')) e.preventDefault(); });
    var mq = window.matchMedia('(max-width: 699px)');
    var setCompact = function () { self.compact = mq.matches; self.applyInputMode(); self.render(); };
    if (mq.addEventListener) mq.addEventListener('change', setCompact); else mq.addListener(setCompact);
    this.compact = mq.matches;
    this.fields = [];
  }

  LiliemaKeyboard.prototype.attach = function (input) {
    var self = this;
    this.fields.push(input);
    input.addEventListener('focus', function () { self.target = input; });
    if (!this.target) this.target = input;
    this.applyInputMode();
  };

  LiliemaKeyboard.prototype.applyInputMode = function () {
    var self = this;
    this.fields.forEach(function (f) {
      if (self.compact) f.removeAttribute('inputmode'); else f.setAttribute('inputmode', 'none');
    });
  };

  LiliemaKeyboard.prototype.setLetters = function (letters) {
    this.letters = (letters || []).filter(function (l) { return l !== APOSTROPHE; });
    this.showAll = this.letters.length === 0;
    this.render();
  };

  LiliemaKeyboard.prototype.insert = function (text) {
    var t = this.target;
    if (!t) return;
    var s = t.selectionStart == null ? t.value.length : t.selectionStart;
    var e = t.selectionEnd == null ? s : t.selectionEnd;
    if (t.maxLength > 0 && t.value.length - (e - s) + text.length > t.maxLength) return;
    t.setRangeText(text, s, e, 'end');
    t.dispatchEvent(new Event('input', { bubbles: true }));
    if (document.activeElement !== t) t.focus({ preventScroll: true });
  };

  LiliemaKeyboard.prototype.backspace = function () {
    var t = this.target;
    if (!t) return;
    var s = t.selectionStart, e = t.selectionEnd;
    if (s == null) { s = e = t.value.length; }
    if (s !== e) { t.setRangeText('', s, e, 'end'); }
    else if (s > 0) {
      // remove one character (one code point), so a tone mark can be removed on its own
      var before = Array.from(t.value.slice(0, s));
      var last = before.pop();
      t.setRangeText('', s - last.length, s, 'end');
    }
    t.dispatchEvent(new Event('input', { bubbles: true }));
  };

  LiliemaKeyboard.prototype.key = function (label, cls, onPress, title) {
    var b = el('button', 'kb-key' + (cls ? ' ' + cls : ''), label);
    b.type = 'button';
    if (title) { b.title = title; b.setAttribute('aria-label', title); }
    b.addEventListener('click', onPress);
    return b;
  };

  LiliemaKeyboard.prototype.letterKey = function (ch) {
    var self = this;
    var shown = this.shift ? ch.toUpperCase() : ch;
    return this.key(shown, ch.length > 1 || /[^a-z]/.test(ch) ? 'kb-special' : '', function () {
      self.insert(self.shift ? ch.toUpperCase() : ch);
      if (self.shift) { self.shift = false; self.render(); }
    });
  };

  LiliemaKeyboard.prototype.render = function () {
    var self = this, L = this.opts.labels || {};
    var c = this.c;
    c.innerHTML = '';
    c.classList.toggle('kb-compact', this.compact);

    // special letters of the language (or all of them)
    var row = el('div', 'kb-row kb-row-special');
    var set = this.showAll || !this.letters.length ? ALL_SPECIAL : this.letters;
    set.forEach(function (ch) { row.appendChild(self.letterKey(ch)); });
    if (this.letters.length) {
      row.appendChild(this.key(this.showAll ? (L.lang || 'abc') : (L.all || '…'), 'kb-toggle', function () {
        self.showAll = !self.showAll; self.render();
      }));
    }
    c.appendChild(row);

    // tone and diacritic marks, and the apostrophe
    var marks = el('div', 'kb-row kb-row-marks');
    MARKS.forEach(function (m) {
      marks.appendChild(self.key('◌' + m[0], 'kb-mark', function () { self.insert(m[0]); }, m[1]));
    });
    marks.appendChild(this.key(APOSTROPHE, 'kb-mark', function () { self.insert(APOSTROPHE); }, 'apostrophe'));
    c.appendChild(marks);

    if (this.compact) return;

    ROWS.forEach(function (letters, i) {
      var r = el('div', 'kb-row');
      if (i === 2) {
        r.appendChild(self.key('⇧', 'kb-wide kb-shift' + (self.shift ? ' active' : ''), function () {
          self.shift = !self.shift; self.render();
        }, L.shift || 'shift'));
      }
      letters.split('').forEach(function (ch) { r.appendChild(self.letterKey(ch)); });
      if (i === 2) {
        r.appendChild(self.key('⌫', 'kb-wide', function () { self.backspace(); }, L.backspace || 'backspace'));
      }
      c.appendChild(r);
    });
    var last = el('div', 'kb-row');
    last.appendChild(this.key(L.space || 'space', 'kb-space', function () { self.insert(' '); }));
    c.appendChild(last);
  };

  window.LiliemaKeyboard = LiliemaKeyboard;
})();
