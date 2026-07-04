-- 0002_athena_core.sql — Socle Athena (phase F0)
--
-- 3 tables : interventions (le dossier), evenements (LE JOURNAL, append-only),
-- entites (la projection affichable sur la carte).
--
-- Pas de table « appels » (décision produit, juil. 2026) : l'appel est traité
-- en direct — la transcription est un état éphémère du frontend ; chaque fait
-- extrait garde sa phrase source dans payload.extrait_source.

create extension if not exists postgis with schema extensions;

-- 1) L'intervention (le « dossier » global)
create table interventions (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  statut text not null default 'active' check (statut in ('active', 'terminee')),
  adresse text,
  lon double precision,
  lat double precision,
  cree_le timestamptz not null default now()
);

-- 2) LE JOURNAL D'ÉVÉNEMENTS — append-only : on ajoute, on ne modifie JAMAIS.
--    L'absence volontaire de policies UPDATE/DELETE (plus bas) rend le journal
--    immuable pour l'application. Une correction = un NOUVEL événement
--    (event_type CORRECTION) qui pointe l'ancien via corrige_event_id.
create table evenements (
  event_id bigint generated always as identity primary key,
  intervention_id uuid not null references interventions(id) on delete cascade,
  entity_id uuid,                                     -- l'entité concernée (si applicable)
  entity_type text not null check (entity_type in ('acteur', 'moyen', 'zone', 'evenement')),
  event_type text not null,                           -- VICTIME_SIGNALEE | MOYEN_PRESENTE | ORDRE_DONNE | CORRECTION ...
  payload jsonb not null default '{}'::jsonb,         -- contenu + payload.extrait_source (phrase de l'appel)
  ts_observation timestamptz,                         -- QUAND le fait s'est produit sur le terrain
  ts_declaration timestamptz not null default now(),  -- QUAND on l'a appris
  source text not null default 'saisie_operateur',    -- appel_18 | radio | gps | saisie_operateur
  fiabilite text not null default 'C3',               -- code Admiralty : A1 (sûr) → F6 (douteux)
  statut text not null default 'presume' check (statut in ('presume', 'confirme', 'corrige', 'perime')),
  corrige_event_id bigint references evenements(event_id)
);

-- 3) LA PROJECTION — état courant de chaque entité (la « photo » affichable).
--    lon/lat en colonnes simples (lisibles/écrivables directement par le client) ;
--    geom est une colonne générée PostGIS pour les requêtes spatiales futures.
create table entites (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references interventions(id) on delete cascade,
  type text not null check (type in ('acteur', 'moyen', 'zone')),
  sous_type text,                                     -- victime | temoin | fpt | vsav | perimetre | point_eau ...
  libelle text not null,                              -- "Victime — 3e étage"
  etat jsonb not null default '{}'::jsonb,            -- état courant fusionné depuis les événements
  lon double precision,
  lat double precision,
  geom extensions.geometry(point, 4326) generated always as (
    case
      when lon is not null and lat is not null
      then extensions.st_setsrid(extensions.st_makepoint(lon, lat), 4326)
    end
  ) stored,
  fiabilite text not null default 'C3',
  statut text not null default 'presume' check (statut in ('presume', 'confirme', 'corrige', 'perime')),
  maj_le timestamptz not null default now()
);

-- maj_le automatique sur la projection
create or replace function maj_le_entites() returns trigger
language plpgsql as $$
begin
  new.maj_le = now();
  return new;
end $$;

create trigger trg_entites_maj_le
  before update on entites
  for each row execute function maj_le_entites();

-- Index pour la vitesse
create index idx_evt_intervention on evenements (intervention_id, event_id);
create index idx_entites_intervention on entites (intervention_id);
create index idx_entites_geom on entites using gist (geom);

-- Temps réel : le dashboard s'abonne aux nouveautés
alter publication supabase_realtime add table interventions, evenements, entites;

-- RLS : activée partout. Policies permissives anon — cohérent avec l'éditeur EAV
-- (pas d'authentification pour l'instant). À DURCIR avant tout pilote réel.
alter table interventions enable row level security;
alter table evenements enable row level security;
alter table entites enable row level security;

create policy interventions_select on interventions for select using (true);
create policy interventions_insert on interventions for insert with check (true);
create policy interventions_update on interventions for update using (true) with check (true);
create policy interventions_delete on interventions for delete using (true);

-- JOURNAL : lecture + insertion SEULEMENT. Pas de policy update/delete →
-- impossible pour un client de modifier ou d'effacer l'historique.
-- (Seule la suppression en cascade d'une intervention de test retire des lignes.)
create policy evenements_select on evenements for select using (true);
create policy evenements_insert on evenements for insert with check (true);

create policy entites_select on entites for select using (true);
create policy entites_insert on entites for insert with check (true);
create policy entites_update on entites for update using (true) with check (true);
create policy entites_delete on entites for delete using (true);
