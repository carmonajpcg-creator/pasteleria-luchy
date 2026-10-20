import { supabase } from '../../../lib/supabase'

/** Cliente de Supabase para el panel. Toda autorización real la imponen RLS y las RPC. */
export function db() {
  if (!supabase) throw new Error('Supabase no está configurado (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).')
  return supabase
}

/** Ejecuta una consulta de supabase-js y lanza el error de PostgREST si lo hay. */
export async function unwrap<T>(query: PromiseLike<{ data: unknown; error: unknown }>): Promise<T> {
  const { data, error } = await query
  if (error) throw error
  return data as T
}
