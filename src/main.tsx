import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

// vite-plugin-pwa's autoUpdate only checks for a new service worker on its
// own schedule (registration / periodic browser checks), which can leave an
// already-open tab or installed PWA running a stale build for a long time.
// Poll explicitly so deploys propagate to open sessions within a minute.
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return
    setInterval(() => { registration.update() }, 60 * 1000)
  },
})

// When a new service worker takes control (after autoUpdate), reload all
// open tabs so they pick up fresh assets and avoid the blank-page bug.
if ('serviceWorker' in navigator) {
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloading) {
      reloading = true
      window.location.reload()
    }
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
