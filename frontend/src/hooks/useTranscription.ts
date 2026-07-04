import { useEffect, useState } from 'react'
import { SttSession, type SttStatut } from '../lib/sttStream'

export interface EtatTranscription {
  /** 'inactif' tant que le volet n'est pas ouvert. */
  statut: SttStatut | 'inactif'
  /** Détail d'erreur éventuel (ex. « Serveur STT injoignable »). */
  detail?: string
  /** Ligne interim en cours (grisée, mouvante). */
  interim: string
  /** Segments `is_final` accumulés, dans l'ordre. */
  finals: string[]
  /** Code langue détecté par Chirp 3 (ex. « fr-fr »). */
  langue: string
}

/**
 * Pilote une {@link SttSession} sur le cycle de vie d'un volet. Démarre la
 * transcription quand `actif` passe à vrai avec une `audioUrl`, et coupe la
 * session au démontage / à la fermeture.
 *
 * @param audioUrl URL publique du fichier audio à transcrire (Supabase Storage).
 * @param actif Vrai quand le volet est ouvert (déclenche/arrête la session).
 */
export function useTranscription(audioUrl: string | null, actif: boolean): EtatTranscription {
  const [statut, setStatut] = useState<SttStatut | 'inactif'>('inactif')
  const [detail, setDetail] = useState<string>()
  const [interim, setInterim] = useState('')
  const [finals, setFinals] = useState<string[]>([])
  const [langue, setLangue] = useState('')

  useEffect(() => {
    if (!actif || !audioUrl) {
      setStatut('inactif')
      return
    }

    setStatut('connexion')
    setDetail(undefined)
    setInterim('')
    setFinals([])
    setLangue('')

    const session = new SttSession({
      onResultat: ({ text, isFinal, langue: lang }) => {
        if (isFinal) {
          if (text.trim()) setFinals((f) => [...f, text.trim()])
          setInterim('')
        } else {
          setInterim(text)
        }
        if (lang) setLangue(lang)
      },
      onStatut: (s, d) => {
        setStatut(s)
        if (d) setDetail(d)
      },
    })

    void session.start(audioUrl)
    return () => session.stop()
  }, [audioUrl, actif])

  return { statut, detail, interim, finals, langue }
}
