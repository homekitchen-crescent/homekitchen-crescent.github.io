// Test mode only (open a page with ?mock). Runs the real apps-script/Code.gs in the browser
// against a pretend Google Sheet kept in localStorage, so the site can be tried without deploying.
// Admin password in this mode: test
(function () {
  var KEY = 'crescent-mock-sheet';
  var db;
  try { db = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { db = {}; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }

  // Mimic how Sheets stores what it's given: "'text" stays text, number-like strings become numbers.
  function store(v) {
    if (typeof v !== 'string') return v;
    if (v.charAt(0) === "'") return v.slice(1);
    if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    return v;
  }

  function Sheet(name) { this.name = name; if (!db[name]) db[name] = []; }
  Sheet.prototype.rows = function () { return db[this.name]; };
  Sheet.prototype.getLastRow = function () { return this.rows().length; };
  Sheet.prototype.setFrozenRows = function () {};
  Sheet.prototype.getRange = function (r, c, nr, nc) {
    var rows = this.rows();
    return {
      getValues: function () {
        var out = [];
        for (var i = 0; i < nr; i++) {
          var row = rows[r - 1 + i] || [];
          var o = [];
          for (var j = 0; j < nc; j++) o.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]);
          out.push(o);
        }
        return out;
      },
      setValues: function (vals) {
        vals.forEach(function (v, i) {
          var row = rows[r - 1 + i] || (rows[r - 1 + i] = []);
          v.forEach(function (x, j) { row[c - 1 + j] = store(x); });
        });
        save();
        return this;
      },
      setFontWeight: function () { return this; }
    };
  };

  window.SpreadsheetApp = {
    getActiveSpreadsheet: function () {
      return {
        getSheetByName: function (n) { return db[n] ? new Sheet(n) : null; },
        insertSheet: function (n) { var s = new Sheet(n); save(); return s; },
        getUrl: function () { return '#mock-sheet'; }
      };
    }
  };
  window.LockService = { getScriptLock: function () { return { tryLock: function () { return true; }, releaseLock: function () {} }; } };
  window.ContentService = {
    MimeType: { JSON: 'json' },
    createTextOutput: function (s) { return { setMimeType: function () { return this; }, getContent: function () { return s; } }; }
  };
  window.Utilities = {
    sleep: function () {},
    formatDate: function (d, tz, fmt) {
      var p = {};
      new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
        .formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
      return fmt.replace('yyyy', p.year).replace('MM', p.month).replace('dd', p.day).replace('HH', p.hour).replace('mm', p.minute);
    }
  };

  function call(out) {
    var d = JSON.parse(out.getContent());
    if (!d.ok) { var e = new Error(d.error); e.code = d.code; throw e; }
    return d;
  }
  function later(fn) { return new Promise(function (res) { setTimeout(res, 250); }).then(fn); }

  // Loaded with a script tag (not fetch) so test mode also works when the page is opened straight from disk.
  var base = document.currentScript.src.replace(/dev\/mock\.js.*$/, '');
  window.CrescentMock = {
    ready: new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = base + 'apps-script/Code.gs';
      s.onload = res;
      s.onerror = function () { rej(new Error('Couldn’t load apps-script/Code.gs')); };
      document.head.appendChild(s);
    }).then(function () {
      window.ADMIN_PASSWORD = 'test';
      return {
        get: function (action) { return later(function () { return call(window.doGet({ parameter: { action: action } })); }); },
        post: function (body) { return later(function () { return call(window.doPost({ postData: { contents: JSON.stringify(body) } })); }); }
      };
    }),
    reset: function () { db = {}; save(); }
  };
})();
