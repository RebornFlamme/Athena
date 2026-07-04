import type { EntiteCarte } from '../data/entitesApi'
import type { EvenementLive } from '../data/evenementsApi'
import type { DiffChamp, LigneSemantic } from '../components/dashboard/PanneauSemanticLayer'

// Transforme le journal d'événements (produit par l'extraction LLM serveur) en
// lignes de la « couche sémantique » du dashboard, avec un diff avant/après réel.
// Pur (pas d'I/O) : rejoue les événements dans l'ordre pour reconstruire l'état
// antérieur de chaque objet et calculer le « avant » de chaque modification.

/** Clé d'état interne (dénormalisation des liens) — masquée dans les diffs. */
const CHAMPS_MASQUES = new Set(['rattachements'])

const LIBELLE_TYPE: Record<string, string> = {
  zone: 'Zone',
  acteur: 'Acteur',
  moyen: 'Moyen',
  evenement: 'Événement',
}

function formaterValeur(val: unknown): string {
  if (val == null) return '—'
  if (typeof val === 'string') return val
  if (typeof val === 'number' || typeof val === 'boolean') return String(val)
  return JSON.stringify(val)
}

function formaterHeure(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function texteSource(payload: Record<string, unknown>): string | null {
  const s = payload.extrait_source
  return typeof s === 'string' && s.trim() ? s.trim() : null
}

/**
 * Construit les lignes de la couche sémantique à partir du journal + des entités.
 *
 * Args:
 *   evenements: Journal du run (ordre chronologique attendu, retrié par sécurité).
 *   entites: Entités du run (pour résoudre `entity_id` → libellé lisible).
 *
 * Returns:
 *   Une ligne par événement porteur d'un diff, du plus ancien au plus récent.
 */
export function construireLignesSemantiques(
  evenements: EvenementLive[],
  entites: EntiteCarte[],
): LigneSemantic[] {
  const libelleParId = new Map(entites.map((e) => [e.id, e.libelle]))
  // État reconstruit par objet, mis à jour au fil du rejeu → donne le « avant ».
  const etatParObjet = new Map<string, Record<string, string>>()
  const lignes: LigneSemantic[] = []

  const ordonnes = [...evenements].sort((a, b) => a.event_id - b.event_id)

  for (const ev of ordonnes) {
    const p = ev.payload ?? {}
    const cle = ev.entity_id ?? `t:${ev.entity_type}`
    const objet =
      (ev.entity_id && libelleParId.get(ev.entity_id)) ||
      LIBELLE_TYPE[ev.entity_type] ||
      ev.entity_type
    const t = formaterHeure(ev.ts_declaration)
    const etat = etatParObjet.get(cle) ?? {}
    const source = texteSource(p)

    if (ev.event_type === 'ENTITE_CREEE') {
      const initial = (p.etat as Record<string, unknown>) ?? {}
      const diff: DiffChamp[] = []
      const nouvel = { ...etat }
      for (const [champ, val] of Object.entries(initial)) {
        if (CHAMPS_MASQUES.has(champ)) continue
        const apres = formaterValeur(val)
        diff.push({ champ, avant: null, apres })
        nouvel[champ] = apres
      }
      etatParObjet.set(cle, nouvel)
      lignes.push({
        id: `e${ev.event_id}`,
        t,
        objet,
        texte: source ?? `Objet identifié — ${objet}`,
        diff: diff.length ? diff : [{ champ: 'objet', avant: null, apres: objet }],
      })
      continue
    }

    if (ev.event_type === 'ENTITE_MAJ') {
      const patch = (p.patch as Record<string, unknown>) ?? {}
      const diff: DiffChamp[] = []
      const nouvel = { ...etat }
      for (const [champ, val] of Object.entries(patch)) {
        if (CHAMPS_MASQUES.has(champ)) continue
        const apres = formaterValeur(val)
        diff.push({ champ, avant: etat[champ] ?? null, apres })
        nouvel[champ] = apres
      }
      if (p.lon != null && p.lat != null) {
        const apres = `${Number(p.lat).toFixed(5)}, ${Number(p.lon).toFixed(5)}`
        diff.push({ champ: 'position', avant: etat.position ?? null, apres })
        nouvel.position = apres
      }
      etatParObjet.set(cle, nouvel)
      if (!diff.length) continue
      lignes.push({
        id: `e${ev.event_id}`,
        t,
        objet,
        texte: source ?? `Mise à jour — ${diff.map((d) => d.champ).join(', ')}`,
        diff,
      })
      continue
    }

    if (ev.event_type === 'RELATION') {
      const relation = typeof p.relation === 'string' ? p.relation : 'lien'
      const cibleId = typeof p.cible_id === 'string' ? p.cible_id : null
      const cible = (cibleId && libelleParId.get(cibleId)) || 'objet'
      lignes.push({
        id: `e${ev.event_id}`,
        t,
        objet,
        texte: source ?? `Relation — ${relation} → ${cible}`,
        diff: [{ champ: relation, avant: null, apres: cible }],
      })
    }
  }

  return lignes
}
