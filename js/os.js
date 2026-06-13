/* N0VA.OS — gestionnaire de fenêtres, bureau, taskbar, terminal, boot */
(function () {
  "use strict";

  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isMobile = function () { return window.innerWidth < 768; };
  var zTop = 100;
  var cascade = 0;
  var productHandle = null;   // vue 3D montée dans la fenêtre produit

  /* ================= WINDOW MANAGER ================= */
  var WM = {
    open: function (id, opts) {
      var win = document.getElementById(id);
      if (!win) return;
      var wasHidden = win.hidden;
      win.hidden = false;
      win.removeAttribute("data-min");
      if (wasHidden && !win.dataset.placed && !isMobile()) {
        var desk = document.getElementById("desktop");
        var dw = desk.clientWidth, dh = desk.clientHeight;
        var ww = Math.min(win.offsetWidth || 520, dw - 24);
        var x = (opts && opts.x != null) ? opts.x : Math.max(12, (dw - ww) / 2 + ((cascade % 5) - 2) * 36);
        var y = (opts && opts.y != null) ? opts.y : Math.max(10, 40 + (cascade % 5) * 26);
        win.style.left = x + "px";
        win.style.top = y + "px";
        win.dataset.placed = "1";
        cascade++;
      }
      WM.focus(id);
      syncTaskbar();
      var fc = win.querySelector(".win__bar button");
      if (fc && wasHidden) fc.focus({ preventScroll: true });
      win.dispatchEvent(new CustomEvent("win:open"));
    },
    close: function (id) {
      var win = document.getElementById(id);
      if (!win) return;
      win.hidden = true;
      win.dispatchEvent(new CustomEvent("win:close"));
      syncTaskbar();
    },
    minimize: function (id) {
      var win = document.getElementById(id);
      if (!win) return;
      win.setAttribute("data-min", "");
      win.hidden = true;
      win.dispatchEvent(new CustomEvent("win:minimize"));
      syncTaskbar();
    },
    restore: function (id) {
      var win = document.getElementById(id);
      if (!win) return;
      win.hidden = false;
      win.removeAttribute("data-min");
      win.dispatchEvent(new CustomEvent("win:open"));
      WM.focus(id);
      syncTaskbar();
    },
    focus: function (id) {
      var win = document.getElementById(id);
      if (!win) return;
      zTop++;
      win.style.zIndex = zTop;
      document.querySelectorAll(".win").forEach(function (w) { w.classList.toggle("focused", w === win); });
    },
    topWindow: function () {
      var best = null, bz = -1;
      document.querySelectorAll(".win:not([hidden])").forEach(function (w) {
        var z = parseInt(w.style.zIndex || 0, 10);
        if (z > bz) { bz = z; best = w; }
      });
      return best;
    }
  };
  window.WM = WM;

  function syncTaskbar() {
    var host = document.getElementById("tbTabs");
    if (!host) return;
    var open = [].slice.call(document.querySelectorAll(".win")).filter(function (w) {
      return !w.hidden || w.hasAttribute("data-min");
    });
    host.innerHTML = open.map(function (w) {
      var min = w.hasAttribute("data-min");
      return '<button class="tb-tab' + (min ? " min" : "") + '" data-tab="' + w.id + '">' +
        (w.getAttribute("data-title") || w.id) + "</button>";
    }).join("");
  }

  /* drag des fenêtres (desktop uniquement) */
  function makeDraggable(win) {
    var bar = win.querySelector(".win__bar");
    if (!bar) return;
    var sx, sy, ox, oy, dragging = false;
    bar.addEventListener("pointerdown", function (ev) {
      if (ev.target.closest("button") || isMobile()) return;
      dragging = true;
      sx = ev.clientX; sy = ev.clientY;
      ox = win.offsetLeft; oy = win.offsetTop;
      bar.setPointerCapture(ev.pointerId);
      WM.focus(win.id);
    });
    bar.addEventListener("pointermove", function (ev) {
      if (!dragging) return;
      var desk = document.getElementById("desktop");
      var nx = ox + ev.clientX - sx;
      var ny = oy + ev.clientY - sy;
      nx = Math.max(-win.offsetWidth + 80, Math.min(nx, desk.clientWidth - 80));
      ny = Math.max(0, Math.min(ny, desk.clientHeight - 40));
      win.style.left = nx + "px";
      win.style.top = ny + "px";
    });
    bar.addEventListener("pointerup", function () { dragging = false; });
    bar.addEventListener("pointercancel", function () { dragging = false; });
  }

  /* ================= BOUTIQUE ================= */
  var activeFilter = "all";
  function renderShop() {
    var host = document.getElementById("shopGrid");
    if (!host) return;
    var list = window.PRODUCTS.filter(function (p) { return !p.archived; });
    if (activeFilter !== "all") list = list.filter(function (p) { return p.cat === activeFilter; });
    host.innerHTML = list.map(pcard).join("");
    var count = document.getElementById("shopCount");
    if (count) count.textContent = list.length + " fichier" + (list.length > 1 ? "s" : "");
    window.View3D && window.View3D.thumbs();
  }

  function pcard(p) {
    var badge = "";
    if (p.stock === "out") badge = '<span class="pcard__badge pcard__badge--out">Épuisé</span>';
    else if (p.stock === "pre") badge = '<span class="pcard__badge pcard__badge--pre">Précommande</span>';
    else if (p.badge) badge = '<span class="pcard__badge">' + p.badge + "</span>";
    return '<button class="pcard" data-product="' + p.id + '" aria-label="Ouvrir la fiche ' + p.name + '">' +
      '<span class="pcard__visual">' + badge +
        '<img data-thumb3d="' + p.id + '" alt="">' +
      "</span>" +
      '<span class="pcard__name">' + p.name.toLowerCase().replace(/\s+/g, "_") + ".obj</span>" +
      '<span class="pcard__price">' + window.formatPrice(p.price) + "</span>" +
    "</button>";
  }

  function renderArchive() {
    var host = document.getElementById("trashGrid");
    if (!host) return;
    var list = window.PRODUCTS.filter(function (p) { return p.archived; });
    host.innerHTML = list.map(pcard).join("");
    window.View3D && window.View3D.thumbs();
  }

  /* ================= FENÊTRE PRODUIT ================= */
  function openProduct(id) {
    var p = window.PRODUCT_MAP[id];
    if (!p) return;
    if (window.NovaTrack) window.NovaTrack.event("open", id);
    var win = document.getElementById("win-product");
    win.setAttribute("data-title", p.name.toLowerCase().replace(/\s+/g, "_") + ".obj");
    win.querySelector(".win__bar-title").textContent = win.getAttribute("data-title");
    document.getElementById("pdCat").textContent = p.sub;
    document.getElementById("pdName").textContent = p.name;
    document.getElementById("pdPrice").textContent = window.formatPrice(p.price);
    document.getElementById("pdDesc").textContent = p.long;
    var specs = "";
    Object.keys(p.specs).forEach(function (k) {
      specs += "<div><dt>" + k + "</dt><dd>" + p.specs[k] + "</dd></div>";
    });
    document.getElementById("pdSpecs").innerHTML = specs;
    var btn = document.getElementById("pdAdd");
    btn.dataset.add = p.id;
    if (p.stock === "out") { btn.disabled = true; btn.textContent = "Épuisé — archivé"; }
    else if (p.stock === "pre") { btn.disabled = false; btn.textContent = "Précommander"; }
    else { btn.disabled = false; btn.textContent = "Ajouter au panier"; }

    WM.open("win-product");
    syncTaskbar();

    if (productHandle) { productHandle.dispose(); productHandle = null; }
    var host = document.getElementById("pdCanvas");
    host.innerHTML = '<p class="pd-loading">chargement du modèle…</p>';
    window.View3D.ready.then(function () {
      if (win.hidden) return;
      productHandle = window.View3D.mount(id, host);
    }).catch(function () {
      host.innerHTML = '<p class="pd-loading">3D indisponible sur ce navigateur</p>';
    });
  }

  /* ================= TERMINAL ================= */
  var TERM_CMDS = {
    help: function () {
      return ["commandes disponibles :",
        "  ls ............. liste les pièces du drop",
        "  open <nom> ..... ouvre une fenêtre (boutique, moi, atelier, contact, panier, corbeille)",
        "  drops .......... infos sur le drop en cours",
        "  glitch ......... déclenche une corruption d'écran",
        "  clear .......... vide le terminal",
        "  nova ........... à propos de l'artiste"].join("\n");
    },
    ls: function () {
      return window.PRODUCTS.filter(function (p) { return !p.archived; })
        .map(function (p) {
          return "  " + (p.name.toLowerCase().replace(/\s+/g, "_") + ".obj").padEnd(22, " ") +
            window.formatPrice(p.price) + (p.stock === "pre" ? "  [précommande]" : "");
        }).join("\n");
    },
    drops: function () {
      return "DROP 003 — \"SIGNAL PERDU\"\n11 pièces · séries ≤ 30 ex. · expédition 72h\nprochain drop : avril (TOTEM 404 en précommande)";
    },
    nova: function () {
      return "N0VA — artiste 3D.\nje modélise, j'imprime, je ponce, je peins.\ntout sort de mon atelier, rien d'une usine.\n> open moi — pour en savoir plus";
    },
    glitch: function () {
      document.body.classList.add("mega-glitch");
      setTimeout(function () { document.body.classList.remove("mega-glitch"); }, 900);
      return "c0rRuPt!0n %#@… ok c'est réparé.";
    },
    clear: "CLEAR",
    open: function (arg) {
      var map = { boutique: "win-shop", moi: "win-about", atelier: "win-studio", contact: "win-contact", panier: "win-cart", corbeille: "win-trash", terminal: "win-term" };
      if (map[arg]) { WM.open(map[arg]); return "ouverture de " + arg + "…"; }
      return "inconnu : " + (arg || "(rien)") + " — essaie : " + Object.keys(map).join(", ");
    }
  };

  function initTerminal() {
    var out = document.getElementById("termOut");
    var input = document.getElementById("termIn");
    if (!out || !input) return;
    function print(txt, cls) {
      var pre = document.createElement("pre");
      pre.textContent = txt;
      if (cls) pre.className = cls;
      out.appendChild(pre);
      out.scrollTop = out.scrollHeight;
    }
    print("N0VA.TERM v3.2 — tape \"help\" pour commencer", "t-dim");
    input.addEventListener("keydown", function (ev) {
      if (ev.key !== "Enter") return;
      var raw = input.value.trim();
      input.value = "";
      if (!raw) return;
      print("nova@atelier:~$ " + raw, "t-cmd");
      var parts = raw.toLowerCase().split(/\s+/);
      var cmd = TERM_CMDS[parts[0]];
      if (cmd === "CLEAR" || parts[0] === "clear") { out.innerHTML = ""; return; }
      if (typeof cmd === "function") print(cmd(parts[1]));
      else if (parts[0] === "sudo") print("nice try.");
      else if (parts[0] === "exit") { WM.close("win-term"); }
      else print("commande inconnue : " + parts[0] + " — tape \"help\"", "t-err");
    });
  }

  /* ================= BOOT ================= */
  function initBoot() {
    var boot = document.getElementById("boot");
    if (!boot) return;
    if (REDUCED || sessionStorage.getItem("nova_booted")) {
      boot.classList.add("done");
      return;
    }
    var lines = [
      "N0VA BIOS v3.2 — atelier édition",
      "MEM CHECK ........ 640K OK (ça suffira)",
      "BUSE 0.4mm ....... 210°C OK",
      "FILAMENT ......... MAGENTA CHARGÉ",
      "CHARGEMENT N0VA.OS …"
    ];
    var host = document.getElementById("bootLines");
    var i = 0;
    var t = setInterval(function () {
      if (i < lines.length) {
        var d = document.createElement("div");
        d.textContent = "> " + lines[i++];
        host.appendChild(d);
      } else {
        clearInterval(t);
        setTimeout(function () {
          boot.classList.add("done");
          sessionStorage.setItem("nova_booted", "1");
        }, 350);
      }
    }, 260);
  }

  /* ================= HORLOGE ================= */
  function initClock() {
    var el = document.getElementById("tbClock");
    if (!el) return;
    function tick() {
      var d = new Date();
      el.textContent = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    }
    tick();
    setInterval(tick, 20000);
  }

  /* ================= GLITCH LOGO ================= */
  function initGlitch() {
    if (REDUCED) return;
    var els = document.querySelectorAll(".glitch");
    if (!els.length) return;
    setInterval(function () {
      var el = els[Math.floor(Math.random() * els.length)];
      el.classList.add("is-glitching");
      setTimeout(function () { el.classList.remove("is-glitching"); }, 380);
    }, 3000);
  }

  /* ================= INIT ================= */
  function init() {
    initBoot();
    initClock();
    initGlitch();
    initTerminal();
    renderShop();
    renderArchive();

    document.querySelectorAll(".win").forEach(makeDraggable);

    /* délégation de clics globale */
    document.addEventListener("click", function (ev) {
      var t;
      if ((t = ev.target.closest("[data-open]"))) {
        WM.open(t.getAttribute("data-open"));
        closeStart();
      } else if ((t = ev.target.closest("[data-close]"))) {
        if (t.getAttribute("data-close") === "win-product" && productHandle) {
          productHandle.dispose(); productHandle = null;
        }
        WM.close(t.getAttribute("data-close"));
      } else if ((t = ev.target.closest("[data-minimize]"))) {
        WM.minimize(t.getAttribute("data-minimize"));
      } else if ((t = ev.target.closest(".tb-tab"))) {
        var id = t.getAttribute("data-tab");
        var w = document.getElementById(id);
        if (w.hidden) WM.restore(id); else WM.minimize(id);
      } else if ((t = ev.target.closest("[data-product]"))) {
        openProduct(t.getAttribute("data-product"));
      } else if ((t = ev.target.closest("[data-filter]"))) {
        activeFilter = t.getAttribute("data-filter");
        document.querySelectorAll("[data-filter]").forEach(function (c) {
          c.classList.toggle("active", c === t);
          c.setAttribute("aria-pressed", c === t);
        });
        renderShop();
      } else if (ev.target.closest("#tbStart")) {
        toggleStart();
      } else if (!ev.target.closest("#startMenu")) {
        closeStart();
      }
      var winEl = ev.target.closest(".win");
      if (winEl) WM.focus(winEl.id);
    });

    /* fermer la fenêtre du dessus avec Échap */
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") {
        var sm = document.getElementById("startMenu");
        if (sm && !sm.hidden) { closeStart(); return; }
        var top = WM.topWindow();
        if (top) {
          if (top.id === "win-product" && productHandle) { productHandle.dispose(); productHandle = null; }
          WM.close(top.id);
        }
      }
    });

    /* fermeture 3D quand la fenêtre produit se ferme autrement */
    document.getElementById("win-product").addEventListener("win:close", function () {
      if (productHandle) { productHandle.dispose(); productHandle = null; }
    });

    /* cycle de vie du jeu PRINT.RUN */
    var gw = document.getElementById("win-game");
    if (gw) {
      gw.addEventListener("win:open", function () {
        if (window.NovaGame) window.NovaGame.open(document.getElementById("gameStage"));
      });
      gw.addEventListener("win:minimize", function () {
        if (window.NovaGame) window.NovaGame.pause();
      });
      gw.addEventListener("win:close", function () {
        if (window.NovaGame) window.NovaGame.close();
      });
    }

    /* formulaire contact */
    var contact = document.getElementById("contactForm");
    if (contact) {
      contact.addEventListener("submit", function (ev) {
        ev.preventDefault();
        window.location.href = "mailto:hello@n0va.art?subject=" +
          encodeURIComponent("Contact — " + contact.cname.value) +
          "&body=" + encodeURIComponent(contact.cmsg.value + "\n\n— " + contact.cname.value + " (" + contact.cmail.value + ")");
        if (window.toast) window.toast("// message prêt dans ton e-mail");
      });
    }

    /* newsletter */
    var news = document.getElementById("newsForm");
    if (news) {
      news.addEventListener("submit", function (ev) {
        ev.preventDefault();
        /* Brancher ici Formspree / Brevo / Mailchimp */
        localStorage.setItem("nova_newsletter", news.email.value);
        if (window.toast) window.toast("// inscription confirmée — à très vite");
        news.reset();
      });
    }

    /* année */
    var y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();

    /* fenêtres d'accueil */
    setTimeout(function () {
      WM.open("win-about", { x: 60, y: 48 });
      if (!isMobile()) WM.open("win-shop");
    }, REDUCED ? 50 : 1750);
  }

  function toggleStart() {
    var sm = document.getElementById("startMenu");
    var btn = document.getElementById("tbStart");
    sm.hidden = !sm.hidden;
    btn.setAttribute("aria-expanded", String(!sm.hidden));
  }
  function closeStart() {
    var sm = document.getElementById("startMenu");
    var btn = document.getElementById("tbStart");
    if (sm && !sm.hidden) { sm.hidden = true; btn.setAttribute("aria-expanded", "false"); }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
