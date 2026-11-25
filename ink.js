/* Drawing on notes: one drawing layer per note, drawn on the open canvas area to the right of the
 * note's typing column (never over the note text). Strokes are kept as points, not a picture, so
 * they stay sharp at any zoom, are small to save, and sync like the rest of the note.
 * Shared by the computer app and the phone app (web/ink.js is a copy).
 *
 * The layer is one item: { id, type: "drawing", x, y, w, h, strokes: [stroke] }
 *   x, y, w, h: the area the strokes cover (kept up to date), in canvas units.
 *   stroke: { c: "#rrggbb", s: pen size, h: 1 for highlighter, p: [x, y, f, x, y, f, ...] }
 *   points are in canvas units; f is pen pressure 0–100 (Apple Pencil or a pen; 50 for a mouse or finger).
 *   Zoomed far in, points and sizes get very small (pens keep their size on screen), so detail
 *   can be added at any depth.
 *
 * PNInk.LEFT              where the drawing area starts (canvas units), the same on every device
 * PNInk.view(host, o)     a screen-sized layer over the note that draws the strokes, sharp at any
 *                         zoom (redrawn for the current view, never scaled up)
 * PNInk.svg(item)         the layer as a standalone SVG (exports, shared pages, phone previews)
 * PNInk.pad(el, o)        drawing with a mouse, finger, pen or Apple Pencil on el (see below)
 */
