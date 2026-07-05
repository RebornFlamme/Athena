import { useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { SidebarMenuButton } from '@/components/ui/sidebar'

/**
 * Bascule discrète clair/sombre, posée en pied de sidebar. Le thème = présence de
 * la classe `dark` sur `<html>` (variables shadcn) ; le choix est persisté dans
 * `localStorage` et réappliqué avant le paint par le script inline d'index.html.
 */
export function ThemeToggle() {
  const [sombre, setSombre] = useState(
    () => document.documentElement.classList.contains('dark'),
  )

  function basculer() {
    const prochainSombre = !sombre
    document.documentElement.classList.toggle('dark', prochainSombre)
    try {
      localStorage.setItem('theme', prochainSombre ? 'dark' : 'light')
    } catch (_) {
      // localStorage indisponible (mode privé) : bascule non persistée, tant pis.
    }
    setSombre(prochainSombre)
  }

  const label = sombre ? 'Light mode' : 'Dark mode'

  return (
    <SidebarMenuButton
      onClick={basculer}
      tooltip={label}
      className="text-muted-foreground"
    >
      {sombre ? <Sun /> : <Moon />}
      <span>{label}</span>
    </SidebarMenuButton>
  )
}
