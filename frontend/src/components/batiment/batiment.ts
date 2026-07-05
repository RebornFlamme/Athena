/**
 * Modèle du bâtiment sinistré — PELETIER-14 (14 rue Le Peletier, Paris 9e).
 *
 * Source unique de vérité pour les trois vues « découpe d'étages » (carte 3D
 * MapLibre, schéma isométrique SVG, 3D interactive Three.js).
 *
 * Données réelles : emprise cadastrale OSM (way/69220508) et nombre d'étages
 * (`building:levels = 8`, R+8 ≈ 27–30 m) — voir
 * `scenario_le_peletier/maps/data/site_meta.json`. L'agencement intérieur
 * (lounge/serveurs, breakouts, loft sous les toits) est FICTIF (scénario
 * d'exercice, nuit de hackathon) — l'indoor mapping n'existe pas pour ce bâtiment.
 *
 * Repère local (mètres depuis le centroïde du bloc) : x = est, y = nord. Le bloc
 * est un « U » haussmannien autour d'une cour/puits de lumière : le centroïde
 * tombe dans la cour → pour identifier le bâtiment dans les tuiles, on utilise
 * `POINT_INTERIEUR_WGS84` (un point garanti DANS le bâti), pas le centroïde.
 */

/** Statut opérationnel d'un local (pièce/zone/étage). */
export type Statut = 'feu' | 'rouge' | 'jaune' | 'vert' | 'blanc' | 'normal' | 'commerce'

/**
 * Gravité du danger d'un étage (0 = aucun → 3 = critique). Pilote le
 * clignotement des contours dans la vue « découpe d'étages » : plus c'est grave,
 * plus le contour clignote vite et vif.
 */
export type Gravite = 0 | 1 | 2 | 3

/** Gravité du danger associée à chaque statut (feu = critique). */
export const GRAVITE_STATUT: Record<Statut, Gravite> = {
  feu: 3, // sinistre en cours — critique
  rouge: 2, // victime urgence absolue — élevé
  jaune: 1, // victime urgente — modéré
  vert: 0,
  blanc: 0,
  normal: 0,
  commerce: 0,
}

/** Libellé des niveaux de gravité (légende). */
export const LIBELLE_GRAVITE: Record<Gravite, string> = {
  0: 'Aucun danger',
  1: 'Danger modéré',
  2: 'Danger élevé',
  3: 'Danger critique',
}

export interface Appartement {
  code: string // ex. "VS5", "Serveurs"
  facade: 'peletier' | 'cour' | 'haussmann' // façade rue / cour intérieure / bd Haussmann
  statut: Statut
  detail?: string // ex. "FOYER — lounge recharge", "Étudiant en arrêt cardiaque"
  victimeId?: string
}

export interface Etage {
  niveau: number // 0 = RDC, 1..8 = étages
  label: string // "RDC", "1er", "2e", …
  type: 'rdc' | 'habitation'
  appartements: Appartement[]
  statutEtage: Statut // pire statut de l'étage (pour la vue carte, granularité étage)
  graviteEtage: Gravite // gravité du danger de l'étage (dérivée du statut)
}

/**
 * Emprise réelle (mètres locaux, x est / y nord) — bloc haussmannien en « U »
 * autour d'une cour intérieure. Polygone ouvert (19 sommets), centroïde du bloc
 * à (0,0). Source : `site_meta.json → incident_building.footprint_local_m`.
 */
export const EMPRISE_LOCALE: [number, number][] = [
  [-4.89, 18.65],
  [-5.71, 15.2],
  [-2.58, 14.4],
  [-3.56, 10.56],
  [-4.32, 7.53],
  [-5.79, 2.66],
  [1.13, 0.6],
  [-1.83, -8.5],
  [-4.65, -9.07],
  [-9.02, -7.79],
  [-13.01, -20.67],
  [-2.84, -22.77],
  [3.67, -24.11],
  [7.99, -21.58],
  [10.25, -13.73],
  [15.0, 2.76],
  [16.7, 8.65],
  [3.67, 12.58],
  [4.68, 15.99],
]

