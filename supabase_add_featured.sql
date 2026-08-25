-- À exécuter dans Supabase : SQL Editor > New query > coller tout > Run

alter table posts add column if not exists featured boolean not null default false;
