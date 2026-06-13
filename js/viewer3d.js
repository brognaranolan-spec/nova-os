/* N0VA.OS — moteur 3D (Three.js via CDN, chargé dynamiquement)
   API publique :
     window.View3D.ready          -> Promise (Three chargé)
     window.View3D.thumbs()       -> génère les vignettes img[data-thumb3d]
     window.View3D.mount(id, el)  -> vue interactive, retourne {dispose()}
     window.N0ZZLE_THUMBS         -> cache des dataURL par produit */
(function () {
  "use strict";

  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var T = null, OrbitControls = null, RoomEnvironment = null;
  var loadPromise = null;
  window.N0ZZLE_THUMBS = {};

  function loadThree() {
    if (loadPromise) return loadPromise;
    loadPromise = Promise.all([
      import("three"),
      import("three/addons/controls/OrbitControls.js"),
      import("three/addons/environments/RoomEnvironment.js")
    ]).then(function (mods) {
      T = mods[0];
      OrbitControls = mods[1].OrbitControls;
      RoomEnvironment = mods[2].RoomEnvironment;
      return true;
    });
    return loadPromise;
  }

  function makeEnv(renderer) {
    var pmrem = new T.PMREMGenerator(renderer);
    var env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    return env;
  }

  /* ---------------- matériaux ---------------- */
  function matBody(c) { return new T.MeshStandardMaterial({ color: c, roughness: 0.38, metalness: 0.15, flatShading: true }); }
  function matChrome() { return new T.MeshStandardMaterial({ color: 0xe6e6f0, roughness: 0.08, metalness: 1.0 }); }
  function matGlow(c, i) { return new T.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: (i || 0.9), roughness: 0.4 }); }
  function matDark() { return new T.MeshStandardMaterial({ color: 0x14141c, roughness: 0.55, metalness: 0.25, flatShading: true }); }
  function matWire(c) { return new T.MeshBasicMaterial({ color: c, wireframe: true, transparent: true, opacity: 0.55 }); }
  function matGhost(c) { return new T.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.3, blending: T.AdditiveBlending, depthWrite: false }); }

  /* ---------------- géométrie ---------------- */
  function roundedRectShape(w, h, r) {
    var s = new T.Shape();
    var x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }

  function lighterBase(bodyMat) {
    var g = new T.Group();
    var shape = roundedRectShape(1.5, 0.8, 0.3);
    var geo = new T.ExtrudeGeometry(shape, { depth: 3.1, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2, steps: 1 });
    geo.center();
    var shell = new T.Mesh(geo, bodyMat);
    shell.rotation.x = -Math.PI / 2;
    g.add(shell);
    var head = new T.Mesh(new T.BoxGeometry(1.1, 0.55, 0.55), matChrome());
    head.position.y = 1.85; g.add(head);
    var wheel = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 0.5, 14), matDark());
    wheel.rotation.z = Math.PI / 2; wheel.position.set(0, 2.18, 0); g.add(wheel);
    var btn = new T.Mesh(new T.BoxGeometry(0.42, 0.18, 0.4), matGlow(0xff3355, 0.5));
    btn.position.set(0, 1.78, 0.42); g.add(btn);
    return g;
  }

  function pedestal(p) {
    var g = new T.Group();
    var base = new T.Mesh(new T.CylinderGeometry(1.15, 1.3, 0.28, 24), matDark());
    base.position.y = -1.7; g.add(base);
    var ring = new T.Mesh(new T.TorusGeometry(1.22, 0.025, 8, 40), matGlow(p.colors.accent, 1.2));
    ring.rotation.x = Math.PI / 2; ring.position.y = -1.56; g.add(ring);
    return g;
  }

  /* ---------------- générateurs ---------------- */
  var BUILDERS = {
    "case-facet": function (p) {
      var g = lighterBase(matBody(p.colors.body));
      for (var i = 0; i < 8; i++) {
        var f = new T.Mesh(new T.IcosahedronGeometry(0.16 + Math.random() * 0.1, 0),
          i % 3 === 0 ? matGlow(p.colors.accent, 0.7) : matBody(p.colors.body));
        f.position.set((Math.random() - 0.5) * 1.1, -1.3 + i * 0.36, 0.42 + Math.random() * 0.06);
        f.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
        g.add(f);
      }
      return g;
    },
    "case-circuit": function (p) {
      var g = lighterBase(matBody(p.colors.body));
      var glow = matGlow(p.colors.accent, 1.1);
      for (var i = 0; i < 4; i++) {
        var v = new T.Mesh(new T.BoxGeometry(0.05, 1.4 + Math.random(), 0.04), glow);
        v.position.set(-0.55 + i * 0.36, -0.5 + (i % 2) * 0.7, 0.45); g.add(v);
        var h = new T.Mesh(new T.BoxGeometry(0.5 + Math.random() * 0.5, 0.05, 0.04), glow);
        h.position.set(-0.25 + (i % 2) * 0.4, -1.1 + i * 0.62, 0.45); g.add(h);
      }
      for (var j = 0; j < 6; j++) {
        var node = new T.Mesh(new T.BoxGeometry(0.13, 0.13, 0.07), glow);
        node.position.set((Math.random() - 0.5) * 1.15, -1.25 + j * 0.5, 0.45); g.add(node);
      }
      return g;
    },
    "case-drip": function (p) {
      var g = lighterBase(matBody(p.colors.body));
      var glow = matGlow(p.colors.accent, 0.95);
      for (var i = 0; i < 7; i++) {
        var len = 0.5 + Math.random() * 1.6;
        var drip = new T.Mesh(new T.CylinderGeometry(0.07, 0.035, len, 6), glow);
        drip.position.set(-0.6 + i * 0.2, 1.45 - len / 2, 0.43); g.add(drip);
        var tip = new T.Mesh(new T.SphereGeometry(0.07, 8, 6), glow);
        tip.position.set(-0.6 + i * 0.2, 1.45 - len, 0.43); g.add(tip);
      }
      var top = new T.Mesh(new T.BoxGeometry(1.56, 0.22, 0.86), glow);
      top.position.y = 1.5; g.add(top);
      return g;
    },
    "case-chrome": function (p) {
      var g = lighterBase(matChrome());
      var ringGeo = new T.TorusGeometry(0.92, 0.05, 10, 40);
      [-0.45, 0.45].forEach(function (y) {
        var ring = new T.Mesh(ringGeo, matDark());
        ring.rotation.x = Math.PI / 2; ring.scale.set(1, 0.62, 1); ring.position.y = y;
        g.add(ring);
      });
      var heart = new T.Mesh(new T.OctahedronGeometry(0.26, 0), matGlow(p.colors.accent, 1.1));
      heart.position.set(0, 0, 0.5); heart.scale.set(1, 1.25, 0.6); g.add(heart);
      return g;
    },
    "case-hex": function (p) {
      var g = lighterBase(matBody(p.colors.body));
      var idx = 0;
      for (var row = 0; row < 5; row++) {
        for (var col = 0; col < 3; col++) {
          var hx = new T.Mesh(new T.CylinderGeometry(0.17, 0.17, 0.09, 6),
            idx % 3 === 0 ? matGlow(p.colors.accent, 0.9) : matDark());
          hx.rotation.x = Math.PI / 2;
          hx.position.set(-0.4 + col * 0.4 + (row % 2) * 0.2, -1.25 + row * 0.55, 0.45);
          g.add(hx); idx++;
        }
      }
      return g;
    },
    "case-wire": function (p) {
      var g = new T.Group();
      var shape = roundedRectShape(1.5, 0.8, 0.3);
      var geo = new T.ExtrudeGeometry(shape, { depth: 3.1, bevelEnabled: false, steps: 6, curveSegments: 5 });
      geo.center();
      var inner = new T.Mesh(geo, matDark());
      inner.rotation.x = -Math.PI / 2; inner.scale.set(0.82, 0.82, 0.97); g.add(inner);
      var wire = new T.Mesh(geo.clone(), matWire(p.colors.accent));
      wire.rotation.x = -Math.PI / 2; g.add(wire);
      var head = new T.Mesh(new T.BoxGeometry(1.1, 0.55, 0.55), matChrome());
      head.position.y = 1.85; g.add(head);
      var wheel = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 0.5, 14), matDark());
      wheel.rotation.z = Math.PI / 2; wheel.position.y = 2.18; g.add(wheel);
      return g;
    },
    "fig-mecha": function (p) {
      var g = new T.Group();
      var body = matBody(p.colors.body);
      var torso = new T.Mesh(new T.BoxGeometry(1.2, 1.3, 0.7), body); torso.position.y = 0.9; g.add(torso);
      var pelvis = new T.Mesh(new T.BoxGeometry(0.85, 0.4, 0.55), matDark()); pelvis.position.y = 0.05; g.add(pelvis);
      var head = new T.Mesh(new T.IcosahedronGeometry(0.34, 0), body); head.position.y = 1.95; g.add(head);
      var visor = new T.Mesh(new T.BoxGeometry(0.5, 0.12, 0.2), matGlow(p.colors.accent, 1.2));
      visor.position.set(0, 1.95, 0.26); g.add(visor);
      [-1, 1].forEach(function (s) {
        var sh = new T.Mesh(new T.BoxGeometry(0.45, 0.5, 0.6), matDark());
        sh.position.set(s * 0.85, 1.4, 0); sh.rotation.z = s * -0.12; g.add(sh);
        var arm = new T.Mesh(new T.BoxGeometry(0.26, 1.0, 0.3), body);
        arm.position.set(s * 0.95, 0.7, 0); g.add(arm);
        var leg = new T.Mesh(new T.BoxGeometry(0.34, 1.2, 0.42), body);
        leg.position.set(s * 0.3, -0.75, 0); g.add(leg);
        var foot = new T.Mesh(new T.BoxGeometry(0.4, 0.22, 0.62), matDark());
        foot.position.set(s * 0.3, -1.42, 0.08); g.add(foot);
      });
      var ant = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, 0.6, 6), matGlow(p.colors.accent, 1));
      ant.position.set(0.25, 2.45, 0); g.add(ant);
      var core = new T.Mesh(new T.OctahedronGeometry(0.16, 0), matGlow(p.colors.accent, 1.2));
      core.position.set(0, 1.0, 0.38); g.add(core);
      g.add(pedestal(p));
      return g;
    },
    "fig-runner": function (p) {
      var g = new T.Group();
      function runner(mat, off) {
        var r = new T.Group();
        var torso = new T.Mesh(new T.BoxGeometry(0.55, 0.95, 0.4), mat); torso.position.y = 1.0; torso.rotation.x = 0.28; r.add(torso);
        var head = new T.Mesh(new T.IcosahedronGeometry(0.24, 0), mat); head.position.set(0, 1.7, 0.18); r.add(head);
        var legF = new T.Mesh(new T.BoxGeometry(0.2, 1.1, 0.24), mat); legF.position.set(0.14, 0.15, 0.4); legF.rotation.x = -0.85; r.add(legF);
        var legB = new T.Mesh(new T.BoxGeometry(0.2, 1.1, 0.24), mat); legB.position.set(-0.14, 0.2, -0.45); legB.rotation.x = 0.95; r.add(legB);
        var armF = new T.Mesh(new T.BoxGeometry(0.16, 0.8, 0.2), mat); armF.position.set(-0.42, 1.05, 0.3); armF.rotation.x = -1.0; r.add(armF);
        var armB = new T.Mesh(new T.BoxGeometry(0.16, 0.8, 0.2), mat); armB.position.set(0.42, 1.05, -0.3); armB.rotation.x = 0.9; r.add(armB);
        r.position.x = off;
        return r;
      }
      g.add(runner(matGhost(0xff2bd6), -0.3));
      g.add(runner(matGhost(0x00f0ff), 0.3));
      g.add(runner(matBody(p.colors.body), 0));
      g.add(pedestal(p));
      return g;
    },
    "fig-totem": function (p) {
      var g = new T.Group();
      var glow = matGlow(p.colors.accent, 0.85);
      var body = matBody(p.colors.body);
      var axis = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 3.6, 8), matDark());
      axis.position.y = 0.6; g.add(axis);
      var cube = new T.Mesh(new T.BoxGeometry(1.0, 0.8, 1.0), body); cube.position.y = -0.5; cube.rotation.y = 0.4; g.add(cube);
      var octa = new T.Mesh(new T.OctahedronGeometry(0.62, 0), glow); octa.position.y = 0.45; g.add(octa);
      var cyl = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 0.55, 6), body); cyl.position.y = 1.3; cyl.rotation.y = 0.7; g.add(cyl);
      var ico = new T.Mesh(new T.IcosahedronGeometry(0.42, 0), glow); ico.position.y = 2.15; g.add(ico);
      g.add(pedestal(p));
      return g;
    },
    "fig-pup": function (p) {
      var g = new T.Group();
      var body = matBody(p.colors.body);
      var acc = matGlow(p.colors.accent, 0.8);
      var trunk = new T.Mesh(new T.BoxGeometry(1.5, 0.75, 0.65), body); trunk.position.y = 0.45; g.add(trunk);
      var head = new T.Mesh(new T.BoxGeometry(0.62, 0.62, 0.62), body); head.position.set(0.95, 1.0, 0); head.rotation.z = -0.08; g.add(head);
      var muzzle = new T.Mesh(new T.BoxGeometry(0.3, 0.26, 0.34), matDark()); muzzle.position.set(1.32, 0.88, 0); g.add(muzzle);
      [-1, 1].forEach(function (s) {
        var ear = new T.Mesh(new T.ConeGeometry(0.14, 0.4, 4), acc);
        ear.position.set(0.85, 1.45, s * 0.2); g.add(ear);
        var legF = new T.Mesh(new T.BoxGeometry(0.18, 0.6, 0.18), body); legF.position.set(0.55, -0.15, s * 0.2); g.add(legF);
        var legB = new T.Mesh(new T.BoxGeometry(0.18, 0.6, 0.18), body); legB.position.set(-0.55, -0.15, s * 0.2); g.add(legB);
        var eye = new T.Mesh(new T.BoxGeometry(0.06, 0.1, 0.1), matDark()); eye.position.set(1.27, 1.12, s * 0.16); g.add(eye);
      });
      var tail = new T.Mesh(new T.BoxGeometry(0.5, 0.14, 0.14), acc);
      tail.position.set(-0.9, 0.8, 0); tail.rotation.z = 0.7; g.add(tail);
      g.add(pedestal(p));
      return g;
    },
    "fig-idol": function (p) {
      var g = new T.Group();
      var marble = new T.MeshStandardMaterial({ color: p.colors.body, roughness: 0.5, metalness: 0.05, flatShading: true });
      var slices = 7;
      for (var i = 0; i < slices; i++) {
        var t = i / (slices - 1);
        var w = 1.35 - t * 0.65;
        var slice = new T.Mesh(new T.CylinderGeometry(w * 0.42, w * 0.5, 0.3, 9), marble);
        var off = (i === 2 || i === 5) ? 0.18 : 0;
        slice.position.set(off, -0.6 + i * 0.31, 0);
        if (off) slice.material = matGlow(p.colors.accent, 0.35);
        g.add(slice);
      }
      var head = new T.Mesh(new T.IcosahedronGeometry(0.45, 1), marble); head.position.y = 1.75; g.add(head);
      var slit = new T.Mesh(new T.BoxGeometry(0.9, 0.06, 0.5), matGlow(0x00f0ff, 1.1));
      slit.position.set(0.1, 1.75, 0); g.add(slit);
      g.add(pedestal(p));
      return g;
    },
    "fig-cube": function (p) {
      var g = new T.Group();
      var core = new T.Mesh(new T.BoxGeometry(1.4, 1.4, 1.4), matDark());
      core.position.y = 0.7; g.add(core);
      var wire = new T.Mesh(new T.BoxGeometry(1.42, 1.42, 1.42), matWire(p.colors.accent));
      wire.position.y = 0.7; g.add(wire);
      for (var i = 0; i < 8; i++) {
        var s = 0.16 + Math.random() * 0.2;
        var frag = new T.Mesh(new T.BoxGeometry(s, s, s),
          i % 2 ? matGlow(p.colors.accent, 0.85) : matDark());
        var a = Math.random() * Math.PI * 2, r = 1.1 + Math.random() * 0.55;
        frag.position.set(Math.cos(a) * r, 0.9 + (Math.random() - 0.4) * 1.4, Math.sin(a) * r);
        frag.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2);
        g.add(frag);
      }
      g.add(pedestal(p));
      return g;
    }
  };

  /* ---------------- scène ---------------- */
  function buildScene(p) {
    var scene = new T.Scene();
    var model = BUILDERS[p.model](p);
    var box = new T.Box3().setFromObject(model);
    var size = box.getSize(new T.Vector3());
    var maxDim = Math.max(size.x, size.y, size.z);
    model.scale.setScalar(3.4 / maxDim);
    box.setFromObject(model);
    var center = box.getCenter(new T.Vector3());
    model.position.sub(center);
    var pivot = new T.Group();
    pivot.add(model);
    scene.add(pivot);

    scene.add(new T.AmbientLight(0x9090b8, 0.55));
    var key = new T.DirectionalLight(0xffffff, 1.6); key.position.set(3, 5, 4); scene.add(key);
    var rim = new T.DirectionalLight(0x8888ff, 0.5); rim.position.set(-2, 3, -4); scene.add(rim);
    var pm = new T.PointLight(0xff2bd6, 30, 0, 2); pm.position.set(-3.2, 1.5, 2.6); scene.add(pm);
    var pc = new T.PointLight(0x00f0ff, 30, 0, 2); pc.position.set(3.2, -0.8, 2.6); scene.add(pc);
    return { scene: scene, pivot: pivot };
  }

  function makeCamera(aspect) {
    var cam = new T.PerspectiveCamera(35, aspect, 0.1, 60);
    cam.position.set(0, 0.6, 7.2);
    cam.lookAt(0, 0, 0);
    return cam;
  }

  function disposeScene(scene) {
    scene.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) { m.dispose(); });
      }
    });
  }

  /* ---------------- vignettes ---------------- */
  function generateThumbs() {
    var imgs = document.querySelectorAll("img[data-thumb3d]:not([src])");
    if (!imgs.length) return;
    var renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(480, 480);
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    var env = makeEnv(renderer);
    var cam = makeCamera(1);
    imgs.forEach(function (img) {
      var id = img.getAttribute("data-thumb3d");
      var p = window.PRODUCT_MAP[id];
      if (!p) return;
      if (!window.N0ZZLE_THUMBS[id]) {
        var built = buildScene(p);
        built.scene.environment = env;
        built.scene.environmentIntensity = 0.5;
        built.pivot.rotation.y = -0.55;
        built.pivot.rotation.x = 0.07;
        renderer.render(built.scene, cam);
        window.N0ZZLE_THUMBS[id] = renderer.domElement.toDataURL("image/png");
        disposeScene(built.scene);
      }
      img.src = window.N0ZZLE_THUMBS[id];
      var vis = img.closest(".pcard__visual, .file__icon");
      if (vis) vis.classList.add("ready");
    });
    renderer.dispose();
    renderer.forceContextLoss && renderer.forceContextLoss();
    document.dispatchEvent(new CustomEvent("nova:thumbs-ready"));
  }

  /* ---------------- vue interactive ---------------- */
  function mount(id, host) {
    var p = window.PRODUCT_MAP[id];
    if (!p || !T) return null;
    host.innerHTML = "";
    var size = Math.min(host.clientWidth || 380, 520);
    var renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    host.appendChild(renderer.domElement);
    var built = buildScene(p);
    built.scene.environment = makeEnv(renderer);
    built.scene.environmentIntensity = 0.5;
    var cam = makeCamera(1);
    var controls = new OrbitControls(cam, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 4.5;
    controls.maxDistance = 11;
    controls.autoRotate = !REDUCED;
    controls.autoRotateSpeed = 2.2;
    var raf = null;
    function loop() {
      raf = requestAnimationFrame(loop);
      controls.update();
      renderer.render(built.scene, cam);
    }
    loop();
    return {
      dispose: function () {
        if (raf) cancelAnimationFrame(raf);
        disposeScene(built.scene);
        controls.dispose();
        renderer.dispose();
        renderer.forceContextLoss && renderer.forceContextLoss();
        renderer.domElement.remove();
      }
    };
  }

  /* ---------------- modèle nu (réutilisé par le jeu) ---------------- */
  function buildModel(id, target) {
    var p = window.PRODUCT_MAP[id];
    if (!p || !T || !BUILDERS[p.model]) return null;
    var model = BUILDERS[p.model](p);
    var box = new T.Box3().setFromObject(model);
    var size = box.getSize(new T.Vector3());
    var maxDim = Math.max(size.x, size.y, size.z) || 1;
    model.scale.setScalar((target || 1.6) / maxDim);
    box.setFromObject(model);
    model.position.sub(box.getCenter(new T.Vector3()));
    return model;
  }

  /* ---------------- API ---------------- */
  window.View3D = {
    ready: null,
    THREE: null,
    thumbs: function () { return loadThree().then(generateThumbs); },
    mount: function (id, host) { return mount(id, host); },
    buildModel: buildModel
  };

  window.View3D.ready = loadThree().then(function () {
    window.View3D.THREE = T;
    return true;
  }).catch(function (err) {
    console.warn("3D indisponible :", err);
    document.body.classList.add("no3d");
    throw err;
  });
})();
