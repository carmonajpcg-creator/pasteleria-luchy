import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Solo claves públicas (URL y anon key): la seguridad real la imponen las políticas RLS.
// Nunca usar service_role ni secrets en variables VITE_* (se publican en el build).
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string)
  : null
