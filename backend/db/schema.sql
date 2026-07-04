-- ============================================================================
-- ATHENA — Schéma de base de données PostgreSQL
-- ============================================================================
-- Traduction SQL de Ressources/modele-donnees.md
--
-- SGBD cible : PostgreSQL ≥ 15 (compatible Supabase — exécutable tel quel
-- dans le SQL Editor de Supabase ou via `psql -f schema.sql`).
--
-- Conventions :
--   • Clés primaires UUID (gen_random_uuid(), natif PostgreSQL) — adapté au
--     temps réel et à la synchronisation multi-clients.
--   • Tous les horodatages en TIMESTAMPTZ (fuseau horaire inclus).
--   • Traçabilité IA : chaque table porte created_at / updated_at ; les
--     données extraites par IA portent leur source ('ia' / 'humain'), un
--     score de confiance et un indicateur de confirmation humaine.
--   • Localisations en latitude / longitude simples (double precision),
--     suffisant pour une carte Leaflet/MapLibre. Migration PostGIS possible
--     plus tard sans casser le schéma.
--
-- Décisions de conception (écarts assumés vis-à-vis du modèle source) :
--   1. Hiérarchie des personnels : seul le lien « chef » (chef_id) est
--      stocké. Les subordonnés s'obtiennent par la requête inverse ;
--      l'appellation (indicatif radio) appartient à chaque personnel.
--      Stocker les deux sens créerait des doublons contradictoires.
--   2. « Véhicules » vs « véhicules sur les lieux » : une seule table de
--      liaison engagements_vehicules ; un véhicule est « sur les lieux »
--      quand arrivee_sur_site_at est renseigné (et desengage_at vide).
--   3. Météo : table dédiée releves_meteo (l'état météo évolue pendant
--      l'intervention → historique conservé, dernier relevé = état courant).
--      type = 'observation' (« mtn ») ou 'bulletin' (« broadcast »).
--   4. Liens entre victimes : table liens_victimes (une victime peut en
--      signaler plusieurs).
--   5. Les ENUM sont extensibles : ALTER TYPE <nom> ADD VALUE '<valeur>';
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Types énumérés
-- ----------------------------------------------------------------------------

CREATE TYPE couleur_triage AS ENUM ('vert', 'jaune', 'rouge', 'noir');

CREATE TYPE sexe_type AS ENUM ('homme', 'femme', 'autre', 'inconnu');

CREATE TYPE type_vehicule AS ENUM (
    'VSAV',                  -- Véhicule de Secours et d'Assistance aux Victimes
    'engin_incendie',
    'bras_elevateur_aerien'
);

CREATE TYPE institution_type AS ENUM ('SAMU', 'pompiers', 'SDIS');

CREATE TYPE mode_lien_victime AS ENUM (
    'visuel',                -- la victime voit l'autre victime
    'proximite_physique'     -- l'autre victime est physiquement proche
);

CREATE TYPE type_releve_meteo AS ENUM (
    'observation',           -- conditions constatées maintenant (« mtn »)
    'bulletin'               -- prévision / bulletin diffusé (« broadcast »)
);

CREATE TYPE source_donnee AS ENUM (
    'ia',                    -- extrait automatiquement (appel, radio)
    'humain'                 -- saisi ou corrigé par un opérateur
);

-- ----------------------------------------------------------------------------
-- Fonction générique : mise à jour automatique de updated_at
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

-- ============================================================================
-- 🚨 ÉVÉNEMENT — le sinistre en cours
-- ============================================================================

CREATE TABLE evenements (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    debut_at             timestamptz NOT NULL DEFAULT now(),  -- heure de début

    -- Localisation
    latitude             double precision CHECK (latitude  BETWEEN  -90 AND  90),
    longitude            double precision CHECK (longitude BETWEEN -180 AND 180),
    adresse              text,                                -- adresse ou repère textuel

    description_sinistre text,                                -- ex. « feu d'appartement R+3 »

    -- Traçabilité
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_evenements_updated_at
    BEFORE UPDATE ON evenements
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- Relevés météo d'un événement (historisés ; le plus récent = état courant)
-- ----------------------------------------------------------------------------

CREATE TABLE releves_meteo (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    evenement_id    uuid NOT NULL REFERENCES evenements(id) ON DELETE CASCADE,

    type            type_releve_meteo NOT NULL DEFAULT 'observation',
    releve_at       timestamptz NOT NULL DEFAULT now(),

    temperature_c   numeric(4,1),                             -- °C
    humidite_pct    numeric(4,1) CHECK (humidite_pct BETWEEN 0 AND 100),
    vent_force_kmh  numeric(5,1) CHECK (vent_force_kmh >= 0),
    vent_direction  text,                                     -- cardinal (« NE ») ou degrés (« 45° »)

    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_releves_meteo_evenement ON releves_meteo (evenement_id, releve_at DESC);

-- ============================================================================
-- 🚒 VÉHICULES
-- ============================================================================
-- NB : chef_vehicule_id référence personnels ; la contrainte FK est ajoutée
-- après la création de la table personnels (référence circulaire).

CREATE TABLE vehicules (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    type                  type_vehicule    NOT NULL,
    institution           institution_type NOT NULL,          -- institution d'origine

    chef_vehicule_id      uuid,                               -- → personnels(id), FK ajoutée plus bas

    -- Statut du véhicule (niveaux de ressources selon le type)
    niveau_eau_pct        numeric(4,1) CHECK (niveau_eau_pct     BETWEEN 0 AND 100),
    niveau_oxygene_pct    numeric(4,1) CHECK (niveau_oxygene_pct BETWEEN 0 AND 100),

    infos_supplementaires text,

    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),

    -- Le niveau d'eau n'a de sens que pour un engin incendie,
    -- le niveau d'oxygène que pour un VSAV (ambulance).
    CONSTRAINT chk_niveau_eau_selon_type
        CHECK (niveau_eau_pct     IS NULL OR type = 'engin_incendie'),
    CONSTRAINT chk_niveau_oxygene_selon_type
        CHECK (niveau_oxygene_pct IS NULL OR type = 'VSAV')
);

CREATE TRIGGER trg_vehicules_updated_at
    BEFORE UPDATE ON vehicules
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- Engagement des véhicules sur les événements
-- « Les véhicules » = lignes de cette table.
-- « Les véhicules sur les lieux » = arrivee_sur_site_at NOT NULL
--                                   AND desengage_at IS NULL.
-- ----------------------------------------------------------------------------

CREATE TABLE engagements_vehicules (
    evenement_id        uuid NOT NULL REFERENCES evenements(id) ON DELETE CASCADE,
    vehicule_id         uuid NOT NULL REFERENCES vehicules(id)  ON DELETE CASCADE,

    engage_at           timestamptz NOT NULL DEFAULT now(),    -- départ / affectation
    arrivee_sur_site_at timestamptz,                           -- NULL = pas encore sur les lieux
    desengage_at        timestamptz,                           -- NULL = toujours engagé

    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (evenement_id, vehicule_id),

    CONSTRAINT chk_arrivee_apres_engagement
        CHECK (arrivee_sur_site_at IS NULL OR arrivee_sur_site_at >= engage_at),
    CONSTRAINT chk_desengagement_apres_engagement
        CHECK (desengage_at IS NULL OR desengage_at >= engage_at)
);

CREATE INDEX idx_engagements_vehicule ON engagements_vehicules (vehicule_id);

CREATE TRIGGER trg_engagements_updated_at
    BEFORE UPDATE ON engagements_vehicules
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 👨‍🚒 PERSONNELS
-- ============================================================================

CREATE TABLE personnels (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identité (complément pratique pour l'affichage dashboard)
    nom                text,
    prenom             text,

    vehicule_id        uuid REFERENCES vehicules(id) ON DELETE SET NULL,  -- véhicule de rattachement
    role_dans_vehicule text,                       -- ex. « chef d'agrès », « conducteur », « équipier »

    appellation        text,                       -- indicatif radio propre à la personne ;
                                                   -- l'appellation du chef ou d'un subordonné
                                                   -- s'obtient par jointure sur chef_id

    chef_id            uuid REFERENCES personnels(id) ON DELETE SET NULL, -- son chef ;
                                                   -- subordonnés = requête inverse sur chef_id

    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT chk_pas_son_propre_chef CHECK (chef_id IS DISTINCT FROM id)
);

CREATE INDEX idx_personnels_vehicule ON personnels (vehicule_id);
CREATE INDEX idx_personnels_chef     ON personnels (chef_id);

CREATE TRIGGER trg_personnels_updated_at
    BEFORE UPDATE ON personnels
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- FK circulaire différée : chef du véhicule → personnels
ALTER TABLE vehicules
    ADD CONSTRAINT fk_vehicules_chef
    FOREIGN KEY (chef_vehicule_id) REFERENCES personnels(id) ON DELETE SET NULL;

CREATE INDEX idx_vehicules_chef ON vehicules (chef_vehicule_id);

-- ----------------------------------------------------------------------------
-- Transmissions radio (timeline STT de ce qui a été dit)
-- ----------------------------------------------------------------------------

CREATE TABLE transmissions_radio (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    personnel_id  uuid NOT NULL REFERENCES personnels(id) ON DELETE CASCADE,

    horodatage    timestamptz NOT NULL DEFAULT now(),
    transcription text NOT NULL,                              -- texte issu du speech-to-text
    confiance_stt numeric(3,2) CHECK (confiance_stt BETWEEN 0 AND 1),
    audio_url     text,                                       -- enregistrement source (traçabilité)

    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_transmissions_personnel ON transmissions_radio (personnel_id, horodatage DESC);

-- ============================================================================
-- 🧍 VICTIMES
-- ============================================================================

CREATE TABLE victimes (
    id                             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    evenement_id                   uuid NOT NULL REFERENCES evenements(id) ON DELETE CASCADE,

    est_appelant                   boolean NOT NULL DEFAULT false,
    langue                         text,          -- code ISO 639-1, ex. 'fr'
    numero_telephone               text,          -- format E.164 recommandé, ex. '+33612345678'

    -- Position
    latitude                       double precision CHECK (latitude  BETWEEN  -90 AND  90),
    longitude                      double precision CHECK (longitude BETWEEN -180 AND 180),
    position_details               text,          -- ex. « 3e étage, porte gauche »
    acces_site                     text,          -- accès possibles du site
    position_confirmee             boolean NOT NULL DEFAULT false,  -- confirmée par les pompiers sur place
    position_confirmee_at          timestamptz,

    -- Risques (évaluation IA → confirmation humaine)
    risque_environnement           text,
    risque_environnement_confirme  boolean NOT NULL DEFAULT false,
    risque_sante                   text,
    risque_sante_confirme          boolean NOT NULL DEFAULT false,

    -- Identité
    nom                            text,
    prenom                         text,
    age                            smallint CHECK (age BETWEEN 0 AND 130),
    sexe                           sexe_type NOT NULL DEFAULT 'inconnu',

    -- Évaluation de l'état (triage) — NULL tant que non évaluée
    triage                         couleur_triage,

    -- Mobilité
    peut_se_deplacer               boolean,       -- NULL = inconnu
    statut_physique                text,          -- ex. « Hémorragie »

    -- Informations supplémentaires communiquées
    nb_personnes_sur_place         smallint CHECK (nb_personnes_sur_place >= 0),

    -- Traçabilité IA
    source                         source_donnee NOT NULL DEFAULT 'ia',
    confiance_extraction           numeric(3,2) CHECK (confiance_extraction BETWEEN 0 AND 1),

    created_at                     timestamptz NOT NULL DEFAULT now(),
    updated_at                     timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT chk_confirmation_position_coherente
        CHECK (position_confirmee_at IS NULL OR position_confirmee)
);

CREATE INDEX idx_victimes_evenement ON victimes (evenement_id);
CREATE INDEX idx_victimes_triage    ON victimes (triage) WHERE triage IS NOT NULL;

CREATE TRIGGER trg_victimes_updated_at
    BEFORE UPDATE ON victimes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- Liens entre victimes (« QUI ? / Comment ? »)
-- ----------------------------------------------------------------------------

CREATE TABLE liens_victimes (
    victime_id      uuid NOT NULL REFERENCES victimes(id) ON DELETE CASCADE,  -- la victime qui signale
    victime_liee_id uuid NOT NULL REFERENCES victimes(id) ON DELETE CASCADE,  -- QUI ? la victime signalée

    mode            mode_lien_victime NOT NULL,   -- Comment ? en visuel / proche physiquement
    details         text,

    created_at      timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (victime_id, victime_liee_id),
    CONSTRAINT chk_pas_lien_avec_soi CHECK (victime_id <> victime_liee_id)
);

CREATE INDEX idx_liens_victime_liee ON liens_victimes (victime_liee_id);

-- ----------------------------------------------------------------------------
-- Actions déjà réalisées (auprès d'une victime) — temps + localisation
-- ----------------------------------------------------------------------------

CREATE TABLE actions_victimes (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    victime_id           uuid NOT NULL REFERENCES victimes(id) ON DELETE CASCADE,

    description          text NOT NULL,           -- ex. « garrot posé »
    realisee_at          timestamptz,             -- temps
    latitude             double precision CHECK (latitude  BETWEEN  -90 AND  90),
    longitude            double precision CHECK (longitude BETWEEN -180 AND 180),
    localisation_details text,                    -- localisation textuelle si pas de coordonnées

    source               source_donnee NOT NULL DEFAULT 'ia',

    created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_actions_victime ON actions_victimes (victime_id);

COMMIT;
