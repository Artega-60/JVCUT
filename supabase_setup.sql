-- À exécuter dans Supabase : SQL Editor > New query > coller tout > Run

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  tag text not null,
  platforms text[] not null default '{}',
  source text default '',
  source_words integer,
  reactions integer not null default 0,
  created_at timestamptz not null default now()
);

alter table posts enable row level security;

-- Tout le monde peut lire les news (le site est public)
create policy "Public read access"
  on posts for select
  using (true);

-- Seul un utilisateur connecté (l'admin) peut créer une news
create policy "Authenticated insert"
  on posts for insert
  to authenticated
  with check (true);

-- Seul un utilisateur connecté peut modifier une news
create policy "Authenticated update"
  on posts for update
  to authenticated
  using (true);

-- Seul un utilisateur connecté peut supprimer une news
create policy "Authenticated delete"
  on posts for delete
  to authenticated
  using (true);

-- Fonction qui incrémente le compteur de réactions de façon sécurisée,
-- sans donner un accès en écriture complet à la table aux visiteurs anonymes.
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

grant execute on function increment_post_reaction(uuid) to anon, authenticated;

-- Quelques news de démonstration (facultatif, tu peux les supprimer depuis le site une fois connecté)
insert into posts (text, tag, platforms, source_words) values
  ('GTA VI repoussé à novembre 2027.', 'annonce', array['playstation','xbox','pc'], 1500),
  ('Nintendo Direct annoncé pour le 3 septembre, 20h.', 'sortie', array['nintendo'], 900),
  ('Patch 2.1 sur Baldur''s Gate 3 : correctifs multijoueur.', 'patch', array['pc','playstation','xbox'], 1200),
  ('PS5 Pro en promo à -30% ce week-end.', 'prix', array['playstation'], 600);
