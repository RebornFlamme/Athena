-- 0003_simulation_appels.sql — Créateur de simulation (Phase F2)
--
-- Un MP3 = un « appel » (une communication). L'ensemble des appels agencés
-- sur la timeline constitue la simulation active. La pipeline de traitement
-- (transcription STT → extraction LLM → entités) viendra ensuite (F1.b/F1.c) :
-- pour l'instant on stocke le média + son instant de déclenchement.
--
-- Additive : ne touche pas aux tables 0002 (interventions/evenements/entites).

-- 1) Le média + son placement sur la timeline de montage.
create table appels (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  audio_url text not null,                       -- URL publique du MP3 (Supabase Storage)
  audio_path text,                               -- chemin interne dans le bucket (pour suppression)
  ts_debut_ms integer not null default 0,        -- instant de déclenchement depuis t0 de la simulation
  duree_ms integer not null default 0,           -- durée du clip (lue côté client à l'upload)
  piste integer not null default 0,              -- ligne/track dans la timeline (permet l'overlap)
  cree_le timestamptz not null default now()
);

create index idx_appels_ts_debut on appels (ts_debut_ms);

-- Temps réel : le créateur et le contrôle de lecture se resynchronisent.
alter publication supabase_realtime add table appels;

-- RLS permissive (cohérent avec le reste — pas d'auth pour l'instant).
alter table appels enable row level security;
create policy appels_select on appels for select using (true);
create policy appels_insert on appels for insert with check (true);
create policy appels_update on appels for update using (true) with check (true);
create policy appels_delete on appels for delete using (true);

-- 2) Bucket de stockage des MP3 (public en lecture).
insert into storage.buckets (id, name, public)
values ('appels-audio', 'appels-audio', true)
on conflict (id) do nothing;

-- Policies Storage : lecture publique, upload/suppression ouverts (accès anon,
-- comme le reste de l'app — à durcir avant tout pilote réel).
create policy "appels_audio_read"
  on storage.objects for select
  using (bucket_id = 'appels-audio');

create policy "appels_audio_insert"
  on storage.objects for insert
  with check (bucket_id = 'appels-audio');

create policy "appels_audio_delete"
  on storage.objects for delete
  using (bucket_id = 'appels-audio');
