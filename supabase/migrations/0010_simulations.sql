-- 0010_simulations.sql — Simulations multiples (créateur de simulation)
--
-- Une « simulation » = un ensemble d'appels agencés sur une timeline. On peut en
-- créer plusieurs ; le bouton Play joue la simulation ACTIVE (choisie côté UI).
-- Additive + idempotente (rejouable sans casse).

-- 1) La table des simulations.
create table if not exists public.simulations (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  cree_le timestamptz not null default now()
);

-- 2) Rattache chaque appel à une simulation (cascade : supprimer une simulation
--    supprime ses appels).
alter table public.appels
  add column if not exists simulation_id uuid references public.simulations(id) on delete cascade;

create index if not exists idx_appels_simulation on public.appels (simulation_id);

-- 3) Backfill : regroupe les appels existants (sans simulation) dans une sim par défaut.
do $$
declare def uuid;
begin
  if exists (select 1 from public.appels where simulation_id is null) then
    insert into public.simulations (nom) values ('Simulation 1') returning id into def;
    update public.appels set simulation_id = def where simulation_id is null;
  end if;
end $$;

-- 4) Realtime (guard : ignore si la table est déjà dans la publication).
do $$
begin
  alter publication supabase_realtime add table public.simulations;
exception when others then null;
end $$;

-- 5) RLS permissive (cohérent avec le reste — pas d'auth pour l'instant).
alter table public.simulations enable row level security;
drop policy if exists simulations_select on public.simulations;
create policy simulations_select on public.simulations for select using (true);
drop policy if exists simulations_insert on public.simulations;
create policy simulations_insert on public.simulations for insert with check (true);
drop policy if exists simulations_update on public.simulations;
create policy simulations_update on public.simulations for update using (true) with check (true);
drop policy if exists simulations_delete on public.simulations;
create policy simulations_delete on public.simulations for delete using (true);
