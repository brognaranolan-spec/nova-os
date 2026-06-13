/* N0VA.OS — logique du dashboard admin
   - édite un brouillon des produits (localStorage: nova_products_override)
     -> aperçu instantané sur le site, sur cet appareil
   - studio 3D (modèle + couleurs) avec aperçu live
   - analytics lues depuis nova_analytics_v1 (même origine que le site)
   - export de products.js prêt à déployer */
(function () {
  "use strict";

  var OVERRIDE_KEY = "nova_products_override";
  var ANALYTICS_KEY = "nova_analytics_v1";
  var DEFAULTS = window.PRODUCTS_DEFAULT || [];
  var MODEL_LABELS = {
    "case-facet": "Coque · facettes", "case-circuit": "Coque · circuit", "case-chrome": "Coque · chrome",
    "case-hex": "Coque · hexgrid", "case-wire": "Coque · wireframe", "case-drip": "Coque · coulures",
    "fig-mecha": "Figurine · mécha", "fig-runner": "Figurine · runner", "fig-totem": "Figurine · totem",
    "fig-pup": "Figurine · chien", "fig-idol": "Figurine · buste", "fig-cube": "Figurine · cube"
  };
  var SWATCHES = [0xff2bd6, 0x00f0ff, 0xc8ff00, 0x5d34d0, 0xe8e8f0, 0xff3355, 0xd8d8e2, 0x14141c];

  var state = { products: load(), section: "overview" };
  var activePrev = null;          // une seule scène 3D vivante à la fois
  var studio = { id: null, spec: null };
  var drawer = { id: null, working: null };

  /* ---------- utils ---------- */
  var $ = function (id) { return document.getElementById(id); };
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function load() {
    try { var o = JSON.parse(localStorage.getItem(OVERRIDE_KEY)); if (o && o.length) return o; } catch (e) {}
    return clone(DEFAULTS);
  }
  function persist() { localStorage.setItem(OVERRIDE_KEY, JSON.stringify(state.products)); refreshStatus(); }
  function hasDraft() { return !!localStorage.getItem(OVERRIDE_KEY); }
  function hexStr(n) { return "#" + (n >>> 0).toString(16).padStart(6, "0"); }
  function hexNum(s) { return parseInt(String(s).replace("#", ""), 16) || 0; }
  function fp(n) { return window.formatPrice(n); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function syncMap() { window.PRODUCT_MAP = {}; state.products.forEach(function (p) { window.PRODUCT_MAP[p.id] = p; }); }

  var toastT;
  function toast(msg) { var e = $("admToast"); e.textContent = msg; e.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(function () { e.classList.remove("show"); }, 3000); }

  /* ---------- statut brouillon ---------- */
  function refreshStatus() {
    var s = $("status"), t = $("statusTxt");
    if (hasDraft()) { s.className = "adm-status draft"; t.textContent = "Brouillon non publié"; }
    else { s.className = "adm-status clean"; t.textContent = "Aucun brouillon"; }
  }

  /* ============================================================
     NAVIGATION
     ============================================================ */
  var TITLES = {
    overview: ["Vue d'ensemble", "Pilotage du catalogue, des modèles 3D et du trafic."],
    products: ["Produits", "Ajoute, édite, archive et réordonne tes pièces."],
    studio: ["Studio 3D", "Change le modèle et les couleurs de chaque pièce, en direct."],
    analytics: ["Analytics", "Vues, fiches consultées, ajouts panier et clics commande."],
    publish: ["Publier", "Génère le fichier à déployer pour mettre le site à jour."]
  };
  function showSection(sec) {
    state.section = sec;
    document.querySelectorAll(".adm-nav").forEach(function (b) { b.classList.toggle("active", b.dataset.sec === sec); });
    document.querySelectorAll(".adm-section").forEach(function (s) { s.classList.toggle("active", s.id === "sec-" + sec); });
    $("secTitle").textContent = TITLES[sec][0];
    $("secSub").textContent = TITLES[sec][1];
    if (activePrev && sec !== "studio") { activePrev.dispose(); activePrev = null; }
    if (sec === "overview") renderOverview();
    if (sec === "products") renderProducts();
    if (sec === "studio") initStudio();
    if (sec === "analytics") renderAnalytics();
    if (sec === "publish") genFile();
  }

  /* ============================================================
     VUE D'ENSEMBLE
     ============================================================ */
  function kpi(label, val, cls, sub) {
    return '<div class="kpi"><p class="kpi__label">' + label + '</p><p class="kpi__val ' + (cls || "") + '">' + val + '</p>' + (sub ? '<p class="kpi__sub">' + sub + '</p>' : "") + '</div>';
  }
  function catalogStats() {
    var p = state.products, inS = 0, out = 0, pre = 0, arch = 0, val = 0;
    p.forEach(function (x) {
      if (x.archived) { arch++; return; }
      if (x.stock === "in") inS++; else if (x.stock === "out") out++; else if (x.stock === "pre") pre++;
      val += Number(x.price) || 0;
    });
    return { total: p.length, inS: inS, out: out, pre: pre, arch: arch, val: val };
  }
  function renderOverview() {
    var c = catalogStats();
    $("kpiCatalog").innerHTML =
      kpi("Pièces au catalogue", c.total, "m", c.arch + " archivée(s)") +
      kpi("En stock", c.inS, "c") +
      kpi("Précommande", c.pre, "a") +
      kpi("Épuisé", c.out, "") +
      kpi("Valeur catalogue", fp(c.val), "c", "pièces actives");
    renderTraffic("kpiTraffic");
  }
  function renderTraffic(hostId) {
    var d = analytics();
    var t = d ? d.totals : { view: 0, open: 0, add: 0, checkout: 0 };
    $(hostId).innerHTML =
      kpi("Vues", t.view || 0, "c", (d ? d.sessions : 0) + " session(s)") +
      kpi("Fiches ouvertes", t.open || 0, "m") +
      kpi("Ajouts panier", t.add || 0, "a") +
      kpi("Clics “Commander”", t.checkout || 0, "");
  }

  /* ============================================================
     PRODUITS
     ============================================================ */
  function renderProducts() {
    var rows = state.products.map(function (p, i) {
      var stockPill = p.stock === "in" ? '<span class="badge-pill badge-in">en stock</span>'
        : p.stock === "out" ? '<span class="badge-pill badge-out">épuisé</span>'
        : '<span class="badge-pill badge-pre">précommande</span>';
      return '<tr class="' + (p.archived ? "arch" : "") + '" data-id="' + p.id + '">' +
        '<td><img class="pthumb" data-thumb3d="' + p.id + '" alt=""></td>' +
        '<td class="pname">' + esc(p.name) + '<small>' + esc(p.sub) + (p.archived ? " · archivé" : "") + '</small></td>' +
        '<td style="font-family:var(--font-mono);font-size:11px;color:var(--txt-2)">' + (p.cat === "coque" ? "coque" : "figurine") + '</td>' +
        '<td><input class="field-input inline-price" type="number" step="0.5" min="0" value="' + (Number(p.price) || 0) + '" data-price="' + p.id + '"></td>' +
        '<td><select class="field-select inline-stock" data-stock="' + p.id + '">' +
          '<option value="in"' + (p.stock === "in" ? " selected" : "") + '>en stock</option>' +
          '<option value="pre"' + (p.stock === "pre" ? " selected" : "") + '>précommande</option>' +
          '<option value="out"' + (p.stock === "out" ? " selected" : "") + '>épuisé</option>' +
        '</select></td>' +
        '<td>' + stockPill + '</td>' +
        '<td><div class="row-actions">' +
          iconBtn("edit", "Éditer", "edit", p.id) +
          iconBtn("up", "Monter", "mv-up", p.id) +
          iconBtn("down", "Descendre", "mv-down", p.id) +
          iconBtn("dup", "Dupliquer", "dup", p.id) +
          iconBtn("del", "Supprimer", "del", p.id, true) +
        '</div></td></tr>';
    }).join("");
    $("prodRows").innerHTML = rows;
    $("prodCount").textContent = state.products.length + " pièce(s)";
    regenThumbs();
  }
  function iconBtn(kind, title, act, id, danger) {
    var svg = {
      edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5Z"/>',
      up: '<path d="m6 15 6-6 6 6"/>', down: '<path d="m6 9 6 6 6-6"/>',
      dup: '<rect x="9" y="9" width="11" height="11" rx="1"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/>',
      del: '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13a1 1 0 0 0 1 .9h8a1 1 0 0 0 1-.9l1-13"/><path d="M9 7V4h6v3"/>'
    }[kind];
    return '<button class="icon-btn' + (danger ? " danger" : "") + '" title="' + title + '" data-act="' + act + '" data-id="' + id + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">' + svg + '</svg></button>';
  }

  function findIndex(id) { for (var i = 0; i < state.products.length; i++) if (state.products[i].id === id) return i; return -1; }

  function regenThumbs() {
    if (!window.View3D) return;
    window.View3D.ready.then(function () {
      syncMap();
      window.N0ZZLE_THUMBS = {};
      document.querySelectorAll("img[data-thumb3d]").forEach(function (img) { img.removeAttribute("src"); });
      window.View3D.thumbs();
    }).catch(function () {});
  }

  /* ---------- actions table ---------- */
  function onProductsClick(ev) {
    var b = ev.target.closest("[data-act]"); if (!b) return;
    var id = b.dataset.id, act = b.dataset.act, i = findIndex(id);
    if (act === "edit") openDrawer(id);
    else if (act === "dup") {
      var copy = clone(state.products[i]);
      copy.id = id + "-copie-" + Date.now().toString(36).slice(-4);
      copy.name = copy.name + " (copie)";
      state.products.splice(i + 1, 0, copy); persist(); renderProducts(); toast("// pièce dupliquée");
    } else if (act === "del") {
      if (confirm("Supprimer « " + state.products[i].name + " » ?")) { state.products.splice(i, 1); persist(); renderProducts(); toast("// pièce supprimée"); }
    } else if (act === "mv-up" && i > 0) { swap(i, i - 1); }
    else if (act === "mv-down" && i < state.products.length - 1) { swap(i, i + 1); }
  }
  function swap(a, b) { var t = state.products[a]; state.products[a] = state.products[b]; state.products[b] = t; persist(); renderProducts(); }

  function onProductsInput(ev) {
    var pr = ev.target.closest("[data-price]"), st = ev.target.closest("[data-stock]");
    if (pr) { var i = findIndex(pr.dataset.price); if (i > -1) { state.products[i].price = parseFloat(pr.value) || 0; persist(); } }
    if (st) { var j = findIndex(st.dataset.stock); if (j > -1) { state.products[j].stock = st.value; persist(); renderProducts(); } }
  }

  /* ---------- ajout ---------- */
  function addProduct() {
    var p = {
      id: "piece-" + Date.now().toString(36).slice(-5), name: "NOUVELLE PIÈCE",
      cat: "coque", sub: "Coque briquet — BIC J6 maxi", price: 14.9, stock: "in", badge: null,
      model: "case-facet", colors: { body: 0xff2bd6, accent: 0x00f0ff },
      desc: "Description courte.", long: "Description longue de la pièce.",
      specs: { "Matériau": "PLA recyclé", "Délai": "Expédié sous 72 h" }
    };
    state.products.unshift(p); persist(); renderProducts(); openDrawer(p.id); toast("// pièce créée — édite-la");
  }

  /* ============================================================
     DRAWER ÉDITION
     ============================================================ */
  function openDrawer(id) {
    var i = findIndex(id); if (i < 0) return;
    drawer.id = id; drawer.working = clone(state.products[i]);
    $("drawerTitle").textContent = "Éditer · " + drawer.working.name;
    $("drawerBody").innerHTML = drawerForm(drawer.working);
    $("drawerScrim").hidden = false; $("pdrawer").hidden = false;
    setTimeout(function () { $("drawerScrim").classList.add("show"); $("pdrawer").classList.add("open"); }, 20);
    bindDrawerFields();
    mountPreview($("dwStage"), drawer.working);
  }
  function closeDrawer() {
    $("drawerScrim").classList.remove("show"); $("pdrawer").classList.remove("open");
    setTimeout(function () { $("drawerScrim").hidden = true; $("pdrawer").hidden = true; }, 300);
    if (activePrev) { activePrev.dispose(); activePrev = null; }
  }
  function drawerForm(p) {
    var modelOpts = window.View3D ? window.View3D.MODELS.map(function (m) {
      return '<option value="' + m + '"' + (p.model === m ? " selected" : "") + '>' + (MODEL_LABELS[m] || m) + '</option>';
    }).join("") : "";
    var specRows = Object.keys(p.specs || {}).map(specRow).join("");
    return '' +
      '<div class="studio"><div class="studio__stage" id="dwStage"></div></div>' +
      '<div class="fgrid">' +
        fld("Nom", '<input class="field-input" data-f="name" value="' + esc(p.name) + '">') +
        fld("Catégorie", '<select class="field-select" data-f="cat"><option value="coque"' + (p.cat === "coque" ? " selected" : "") + '>Coque</option><option value="figurine"' + (p.cat === "figurine" ? " selected" : "") + '>Figurine</option></select>') +
      '</div>' +
      fld("Sous-titre", '<input class="field-input" data-f="sub" value="' + esc(p.sub) + '">') +
      '<div class="fgrid--3 fgrid">' +
        fld("Prix (€)", '<input class="field-input" type="number" step="0.5" min="0" data-f="price" value="' + (Number(p.price) || 0) + '">') +
        fld("Stock", '<select class="field-select" data-f="stock"><option value="in"' + (p.stock === "in" ? " selected" : "") + '>en stock</option><option value="pre"' + (p.stock === "pre" ? " selected" : "") + '>précommande</option><option value="out"' + (p.stock === "out" ? " selected" : "") + '>épuisé</option></select>') +
        fld("Badge", '<input class="field-input" data-f="badge" placeholder="(aucun)" value="' + esc(p.badge || "") + '">') +
      '</div>' +
      '<div class="fgrid"><div>' +
        fld("Modèle 3D", '<select class="field-select" data-f="model">' + modelOpts + '</select>') +
      '</div><div class="fgrid">' +
        fld("Corps", '<input type="color" data-f="cbody" value="' + hexStr(p.colors.body) + '" style="width:100%;height:36px;background:var(--bg);border:1px solid var(--line)">') +
        fld("Accent", '<input type="color" data-f="caccent" value="' + hexStr(p.colors.accent) + '" style="width:100%;height:36px;background:var(--bg);border:1px solid var(--line)">') +
      '</div></div>' +
      fld("Description courte", '<textarea class="field-input" data-f="desc">' + esc(p.desc) + '</textarea>') +
      fld("Description longue", '<textarea class="field-input" data-f="long" style="min-height:100px">' + esc(p.long) + '</textarea>') +
      '<div><label class="flbl">Caractéristiques</label><div class="specs-editor" id="specsEd">' + specRows + '</div>' +
      '<button class="btn btn--ghost btn-sm" id="addSpec" style="margin-top:8px">+ Ligne</button></div>' +
      '<label class="flbl" style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" data-f="archived"' + (p.archived ? " checked" : "") + '> Archivée (rangée dans la corbeille du site)</label>';
  }
  function fld(label, inner) { return '<div><label class="flbl">' + label + '</label>' + inner + '</div>'; }
  function specRow(k, idx) {
    var v = drawer.working.specs[k];
    return '<div class="spec-row"><input class="field-input" data-spec-k value="' + esc(k) + '"><input class="field-input" data-spec-v value="' + esc(v) + '"><button class="icon-btn danger" data-spec-del title="Retirer"><svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none"><path d="M5 12h14"/></svg></button></div>';
  }
  function readSpecs() {
    var specs = {};
    $("specsEd").querySelectorAll(".spec-row").forEach(function (row) {
      var k = row.querySelector("[data-spec-k]").value.trim();
      var v = row.querySelector("[data-spec-v]").value.trim();
      if (k) specs[k] = v;
    });
    return specs;
  }
  function bindDrawerFields() {
    var body = $("drawerBody");
    body.addEventListener("input", function (ev) {
      var f = ev.target.dataset.f; var w = drawer.working;
      if (f === "name") w.name = ev.target.value;
      else if (f === "cat") w.cat = ev.target.value;
      else if (f === "sub") w.sub = ev.target.value;
      else if (f === "price") w.price = parseFloat(ev.target.value) || 0;
      else if (f === "stock") w.stock = ev.target.value;
      else if (f === "badge") w.badge = ev.target.value.trim() || null;
      else if (f === "desc") w.desc = ev.target.value;
      else if (f === "long") w.long = ev.target.value;
      else if (f === "archived") w.archived = ev.target.checked || undefined;
      else if (f === "model") { w.model = ev.target.value; updatePreview(); }
      else if (f === "cbody") { w.colors.body = hexNum(ev.target.value); updatePreview(); }
      else if (f === "caccent") { w.colors.accent = hexNum(ev.target.value); updatePreview(); }
      if (ev.target.hasAttribute("data-spec-k") || ev.target.hasAttribute("data-spec-v")) w.specs = readSpecs();
    });
    body.addEventListener("click", function (ev) {
      if (ev.target.closest("#addSpec")) {
        drawer.working.specs = readSpecs(); drawer.working.specs["Nouvelle"] = "valeur";
        $("specsEd").insertAdjacentHTML("beforeend", specRow("Nouvelle"));
      }
      var del = ev.target.closest("[data-spec-del]");
      if (del) { del.closest(".spec-row").remove(); drawer.working.specs = readSpecs(); }
    });
  }
  function saveDrawer() {
    drawer.working.specs = readSpecs();
    var i = findIndex(drawer.id); if (i < 0) return;
    state.products[i] = clone(drawer.working);
    persist(); renderProducts(); closeDrawer(); toast("// pièce enregistrée (aperçu live actif)");
  }

  /* ============================================================
     STUDIO 3D
     ============================================================ */
  function initStudio() {
    var sel = $("studioPick");
    sel.innerHTML = state.products.map(function (p) { return '<option value="' + p.id + '">' + esc(p.name) + '</option>'; }).join("");
    if (!studio.id || findIndex(studio.id) < 0) studio.id = state.products[0] && state.products[0].id;
    sel.value = studio.id;
    $("studioModels").innerHTML = window.View3D ? window.View3D.MODELS.map(function (m) {
      return '<button class="model-opt" data-model="' + m + '">' + (MODEL_LABELS[m] || m) + '</button>';
    }).join("") : "";
    $("studioSwatches").innerHTML = SWATCHES.map(function (c) { return '<button class="swatch" data-sw="' + hexStr(c) + '" style="background:' + hexStr(c) + '"></button>'; }).join("");
    loadStudio(studio.id);
  }
  function loadStudio(id) {
    var i = findIndex(id); if (i < 0) return;
    studio.id = id; studio.spec = clone(state.products[i]);
    document.querySelectorAll("#studioModels .model-opt").forEach(function (b) { b.classList.toggle("active", b.dataset.model === studio.spec.model); });
    $("studioBody").value = hexStr(studio.spec.colors.body); $("studioBodyHex").textContent = hexStr(studio.spec.colors.body);
    $("studioAccent").value = hexStr(studio.spec.colors.accent); $("studioAccentHex").textContent = hexStr(studio.spec.colors.accent);
    mountPreview($("studioStage"), studio.spec);
  }
  function studioUpdate() {
    $("studioBodyHex").textContent = hexStr(studio.spec.colors.body);
    $("studioAccentHex").textContent = hexStr(studio.spec.colors.accent);
    if (activePrev) activePrev.update(studio.spec);
  }
  function studioApply() {
    var i = findIndex(studio.id); if (i < 0) return;
    state.products[i].model = studio.spec.model;
    state.products[i].colors = clone(studio.spec.colors);
    persist(); toast("// modèle 3D appliqué à « " + state.products[i].name + " »");
  }

  /* ---------- aperçu 3D partagé ---------- */
  function mountPreview(host, spec) {
    if (!window.View3D || !host) return;
    if (activePrev) { activePrev.dispose(); activePrev = null; }
    host.innerHTML = '<p class="studio__hint">chargement 3D…</p>';
    window.View3D.ready.then(function () {
      activePrev = window.View3D.preview(spec, host);   // vide host + ajoute le canvas
      var hint = document.createElement("p");
      hint.className = "studio__hint"; hint.textContent = "glisser pour pivoter";
      host.appendChild(hint);
    }).catch(function () { host.innerHTML = '<p class="studio__hint">3D indisponible</p>'; });
  }
  function updatePreview() { if (activePrev) activePrev.update(drawer.working); }

  /* ============================================================
     ANALYTICS
     ============================================================ */
  function analytics() { try { return JSON.parse(localStorage.getItem(ANALYTICS_KEY)); } catch (e) { return null; } }
  function renderAnalytics() {
    renderTraffic("kpiTraffic2");
    var d = analytics();
    // graphe vues 14 jours
    var days = [], chart = $("viewsChart"), xax = $("viewsChartX");
    for (var k = 13; k >= 0; k--) { var dt = new Date(); dt.setDate(dt.getDate() - k); days.push(dt.toISOString().slice(0, 10)); }
    var vals = days.map(function (day) { return d && d.daily[day] ? d.daily[day].view : 0; });
    var max = Math.max(1, Math.max.apply(null, vals));
    chart.innerHTML = vals.map(function (v) { return '<div class="bar" data-v="' + v + '" style="height:' + (v / max * 100) + '%"></div>'; }).join("");
    xax.innerHTML = '<span>' + days[0].slice(5) + '</span><span>' + days[7].slice(5) + '</span><span>auj.</span>';
    // top produits
    var prods = (d && d.products) ? Object.keys(d.products).map(function (id) {
      var pm = state.products.filter(function (p) { return p.id === id; })[0];
      return { id: id, name: pm ? pm.name : id, open: d.products[id].open || 0, add: d.products[id].add || 0 };
    }) : [];
    prods.sort(function (a, b) { return b.open - a.open; });
    $("topProducts").innerHTML = prods.length ? prods.map(function (p) {
      var rate = p.open ? Math.round(p.add / p.open * 100) : 0;
      return '<tr><td class="pname">' + esc(p.name) + '</td><td>' + p.open + '</td><td>' + p.add + '</td><td style="color:var(--cyan)">' + rate + '%</td></tr>';
    }).join("") : '<tr><td colspan="4" style="color:var(--txt-2);font-family:var(--font-mono);font-size:12px;padding:18px">Aucune donnée pour l\'instant — navigue sur le site puis reviens.</td></tr>';
  }

  /* ============================================================
     PUBLIER (export products.js)
     ============================================================ */
  function hex6(n) { return "0x" + (n >>> 0).toString(16).padStart(6, "0").toUpperCase(); }
  function js(v) { return JSON.stringify(v); }
  function serializeProduct(p) {
    var L = ["  {"];
    L.push("    id: " + js(p.id) + ", name: " + js(p.name) + ",");
    L.push("    cat: " + js(p.cat) + ", sub: " + js(p.sub) + ",");
    L.push("    price: " + (Number(p.price) || 0) + ", stock: " + js(p.stock) + ", badge: " + (p.badge ? js(p.badge) : "null") + ",");
    L.push("    model: " + js(p.model) + ", colors: { body: " + hex6(p.colors.body) + ", accent: " + hex6(p.colors.accent) + " },");
    L.push("    desc: " + js(p.desc) + ",");
    L.push("    long: " + js(p.long) + ",");
    var specs = "{ " + Object.keys(p.specs || {}).map(function (k) { return js(k) + ": " + js(p.specs[k]); }).join(", ") + " }";
    L.push("    specs: " + specs + (p.archived ? "," : ""));
    if (p.archived) L.push("    archived: true");
    L.push("  }");
    return L.join("\n");
  }
  function serialize() {
    var head = "/* N0VA.OS — catalogue produits (généré par le dashboard admin) */\nwindow.PRODUCTS_DEFAULT = [\n";
    var body = state.products.map(serializeProduct).join(",\n");
    var tail = "\n];\n\n/* applique un éventuel brouillon admin (cet appareil uniquement) */\n(function () {\n  var list = window.PRODUCTS_DEFAULT;\n  try {\n    var ov = JSON.parse(localStorage.getItem(\"nova_products_override\"));\n    if (ov && Array.isArray(ov) && ov.length) list = ov;\n  } catch (e) {}\n  window.PRODUCTS = list;\n  window.PRODUCT_MAP = {};\n  window.PRODUCTS.forEach(function (p) { window.PRODUCT_MAP[p.id] = p; });\n})();\n\nwindow.formatPrice = function (n) {\n  return Number(n || 0).toLocaleString(\"fr-FR\", { style: \"currency\", currency: \"EUR\" });\n};\n";
    return head + body + tail;
  }
  function genFile() {
    $("codeOut").value = serialize();
    var changed = JSON.stringify(state.products) !== JSON.stringify(DEFAULTS);
    $("diffStatus").textContent = changed ? "● des changements sont prêts à publier" : "aucun changement vs version publiée";
    $("diffStatus").style.color = changed ? "var(--acid)" : "var(--txt-2)";
  }
  function downloadFile() {
    var blob = new Blob([serialize()], { type: "text/javascript" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "products.js";
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
    toast("// products.js téléchargé");
  }
  function copyFile() {
    navigator.clipboard && navigator.clipboard.writeText(serialize()).then(function () { toast("// copié dans le presse-papiers"); }, function () { toast("// copie impossible — utilise Télécharger"); });
  }

  /* ============================================================
     INIT
     ============================================================ */
  function init() {
    refreshStatus();
    showSection("overview");

    document.querySelectorAll(".adm-nav").forEach(function (b) { b.addEventListener("click", function () { showSection(b.dataset.sec); }); });
    document.querySelectorAll("[data-sec-link]").forEach(function (b) { b.addEventListener("click", function () { showSection(b.dataset.secLink); }); });

    $("addProduct").addEventListener("click", addProduct);
    $("prodRows").addEventListener("click", onProductsClick);
    $("prodRows").addEventListener("input", onProductsInput);

    $("drawerClose").addEventListener("click", closeDrawer);
    $("drawerCancel").addEventListener("click", closeDrawer);
    $("drawerScrim").addEventListener("click", closeDrawer);
    $("drawerSave").addEventListener("click", saveDrawer);

    $("studioPick").addEventListener("change", function () { loadStudio(this.value); });
    $("studioModels").addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-model]"); if (!b) return;
      studio.spec.model = b.dataset.model;
      document.querySelectorAll("#studioModels .model-opt").forEach(function (x) { x.classList.toggle("active", x === b); });
      studioUpdate();
    });
    $("studioBody").addEventListener("input", function () { studio.spec.colors.body = hexNum(this.value); studioUpdate(); });
    $("studioAccent").addEventListener("input", function () { studio.spec.colors.accent = hexNum(this.value); studioUpdate(); });
    $("studioSwatches").addEventListener("click", function (ev) { var b = ev.target.closest("[data-sw]"); if (!b) return; studio.spec.colors.accent = hexNum(b.dataset.sw); $("studioAccent").value = b.dataset.sw; studioUpdate(); });
    $("studioApply").addEventListener("click", studioApply);

    $("genFile").addEventListener("click", function () { genFile(); toast("// fichier régénéré"); });
    $("downloadFile").addEventListener("click", downloadFile);
    $("copyFile").addEventListener("click", copyFile);

    $("refreshStats").addEventListener("click", function () { renderAnalytics(); toast("// stats rafraîchies"); });
    $("resetStats").addEventListener("click", function () { if (confirm("Vider les statistiques locales de cet appareil ?")) { localStorage.removeItem(ANALYTICS_KEY); renderAnalytics(); renderOverview(); toast("// stats locales vidées"); } });

    $("resetDraft").addEventListener("click", function (ev) {
      ev.preventDefault();
      if (confirm("Annuler le brouillon et revenir à la version publiée ?")) {
        localStorage.removeItem(OVERRIDE_KEY); state.products = clone(DEFAULTS);
        refreshStatus(); showSection(state.section); toast("// brouillon annulé");
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
