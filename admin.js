// Admin page: sign in, set the menu and limits (with the poster), see and complete orders, and look back at collections.
(function () {
  const C = Crescent, $ = id => document.getElementById(id);
  const PW_KEY = 'crescent-admin';
  const FIELDS = ['d1', 'd2', 'd3', 'd4', 'p1', 'p2', 'p3', 'p4', 'lim1', 'lim2', 'lim3', 'lim4', 'r1', 'r2', 'side',
    'mealPrice', 'itemPrice', 'rotiPrice', 'mealLimit', 'itemLimit', 'rotiLimit', 'rotisPerMeal', 'orderBy', 'pickup', 'phone', 'flat', 'scheme'];
  const DEFAULTS = {
    Lunch: { r1: 'Rice', r2: 'Roti', side: 'Curd', mealPrice: '200', itemPrice: '100', rotiPrice: '12', orderBy: '11:00', pickup: '1:00 PM – 1:30 PM', scheme: 'Tomato Red' },
    Dinner: { p1: '175', p2: '175', p3: '175', p4: '175', orderBy: '17:00', pickup: '7:30 PM – 8:00 PM', scheme: 'Indigo Night' },
    both: { phone: '+91 76719 04862', flat: 'Flat 4094 (D-Tower)' }
  };

  let password = C.store.get(PW_KEY) || '';
  let data = { menus: [], orders: [], sheetUrl: '' };
  let tab = 'orders', selectedMenu = '', filter = 'todo', meal = 'Lunch';

  if (C.mock) $('mockPill').hidden = false;

  function say(el, msg, isError) {
    el.textContent = msg || '';
    el.classList.toggle('error', !!isError);
  }
  function admin(action, extra) {
    return C.post(Object.assign({ action, password }, extra || {})).catch(e => {
      if (e.code === 'password') signOut('That password is not right any more. Please sign in again.');
      throw e;
    });
  }

  // ---------- Sign in ----------

  function signOut(msg) {
    password = '';
    C.store.remove(PW_KEY);
    ['tabs', 'logout', 'tab-orders', 'tab-menu', 'tab-records'].forEach(id => { $(id).hidden = true; });
    $('login').hidden = false;
    say($('loginStatus'), msg || '', !!msg);
  }

  $('loginForm').addEventListener('submit', e => {
    e.preventDefault();
    password = $('pw').value;
    $('loginBtn').disabled = true;
    say($('loginStatus'), 'Checking…');
    load().then(() => {
      C.store.set(PW_KEY, password);
      $('pw').value = '';
      start();
    }).catch(err => {
      if (err.code !== 'password') say($('loginStatus'), err.message, true);
      else { $('login').hidden = false; say($('loginStatus'), err.message, true); }
    }).then(() => { $('loginBtn').disabled = false; });
  });
  $('logout').addEventListener('click', () => signOut());

  function start() {
    $('login').hidden = true;
    $('tabs').hidden = false;
    $('logout').hidden = false;
    say($('loginStatus'), '');
    showTab(tab);
    if (!$('mDate').value) pickMenuToEdit();
  }

  // ---------- Data ----------

  function load() {
    return admin('adminData').then(d => {
      data = d;
      renderOrdersTab();
      renderRecords();
      return d;
    });
  }

  function menuById(id) { return data.menus.find(m => m.id === id); }
  function menuLabel(m) { return C.fmtDate(m.date) + ' · ' + m.meal; }
  function stateOf(m) {
    if (m.status === 'Closed') return { text: 'Closed', cls: '' };
    if (!m.open) return { text: 'Order time passed', cls: '' };
    return { text: 'Taking orders', cls: 'good' };
  }

  // ---------- Tabs ----------

  function showTab(t) {
    tab = t;
    $('tabs').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tab === t)));
    ['orders', 'menu', 'records'].forEach(x => { $('tab-' + x).hidden = x !== t; });
    if (t === 'menu') drawPoster();
  }
  $('tabs').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) showTab(b.dataset.tab); });

  // ---------- Orders tab ----------

  function defaultMenuId() {
    // The soonest menu still taking orders; otherwise the latest one.
    const open = data.menus.filter(m => m.open).sort((a, b) => (a.id < b.id ? -1 : 1));
    return (open[0] || data.menus[0] || {}).id || '';
  }

  function renderOrdersTab() {
    const pick = $('menuPick');
    if (!menuById(selectedMenu)) selectedMenu = defaultMenuId();
    pick.innerHTML = data.menus.map(m => `<option value="${C.esc(m.id)}">${C.esc(menuLabel(m))} · ${C.esc(stateOf(m).text)} · ${m.stats.orders} orders</option>`).join('');
    pick.value = selectedMenu;
    $('noMenus').hidden = !!data.menus.length;
    $('menuView').hidden = !data.menus.length;
    if (data.menus.length) renderMenuView();
  }
  $('menuPick').addEventListener('change', () => { selectedMenu = $('menuPick').value; $('addForm').hidden = true; renderMenuView(); });
  $('refresh').addEventListener('click', () => refresh());

  function refresh(quiet) {
    if (!quiet) say($('globalStatus'), 'Refreshing…');
    return load().then(() => { if (!quiet) say($('globalStatus'), ''); }, e => say($('globalStatus'), e.message, true));
  }

  function tile(label, value, small, full) {
    return `<div class="tile${full ? ' full' : ''}"><span>${C.esc(label)}</span><strong>${value}</strong>${small ? `<small>${C.esc(small)}</small>` : ''}</div>`;
  }

  function renderMenuView() {
    const m = menuById(selectedMenu);
    if (!m) return;
    const s = m.stats, st = stateOf(m);
    $('mvTitle').textContent = C.mealTitle(m.date, m.meal) + ' · ' + C.fmtDate(m.date);
    $('mvState').textContent = st.text;
    $('mvState').className = 'pill ' + st.cls;
    $('mvToggle').textContent = m.status === 'Closed' ? 'Open orders again' : 'Stop taking orders';

    // Limits: how much is taken against each one.
    function limitTile(label, used, limit) {
      const has = String(limit || '') !== '';
      return tile(label, has ? `${used}<small> / ${C.int(limit)}</small>` : String(used), has ? (Math.max(0, C.int(limit) - used) + ' left') : 'No limit', has && used >= C.int(limit));
    }
    if (m.meal === 'Lunch') {
      $('limitTiles').innerHTML = limitTile('Meals', s.used.meals, m.mealLimit) + limitTile('Single items', s.used.items, m.itemLimit)
        + limitTile((m.r2 || 'Roti') + 's', s.used.rotis, m.rotiLimit);
    } else {
      $('limitTiles').innerHTML = [1, 2, 3, 4].filter(i => m['d' + i]).map(i => limitTile(m['d' + i], s.used.bowls[i - 1], m['lim' + i])).join('');
    }
    $('moneyTiles').innerHTML = tile('Orders', String(s.orders)) + tile('Total', C.rupees(s.total))
      + tile('Collected', C.rupees(s.collected)) + tile('Still to collect', C.rupees(s.total - s.collected));

    // What to cook, from every order that isn't cancelled.
    const cook = C.lines(m).filter(l => s.counts[l.k]).map(l => `<li>${s.counts[l.k]} × ${C.esc(l.label)}</li>`);
    if (m.meal === 'Lunch' && s.used.rotis) cook.push(`<li><strong>${s.used.rotis} ${C.esc((m.r2 || 'roti').toLowerCase())}s in total</strong></li>`);
    $('cook').innerHTML = cook.join('') || '<li class="muted">Nothing yet.</li>';

    renderOrderList();
  }

  $('mvToggle').addEventListener('click', () => {
    const m = menuById(selectedMenu), btn = $('mvToggle');
    btn.disabled = true;
    admin('setMenuStatus', { id: m.id, status: m.status === 'Closed' ? 'Open' : 'Closed' })
      .then(() => refresh(true))
      .catch(e => say($('globalStatus'), e.message, true))
      .then(() => { btn.disabled = false; });
  });

  $('filter').addEventListener('click', e => {
    const b = e.target.closest('button[data-f]');
    if (!b) return;
    filter = b.dataset.f;
    $('filter').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    renderOrderList();
  });

  function waLink(phone) {
    let d = (phone || '').replace(/\D/g, '');
    if (d.length === 10) d = '91' + d;
    return d.length >= 11 ? 'https://wa.me/' + d : '';
  }

  function renderOrderList() {
    const all = data.orders.filter(o => o.menuId === selectedMenu);
    const list = all.filter(o => filter === 'all' || (filter === 'todo' ? o.status === 'Pending' : o.status === filter))
      .sort((a, b) => a.id - b.id);
    if (!list.length) {
      $('orderList').innerHTML = `<p class="muted">${all.length ? 'No orders here.' : 'No orders yet.'}</p>`;
      return;
    }
    $('orderList').innerHTML = list.map(o => {
      const done = o.status === 'Completed', off = o.status === 'Cancelled';
      const wa = waLink(o.phone);
      const buttons = off
        ? `<button type="button" class="quiet" data-act="Pending" data-id="${o.id}">Restore order</button>`
        : done
          ? `<button type="button" class="quiet" data-act="Pending" data-id="${o.id}">Undo completed</button>`
          : `<button type="button" data-act="Completed" data-id="${o.id}">Mark completed</button>
             <button type="button" class="quiet" data-act="Cancelled" data-id="${o.id}">Cancel order</button>`;
      return `<article class="order${done ? ' is-done' : ''}${off ? ' is-off' : ''}">
        <div class="o-top">
          <span class="o-who">#${o.id} · ${C.esc(o.name)}${o.flat ? ' · ' + C.esc(o.flat) : ''}</span>
          <span class="o-total${off ? ' pill off' : ''}">${C.rupees(o.total)}</span>
        </div>
        <div>${C.esc(o.items)}</div>
        ${o.notes ? `<div class="o-notes">“${C.esc(o.notes)}”</div>` : ''}
        <div class="o-meta">
          <span class="pill ${done ? 'good' : off ? 'warn' : ''}">${done ? 'Completed ' + C.esc(o.completedAt.slice(11)) : C.esc(o.status)}</span>
          ${o.phone ? `<a href="tel:${C.esc(o.phone.replace(/[^\d+]/g, ''))}">${C.esc(o.phone)}</a>` : ''}
          ${wa ? `<a href="${wa}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
          <span>${C.esc(o.source)} · ${C.esc(o.placedAt.slice(11))}</span>
        </div>
        <div class="actions">${buttons}</div>
      </article>`;
    }).join('');
  }

  // Cancelling asks for a second tap instead of a pop-up.
  $('orderList').addEventListener('click', e => {
    const b = e.target.closest('button[data-act]');
    if (!b || b.disabled) return;
    if (b.dataset.act === 'Cancelled' && !b.dataset.sure) {
      b.dataset.sure = '1';
      b.textContent = 'Tap again to cancel';
      setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; b.textContent = 'Cancel order'; } }, 4000);
      return;
    }
    b.closest('.order').querySelectorAll('button').forEach(x => { x.disabled = true; });
    admin('setOrderStatus', { id: Number(b.dataset.id), status: b.dataset.act })
      .then(() => refresh(true))
      .catch(err => { say($('globalStatus'), err.message, true); renderOrderList(); });
  });

  // Adding an order yourself
  const addPicker = C.Picker($('addPicker'), () => { $('addTotal').textContent = C.rupees(addPicker.bill().total); });
  $('addToggle').addEventListener('click', () => {
    const m = menuById(selectedMenu);
    addPicker.setMenu(Object.assign({}, m, { left: m.stats.left }));
    ['aName', 'aPhone', 'aFlat', 'aNotes'].forEach(id => { $(id).value = ''; });
    say($('addStatus'), '');
    $('addForm').hidden = false;
    $('aName').focus();
  });
  $('addCancel').addEventListener('click', () => { $('addForm').hidden = true; });
  $('addForm').addEventListener('submit', e => {
    e.preventDefault();
    if (!addPicker.count()) return say($('addStatus'), 'Pick at least one item.', true);
    if (!$('aName').value.trim()) return say($('addStatus'), 'Add a name.', true);
    $('addBtn').disabled = true;
    say($('addStatus'), 'Adding…');
    admin('addOrder', { menuId: selectedMenu, qty: addPicker.qty(), name: $('aName').value, phone: $('aPhone').value, flat: $('aFlat').value, notes: $('aNotes').value })
      .then(d => {
        $('addForm').hidden = true;
        say($('globalStatus'), 'Added order #' + d.order.id + ' for ' + d.order.name + '.');
        return refresh(true);
      })
      .catch(err => say($('addStatus'), err.message, true))
      .then(() => { $('addBtn').disabled = false; });
  });

  // New website orders show up on their own every minute.
  setInterval(() => {
    if (password && tab === 'orders' && $('addForm').hidden && document.visibilityState === 'visible') refresh(true);
  }, 60000);

  // ---------- Menu & poster tab ----------

  const schemeSel = $('scheme');
  schemeSel.innerHTML = Object.keys(CrescentPoster.SCHEMES).map(s => `<option>${C.esc(s)}</option>`).join('');

  function setMeal(mv) {
    meal = mv;
    document.body.classList.toggle('dinner', meal === 'Dinner');
    $('mMeal').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.meal === meal)));
  }

  // Start on tomorrow's lunch, or whatever is next after the latest menu.
  function pickMenuToEdit() {
    $('mDate').value = C.addDays(C.today(), 1);
    setMeal('Lunch');
    fillMenuForm();
  }

  function fillMenuForm() {
    const date = $('mDate').value, id = date + '-' + meal.toLowerCase();
    const existing = menuById(id);
    let src, note;
    if (existing) {
      src = existing;
      note = `Already published (${stateOf(existing).text.toLowerCase()}, ${C.plural(existing.stats.orders, 'order')}). Saving updates it.`;
    } else {
      const last = data.menus.filter(m => m.meal === meal).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
      src = Object.assign({}, DEFAULTS.both, DEFAULTS[meal], last || {});
      note = last ? `New menu, not published yet. Everything is copied from ${C.fmtDate(last.date)}.` : 'New menu.';
    }
    FIELDS.forEach(k => { $(k).value = src[k] == null ? '' : src[k]; });
    if (!CrescentPoster.SCHEMES[schemeSel.value]) schemeSel.value = DEFAULTS[meal].scheme;
    $('mExisting').textContent = note;
    $('publish').textContent = !existing ? 'Publish & open orders' : existing.status === 'Closed' ? 'Save & open orders again' : 'Save changes';
    say($('menuStatus'), '');
    drawPoster();
  }

  $('mDate').addEventListener('change', fillMenuForm);
  $('mMeal').addEventListener('click', e => {
    const b = e.target.closest('button[data-meal]');
    if (b && b.dataset.meal !== meal) { setMeal(b.dataset.meal); fillMenuForm(); }
  });

  function readMenuForm() {
    const f = {};
    FIELDS.forEach(k => { f[k] = $(k).value.trim(); });
    return f;
  }

  function posterState() {
    const f = readMenuForm(), t = C.fmtTime(f.orderBy);
    return Object.assign({}, f, {
      heading: C.mealTitle($('mDate').value || C.today(), meal),
      meal: f.mealPrice, item: f.itemPrice, roti: f.rotiPrice,
      lOrder: t, dOrder: t, lPick: f.pickup, dPick: f.pickup, lScheme: f.scheme, dScheme: f.scheme
    });
  }

  let drawTimer = null;
  function drawPoster() {
    clearTimeout(drawTimer);
    drawTimer = setTimeout(() => { $('poster').src = CrescentPoster.render(posterState()).toDataURL('image/png'); }, 120);
  }
  FIELDS.forEach(k => { $(k).addEventListener('input', drawPoster); $(k).addEventListener('change', drawPoster); });
  CrescentPoster.fontsReady().then(drawPoster);

  $('publish').addEventListener('click', () => {
    const btn = $('publish'), date = $('mDate').value;
    btn.disabled = true;
    say($('menuStatus'), 'Saving…');
    admin('saveMenu', { menu: Object.assign(readMenuForm(), { date, meal, status: 'Open' }) }).then(d => {
      const m = d.menu;
      selectedMenu = m.id;
      return load().then(() => {
        fillMenuForm();
        say($('menuStatus'), m.open
          ? `Published. Orders are open until ${C.fmtTime(m.orderBy) || 'the end of the day'} on ${C.fmtDate(m.date)}.`
          : 'Saved, but the order-by time for this date has already passed, so the website won’t take orders for it.', !m.open);
      });
    }).catch(e => say($('menuStatus'), e.message, true)).then(() => { btn.disabled = false; });
  });

  function fileName() { return 'Crescent-Menu-' + ($('mDate').value || C.today()) + '-' + meal + '.png'; }
  function posterBlob() {
    return new Promise((res, rej) => CrescentPoster.render(posterState()).toBlob(b => (b ? res(b) : rej(new Error('blob'))), 'image/png'));
  }
  $('saveImg').addEventListener('click', () => {
    posterBlob().then(blob => {
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = fileName();
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      say($('menuStatus'), 'Saved to your downloads.');
    }).catch(() => say($('menuStatus'), 'Couldn’t make the picture. Press and hold the poster and choose Save image.', true));
  });
  if (navigator.canShare && typeof File === 'function') {
    try {
      if (navigator.canShare({ files: [new File([new Blob(['x'], { type: 'image/png' })], 'p.png', { type: 'image/png' })] })) $('shareImg').hidden = false;
    } catch (e) {}
  }
  $('shareImg').addEventListener('click', () => {
    posterBlob().then(blob => navigator.share({ files: [new File([blob], fileName(), { type: 'image/png' })] }))
      .then(() => say($('menuStatus'), 'Shared.'))
      .catch(e => say($('menuStatus'), e && e.name === 'AbortError' ? 'Share cancelled.' : 'Sharing didn’t work. Use Save image instead.'));
  });

  // ---------- Records tab ----------

  $('month').value = C.today().slice(0, 7);
  $('month').addEventListener('change', renderRecords);

  function renderRecords() {
    const month = $('month').value;
    $('sheetLink').href = data.sheetUrl || '#';
    const ms = data.menus.filter(m => m.date.slice(0, 7) === month && m.stats.orders).sort((a, b) => (a.id < b.id ? -1 : 1));
    const sum = k => ms.reduce((s, m) => s + m.stats[k], 0);
    const completed = m => data.orders.filter(o => o.menuId === m.id && o.status === 'Completed').length;
    const total = sum('total'), collected = sum('collected');
    const allCollected = data.menus.reduce((s, m) => s + m.stats.collected, 0);
    $('recTiles').innerHTML = tile('Collected this month', C.rupees(collected)) + tile('Still to collect', C.rupees(total - collected))
      + tile('Orders this month', String(sum('orders'))) + tile('Collected, all time', C.rupees(allCollected));
    $('recBody').innerHTML = ms.length ? ms.map(m => `<tr><td>${C.esc(C.fmtDate(m.date))}</td><td>${C.esc(m.meal)}</td>
      <td class="n">${m.stats.orders}</td><td class="n">${completed(m)}</td><td class="n">${C.rupees(m.stats.total)}</td><td class="n">${C.rupees(m.stats.collected)}</td></tr>`).join('')
      : '<tr><td colspan="6" class="muted">No orders this month.</td></tr>';
    $('recFoot').innerHTML = ms.length ? `<tr><td colspan="2">Month total</td><td class="n">${sum('orders')}</td><td class="n">${ms.reduce((s, m) => s + completed(m), 0)}</td><td class="n">${C.rupees(total)}</td><td class="n">${C.rupees(collected)}</td></tr>` : '';
  }

  // ---------- Start ----------

  if (!C.configured) { $('setup').hidden = false; return; }
  if (!password) { signOut(); return; }
  say($('globalStatus'), 'Loading…');
  load().then(() => { say($('globalStatus'), ''); start(); }).catch(e => {
    if (e.code !== 'password') { say($('globalStatus'), e.message, true); $('login').hidden = false; }
  });
})();
