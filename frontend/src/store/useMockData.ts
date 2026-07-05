import { create } from 'zustand'
import { insertMockInstances, removeMockInstances } from '../data/mockInstances'

// Toggle « données factices » (à côté du bouton Play de la simulation) : activé,
// il remplit `object_instances` d'objets mock pour travailler l'UI ; désactivé,
// il les supprime. État local au store (pas de persistance : au reload le toggle
// repart à off, un re-toggle upsert/supprime sans dommage grâce aux ids fixes).

interface MockDataState {
  actif: boolean
  occupe: boolean
  basculer: () => Promise<void>
}

export const useMockData = create<MockDataState>((set, get) => ({
  actif: false,
  occupe: false,
  basculer: async () => {
    if (get().occupe) return
    const prochain = !get().actif
    set({ occupe: true })
    try {
      if (prochain) await insertMockInstances()
      else await removeMockInstances()
      set({ actif: prochain })
    } catch (_) {
      // échec réseau/RLS : on laisse l'état inchangé (le toggle ne bascule pas).
    } finally {
      set({ occupe: false })
    }
  },
}))
