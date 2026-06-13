/* N0VA.OS — panier (localStorage) rendu dans la fenêtre PANIER.exe
   CONFIG : changer SHOP_EMAIL pour recevoir les commandes. */
(function () {
  "use strict";

  var SHOP_EMAIL = "hello@n0va.art";
  var FREE_SHIPPING_FROM = 49;
  var SHIPPING = 4.90;
  var KEY = "nova_cart_v1";

  var items = load();

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch (e) { return {}; }
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(items)); }
  function count() {
    return Object.keys(items).reduce(function (n, id) { return n + items[id]; }, 0);
  }
  function subtotal() {
    return Object.keys(items).reduce(function (s, id) {
      var p = window.PRODUCT_MAP[id];
      return p ? s + p.price * items[id] : s;
    }, 0);
  }

  /* ---------------- toast ---------------- */
  var toastEl, toastTimer;
  function injectToast() {
    toastEl = document.createElement("div");
    toastEl.className = "toast";
    toastEl.setAttribute("role", "status");
    toastEl.setAttribute("aria-live", "polite");
    document.body.appendChild(toastEl);
  }
  window.toast = function (msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 3200);
  };

  /* ---------------- rendu fenêtre panier ---------------- */
  function thumbFor(id) {
    var src = window.N0ZZLE_THUMBS && window.N0ZZLE_THUMBS[id];
    return src
      ? '<img src="' + src + '" alt="" class="ct-item__img">'
      : '<div class="ct-item__img ct-item__img--ph" aria-hidden="true"></div>';
  }

  function render() {
    var box = document.getElementById("cartItems");
    var foot = document.getElementById("cartFoot");
    if (!box || !foot) return;
    var ids = Object.keys(items);
    if (!ids.length) {
      box.innerHTML = '<p class="cart-empty">// panier vide<br>ouvre BOUTIQUE.exe et choisis une pièce</p>';
      foot.innerHTML = '<button class="btn btn--ghost" data-open="win-shop" style="width:100%">Ouvrir la boutique</button>';
      return;
    }
    box.innerHTML = ids.map(function (id) {
      var p = window.PRODUCT_MAP[id];
      if (!p) return "";
      return (
        '<div class="ct-item">' + thumbFor(id) +
          '<div class="ct-item__info">' +
            '<p class="ct-item__cat">' + p.sub + "</p>" +
            '<p class="ct-item__name">' + p.name + "</p>" +
            '<p class="ct-item__price">' + window.formatPrice(p.price) + "</p>" +
          "</div>" +
          '<div class="ct-item__ctrl">' +
            '<div class="qty qty--sm" role="group" aria-label="Quantité ' + p.name + '">' +
              '<button class="qty__btn" data-ct-minus="' + id + '" aria-label="Réduire">−</button>' +
              '<span class="qty__val">' + items[id] + "</span>" +
              '<button class="qty__btn" data-ct-plus="' + id + '" aria-label="Augmenter">+</button>' +
            "</div>" +
            '<button class="ct-item__rm" data-ct-remove="' + id + '" aria-label="Retirer ' + p.name + '">retirer</button>' +
          "</div>" +
        "</div>"
      );
    }).join("");

    var sub = subtotal();
    var ship = sub >= FREE_SHIPPING_FROM ? 0 : SHIPPING;
    var freeLeft = FREE_SHIPPING_FROM - sub;
    foot.innerHTML =
      (freeLeft > 0
        ? '<p class="cart-free">Plus que <strong>' + window.formatPrice(freeLeft) + "</strong> pour la livraison offerte</p>"
        : '<p class="cart-free cart-free--ok">✓ Livraison offerte</p>') +
      '<div class="cart-row"><span>Sous-total</span><span>' + window.formatPrice(sub) + "</span></div>" +
      '<div class="cart-row"><span>Livraison</span><span>' + (ship === 0 ? "Offerte" : window.formatPrice(ship)) + "</span></div>" +
      '<div class="cart-row cart-row--total"><span>Total</span><span>' + window.formatPrice(sub + ship) + "</span></div>" +
      '<button class="btn btn--primary" id="ctOrder" style="width:100%">Commander</button>' +
      '<button class="cart-clear" id="ctClear">vider le panier</button>' +
      '<p class="cart-note">// commande envoyée par e-mail — paiement par lien sécurisé à la confirmation</p>';
  }

  function changeQty(id, d) {
    if (!items[id]) return;
    items[id] = Math.min(9, Math.max(0, items[id] + d));
    if (items[id] === 0) delete items[id];
    save(); render(); updateBadges();
  }

  function checkout() {
    var lines = Object.keys(items).map(function (id) {
      var p = window.PRODUCT_MAP[id];
      return "- " + p.name + " (" + p.sub + ") × " + items[id] + " — " + window.formatPrice(p.price * items[id]);
    });
    var sub = subtotal();
    var ship = sub >= FREE_SHIPPING_FROM ? 0 : SHIPPING;
    var body =
      "Bonjour N0VA,%0D%0A%0D%0AJe souhaite commander :%0D%0A%0D%0A" +
      encodeURIComponent(lines.join("\n")) +
      "%0D%0A%0D%0ASous-total : " + encodeURIComponent(window.formatPrice(sub)) +
      "%0D%0ALivraison : " + encodeURIComponent(ship === 0 ? "Offerte" : window.formatPrice(ship)) +
      "%0D%0ATotal : " + encodeURIComponent(window.formatPrice(sub + ship)) +
      "%0D%0A%0D%0AAdresse de livraison :%0D%0A%0D%0A";
    if (window.NovaTrack) window.NovaTrack.event("checkout");
    window.location.href = "mailto:" + SHOP_EMAIL + "?subject=" +
      encodeURIComponent("Commande N0VA — " + count() + " article(s)") + "&body=" + body;
    window.toast("// récapitulatif ouvert dans ton e-mail");
  }

  function updateBadges() {
    var n = count();
    document.querySelectorAll(".cart-badge").forEach(function (b) {
      b.textContent = n;
      b.classList.toggle("zero", n === 0);
    });
  }

  /* ---------------- API ---------------- */
  window.N0VA_CART = {
    add: function (id, qty) {
      var p = window.PRODUCT_MAP[id];
      if (!p || p.stock === "out") return;
      items[id] = Math.min(9, (items[id] || 0) + (qty || 1));
      save(); render(); updateBadges();
      if (window.NovaTrack) window.NovaTrack.event("add", id);
      window.toast("// " + p.name + " ajouté au panier");
    }
  };

  function init() {
    injectToast();
    render();
    updateBadges();
    document.addEventListener("click", function (ev) {
      var t;
      if ((t = ev.target.closest("[data-add]"))) window.N0VA_CART.add(t.dataset.add, 1);
      else if ((t = ev.target.closest("[data-ct-minus]"))) changeQty(t.dataset.ctMinus, -1);
      else if ((t = ev.target.closest("[data-ct-plus]"))) changeQty(t.dataset.ctPlus, 1);
      else if ((t = ev.target.closest("[data-ct-remove]"))) { delete items[t.dataset.ctRemove]; save(); render(); updateBadges(); }
      else if (ev.target.closest("#ctClear")) { items = {}; save(); render(); updateBadges(); }
      else if (ev.target.closest("#ctOrder")) checkout();
    });
    document.addEventListener("nova:thumbs-ready", render);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
