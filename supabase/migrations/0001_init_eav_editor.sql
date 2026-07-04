-- ============================================================================
-- ATHENA — Éditeur de schéma EAV : méta-schéma
-- ============================================================================
-- Ces tables ne stockent PAS des données métier, mais la DÉFINITION des
-- schémas dessinés dans l'éditeur visuel (React Flow) :
--   • entities   : les objets et sous-objets (= nodes du graphe)
--   • attributes : les champs de chaque objet (= contenu des nodes) ; un champ
--                  de type `reference` ou `object` pointe vers une autre
--                  entité et matérialise une arête (edge) du graphe.
--
-- Canvas unique ⇒ un seul schéma global (pas de table `projects`).
-- Accès ouvert assumé : RLS activée avec des policies permissives pour anon.
-- Exécutable tel quel dans le SQL Editor de Supabase ou via `supabase db push`.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- Fonction générique : mise à jour automatique de updated_at
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- entities — un objet (is_subobject=false) ou un sous-objet (is_subobject=true)
-- ----------------------------------------------------------------------------
create table if not exists public.entities (
    id           uuid primary key default gen_random_uuid(),
    name         text not null default 'Nouvel objet',
    is_subobject boolean not null default false,
    position_x   double precision not null default 0,
    position_y   double precision not null default 0,
    color        text,                              -- accent hex du node (ex. '#6366f1')
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

create trigger trg_entities_updated_at
    before update on public.entities
    for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- attributes — un champ appartenant à une entité
-- ----------------------------------------------------------------------------
create table if not exists public.attributes (
    id               uuid primary key default gen_random_uuid(),
    entity_id        uuid not null references public.entities(id) on delete cascade,

    name             text not null default 'champ',
    -- string | text | boolean | integer | number | datetime | enum | reference | object
    data_type        text not null default 'string',
    is_list          boolean not null default false,   -- « liste de … »
    enum_values      text[],                            -- si data_type = 'enum'
    -- si data_type = 'reference' ou 'object' : entité cible (⇒ edge du graphe)
    target_entity_id uuid references public.entities(id) on delete set null,
    required         boolean not null default false,
    description      text,
    ordinal          integer not null default 0,       -- ordre d'affichage dans le node

    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now(),

    constraint chk_data_type check (data_type in (
        'string','text','boolean','integer','number','datetime','enum','reference','object'
    ))
);

create index if not exists idx_attributes_entity on public.attributes (entity_id, ordinal);
create index if not exists idx_attributes_target on public.attributes (target_entity_id);

create trigger trg_attributes_updated_at
    before update on public.attributes
    for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS — accès ouvert (anon) : lecture + écriture complètes
-- ----------------------------------------------------------------------------
alter table public.entities   enable row level security;
alter table public.attributes enable row level security;

create policy "entities: accès ouvert"
    on public.entities for all
    to anon, authenticated
    using (true) with check (true);

create policy "attributes: accès ouvert"
    on public.attributes for all
    to anon, authenticated
    using (true) with check (true);

-- ----------------------------------------------------------------------------
-- Realtime — publier les changements pour la synchro multi-onglets
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table public.entities;
alter publication supabase_realtime add table public.attributes;

commit;
