# N0VA.OS — site-bureau d'une artiste 3D

Site e-commerce au format original : un **système d'exploitation rétro-fictif**.
Le visiteur atterrit sur un bureau glitché, ouvre des fenêtres draggables
(boutique, bio, atelier, terminal, corbeille…), et chaque produit se visualise
en **3D interactive** (modèles procéduraux Three.js, aucune image à héberger).

**Zéro build, zéro dépendance à installer** : HTML/CSS/JS vanilla + Three.js via CDN.

## Le concept

| Élément du bureau | Rôle |
|---|---|
| `MOI.txt` | Bio de l'artiste (s'ouvre au démarrage) |
| `BOUTIQUE.exe` | Catalogue façon explorateur de fichiers — les produits sont des `.obj` |
| Fiche produit | Visionneuse 3D orbitable + specs + ajout panier |
| `PANIER.exe` | Panier persistant (localStorage), livraison offerte dès 49 €, commande par e-mail |
| `ATELIER.sys` | Processus de fabrication en 4 étapes |
| `CONTACT.exe` | Formulaire (mailto) + newsletter |
| `TERMINAL` | Easter egg : `help`, `ls`, `drops`, `glitch`, `nova`, `open <fenêtre>` |
| `GAME.exe` | **PRINT.RUN** — endless-runner 3D : pilote la buse sur la grille synthwave, récupère le filament et les vraies pièces du catalogue (en 3D), esquive la corruption. Score + record (localStorage), vies, difficulté croissante, son rétro, clavier + tactile |
| `CORBEILLE` | Les séries épuisées, archivées pour toujours |
| Taskbar | Menu démarrer, fenêtres ouvertes, panier, horloge live |

Mobile : les fenêtres passent en plein écran, les icônes en grille.
Boot BIOS au premier chargement (sautée ensuite, et si `prefers-reduced-motion`).

## Structure

```
nova-os-site/
├── index.html        Tout le bureau (fenêtres incluses)
├── 404.html          Page d'erreur
├── css/os.css        Design system OS (dark cyberpunk)
├── js/products.js    ⭐ Données produits (prix, stocks, descriptions)
├── js/os.js          Window manager, terminal, boot, taskbar
├── js/cart.js        ⭐ Panier + checkout e-mail
├── js/viewer3d.js    Moteur 3D (modèles procéduraux, vignettes, viewer)
└── server.ps1        Serveur de dev local — NE PAS déployer
```

## Avant mise en ligne

1. **E-mail de commande** : `js/cart.js` ligne ~6 (`hello@n0va.art`) + `js/os.js` (formulaire contact) + `index.html` (lien contact).
2. **Produits** : tout dans `js/products.js` — prix, stocks (`in`/`out`/`pre`), textes.
   `archived: true` envoie une pièce à la corbeille.
3. **Réseaux** : remplacer les liens Instagram/TikTok dans `index.html`.
4. **Newsletter** : brancher Formspree/Brevo dans `js/os.js` (commentaire dans le code).

## Déploiement

- **Netlify** : glisser le dossier sur app.netlify.com/drop (404.html auto-géré).
- **Vercel / Cloudflare Pages / GitHub Pages** : import direct, aucun build.

## Dev local

```powershell
powershell -File server.ps1   # http://localhost:8378
```
