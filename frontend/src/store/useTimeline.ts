import { create } from 'zustand'

// Horloge de la « couche sémantique » : un curseur temporel (epoch ms) qui
// balaye la chronologie d'extraction (horodatages `cree_le` des instances et du
// journal d'agent). En mode SUIVI (live), le curseur est collé au dernier
// évènement → tout s'affiche. Dès qu'on scrube, le suivi se coupe et les
// consommateurs (carte, objets, couche sémantique, trajets) n'affichent que ce
// qui existait à l'instant du curseur → on « rejoue » l'apparition des entités.

/** Le run entier se rejoue en ~12 s au bouton lecture (peu importe sa durée réelle). */
const DUREE_REPLAY_MS = 12000

interface TimelineState {
  /** Epoch ms du premier évènement (début du run). */
  t0: number
  /** Epoch ms du dernier évènement (« maintenant »). */
  tMax: number
  /** Epoch ms de la position du curseur. */
  curseur: number
  /** Suivi live : curseur collé à tMax, tout est visible. */
  suit: boolean
  /** Relecture en cours (curseur avancé automatiquement). */
  enLecture: boolean
  /** Met à jour les bornes depuis les données (appelé par la Timeline). */
  setBornes: (t0: number, tMax: number) => void
  /** Positionne le curseur (scrub manuel) → coupe le suivi. */
  setCurseur: (ms: number) => void
  /** Repasse en live (curseur = tMax). */
  activerSuivi: () => void
  /** Lance/arrête la relecture. */
  play: () => void
  pause: () => void
  /** Ramène le curseur au début. */
  revenirDebut: () => void
}

let raf = 0
let dernier = 0
function stopRaf() {
  if (raf) cancelAnimationFrame(raf)
  raf = 0
}

export const useTimeline = create<TimelineState>((set, get) => ({
  t0: 0,
  tMax: 0,
  curseur: 0,
  suit: true,
  enLecture: false,

  setBornes: (t0, tMax) => {
    const s = get()
    // Premier chargement (t0 encore 0) ou suivi live → le curseur suit tMax.
    const curseur = s.suit || s.t0 === 0 ? tMax : Math.min(s.curseur, tMax)
    set({ t0, tMax, curseur })
  },

  setCurseur: (ms) => {
    stopRaf()
    const { t0, tMax } = get()
    set({ curseur: Math.max(t0, Math.min(tMax, ms)), suit: false, enLecture: false })
  },

  activerSuivi: () => {
    stopRaf()
    set((s) => ({ suit: true, enLecture: false, curseur: s.tMax }))
  },

  play: () => {
    const s = get()
    if (s.tMax <= s.t0) return
    stopRaf()
    // Si on est déjà au bout, on repart du début.
    const depart = s.curseur >= s.tMax ? s.t0 : s.curseur
    set({ enLecture: true, suit: false, curseur: depart })
    dernier = performance.now()
    const tick = (now: number) => {
      const st = get()
      if (!st.enLecture) return
      const span = st.tMax - st.t0 || 1
      const vitesse = span / DUREE_REPLAY_MS // ms-timeline par ms-réel
      const dt = now - dernier
      dernier = now
      const prochain = st.curseur + dt * vitesse
      if (prochain >= st.tMax) {
        set({ curseur: st.tMax })
        get().activerSuivi() // arrivé au bout → retour live
        return
      }
      set({ curseur: prochain })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
  },

  pause: () => {
    stopRaf()
    set({ enLecture: false })
  },

  revenirDebut: () => {
    stopRaf()
    set((s) => ({ curseur: s.t0, suit: false, enLecture: false }))
  },
}))
