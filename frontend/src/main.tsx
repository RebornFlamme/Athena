import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { SchemaEditorPage } from './components/SchemaEditorPage'
import { InterventionsListPage } from './components/intervention/InterventionsListPage'
import { InterventionPage } from './components/intervention/InterventionPage'
import '@xyflow/react/dist/style.css'
import './index.css'

const router = createBrowserRouter([
  {
    path: '/',
    element: <SchemaEditorPage />,
  },
  {
    path: '/interventions',
    element: <InterventionsListPage />,
  },
  {
    path: '/intervention/:id',
    element: <InterventionPage />,
  },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
