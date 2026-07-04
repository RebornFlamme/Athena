import { useEffect, useRef, useState } from 'react'
import * as api from '../data/interventionApi'
import { geocoder, type ResultatGeocodage } from '../data/geocodageIgn'
import type { StatutInfo } from '../typesAthena'
import type { ExtractionStep, Scenario, TranscriptSegment } from '../typesFlux'

export type PhaseSim = 'en_cours' | 'termine'

/**
 * Rejoue un scénario d'appel : révèle le transcript au fil du temps et, aux
 * instants d'extraction, géocode (IGN) puis écrit un `evenement` (avec
 * `payload.extrait_source`) et upsert une `entite` géolocalisée dans Supabase.
 * La carte et la main courante se mettent à jour via le Realtime F0.
 *
 * @param scenario Scénario à rejouer (null = inactif).
 * @param interventionId Intervention démo cible (null = inactif).
 * @returns Les répliques déjà révélées, la phase, et les erreurs éventuelles.
 */
export function useSimulation(scenario: Scenario | null, interventionId: string | null) {
  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const [phase, setPhase] = useState<PhaseSim>('en_cours')
  const [erreur, setErreur] = useState<string | null>(null)
  const timersRef = useRef<number[]>([])

  useEffect(() => {
    if (!scenario || !interventionId) return
    setSegments([])
    setPhase('en_cours')
    setErreur(null)

    const timers: number[] = []
    const cacheGeo = new Map<string, ResultatGeocodage | null>()

    async function geocodeCache(adresse: string): Promise<ResultatGeocodage | null> {
      if (cacheGeo.has(adresse)) return cacheGeo.get(adresse) ?? null
      const r = await geocoder(adresse).catch(() => null)
      cacheGeo.set(adresse, r)
      return r
    }

    async function executerPas(step: ExtractionStep) {
      const payload: Record<string, unknown> = { extrait_source: step.extrait_source }
      let statut: StatutInfo = 'presume'
      let lon: number | null = null
      let lat: number | null = null

      try {
        // Adresse de l'intervention → recentrage de la carte.
        if (step.geocode) {
          const g = await geocodeCache(scenario!.adresse_intervention)
          if (g) {
            await api.majCentreIntervention(interventionId!, g.lon, g.lat, g.label)
            payload.adresse = g.label
            payload.score = Number(g.score.toFixed(2))
            statut = g.fiable ? 'confirme' : 'presume'
          }
        }

        // Entité géolocalisée (victime, sinistre, moyen…).
        let entityId: string | null = null
        let entityType: 'acteur' | 'moyen' | 'zone' | 'evenement' = 'evenement'
        if (step.entite) {
          entityType = step.entite.type
          if (step.entite.adresse) {
            const g = await geocodeCache(step.entite.adresse)
            if (g) {
              lon = g.lon
              lat = g.lat
              statut = g.fiable ? 'confirme' : 'presume'
            }
          }
          const ent = await api.upsertEntite({
            id: crypto.randomUUID(),
            intervention_id: interventionId!,
            type: step.entite.type,
            sous_type: step.entite.sous_type ?? null,
            libelle: step.entite.libelle,
            lon,
            lat,
            fiabilite: step.fiabilite ?? 'B2',
            statut,
          })
          entityId = ent.id
        }

        await api.insererEvenement({
          intervention_id: interventionId!,
          entity_id: entityId,
          entity_type: entityType,
          event_type: step.event_type,
          payload,
          source: 'appel_18',
          fiabilite: step.fiabilite ?? 'B2',
          statut,
        })
      } catch (err) {
        setErreur(String((err as { message?: string })?.message ?? err))
      }
    }

    for (const seg of scenario.transcript) {
      timers.push(window.setTimeout(() => setSegments((prev) => [...prev, seg]), seg.t_ms))
    }
    for (const step of scenario.extractions) {
      timers.push(window.setTimeout(() => void executerPas(step), step.t_ms))
    }
    timers.push(window.setTimeout(() => setPhase('termine'), scenario.duree_s * 1000 + 1500))

    timersRef.current = timers
    return () => {
      timers.forEach((t) => window.clearTimeout(t))
      timersRef.current = []
    }
  }, [scenario, interventionId])

  return { segments, phase, erreur }
}
