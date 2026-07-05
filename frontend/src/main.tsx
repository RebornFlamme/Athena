import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { SchemaEditorPage } from './components/SchemaEditorPage'
import { PlaceholderPage } from './components/PlaceholderPage'
import { DashboardPage } from './components/dashboard/DashboardPage'
import { SimulationPage } from './components/simulation/SimulationPage'
import { CoquillePage } from './components/coquille/CoquillePage'
import '@fontsource-variable/geist'
import '@xyflow/react/dist/style.css'
import 'dockview-react/dist/styles/dockview.css'
import './index.css'

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <SchemaEditorPage /> },
      { path: '/flux', element: <SimulationPage /> },
      { path: '/tableau-de-bord', element: <DashboardPage /> },
      { path: '/coquille', element: <CoquillePage /> },
      { path: '/ressources', element: <PlaceholderPage title="Ressources" /> },
      { path: '/parametres', element: <PlaceholderPage title="Paramètres" /> },
    ],
  },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
