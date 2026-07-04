import { create } from 'zustand'
import { listAppels } from '../data/appelsApi'

// Moteur de lecture de la simulation active : planifie la lecture de chaque
// appel (MP3) à son instant de déclenchement et pilote le curseur temporel.
// Les handles (audios, timers, RAF) vivent hors du state réactif.

let audios: HTMLAudioElement[] = []
let timers: ReturnType<typeof setTimeout>[] = []
let raf = 0
let t0 = 0
let dureeTotaleMs = 0

function nettoyer() {
  if (raf) cancelAnimationFrame(raf)
  raf = 0
  timers.forEach((t) => clearTimeout(t))
  timers = []
  audios.forEach((a) => {
    a.pause()
    a.src = ''
  })
  audios = []
}

interface PlaybackState {
  statut: 'arret' | 'lecture'
  positionMs: number
  /** Lance la simulation active depuis le début. */
  lancer: () => Promise<void>
  /** Coupe puis relance depuis t0. */
  revenirDebut: () => Promise<void>
  /** Coupe totalement (audio + curseur). */
  couper: () => void
}

export const useSimulationPlayback = create<PlaybackState>((set, get) => ({
  statut: 'arret',
  positionMs: 0,

  lancer: async () => {
    nettoyer()
    const appels = await listAppels().catch(() => [])
    if (appels.length === 0) {
      set({ statut: 'arret', positionMs: 0 })
      return
    }
    dureeTotaleMs = appels.reduce((m, a) => Math.max(m, a.ts_debut_ms + a.duree_ms), 0)
    t0 = performance.now()
    set({ statut: 'lecture', positionMs: 0 })

    for (const a of appels) {
      const audio = new Audio(a.audio_url)
      audio.preload = 'auto'
      audios.push(audio)
      const jouer = () => void audio.play().catch(() => {})
      if (a.ts_debut_ms <= 0) jouer()
      else timers.push(setTimeout(jouer, a.ts_debut_ms))
    }

    const tick = () => {
      if (get().statut !== 'lecture') return
      const pos = performance.now() - t0
      set({ positionMs: pos })
      if (pos <= dureeTotaleMs + 500) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
  },

  revenirDebut: async () => {
    await get().lancer()
  },

  couper: () => {
    nettoyer()
    set({ statut: 'arret', positionMs: 0 })
  },
}))
