/* License Lens — matching + consolidation engine + UI
 * Plain browser JS. No build step, no fetch, no modules. */
(function () {
  "use strict";

  var D = window.LL;
  var CAP_BY_ID = index(D.CAPABILITIES);
  var PATH_BY_ID = index(D.PATHS);
  var LIC_BY_ID = index(D.LICENSES);
  var CLAR_BY_ID = index(D.CLARIFIERS);
  var CAT_BY_ID = index(D.CATEGORIES);

  var app = document.getElementById("app");

  // ---- persistent state ----
  var state = load();
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem("licenselens") || "{}");
      return { basket: Array.isArray(s.basket) ? s.basket : [], answers: s.answers && typeof s.answers === "object" ? s.answers : {} };
    } catch (e) { return { basket: [], answers: {} }; }
  }
  function save() {
    try { localStorage.setItem("licenselens", JSON.stringify(state)); } catch (e) {}
  }

  // ---- helpers ----
  function index(arr) { var m = {}; arr.forEach(function (x) { m[x.id] = x; }); return m; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function catColor(catId) { var c = CAT_BY_ID[catId]; return c ? "var(" + c.colorVar + ")" : "var(--accent)"; }
  function uniq(a) { return a.filter(function (v, i) { return a.indexOf(v) === i; }); }

  // ---- engine ----
  // A path is viable if none of its conditions is contradicted by a given answer.
  function pathViable(p, answers) {
    return p.conditions.every(function (c) {
      var a = answers[c.clarifier];
      return !a || c.in.indexOf(a) !== -1;
    });
  }
  // A path is "locked in" if every condition is satisfied by an actual answer.
  function pathLocked(p, answers) {
    return p.conditions.every(function (c) {
      var a = answers[c.clarifier];
      return a && c.in.indexOf(a) !== -1;
    });
  }
  function viablePaths(cap, answers) {
    return cap.paths.map(function (id) { return PATH_BY_ID[id]; })
      .filter(function (p) { return p && pathViable(p, answers); });
  }

  // Which clarifiers still matter for the current basket?
  function openClarifiers() {
    var wanted = [];
    state.basket.forEach(function (capId) {
      var cap = CAP_BY_ID[capId]; if (!cap) return;
      var paths = viablePaths(cap, state.answers);
      // only ask if more than one path is still in play and a clarifier would separate them
      if (paths.length < 2) return;
      paths.forEach(function (p) {
        p.conditions.forEach(function (c) {
          if (!state.answers[c.clarifier] && wanted.indexOf(c.clarifier) === -1) wanted.push(c.clarifier);
        });
      });
    });
    return wanted.map(function (id) { return CLAR_BY_ID[id]; }).filter(Boolean);
  }

  function rankSum(licIds) {
    return licIds.reduce(function (t, id) { var l = LIC_BY_ID[id]; return t + (l ? l.rank : 20); }, 0);
  }
  // transitive closure of a set of licence ids over their `includes`
  function expand(ids) {
    var out = {}; var stack = ids.slice();
    while (stack.length) {
      var id = stack.pop();
      if (out[id]) continue;
      out[id] = true;
      var l = LIC_BY_ID[id];
      (l && l.includes || []).forEach(function (x) { if (!out[x]) stack.push(x); });
    }
    return out;
  }

  // Greedy consolidation: cover every basket capability with the smallest sensible licence set.
  function recommend() {
    var caps = state.basket.map(function (id) { return CAP_BY_ID[id]; }).filter(Boolean);
    var entries = caps.map(function (cap) { return { cap: cap, paths: viablePaths(cap, state.answers) }; });
    var unresolved = entries.filter(function (e) { return e.paths.length === 0; });
    var solvable = entries.filter(function (e) { return e.paths.length > 0; });

    // an already-owned base licence seeds the chosen set (and everything it includes)
    var baseAns = state.answers["base-license"];
    var baseId = baseAns && baseAns !== "none" && LIC_BY_ID[baseAns] ? baseAns : null;

    var chosen = [];
    var chosenSet = baseId ? expand([baseId]) : {};
    function has(id) { return !!chosenSet[id]; }
    function covered(entry) {
      return entry.paths.some(function (p) { return p.licenses.every(has); });
    }

    var guard = 0;
    while (solvable.some(function (e) { return !covered(e); }) && guard++ < 50) {
      var best = null;
      solvable.forEach(function (e) {
        if (covered(e)) return;
        e.paths.forEach(function (p) {
          var add = p.licenses.filter(function (id) { return !has(id); });
          // how many other still-uncovered caps would this same add-set also satisfy?
          var alsoCovers = solvable.filter(function (e2) {
            if (covered(e2)) return false;
            return e2.paths.some(function (p2) {
              return p2.licenses.every(function (id) { return has(id) || add.indexOf(id) !== -1; });
            });
          }).length;
          var score = [
            alsoCovers,                 // maximise shared coverage
            p.preferred ? 1 : 0,        // prefer flagged paths
            -add.length,                // fewer new licences
            -rankSum(add)               // lower breadth/cost
          ];
          if (!best || cmp(score, best.score) > 0) best = { add: add, score: score };
        });
      });
      if (!best || best.add.length === 0) break;
      best.add.forEach(function (id) {
        if (chosen.indexOf(id) === -1) chosen.push(id);
        var ex = expand([id]);
        Object.keys(ex).forEach(function (k) { chosenSet[k] = true; });
      });
    }

    // Choose the best explaining path per capability within the greedy set, preferring
    // a `preferred` path over a degraded one, then rebuild the licence set from the picks.
    function rebuild(ids) {
      var s = baseId ? expand([baseId]) : {};
      ids.forEach(function (id) { var e = expand([id]); Object.keys(e).forEach(function (k) { s[k] = true; }); });
      return s;
    }
    var picks = [];
    solvable.forEach(function (e) {
      var opts = e.paths.filter(function (p) { return p.licenses.every(has); });
      opts.sort(function (a, b) {
        return (pathLocked(b, state.answers) - pathLocked(a, state.answers))
          || ((b.preferred ? 1 : 0) - (a.preferred ? 1 : 0))
          || (a.licenses.length - b.licenses.length)
          || (rankSum(a.licenses) - rankSum(b.licenses));
      });
      if (opts[0]) picks.push({ e: e, pick: opts[0] });
    });
    // needed licences = union of the picks' licences, minus what the owned base already grants
    chosen = [];
    picks.forEach(function (pp) {
      pp.pick.licenses.forEach(function (l) {
        if (baseId && expand([baseId])[l]) return;
        if (chosen.indexOf(l) === -1) chosen.push(l);
      });
    });
    // dedupe: if one needed licence's expansion already grants another, keep the broader one
    chosen = chosen.filter(function (id) {
      return !chosen.some(function (other) {
        return other !== id && expand([other])[id] && !expand([id])[other];
      });
    });
    chosenSet = rebuild(chosen);

    // display order: the owned base first (if it does any covering), then added licences
    var display = (baseId ? [baseId] : []).concat(chosen);

    // attribute each pick's capability to the displayed licences it relies on
    var coverage = {}; // licId -> [{cap, path}]
    display.forEach(function (id) { coverage[id] = []; });
    picks.forEach(function (pp) {
      var e = pp.e, pick = pp.pick;
      // attribute the capability to every displayed licence the pick actually relies on
      // (so a multi-licence path shows the requirement under each of its licences).
      // when the owned base already grants a pick licence, attribute there instead of to an added one.
      var anchors = pick.licenses.map(function (l) {
        if (baseId && expand([baseId])[l]) return baseId;
        var owner = display.filter(function (d) { return d !== baseId && expand([d])[l]; })
          .sort(function (a, b) { return rankSum([b]) - rankSum([a]); })[0];
        return owner || l;
      });
      uniq(anchors).forEach(function (aId) {
        (coverage[aId] = coverage[aId] || []).push({ cap: e.cap, path: pick, viaBase: aId === baseId });
      });
      e.alts = e.paths.filter(function (p) {
        return p !== pick && sig(p.licenses) !== sig(pick.licenses);
      });
      e.pick = pick;
    });

    // keep every added licence; drop only an owned-base card that covers nothing
    display = display.filter(function (id) { return id !== baseId || (coverage[id] || []).length > 0; });

    return { chosen: chosen, baseId: baseId, display: display, coverage: coverage, solvable: solvable, unresolved: unresolved };
  }
  function sig(ids) { return ids.slice().sort().join("+"); }
  function cmp(a, b) { for (var i = 0; i < a.length; i++) { if (a[i] !== b[i]) return a[i] - b[i]; } return 0; }

  // ---- search ----
  function scoreCap(cap, q) {
    var terms = q.split(/\s+/).filter(Boolean);
    var kw = cap.keywords.map(function (k) { return k.toLowerCase(); });
    var title = cap.title.toLowerCase();
    var hay = (cap.title + " " + cap.description + " " + cap.keywords.join(" ")).toLowerCase();
    var score = 0;
    if (kw.indexOf(q) !== -1) score += 30;                 // exact keyword match
    else if (kw.some(function (k) { return k.indexOf(q) !== -1 || q.indexOf(k) !== -1; })) score += 12;
    if (title.indexOf(q) !== -1) score += 10;              // whole query appears in title
    terms.forEach(function (t) {
      if (title.indexOf(t) !== -1) score += 4;
      if (kw.some(function (k) { return k.indexOf(t) !== -1; })) score += 3;
      if (hay.indexOf(t) !== -1) score += 1;
    });
    return score;
  }
  function searchCaps(query) {
    var q = (query || "").toLowerCase().trim();
    if (!q) return [];
    return D.CAPABILITIES.map(function (cap) { return { cap: cap, score: scoreCap(cap, q) }; })
      .filter(function (r) { return r.score > 0; })
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, 8)
      .map(function (r) { return r.cap; });
  }

  // ---- rendering ----
  function h(html) { return html; }
  function topBar() {
    return '<div class="top"><button class="brand" onclick="LLnav(\'home\')"><span class="dot"></span>License Lens</button>' +
      '<span class="tagline">Microsoft licensing, explained</span></div>';
  }
  function disclaimer() {
    return '<div class="disclaimer"><strong>Not affiliated with Microsoft.</strong> ' +
      'License Lens is an independent tool. Every recommendation links to an official Microsoft page, but licensing terms change often and depend on your agreement type, region and negotiated terms. ' +
      'This is guidance for planning, not licensing advice or a contractual position — confirm against the ' +
      '<a href="' + esc(D.META.productTerms) + '" target="_blank" rel="noopener">Microsoft Product Terms</a> and your licensing specialist before you buy. ' +
      'Knowledge base last updated ' + esc(D.META.updated) + '.</div>';
  }
  function footer() {
    return '<div class="footer">Sources: <a href="' + esc(D.META.licensingHome) + '" target="_blank" rel="noopener">microsoft.com/licensing</a> and learn.microsoft.com. ' +
      'Open source (GPL v3) &middot; <a href="https://github.com/VivianVoss/license-lens" target="_blank" rel="noopener">GitHub</a></div>';
  }

  function renderHome() {
    var catCards = D.CATEGORIES.map(function (c) {
      var n = D.CAPABILITIES.filter(function (x) { return x.category === c.id; }).length;
      return '<button class="catCard" style="--cat-color:var(' + c.colorVar + ')" onclick="LLnav(\'cat:' + c.id + '\')">' +
        '<div class="name">' + esc(c.name) + '</div><div class="count">' + n + ' scenario' + (n === 1 ? "" : "s") + '</div></button>';
    }).join("");

    app.innerHTML =
      topBar() +
      '<div class="hero"><h1>What do you need it to do?</h1>' +
      '<p>Describe the functionality you need covered. License Lens maps it to the minimum Microsoft licence set, explains why each one is needed, and asks a question or two when there is more than one way to get there.</p>' +
      '<div class="searchWrap">' +
      '<div class="searchRow"><input id="q" type="text" autocomplete="off" placeholder="e.g. block staff emailing sensitive files externally" ' +
      'oninput="LLsuggest(this.value)" onkeydown="LLkey(event)"><button class="btn-primary" onclick="LLgo()">Search</button></div>' +
      '<div id="sugg"></div>' +
      '<div class="hint">Or browse by area below. Add several scenarios to one basket and License Lens will consolidate the licences.</div>' +
      '</div></div>' +
      (state.basket.length ? basketBar() + chipRow() : "") +
      '<div class="sectionLabel">Browse by area</div><div class="catGrid">' + catCards + '</div>' +
      disclaimer() + footer();
    var q = document.getElementById("q"); if (q) q.focus();
  }

  function basketBar(onResult) {
    return '<div class="basketBar"><span class="count">' + state.basket.length +
      ' scenario' + (state.basket.length === 1 ? "" : "s") + ' in basket</span>' +
      '<span class="spacer"></span>' +
      '<button class="btn-ghost" onclick="LLclear()">Clear</button>' +
      (onResult
        ? '<button class="btn-ghost" onclick="LLnav(\'home\')">+ Add scenario</button>'
        : '<button class="btn-primary" onclick="LLnav(\'result\')">See licences &rarr;</button>') +
      '</div>';
  }
  function chipRow() {
    return '<div class="chips">' + state.basket.map(function (id) {
      var cap = CAP_BY_ID[id]; if (!cap) return "";
      return '<span class="chip" style="--cat-color:' + catColor(cap.category) + '"><span class="catDot"></span>' +
        esc(cap.title) + '<span class="x" onclick="LLremove(\'' + id + '\')" title="Remove">&times;</span></span>';
    }).join("") + '</div>';
  }

  function renderCategory(catId) {
    var cat = CAT_BY_ID[catId];
    if (!cat) return renderHome();
    var caps = D.CAPABILITIES.filter(function (x) { return x.category === catId; });
    app.innerHTML =
      topBar() +
      (state.basket.length ? basketBar() + chipRow() : "") +
      '<button class="btn-ghost" style="margin:14px 0" onclick="LLnav(\'home\')">&larr; Back</button>' +
      '<div class="sectionLabel" style="--cat-color:var(' + cat.colorVar + ')">' + esc(cat.name) + '</div>' +
      caps.map(function (cap) { return capCard(cap); }).join("") +
      disclaimer() + footer();
  }

  function capCard(cap, pick) {
    var inBasket = state.basket.indexOf(cap.id) !== -1;
    return '<div class="card" style="--cat-color:' + catColor(cap.category) + '">' +
      '<h3>' + esc(cap.title) + '</h3>' +
      '<div class="sub">' + esc(cap.description) + '</div>' +
      (inBasket
        ? '<button class="btn-ghost" onclick="LLremove(\'' + cap.id + '\')">In basket &check; — remove</button>'
        : '<button class="btn-primary" onclick="' + (pick ? 'LLpick' : 'LLadd') + '(\'' + cap.id + '\')">' +
          (pick ? 'This one &rarr;' : 'Add to basket') + '</button>') +
      '</div>';
  }

  function renderResult() {
    if (!state.basket.length) return renderHome();
    var clar = openClarifiers();
    var rec = recommend();

    var clarHtml = clar.length ? '<div class="card"><h3>A few questions to narrow this down</h3>' +
      '<div class="sub">Answer what you can — anything you skip is treated as "not sure" and License Lens will show the options.</div>' +
      clar.map(function (c) {
        return '<div class="clarifier"><div class="qtext">' + esc(c.question) + '</div><div class="optRow">' +
          c.options.map(function (o) {
            var sel = state.answers[c.id] === o.id;
            return '<button class="optBtn' + (sel ? " selected" : "") + '" onclick="LLanswer(\'' + c.id + '\',\'' + o.id + '\')">' + esc(o.label) + '</button>';
          }).join("") +
          (state.answers[c.id] ? ' <button class="optBtn" onclick="LLanswer(\'' + c.id + '\',\'\')">clear</button>' : "") +
          '</div></div>';
      }).join("") + '</div>' : "";

    var rationaleShown = {}; // path.id -> true, so a multi-licence path explains itself once
    var licHtml = rec.display.map(function (licId) {
      var lic = LIC_BY_ID[licId];
      var covers = (rec.coverage[licId] || []);
      if (!lic) return "";
      var isBase = licId === rec.baseId;
      var allSources = uniq(covers.reduce(function (a, c) { return a.concat(c.path.sources); }, []));
      return '<div class="card licCard"' + (isBase ? ' style="border-left-color:var(--text-dim)"' : "") + '>' +
        '<div class="licName">' + esc(lic.name) + '<span class="licType">' + (isBase ? "already owned" : esc(lic.type)) + '</span></div>' +
        '<div class="licNote">' + esc(lic.note) + '</div>' +
        (lic.prerequisites && lic.prerequisites.length
          ? '<div class="prereq">Prerequisite: ' + lic.prerequisites.map(esc).join("; ") + '</div>' : "") +
        (covers.length ? '<ul class="covers">' + covers.map(function (c) {
          var showWhy = !rationaleShown[c.path.id];
          rationaleShown[c.path.id] = true;
          return '<li><div class="cvTitle">' + (showWhy ? "" : "Required for: ") + esc(c.cap.title) + '</div>' +
            (showWhy ? '<div class="cvWhy">' + esc(c.path.rationale) + '</div>' +
              (c.path.note ? '<div class="cvWhy"><em>' + esc(c.path.note) + '</em></div>' : "") : "") + '</li>';
        }).join("") + '</ul>' : "") +
        '<div class="srcRow"><a href="' + esc(lic.source) + '" target="_blank" rel="noopener">Licence overview &nearr;</a>' +
        allSources.map(function (s) { return '<a href="' + esc(s) + '" target="_blank" rel="noopener">Source &nearr;</a>'; }).join("") +
        '</div></div>';
    }).join("");

    // alternatives
    var altItems = rec.solvable.filter(function (e) { return e.alts && e.alts.length; }).map(function (e) {
      return '<div class="altItem"><div><strong>' + esc(e.cap.title) + '</strong></div>' +
        e.alts.map(function (p) {
          return '<div style="margin-top:6px"><span class="altLic">' + p.licenses.map(function (id) { return esc((LIC_BY_ID[id] || {}).name || id); }).join(" + ") + '</span> — ' + esc(p.rationale) +
            ' <a href="' + esc(p.sources[0]) + '" target="_blank" rel="noopener">source &nearr;</a></div>';
        }).join("") + '</div>';
    }).join("");
    var altHtml = altItems ? '<details class="altBox" open><summary>Alternative routes considered</summary>' + altItems + '</details>' : "";

    var unresolvedHtml = rec.unresolved.length ? '<div class="card unresolved"><h3>Needs a human check</h3>' +
      '<div class="sub">License Lens has no verified path for these with the answers given. They usually depend on details outside a licence lookup — confirm with Microsoft or a licensing specialist.</div>' +
      '<ul class="covers">' + rec.unresolved.map(function (e) { return '<li><div class="cvTitle">' + esc(e.cap.title) + '</div></li>'; }).join("") + '</ul></div>' : "";

    var addedCount = rec.chosen.length;
    var scen = rec.solvable.length + ' of your ' + state.basket.length + ' scenario' + (state.basket.length === 1 ? "" : "s");
    var summary = rec.display.length
      ? (addedCount === 0
          ? 'Your existing ' + esc((LIC_BY_ID[rec.baseId] || {}).name || "base licence") + ' already covers ' + scen + '. Nothing further to buy.'
          : 'To cover ' + scen + ', License Lens recommends ' + addedCount + ' licence' + (addedCount === 1 ? "" : "s") +
            ' per user' + (rec.baseId ? ' on top of your existing ' + esc((LIC_BY_ID[rec.baseId] || {}).name) : "") + ' (unless noted otherwise).')
      : (rec.unresolved.length ? "" : "Add a scenario to get started.");

    app.innerHTML =
      topBar() +
      basketBar(true) + chipRow() +
      '<h2 class="resultHead">Recommended licences</h2>' +
      '<div class="resultLede">' + esc(summary) + '</div>' +
      clarHtml +
      (licHtml ? '<div class="recBadge">' + (addedCount === 0 ? "Already covered" : "Recommended set") + '</div>' + licHtml : "") +
      altHtml +
      unresolvedHtml +
      disclaimer() + footer();
    window.scrollTo(0, 0);
  }

  function renderFind() {
    var q = window._llq || "";
    var res = searchCaps(q);
    var body;
    if (!q) { location.hash = "home"; return; }
    if (!res.length) {
      body = '<div class="card"><h3>No match for &ldquo;' + esc(q) + '&rdquo;</h3>' +
        '<div class="sub">Try different words, or browse by area.</div></div>';
    } else {
      body = '<div class="sectionLabel">' + res.length + ' match' + (res.length === 1 ? "" : "es") + ' for &ldquo;' + esc(q) + '&rdquo;</div>' +
        '<div class="sub" style="margin:-8px 0 18px">Pick the one you mean. Microsoft reuses names — several &ldquo;agent&rdquo; and &ldquo;Copilot&rdquo; products differ only by a word.</div>' +
        res.map(function (cap) { return capCard(cap, true); }).join("");
    }
    app.innerHTML =
      topBar() +
      (state.basket.length ? basketBar() + chipRow() : "") +
      '<div class="searchWrap" style="margin:18px auto 8px"><div class="searchRow">' +
      '<input id="q" type="text" autocomplete="off" value="' + esc(q) + '" oninput="LLsuggest(this.value)" onkeydown="LLkey(event)">' +
      '<button class="btn-primary" onclick="LLgo()">Search</button></div><div id="sugg"></div></div>' +
      body +
      disclaimer() + footer();
  }

  // ---- navigation ----
  function route() {
    var hash = (location.hash || "#home").slice(1);
    if (hash === "home" || hash === "") return renderHome();
    if (hash === "result") return renderResult();
    if (hash === "find") return renderFind();
    if (hash.indexOf("cat:") === 0) return renderCategory(hash.slice(4));
    renderHome();
  }
  window.addEventListener("hashchange", route);

  // ---- global handlers ----
  window.LLnav = function (where) {
    if (location.hash === "#" + where) route(); else location.hash = where;
  };
  window.LLadd = function (id) { if (state.basket.indexOf(id) === -1) state.basket.push(id); save(); route(); };
  window.LLremove = function (id) {
    state.basket = state.basket.filter(function (x) { return x !== id; });
    if (!state.basket.length) state.answers = {};
    save(); route();
  };
  window.LLclear = function () { state.basket = []; state.answers = {}; save(); location.hash = "home"; };
  window.LLpick = function (id) {
    if (state.basket.indexOf(id) === -1) state.basket.push(id);
    save();
    if (location.hash === "#result") route(); else location.hash = "result";
  };
  window.LLanswer = function (cid, oid) {
    if (oid) state.answers[cid] = oid; else delete state.answers[cid];
    save(); renderResult();
  };
  window.LLgo = function () {
    var q = document.getElementById("q"); if (!q) return;
    window._llq = q.value.trim();
    if (!window._llq) return;
    var res = searchCaps(window._llq);
    // one clearly-dominant hit: add it and go straight to the result
    if (res.length === 1 || (res.length > 1 && scoreCap(res[0], window._llq.toLowerCase()) >= scoreCap(res[1], window._llq.toLowerCase()) + 20)) {
      LLadd(res[0].id); location.hash = "result"; return;
    }
    location.hash = "find";
    if (location.hash === "#find") route();
  };
  window.LLkey = function (e) { if (e.key === "Enter") LLgo(); };
  window.LLsuggest = function (val) {
    var box = document.getElementById("sugg"); if (!box) return;
    var res = searchCaps(val);
    if (!val.trim()) { box.innerHTML = ""; return; }
    if (!res.length) { box.innerHTML = '<div class="suggestBox"><div class="suggestEmpty">No match yet — try different words, or browse by area below.</div></div>'; return; }
    box.innerHTML = '<div class="suggestBox">' + res.map(function (cap) {
      return '<div class="suggestItem" style="--cat-color:' + catColor(cap.category) + '" onclick="LLadd(\'' + cap.id + '\');location.hash=\'result\'">' +
        '<span class="catDot"></span><span class="st-main"><span class="st-title">' + esc(cap.title) + '</span>' +
        '<span class="st-desc">' + esc(cap.description) + '</span></span></div>';
    }).join("") + '</div>';
  };

  route();
})();
