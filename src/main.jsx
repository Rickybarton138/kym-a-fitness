import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { THEME, applyTheme } from './themes.js'
import './styles.css'

applyTheme(THEME)

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Register the service worker for install / offline (production only).
if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
