// Déclenche le job de transcription serveur (backend Render).
// L'URL HTTP est dérivée de VITE_STT_WS_URL (wss://…/ws → https://…) pour ne pas
// dupliquer la configuration.

function httpBase(): string {
  const ws = (import.meta.env.VITE_STT_WS_URL as string | undefined) ?? 'ws://localhost:8000/ws'
  return ws
    .replace(/^wss:/i, 'https:')
    .replace(/^ws:/i, 'http:')
    .replace(/\/ws\/?$/i, '')
}

/**
 * Demande au serveur de (re)transcrire les appels et d'écrire les segments dans
 * Supabase. Fire-and-forget : le serveur répond tout de suite, les segments
 * arrivent ensuite via Realtime.
 *
 * @param appelIds Optionnel — restreint aux appels donnés (sinon : tous).
 */
export async function lancerTranscription(appelIds?: string[]): Promise<void> {
  const res = await fetch(`${httpBase()}/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(appelIds ? { appel_ids: appelIds } : {}),
  })
  if (!res.ok) throw new Error(`transcribe HTTP ${res.status}`)
}

/**
 * Coupe le run serveur en cours (transcription + agents). Appelé quand on coupe
 * la simulation — sinon les jobs continueraient de tourner côté backend.
 * Fire-and-forget.
 */
export async function arreterTranscription(): Promise<void> {
  const res = await fetch(`${httpBase()}/stop`, { method: 'POST' })
  if (!res.ok) throw new Error(`stop HTTP ${res.status}`)
}
