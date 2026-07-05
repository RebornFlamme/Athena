-- 0009_object_instances.sql — Couche LLM : instances d'objets schema-native + journal d'agent.
--
-- L'agent LLM (job serveur poc-stt, un par appel) lit `transcriptions` au fil de
-- l'eau, interroge le méta-schéma EAV (`entities`/`attributes`) et instancie les
-- types d'objets que l'utilisateur a dessinés. Contrairement aux tables héritées
-- `entites`/`evenements` (taxonomie figée acteur/moyen/zone, laissées dormantes),
-- ce modèle est GÉNÉRIQUE : chaque instance référence son type de schéma.
--
--   object_instances = l'état courant des objets (projection carte + panneau bas)
--   agent_journal     = trace de raisonnement de l'agent + edits sémantiques (append-only)
--
-- RLS permissive (pas d'auth) : le serveur écrit via service_role (bypass RLS),
-- le front lit/efface via anon. Realtime activé → dashboard live.
--
-- Idempotent / rejouable : `if not exists`, guards sur le Realtime, `drop policy
-- if exists` avant chaque policy → aucun rollback si on relance le script.

-- Instances d'objets : une ligne = une instance d'un type EAV (public.entities).
create table if not exists public.object_instances (
  id uuid primary key default gen_random_uuid(),
  -- Le TYPE (méta-schéma EAV). NULLABLE + on delete set null : une instance
  -- survit à la suppression de son type dans l'éditeur de schéma.
  schema_entity_id uuid references public.entities(id) on delete set null,
  type_name text not null,                     -- nom du type au moment de la création (résilient)
  libelle text not null,                       -- label lisible de l'instance ("Victime — 3e étage")
  fields jsonb not null default '{}'::jsonb,   -- champs typés conformes aux `attributes` du type
  lon double precision,                        -- position (→ marqueur carte) si connue
  lat double precision,
  appel_id uuid references public.appels(id) on delete cascade,  -- appel ayant créé/dernier touché
  statut text not null default 'presume' check (statut in ('presume','confirme','corrige','perime')),
  cree_le timestamptz not null default now(),
  maj_le timestamptz not null default now()
);

create index if not exists idx_object_instances_type  on public.object_instances (schema_entity_id);
create index if not exists idx_object_instances_appel on public.object_instances (appel_id);

-- Journal de l'agent : append-only. Alimente la « stack trace » (Sheet d'appel,
-- filtré par appel_id) ET la couche sémantique (edits create/modif/suppr avec
-- diff champ par champ, vue globale).
create table if not exists public.agent_journal (
  id bigint generated always as identity primary key,
  appel_id uuid references public.appels(id) on delete cascade,
  instance_id uuid,                            -- objet concerné (pas de FK : survit à la suppression)
  kind text not null check (kind in ('raisonnement','creation','modification','suppression','outil')),
  objet text,                                  -- libellé de l'objet concerné (couche sémantique)
  texte text,                                  -- pensée de l'agent / extrait source de l'appel
  diff jsonb,                                  -- [{champ, avant, apres}] pour la couche sémantique
  cree_le timestamptz not null default now()
);

create index if not exists idx_agent_journal_appel on public.agent_journal (appel_id, id);

-- Temps réel (guardé : ne casse pas si déjà membre, ou si la publication est
-- définie FOR ALL TABLES — dans ce cas les tables sont déjà publiées).
do $$ begin
  alter publication supabase_realtime add table public.object_instances;
exception when others then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.agent_journal;
exception when others then null; end $$;

-- RLS permissive (cohérent avec le reste — pas d'auth). Le serveur écrit via la
-- clé service_role (bypass RLS) ; le front lit via anon ; delete autorisé pour la
-- purge « ardoise vierge » au lancement de la simulation.
alter table public.object_instances enable row level security;
drop policy if exists object_instances_select on public.object_instances;
create policy object_instances_select on public.object_instances for select using (true);
drop policy if exists object_instances_insert on public.object_instances;
create policy object_instances_insert on public.object_instances for insert with check (true);
drop policy if exists object_instances_update on public.object_instances;
create policy object_instances_update on public.object_instances for update using (true);
drop policy if exists object_instances_delete on public.object_instances;
create policy object_instances_delete on public.object_instances for delete using (true);

alter table public.agent_journal enable row level security;
drop policy if exists agent_journal_select on public.agent_journal;
create policy agent_journal_select on public.agent_journal for select using (true);
drop policy if exists agent_journal_insert on public.agent_journal;
create policy agent_journal_insert on public.agent_journal for insert with check (true);
drop policy if exists agent_journal_delete on public.agent_journal;
create policy agent_journal_delete on public.agent_journal for delete using (true);

notify pgrst, 'reload schema';
