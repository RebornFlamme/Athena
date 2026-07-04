import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { SchemaEditorPage } from './components/SchemaEditorPage'
import { PlaceholderPage } from './components/PlaceholderPage'
import '@xyflow/react/dist/style.css'
import './index.css'

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <SchemaEditorPage /> },
      { path: '/tableau-de-bord', element: <PlaceholderPage title="Tableau de bord" /> },
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
