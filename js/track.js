/* N0VA.OS — tracking léger, respectueux de la vie privée.
   Stocke les événements dans localStorage (même origine => lisible par admin.html).
   Aucune donnée envoyée à des tiers par défaut.
   Pour des chiffres agrégés multi-visiteurs : renseigner ENDPOINT (voir README admin). */
(function () {
  "use strict";
  var KEY = "nova_analytics_v1";
  var ENDPOINT = null;   // ex: "https://votre-endpoint/collect" (POST) — désactivé par défaut

  function today() { return new Date().toISOString().slice(0, 10); }

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; }
  }
  function blank() {
    return { since: today(), totals: { view: 0, open: 0, add: 0, checkout: 0 },
             daily: {}, products: {}, sessions: 0 };
  }
  function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }

  var data = load() || blank();

  function bump(path) {
    var d = today();
    data.daily[d] = data.daily[d] || { view: 0, open: 0, add: 0, checkout: 0 };
    if (data.totals[path] != null) { data.totals[path]++; data.daily[d][path]++; }
  }

  window.NovaTrack = {
    event: function (type, productId) {
      bump(type);
      if (productId) {
        data.products[productId] = data.products[productId] || { open: 0, add: 0 };
        if (data.products[productId][type] != null) data.products[productId][type]++;
      }
      save(data);
      if (ENDPOINT) {
        try {
          navigator.sendBeacon
            ? navigator.sendBeacon(ENDPOINT, JSON.stringify({ type: type, p: productId || null, t: Date.now() }))
            : fetch(ENDPOINT, { method: "POST", body: JSON.stringify({ type: type, p: productId || null }), keepalive: true });
        } catch (e) {}
      }
    },
    data: function () { return data; },
    reset: function () { data = blank(); save(data); }
  };

  // pageview + session (une session = 1 par 30 min)
  var last = +(localStorage.getItem("nova_last_visit") || 0);
  if (Date.now() - last > 30 * 60 * 1000) { data.sessions++; }
  localStorage.setItem("nova_last_visit", String(Date.now()));
  window.NovaTrack.event("view");
})();
