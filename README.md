# À vivre — version GitHub / Render

Cette version est autonome : elle ne dépend pas de l’hébergement actuel. Elle garde l’espace personnel, la connexion automatique, le profil, la frise de vie, les objectifs, le glisser-déposer, les souvenirs photo/vidéo et l’installation PWA.

## Services nécessaires

- Une base PostgreSQL : Neon est un bon choix gratuit pour démarrer.
- Cloudinary pour conserver durablement les photos et vidéos.
- Resend uniquement pour le bouton « Mot de passe oublié ».

Les tables PostgreSQL sont créées automatiquement au premier lancement. Aucune commande de migration n’est nécessaire.

## Lancer sur son ordinateur

1. Copie `.env.example` en `.env.local`.
2. Renseigne au minimum `DATABASE_URL`.
3. Lance les commandes suivantes :

```bash
npm install
npm run dev
```

Puis ouvre `http://localhost:3000`.

Sans `CLOUDINARY_URL`, les fichiers sont gardés dans `public/uploads` : cela convient pour tester en local, mais pas pour Render car son disque peut être recréé à chaque déploiement.

## Déployer sur GitHub puis Render

1. Crée un nouveau dépôt GitHub privé, par exemple `a-vivre`.
2. Décompresse ce dossier à la racine du dépôt, puis envoie-le sur GitHub.
3. Sur Neon, crée une base Postgres et copie sa chaîne de connexion dans `DATABASE_URL`.
4. Sur Cloudinary, copie la valeur complète `CLOUDINARY_URL` dans les variables d’environnement de Render.
5. Sur Resend, vérifie un domaine d’envoi, puis ajoute `RESEND_API_KEY` et `EMAIL_FROM` dans Render. Sans ces deux variables, seule la récupération de mot de passe est désactivée ; la connexion normale reste fonctionnelle.
6. Sur Render, crée un « Web Service » depuis ton dépôt GitHub. Tu peux laisser Render lire `render.yaml` ou renseigner manuellement :

```text
Build command: npm install && npm run build
Start command: npm run start
```

7. Ajoute les variables `DATABASE_URL`, `CLOUDINARY_URL`, `RESEND_API_KEY` et `EMAIL_FROM`, puis déploie.

L’application devient ensuite installable depuis le navigateur mobile avec « Ajouter à l’écran d’accueil ».

## Données de la version actuelle

Cette version démarre avec sa propre base. Les comptes, objectifs et souvenirs de l’hébergement actuel ne sont pas recopiés automatiquement : ils sont dans une base et un stockage différents. Il faut faire une migration dédiée si tu veux récupérer les données existantes.

## Sécurité

- Les mots de passe sont chiffrés avec `scrypt`.
- Les sessions utilisent un cookie HTTP-only.
- La réinitialisation utilise un code e-mail valable 15 minutes.
- Les objectifs restent personnels dans cette première version indépendante.
