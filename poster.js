// Draws the Crescent Home Kitchen poster (1080 x 1350) onto a canvas.
// Copied from Crescent Menu Maker.html so the admin page can make the same poster.
// State keys: heading, d1-d4, r1, r2, side, meal, item, roti, p1-p4, lOrder, lPick, dOrder, dPick, phone, flat, lScheme, dScheme.
(function () {
  var DEFAULTS = { heading: 'Tomorrow’s Lunch', lScheme: 'Tomato Red' };
  var SCHEMES = {
    'Sunny Turmeric': { bg:'#FFF4D6', text:'#3A2410', muted:'#6B4E2E', accent:'#B4441B', pillBg:'#3A2410', pillText:'#FFF4D6', cardBg:'#FFFFFF', cardText:'#3A2410', label:'#8A4A1A', sub:'#6B4E2E', divider:'#EBD9AE', border:'#E2C98A', moon:'#F2C77A' },
    'Leaf Green': { bg:'#1E3A2A', text:'#FBF6EA', muted:'#E4DCC8', accent:'#F2B632', pillBg:'#FBF6EA', pillText:'#1E3A2A', cardBg:'#FBF6EA', cardText:'#1E3A2A', label:'#6B5A2E', sub:'#4A4030', divider:'#D8CDB2', border:'#4F6E5B', moon:'#E4DCC8' },
    'Indigo Night': { bg:'#1C1F3B', text:'#F6F1E7', muted:'#D6D2E6', accent:'#F5B942', pillBg:'#F6F1E7', pillText:'#1C1F3B', cardBg:'#F6F1E7', cardText:'#1C1F3B', label:'#5A4A80', sub:'#45405E', divider:'#D9D3E6', border:'#474C7A', moon:'#D6D2E6' },
    'Tomato Red': { bg:'#A3321F', text:'#FFF5EA', muted:'#F6DCCB', accent:'#FFD166', pillBg:'#FFF5EA', pillText:'#A3321F', cardBg:'#FFF5EA', cardText:'#5A1A10', label:'#A3321F', sub:'#6B3A2E', divider:'#EED6C4', border:'#C9604C', moon:'#F6DCCB' }
  };
  var FR = "Fraunces, Georgia, 'Times New Roman', serif";
  var DM = "'DM Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
  var W = 1080, H = 1350;

  var canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  var ctx = canvas.getContext('2d');


  function font(weight, size, family, italic) { return (italic ? 'italic ' : '') + weight + ' ' + size + 'px ' + family; }
  function setLS(px) { if ('letterSpacing' in ctx) ctx.letterSpacing = px + 'px'; }
  function fit(text, weight, size, family, maxW, italic, min) {
    var sz = size; min = min || 18;
    ctx.font = font(weight, sz, family, italic);
    while (sz > min && ctx.measureText(text).width > maxW) { sz -= 2; ctx.font = font(weight, sz, family, italic); }
    return sz;
  }
  function text(str, x, y, o) {
    ctx.save();
    ctx.fillStyle = o.color; ctx.textAlign = o.align || 'left'; ctx.textBaseline = 'middle';
    setLS(o.ls || 0);
    var size = o.maxW ? fit(str, o.weight, o.size, o.family, o.maxW, o.italic, o.min) : o.size;
    ctx.font = font(o.weight, size, o.family, o.italic);
    ctx.fillText(str, x, y);
    ctx.restore();
  }
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function rupee(v) { v = (v || '').replace(/^₹\s*/, ''); return v ? '₹' + v : '₹'; }

  // City skyline doodle: solid buildings in front of a soft moon, 100 x 60 before scaling.
  function drawSkyline(c, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = c.moon; ctx.beginPath(); ctx.arc(70, 20, 16, 0, Math.PI * 2); ctx.fill();
    var pts = [[0,60],[0,34],[12,34],[12,22],[26,22],[26,10],[30,10],[30,4],[32,4],[32,10],[40,10],[40,28],[50,28],[50,16],[64,16],[64,36],[74,36],[74,26],[88,26],[88,40],[100,40],[100,60]];
    ctx.fillStyle = c.accent; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = c.bg;
    [[4,40],[4,50],[16,28],[16,38],[30,16],[30,26],[30,36],[30,46],[54,22],[54,32],[54,42],[78,32],[78,42],[92,46]].forEach(function (p) { ctx.fillRect(p[0], p[1], 4, 4); });
    ctx.restore();
  }

  function draw(st) {
    var c = SCHEMES[/Dinner/.test(st.heading || '') ? st.dScheme : st.lScheme] || SCHEMES[DEFAULTS.lScheme];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = c.bg; ctx.fillRect(0, 0, W, H);

    // Header: crescent, name, tags
    drawSkyline(c, 72, 60, 0.9);
    text('Crescent Home Kitchen', 182, 90, { weight: 700, size: 38, family: FR, color: c.text });
    ctx.font = font(700, 24, DM); setLS(0);
    var w2 = ctx.measureText('No Garlic').width + 44, x2 = 1008 - w2;
    var w1 = ctx.measureText('Pure Veg').width + 44, x1 = x2 - 12 - w1;
    rr(x1, 67, w1, 46, 23); ctx.fillStyle = c.pillBg; ctx.fill();
    text('Pure Veg', x1 + w1 / 2, 90, { weight: 700, size: 24, family: DM, color: c.pillText, align: 'center' });
    rr(x2 + 1.5, 68.5, w2 - 3, 43, 21.5); ctx.strokeStyle = c.text; ctx.lineWidth = 3; ctx.stroke();
    text('No Garlic', x2 + w2 / 2, 90, { weight: 700, size: 24, family: DM, color: c.text, align: 'center' });

    // Headline
    text(st.heading || DEFAULTS.heading, 72, 196, { weight: 800, size: 96, family: FR, color: c.accent, maxW: 936, min: 48 });

    // Menu card
    var isDinner = /Dinner/.test(st.heading || '');
    var cy = 268, ch = isDinner ? 554 : 428;
    rr(72, cy, 936, ch, 28); ctx.fillStyle = c.cardBg; ctx.fill();
    text(isDinner ? 'DINNER BOWL OPTIONS' : 'COMPLETE MEAL INCLUDES', 116, cy + 64, { weight: 700, size: 22, family: DM, color: c.label, ls: 3 });
    var avail;
    if (isDinner) {
      // Dinner: a borderless price list. Each bowl's name on the left, its own price on the right, soft dots between.
      var bowls = [1, 2, 3, 4].map(function (i) { return { name: st['d' + i], price: st['p' + i] }; })
        .filter(function (b) { return b.name; });
      if (!bowls.length) bowls = [1, 2, 3, 4].map(function () { return { name: '—', price: '' }; });
      var dishes = bowls.map(function (b) { return b.name; });
      var prices = bowls.map(function (b) { return b.price ? rupee(b.price) : '—'; });
      var pRight = 964, psz = 52, pw;
      text('PRICE', pRight, cy + 64, { weight: 700, size: 22, family: DM, color: c.label, ls: 3, align: 'right' });
      for (;;) {
        ctx.font = font(800, psz, FR); setLS(0);
        pw = Math.max.apply(null, prices.map(function (p) { return ctx.measureText(p).width; }));
        if (pw <= 190 || psz <= 32) break;
        psz -= 2;
      }
      avail = pRight - pw - 56 - 116;
      // Long names wrap onto two lines; all bowls share one size.
      function wrap2(str) {
        if (ctx.measureText(str).width <= avail) return [str];
        var words = str.split(' '), line = '', i = 0;
        while (i < words.length) {
          var t = line ? line + ' ' + words[i] : words[i];
          if (ctx.measureText(t).width > avail && line) break;
          line = t; i++;
        }
        return [line, words.slice(i).join(' ')];
      }
      var dsz = 36, lines;
      for (;;) {
        ctx.font = font(700, dsz, DM); setLS(0);
        lines = dishes.map(wrap2);
        var ok = lines.every(function (ls) { return ls.every(function (l) { return ctx.measureText(l).width <= avail; }); });
        if (ok || dsz <= 22) break;
        dsz -= 1;
      }
      // Rows are 110 apart and centred in the card, so fewer bowls still sit balanced.
      var step = 110, top = cy + 95 + (440 - bowls.length * step) / 2;
      bowls.forEach(function (b, i) {
        var y = top + step / 2 + i * step, ls = lines[i], half = dsz * 0.62;
        var lastY = ls.length === 1 ? y : y + half;
        if (ls.length === 1) text(ls[0], 116, y, { weight: 700, size: dsz, family: DM, color: c.cardText, maxW: avail, min: 18 });
        else {
          text(ls[0], 116, y - half, { weight: 700, size: dsz, family: DM, color: c.cardText, maxW: avail, min: 18 });
          text(ls[1], 116, y + half, { weight: 700, size: dsz, family: DM, color: c.cardText, maxW: avail, min: 18 });
        }
        ctx.font = font(700, dsz, DM); setLS(0);
        var dotsFrom = 116 + ctx.measureText(ls[ls.length - 1]).width + 18;
        ctx.font = font(800, psz, FR);
        var dotsTo = pRight - ctx.measureText(prices[i]).width - 18;
        ctx.save(); ctx.fillStyle = c.label; ctx.globalAlpha = 0.4;
        for (var x = dotsFrom; x <= dotsTo; x += 14) { ctx.beginPath(); ctx.arc(x, lastY + dsz * 0.3, 2.2, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
        // Nudge the larger price up so its baseline lines up with the dish name.
        text(prices[i], pRight, lastY - (psz - dsz) * 0.36, { weight: 800, size: psz, family: FR, color: c.cardText, align: 'right' });
      });
    } else {
    avail = 692 - 116;
    var left = [st.d1, st.d2, st.d3].map(function (d) { return d || '—'; });
    var d4 = st.d4 || '—';
    var r1 = st.r1 || '', r2 = st.r2 || '', side = st.side || '—';
    if (!r1 && r2) { r1 = r2; r2 = ''; }
    if (!r1) r1 = '—';
    var combo = r2 ? r1 + ' or ' + r2 : r1;
    var size = 36, gap = 48, wl, wr;
    for (;;) {
      ctx.font = font(700, size, DM); setLS(0);
      wl = Math.max.apply(null, left.map(function (d) { return ctx.measureText(d).width; }));
      wr = Math.max(ctx.measureText(d4).width, ctx.measureText(combo).width, ctx.measureText(side).width);
      if (wl + gap + wr <= avail || size <= 24) break;
      size -= 2;
    }
    var colR = 116 + wl + gap;
    var rows = [cy + 138, cy + 204, cy + 270];
    left.forEach(function (d, i) { text(d, 116, rows[i], { weight: 700, size: size, family: DM, color: c.cardText }); });
    text(d4, colR, rows[0], { weight: 700, size: size, family: DM, color: c.cardText });
    ctx.font = font(700, size, DM); setLS(0);
    if (r2) {
      var wA = ctx.measureText(r1 + ' ').width, wOr = ctx.measureText('or').width;
      text(r1 + ' ', colR, rows[1], { weight: 700, size: size, family: DM, color: c.cardText });
      text('or', colR + wA, rows[1], { weight: 700, size: size, family: DM, color: c.label });
      text(' ' + r2, colR + wA + wOr, rows[1], { weight: 700, size: size, family: DM, color: c.cardText });
    } else {
      text(r1, colR, rows[1], { weight: 700, size: size, family: DM, color: c.cardText });
    }
    text(side, colR, rows[2], { weight: 700, size: size, family: DM, color: c.cardText });
    if (r2) text('Choose either ' + r1.toLowerCase() + ' or ' + r2.toLowerCase() + ' with your meal', 116, cy + 358, { weight: 500, size: 26, family: FR, italic: true, color: c.sub, maxW: avail });
    ctx.fillStyle = c.divider; ctx.fillRect(728, cy + 40, 2, ch - 80);
    text(rupee(st.meal), 847, cy + ch / 2 - 10, { weight: 800, size: 92, family: FR, color: c.cardText, align: 'center', maxW: 220, min: 48 });
    text('single serving', 847, cy + ch / 2 + 60, { weight: 500, size: 24, family: DM, color: c.sub, align: 'center' });
    }

    // Single items
    var ey = 724, eh = 98;
    // Single item and roti prices are lunch only.
    if (!isDinner) [[72, 'Any single item', 'serves 2', st.item], [550, st.r2 || 'Roti', 'per piece', st.roti]].forEach(function (b) {
      rr(b[0] + 1, ey + 1, 456, eh - 2, 22); ctx.strokeStyle = c.border; ctx.lineWidth = 2; ctx.stroke();
      text(b[1], b[0] + 28, ey + 35, { weight: 700, size: 28, family: DM, color: c.text });
      text(b[2], b[0] + 28, ey + 68, { weight: 400, size: 22, family: DM, color: c.muted });
      text(rupee(b[3]), b[0] + 458 - 28, ey + eh / 2, { weight: 800, size: 52, family: FR, color: c.accent, align: 'right', maxW: 170, min: 30 });
    });

    // Timings card
    var ty = 850, th = 330;
    rr(73, ty + 1, 934, th - 2, 28); ctx.strokeStyle = c.border; ctx.lineWidth = 2; ctx.stroke();
    // Only this meal's order-by and pickup times, in the same two columns as the contact row below.
    var cA = 108, cD = 552, rEnd = 972;
    text('ORDER BY', cA, ty + 52, { weight: 700, size: 22, family: DM, color: c.accent, ls: 3 });
    text('PICKUP', cD, ty + 52, { weight: 700, size: 22, family: DM, color: c.accent, ls: 3 });
    text((isDinner ? st.dOrder : st.lOrder) || '—', cA, ty + 108, { weight: 700, size: 52, family: DM, color: c.text, maxW: cD - cA - 32, min: 28 });
    text((isDinner ? st.dPick : st.lPick) || '—', cD, ty + 108, { weight: 700, size: 52, family: DM, color: c.text, maxW: rEnd - cD, min: 28 });
    ctx.fillStyle = c.border; ctx.fillRect(cA, ty + 166, rEnd - cA, 2);
    text('Order on WhatsApp', cA, ty + 212, { weight: 400, size: 24, family: DM, color: c.muted });
    text('Collect from', cD, ty + 212, { weight: 400, size: 24, family: DM, color: c.muted });
    text(st.phone || '—', cA, ty + 266, { weight: 700, size: 44, family: FR, color: c.text, maxW: 420, min: 26 });
    text(st.flat || '—', cD, ty + 266, { weight: 700, size: 44, family: FR, color: c.text, maxW: 420, min: 26 });

    // Footer
    text('Simple, wholesome food — just like home.', 540, 1244, { weight: 500, size: 32, family: FR, italic: true, color: c.accent, align: 'center', maxW: 936 });
    text('Thank you for your support!', 540, 1284, { weight: 400, size: 24, family: DM, color: c.muted, align: 'center' });

  }

  var fontSpecs = ['800 96px Fraunces', '700 40px Fraunces', 'italic 500 26px Fraunces', '400 24px "DM Sans"', '500 24px "DM Sans"', '700 24px "DM Sans"'];
  window.CrescentPoster = {
    SCHEMES: SCHEMES,
    // Draws and returns the shared canvas.
    render: function (st) { draw(st); return canvas; },
    // Resolves once the poster fonts are loaded, so the first drawing isn't in fallback fonts.
    fontsReady: function () {
      if (!(document.fonts && document.fonts.load)) return Promise.resolve();
      return Promise.all(fontSpecs.map(function (f) { return document.fonts.load(f, 'A₹'); })).then(function () {}, function () {});
    }
  };
})();
