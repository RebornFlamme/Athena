import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { SchemaEditorPage } from './components/SchemaEditorPage'
import '@xyflow/react/dist/style.css'
import './index.css'

const router = createBrowserRouter([
  {
    path: '/',
    element: <SchemaEditorPage />,
  },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
