import { create } from 'zustand'

// Simulation ACTIVE = celle qui se déclenche quand on appuie sur Play (contrôle
// flottant global). Choisie via le champ « Active simulation » de la page /flux.
// Découplée de la simulation en cours d'ÉDITION. Persistée en localStorage pour
// survivre au reload et être connue partout (le Play vit dans AppLayout).

const CLE = 'athena.activeSimulationId'

function lireInitial(): string | null {
  try {
    return localStorage.getItem(CLE)
  } catch (_) {
    return null
  }
}

interface SimulationActiveState {
  activeId: string | null
  setActive: (id: string | null) => void
}

export const useSimulationActive = create<SimulationActiveState>((set) => ({
  activeId: lireInitial(),
  setActive: (id) => {
    try {
      if (id) localStorage.setItem(CLE, id)
      else localStorage.removeItem(CLE)
    } catch (_) {
      /* localStorage indisponible : pas de persistance, tant pis */
    }
    set({ activeId: id })
  },
}))
