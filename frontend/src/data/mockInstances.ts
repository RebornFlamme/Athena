import { supabase } from '../lib/supabase'
import type { ObjectInstance } from './instancesApi'

// Jeu d'objets FACTICES pour travailler l'UI sans lancer de simulation. On les
// écrit dans `object_instances` (mêmes tables que les agents) → ils remontent via
// Realtime dans toutes les surfaces (Database, carte, panneau Objets, semantic).
// Ids FIXES → on peut supprimer exactement ces lignes au dé-toggle, et un
// re-toggle upsert sans doublon. `appel_id = null` → non purgés par les runs.

type MockBase = Pick<ObjectInstance, 'id' | 'type_name' | 'libelle' | 'fields' | 'lon' | 'lat' | 'statut'> & {
  // Ancienneté simulée (minutes) → `cree_le` étalé pour que le graphe montre une courbe.
  ilY_a_min: number
}

// Crise fictive autour de Lyon (feu d'immeuble rue de la Part-Dieu).
const BASE: MockBase[] = [
  { id: 'aaaa0001-0000-4000-8000-000000000001', type_name: 'Building', libelle: 'Immeuble R+6 — 12 rue de la Part-Dieu', fields: { floors: 6, status: 'fire on floors 3-4' }, lon: 4.8570, lat: 45.7605, statut: 'confirme', ilY_a_min: 14 },
  { id: 'aaaa0002-0000-4000-8000-000000000002', type_name: 'Victim', libelle: 'Victime — femme ~70 ans, 4e étage', fields: { age: 70, sex: 'F', condition: 'trapped' }, lon: 4.8572, lat: 45.7606, statut: 'presume', ilY_a_min: 12 },
  { id: 'aaaa0003-0000-4000-8000-000000000003', type_name: 'Victim', libelle: 'Victime — homme, inhalation de fumée', fields: { sex: 'M', condition: 'smoke inhalation' }, lon: 4.8568, lat: 45.7603, statut: 'confirme', ilY_a_min: 11 },
  { id: 'aaaa0004-0000-4000-8000-000000000004', type_name: 'Appliance', libelle: 'FPT — CS Lyon-Corneille', fields: { call_sign: 'FPT-1', crew: 6 }, lon: 4.8560, lat: 45.7598, statut: 'confirme', ilY_a_min: 10 },
  { id: 'aaaa0005-0000-4000-8000-000000000005', type_name: 'Appliance', libelle: 'EPA — échelle pivotante', fields: { call_sign: 'EPA-1', crew: 3 }, lon: 4.8575, lat: 45.7609, statut: 'confirme', ilY_a_min: 9 },
  { id: 'aaaa0006-0000-4000-8000-000000000006', type_name: 'Sector', libelle: 'Périmètre de sécurité — 100 m', fields: { radius_m: 100 }, lon: 4.8571, lat: 45.7604, statut: 'corrige', ilY_a_min: 8 },
  { id: 'aaaa0007-0000-4000-8000-000000000007', type_name: 'Hydrant', libelle: 'Poteau incendie — angle rue Garibaldi', fields: { flow_m3h: 60 }, lon: 4.8555, lat: 45.7607, statut: 'confirme', ilY_a_min: 7 },
  { id: 'aaaa0008-0000-4000-8000-000000000008', type_name: 'Victim', libelle: 'Victime — enfant, mis en sécurité', fields: { condition: 'safe' }, lon: 4.8567, lat: 45.7601, statut: 'corrige', ilY_a_min: 6 },
  { id: 'aaaa0009-0000-4000-8000-000000000009', type_name: 'Access point', libelle: 'Point d\'accès — cage escalier B', fields: { note: 'blocked by smoke' }, lon: 4.8573, lat: 45.7607, statut: 'presume', ilY_a_min: 5 },
  { id: 'aaaa0010-0000-4000-8000-000000000010', type_name: 'Appliance', libelle: 'VSAV — évacuation vers CHU', fields: { call_sign: 'VSAV-2', crew: 3 }, lon: 4.8562, lat: 45.7595, statut: 'confirme', ilY_a_min: 4 },
  { id: 'aaaa0011-0000-4000-8000-000000000011', type_name: 'Sector', libelle: 'Zone de repli des impliqués', fields: { capacity: 20 }, lon: 4.8580, lat: 45.7600, statut: 'presume', ilY_a_min: 2 },
  { id: 'aaaa0012-0000-4000-8000-000000000012', type_name: 'Building', libelle: 'Bâtiment mitoyen — évacuation préventive', fields: { floors: 5, status: 'evacuating' }, lon: 4.8578, lat: 45.7610, statut: 'presume', ilY_a_min: 1 },
]

export const MOCK_IDS: string[] = BASE.map((b) => b.id)

/** Matérialise les lignes mock avec des `cree_le`/`maj_le` étalés dans le passé récent. */
function materialiser(): ObjectInstance[] {
  const maintenant = Date.now()
  return BASE.map(({ ilY_a_min, ...reste }) => {
    const iso = new Date(maintenant - ilY_a_min * 60_000).toISOString()
    return { ...reste, schema_entity_id: null, appel_id: null, cree_le: iso, maj_le: iso }
  })
}

/** Insère (upsert) les objets factices. */
export async function insertMockInstances(): Promise<void> {
  const { error } = await supabase.from('object_instances').upsert(materialiser())
  if (error) throw error
}

/** Supprime les objets factices (par leurs ids fixes). */
export async function removeMockInstances(): Promise<void> {
  const { error } = await supabase.from('object_instances').delete().in('id', MOCK_IDS)
  if (error) throw error
}
