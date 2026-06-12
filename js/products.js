/* N0VA.OS — catalogue produits
   model = clé du générateur 3D dans viewer3d.js */
window.PRODUCTS = [
  /* ------------ COQUES DE BRIQUETS ------------ */
  {
    id: "razor-pink", name: "RAZOR PINK",
    cat: "coque", sub: "Coque briquet — BIC J6 maxi",
    price: 14.90, stock: "in", badge: "Best-seller",
    model: "case-facet", colors: { body: 0xff2bd6, accent: 0x8b2bff },
    desc: "Facettes taillées main, finition satinée.",
    long: "La coque qui a lancé l'atelier. Ses facettes accrochent la lumière comme un cristal corrompu. Poncée à la main puis vernie satin, elle glisse dans la poche sans accrocher le tissu.",
    specs: { "Matériau": "PLA recyclé + vernis satin", "Compatibilité": "BIC J6 maxi", "Dimensions": "85 × 28 × 16 mm", "Poids": "11 g", "Délai": "Expédié sous 72 h" }
  },
  {
    id: "data-stream", name: "DATA STREAM",
    cat: "coque", sub: "Coque briquet — BIC J6 maxi",
    price: 14.90, stock: "in", badge: null,
    model: "case-circuit", colors: { body: 0x0e6e7c, accent: 0x00f0ff },
    desc: "Pistes de circuit en relief, nœuds phosphorescents.",
    long: "Un PCB que tu peux allumer. Les pistes sont imprimées en surépaisseur de 0,6 mm puis les nœuds sont peints avec un acrylique phosphorescent : il se charge à la lumière et veille dans le noir.",
    specs: { "Matériau": "PLA recyclé + phosphorescent", "Compatibilité": "BIC J6 maxi", "Dimensions": "85 × 28 × 16 mm", "Poids": "12 g", "Délai": "Expédié sous 72 h" }
  },
  {
    id: "chrome-heart", name: "CHROME HEART",
    cat: "coque", sub: "Coque briquet — BIC J6 maxi",
    price: 16.90, stock: "in", badge: "Édition Y2K",
    model: "case-chrome", colors: { body: 0xd8d8e2, accent: 0xff2bd6 },
    desc: "Chrome miroir, double anneau, cœur néon serti.",
    long: "Nostalgie 2002. Trois couches de laque chrome polies au tampon, deux anneaux gravés et un cœur magenta serti au centre. La pièce la plus longue à finir de tout l'atelier : 40 minutes de polissage par coque.",
    specs: { "Matériau": "PLA + laque chrome polie", "Compatibilité": "BIC J6 maxi", "Dimensions": "85 × 28 × 16 mm", "Poids": "13 g", "Délai": "Expédié sous 72 h" }
  },
  {
    id: "hexgrid", name: "HEXGRID",
    cat: "coque", sub: "Coque briquet — BIC J6 maxi",
    price: 14.90, stock: "in", badge: null,
    model: "case-hex", colors: { body: 0x5d34d0, accent: 0x00f0ff },
    desc: "Nid d'abeille en relief, grip maximal.",
    long: "Pensée pour les mains qui font tomber les briquets. Les alvéoles hexagonales offrent un grip franc, et une alvéole sur trois est peinte en cyan pour casser la géométrie. Increvable.",
    specs: { "Matériau": "PLA recyclé haute densité", "Compatibilité": "BIC J6 maxi", "Dimensions": "85 × 29 × 17 mm", "Poids": "12 g", "Délai": "Expédié sous 72 h" }
  },
  {
    id: "wireframe", name: "WIREFRAME",
    cat: "coque", sub: "Coque briquet — BIC J25 mini",
    price: 12.50, stock: "in", badge: null,
    model: "case-wire", colors: { body: 0x14141c, accent: 0x00f0ff },
    desc: "Exosquelette ajouré, briquet visible en transparence.",
    long: "Le briquet reste visible à travers la maille imprimée — comme un modèle 3D pas encore texturé qui aurait fui dans le monde réel. Ultra légère : 6 grammes.",
    specs: { "Matériau": "PLA recyclé noir", "Compatibilité": "BIC J25 mini", "Dimensions": "72 × 25 × 14 mm", "Poids": "6 g", "Délai": "Expédié sous 72 h" }
  },

  /* ------------ FIGURINES ------------ */
  {
    id: "sentinel-v2", name: "SENTINEL v2",
    cat: "figurine", sub: "Figurine — 14 cm",
    price: 44.00, stock: "in", badge: "Pièce signée",
    model: "fig-mecha", colors: { body: 0x565d6e, accent: 0x00f0ff },
    desc: "Mécha low-poly, 9 pièces peintes à la main.",
    long: "Le gardien de l'atelier. Neuf pièces imprimées séparément, ajustées, collées, puis peintes : armure gunmetal, visière cyan, vernis mat. Chaque exemplaire est signé et numéroté sous le socle.",
    specs: { "Matériau": "PLA + acrylique", "Hauteur": "14 cm (socle inclus)", "Pièces": "9 éléments assemblés", "Poids": "85 g", "Délai": "Expédié sous 5 jours" }
  },
  {
    id: "ghost-runner", name: "GHOST RUNNER",
    cat: "figurine", sub: "Figurine — 10 cm",
    price: 29.00, stock: "in", badge: null,
    model: "fig-runner", colors: { body: 0xe8e8f0, accent: 0xff2bd6 },
    desc: "Sprint figé, double écho magenta/cyan.",
    long: "Un sprint figé dans le plastique. Le corps principal est blanc mat, encadré par deux échos translucides magenta et cyan imprimés séparément — l'aberration chromatique, mais en volume.",
    specs: { "Matériau": "PLA blanc + PETG translucide", "Hauteur": "10 cm (socle inclus)", "Pièces": "3 éléments", "Poids": "55 g", "Délai": "Expédié sous 5 jours" }
  },
  {
    id: "totem-404", name: "TOTEM 404",
    cat: "figurine", sub: "Sculpture — 18 cm",
    price: 52.00, stock: "pre", badge: "Précommande",
    model: "fig-totem", colors: { body: 0x5d34d0, accent: 0xc8ff00 },
    desc: "Sculpture modulaire, 4 modules orientables.",
    long: "Quatre modules géométriques empilés sur un axe central, chacun orientable à la main. Recompose ton totem chaque semaine. Drop d'avril — les précommandes partent en premier.",
    specs: { "Matériau": "PLA recyclé violet + acide", "Hauteur": "18 cm assemblé", "Pièces": "4 modules + axe + socle", "Poids": "140 g", "Délai": "Précommande — expédition avril" }
  },
  {
    id: "pixel-pup", name: "PIXEL PUP",
    cat: "figurine", sub: "Figurine — 8 cm",
    price: 24.00, stock: "in", badge: null,
    model: "fig-pup", colors: { body: 0xc8ff00, accent: 0xff2bd6 },
    desc: "Chien low-poly de bureau, regard 8-bit.",
    long: "Le chien de garde de ton bureau. Volontairement anguleux, volontairement acide. Sa tête est orientable et ses oreilles magenta sont imprimées à part puis clipsées. Adopte-le.",
    specs: { "Matériau": "PLA recyclé", "Hauteur": "8 cm", "Pièces": "3 éléments clipsés", "Poids": "40 g", "Délai": "Expédié sous 72 h" }
  },
  {
    id: "null-idol", name: "NULL IDOL",
    cat: "figurine", sub: "Buste — 12 cm",
    price: 39.00, stock: "in", badge: "Série 20 ex.",
    model: "fig-idol", colors: { body: 0xe8e8f0, accent: 0xff2bd6 },
    desc: "Buste antique glitché, tranches décalées.",
    long: "Une statue antique passée dans un mauvais câble HDMI. Le buste est tranché numériquement puis réassemblé avec des décalages — l'erreur est dans le fichier, pas dans l'impression. Série limitée à 20 exemplaires.",
    specs: { "Matériau": "PLA effet marbre", "Hauteur": "12 cm", "Pièces": "Monobloc + socle", "Poids": "95 g", "Délai": "Expédié sous 5 jours" }
  },
  {
    id: "corrupt-cube", name: "CORRUPT CUBE",
    cat: "figurine", sub: "Objet — 6 cm",
    price: 19.00, stock: "in", badge: null,
    model: "fig-cube", colors: { body: 0x14141c, accent: 0xff2bd6 },
    desc: "Cube en désintégration, fragments en lévitation.",
    long: "Un cube parfaitement normal, sauf que ses angles sont en train de se détacher. Les fragments sont maintenus par des tiges quasi invisibles : posé sur une étagère, il a l'air figé en pleine explosion.",
    specs: { "Matériau": "PLA noir mat + tiges acier", "Dimensions": "6 × 6 × 6 cm (10 cm déployé)", "Pièces": "8 fragments fixes", "Poids": "60 g", "Délai": "Expédié sous 72 h" }
  },

  /* ------------ ARCHIVES (corbeille) ------------ */
  {
    id: "acid-rain", name: "ACID RAIN",
    cat: "coque", sub: "Coque briquet — BIC J25 mini",
    price: 12.50, stock: "out", badge: "Archivé",
    model: "case-drip", colors: { body: 0x4a5a10, accent: 0xc8ff00 },
    desc: "Coulures acides. Série de 30 ex. — épuisée.",
    long: "Trente exemplaires, pas un de plus. Les coulures étaient imprimées en double extrusion puis rehaussées au pinceau. Le fichier 3D a été archivé : cette série ne reviendra jamais.",
    specs: { "Matériau": "PLA recyclé bi-couleur", "Compatibilité": "BIC J25 mini", "Dimensions": "72 × 25 × 14 mm", "Poids": "9 g", "Statut": "Série archivée — épuisée" },
    archived: true
  }
];

window.PRODUCT_MAP = {};
window.PRODUCTS.forEach(function (p) { window.PRODUCT_MAP[p.id] = p; });

window.formatPrice = function (n) {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
};
