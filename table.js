/* Tables in notes: building them and changing them. Shared by the computer app and the phone app
 * (web/table.js is a copy). Plain HTML tables, so they save, sync, share and export like the rest:
 *   cells can span (colspan / rowspan, from merging), carry a shade (background-color), hide any
 *   of their four lines (border-top-style: none, ...), and set a column width (width: NNpx).
 *
 * Every change takes the cell you're in (and for some, the cells you've selected) and returns the
 * cell to put the caret in afterwards (or null when the table is gone).
 */
(function () {
  "use strict";
  var MAX = 60;   // rows or columns a table can have

  function span(cell, a) { var n = parseInt(cell.getAttribute(a), 10); return n > 1 ? Math.min(n, MAX) : 1; }
  function setSpan(cell, a, n) { if (n > 1) cell.setAttribute(a, n); else cell.removeAttribute(a); }
  function rowsOf(table) {
    var out = [];
    Array.prototype.forEach.call(table.children, function (sec) {
      if (sec.tagName === "TR") out.push(sec);
      else if (/^(THEAD|TBODY|TFOOT)$/.test(sec.tagName)) Array.prototype.forEach.call(sec.children, function (tr) { if (tr.tagName === "TR") out.push(tr); });
    });
    return out;
  }
  function cellsOf(tr) { return Array.prototype.filter.call(tr.children, function (c) { return c.tagName === "TD" || c.tagName === "TH"; }); }
  function blank(tag) { var c = document.createElement(tag || "td"); c.innerHTML = "<br>"; return c; }

  // The table as a grid: g[r][c] is the cell covering that square (a merged cell covers several).
  function grid(table) {
    var rows = rowsOf(table), g = [], start = new Map(), w = 0;
    rows.forEach(function (tr, r) {
      g[r] = g[r] || [];
      var c = 0;
      cellsOf(tr).forEach(function (cell) {
        while (g[r][c]) c++;
        var cs = span(cell, "colspan"), rs = Math.min(span(cell, "rowspan"), rows.length - r);
        start.set(cell, { r: r, c: c });
        for (var dr = 0; dr < rs; dr++) { g[r + dr] = g[r + dr] || []; for (var dc = 0; dc < cs; dc++) g[r + dr][c + dc] = cell; }
        c += cs;
      });
    });
    g.forEach(function (row) { w = Math.max(w, row.length); });
    return {
      table: table, rows: rows, g: g, w: w, h: rows.length,
      at: function (r, c) { return (g[r] && g[r][c]) || null; },
      pos: function (cell) { return start.get(cell); },
      area: function (cell) { var p = start.get(cell); return { r: p.r, c: p.c, r2: p.r + Math.min(span(cell, "rowspan"), rows.length - p.r) - 1, c2: p.c + span(cell, "colspan") - 1 }; }
    };
  }
  // Where a new cell for column c goes in row r: before the first cell that starts to its right.
  function insertAt(G, r, c, cell) {
    var tr = G.rows[r], before = null;
    cellsOf(tr).some(function (x) { if (G.pos(x).c >= c) { before = x; return true; } return false; });
    tr.insertBefore(cell, before);
  }
  function headRow(tr) { return tr.parentNode && tr.parentNode.tagName === "THEAD"; }

  // ---------- making one ----------
  function html(rows, cols, header) {
    rows = Math.max(1, Math.min(MAX, rows | 0)); cols = Math.max(1, Math.min(MAX, cols | 0));
    function row(tag) { var s = "<tr>"; for (var c = 0; c < cols; c++) s += "<" + tag + "><br></" + tag + ">"; return s + "</tr>"; }
    var body = ""; for (var r = header ? 1 : 0; r < rows; r++) body += row("td");
    return "<table>" + (header ? "<thead>" + row("th") + "</thead>" : "") + (body ? "<tbody>" + body + "</tbody>" : "") + "</table>";
  }

  // ---------- rows and columns ----------
  function addRow(cell, below) {
    var table = cell.closest("table"), G = grid(table), a = G.area(cell), at = below ? a.r2 + 1 : a.r;
    var ref = G.rows[Math.min(at, G.h - 1)], intoHead = at < G.h && headRow(G.rows[at]);   // joins the header only when it goes above a header row
    var tr = document.createElement("tr"), done = new Set(), first = null;
    for (var c = 0; c < G.w; c++) {
      var up = G.at(at - 1, c), down = G.at(at, c);
      if (up && up === down) {   // a merged cell runs across: it just gets taller
        if (!done.has(up)) { done.add(up); setSpan(up, "rowspan", span(up, "rowspan") + 1); }
        continue;
      }
      var n = blank(intoHead ? "th" : "td"); tr.appendChild(n);
      if (c >= a.c && !first) first = n;
    }
    if (at < G.h) ref.parentNode.insertBefore(tr, ref);
    else {
      var last = G.rows[G.h - 1], parent = last.parentNode;
      if (parent.tagName === "THEAD") { parent = table.querySelector("tbody") || table.appendChild(document.createElement("tbody")); parent.appendChild(tr); }
      else parent.appendChild(tr);
    }
    return first || tr.firstChild || cell;
  }
  function addCol(cell, right) {
    var table = cell.closest("table"), G = grid(table), a = G.area(cell), at = right ? a.c2 + 1 : a.c, done = new Set(), first = null;
    if (G.w >= MAX) return cell;
    for (var r = 0; r < G.h; r++) {
      var left = G.at(r, at - 1), here = G.at(r, at);
      if (left && left === here) { if (!done.has(left)) { done.add(left); setSpan(left, "colspan", span(left, "colspan") + 1); } continue; }
      var n = blank(headRow(G.rows[r]) || (here || left || {}).tagName === "TH" ? "th" : "td");
      insertAt(G, r, at, n);
      if (r === a.r) first = n;
    }
    return first || cell;
  }
  function delRow(cell) {
    var table = cell.closest("table"), G = grid(table), a = G.area(cell), next = null;
    for (var r = a.r2; r >= a.r; r--) {
      var tr = G.rows[r], seen = new Set();
      for (var c = 0; c < G.w; c++) {
        var x = G.at(r, c);
        if (!x || seen.has(x)) continue;
        seen.add(x);
        var p = G.pos(x), rs = span(x, "rowspan");
        if (p.r < r) setSpan(x, "rowspan", rs - 1);                 // from a row above: one shorter
        else if (rs > 1 && G.rows[r + 1]) {                       // starts here and runs on: move it down
          setSpan(x, "rowspan", rs - 1);
          insertAt(G, r + 1, p.c, x);
        }
      }
      tr.remove();
      G = grid(table);
    }
    if (!G.h) { table.remove(); return null; }
    var row = G.rows[Math.min(a.r, G.h - 1)];
    next = G.at(G.rows.indexOf(row), Math.min(a.c, G.w - 1));
    tidy(table);
    return next;
  }
  function delCol(cell) {
    var table = cell.closest("table"), G = grid(table), a = G.area(cell);
    for (var c = a.c2; c >= a.c; c--) {
      var seen = new Set();
      for (var r = 0; r < G.h; r++) {
        var x = G.at(r, c);
        if (!x || seen.has(x)) continue;
        seen.add(x);
        if (span(x, "colspan") > 1) setSpan(x, "colspan", span(x, "colspan") - 1); else x.remove();
      }
      G = grid(table);
    }
    tidy(table);
    G = grid(table);
    if (!G.w) { table.remove(); return null; }
    return G.at(Math.min(a.r, G.h - 1), Math.min(a.c, G.w - 1));
  }
  // Empty rows go; an empty table goes.
  function tidy(table) {
    rowsOf(table).forEach(function (tr) { if (!cellsOf(tr).length) {
      // a row only covered by cells from above: shorten those instead of keeping an empty row
      tr.remove();
    } });
    Array.prototype.forEach.call(table.querySelectorAll("thead, tbody"), function (s) { if (!s.querySelector("tr")) s.remove(); });
    if (!table.querySelector("td, th")) table.remove();
    else fixSpans(table);
  }
  function fixSpans(table) {   // spans that reach past the table's end are trimmed
    var G = grid(table);
    G.rows.forEach(function (tr, r) { cellsOf(tr).forEach(function (x) { if (span(x, "rowspan") > G.h - r) setSpan(x, "rowspan", G.h - r); }); });
  }

  // ---------- cells ----------
  // The rectangle a set of cells covers, grown until no merged cell sticks out of it.
  function rect(G, cells) {
    var R = null;
    cells.forEach(function (x) { var a = G.area(x); R = R ? { r: Math.min(R.r, a.r), c: Math.min(R.c, a.c), r2: Math.max(R.r2, a.r2), c2: Math.max(R.c2, a.c2) } : a; });
    for (var grown = true; grown;) {
      grown = false;
      for (var r = R.r; r <= R.r2; r++) for (var c = R.c; c <= R.c2; c++) {
        var x = G.at(r, c); if (!x) continue;
        var a = G.area(x);
        if (a.r < R.r || a.c < R.c || a.r2 > R.r2 || a.c2 > R.c2) {
          R = { r: Math.min(R.r, a.r), c: Math.min(R.c, a.c), r2: Math.max(R.r2, a.r2), c2: Math.max(R.c2, a.c2) }; grown = true;
        }
      }
    }
    return R;
  }
  function cellsIn(G, R) {
    var out = [];
    for (var r = R.r; r <= R.r2; r++) for (var c = R.c; c <= R.c2; c++) { var x = G.at(r, c); if (x && out.indexOf(x) < 0) out.push(x); }
    return out;
  }
  // The cells between two cells (for selecting a block of cells).
  function between(a, b) {
    var table = a.closest("table"); if (!table || b.closest("table") !== table) return [a];
    var G = grid(table); return cellsIn(G, rect(G, [a, b]));
  }
  function isEmpty(x) { return !x.textContent.trim() && !x.querySelector("img"); }
  function merge(cells) {
    if (!cells.length) return null;
    var table = cells[0].closest("table"), G = grid(table), R = rect(G, cells), all = cellsIn(G, R);
    var keep = G.at(R.r, R.c);
    if (all.length < 2) return keep;
    all.forEach(function (x) {
      if (x === keep || isEmpty(x)) { if (x !== keep) x.remove(); return; }
      if (isEmpty(keep)) keep.innerHTML = ""; else keep.appendChild(document.createElement("br"));
      while (x.firstChild) keep.appendChild(x.firstChild);
      x.remove();
    });
    setSpan(keep, "colspan", R.c2 - R.c + 1); setSpan(keep, "rowspan", R.r2 - R.r + 1);
    fixSpans(table);
    return keep;
  }
  function mergeWith(cell, dir) {   // "right" or "down"
    var G = grid(cell.closest("table")), a = G.area(cell);
    var other = dir === "right" ? G.at(a.r, a.c2 + 1) : G.at(a.r2 + 1, a.c);
    return other ? merge([cell, other]) : cell;
  }
  function canMerge(cell, dir) {
    var G = grid(cell.closest("table")), a = G.area(cell);
    return !!(dir === "right" ? G.at(a.r, a.c2 + 1) : G.at(a.r2 + 1, a.c));
  }
  function split(cell) {
    var table = cell.closest("table"), G = grid(table), a = G.area(cell);
    if (a.r === a.r2 && a.c === a.c2) return cell;
    setSpan(cell, "colspan", 1); setSpan(cell, "rowspan", 1);
    for (var r = a.r; r <= a.r2; r++) {
      for (var c = a.c2; c >= a.c; c--) {
        if (r === a.r && c === a.c) continue;
        var n = blank(cell.tagName.toLowerCase());
        if (r === a.r) cell.parentNode.insertBefore(n, cell.nextSibling);
        else insertAt(G, r, c, n);
      }
    }
    return cell;
  }
  function isMerged(cell) { return span(cell, "colspan") > 1 || span(cell, "rowspan") > 1; }
  function delCell(cell) {   // the cells to its right move over
    var tr = cell.parentNode, table = cell.closest("table"), next = cell.nextElementSibling || cell.previousElementSibling;
    cell.remove();
    tidy(table);
    return table.isConnected && next && next.isConnected ? next : null;
  }
  function insCell(cell) {   // a new cell here; this one and the rest move right
    var n = blank(cell.tagName.toLowerCase()); cell.parentNode.insertBefore(n, cell); return n;
  }
  function clear(cells) { cells.forEach(function (x) { x.innerHTML = "<br>"; }); return cells[0]; }
  function shade(cells, color) { cells.forEach(function (x) { x.style.backgroundColor = color || ""; if (!x.getAttribute("style")) x.removeAttribute("style"); }); return cells[0]; }

  // ---------- lines ----------
  var SIDES = { top: "borderTopStyle", right: "borderRightStyle", bottom: "borderBottomStyle", left: "borderLeftStyle" };
  function setLine(x, side, on) { x.style[SIDES[side]] = on ? "" : "none"; if (!x.getAttribute("style")) x.removeAttribute("style"); }
  // Whole table: "all", "none", "outside" (just the frame), "inside" (no frame), "rows" (just the lines between rows)
  function lines(table, mode) {
    var G = grid(table);
    cellsIn(G, { r: 0, c: 0, r2: G.h - 1, c2: G.w - 1 }).forEach(function (x) {
      var a = G.area(x), edge = { top: a.r === 0, bottom: a.r2 === G.h - 1, left: a.c === 0, right: a.c2 >= G.w - 1 };
      Object.keys(SIDES).forEach(function (s) {
        var on = mode === "all" ? true : mode === "none" ? false : mode === "outside" ? edge[s] : mode === "inside" ? !edge[s] :
                 mode === "rows" ? (s === "top" || s === "bottom") : true;
        setLine(x, s, on);
      });
    });
    return null;
  }
  // One side of the selected cells (a line between two cells is shared, so both cells change).
  function side(cells, which, on) {
    var table = cells[0].closest("table"), G = grid(table), R = rect(G, cells);
    var opposite = { top: "bottom", bottom: "top", left: "right", right: "left" }[which];
    var r0 = which === "top" ? R.r : which === "bottom" ? R.r2 : null, c0 = which === "left" ? R.c : which === "right" ? R.c2 : null;
    for (var r = R.r; r <= R.r2; r++) for (var c = R.c; c <= R.c2; c++) {
      if ((r0 !== null && r !== r0) || (c0 !== null && c !== c0)) continue;
      var x = G.at(r, c); if (x) setLine(x, which, on);
      var nr = which === "top" ? r - 1 : which === "bottom" ? r + 1 : r, nc = which === "left" ? c - 1 : which === "right" ? c + 1 : c;
      var y = G.at(nr, nc); if (y && y !== x) setLine(y, opposite, on);
    }
    return cells[0];
  }
  function inner(cells, on) {   // the lines inside the selected block
    var table = cells[0].closest("table"), G = grid(table), R = rect(G, cells);
    cellsIn(G, R).forEach(function (x) {
      var a = G.area(x);
      if (a.r > R.r) setLine(x, "top", on);
      if (a.r2 < R.r2) setLine(x, "bottom", on);
      if (a.c > R.c) setLine(x, "left", on);
      if (a.c2 < R.c2) setLine(x, "right", on);
    });
    return cells[0];
  }
  function lineOn(cell, which) { return cell.style[SIDES[which]] !== "none"; }

  // ---------- header row and column widths ----------
  function retag(x, tag) {
    var n = document.createElement(tag);
    Array.prototype.forEach.call(x.attributes, function (a) { n.setAttribute(a.name, a.value); });
    while (x.firstChild) n.appendChild(x.firstChild);
    x.parentNode.replaceChild(n, x);
    return n;
  }
  function hasHeader(table) { return !!table.querySelector("thead tr"); }
  function header(table, on) {
    var rows = rowsOf(table);
    if (!rows.length) return null;
    if (on && !hasHeader(table)) {
      var head = document.createElement("thead"), first = rows[0];
      table.insertBefore(head, table.firstChild);
      head.appendChild(first);
      cellsOf(first).forEach(function (x) { if (x.tagName === "TD") retag(x, "th"); });
      if (!table.querySelector("tbody") && rows.length > 1) { /* rows already in a tbody */ }
    } else if (!on && hasHeader(table)) {
      var thead = table.querySelector("thead"), tbody = table.querySelector("tbody") || table.appendChild(document.createElement("tbody"));
      Array.prototype.slice.call(thead.querySelectorAll("tr")).reverse().forEach(function (tr) {
        cellsOf(tr).forEach(function (x) { if (x.tagName === "TH") retag(x, "td"); });
        tbody.insertBefore(tr, tbody.firstChild);
      });
      thead.remove();
    }
    return table.querySelector("td, th");
  }
  // Column c's width (px), or "" for automatic.
  function colWidth(table, c, px) {
    var G = grid(table);
    for (var r = 0; r < G.h; r++) {
      var x = G.at(r, c);
      if (!x || G.area(x).c !== c || span(x, "colspan") > 1) continue;
      x.style.width = px ? Math.round(Math.max(24, Math.min(2000, px))) + "px" : "";
      if (!x.getAttribute("style")) x.removeAttribute("style");
    }
  }
  function evenWidths(table) {
    Array.prototype.forEach.call(table.querySelectorAll("td, th"), function (x) { x.style.width = ""; if (!x.getAttribute("style")) x.removeAttribute("style"); });
  }

  // Which column edge (for resizing) a point is on: { c, left (px of that column's left edge) } or null.
  function edgeAt(table, clientX, clientY, slop) {
    var G = grid(table), best = null;
    G.rows.forEach(function (tr, r) {
      cellsOf(tr).forEach(function (x) {
        var b = x.getBoundingClientRect();
        if (clientY < b.top || clientY > b.bottom) return;
        if (Math.abs(clientX - b.right) <= slop) best = { c: G.area(x).c2, cell: x, left: b.left };
      });
    });
    return best;
  }

  // Keep only what tables need on cells: spans (1–60) and the cell styles listed here.
  var CELL_STYLE = /^(width|border-(top|right|bottom|left)-style)$/;
  function cleanCellAttrs(src, dst) {
    ["colspan", "rowspan"].forEach(function (a) { var n = parseInt(src.getAttribute(a), 10); if (n > 1 && n <= MAX) dst.setAttribute(a, n); });
  }
  function cleanCellStyle(src) {
    var out = [];
    var w = src.style.width; if (/^\d{1,4}(\.\d+)?px$/.test(w)) out.push("width: " + w);
    ["top", "right", "bottom", "left"].forEach(function (s) { if (src.style.getPropertyValue("border-" + s + "-style") === "none") out.push("border-" + s + "-style: none"); });
    return out;
  }

  window.PNTable = {
    MAX: MAX, html: html, grid: grid, between: between,
    addRow: addRow, addCol: addCol, delRow: delRow, delCol: delCol,
    merge: merge, mergeWith: mergeWith, canMerge: canMerge, split: split, isMerged: isMerged,
    delCell: delCell, insCell: insCell, clear: clear, shade: shade,
    lines: lines, side: side, inner: inner, lineOn: lineOn,
    header: header, hasHeader: hasHeader, colWidth: colWidth, evenWidths: evenWidths, edgeAt: edgeAt,
    cleanCellAttrs: cleanCellAttrs, cleanCellStyle: cleanCellStyle
  };
})();
