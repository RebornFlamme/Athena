import { Link, useLocation } from 'react-router-dom'
import { Database, LayoutDashboard, Network, Radio, Settings, Truck } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { ThemeToggle } from './ThemeToggle'

const items = [
  { title: 'Dashboard', url: '/tableau-de-bord', icon: LayoutDashboard },
  { title: 'Schema editor', url: '/', icon: Network },
  { title: 'Database', url: '/ressources', icon: Database },
  { title: 'Simulation', url: '/flux', icon: Radio },
  { title: 'Vehicles', url: '/coquille', icon: Truck },
  { title: 'Settings', url: '/parametres', icon: Settings },
]

export function AppSidebar() {
  const { pathname } = useLocation()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-1 py-1.5">
          <img
            src="/logo-athena.png"
            alt="Athena"
            className="h-16 w-auto shrink-0 object-contain group-data-[collapsible=icon]:h-8 dark:invert"
          />
          <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-base font-semibold">Athena</span>
            <span className="truncate text-xs text-muted-foreground">Crisis management</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={pathname === item.url} tooltip={item.title}>
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <ThemeToggle />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
