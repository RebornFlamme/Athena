// Lecture de métadonnées audio côté client (durée), avant upload.

/**
 * Lit la durée d'un fichier audio sans le téléverser.
 *
 * Args:
 *   file: Fichier audio local.
 *
 * Returns:
 *   La durée en millisecondes (0 si illisible).
 */
export function lireDureeMs(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const audio = new Audio()
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : 0)
    }
    audio.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(0)
    }
    audio.src = url
  })
}

/** Formate une durée en millisecondes en `m:ss`. */
export function formaterMs(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
