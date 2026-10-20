import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

interface AuthState {
  status: 'loading' | 'anon' | 'authed'
  user: User | null
}

const AuthContext = createContext<AuthState>({ status: 'loading', user: null })

const fromSession = (session: Session | null): AuthState =>
  session ? { status: 'authed', user: session.user } : { status: 'anon', user: null }

// Solo se monta bajo /admin: el sitio público nunca abre ni escucha sesiones.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(() =>
    supabase ? { status: 'loading', user: null } : { status: 'anon', user: null },
  )

  useEffect(() => {
    if (!supabase) return
    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setState(fromSession(data.session))
    })
    // Sin llamadas a Supabase dentro del callback (evita bloqueos del cliente de auth).
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setState(fromSession(session)))
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
