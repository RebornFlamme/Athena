import { Outlet } from 'react-router-dom'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from './AppSidebar'
import { ControleSimulation } from './simulation/ControleSimulation'

/** Shell de la webapp : sidebar persistante + zone de contenu (les pages). */
export function AppLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0 overflow-hidden">
        <Outlet />
      </SidebarInset>
      <ControleSimulation />
    </SidebarProvider>
  )
}
