// Données MOCKÉES de la coquille (bac à sable front). Aucune dépendance backend :
// engins de la BSPP engagés sur PELETIER-14, avec leur caserne réelle (coords OSM,
// cf. scenario_le_peletier/maps/data/site_meta.json) et un équipage. Sert à
// déclencher « à l'appel » l'apparition des engins puis leur trajet vers le sinistre.

export type TypeEngin = 'FPT' | 'EPA' | 'BEA' | 'VSAV' | 'BA' | 'VLR'

export interface PersonnelMock {
  id: string
  nom: string
  role: string
}

export interface EnginMock {
  id: string
  nom: string // indicatif, ex. « ENGINE OPERA 1 »
  type: TypeEngin
  caserne: string
  /** Point de départ [lon, lat] = la caserne. */
  depart: [number, number]
  /** Poste de déploiement [lon, lat] — disposition conventionnelle sur la zone. */
  arrivee: [number, number]
  /** Retard d'arrivée sur zone (s), relatif à la 1ʳᵉ unité — vagues chronologiques. */
  retardS: number
  /** Moyen aérien : vole en ligne droite et stationne en altitude au-dessus du feu. */
  aerien: boolean
  personnels: PersonnelMock[]
}

/** Lieu de l'intervention : 14 rue Le Peletier, Paris 9e. */
export const INCIDENT: [number, number] = [2.338184, 48.872609]

// Conversion mètres locaux (x est, y nord, origine = sinistre) → lon/lat.
const MX = 111320 * Math.cos((INCIDENT[1] * Math.PI) / 180)
const MY = 110540
/** Mètres locaux (x est, y nord, origine = sinistre) → [lon, lat]. */
export const localVersLonLat = ([x, y]: [number, number]): [number, number] => [
  INCIDENT[0] + x / MX,
  INCIDENT[1] + y / MY,
]

/** Casernes réelles (BSPP) — [lon, lat]. */
const CASERNES: Record<string, { nom: string; pos: [number, number] }> = {
  OPERA: { nom: 'CS Blanche', pos: [2.331945, 48.878512] },
  TRINITY: { nom: 'CS Saint-Honoré', pos: [2.335551, 48.865562] },
  LAFAYETTE: { nom: 'CS Rousseau', pos: [2.344698, 48.864124] },
  REPUBLIC: { nom: "CS Château d'Eau", pos: [2.358489, 48.871243] },
  REGENT: { nom: 'CS La Monnaie', pos: [2.339185, 48.857202] },
  VICTORY: { nom: 'CS Montmartre', pos: [2.332732, 48.891181] },
  LANDON: { nom: 'CS Landon', pos: [2.367974, 48.880836] },
}

/** Taille d'équipage par type d'engin (BSPP, ordre de grandeur). */
const EQUIPAGE: Record<TypeEngin, number> = { FPT: 6, EPA: 3, BEA: 3, VSAV: 3, BA: 2, VLR: 1 }

const PRENOMS = ['Marchal', 'Lefèvre', 'Nguyen', 'Da Silva', 'Bonnet', 'Keller', 'Roux', 'Diop', 'Petit', 'Leroy']

/** Construit un équipage nommé (chef d'agrès + conducteur + équipiers). */
function equipage(enginId: string, type: TypeEngin): PersonnelMock[] {
  const n = EQUIPAGE[type]
  const roles = ['Crew leader', 'Driver', 'Crew member', 'Crew member', 'Crew member', 'Crew member']
  return Array.from({ length: n }, (_, i) => ({
    id: `${enginId}-P${i + 1}`,
    nom: PRENOMS[(enginId.length + i) % PRENOMS.length],
    role: roles[Math.min(i, roles.length - 1)],
  }))
}

// poste = position de déploiement (m locaux, cf. 02_SITE_PLAN) ; onScene = heure
// d'arrivée sur zone (05_MASTER_TIMELINE) → vagues chronologiques.
const DEF: {
  nom: string
  type: TypeEngin
  caserne: keyof typeof CASERNES
  poste: [number, number]
  onScene: string
  aerien?: boolean
}[] = [
  // Répartition d'origine (02_SITE_PLAN), avec juste plus d'espace sur la rangée
  // boulevard (TRINITY/REPUBLIC/VICTORY étaient à ~8-10 m → écartés). Air support
  // en vol au-dessus du feu. Aucun recouvrement (vérifié).
  { nom: 'ENGINE OPERA 1', type: 'FPT', caserne: 'OPERA', poste: [-16, -16], onScene: '02:46:40' },
  { nom: 'LADDER OPERA', type: 'EPA', caserne: 'OPERA', poste: [-16, 4], onScene: '02:47:20' },
  { nom: 'ENGINE TRINITY 1', type: 'FPT', caserne: 'TRINITY', poste: [-45, -24], onScene: '02:49:30' },
  { nom: 'ENGINE LAFAYETTE 1', type: 'FPT', caserne: 'LAFAYETTE', poste: [26, -20], onScene: '02:54:00' },
  { nom: 'LADDER LAFAYETTE', type: 'EPA', caserne: 'LAFAYETTE', poste: [18, 18], onScene: '02:54:00' },
  { nom: 'ENGINE REPUBLIC 1', type: 'FPT', caserne: 'REPUBLIC', poste: [-60, -26], onScene: '02:58:00' },
  { nom: 'LADDER REPUBLIC', type: 'BEA', caserne: 'REPUBLIC', poste: [-30, -22], onScene: '02:58:00' },
  { nom: 'MEDIC OPERA', type: 'VSAV', caserne: 'OPERA', poste: [-36, -36], onScene: '02:58:30' },
  { nom: 'ENGINE REGENT 1', type: 'FPT', caserne: 'REGENT', poste: [36, 30], onScene: '03:01:30' },
  { nom: 'MEDIC REGENT', type: 'VSAV', caserne: 'REGENT', poste: [-48, -40], onScene: '03:01:30' },
  { nom: 'ENGINE VICTORY 1', type: 'FPT', caserne: 'VICTORY', poste: [-75, -28], onScene: '03:03:00' },
  // Air support : stationne EN L'AIR au sud du sinistre (au-dessus du boulevard,
  // hors de l'emprise du bâtiment pour ne pas paraître « dedans » vu de haut).
  { nom: 'AIR SUPPORT', type: 'BA', caserne: 'LANDON', poste: [0, -40], onScene: '03:13:30', aerien: true },
]

const hms = (s: string): number => {
  const [h, m, sec] = s.split(':').map(Number)
  return h * 3600 + m * 60 + sec
}
const T0_SCENE = Math.min(...DEF.map((d) => hms(d.onScene)))

export const ENGINS: EnginMock[] = DEF.map((d, i) => {
  const id = `E${String(i + 1).padStart(2, '0')}`
  return {
    id,
    nom: d.nom,
    type: d.type,
    caserne: CASERNES[d.caserne].nom,
    depart: CASERNES[d.caserne].pos,
    arrivee: localVersLonLat(d.poste),
    retardS: hms(d.onScene) - T0_SCENE,
    aerien: d.aerien ?? false,
    personnels: equipage(id, d.type),
  }
})

/** Total des personnels instanciés (badge d'info). */
export const NB_PERSONNELS = ENGINS.reduce((n, e) => n + e.personnels.length, 0)
