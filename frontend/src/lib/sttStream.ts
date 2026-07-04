// Moteur de transcription live — port du chemin « lecture de fichier » du POC STT
// (`poc-stt/static/index.html`). Décode un fichier audio (Supabase Storage),
// le découpe en chunks de 80 ms, downsample en 16 kHz mono Int16 (LINEAR16) et
// les envoie en binaire sur le WebSocket du backend FastAPI, qui relaie vers
// Google Speech-to-Text V2 (Chirp 3). Les résultats reviennent en JSON.
//
// La session est MUETTE : elle ne branche jamais de sortie audio — elle ne fait
// que lire les échantillons pour les streamer. La lecture audible reste gérée
// par `useSimulationPlayback` (toggle « écoute »).

/** URL du WebSocket STT. Surchargeable via `VITE_STT_WS_URL`. */
const WS_URL =
  (import.meta.env.VITE_STT_WS_URL as string | undefined) ?? 'ws://localhost:8000/ws'

/** Durée d'un chunk audio envoyé au backend (80 ms, cf. POC). */
const CHUNK_DURATION = 0.08

export type SttStatut = 'connexion' | 'actif' | 'termine' | 'erreur'

/** Message de transcription remonté au consommateur. */
export interface SttResultat {
  text: string
  isFinal: boolean
  langue: string
}

export interface SttHandlers {
  onResultat: (r: SttResultat) => void
  onStatut: (statut: SttStatut, detail?: string) => void
}

/** Conversion Float32 [-1,1] → Int16 little-endian. */
function float32ToInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length)
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

/**
 * Downsample d'un buffer Float32 du taux natif (ex. 48 kHz) vers 16 kHz, avec
 * moyenne glissante (anti-aliasing simple), puis conversion Int16.
 */
function downsampleTo16k(input: Float32Array, inputSampleRate: number): Int16Array {
  if (inputSampleRate === 16000) return float32ToInt16(input)

  const ratio = inputSampleRate / 16000
  const outLength = Math.floor(input.length / ratio)
  const output = new Int16Array(outLength)

  for (let i = 0; i < outLength; i++) {
    const start = Math.floor(i * ratio)
    const end = Math.floor((i + 1) * ratio)
    let sum = 0
    let count = 0
    for (let j = start; j < end && j < input.length; j++) {
      sum += input[j]
      count++
    }
    const avg = count > 0 ? sum / count : 0
    const clamped = Math.max(-1, Math.min(1, avg))
    output[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff
  }
  return output
}

/**
 * Une session de transcription pour un fichier audio donné. `start(url)` lance
 * le flux ; `stop()` le coupe (nettoie timers + WebSocket). Réutilisable : une
 * instance par ouverture de volet.
 */
export class SttSession {
  private ws: WebSocket | null = null
  private buffer: AudioBuffer | null = null
  private pos = 0
  private chunkTimer: ReturnType<typeof setInterval> | null = null
  private closeTimer: ReturnType<typeof setTimeout> | null = null
  private stopped = false

  constructor(private readonly handlers: SttHandlers) {}

  async start(audioUrl: string): Promise<void> {
    this.handlers.onStatut('connexion')

    // 1. Télécharger + décoder le fichier (CORS OK : Supabase Storage renvoie *).
    let arrayBuffer: ArrayBuffer
    try {
      const resp = await fetch(audioUrl)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      arrayBuffer = await resp.arrayBuffer()
    } catch {
      this.fail('Audio introuvable')
      return
    }
    if (this.stopped) return

    const ctx = new AudioContext()
    try {
      this.buffer = await ctx.decodeAudioData(arrayBuffer)
    } catch {
      this.fail('Décodage audio impossible')
      void ctx.close().catch(() => {})
      return
    }
    void ctx.close().catch(() => {})
    if (this.stopped) return
    this.pos = 0

    // 2. Ouvrir le WebSocket (attendre l'ouverture avant de streamer).
    try {
      await this.connect()
    } catch {
      this.fail('Serveur STT injoignable')
      return
    }
    if (this.stopped) return

    this.handlers.onStatut('actif')

    // 3. Timer d'envoi des chunks (rythme temps réel).
    this.chunkTimer = setInterval(() => this.sendChunk(), CHUNK_DURATION * 1000)
  }

  private connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_URL)
      ws.binaryType = 'arraybuffer'
      this.ws = ws

      ws.onopen = () => resolve()
      ws.onerror = () => reject(new Error('ws error'))

      ws.onmessage = (event) => {
        let data: {
          type?: string
          text?: string
          is_final?: boolean
          language_code?: string
          message?: string
        }
        try {
          data = JSON.parse(event.data as string)
        } catch {
          return
        }
        if (data.type === 'transcript') {
          this.handlers.onResultat({
            text: data.text ?? '',
            isFinal: Boolean(data.is_final),
            langue: data.language_code && data.language_code !== 'unknown' ? data.language_code : '',
          })
        } else if (data.type === 'error') {
          this.handlers.onStatut('erreur', data.message ?? 'Erreur serveur STT')
        }
      }
    })
  }

  private sendChunk(): void {
    if (this.stopped || !this.buffer || !this.ws || this.ws.readyState !== WebSocket.OPEN) return

    const sampleRate = this.buffer.sampleRate
    const channel = this.buffer.getChannelData(0) // mono (canal 0)
    const total = channel.length

    if (this.pos >= total) {
      this.finish()
      return
    }

    const chunkSamples = Math.floor(sampleRate * CHUNK_DURATION)
    const end = Math.min(this.pos + chunkSamples, total)
    const chunk = channel.slice(this.pos, end)
    this.pos = end

    const int16 = downsampleTo16k(chunk, sampleRate)
    if (int16.length > 0) this.ws.send(int16.buffer)
  }

  /** Fin naturelle du fichier : on stoppe l'envoi et on laisse une fenêtre au
   *  backend pour émettre les derniers `final` avant de couper le flux
   *  (la déconnexion signale la fin de l'audio à Google). */
  private finish(): void {
    if (this.chunkTimer) {
      clearInterval(this.chunkTimer)
      this.chunkTimer = null
    }
    this.handlers.onStatut('termine')
    this.closeTimer = setTimeout(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.close(1000, 'fin fichier')
      this.ws = null
    }, 2000)
  }

  private fail(detail: string): void {
    this.handlers.onStatut('erreur', detail)
    this.stop()
  }

  stop(): void {
    this.stopped = true
    if (this.chunkTimer) {
      clearInterval(this.chunkTimer)
      this.chunkTimer = null
    }
    if (this.closeTimer) {
      clearTimeout(this.closeTimer)
      this.closeTimer = null
    }
    if (this.ws) {
      try {
        this.ws.close(1000, 'stop')
      } catch {
        /* déjà fermé */
      }
      this.ws = null
    }
    this.buffer = null
  }
}
