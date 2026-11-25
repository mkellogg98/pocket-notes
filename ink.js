/* Drawing on notes: one drawing layer per note, drawn straight onto the open canvas area to the
 * right of the note's typing column (never over the note text). Strokes are kept as points, not a
 * picture, so they stay sharp at any zoom, are small to save, and sync like the rest of the note.
 * Shared by the computer app and the phone app (web/ink.js is a copy).
 *
 * The layer is one item: { id, type: "drawing", x, y, w, h, strokes: [stroke] }
 *   x, y, w, h: the area the strokes cover (kept up to date), in canvas units.
 *   stroke: { c: "#rrggbb", s: pen size, h: 1 for highlighter, p: [x, y, f, x, y, f, ...] }
 *   points are in canvas units; f is pen pressure 0–100 (Apple Pencil or a pen; 50 for a mouse or finger).
 *
 * PNInk.LEFT              where the drawing area starts (canvas units), the same on every device
 * PNInk.paint(svg, item)  draws the layer into an <svg> laid over the canvas (canvas units)
 * PNInk.svg(item)         the layer as a standalone SVG (shared pages, phone previews)
 * PNInk.pad(el, o)        drawing with a mouse, finger, pen or Apple Pencil on el (see below)
 */
(function () {
  "use strict";
  var LEFT = 760;           // right of the note column (which ends at 728 at its widest)
  var HIGHLIGHT = 0.32;     // highlighter see-through-ness
  var NS = "http://www.w3.org/2000/svg";

  function width(s, f) { return s * (0.45 + 1.1 * f / 100); }   // press harder, draw thicker

  // A stroke as SVG path pieces: a pen line changes width with pressure, so it's drawn in short
  // runs, each with its own width; a highlighter is one even, see-through line.
  function pieces(st) {
    var p = st.p || [], out = [];
    if (p.length < 3) return out;
    if (p.length === 3) p = p.concat([p[0] + 0.001, p[1], p[2]]);
    if (st.h) {
      var d = "M" + p[0] + " " + p[1];
      for (var i = 3; i < p.length; i += 3) d += "L" + p[i] + " " + p[i + 1];
      out.push({ d: d, w: st.s, a: HIGHLIGHT });
      return out;
    }
    var RUN = 3;
    for (var j = 3; j < p.length; j += RUN * 3) {
      var dd = "M" + p[j - 3] + " " + p[j - 2], f = 0, n = 0;
      for (var k = j; k < Math.min(p.length, j + RUN * 3); k += 3) { dd += "L" + p[k] + " " + p[k + 1]; f += p[k + 2]; n++; }
      out.push({ d: dd, w: width(st.s, (f / n + p[j - 1]) / 2), a: 1 });
    }
    return out;
  }
  function strokeEl(st) {
    var g = document.createElementNS(NS, "g");
    g.setAttribute("stroke", st.c || "#1d2624");
    pieces(st).forEach(function (pc) {
      var path = document.createElementNS(NS, "path");
      path.setAttribute("d", pc.d);
      path.setAttribute("stroke-width", fmt(pc.w));
      if (pc.a < 1) path.setAttribute("stroke-opacity", pc.a);
      g.appendChild(path);
    });
    return g;
  }
  function paint(svg, item) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute("fill", "none"); svg.setAttribute("stroke-linecap", "round"); svg.setAttribute("stroke-linejoin", "round");
    ((item && item.strokes) || []).forEach(function (st) { svg.appendChild(strokeEl(st)); });
  }

  function fmt(w) { return String(+w.toPrecision(3)); }   // 3 figures: fine lines stay fine
  function esc(s) { return /^#[0-9a-fA-F]{6}$/.test(s || "") ? s : "#1d2624"; }
  function svg(item) {
    var parts = [];
    (item.strokes || []).forEach(function (st) {
      pieces(st).forEach(function (pc) {
        parts.push('<path d="' + pc.d + '" stroke="' + esc(st.c) + '" stroke-width="' + fmt(pc.w) + '"' + (pc.a < 1 ? ' stroke-opacity="' + pc.a + '"' : "") + "/>");
      });
    });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + [item.x, item.y, Math.max(1, item.w), Math.max(1, item.h)].join(" ") +
           '" fill="none" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%">' + parts.join("") + "</svg>";
  }

  // The area a set of strokes covers (with room for the pen width).
  function bounds(strokes) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    strokes.forEach(function (st) {
      var pad = st.s + 2;
      for (var i = 0; i < st.p.length; i += 3) {
        x0 = Math.min(x0, st.p[i] - pad); y0 = Math.min(y0, st.p[i + 1] - pad);
        x1 = Math.max(x1, st.p[i] + pad); y1 = Math.max(y1, st.p[i + 1] + pad);
      }
    });
    if (x0 === Infinity) return null;
    x0 = Math.floor(Math.max(0, x0)); y0 = Math.floor(Math.max(0, y0));
    return { x: x0, y: y0, w: Math.ceil(x1 - x0), h: Math.ceil(y1 - y0) };
  }

  /* Drawing on el (a see-through pad over the drawing area). o:
   *   point(e) -> {x, y} in canvas units      tool() -> {color, size, mode: "pen"|"highlighter"|"eraser"}
   *   strokes() -> the layer's strokes (array, may be empty)
   *   begin() before a change (undo), live(stroke) while drawing, end(changed) when the pen lifts
   *   erase(stroke) a stroke the eraser touched        fingerDraws() whether one finger draws
   *   pan(dx, dy) scroll the view (fingers, while a pencil is the pen)
   *   zoom() how far the view is zoomed in (pens keep their size on screen, so zoom in for detail)
   * With an Apple Pencil (or any pen), fingers and palms never draw: one finger scrolls. Without
   * one, one finger draws and two fingers scroll. */
  function pad(el, o) {
    var cur = null, erasing = false, changed = false, pid = null, penSeen = false;
    var touches = {}, panLast = null;
    function pressure(e) {
      if (e.pointerType === "pen") return Math.round(Math.max(0.05, e.pressure || 0.5) * 100);
      return 50;
    }
    function z() { var v = o.zoom ? o.zoom() : 1; return v > 0 ? v : 1; }
    function q(e) {   // finer points the further in you're zoomed
      var c = o.point(e), k = Math.pow(10, Math.max(1, Math.min(5, Math.ceil(Math.log(z()) / Math.LN10) + 1)));
      return [Math.round(c.x * k) / k, Math.round(c.y * k) / k, pressure(e)];
    }
    function sig(v) { return +v.toPrecision(4); }
    function inArea(pt) { return pt[0] >= LEFT; }
    function touchCount() { return Object.keys(touches).length; }
    // How far a point is from the line between two points.
    function segDist(px, py, ax, ay, bx, by) {
      var dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
      var t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
      var x = ax + t * dx - px, y = ay + t * dy - py;
      return Math.sqrt(x * x + y * y);
    }
    function eraseAt(pt) {
      o.strokes().slice().forEach(function (st) {
        var reach = 10 / z() + st.s / 2, p = st.p;
        for (var i = 0; i < p.length; i += 3) {
          var j = i + 3 < p.length ? i + 3 : i;   // each stretch of the line, not just its points
          if (segDist(pt[0], pt[1], p[i], p[i + 1], p[j], p[j + 1]) < reach) { o.erase(st); changed = true; return; }
        }
      });
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
    function down(e) {
      if (e.pointerType === "pen") penSeen = true;
      if (e.pointerType === "touch") {
        touches[e.pointerId] = { x: e.clientX, y: e.clientY };
        // Fingers scroll when a pencil is the pen, or when two fingers are down.
        if (penSeen || !o.fingerDraws() || touchCount() > 1) {
          if (cur && pid !== null && touchCount() > 1) { cur = null; pid = null; o.end(false); }
          panLast = { x: e.clientX, y: e.clientY };
          e.preventDefault();
          return;
        }
      } else if (e.pointerType === "mouse" && e.button !== 0) return;
      if (pid !== null) return;
      e.preventDefault(); e.stopPropagation();
      start(e);
    }
    function move(e) {
      if (e.pointerType === "touch" && touches[e.pointerId]) {
        touches[e.pointerId] = { x: e.clientX, y: e.clientY };
        if (panLast && e.pointerId !== pid) {
          o.pan(panLast.x - e.clientX, panLast.y - e.clientY);
          panLast = { x: e.clientX, y: e.clientY };
          e.preventDefault();
          return;
        }
      }
      if (e.pointerId !== pid) return;
      e.preventDefault();
      var evs = (e.getCoalescedEvents && e.getCoalescedEvents()) || [];   // every point a fast pencil sends
      if (!evs.length) evs = [e];
      evs.forEach(function (ev) {
        var pt = q(ev);
        if (erasing) { eraseAt(pt); return; }
        if (!cur) return;
        pt[0] = Math.max(LEFT, pt[0]);   // stays out of the note column
        var p = cur.p, n = p.length, dx = pt[0] - p[n - 3], dy = pt[1] - p[n - 2];
        if ((dx * dx + dy * dy) * z() * z() < 0.8) { p[n - 1] = Math.max(p[n - 1], pt[2]); return; }
        p.push(pt[0], pt[1], pt[2]);
      });
      if (cur) o.live(cur);
    }
    function up(e) {
      if (touches[e.pointerId]) { delete touches[e.pointerId]; if (!touchCount()) panLast = null; else { var k = Object.keys(touches)[0]; panLast = { x: touches[k].x, y: touches[k].y }; } }
      if (e.pointerId !== pid) return;
      pid = null;
      var did = erasing ? changed : !!cur;
      var stroke = cur;
      cur = null; erasing = false;
      o.end(did, stroke);
    }
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return {
      penSeen: function () { return penSeen; },
      stop: function () {
        el.removeEventListener("pointerdown", down); el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up);
      }
    };
  }

  // The pens offered in the drawing toolbars.
  var COLORS = [["#1d2624", "Black"], ["#d64545", "Red"], ["#2b6fd6", "Blue"], ["#2f9e5b", "Green"], ["#e07b39", "Orange"],
                ["#8a5cc7", "Purple"], ["#f2c230", "Yellow"], ["#ffffff", "White"]];
  var SIZES = [[2, "Fine"], [4, "Medium"], [8, "Thick"], [14, "Marker"]];

  window.PNInk = { LEFT: LEFT, paint: paint, svg: svg, pad: pad, bounds: bounds, strokeEl: strokeEl, COLORS: COLORS, SIZES: SIZES };
})();
