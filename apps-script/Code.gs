/**
 * Crescent Home Kitchen: order backend.
 *
 * This lives inside your Google Sheet (Extensions → Apps Script) and runs as a web app.
 * The website talks to it, and every order becomes a row in the "Orders" tab.
 * Setup steps are in SETUP.md.
 */

// Change this before deploying. You type it once on the admin page.
var ADMIN_PASSWORD = 'change-me';

var TZ = 'Asia/Kolkata';
var ORDER_HEADERS = ['Order #', 'Placed at', 'Date', 'Meal', 'Name', 'Phone', 'Flat', 'Items', 'Total (₹)', 'Status', 'Completed at', 'Source', 'Notes', 'Menu ID', 'Quantities'];
var MENU_HEADERS = ['Menu ID', 'Date', 'Meal', 'Status', 'Order by', 'Pickup', 'Updated at', 'Details'];
var STATUSES = ['Pending', 'Completed', 'Cancelled'];
var MENU_TEXT = ['d1', 'd2', 'd3', 'd4', 'r1', 'r2', 'side', 'orderBy', 'pickup', 'phone', 'flat', 'scheme'];
var MENU_NUMBERS = ['p1', 'p2', 'p3', 'p4', 'lim1', 'lim2', 'lim3', 'lim4', 'mealPrice', 'itemPrice', 'rotiPrice', 'mealLimit', 'itemLimit', 'rotiLimit', 'rotisPerMeal'];
var MAX_EACH = 30;

// ---------- Web entry points ----------

function doGet(e) {
  return respond_(function () {
    var action = (e && e.parameter && e.parameter.action) || 'menus';
    if (action === 'menus') return { menus: openMenus_() };
    fail_('Unknown request.');
  });
}

function doPost(e) {
  return respond_(function () {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.action === 'placeOrder') return withLock_(function () { return { order: placeOrder_(body, false) }; });
    if (body.action === 'findOrder') return findOrder_(body);
    if (body.action === 'updateOrder') return withLock_(function () { return { order: updateOrder_(body) }; });
    if (body.action === 'cancelOrder') return withLock_(function () { return { order: cancelOrder_(body) }; });

    checkPassword_(body.password);
    switch (body.action) {
      case 'adminData': return adminData_();
      case 'saveMenu': return withLock_(function () { return { menu: saveMenu_(body.menu || {}) }; });
      case 'setMenuStatus': return withLock_(function () { return { menu: setMenuStatus_(body.id, body.status) }; });
      case 'addOrder': return withLock_(function () { return { order: placeOrder_(body, true) }; });
      case 'setOrderStatus': return withLock_(function () { return { order: setOrderStatus_(body.id, body.status) }; });
    }
    fail_('Unknown request.');
  });
}

// Run once from the editor to create the tabs (they are also created on first use).
function setup() {
  sheet_('Orders', ORDER_HEADERS);
  sheet_('Menus', MENU_HEADERS);
}

function respond_(fn) {
  var out;
  try {
    out = fn();
    out.ok = true;
  } catch (err) {
    out = { ok: false, error: err.message || String(err), code: err.code || '' };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function fail_(message, code) {
  var err = new Error(message);
  err.code = code || '';
  throw err;
}

// One change at a time, so two people can't both take the last meal.
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) fail_('The kitchen is busy right now. Please try again in a moment.');
  try { return fn(); } finally { lock.releaseLock(); }
}

function checkPassword_(pw) {
  if (ADMIN_PASSWORD === 'change-me') fail_('Set ADMIN_PASSWORD in Code.gs and redeploy first.', 'setup');
  if (pw !== ADMIN_PASSWORD) {
    Utilities.sleep(800);
    fail_('That password is not right.', 'password');
  }
}

// ---------- Sheet helpers ----------

function sheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function rows_(name, headers) {
  var sh = sheet_(name, headers), n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, headers.length).getValues().map(function (v, i) {
    return { row: i + 2, v: v.map(function (c) { return c instanceof Date ? Utilities.formatDate(c, TZ, 'yyyy-MM-dd HH:mm') : c; }) };
  });
}