(function () {
  "use strict";
  var LEFT = 760;           // right of the note column (which ends at 728 at its widest)
  var HIGHLIGHT = 0.32;     // highlighter see-through-ness
  var AUTO = "#1d2624";     // "black": drawn in the theme's text color (light on a dark page)

  function width(s, f) { return s * (0.45 + 1.1 * f / 100); }   // press harder, draw thicker
  function eraserRadius(size) { return 4 + size * 1.5; }        // on screen, px

  // A stroke as runs of points, each with its own width: a pen line changes width with pressure,
  // so it's drawn in short runs; a highlighter is one even, see-through line.
  function runs(st) {
    var p = st.p || [], out = [];
    if (p.length < 3) return out;
    if (p.length === 3) p = p.concat([p[0] + Math.max(1e-12, st.s * 0.01), p[1], p[2]]);   // a dot
    if (st.h) { out.push({ p: p, w: st.s, a: HIGHLIGHT }); return out; }
    var RUN = 3;
    for (var j = 3; j < p.length; j += RUN * 3) {
      var end = Math.min(p.length, j + RUN * 3), f = 0, n = 0;
      for (var k = j; k < end; k += 3) { f += p[k + 2]; n++; }
      out.push({ p: p.slice(j - 3, end), w: width(st.s, (f / n + p[j - 1]) / 2), a: 1 });
    }
    return out;
  }
  function fmt(w) { return String(+w.toPrecision(4)); }
  function esc(s) { return /^#[0-9a-fA-F]{6}$/.test(s || "") ? s : AUTO; }
  function pathD(p) {
    var d = "M" + p[0] + " " + p[1];
    for (var i = 3; i < p.length; i += 3) d += "L" + p[i] + " " + p[i + 1];
    return d;
  }
  function svg(item) {
    var parts = [];
    (item.strokes || []).forEach(function (st) {
      runs(st).forEach(function (r) {
        parts.push('<path d="' + pathD(r.p) + '" stroke="' + esc(st.c) + '" stroke-width="' + fmt(r.w) + '"' + (r.a < 1 ? ' stroke-opacity="' + r.a + '"' : "") + "/>");
      });
    });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + [item.x, item.y, Math.max(1e-9, item.w), Math.max(1e-9, item.h)].join(" ") +
           '" fill="none" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%">' + parts.join("") + "</svg>";
  }

  // The area one stroke, or a set of strokes, covers (with room for the pen width).
  var boxes = typeof WeakMap === "function" ? new WeakMap() : null;
  function strokeBox(st) {
    var b = boxes && boxes.get(st);
    if (b && b.n === st.p.length) return b;
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, pad = st.s * 1.6;
    for (var i = 0; i < st.p.length; i += 3) {
      if (st.p[i] < x0) x0 = st.p[i];
      if (st.p[i] > x1) x1 = st.p[i];
      if (st.p[i + 1] < y0) y0 = st.p[i + 1];
      if (st.p[i + 1] > y1) y1 = st.p[i + 1];
    }
    b = { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad, n: st.p.length };
    if (boxes) boxes.set(st, b);
    return b;
  }
  function bounds(strokes) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    strokes.forEach(function (st) {
      if (!st.p.length) return;
      var b = strokeBox(st);
      x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0); x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1);
    });
    if (x0 === Infinity) return null;
    x0 = Math.max(0, x0); y0 = Math.max(0, y0);
    return { x: x0, y: y0, w: Math.max(1e-9, x1 - x0), h: Math.max(1e-9, y1 - y0) };
  }

  /* ---------- The layer on screen ----------
   * host: where the layer goes (the positioned parent of the scrolling note).
   * o.over()      the scrolling element the layer sits over (it's sized to its visible area)
   * o.cam()       {x, y, z}: the canvas point at the top-left of the view, and the zoom
   * o.strokes()   the strokes to show
   * Returns { draw(), live(stroke), shade(on), cursor(pt or null, radius px), el (the pad element) }. */
  function view(host, o) {
    var wrap = document.createElement("div"), cnv = document.createElement("canvas"), padEl = document.createElement("div");
    var noteLbl = document.createElement("span"), edgeLbl = document.createElement("span");
    wrap.className = "ink-view"; cnv.className = "ink-canvas"; padEl.className = "ink-pad"; padEl.hidden = true;
    noteLbl.className = "ink-note-label"; edgeLbl.className = "ink-edge-label";
    noteLbl.textContent = o.noteLabel || "Your note"; edgeLbl.textContent = o.edgeLabel || "✎ Drawing area →";
    noteLbl.hidden = edgeLbl.hidden = true;
    wrap.style.cssText = "position:absolute;pointer-events:none;overflow:hidden";
    cnv.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%";
    padEl.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:auto;touch-action:none";
    wrap.append(cnv, noteLbl, edgeLbl, padEl);
    host.appendChild(wrap);
    var ctx = cnv.getContext("2d"), queued = false, live = null, shading = false, cursor = null, curR = 0, pattern = null, patternFor = "";

    function place() {
      var s = o.over(), parent = wrap.offsetParent || host;
      if (!s || s.hidden || !s.offsetParent) { wrap.style.display = "none"; return null; }
      wrap.style.display = "";
      var a = s.getBoundingClientRect(), b = parent.getBoundingClientRect();
      var L = a.left - b.left + s.clientLeft - parent.clientLeft, T = a.top - b.top + s.clientTop - parent.clientTop;
      var W = s.clientWidth, H = s.clientHeight, dpr = Math.min(3, window.devicePixelRatio || 1);
      wrap.style.left = L + "px"; wrap.style.top = T + "px"; wrap.style.width = W + "px"; wrap.style.height = H + "px";
      if (cnv.width !== Math.round(W * dpr) || cnv.height !== Math.round(H * dpr)) { cnv.width = Math.round(W * dpr); cnv.height = Math.round(H * dpr); }
      return { w: W, h: H, dpr: dpr };
    }
    function stripes(color) {
      if (pattern && patternFor === color) return pattern;
      var c = document.createElement("canvas"); c.width = c.height = 20;
      var g = c.getContext("2d"); g.strokeStyle = color; g.lineWidth = 7;
      g.beginPath(); g.moveTo(-5, 25); g.lineTo(25, -5); g.moveTo(-5, 5); g.lineTo(5, -5); g.moveTo(15, 25); g.lineTo(25, 15); g.stroke();
      pattern = ctx.createPattern(c, "repeat"); patternFor = color;
      return pattern;
    }
    // A line clipped to the screen (with a margin), so far-off points never upset the drawing.
    function clip(ax, ay, bx, by, x0, y0, x1, y1) {
      var t0 = 0, t1 = 1, dx = bx - ax, dy = by - ay;
      var pq = [[-dx, ax - x0], [dx, x1 - ax], [-dy, ay - y0], [dy, y1 - ay]];
      for (var i = 0; i < 4; i++) {
        var pp = pq[i][0], qq = pq[i][1];
        if (pp === 0) { if (qq < 0) return null; continue; }
        var r = qq / pp;
        if (pp < 0) { if (r > t1) return null; if (r > t0) t0 = r; }
        else { if (r < t0) return null; if (r < t1) t1 = r; }
      }
      return [ax + t0 * dx, ay + t0 * dy, ax + t1 * dx, ay + t1 * dy];
    }
    function drawStroke(st, cam, W, H, ink) {
      var b = strokeBox(st), vx1 = cam.x + W / cam.z, vy1 = cam.y + H / cam.z;
      if (b.x1 < cam.x || b.y1 < cam.y || b.x0 > vx1 || b.y0 > vy1) return;   // off screen
      ctx.strokeStyle = (st.c || AUTO) === AUTO ? ink : st.c;
      var M = 200;
      runs(st).forEach(function (r) {
        var lw = r.w * cam.z;
        ctx.lineWidth = Math.max(0.35, lw); ctx.globalAlpha = r.a * (lw < 0.35 ? Math.max(0.15, lw / 0.35) : 1);
        ctx.beginPath();
        var p = r.p, lx = null, ly = null;
        for (var i = 3; i < p.length; i += 3) {
          var ax = (p[i - 3] - cam.x) * cam.z, ay = (p[i - 2] - cam.y) * cam.z, bx = (p[i] - cam.x) * cam.z, by = (p[i + 1] - cam.y) * cam.z;
          var c = clip(ax, ay, bx, by, -M - lw, -M - lw, W + M + lw, H + M + lw);
          if (!c) continue;
          if (lx === null || Math.abs(c[0] - lx) > 1e-6 || Math.abs(c[1] - ly) > 1e-6) ctx.moveTo(c[0], c[1]);
          ctx.lineTo(c[2], c[3]); lx = c[2]; ly = c[3];
        }
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
    }
    function now() {
      queued = false;
      var g = place();
      if (!g) return;
      var cam = o.cam(), css = getComputedStyle(host);
      var ink = (css.getPropertyValue("--ink") || "").trim() || AUTO;
      ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
      ctx.clearRect(0, 0, g.w, g.h);
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      var edge = (LEFT - cam.x) * cam.z;
      if (shading && edge > 0) {   // the note column, shaded, and the line where drawing starts
        ctx.fillStyle = stripes("rgba(127,127,127,.13)");
        ctx.fillRect(0, 0, Math.min(edge, g.w), g.h);
      }
      (o.strokes() || []).forEach(function (st) { drawStroke(st, cam, g.w, g.h, ink); });
      if (live) drawStroke(live, cam, g.w, g.h, ink);
      if (shading && edge >= -2 && edge <= g.w + 2) {
        ctx.strokeStyle = (css.getPropertyValue("--accent") || "").trim() || "#2b6fd6";
        ctx.lineWidth = 2; ctx.setLineDash([7, 6]); ctx.beginPath(); ctx.moveTo(edge, 0); ctx.lineTo(edge, g.h); ctx.stroke(); ctx.setLineDash([]);
      }
      noteLbl.hidden = !shading || edge < 170;
      edgeLbl.hidden = !shading || edge < -2 || edge > g.w - 60;
      if (!edgeLbl.hidden) edgeLbl.style.left = Math.max(8, edge + 8) + "px";
      if (cursor) {   // the eraser's reach
        var cx = (cursor.x - cam.x) * cam.z, cy = (cursor.y - cam.y) * cam.z;
        ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(127,127,127,.9)"; ctx.fillStyle = "rgba(127,127,127,.12)";
        ctx.beginPath(); ctx.arc(cx, cy, curR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.lineWidth = 1; ctx.strokeStyle = "rgba(255,255,255,.8)";
        ctx.beginPath(); ctx.arc(cx, cy, curR + 1.5, 0, Math.PI * 2); ctx.stroke();
      }
    }
    function draw() { if (!queued) { queued = true; requestAnimationFrame(now); } }
    if (window.ResizeObserver) new ResizeObserver(draw).observe(o.over());
    window.addEventListener("resize", draw);
    return {
      el: padEl, draw: draw, now: now,
      live: function (st) { live = st; draw(); },
      shade: function (on) { shading = !!on; padEl.hidden = !on; draw(); },
      cursor: function (pt, r) { cursor = pt; curR = r || 0; draw(); }
    };
  }

  /* ---------- Erasing ----------
   * Cuts away just the part of each line inside the eraser's circle (center c, radius r, canvas
   * units); a line cut in the middle becomes two. Returns [stroke, [pieces]] for each line it changed. */
  function eraseCircle(strokes, c, r) {
    var out = [];
    strokes.forEach(function (st) {
      var b = strokeBox(st);
      if (b.x1 < c.x - r || b.x0 > c.x + r || b.y1 < c.y - r || b.y0 > c.y + r) return;
      var p = st.p, pieces = [], cur = null, changed = false;
      function half(f) { return (st.h ? st.s : width(st.s, f)) / 2; }
      function inside(x, y, f) { var R = r + half(f), dx = x - c.x, dy = y - c.y; return dx * dx + dy * dy < R * R; }
      if (p.length === 3) { if (inside(p[0], p[1], p[2])) out.push([st, []]); return; }
      if (!inside(p[0], p[1], p[2])) cur = [p[0], p[1], p[2]]; else changed = true;
      for (var i = 3; i < p.length; i += 3) {
        var ax = p[i - 3], ay = p[i - 2], af = p[i - 1], bx = p[i], by = p[i + 1], bf = p[i + 2];
        var R = r + half((af + bf) / 2), dx = bx - ax, dy = by - ay, fx = ax - c.x, fy = ay - c.y;
        var A = dx * dx + dy * dy, B = 2 * (dx * fx + dy * fy), C = fx * fx + fy * fy - R * R;
        var u0 = 2, u1 = -1;
        if (A > 0) {
          var disc = B * B - 4 * A * C;
          if (disc > 0) { var sq = Math.sqrt(disc); u0 = Math.max(0, (-B - sq) / (2 * A)); u1 = Math.min(1, (-B + sq) / (2 * A)); }
        } else if (C < 0) { u0 = 0; u1 = 1; }
        if (u0 > u1) {   // this stretch doesn't touch the circle
          if (!cur) cur = [ax, ay, af];
          cur.push(bx, by, bf);
          continue;
        }
        changed = true;
        if (u0 > 0 && cur) cur.push(ax + dx * u0, ay + dy * u0, af + (bf - af) * u0);
        if (cur && cur.length >= 6) pieces.push(cur);
        cur = null;
        if (u1 < 1) cur = [ax + dx * u1, ay + dy * u1, af + (bf - af) * u1, bx, by, bf];
      }
      if (cur && cur.length >= 6) pieces.push(cur);
      if (!changed) return;
      out.push([st, pieces.map(function (pp) { var n = { c: st.c, s: st.s, p: pp }; if (st.h) n.h = 1; return n; })]);
    });
    return out;
  }

  /* ---------- Drawing on el ----------
   *   point(e) -> {x, y} in canvas units      tool() -> {color, size, mode: "pen"|"highlighter"|"eraser"}
   *   strokes() -> the layer's strokes (array, may be empty)
   *   begin() before a change (undo), live(stroke) while drawing, end(changed, stroke) when the pen lifts
   *   replace(stroke, pieces) the eraser cut a line (pieces may be empty)
   *   cursor(pt or null, radius px) where the eraser is
   *   fingerDraws() whether one finger draws
   *   pan(dx, dy) scroll the view; zoomAt(factor, clientX, clientY) pinch zoom
   *   zoom() how far the view is zoomed in (pens keep their size on screen, so zoom in for detail)
   * With an Apple Pencil (or any pen), fingers and palms never draw: one finger scrolls. Without
   * one, one finger draws. Two fingers always scroll and pinch to zoom. */
  function pad(el, o) {
    var cur = null, erasing = false, changed = false, pid = null, penSeen = false;
    var touches = {}, pinch = null;
    function z() { var v = o.zoom ? o.zoom() : 1; return v > 0 ? v : 1; }
    function pressure(e) {
      if (e.pointerType === "pen") return Math.round(Math.max(0.05, e.pressure || 0.5) * 100);
      return 50;
    }
    function q(e) {   // finer points the further in you're zoomed
      var c = o.point(e), k = Math.pow(10, Math.max(1, Math.min(13, Math.ceil(Math.log(z()) / Math.LN10) + 2)));
      return [Math.round(c.x * k) / k, Math.round(c.y * k) / k, pressure(e)];
    }
    function sig(v) { return +v.toPrecision(4); }
    function inArea(pt) { return pt[0] >= LEFT; }
    function ids() { return Object.keys(touches); }
    function eraserR() { return eraserRadius(o.tool().size); }
    function eraseAt(pt) {
      var hits = eraseCircle(o.strokes(), { x: pt[0], y: pt[1] }, eraserR() / z());
      hits.forEach(function (h) { o.replace(h[0], h[1]); changed = true; });
    }
    function showCursor(e) {
      if (!o.cursor) return;
      if (o.tool().mode !== "eraser" || (e.pointerType === "touch" && penSeen)) { o.cursor(null); return; }
      var c = o.point(e);
      o.cursor({ x: c.x, y: c.y }, eraserR());
    }
    function start(e) {
      var t = o.tool(), pt = q(e);
      if (!inArea(pt) && t.mode !== "eraser") return false;
      pid = e.pointerId; changed = false;
      try { el.setPointerCapture(e.pointerId); } catch (x) {}
      o.begin();
      if (t.mode === "eraser") { erasing = true; eraseAt(pt); return true; }
      cur = { c: t.color, s: sig((t.mode === "highlighter" ? Math.max(10, t.size * 3) : t.size) / z()), p: pt };
      if (t.mode === "highlighter") cur.h = 1;
      o.live(cur);
      return true;
    }
    function cancelStroke() {
      if (pid === null) return;
      pid = null;
      var did = erasing && changed;
      cur = null; erasing = false;
      o.end(did, null);
    }
    function pinchState() {
      var k = ids(); if (k.length < 2) return null;
      var a = touches[k[0]], b = touches[k[1]];
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) };
    }
    function down(e) {
      if (e.pointerType === "pen") penSeen = true;
      if (e.pointerType === "touch") {
        touches[e.pointerId] = { x: e.clientX, y: e.clientY };
        e.preventDefault();
        if (ids().length > 1) {   // two fingers: scroll and zoom (a finger stroke just started is dropped)
          if (pid !== null && touches[pid]) cancelStroke();
          pinch = pinchState();
          return;
        }
        if (penSeen || !o.fingerDraws()) { pinch = { x: e.clientX, y: e.clientY, d: 0 }; return; }   // one finger scrolls
      } else if (e.pointerType === "mouse" && e.button !== 0) return;
      if (pid !== null) return;
      e.preventDefault(); e.stopPropagation();
      start(e);
      showCursor(e);
    }
    function move(e) {
      if (e.pointerType === "touch" && touches[e.pointerId]) {
        touches[e.pointerId] = { x: e.clientX, y: e.clientY };
        if (pinch && e.pointerId !== pid) {
          e.preventDefault();
          var now = ids().length > 1 ? pinchState() : { x: e.clientX, y: e.clientY, d: 0 };
          o.pan(pinch.x - now.x, pinch.y - now.y);
          if (now.d && pinch.d && o.zoomAt) o.zoomAt(now.d / pinch.d, now.x, now.y);
          pinch = now;
          return;
        }
      }
      if (e.pointerId !== pid) { if (e.pointerType !== "touch") showCursor(e); return; }
      e.preventDefault();
      var evs = (e.getCoalescedEvents && e.getCoalescedEvents()) || [];   // every point a fast pencil sends
      if (!evs.length) evs = [e];
      var zz = z();
      evs.forEach(function (ev) {
        var pt = q(ev);
        if (erasing) { eraseAt(pt); return; }
        if (!cur) return;
        pt[0] = Math.max(LEFT, pt[0]);   // stays out of the note column
        var p = cur.p, n = p.length, dx = pt[0] - p[n - 3], dy = pt[1] - p[n - 2];
        if ((dx * dx + dy * dy) * zz * zz < 0.8) { p[n - 1] = Math.max(p[n - 1], pt[2]); return; }
        p.push(pt[0], pt[1], pt[2]);
      });
      if (cur) o.live(cur);
      showCursor(e);
    }
    function up(e) {
      if (touches[e.pointerId]) {
        var wasPinch = !!pinch;
        delete touches[e.pointerId];
        var k = ids();
        pinch = k.length > 1 ? pinchState() : k.length === 1 && (wasPinch || penSeen || !o.fingerDraws()) ? { x: touches[k[0]].x, y: touches[k[0]].y, d: 0 } : null;
      }
      if (e.pointerId !== pid) return;
      pid = null;
      var did = erasing ? changed : !!cur;
      var stroke = cur;
      cur = null; erasing = false;
      o.end(did, stroke);
      if (e.pointerType !== "mouse" && o.cursor) o.cursor(null);
    }
    function leave() { if (pid === null && o.cursor) o.cursor(null); }
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("pointerleave", leave);
    return {
      penSeen: function () { return penSeen; },
      stop: function () {
        el.removeEventListener("pointerdown", down); el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); el.removeEventListener("pointerleave", leave);
        if (o.cursor) o.cursor(null);
      }
    };
  }

  // Zoom shown as text: 5% … 900%, then 12×, 3.4K×, 1.2M×, 56B× …
  function zoomLabel(z) {
    if (z < 10) return Math.round(z * 100).toLocaleString() + "%";
    var units = [[1e9, "B"], [1e6, "M"], [1e3, "K"]];
    for (var i = 0; i < units.length; i++) if (z >= units[i][0]) return +(z / units[i][0]).toPrecision(2) + units[i][1] + "×";
    return Math.round(z) + "×";
  }

  // The pens offered in the drawing toolbars.
  var COLORS = [["#1d2624", "Black"], ["#d64545", "Red"], ["#2b6fd6", "Blue"], ["#2f9e5b", "Green"], ["#e07b39", "Orange"],
                ["#8a5cc7", "Purple"], ["#f2c230", "Yellow"], ["#ffffff", "White"]];
  var SIZES = [[2, "Fine"], [4, "Medium"], [8, "Thick"], [14, "Marker"]];

  window.PNInk = { LEFT: LEFT, AUTO: AUTO, view: view, svg: svg, pad: pad, bounds: bounds, eraseCircle: eraseCircle,
                   zoomLabel: zoomLabel, eraserRadius: eraserRadius, COLORS: COLORS, SIZES: SIZES,
                   ZOOM_MIN: 0.05, ZOOM_MAX: 1e11 };
})();
