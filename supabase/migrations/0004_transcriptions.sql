-- 0004_transcriptions.sql — Transcriptions live (pipeline STT serveur)
--
-- Au lancement de la simulation, un job serveur (poc-stt) transcrit chaque appel
-- en streaming (Google Chirp 3) et INSERT chaque segment `final` ici, au fil de
-- l'eau. Le dashboard lit cette table en Realtime (lecture seule). Le futur
-- service LLM consommera ces segments (texte structuré, ordonné, rattaché à l'appel).
--
-- « À chaque lancement » : le job supprime d'abord les transcriptions existantes
-- de l'appel, puis réinsère. L'ordinal repart donc à 0 à chaque run.
--
-- Additive : ne touche pas aux tables existantes.

create table transcriptions (
  id uuid primary key default gen_random_uuid(),
  appel_id uuid not null references appels(id) on delete cascade,
  ordinal integer not null,                      -- ordre du segment dans l'appel (0 = début d'un run)
  texte text not null,
  langue text,                                   -- code langue détecté par Chirp 3 (ex. fr-fr)
  debut_ms integer,                              -- offset approx. dans l'appel (null si inconnu)
  cree_le timestamptz not null default now()
);

create index idx_transcriptions_appel on transcriptions (appel_id, ordinal);

-- Temps réel : le dashboard voit les segments apparaître en direct.
alter publication supabase_realtime add table transcriptions;

-- RLS permissive (cohérent avec le reste — pas d'auth). Le serveur écrit via la
-- clé service_role (bypass RLS) ; le front lit/efface via anon.
alter table transcriptions enable row level security;
create policy transcriptions_select on transcriptions for select using (true);
create policy transcriptions_insert on transcriptions for insert with check (true);
create policy transcriptions_delete on transcriptions for delete using (true);