function writeRow_(name, headers, row, values) {
  var sh = sheet_(name, headers);
  if (!row) row = sh.getLastRow() + 1;
  sh.getRange(row, 1, 1, values.length).setValues([values]);
  return row;
}

// A leading apostrophe makes Sheets keep the value as typed (no dates, numbers or formulas).
function text_(v) {
  v = v == null ? '' : String(v);
  return v === '' ? '' : "'" + v;
}

function str_(v) { return v == null ? '' : String(v).trim(); }
function int_(v) { var n = parseInt(String(v == null ? '' : v).replace(/[^\d-]/g, ''), 10); return isNaN(n) ? 0 : n; }
function limit_(v) { return str_(v) === '' ? null : int_(v); }
function left_(lim, used) { lim = limit_(lim); return lim === null ? null : Math.max(0, lim - used); }
function nowStr_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'); }
function plural_(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

function fmtTime_(hhmm) {
  var m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
  if (!m) return hhmm || '';
  var h = +m[1], ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return h + (m[2] === '00' ? '' : ':' + m[2]) + ' ' + ap;
}

// ---------- Menus ----------

function readMenus_() {
  return rows_('Menus', MENU_HEADERS).map(function (r) {
    var m = {};
    try { m = JSON.parse(r.v[7] || '{}'); } catch (e) {}
    m.id = str_(r.v[0]);
    m.date = str_(r.v[1]).slice(0, 10);
    m.meal = str_(r.v[2]);
    m.status = /^closed$/i.test(str_(r.v[3])) ? 'Closed' : 'Open';
    m.updatedAt = str_(r.v[6]);
    m.row = r.row;
    return m;
  }).filter(function (m) { return m.id; });
}

function findMenu_(id) {
  var m = readMenus_().filter(function (x) { return x.id === id; })[0];
  if (!m) fail_('This menu isn’t available any more. Please refresh the page.', 'gone');
  return m;
}

function isOpen_(m) {
  return m.status === 'Open' && nowStr_() < m.date + ' ' + (m.orderBy || '23:59');
}

function saveMenu_(input) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date || '')) fail_('Pick a date for the menu.');
  if (input.meal !== 'Lunch' && input.meal !== 'Dinner') fail_('Pick lunch or dinner.');
  var d = {};
  MENU_TEXT.forEach(function (k) { d[k] = str_(input[k]).slice(0, 60); });
  MENU_NUMBERS.forEach(function (k) { d[k] = str_(input[k]).replace(/[^\d]/g, '').slice(0, 6); });
  if (d.orderBy && !/^\d{2}:\d{2}$/.test(d.orderBy)) fail_('The order-by time doesn’t look right.');
  if (!d.d1 && !d.d2 && !d.d3 && !d.d4) fail_('Add at least one dish.');
  if (input.meal === 'Lunch' && d.r2 && d.rotiLimit !== '' && d.rotisPerMeal === '')
    fail_('Say how many rotis come in one ' + d.r2.toLowerCase() + ' meal, so the roti limit can count them.');

  var id = input.date + '-' + input.meal.toLowerCase();
  var existing = readMenus_().filter(function (x) { return x.id === id; })[0];
  var status = input.status === 'Closed' ? 'Closed' : 'Open';
  writeRow_('Menus', MENU_HEADERS, existing && existing.row, [
    text_(id), text_(input.date), text_(input.meal), text_(status),
    text_(fmtTime_(d.orderBy)), text_(d.pickup), text_(nowStr_()), text_(JSON.stringify(d))
  ]);
  return withStats_(findMenu_(id), readOrders_());
}

function setMenuStatus_(id, status) {
  var m = findMenu_(id);
  writeRow_('Menus', MENU_HEADERS, m.row, [text_(m.id), text_(m.date), text_(m.meal), text_(status === 'Closed' ? 'Closed' : 'Open'),
    text_(fmtTime_(m.orderBy)), text_(m.pickup), text_(nowStr_()), text_(JSON.stringify(menuDetails_(m)))]);
  return withStats_(findMenu_(id), readOrders_());
}

