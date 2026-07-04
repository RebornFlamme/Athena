import type { Scenario } from '../typesFlux'

// Charge le manifeste des scénarios de démo servi depuis public/audio_demo/.
// Fichier statique (pas de secret) : simple fetch relatif à la base Vite.

/** Récupère les scénarios d'appels préenregistrés. */
export async function chargerScenarios(): Promise<Scenario[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}audio_demo/scenarios.json`)
  if (!res.ok) {
    throw new Error(`Impossible de charger les scénarios (HTTP ${res.status}).`)
  }
  const data = (await res.json()) as { scenarios?: Scenario[] }
  return data.scenarios ?? []
}
