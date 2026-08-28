-- À exécuter dans Supabase : SQL Editor > New query > coller tout > Run
-- Active les mises à jour en temps réel pour la table posts

alter publication supabase_realtime add table posts;
