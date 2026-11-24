/* UPSC Desk - two-way syllabus mapping engine (v1)
 * Ported from site B (files.zip/engine.js) to the normalised syllabus.v1.json shape.
 * Behaviour is identical to the original (verified by engine.test.js, which runs a
 * differential test against the original on random tick sets).
 *
 * Inputs are MANUAL ticks only (no chaining: an auto-credited unit never credits anything else).
 *   deriveMains(index, tickedPrelimsSet)  -> { M###: {status:'DONE'|'PARTIAL', pct, causes:[P ids]} }
 *   deriveMains' mirror: derivePrelims(index, tickedMainsSet)
 * Rules:
 *   Edge code F = full coverage -> DONE.   S = substantial (60).   P = partial (30).
 *   T = thematic only: never credits.      J = joint: counts only via a joint group.
 *   Joint group: if EVERY Prelims id in a member set is ticked -> Mains unit DONE; otherwise the ticked fraction (capped at 90) is a partial %.
 *   Several partial signals combine as best + 10 per extra signal, capped at CAP (90). 100 is reserved for DONE.
 * UI contract (user's spec): a PARTIAL Mains unit draws a half-filled circle with the LEFT half shaded ("Prelims prep done");
 *   a PARTIAL Prelims unit draws the RIGHT half shaded ("Mains prep done"). Use partialSide(paper).
 */
(function (root) {
  var CAP = 90;
  function buildIndex(syl) {
    var byM = {}, byP = {}, groups = {};
    syl.edges.forEach(function (e) { (byM[e.m] = byM[e.m] || []).push(e); (byP[e.p] = byP[e.p] || []).push(e); });
    syl.groups.forEach(function (g) { (groups[g.m] = groups[g.m] || []).push(g.p); });
    return { byM: byM, byP: byP, groups: groups };
  }
  function deriveMains(ix, ticked) {
    var out = {};
    for (var m in ix.byM) {
      var t = ix.byM[m].filter(function (e) { return e.mp !== 'T' && ticked[e.p]; });
      if (!t.length) continue;
      var done = t.some(function (e) { return e.mp === 'F'; }), parts = [];
      (ix.groups[m] || []).forEach(function (mem) {
        var n = mem.filter(function (p) { return ticked[p]; }).length;
        if (n === mem.length) done = true;
        if (n) parts.push(Math.min(CAP, Math.round(100 * n / mem.length)));
      });
      t.forEach(function (e) { if (e.mp === 'S') parts.push(60); else if (e.mp === 'P') parts.push(30); });
      var causes = t.map(function (e) { return e.p; });
      if (done) { out[m] = { status: 'DONE', pct: 100, causes: causes }; continue; }
      if (!parts.length) continue;
      parts.sort(function (a, b) { return b - a; });
      out[m] = { status: 'PARTIAL', pct: Math.min(CAP, parts[0] + 10 * (parts.length - 1)), causes: causes };
    }
    return out;
  }
  function derivePrelims(ix, ticked) {
    var out = {};
    for (var p in ix.byP) {
      var t = ix.byP[p].filter(function (e) { return e.pm !== 'T' && ticked[e.m]; });
      if (!t.length) continue;
      var causes = t.map(function (e) { return e.m; });
      if (t.some(function (e) { return e.pm === 'F'; })) { out[p] = { status: 'DONE', pct: 100, causes: causes }; continue; }
      var parts = t.map(function (e) { return e.pm === 'S' ? 60 : e.pm === 'P' ? 30 : 0; }).filter(Boolean).sort(function (a, b) { return b - a; });
      if (!parts.length) continue;
      out[p] = { status: 'PARTIAL', pct: Math.min(CAP, parts[0] + 10 * (parts.length - 1)), causes: causes };
    }
    return out;
  }
  /* Convenience: from a progress map {unitId:{d:true,...}} derive both sides at once. */
  function deriveAll(ix, progress) {
    var m = {}, p = {};
    for (var id in progress) if (progress[id] && progress[id].d) (id[0] === 'P' ? p : m)[id] = 1;
    return { mains: deriveMains(ix, p), prelims: derivePrelims(ix, m) };
  }
  /* Visual state for one unit: 'MANUAL' (ticked by you) | 'AUTO' (credited free) | 'PARTIAL' | 'EMPTY' */
  function unitState(id, progress, derived) {
    if (progress[id] && progress[id].d) return { s: 'MANUAL' };
    var x = (id[0] === 'M' ? derived.mains : derived.prelims)[id];
    return x ? { s: x.status === 'DONE' ? 'AUTO' : 'PARTIAL', pct: x.pct, causes: x.causes } : { s: 'EMPTY' };
  }
  function partialSide(paper) { return paper === 'M' ? 'left' : 'right'; }
  var api = { CAP: CAP, buildIndex: buildIndex, deriveMains: deriveMains, derivePrelims: derivePrelims, deriveAll: deriveAll, unitState: unitState, partialSide: partialSide };
  root.MappingEngine = api; if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
