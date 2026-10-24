import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { db, unwrap } from '../lib/client'

const POLL_MS = 30_000
const STORAGE_KEY = 'luchy.avisosPedidos'

interface DashboardCounts {
  orders_by_status: { pending_contact?: number }
}

const readEnabled = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

// Pitido corto generado con Web Audio (sin archivos de sonido). Falla en silencio si el navegador lo impide.
function beep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    osc.frequency.value = 880
    osc.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.25)
    osc.onended = () => void ctx.close()
  } catch {
    /* sin audio disponible */
  }
}

/**
 * Pedidos pendientes de contacto con revisión periódica. Mientras haya pendientes, antepone «(n)» al título de la
 * pestaña. Si el administrador activó los avisos, suena un pitido y se muestra una notificación del navegador
 * cuando llega un pedido nuevo (solo con el panel abierto: no hay notificaciones push).
 */
export function useOrderAlerts() {
  const dashboard = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => unwrap<DashboardCounts>(db().rpc('admin_dashboard')),
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: true,
  })
  const pending = dashboard.data?.orders_by_status.pending_contact ?? 0
  const [enabled, setEnabled] = useState(readEnabled)
  const previous = useRef<number | null>(null)

  useEffect(() => {
    if (dashboard.data === undefined) return
    const before = previous.current
    previous.current = pending
    if (before === null || pending <= before || !enabled) return
    beep()
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Pedido nuevo', { body: `Tienes ${pending} pedido${pending === 1 ? '' : 's'} pendiente${pending === 1 ? '' : 's'} de contacto.` })
    }
  }, [pending, enabled, dashboard.data])

  // El título lo reescribe cada pantalla (usePageTitle); se vigila para conservar el contador.
  useEffect(() => {
    const prefix = pending > 0 ? `(${pending}) ` : ''
    const apply = () => {
      const base = document.title.replace(/^\(\d+\) /, '')
      if (document.title !== prefix + base) document.title = prefix + base
    }
    apply()
    const node = document.querySelector('title')
    if (!node) return
    const observer = new MutationObserver(apply)
    observer.observe(node, { childList: true, characterData: true, subtree: true })
    return () => {
      observer.disconnect()
      document.title = document.title.replace(/^\(\d+\) /, '')
    }
  }, [pending])

  const toggle = useCallback(async () => {
    const next = !enabled
    if (next && 'Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
    try {
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
    } catch {
      /* sin almacenamiento: el ajuste dura mientras la pestaña siga abierta */
    }
    setEnabled(next)
    if (next) beep() // confirma que el sonido funciona
  }, [enabled])

  return { pending, enabled, toggle }
}
