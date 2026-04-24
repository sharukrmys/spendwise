import { useState, useEffect } from 'react'

// Module-level cache so the event isn't lost if component remounts before prompt fires
let _deferredPrompt: any = null

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  )
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export function usePwaInstall() {
  const [canInstall, setCanInstall] = useState(() => !isStandalone() && !!_deferredPrompt)
  const [installed, setInstalled] = useState(isStandalone)
  const [iosPrompt, setIosPrompt] = useState(false)

  useEffect(() => {
    if (isStandalone()) { setInstalled(true); return }

    const handleBefore = (e: Event) => {
      e.preventDefault()
      _deferredPrompt = e
      setCanInstall(true)
    }
    const handleInstalled = () => {
      _deferredPrompt = null
      setCanInstall(false)
      setInstalled(true)
    }
    window.addEventListener('beforeinstallprompt', handleBefore)
    window.addEventListener('appinstalled', handleInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBefore)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  const install = async (): Promise<boolean> => {
    if (isIos() && !isStandalone()) {
      setIosPrompt(true)
      return false
    }
    if (!_deferredPrompt) return false
    _deferredPrompt.prompt()
    const { outcome } = await _deferredPrompt.userChoice
    _deferredPrompt = null
    setCanInstall(false)
    return outcome === 'accepted'
  }

  return { canInstall: canInstall || (isIos() && !isStandalone()), installed, install, iosPrompt, setIosPrompt }
}
