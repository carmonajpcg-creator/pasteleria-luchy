import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * ¿Hay una sesión abierta en este navegador? (null = todavía no se sabe.) Solo lee la sesión guardada:
 * no consulta el rol ni pide datos privados, así que no añade peticiones al visitante anónimo. Sirve
 * únicamente para elegir qué enlace mostrar; la autorización real la imponen la base de datos y el panel.
 */
export function useHasSession(): boolean | null {
  const [has, setHas] = useState<boolean | null>(supabase ? null : false)

  useEffect(() => {
    if (!supabase) return
    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setHas(Boolean(data.session))
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setHas(Boolean(session)))
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  return has
}
