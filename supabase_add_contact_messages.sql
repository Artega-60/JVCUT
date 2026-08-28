-- À exécuter dans Supabase : SQL Editor > New query > coller tout > Run

create table if not exists contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table contact_messages enable row level security;

grant usage on schema public to anon, authenticated;

-- Tout visiteur peut envoyer un message (mais ne peut pas les consulter)
grant insert on table contact_messages to anon, authenticated;
create policy "Anyone can send a message"
  on contact_messages for insert
  with check (true);

-- Seul un admin connecté peut lire, marquer comme lu, ou supprimer les messages
grant select, update, delete on table contact_messages to authenticated;
create policy "Only admin can read messages"
  on contact_messages for select
  to authenticated
  using (true);
create policy "Only admin can update messages"
  on contact_messages for update
  to authenticated
  using (true);
create policy "Only admin can delete messages"
  on contact_messages for delete
  to authenticated
  using (true);
