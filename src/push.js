// Web Push helpers: subscribe a device, store it, send a test, unsubscribe.
import { supabase } from './supabaseClient.js'

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

// iOS only allows web push once the PWA is installed to the Home Screen.
export function isStandalone() {
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true
}

export function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export async function pushStatus() {
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = reg && (await reg.pushManager.getSubscription())
  return Notification.permission === 'granted' && sub ? 'on' : 'off'
}

export async function enablePush(clientId) {
  if (!pushSupported()) throw new Error('This device or browser doesn’t support notifications.')
  if (isIOS() && !isStandalone()) throw new Error('On iPhone, first add this app to your Home Screen (Share → Add to Home Screen), open it from there, then turn reminders on.')
  if (!VAPID_PUBLIC) throw new Error('Reminders aren’t configured yet.')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Notifications weren’t allowed. You can enable them in your browser settings.')
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) })
  }
  const j = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    { client_id: clientId, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth },
    { onConflict: 'endpoint' },
  )
  if (error) throw new Error(error.message)
  return sub
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = reg && (await reg.pushManager.getSubscription())
  if (sub) {
    const endpoint = sub.endpoint
    await sub.unsubscribe().catch(() => {})
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  }
}

export async function sendTestPush() {
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) throw new Error('Turn reminders on first.')
  const res = await fetch('/.netlify/functions/push-test', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON() }),
  })
  if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Could not send the test.') }
}