/** Emprise réelle WGS84 (lon, lat) — pour la vue carte MapLibre. */
export const EMPRISE_WGS84: [number, number][] = [
  [2.3381174, 48.8727776],
  [2.3381062, 48.8727464],
  [2.338149, 48.8727392],
  [2.3381356, 48.8727044],
  [2.3381252, 48.872677],
  [2.3381052, 48.872633],
  [2.3381997, 48.8726143],
  [2.3381592, 48.872532],
  [2.3381207, 48.8725269],
  [2.338061, 48.8725384],
  [2.3380066, 48.8724219],
  [2.3381455, 48.8724029],
  [2.3382344, 48.8723908],
  [2.3382933, 48.8724137],
  [2.3383242, 48.8724847],
  [2.3383891, 48.8726339],
  [2.3384123, 48.8726872],
  [2.3382343, 48.8727227],
  [2.3382481, 48.8727536],
]

/** Centroïde du bloc (origine du repère local ; tombe dans la cour intérieure). */
export const CENTROIDE_WGS84: [number, number] = [2.338184, 48.872609]

/**
 * Point garanti À L'INTÉRIEUR du bâti (aile sud-est, ~ (8, −10) local, vérifié
 * par ray-casting). À utiliser pour le test point-dans-polygone qui identifie le
 * bâtiment cible dans les tuiles — le centroïde, lui, tombe dans la cour et
 * échouerait le test.
 */
export const POINT_INTERIEUR_WGS84: [number, number] = [2.338293, 48.872519]

export const NB_ETAGES = 9 // RDC + 8 étages (R+8)
export const HAUTEUR_ETAGE_M = 3.0 // hauteur d'un niveau (m)
export const HAUTEUR_TOTALE_M = NB_ETAGES * HAUTEUR_ETAGE_M // 27 m (≈ hauteur réelle R+8)

const ORDINAL = ['RDC', '1er', '2e', '3e', '4e', '5e', '6e', '7e', '8e']

/** Ordre de gravité pour agréger le statut d'un étage. */
const GRAVITE: Statut[] = ['feu', 'rouge', 'jaune', 'vert', 'blanc', 'normal', 'commerce']

function pire(statuts: Statut[]): Statut {
  return statuts.reduce((acc, s) => (GRAVITE.indexOf(s) < GRAVITE.indexOf(acc) ? s : acc), 'normal')
}

type DefZone = { code: string; facade: Appartement['facade']; statut: Statut; detail?: string; victimeId?: string }

/**
 * Agencement par niveau du 14 rue Le Peletier la nuit du hackathon
 * (`scenario_le_peletier/maps/data/victims.json` + timeline). Seules les victimes
 * INTÉRIEURES au bâtiment (VS1–VS6) figurent ici ; les riverains V01–V07 (16 & 18
 * rue Le Peletier) sont des marqueurs de carte, pas des étages de ce bâtiment.
 *
 *   RDC   commerces (banque bd Haussmann + café/hall rue Le Peletier)
 *   1er   accueil de l'événement / bureaux (évacués)
 *   2e    FOYER — lounge de recharge & baie serveurs (effondrement partiel 03:10)
 *   3e    breakout enfumé (feu étendu au 3e à 03:09) — 4 étudiants, 1 intoxiqué
 *   4e    breakouts (évacués)
 *   5e    LOFT sous les toits — le gros de l'effectif (~24), 1 arrêt cardiaque
 *   6–8e  bureaux / logements (évacués)
 */
