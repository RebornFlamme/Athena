import { Moon, Sun } from 'lucide-react'
import { SidebarMenuButton } from '@/components/ui/sidebar'
import { useTheme } from '../store/useTheme'

/**
 * Bascule discrète clair/sombre, posée en pied de sidebar. Le thème est géré par
 * le store `useTheme` (classe `dark` sur <html> + localStorage), partagé avec les
 * surfaces qui doivent réagir (ex. thème dockview du dashboard).
 */
export function ThemeToggle() {
  const sombre = useTheme((s) => s.sombre)
  const basculer = useTheme((s) => s.basculer)

  const label = sombre ? 'Light mode' : 'Dark mode'

  return (
    <SidebarMenuButton onClick={basculer} tooltip={label} className="text-muted-foreground">
      {sombre ? <Sun /> : <Moon />}
      <span>{label}</span>
    </SidebarMenuButton>
  )
}
