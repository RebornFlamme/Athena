-- 0004_appels_meta.sql — Métadonnées d'appel saisies à l'upload (créateur de simulation)
--
-- Additive : enrichit `appels` avec les infos affichées dans le volet de détail
-- (opérateur au téléphone, localisation de l'appel, caserne qui reçoit).

alter table appels
  add column if not exists operateur text,
  add column if not exists localisation text,
  add column if not exists caserne text;
