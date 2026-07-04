import { create } from 'zustand'
import { listAppels } from '../data/appelsApi'
import { lancerTranscription } from '../data/transcribeApi'
import type { Appel } from '../typesSimulation'

// Moteur de lecture de la simulation active (Web Audio API).
// Chaque appel : <audio> → MediaElementSource → AnalyserNode.
// - L'analyser alimente l'histogramme « voix live » (getAnalyseur).
// - MUET par défaut : l'analyser n'est PAS relié à la sortie. On voit la voix
//   bouger sans l'entendre. `basculerEcoute` relie/coupe l'analyser à la sortie.
// Handles hors du state réactif (non sérialisables).

interface Noeud {
  audio: HTMLAudioElement
  source: MediaElementAudioSourceNode
  analyser: AnalyserNode
  /** Sortie captée en MediaStream (muette) → alimente un MediaRecorder pour le
   *  visualiseur live du feed. Séparée de ctx.destination (reste inaudible). */
  dest: MediaStreamAudioDestinationNode
  ecoute: boolean
}

let ctx: AudioContext | null = null
const noeuds = new Map<string, Noeud>()
let timers: ReturnType<typeof setTimeout>[] = []
let raf = 0
let t0 = 0
let dureeTotaleMs = 0
let simAppels: Appel[] = []
let dernierActifs: string[] = []

/** Analyser FFT d'un appel (pour l'histogramme). Null si pas en lecture. */
export function getAnalyseur(id: string): AnalyserNode | null {
  return noeuds.get(id)?.analyser ?? null
}

/** MediaStream (muet) d'un appel → source d'un MediaRecorder pour le visualiseur
 *  live. Null si l'appel n'est pas en lecture. */
export function getStream(id: string): MediaStream | null {
  return noeuds.get(id)?.dest.stream ?? null
}

function memeContenu(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i])
}

function nettoyer() {
  if (raf) cancelAnimationFrame(raf)
  raf = 0
  timers.forEach((t) => clearTimeout(t))
  timers = []
  noeuds.forEach((n) => {
    n.audio.pause()
    n.audio.src = ''
    try {
      n.source.disconnect()
      n.analyser.disconnect()
      n.dest.disconnect()
    } catch {
      /* déjà déconnecté */
    }
  })
  noeuds.clear()
  if (ctx) {
    void ctx.close().catch(() => {})
    ctx = null
  }
  simAppels = []
  dernierActifs = []
}

interface PlaybackState {
  statut: 'arret' | 'lecture'
  positionMs: number
  /** Appels en cours de diffusion (fenêtre temporelle) — histogramme animé. */
  actifs: string[]
  /** Appels dont l'écoute est activée (audibles). */
  ecoutes: string[]
  lancer: () => Promise<void>
  revenirDebut: () => Promise<void>
  couper: () => void
  /** Active/coupe l'écoute d'un flux (le relie/déconnecte de la sortie). */
  basculerEcoute: (id: string) => void
}

export const useSimulationPlayback = create<PlaybackState>((set, get) => ({
  statut: 'arret',
  positionMs: 0,
  actifs: [],
  ecoutes: [],

  lancer: async () => {
    nettoyer()
    // AudioContext créé/repris dans le geste utilisateur (avant le réseau) —
    // sinon la politique autoplay peut bloquer le son.
    ctx = new AudioContext()
    await ctx.resume().catch(() => {})
    const appels = await listAppels().catch(() => [])
    if (appels.length === 0) {
      nettoyer()
      set({ statut: 'arret', positionMs: 0, actifs: [], ecoutes: [] })
      return
    }
    simAppels = appels
    dureeTotaleMs = appels.reduce((m, a) => Math.max(m, a.ts_debut_ms + a.duree_ms), 0)
    t0 = performance.now()
    set({ statut: 'lecture', positionMs: 0, actifs: [], ecoutes: [] })

    // Déclenche le job de transcription serveur (fire-and-forget). Les segments
    // arrivent dans Supabase et s'affichent via Realtime — indépendant de la
    // lecture audio du navigateur. N'échoue jamais la lecture si le back est KO.
    void lancerTranscription(appels.map((a) => a.id)).catch(() => {})

    for (const a of appels) {
      const audio = new Audio()
      audio.crossOrigin = 'anonymous'
      audio.preload = 'auto'
      audio.src = a.audio_url
      const source = ctx.createMediaElementSource(audio)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 64
      analyser.smoothingTimeConstant = 0.7
      source.connect(analyser) // pas de connexion à la sortie → muet
      // Capture muette en MediaStream (pour le MediaRecorder du visualiseur live).
      const dest = ctx.createMediaStreamDestination()
      source.connect(dest)
      noeuds.set(a.id, { audio, source, analyser, dest, ecoute: false })
      const jouer = () => void audio.play().catch(() => {})
      if (a.ts_debut_ms <= 0) jouer()
      else timers.push(setTimeout(jouer, a.ts_debut_ms))
    }

    const tick = () => {
      if (get().statut !== 'lecture') return
      const pos = performance.now() - t0
      const actifs = simAppels
        .filter((a) => pos >= a.ts_debut_ms && pos < a.ts_debut_ms + Math.max(a.duree_ms, 800))
        .map((a) => a.id)
      if (memeContenu(actifs, dernierActifs)) {
        set({ positionMs: pos })
      } else {
        dernierActifs = actifs
        set({ positionMs: pos, actifs })
      }
      if (pos <= dureeTotaleMs + 500) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
  },

  revenirDebut: async () => {
    await get().lancer()
  },

  couper: () => {
    nettoyer()
    set({ statut: 'arret', positionMs: 0, actifs: [], ecoutes: [] })
  },

  basculerEcoute: (id) => {
    const n = noeuds.get(id)
    const ecoutes = get().ecoutes
    const active = !ecoutes.includes(id)
    if (n && ctx) {
      try {
        if (active) n.analyser.connect(ctx.destination)
        else n.analyser.disconnect(ctx.destination)
        n.ecoute = active
      } catch {
        /* connexion/déconnexion déjà dans l'état voulu */
      }
    }
    set({ ecoutes: active ? [...ecoutes, id] : ecoutes.filter((x) => x !== id) })
  },
}))