function menuDetails_(m) {
  var d = {};
  MENU_TEXT.concat(MENU_NUMBERS).forEach(function (k) { d[k] = m[k] == null ? '' : m[k]; });
  return d;
}

// What has been ordered so far (cancelled orders don't count) and what is left under each limit.
function stats_(m, orders) {
  var u = { m1: 0, m2: 0, i1: 0, i2: 0, i3: 0, i4: 0, x: 0, b1: 0, b2: 0, b3: 0, b4: 0 };
  var count = 0, total = 0, collected = 0;
  orders.forEach(function (o) {
    if (o.menuId !== m.id || o.status === 'Cancelled') return;
    Object.keys(u).forEach(function (k) { u[k] += int_(o.qty[k]); });
    count++;
    total += o.total;
    if (o.status === 'Completed') collected += o.total;
  });
  var used = {
    meals: u.m1 + u.m2,
    items: u.i1 + u.i2 + u.i3 + u.i4,
    rotis: (m.r2 ? u.m2 * int_(m.rotisPerMeal) : 0) + u.x,
    bowls: [u.b1, u.b2, u.b3, u.b4]
  };
  var left = {
    meals: left_(m.mealLimit, used.meals),
    items: left_(m.itemLimit, used.items),
    rotis: left_(m.rotiLimit, used.rotis),
    bowls: [1, 2, 3, 4].map(function (i) { return left_(m['lim' + i], used.bowls[i - 1]); })
  };
  return { counts: u, used: used, left: left, orders: count, total: total, collected: collected };
}

function withStats_(m, orders) {
  var out = menuDetails_(m);
  out.id = m.id; out.date = m.date; out.meal = m.meal; out.status = m.status; out.updatedAt = m.updatedAt;
  out.open = isOpen_(m);
  out.stats = stats_(m, orders);
  return out;
}

// What customers see: the menu and how much is left, never other people's orders.
function openMenus_() {
  var orders = readOrders_();
  return readMenus_().filter(isOpen_).sort(function (a, b) {
    return a.date === b.date ? (a.meal === 'Lunch' ? -1 : 1) : (a.date < b.date ? -1 : 1);
  }).map(function (m) {
    var d = menuDetails_(m);
    ['lim1', 'lim2', 'lim3', 'lim4', 'mealLimit', 'itemLimit', 'rotiLimit', 'scheme'].forEach(function (k) { delete d[k]; });
    d.id = m.id; d.date = m.date; d.meal = m.meal;
    d.left = stats_(m, orders).left;
    return d;
  });
}

// ---------- Orders ----------

function readOrders_() {
  return rows_('Orders', ORDER_HEADERS).map(function (r) {
    var v = r.v, q = {};
    try { q = JSON.parse(v[14] || '{}'); } catch (e) {}
    var status = STATUSES.filter(function (s) { return s.toLowerCase() === str_(v[9]).toLowerCase(); })[0] || 'Pending';
    return {
      row: r.row, id: int_(v[0]), placedAt: str_(v[1]), date: str_(v[2]).slice(0, 10), meal: str_(v[3]),
      name: str_(v[4]), phone: str_(v[5]), flat: str_(v[6]), items: str_(v[7]), total: Number(v[8]) || 0,
      status: status, completedAt: str_(v[10]), source: str_(v[11]), notes: str_(v[12]), menuId: str_(v[13]), qty: q
    };
  }).filter(function (o) { return o.id; });
}

function cleanQty_(m, raw) {
  raw = raw || {};
  var q = {};
  function take(k, allowed) {
    var n = allowed ? Math.min(MAX_EACH, Math.max(0, int_(raw[k]))) : 0;
    if (n) q[k] = n;
  }
  if (m.meal === 'Lunch') {
    take('m1', true);
    take('m2', !!m.r2);
    [1, 2, 3, 4].forEach(function (i) { take('i' + i, !!m['d' + i]); });
    take('x', true);
  } else {
    [1, 2, 3, 4].forEach(function (i) { take('b' + i, !!m['d' + i]); });
  }
  if (!Object.keys(q).length) fail_('Please pick at least one item.');
  return q;
}

