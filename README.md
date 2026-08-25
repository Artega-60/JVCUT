# JvCut

Actu jeux vidéo en 10 mots. Projet Next.js connecté à Supabase (base de données + authentification admin).

## 1. Mettre en place la base de données

Dans ton projet Supabase : **SQL Editor** → **New query** → colle tout le contenu du fichier
`supabase_setup.sql` de ce dossier → **Run**.

Ça crée la table `posts` et les règles de sécurité (RLS) : tout le monde peut lire les news,
seul un utilisateur connecté peut en créer/modifier/supprimer.

## 2. Créer ton compte admin

Dans Supabase : **Authentication** → **Users** → **Add user** → renseigne ton email et un mot
de passe. C'est ce compte qui te servira à te connecter sur le site (bouton cadenas en haut à
droite du logo) pour publier des news.

Ne laisse pas l'inscription publique ouverte : ce compte doit être créé uniquement depuis le
tableau de bord Supabase, jamais depuis le site.

## 3. Variables d'environnement

Le site a besoin de deux informations pour se connecter à Supabase (Settings → API dans ton
projet Supabase) :

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

En local, mets-les dans un fichier `.env.local` à la racine (non fourni ici, à créer toi-même) :

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Sur Vercel, ajoute-les dans **Project Settings → Environment Variables**.

## 4. Développement local

```
npm install
npm run dev
```

## 5. Déploiement sur Vercel

1. Mets ce dossier sur GitHub (nouveau repository, upload des fichiers).
2. Sur vercel.com : **Add New → Project**, importe le repository GitHub.
3. Ajoute les deux variables d'environnement (étape 3 ci-dessus).
4. Déploie.
