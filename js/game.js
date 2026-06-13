/* N0VA.OS — PRINT.RUN
   Endless-runner 3D dans une fenêtre OS. Pilote la buse sur la grille synthwave,
   collecte le filament + les vraies pièces du catalogue, esquive la corruption.
   API : window.NovaGame.open(stageEl) / pause() / resume() / close() */
(function () {
  "use strict";

  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var BEST_KEY = "nova_printrun_best";
  var MUTE_KEY = "nova_printrun_mute";
  var LANES = [-1.7, 0, 1.7];
  var GRAVITY = -38, JUMP_V = 13.2;
  var SPAWN_Z = -48, DESPAWN_Z = 9;

  var T = null;
  var inst = null;        // instance courante du jeu
  var modelCache = {};    // modèles produits clonables

  /* ---------- DOM helpers ---------- */
  function $(id) { return document.getElementById(id); }

  /* ---------- audio rétro (WebAudio) ---------- */
  var actx = null, muted = localStorage.getItem(MUTE_KEY) === "1";
  function initAudio() {
    if (actx || muted) return;
    try { actx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { actx = null; }
  }
  function blip(freq, dur, type, vol) {
    if (!actx || muted) return;
    try {
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = type || "square"; o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.05, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
      o.connect(g); g.connect(actx.destination);
      o.start(); o.stop(actx.currentTime + dur);
    } catch (e) {}
  }
  var SFX = {
    pick: function () { blip(880, 0.12, "square", 0.05); },
    artifact: function () { blip(660, 0.1, "triangle", 0.06); setTimeout(function () { blip(990, 0.16, "triangle", 0.06); }, 90); },
    jump: function () { blip(420, 0.12, "sine", 0.04); },
    hit: function () { blip(120, 0.3, "sawtooth", 0.09); },
    over: function () { [440, 330, 220, 150].forEach(function (f, i) { setTimeout(function () { blip(f, 0.22, "sawtooth", 0.07); }, i * 130); }); }
  };

  /* ============================================================
     CONSTRUCTION DE LA SCÈNE
     ============================================================ */
  function build(stage) {
    var w = stage.clientWidth || 800, h = stage.clientHeight || 480;
    var renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.domElement.className = "g-canvas";
    stage.insertBefore(renderer.domElement, stage.firstChild);

    var scene = new T.Scene();
    scene.background = new T.Color(0x050507);
    scene.fog = new T.Fog(0x050507, 14, 46);

    var cam = new T.PerspectiveCamera(60, w / h, 0.1, 120);
    cam.position.set(0, 3.0, 6.4);
    cam.lookAt(0, 0.8, -8);

    // lumières
    scene.add(new T.AmbientLight(0x8088b8, 0.7));
    var dir = new T.DirectionalLight(0xffffff, 1.2); dir.position.set(2, 6, 4); scene.add(dir);
    var pm = new T.PointLight(0xff2bd6, 26, 30, 2); pm.position.set(-3, 2, 3); scene.add(pm);
    var pc = new T.PointLight(0x00f0ff, 26, 30, 2); pc.position.set(3, 2, 3); scene.add(pc);

    // grille infinie (scroll par modulo)
    var grid = new T.GridHelper(80, 80, 0x00f0ff, 0x12203a);
    grid.material.transparent = true; grid.material.opacity = 0.5;
    scene.add(grid);

    // murs néon latéraux
    function wall(x, color) {
      var m = new T.Mesh(new T.BoxGeometry(0.12, 1.1, 160),
        new T.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 1.1 }));
      m.position.set(x, 0.4, -60); scene.add(m); return m;
    }
    wall(-3.4, 0xff2bd6); wall(3.4, 0x00f0ff);

    // ciel : ligne d'horizon magenta
    var horizon = new T.Mesh(new T.PlaneGeometry(200, 30),
      new T.MeshBasicMaterial({ color: 0x180a2a, transparent: true, opacity: 0.8 }));
    horizon.position.set(0, 6, -55); scene.add(horizon);

    // joueur : la buse
    var player = buildNozzle();
    player.position.set(0, 0, 0);
    scene.add(player);

    // géométries / matériaux partagés
    var geo = {
      block: new T.BoxGeometry(1.15, 1.8, 1.0),
      blockWire: new T.BoxGeometry(1.2, 1.85, 1.05),
      hurdle: new T.BoxGeometry(1.25, 0.5, 0.45),
      fil: new T.IcosahedronGeometry(0.32, 0),
      ring: new T.TorusGeometry(0.5, 0.05, 8, 24),
      trail: new T.BoxGeometry(0.34, 0.06, 0.5)
    };
    var mat = {
      block: new T.MeshStandardMaterial({ color: 0x14141c, roughness: 0.6, metalness: 0.2 }),
      blockWire: new T.MeshBasicMaterial({ color: 0xff2bd6, wireframe: true }),
      hurdle: new T.MeshStandardMaterial({ color: 0xc8ff00, emissive: 0xc8ff00, emissiveIntensity: 0.7 }),
      fil: new T.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00f0ff, emissiveIntensity: 0.9, roughness: 0.4 }),
      ring: new T.MeshBasicMaterial({ color: 0xc8ff00, transparent: true })
    };

    inst = {
      stage: stage, renderer: renderer, scene: scene, cam: cam,
      grid: grid, player: player, geo: geo, mat: mat,
      objs: [], trail: [], fx: [],
      mode: "idle", paused: false, userPaused: false,
      raf: null, last: 0,
      lane: 1, targetX: 0, vy: 0, y: 0,
      speed: 8, scroll: 0, dist: 0, score: 0,
      best: parseInt(localStorage.getItem(BEST_KEY) || "0", 10),
      lives: 3, inv: 0, spawnT: 1.2, blink: 0,
      ro: null
    };

    // resize
    inst.ro = new ResizeObserver(function () { resize(); });
    inst.ro.observe(stage);

    bindControls();
    renderLives();
    setText("gBest", inst.best);
    updateMuteBtn();
    showScreen("gStart");
    loop(performance.now());
  }

  function buildNozzle() {
    var g = new T.Group();
    var body = new T.Mesh(new T.CylinderGeometry(0.34, 0.22, 0.6, 16),
      new T.MeshStandardMaterial({ color: 0xff2bd6, emissive: 0xff2bd6, emissiveIntensity: 0.35, roughness: 0.3, metalness: 0.4 }));
    body.position.y = 0.85; g.add(body);
    var cone = new T.Mesh(new T.ConeGeometry(0.22, 0.5, 16),
      new T.MeshStandardMaterial({ color: 0xd8d8e2, metalness: 1, roughness: 0.15 }));
    cone.rotation.x = Math.PI; cone.position.y = 0.4; g.add(cone);
    var tip = new T.Mesh(new T.SphereGeometry(0.12, 12, 10),
      new T.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00f0ff, emissiveIntensity: 1.4 }));
    tip.position.y = 0.16; g.add(tip);
    [-1, 1].forEach(function (s) {
      var fin = new T.Mesh(new T.BoxGeometry(0.5, 0.06, 0.28),
        new T.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00f0ff, emissiveIntensity: 0.8 }));
      fin.position.set(s * 0.32, 0.85, 0); fin.rotation.z = s * 0.3; g.add(fin);
    });
    g.userData.tip = tip; g.userData.body = body;
    return g;
  }

  /* ============================================================
     SPAWN
     ============================================================ */
  function addObj(type, lane, y) {
    var mesh, ud = { type: type, lane: lane };
    if (type === "block") {
      mesh = new T.Group();
      var b = new T.Mesh(inst.geo.block, inst.mat.block);
      var wf = new T.Mesh(inst.geo.blockWire, inst.mat.blockWire);
      mesh.add(b); mesh.add(wf);
      y = 0.9;
    } else if (type === "hurdle") {
      mesh = new T.Mesh(inst.geo.hurdle, inst.mat.hurdle);
      y = 0.25;
    } else if (type === "fil") {
      mesh = new T.Mesh(inst.geo.fil, inst.mat.fil);
      y = 0.75;
    } else if (type === "artifact") {
      var pid = ud.pid;
      mesh = makeArtifact(); ud.pid = mesh.userData.pid;
      y = 1.0;
    }
    mesh.position.set(LANES[lane], y, SPAWN_Z);
    mesh.userData = ud;
    inst.scene.add(mesh);
    inst.objs.push(mesh);
  }

  function makeArtifact() {
    var stock = window.PRODUCTS.filter(function (p) { return p.stock !== "out"; });
    var p = stock[Math.floor(Math.random() * stock.length)];
    if (!modelCache[p.id]) {
      var m = window.View3D.buildModel(p.id, 1.5);
      modelCache[p.id] = m || new T.Mesh(inst.geo.fil, inst.mat.fil);
    }
    var clone = modelCache[p.id].clone();
    clone.userData = { pid: p.id, name: p.name };
    return clone;
  }

  function generateRow() {
    var content = ["empty", "empty", "empty"];
    // 0 à 2 blocs (jamais 3 -> toujours franchissable)
    var blockCount = Math.random() < 0.28 ? 2 : (Math.random() < 0.55 ? 1 : 0);
    var lanes = [0, 1, 2].sort(function () { return Math.random() - 0.5; });
    for (var i = 0; i < blockCount; i++) content[lanes[i]] = "block";
    for (var l = 0; l < 3; l++) {
      if (content[l] !== "empty") continue;
      var r = Math.random();
      if (r < 0.22) content[l] = "fil";
      else if (r < 0.34) content[l] = "hurdle";
      else if (r < 0.40) content[l] = "artifact";
    }
    for (var k = 0; k < 3; k++) if (content[k] !== "empty") addObj(content[k], k);
  }

  /* ============================================================
     BOUCLE
     ============================================================ */
  function loop(t) {
    if (!inst || inst.paused) return;
    inst.raf = requestAnimationFrame(loop);
    var dt = Math.min(0.05, (t - inst.last) / 1000) || 0;
    inst.last = t;
    update(dt);
    inst.renderer.render(inst.scene, inst.cam);
  }

  function update(dt) {
    var p = inst;

    // vitesse selon le mode
    if (p.mode === "playing") {
      p.speed = Math.min(30, 11 + p.dist * 0.0009);
    } else if (p.mode === "over") {
      p.speed += (0 - p.speed) * Math.min(1, dt * 2);
    } else {
      p.speed = 8;
    }

    // scroll grille
    p.scroll += p.speed * dt;
    p.grid.position.z = p.scroll % 1;

    // animation buse (idle bob / bank)
    p.player.position.x += (p.targetX - p.player.position.x) * Math.min(1, dt * 12);
    p.player.rotation.z = (p.targetX - p.player.position.x) * -0.5;
    if (p.player.userData.tip) p.player.userData.tip.rotation.y += dt * 6;

    if (p.mode === "idle") {
      p.y = 0.15 + Math.sin(p.scroll * 1.2) * 0.12;
      p.player.position.y = p.y;
    } else {
      // saut / gravité
      p.vy += GRAVITY * dt;
      p.y += p.vy * dt;
      if (p.y <= 0) { p.y = 0; p.vy = 0; }
      p.player.position.y = p.y;
    }
    p.player.rotation.x = -p.vy * 0.02;

    // traînée de filament
    if (p.mode === "playing") {
      p._trailT = (p._trailT || 0) - dt;
      if (p._trailT <= 0) {
        p._trailT = 0.04;
        var cols = [0xff2bd6, 0x00f0ff, 0xc8ff00];
        var tm = new T.Mesh(p.geo.trail, new T.MeshBasicMaterial({
          color: cols[Math.floor(Math.random() * 3)], transparent: true, opacity: 0.85
        }));
        tm.position.set(p.player.position.x, 0.06, p.player.position.z + 0.3);
        p.scene.add(tm); p.trail.push(tm);
      }
    }
    for (var ti = p.trail.length - 1; ti >= 0; ti--) {
      var tr = p.trail[ti];
      tr.position.z += p.speed * dt;
      tr.material.opacity -= dt * 1.6;
      tr.scale.x = tr.scale.z = Math.max(0.05, tr.scale.x - dt * 1.2);
      if (tr.material.opacity <= 0 || tr.position.z > DESPAWN_Z) {
        p.scene.remove(tr); tr.material.dispose(); p.trail.splice(ti, 1);
      }
    }

    // effets (anneaux de collecte)
    for (var fi = p.fx.length - 1; fi >= 0; fi--) {
      var fx = p.fx[fi];
      fx.scale.multiplyScalar(1 + dt * 6);
      fx.material.opacity -= dt * 3;
      if (fx.material.opacity <= 0) { p.scene.remove(fx); fx.material.dispose(); p.fx.splice(fi, 1); }
    }

    // spawn + déplacement des objets
    if (p.mode === "playing") {
      p.spawnT -= dt;
      if (p.spawnT <= 0) {
        p.spawnT = Math.max(0.5, 11 / p.speed);
        generateRow();
      }
      p.score += p.speed * dt * 0.6;
      p.dist += p.speed * dt * 10;
      setText("gScore", Math.floor(p.score));
      setText("gDist", Math.floor(p.dist) + " mm");
    }

    if (p.inv > 0) {
      p.inv -= dt;
      p.blink += dt;
      p.player.visible = Math.floor(p.blink * 16) % 2 === 0;
      if (p.inv <= 0) p.player.visible = true;
    }

    for (var i = p.objs.length - 1; i >= 0; i--) {
      var o = p.objs[i];
      o.position.z += p.speed * dt;
      var ty = o.userData.type;
      if (ty === "fil" || ty === "artifact") o.rotation.y += dt * 2.2;
      // collision quand l'objet croise le joueur
      if (p.mode === "playing" && o.position.z > -0.8 && o.position.z < 0.9 && !o.userData.done) {
        if (o.userData.lane === p.lane) handleCollision(o, i);
      }
      if (o.position.z > DESPAWN_Z) { p.scene.remove(o); p.objs.splice(i, 1); }
    }

    // caméra suit légèrement + shake
    var shake = (!REDUCED && p.inv > 0) ? (Math.random() - 0.5) * 0.12 : 0;
    p.cam.position.x += (p.player.position.x * 0.35 + shake - p.cam.position.x) * Math.min(1, dt * 8);
  }

  function handleCollision(o, i) {
    var p = inst, ty = o.userData.type;
    if (ty === "fil") {
      o.userData.done = true;
      p.score += 25; popFx(o.position, 0x00f0ff); SFX.pick();
      p.scene.remove(o); p.objs.splice(i, 1);
    } else if (ty === "artifact") {
      o.userData.done = true;
      p.score += 150; popFx(o.position, 0xff2bd6); SFX.artifact();
      pickupLabel("+150 · " + o.userData.name);
      p.scene.remove(o); p.objs.splice(i, 1);
    } else if (ty === "hurdle") {
      if (p.y > 0.7) { o.userData.done = true; p.score += 15; }      // sauté
      else if (p.inv <= 0) damage();
    } else if (ty === "block") {
      if (p.inv <= 0) damage();
    }
  }

  function damage() {
    var p = inst;
    p.lives--; p.inv = 1.3; p.blink = 0;
    renderLives(); SFX.hit(); flash();
    if (p.lives <= 0) gameOver();
  }

  function popFx(pos, color) {
    var ring = new T.Mesh(inst.geo.ring, inst.mat.ring.clone());
    ring.material.color.setHex(color);
    ring.position.copy(pos); ring.rotation.x = Math.PI / 2;
    inst.scene.add(ring); inst.fx.push(ring);
  }

  /* ============================================================
     ÉTATS
     ============================================================ */
  function startGame() {
    if (!inst) return;                 // pas encore construit : on ignore
    initAudio();
    var p = inst;
    p.objs.forEach(function (o) { p.scene.remove(o); });
    p.trail.forEach(function (o) { p.scene.remove(o); });
    p.objs = []; p.trail = [];
    p.mode = "playing"; p.lane = 1; p.targetX = 0;
    p.y = 0; p.vy = 0; p.speed = 11; p.dist = 0; p.score = 0;
    p.lives = 3; p.inv = 0; p.spawnT = 0.8; p.player.visible = true;
    renderLives(); setText("gScore", "0"); setText("gDist", "0 mm");
    hideScreens();
  }

  function gameOver() {
    var p = inst;
    p.mode = "over"; SFX.over();
    if (p.score > p.best) { p.best = Math.floor(p.score); localStorage.setItem(BEST_KEY, p.best); }
    setText("gOverScore", Math.floor(p.score));
    setText("gOverBest", p.best);
    setText("gBest", p.best);
    showScreen("gOver");
  }

  /* ============================================================
     HUD / écrans
     ============================================================ */
  function setText(id, v) { var e = $(id); if (e) e.textContent = v; }
  function renderLives() {
    var e = $("gLives"); if (!e || !inst) return;
    var s = "";
    for (var i = 0; i < 3; i++) s += '<i class="g-life' + (i < inst.lives ? "" : " off") + '"></i>';
    e.innerHTML = s;
  }
  function showScreen(id) {
    ["gBoot", "gStart", "gOver", "gPauseScreen"].forEach(function (s) { var e = $(s); if (e) e.hidden = (s !== id); });
  }
  function showBoot(msg) {
    var m = $("gBootMsg"); if (m) m.textContent = msg;
    showScreen("gBoot");
  }
  function hideScreens() { showScreen(null); }
  var labelT = null;
  function pickupLabel(txt) {
    var e = $("gPickup"); if (!e) return;
    e.textContent = txt; e.classList.add("show");
    clearTimeout(labelT);
    labelT = setTimeout(function () { e.classList.remove("show"); }, 900);
  }
  function flash() {
    var e = $("gFlash"); if (!e) return;
    e.classList.remove("show"); void e.offsetWidth; e.classList.add("show");
  }
  function updateMuteBtn() {
    var e = $("gMute"); if (e) { e.textContent = muted ? "♪̸" : "♪"; e.setAttribute("aria-pressed", muted); }
  }

  /* ============================================================
     CONTRÔLES
     ============================================================ */
  function move(dir) {
    if (!inst || inst.mode !== "playing") return;
    if (dir === "left" && inst.lane > 0) inst.lane--;
    else if (dir === "right" && inst.lane < 2) inst.lane++;
    else if (dir === "jump" && inst.y <= 0.01) { inst.vy = JUMP_V; SFX.jump(); }
    inst.targetX = LANES[inst.lane];
  }

  function onKey(ev) {
    if (!inst || inst.paused) return;
    var tag = (ev.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    var win = $("win-game");
    if (!win || win.hidden) return;
    var k = ev.key;
    if (k === "ArrowLeft" || k === "a" || k === "A") { move("left"); ev.preventDefault(); }
    else if (k === "ArrowRight" || k === "d" || k === "D") { move("right"); ev.preventDefault(); }
    else if (k === "ArrowUp" || k === " " || k === "w" || k === "W") { move("jump"); ev.preventDefault(); }
    else if (k === "p" || k === "P") togglePause();
    else if (k === "m" || k === "M") toggleMute();
    else if ((k === "Enter") && inst.mode !== "playing") { inst.mode === "over" ? startGame() : startGame(); }
  }

  function togglePause() {
    if (!inst || inst.mode !== "playing") return;
    inst.userPaused = !inst.userPaused;
    if (inst.userPaused) { inst.mode = "paused"; showScreen("gPauseScreen"); }
    else { inst.mode = "playing"; hideScreens(); }
  }
  function toggleMute() {
    muted = !muted; localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    if (!muted) initAudio();
    updateMuteBtn();
  }

  var swipe = null;
  function bindControls() {
    document.addEventListener("keydown", onKey);

    // boutons écran
    var startBtn = $("gStartBtn"); if (startBtn) startBtn.onclick = startGame;
    var restart = $("gRestart"); if (restart) restart.onclick = startGame;
    var resume = $("gResume"); if (resume) resume.onclick = togglePause;
    var mute = $("gMute"); if (mute) mute.onclick = toggleMute;
    var pause = $("gPause"); if (pause) pause.onclick = togglePause;

    // boutons tactiles
    var ctr = $("gControls");
    if (ctr) ctr.addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-gmove]"); if (b) move(b.getAttribute("data-gmove"));
    });

    // swipe sur le stage
    var stage = inst.stage;
    stage.addEventListener("touchstart", function (ev) {
      var t = ev.changedTouches[0]; swipe = { x: t.clientX, y: t.clientY };
    }, { passive: true });
    stage.addEventListener("touchend", function (ev) {
      if (!swipe) return;
      var t = ev.changedTouches[0];
      var dx = t.clientX - swipe.x, dy = t.clientY - swipe.y;
      if (Math.abs(dx) > Math.abs(dy)) { if (Math.abs(dx) > 28) move(dx > 0 ? "right" : "left"); }
      else if (dy < -28) move("jump");
      swipe = null;
    }, { passive: true });
  }

  function resize() {
    if (!inst) return;
    var w = inst.stage.clientWidth, h = inst.stage.clientHeight;
    if (!w || !h) return;
    inst.renderer.setSize(w, h);
    inst.cam.aspect = w / h; inst.cam.updateProjectionMatrix();
  }

  /* ============================================================
     CYCLE DE VIE (lié aux fenêtres OS)
     ============================================================ */
  function teardown() {
    if (!inst) return;
    if (inst.raf) cancelAnimationFrame(inst.raf);
    document.removeEventListener("keydown", onKey);
    if (inst.ro) inst.ro.disconnect();
    inst.scene.traverse(function (o) {
      if (o.isMesh) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) { m.dispose && m.dispose(); });
      }
    });
    inst.renderer.dispose();
    inst.renderer.forceContextLoss && inst.renderer.forceContextLoss();
    inst.renderer.domElement.remove();
    inst = null;
  }

  window.NovaGame = {
    open: function (stage) {
      if (!stage) return;
      if (inst) { this.resume(); return; }
      showBoot("Initialisation du moteur 3D…");
      if (!window.View3D || !window.View3D.ready) {
        showBoot("Moteur 3D introuvable. Recharge la page (Ctrl+Maj+R).");
        return;
      }
      window.View3D.ready.then(function () {
        T = window.View3D.THREE;
        if (!T) { showBoot("Le moteur 3D n'a pas pu démarrer. Recharge la page (Ctrl+Maj+R)."); return; }
        if (!inst) build(stage);            // build() affiche l'écran START à la fin
      }).catch(function () {
        showBoot("3D indisponible sur ce navigateur. Essaie un navigateur à jour (Chrome, Firefox, Edge…).");
      });
    },
    pause: function () {
      if (inst && !inst.paused) { inst.paused = true; if (inst.raf) cancelAnimationFrame(inst.raf); }
    },
    resume: function () {
      if (inst && inst.paused) { inst.paused = false; inst.last = performance.now(); loop(inst.last); }
    },
    close: teardown
  };

  // pause auto quand l'onglet passe en arrière-plan
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) window.NovaGame.pause();
    else { var w = $("win-game"); if (w && !w.hidden) window.NovaGame.resume(); }
  });
})();
