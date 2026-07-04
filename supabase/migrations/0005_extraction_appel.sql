-- 0005_extraction_appel.sql — Rattachement des faits extraits à l'appel source.
--
-- L'extraction LLM (job serveur poc-stt) lit `transcriptions` et écrit des
-- `entites` (projection carte) + `evenements` (journal) via la clé service_role.
-- On ajoute `appel_id` sur ces deux tables pour :
--   - tracer chaque fait jusqu'à l'appel qui l'a produit (volet transcription) ;
--   - permettre au job de repartir d'une ardoise vierge par appel à chaque run
--     (« à chaque lancement ») sans toucher aux autres appels.
--
-- Additive : colonnes NULLABLE, aucune donnée existante impactée.

alter table entites    add column appel_id uuid references appels(id) on delete cascade;
alter table evenements add column appel_id uuid references appels(id) on delete cascade;

create index idx_entites_appel    on entites    (appel_id);
create index idx_evenements_appel on evenements (appel_id);
