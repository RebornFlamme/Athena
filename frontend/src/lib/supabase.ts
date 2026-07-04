import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** true si les variables d'environnement Supabase sont configurées. */
export const isSupabaseConfigured = Boolean(url && anonKey)

if (!isSupabaseConfigured) {
  // Ne bloque pas l'app : l'UI affiche une bannière d'aide à la place.
  console.warn(
    '[Athena] Supabase non configuré. Copie frontend/.env.example en .env.local ' +
      'et renseigne VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.',
  )
}

// Client créé avec des placeholders si non configuré : les appels échoueront
// proprement (catchés dans le store) plutôt que de crasher au chargement.
export const supabase = createClient(
  url ?? 'http://localhost:54321',
  anonKey ?? 'public-anon-key',
)
