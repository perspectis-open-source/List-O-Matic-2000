/**
 * @file main.tsx
 * @description Entry point: mounts the React app with StrictMode and root element.
 * @module List-O-Matic-2000/client
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