const NIVEAUX: { type: 'rdc' | 'habitation'; zones: DefZone[] }[] = [
  { type: 'rdc', zones: [
    { code: 'Banque', facade: 'haussmann', statut: 'commerce', detail: 'Agence bancaire (rez, bd Haussmann) — accueil des impliqués' },
    { code: 'Café', facade: 'peletier', statut: 'commerce', detail: 'Café + hall d’entrée principal (rue Le Peletier)' },
  ] },
  { type: 'habitation', zones: [
    { code: '1-Acc', facade: 'peletier', statut: 'normal', detail: 'Accueil du hackathon — évacué' },
    { code: '1-Bur', facade: 'cour', statut: 'normal', detail: 'Bureaux — évacués' },
  ] },
  { type: 'habitation', zones: [
    { code: 'Serveurs', facade: 'cour', statut: 'feu', detail: 'FOYER — lounge de recharge & baie serveurs (départ de feu ; effondrement partiel du plancher 03:10)' },
    { code: 'Détente', facade: 'peletier', statut: 'feu', detail: 'Espace détente — embrasement ; cage d’escalier enfumée (puits de lumière = cheminée)' },
  ] },
  { type: 'habitation', zones: [
    { code: 'VS1', facade: 'peletier', statut: 'vert', detail: '2 étudiants à la fenêtre — sauvetage échelle #1 (02:52)', victimeId: 'VS1' },
    { code: 'VS4', facade: 'cour', statut: 'jaune', detail: '2 étudiants breakout, 1 intoxiqué — feu étendu au 3e (03:09), sauvetage #6 pendant le MAYDAY (03:12)', victimeId: 'VS4' },
  ] },
  { type: 'habitation', zones: [
    { code: '4-BkN', facade: 'cour', statut: 'normal', detail: 'Salle breakout nord — évacuée' },
    { code: '4-BkS', facade: 'haussmann', statut: 'normal', detail: 'Salle breakout sud — évacuée' },
  ] },
  { type: 'habitation', zones: [
    { code: 'VS5', facade: 'cour', statut: 'rouge', detail: 'Étudiant en arrêt cardiaque (fumée maximale au sommet) — extrait, CPR, RACS 03:31', victimeId: 'VS5' },
    { code: 'VS6', facade: 'cour', statut: 'blanc', detail: '~16 étudiants réfugiés dans le loft — escortés par l’escalier dégagé (03:38, cagoules)', victimeId: 'VS6' },
    { code: 'VS2', facade: 'peletier', statut: 'jaune', detail: '3 étudiants à la verrière du loft (1 jaune) — sauvetage échelle #2 (02:56)', victimeId: 'VS2' },
    { code: 'VS3', facade: 'haussmann', statut: 'vert', detail: '4 étudiants sur la corniche mansardée (côté Haussmann) — nacelle #4 (03:05)', victimeId: 'VS3' },
  ] },
  { type: 'habitation', zones: [
    { code: '6-Log', facade: 'peletier', statut: 'normal', detail: 'Bureaux / logements — évacués' },
  ] },
  { type: 'habitation', zones: [
    { code: '7-Log', facade: 'peletier', statut: 'normal', detail: 'Bureaux / logements — évacués' },
  ] },
  { type: 'habitation', zones: [
    { code: '8-Log', facade: 'peletier', statut: 'normal', detail: 'Combles / logements — évacués' },
  ] },
]

function construireEtages(): Etage[] {
  return NIVEAUX.map((def, niveau) => {
    const appartements: Appartement[] = def.zones.map((z) => ({
      code: z.code,
      facade: z.facade,
      statut: z.statut,
      detail: z.detail,
      victimeId: z.victimeId,
    }))
    const statutEtage: Statut =
      def.type === 'rdc' ? 'commerce' : pire(appartements.map((a) => a.statut))
    return {
      niveau,
      label: ORDINAL[niveau],
      type: def.type,
      appartements,
      statutEtage,
      graviteEtage: GRAVITE_STATUT[statutEtage],
    }
  })
}

export const ETAGES: Etage[] = construireEtages()

