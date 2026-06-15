import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import CameraApp from './CameraApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CameraApp />
  </StrictMode>,
)
