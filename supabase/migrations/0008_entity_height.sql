-- ============================================================================
-- ATHENA — Éditeur EAV : hauteur redimensionnable des cartes
-- ============================================================================
-- Ajoute la hauteur (px) d'une carte-objet, ajustée par la poignée de resize du
-- node. Appliquée comme min-height côté UI (le contenu reste toujours visible).
-- NULL = hauteur auto (selon le contenu). Additive, sans impact sur l'existant.
-- ============================================================================

begin;

alter table public.entities
    add column if not exists height double precision;

commit;
