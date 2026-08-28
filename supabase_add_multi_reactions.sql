-- À exécuter dans Supabase : SQL Editor > New query > coller tout > Run
-- Fait évoluer le compteur de réactions unique vers plusieurs types (🔥 😡 😂 🎉)

-- Nouvelle colonne : un objet JSON qui stocke un compteur par type de réaction
-- ex: {"fire": 5, "angry": 1, "laugh": 3, "party": 0}
alter table posts add column if not exists reaction_counts jsonb not null default '{}'::jsonb;

-- Reprend les anciennes réactions "flamme" dans le nouveau format, sans les perdre
update posts
set reaction_counts = jsonb_build_object('fire', reactions)
where reactions > 0 and (reaction_counts = '{}'::jsonb or reaction_counts is null);

-- Nouvelle fonction : incrémente un type de réaction précis, de façon sécurisée
create or replace function increment_post_reaction(post_id uuid, reaction_type text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_counts jsonb;
begin
  update posts
  set reaction_counts = jsonb_set(
    coalesce(reaction_counts, '{}'::jsonb),
    array[reaction_type],
    to_jsonb(coalesce((reaction_counts->>reaction_type)::integer, 0) + 1)
  )
  where id = post_id
  returning reaction_counts into new_counts;
  return new_counts;
end;
$$;

grant execute on function increment_post_reaction(uuid, text) to anon, authenticated;
