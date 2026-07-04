-- ============================================================================
-- ATHENA — Éditeur EAV : historique des versions de schéma
-- ============================================================================
-- Snapshots append-only de TOUT le schéma dessiné (entities + attributes)
-- sérialisé en JSON. Alimente le bouton « Enregistrer la version » (distinct de
-- l'écrasement du schéma live des tables entities/attributes). Restaurer une
-- version = recharger son payload dans le canvas (sans écraser la base tant que
-- l'utilisateur ne clique pas « Écraser Supabase »).
-- Additive et indépendante des tables entities/attributes.
-- Exécutable tel quel dans le SQL Editor Supabase ou via `supabase db push`.
-- ============================================================================

begin;

create table if not exists public.schema_versions (
    id         uuid primary key default gen_random_uuid(),
    label      text,                              -- nom donné à la version (optionnel)
    payload    jsonb not null,                    -- { entities: [...], attributes: [...] }
    created_at timestamptz not null default now()
);

create index if not exists idx_schema_versions_created
    on public.schema_versions (created_at desc);

-- RLS — accès ouvert (anon), cohérent avec entities/attributes.
alter table public.schema_versions enable row level security;

create policy "schema_versions: accès ouvert"
    on public.schema_versions for all
    to anon, authenticated
    using (true) with check (true);

commit;
