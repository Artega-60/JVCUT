-- À exécuter dans Supabase : SQL Editor > New query > coller tout > Run
-- (à faire une seule fois, en plus du script supabase_setup.sql déjà exécuté)

-- Ajoute un compteur de réactions sur chaque news
alter table posts add column if not exists reactions integer not null default 0;

-- Fonction qui incrémente le compteur de façon sécurisée, sans donner
-- un accès en écriture complet à la table aux visiteurs anonymes.
-- "security definer" = la fonction s'exécute avec les droits du propriétaire
-- de la base, donc elle peut modifier "reactions" même si la policy RLS
-- de la table posts ne l'autorise pas pour un visiteur anonyme.
create or replace function increment_post_reaction(post_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  update posts
  set reactions = reactions + 1
  where id = post_id
  returning reactions into new_count;
  return new_count;
end;
$$;

-- Autorise tout le monde (y compris les visiteurs non connectés) à appeler
-- cette fonction précise — mais seulement elle, pas d'accès direct à la table.
grant execute on function increment_post_reaction(uuid) to anon, authenticated;
