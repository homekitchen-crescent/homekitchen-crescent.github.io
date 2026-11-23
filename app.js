// Shared by the order page and the admin page: talking to the Google Sheet, formatting, and the item picker.
(function () {
  const C = window.Crescent = {};
  const cfg = window.CRESCENT_CONFIG || {};
  const mock = /[?&]mock\b/.test(location.search);

  C.mock = mock;
  C.configured = mock || /^https:\/\/script\.google\.com\//.test(cfg.api || '');

  // Test mode (?mock) runs the Apps Script code in the browser instead of calling Google.
  let backend = null;
  if (mock) {
    backend = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'dev/mock.js';
      s.onload = () => window.CrescentMock.ready.then(res, rej);
      s.onerror = () => rej(new Error('Couldn’t load test mode.'));
      document.head.appendChild(s);
    });
  }

  function parse(res) {
    if (!res.ok) throw new Error('The kitchen’s server had a problem (' + res.status + '). Please try again.');
    return res.json().then(d => {
      if (!d.ok) { const e = new Error(d.error || 'Something went wrong.'); e.code = d.code; throw e; }
      return d;
    });
  }
  function offline(e) {
    if (e && e.code !== undefined) throw e;
    throw new Error('Couldn’t reach the kitchen. Check your internet and try again.');
  }

  C.get = function (action) {
    if (backend) return backend.then(b => b.get(action));
    return fetch(cfg.api + '?action=' + encodeURIComponent(action)).catch(offline).then(parse);
  };
  // text/plain keeps the request "simple", which Apps Script needs to accept it from another site.
  C.post = function (body) {
    if (backend) return backend.then(b => b.post(body));
    return fetch(cfg.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
      .catch(offline).then(parse);
  };

  // ---------- Formatting ----------

  C.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  C.int = v => parseInt(String(v == null ? '' : v).replace(/[^\d]/g, ''), 10) || 0;
  C.rupees = n => '₹' + (Number(n) || 0).toLocaleString('en-IN');
  C.plural = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');

  C.dateStr = function (d) {
    const p = n => (n < 10 ? '0' : '') + n;
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  };
  C.today = () => C.dateStr(new Date());
  C.addDays = (date, n) => { const d = new Date(date + 'T12:00'); d.setDate(d.getDate() + n); return C.dateStr(d); };

  // "17:30" → "5:30 PM"
  C.fmtTime = function (hhmm) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
    if (!m) return hhmm || '';
    let h = +m[1];
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return h + (m[2] === '00' ? '' : ':' + m[2]) + ' ' + ap;
  };
  // "Sun, 16 Nov"
  C.fmtDate = date => new Date(date + 'T12:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  // "Today’s Lunch", "Tomorrow’s Dinner", "Monday’s Lunch"
  C.mealTitle = function (date, meal) {
    const t = C.today();
    const day = date === t ? 'Today' : date === C.addDays(t, 1) ? 'Tomorrow'
      : new Date(date + 'T12:00').toLocaleDateString('en-IN', { weekday: 'long' });
    return day + '’s ' + meal;
  };

  C.store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    remove(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  // ---------- What's on a menu, and what an order costs (mirrors bill_ in Code.gs) ----------

  C.lines = function (m) {
    const n = C.int;
    if (m.meal === 'Dinner') {
      return [1, 2, 3, 4].filter(i => m['d' + i]).map(i => ({ k: 'b' + i, label: m['d' + i], price: n(m['p' + i]) }));
    }
    const out = [];
    out.push({ k: 'm1', label: m.r2 ? 'Meal with ' + (m.r1 || 'rice') : 'Meal', price: n(m.mealPrice) });
    if (m.r2) out.push({ k: 'm2', label: 'Meal with ' + m.r2, price: n(m.mealPrice) });
    [1, 2, 3, 4].forEach(i => { if (m['d' + i]) out.push({ k: 'i' + i, label: m['d' + i] + ' (single)', price: n(m.itemPrice) }); });
    out.push({ k: 'x', label: (m.r2 || 'Roti') + ' (extra)', price: n(m.rotiPrice) });
    return out;
  };
  C.bill = function (m, q) {
    const rows = C.lines(m).filter(l => q[l.k]).map(l => ({ label: l.label, qty: q[l.k], amount: q[l.k] * l.price }));
    return { rows, total: rows.reduce((s, r) => s + r.amount, 0) };
  };

  // ---------- Item picker: steppers that never let you pick more than is left ----------

  C.Picker = function (el, onChange) {
    let menu = null, q = {};
    const CAP = 30;

    function groups(m) {
      const L = m.left || {};
      const n = C.int;
      if (m.meal === 'Dinner') {
        return [{ title: 'Dinner bowls', sub: 'Priced per bowl', rows: [1, 2, 3, 4].filter(i => m['d' + i]).map(i => ({ k: 'b' + i, name: m['d' + i], price: n(m['p' + i]), left: L.bowls ? L.bowls[i - 1] : null })) }];
      }
      const dishes = [1, 2, 3, 4].map(i => m['d' + i]).filter(Boolean);
      const kpm = m.r2 ? n(m.rotisPerMeal) : 0;
      const out = [{
        title: 'Complete meal', price: n(m.mealPrice), left: L.meals, unit: 'meal',
        sub: 'Includes ' + dishes.concat(m.side ? [m.side] : []).join(', '),
        rows: m.r2
          ? [{ k: 'm1', name: 'With ' + (m.r1 || 'rice') }, { k: 'm2', name: 'With ' + m.r2, note: kpm ? C.plural(kpm, m.r2.toLowerCase()) : '' }]
          : [{ k: 'm1', name: 'Meal' }]
      }];
      if (dishes.length) out.push({
        title: 'Single items', price: n(m.itemPrice), left: L.items, unit: 'single item', sub: 'Any one dish on its own · serves 2',
        rows: [1, 2, 3, 4].filter(i => m['d' + i]).map(i => ({ k: 'i' + i, name: m['d' + i] }))
      });
      out.push({ title: 'Extra ' + (m.r2 || 'roti').toLowerCase(), price: n(m.rotiPrice), left: L.rotis, unit: (m.r2 || 'roti').toLowerCase(), sub: 'Per piece', rows: [{ k: 'x', name: m.r2 || 'Roti' }] });
      return out;
    }

    function maxFor(k) {
      const L = menu.left || {}, g = x => q[x] || 0, has = v => v !== null && v !== undefined;
      const kpm = menu.r2 ? C.int(menu.rotisPerMeal) : 0;
      let max = CAP;
      if ((k === 'm1' || k === 'm2') && has(L.meals)) max = Math.min(max, L.meals - g('m1') - g('m2') + g(k));
      if (k === 'm2' && has(L.rotis) && kpm) max = Math.min(max, Math.floor((L.rotis - g('x')) / kpm));
      if (k[0] === 'i' && has(L.items)) max = Math.min(max, L.items - (g('i1') + g('i2') + g('i3') + g('i4')) + g(k));
      if (k === 'x' && has(L.rotis)) max = Math.min(max, L.rotis - g('m2') * kpm);
      if (k[0] === 'b' && L.bowls && has(L.bowls[+k[1] - 1])) max = Math.min(max, L.bowls[+k[1] - 1]);
      return Math.max(0, max);
    }

    function render() {
      el.innerHTML = groups(menu).map(gr => `
        <div class="pick-group">
          <div class="pg-head"><h3>${C.esc(gr.title)}</h3>${gr.price !== undefined ? `<span class="price">${C.rupees(gr.price)}</span>` : ''}</div>
          <p class="pg-sub">${C.esc(gr.sub)}${gr.unit && gr.left !== null && gr.left !== undefined ? ` · <strong data-group-left>${gr.left ? C.plural(gr.left, gr.unit) + ' left' : 'Sold out'}</strong>` : ''}</p>
          ${gr.rows.map(r => `
            <div class="pick-row" data-row="${r.k}">
              <div><div class="pr-name">${C.esc(r.name)}</div><div class="pr-sub" data-sub="${r.k}">${C.esc(r.note || '')}</div></div>
              <div class="pr-right">
                ${r.price !== undefined ? `<span class="pr-price">${C.rupees(r.price)}</span>` : ''}
                <span class="stepper">
                  <button type="button" data-k="${r.k}" data-d="-1" aria-label="One less: ${C.esc(r.name)}">−</button>
                  <output data-out="${r.k}" aria-live="polite">0</output>
                  <button type="button" data-k="${r.k}" data-d="1" aria-label="One more: ${C.esc(r.name)}">+</button>
                </span>
              </div>
            </div>`).join('')}
        </div>`).join('');
      el._rows = groups(menu).flatMap(g => g.rows);
      update();
    }

    function update() {
      el._rows.forEach(r => {
        const max = maxFor(r.k), cur = q[r.k] || 0;
        el.querySelector(`[data-out="${r.k}"]`).textContent = cur;
        el.querySelector(`[data-k="${r.k}"][data-d="-1"]`).disabled = cur <= 0;
        el.querySelector(`[data-k="${r.k}"][data-d="1"]`).disabled = cur >= max;
        const sub = el.querySelector(`[data-sub="${r.k}"]`);
        const soldOut = max === 0 && cur === 0;
        if (r.left !== undefined && r.left !== null) sub.textContent = r.left ? r.left + ' left' : 'Sold out';
        else sub.textContent = soldOut ? 'Sold out' : (r.note || '');
        sub.classList.toggle('out', soldOut);
      });
      if (onChange) onChange();
    }

    el.addEventListener('click', e => {
      const b = e.target.closest('button[data-k]');
      if (!b || b.disabled) return;
      const k = b.dataset.k, next = (q[k] || 0) + Number(b.dataset.d);
      if (next < 0 || next > maxFor(k)) return;
      if (next) q[k] = next; else delete q[k];
      update();
    });

    return {
      // Optionally starts with quantities already picked; anything no longer on the menu is dropped.
      setMenu(m, picked) {
        menu = m; q = {};
        C.lines(m).forEach(l => { if (picked && picked[l.k]) q[l.k] = picked[l.k]; });
        render();
      },
      qty: () => Object.assign({}, q),
      bill: () => (menu ? C.bill(menu, q) : { rows: [], total: 0 }),
      count: () => Object.values(q).reduce((a, b) => a + b, 0),
      reset() { q = {}; if (menu) update(); }
    };
  };
})();
