// Victimes MOCKÉES de la coquille (depuis scenario_le_peletier/maps/data/victims.json).
// Riverains V01–V07 (16 & 18 rue Le Peletier) + occupants VS1–VS6 (14, bâtiment
// événement). Position en mètres locaux (x est, y nord, origine = sinistre) →
// affichées en petits cercles plans, couleur = triage (pire cas du groupe).

import { localVersLonLat } from './donneesMock'

export type Triage = 'rouge' | 'jaune' | 'vert' | 'blanc'

export const COULEUR_TRIAGE: Record<Triage, string> = {
  rouge: '#c0392b', // urgence absolue
  jaune: '#e0a021', // urgent
  vert: '#2e9e5b', // relatif
  blanc: '#9aa0a6', // impliqué / indemne
}

export const LIBELLE_TRIAGE: Record<Triage, string> = {
  rouge: 'Immediate',
  jaune: 'Urgent',
  vert: 'Delayed',
  blanc: 'Involved / unharmed',
}

export interface VictimeMock {
  id: string
  pos: [number, number] // [lon, lat]
  etage: number // niveau (0 = RDC) — sert à l'élévation en vue 3D
  triage: Triage
  label: string
  persons: number
}

const DEF: { id: string; x: number; y: number; etage: number; triage: Triage; label: string; persons: number }[] = [
  { id: 'V01', x: 12, y: 16, etage: 5, triage: 'vert', label: 'Leïla Benali + 2 children — 16 Le Peletier (5th floor)', persons: 3 },
  { id: 'V02', x: 12, y: 20, etage: 4, triage: 'vert', label: 'Roger Fabre, 82 — 18 Le Peletier (4th floor)', persons: 1 },
  { id: 'V03', x: 8, y: 15, etage: 6, triage: 'vert', label: 'Dylan Girard, 24 — 16 Le Peletier (6th floor)', persons: 1 },
  { id: 'V04', x: 14, y: 20, etage: 5, triage: 'vert', label: 'Fatima Belkacem, 67 — 18 Le Peletier (5th floor)', persons: 1 },
  { id: 'V05', x: 10, y: 13, etage: 3, triage: 'vert', label: 'Théo Marchal + Emma Costa — 16 Le Peletier (3rd floor)', persons: 2 },
  { id: 'V06', x: 14, y: 22, etage: 5, triage: 'rouge', label: 'Mrs Petit-Roux, 84 — 18 Le Peletier (cardiac arrest)', persons: 1 },
  { id: 'V07', x: 12, y: 24, etage: 2, triage: 'blanc', label: 'Bruno Keller, 45 — 18 Le Peletier (self-evacuated)', persons: 1 },
  { id: 'VS1', x: -4, y: 5, etage: 3, triage: 'vert', label: '2 students — 14, 3rd-floor window', persons: 2 },
  { id: 'VS2', x: 2, y: 0, etage: 5, triage: 'jaune', label: '3 students — 14, 5th-floor loft skylight (1 yellow)', persons: 3 },
  { id: 'VS3', x: 8, y: -8, etage: 5, triage: 'vert', label: '4 students — 14, 5th-floor cornice (Haussmann)', persons: 4 },
  { id: 'VS4', x: -6, y: -2, etage: 3, triage: 'jaune', label: '2 students — 14, 3rd-floor breakout (1 smoke inhalation)', persons: 2 },
  { id: 'VS5', x: 6, y: 6, etage: 5, triage: 'rouge', label: 'Student in cardiac arrest — 14, 5th-floor loft', persons: 1 },
  { id: 'VS6', x: 0, y: 9, etage: 5, triage: 'blanc', label: '~16 students sheltering — 14, 5th-floor loft', persons: 16 },
]

export const VICTIMES: VictimeMock[] = DEF.map((d) => ({
  id: d.id,
  pos: localVersLonLat([d.x, d.y]),
  etage: d.etage,
  triage: d.triage,
  label: d.label,
  persons: d.persons,
}))

/** Total des personnes impliquées (badge d'info). */
export const NB_VICTIMES = DEF.reduce((n, d) => n + d.persons, 0)

/** Triages présents (pour la légende). */
export const TRIAGES_PRESENTS: Triage[] = (['rouge', 'jaune', 'vert', 'blanc'] as Triage[]).filter(
  (t) => VICTIMES.some((v) => v.triage === t),
)

export function victimesGeoJSON(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: VICTIMES.map((v) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: v.pos },
      properties: { id: v.id, couleur: COULEUR_TRIAGE[v.triage], persons: v.persons, label: v.label },
    })),
  }
}
