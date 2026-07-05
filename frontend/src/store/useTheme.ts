import { create } from 'zustand'

// Thème clair/sombre = présence de la classe `dark` sur <html> (variables shadcn).
// Store partagé pour que plusieurs surfaces réagissent au changement (toggle de
// sidebar + choix du thème dockview du dashboard). Le choix est persisté dans
// localStorage et réappliqué avant le paint par le script inline d'index.html.

function appliquer(sombre: boolean) {
  document.documentElement.classList.toggle('dark', sombre)
  try {
    localStorage.setItem('theme', sombre ? 'dark' : 'light')
  } catch (_) {
    // localStorage indisponible (mode privé) : bascule non persistée, tant pis.
  }
}

interface ThemeState {
  sombre: boolean
  basculer: () => void
}

export const useTheme = create<ThemeState>((set, get) => ({
  sombre:
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  basculer: () => {
    const prochain = !get().sombre
    appliquer(prochain)
    set({ sombre: prochain })
  },
}))
