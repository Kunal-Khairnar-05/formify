import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// The service worker keeps copies of everything the app fetches, so a second visit
// downloads nothing and the app works offline (see public/sw.js). Only in a build: in
// development it would serve stale copies of files that are being edited.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // without it the app still works, only without the copies
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