/** Palette des statuts (cohérente avec les snapshots SVG du scénario). */
export const COULEUR_STATUT: Record<Statut, string> = {
  feu: '#d94436',
  rouge: '#c0392b',
  jaune: '#e0a021',
  vert: '#2e9e5b',
  blanc: '#9aa0a6',
  normal: '#e0d0ad',
  commerce: '#cbb892',
}

export const LIBELLE_STATUT: Record<Statut, string> = {
  feu: 'Feu',
  rouge: 'Victime — urgence absolue',
  jaune: 'Victime — urgent',
  vert: 'Victime — relatif',
  blanc: 'Indemne / impliqué',
  normal: 'Évacué / RAS',
  commerce: 'Commerce (RDC)',
}

/** Légende (ordre d'affichage), limitée aux statuts présents dans le bâtiment. */
export const LEGENDE: { statut: Statut; libelle: string; couleur: string }[] = (
  ['feu', 'rouge', 'jaune', 'vert', 'blanc', 'normal', 'commerce'] as Statut[]
).map((s) => ({ statut: s, libelle: LIBELLE_STATUT[s], couleur: COULEUR_STATUT[s] }))

/** Centroïde 2D de l'emprise locale (utile aux rendus SVG/3D). */
export function centreEmprise(): [number, number] {
  const n = EMPRISE_LOCALE.length
  const [sx, sy] = EMPRISE_LOCALE.reduce(([ax, ay], [x, y]) => [ax + x, ay + y], [0, 0])
  return [sx / n, sy / n]
}

/**
 * Emprise du bâtiment ÉLARGIE de `metres` (anneau WGS84 fermé). Sert à masquer
 * uniquement le bâtiment cible du fond 3D via un filtre `within` : le tampon
 * contient entièrement le bâtiment, mais pas les voisins (rues + mitoyens plus
 * grands ne sont pas « entièrement à l'intérieur »).
 */
export function empriseTamponWGS(metres: number): [number, number][] {
  const [lon0, lat0] = CENTROIDE_WGS84
  const mx = 111320 * Math.cos((lat0 * Math.PI) / 180)
  const my = 110540
  const [cx, cy] = centreEmprise()
  const ring = EMPRISE_LOCALE.map(([x, y]) => {
    const dx = x - cx
    const dy = y - cy
    const r = Math.hypot(dx, dy) || 1
    const nx = x + (dx / r) * metres
    const ny = y + (dy / r) * metres
    return [lon0 + nx / mx, lat0 + ny / my] as [number, number]
  })
  ring.push(ring[0]) // ferme l'anneau
  return ring
}

/* --- Dalles extrudées (partagé par la carte principale et la page Bâtiment) --- */

export const EPAISSEUR_DALLE = 2.4 // m (épaisseur visuelle d'une dalle)
export const SOCLE_ETAGES = 0 // m — étage 0 (RDC) au niveau du sol

/**
 * FeatureCollection des dalles d'étage (une par niveau) pour MapLibre, avec un
 * facteur d'éclatement `ecart` (m). `base`/`hauteur` alimentent `fill-extrusion`,
 * `couleur` = statut de l'étage. Les dalles flottent au-dessus du bâti réel.
 */
export function dallesGeoJSON(ecart: number): GeoJSON.FeatureCollection {
  const ring = [...EMPRISE_WGS84, EMPRISE_WGS84[0]].map(([lon, lat]) => [lon, lat])
  return {
    type: 'FeatureCollection',
    features: ETAGES.map((e, i) => {
      const base = SOCLE_ETAGES + i * (EPAISSEUR_DALLE + ecart)
      return {
        type: 'Feature',
        properties: {
          niveau: e.niveau,
          label: e.label,
          base,
          hauteur: base + EPAISSEUR_DALLE,
          couleur: COULEUR_STATUT[e.statutEtage],
        },
        geometry: { type: 'Polygon', coordinates: [ring] },
      }
    }),
  }
}