function overLimit_(m, left, q) {
  function n(k) { return q[k] || 0; }
  function msg(l, word) { return l ? 'Sorry, only ' + plural_(l, word) + ' left.' : 'Sorry, ' + word + 's are sold out.'; }
  if (m.meal === 'Lunch') {
    if (left.meals !== null && n('m1') + n('m2') > left.meals) return msg(left.meals, 'meal');
    if (left.items !== null && n('i1') + n('i2') + n('i3') + n('i4') > left.items) return msg(left.items, 'single item');
    var rotis = (m.r2 ? n('m2') * int_(m.rotisPerMeal) : 0) + n('x');
    if (left.rotis !== null && rotis > left.rotis) return msg(left.rotis, 'roti');
  } else {
    for (var i = 1; i <= 4; i++) {
      var l = left.bowls[i - 1];
      if (l !== null && n('b' + i) > l) return l ? 'Sorry, only ' + l + ' ' + m['d' + i] + ' left.' : 'Sorry, ' + m['d' + i] + ' is sold out.';
    }
  }
  return '';
}

function bill_(m, q) {
  var lines = [], total = 0;
  function add(k, label, price) {
    if (!q[k]) return;
    lines.push(q[k] + ' × ' + label);
    total += q[k] * int_(price);
  }
  if (m.meal === 'Lunch') {
    add('m1', m.r2 ? 'Meal with ' + (m.r1 || 'rice') : 'Meal', m.mealPrice);
    add('m2', 'Meal with ' + m.r2, m.mealPrice);
    [1, 2, 3, 4].forEach(function (i) { add('i' + i, m['d' + i] + ' (single)', m.itemPrice); });
    add('x', (m.r2 || 'Roti') + ' (extra)', m.rotiPrice);
  } else {
    [1, 2, 3, 4].forEach(function (i) { add('b' + i, m['d' + i], m['p' + i]); });
  }
  return { items: lines.join(', '), total: total };
}

// Phone numbers match on their last 10 digits, so +91 and spaces don't matter.
function phoneKey_(v) { return str_(v).replace(/\D/g, '').slice(-10); }

// A customer's own order on a menu: same phone and flat, and not completed or cancelled. The newest wins.
function ownOrder_(m, b, orders) {
  var phone = phoneKey_(b.phone), flat = str_(b.flat);
  if (phone.length < 10 || !/^\d{4}$/.test(flat)) return null;
  return orders.filter(function (o) {
    return o.menuId === m.id && o.status === 'Pending' && phoneKey_(o.phone) === phone && o.flat === flat;
  }).sort(function (a, b) { return b.id - a.id; })[0] || null;
}

function openMenu_(id) {
  var m = findMenu_(id);
  if (!isOpen_(m)) fail_('Sorry, orders for this ' + m.meal.toLowerCase() + ' have closed.', 'closed');
  return m;
}

// Limits left for someone changing their order: what they already have doesn't count against them.
function leftWithout_(m, orders, own) {
  return stats_(m, orders.filter(function (o) { return o !== own; })).left;
}

function needOwnOrder_(m, b, orders) {
  var own = ownOrder_(m, b, orders);
  if (!own) fail_('We couldn’t find an order to change. It may already be completed or cancelled.', 'noorder');
  return own;
}

// Only the order itself goes back, never the name.
function findOrder_(b) {
  var m = openMenu_(b.menuId), orders = readOrders_(), own = ownOrder_(m, b, orders);
  if (!own) return { order: null };
  return { order: { id: own.id, qty: own.qty, notes: own.notes, total: own.total }, left: leftWithout_(m, orders, own) };
}

