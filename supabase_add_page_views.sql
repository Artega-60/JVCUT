-- À exécuter dans Supabase : SQL Editor > New query > coller tout > Run
-- Table simple de comptage de visites (pas de cookies, pas de données personnelles)

create table if not exists page_views (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table page_views enable row level security;

grant usage on schema public to anon, authenticated;

-- Tout visiteur peut enregistrer une visite (mais ne peut pas les consulter)
grant insert on table page_views to anon, authenticated;
create policy "Anyone can log a visit"
  on page_views for insert
  with check (true);

-- Seul un admin connecté peut consulter les statistiques de visites
grant select on table page_views to authenticated;
create policy "Only admin can read visits"
  on page_views for select
  to authenticated
  using (true);
