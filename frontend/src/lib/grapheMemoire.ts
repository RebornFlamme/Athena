import type { Edge } from '@xyflow/react'
import type { ObjectInstance } from '../data/instancesApi'
import type { Attribute, Entity } from '../types'

// Construit le graphe LIVE de la mémoire : nœuds = instances d'objets (produites
// par les agents LLM), arêtes = DÉRIVÉES du schéma dessiné (les attributs de type
// référence/objet entre types → liens entre les instances de ces types).
// Pur (pas d'I/O) : consommé par le composant React Flow.

const RELATION_TYPES = ['reference', 'object']

// Rang sémantique d'un type → colonne (hub à gauche, périphérie à droite).
const RANGS = [
  'interven',
  'sinistre',
  'lieu',
  'batiment',
  'bâtiment',
  'zone',
  'victime',
  'identite',
  'identité',
  'engin',
  'moyen',
  'vehicul',
  'véhicul',
  'personnel',
  'acteur',
  'evenement',
  'évènement',
]

const COL_W = 320
const ROW_H = 168

function rangDe(typeName: string): number {
  const t = typeName.toLowerCase()
  const i = RANGS.findIndex((r) => t.includes(r))
  return i === -1 ? RANGS.length : i
}

/**
 * Positions auto en colonnes par type (hub → périphérie), stables par `cree_le`.
 * Les instances n'ayant pas de position sauvegardée, on en calcule une lisible.
 */
export function calculerPositions(
  instances: ObjectInstance[],
): Map<string, { x: number; y: number }> {
  const parColonne = new Map<number, ObjectInstance[]>()
  for (const i of instances) {
    const r = rangDe(i.type_name)
    if (!parColonne.has(r)) parColonne.set(r, [])
    parColonne.get(r)!.push(i)
  }

  const pos = new Map<string, { x: number; y: number }>()
  const colonnes = [...parColonne.keys()].sort((a, b) => a - b)
  colonnes.forEach((rang, colIdx) => {
    const liste = parColonne
      .get(rang)!
      .sort((a, b) => a.cree_le.localeCompare(b.cree_le))
    const offset = ((liste.length - 1) * ROW_H) / 2
    liste.forEach((inst, rowIdx) => {
      pos.set(inst.id, { x: colIdx * COL_W, y: rowIdx * ROW_H - offset })
    })
  })
  return pos
}

/**
 * Résout l'id de type (entity du schéma) d'une instance : `schema_entity_id` s'il
 * est posé, sinon repli sur `type_name` == nom du type (l'agent ne remplit pas
 * toujours `schema_entity_id`).
 */
function typeIdDe(inst: ObjectInstance, parNom: Map<string, string>): string | null {
  if (inst.schema_entity_id) return inst.schema_entity_id
  return parNom.get(inst.type_name.trim().toLowerCase()) ?? null
}

/**
 * Arêtes dérivées du schéma : pour chaque attribut référence type T→U, relie les
 * instances de T à celles de U (une arête par paire, dédupliquée sans orientation
 * pour éviter les doublons Intervention↔Victime).
 */
export function deriverAretes(
  instances: ObjectInstance[],
  attributs: Attribute[],
  entities: Entity[],
): Edge[] {
  if (!instances?.length || !attributs?.length || !entities?.length) return []

  const refs = attributs.filter(
    (a) => a.target_entity_id && RELATION_TYPES.includes(a.data_type),
  )

  // nom de type (minuscule) → id, pour le repli quand schema_entity_id est nul.
  const parNom = new Map(entities.map((e) => [e.name.trim().toLowerCase(), e.id]))

  // id de type → instances de ce type
  const parType = new Map<string, ObjectInstance[]>()
  for (const i of instances) {
    const tid = typeIdDe(i, parNom)
    if (!tid) continue
    if (!parType.has(tid)) parType.set(tid, [])
    parType.get(tid)!.push(i)
  }

  const edges: Edge[] = []
  const vus = new Set<string>()
  for (const attr of refs) {
    const sources = parType.get(attr.entity_id) ?? []
    const cibles = parType.get(attr.target_entity_id as string) ?? []
    for (const s of sources) {
      for (const c of cibles) {
        if (s.id === c.id) continue
        const clePaire = [s.id, c.id].sort().join('|')
        if (vus.has(clePaire)) continue
        vus.add(clePaire)
        edges.push({
          id: `e-${s.id}-${c.id}`,
          source: s.id,
          target: c.id,
          label: attr.name,
          animated: true,
          style: { stroke: '#94a3b8', strokeWidth: 1.5 },
          labelStyle: { fontSize: 10, fill: '#64748b' },
          labelBgStyle: { fill: 'rgba(255,255,255,0.85)' },
          labelBgPadding: [4, 2],
          labelBgBorderRadius: 4,
        })
      }
    }
  }
  return edges
}