function updateOrder_(b) {
  var m = openMenu_(b.menuId), orders = readOrders_(), o = needOwnOrder_(m, b, orders);
  var name = str_(b.name).slice(0, 60);
  if (!name) fail_('Please add a name.');
  var q = cleanQty_(m, b.qty);
  var problem = overLimit_(m, leftWithout_(m, orders, o), q);
  if (problem) fail_(problem, 'limit');

  var bill = bill_(m, q);
  o.name = name; o.items = bill.items; o.total = bill.total; o.notes = str_(b.notes).slice(0, 200); o.qty = q;
  var sh = sheet_('Orders', ORDER_HEADERS);
  sh.getRange(o.row, 5, 1, 1).setValues([[text_(o.name)]]);
  sh.getRange(o.row, 8, 1, 2).setValues([[text_(o.items), o.total]]);
  sh.getRange(o.row, 13, 1, 1).setValues([[text_(o.notes)]]);
  sh.getRange(o.row, 15, 1, 1).setValues([[text_(JSON.stringify(q))]]);
  delete o.row;
  return o;
}

function cancelOrder_(b) {
  var m = openMenu_(b.menuId), o = needOwnOrder_(m, b, readOrders_());
  return { id: setOrderStatus_(o.id, 'Cancelled').id };
}

// Customers can only order while a menu is open. Orders you add yourself skip the order-by time but still respect the limits.
function placeOrder_(b, byAdmin) {
  var m = byAdmin ? findMenu_(b.menuId) : openMenu_(b.menuId);

  var name = str_(b.name).slice(0, 60), phone = str_(b.phone).slice(0, 20), flat = str_(b.flat), notes = str_(b.notes).slice(0, 200);
  if (!name) fail_('Please add a name.');
  if (!byAdmin) {
    if (phone.replace(/\D/g, '').length < 10) fail_('Please add a 10-digit phone number.');
    if (!flat) fail_('Please add your flat number.');
  }
  if (flat && !/^\d{4}$/.test(flat)) fail_('The flat number should be 4 digits.');

  var orders = readOrders_();
  if (!byAdmin && ownOrder_(m, b, orders)) fail_('You already have an order for this ' + m.meal.toLowerCase() + '.', 'exists');

  var q = cleanQty_(m, b.qty);
  var problem = overLimit_(m, stats_(m, orders).left, q);
  if (problem) fail_(problem, 'limit');

  var bill = bill_(m, q);
  var id = orders.reduce(function (max, o) { return Math.max(max, o.id); }, 0) + 1;
  var order = {
    id: id, placedAt: nowStr_(), date: m.date, meal: m.meal, name: name, phone: phone, flat: flat,
    items: bill.items, total: bill.total, status: 'Pending', completedAt: '', source: byAdmin ? 'Added by me' : 'Website',
    notes: notes, menuId: m.id, qty: q
  };
  writeRow_('Orders', ORDER_HEADERS, 0, [
    id, text_(order.placedAt), text_(order.date), text_(order.meal), text_(name), text_(phone), text_(flat),
    text_(order.items), order.total, text_(order.status), '', text_(order.source), text_(notes), text_(m.id), text_(JSON.stringify(q))
  ]);
  return order;
}

function setOrderStatus_(id, status) {
  if (STATUSES.indexOf(status) < 0) fail_('Unknown status.');
  var o = readOrders_().filter(function (x) { return x.id === int_(id); })[0];
  if (!o) fail_('Couldn’t find order #' + id + '.');
  if (status !== 'Cancelled' && o.status === 'Cancelled') {
    // Bringing a cancelled order back has to fit inside the limits again.
    var problem = overLimit_(findMenu_(o.menuId), stats_(findMenu_(o.menuId), readOrders_()).left, o.qty);
    if (problem) fail_(problem.replace('Sorry, only', 'Can’t bring this order back: only'), 'limit');
  }
  o.status = status;
  o.completedAt = status === 'Completed' ? nowStr_() : '';
  var sh = sheet_('Orders', ORDER_HEADERS);
  sh.getRange(o.row, 10, 1, 2).setValues([[text_(o.status), text_(o.completedAt)]]);
  delete o.row;
  return o;
}

function adminData_() {
  var orders = readOrders_();
  var menus = readMenus_().map(function (m) { return withStats_(m, orders); });
  menus.sort(function (a, b) { return a.id < b.id ? 1 : -1; });
  orders.forEach(function (o) { delete o.row; });
  orders.sort(function (a, b) { return b.id - a.id; });
  return { menus: menus, orders: orders, sheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl(), now: nowStr_() };
}
