-- À exécuter dans Supabase : SQL Editor > New query > coller tout > Run
-- Corrige l'erreur "permission denied for table posts"

grant usage on schema public to anon, authenticated;

-- Les visiteurs (anon) doivent pouvoir lire les news
grant select on table posts to anon, authenticated;

-- Seul un utilisateur connecté (authenticated) peut créer/modifier/supprimer
grant insert, update, delete on table posts to authenticated;
