import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

const CLIENT_VERSION = __APP_VERSION__
const RELOAD_ONCE_KEY = 'pulse_app_reload_once'

function isSkewRelatedError(error) {
  const message = String(error?.message || error || '').toLowerCase()
  return (
    message.includes('loading chunk') ||
    message.includes('failed to fetch dynamically imported module') ||
    message.includes('importing a module script failed') ||
    message.includes('chunkloaderror')
  )
}

function reloadOnce() {
  const reloaded = sessionStorage.getItem(RELOAD_ONCE_KEY)
  if (reloaded === '1') {
    return
  }

  sessionStorage.setItem(RELOAD_ONCE_KEY, '1')
  window.location.replace(`${window.location.pathname}?v=${Date.now()}${window.location.hash || ''}`)
}

async function checkVersionSkew() {
  try {
    const response = await fetch('/api/version', { cache: 'no-store', credentials: 'include' })
    if (!response.ok) {
      return
    }

    const data = await response.json()
    const serverVersion = String(data?.version || '')
    if (serverVersion && CLIENT_VERSION && serverVersion !== CLIENT_VERSION) {
      reloadOnce()
    }
  } catch {
  }
}

window.addEventListener('error', (event) => {
  if (isSkewRelatedError(event?.error || event?.message)) {
    reloadOnce()
  }
})

window.addEventListener('unhandledrejection', (event) => {
  if (isSkewRelatedError(event?.reason)) {
    reloadOnce()
  }
})

checkVersionSkew()

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
