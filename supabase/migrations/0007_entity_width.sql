-- ============================================================================
-- ATHENA — Éditeur EAV : largeur redimensionnable des cartes
-- ============================================================================
-- Ajoute la largeur (px) d'une carte-objet, ajustée par la poignée de resize du
-- node. NULL = largeur par défaut côté UI. Additive, sans impact sur l'existant.
-- ============================================================================

begin;

alter table public.entities
    add column if not exists width double precision;

commit;
