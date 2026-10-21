import { useQuery } from '@tanstack/react-query'
import { toIsoDate } from '../../lib/dates'
import { supabase } from '../../lib/supabase'
import type { DayAvailability } from './availabilityDays'

export async function fetchAvailability(
  from: string,
  to: string,
  leadHours: number,
  madeToOrder: boolean,
): Promise<DayAvailability[]> {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { data, error } = await supabase.rpc('get_availability', {
    p_from: from,
    p_to: to,
    p_lead_hours: leadHours,
    p_made_to_order: madeToOrder,
  })
  if (error) throw error
  return data as DayAvailability[]
}

/**
 * Disponibilidad de los próximos días según lo que lleva el carrito. La clave de consulta incluye
 * la fecha de hoy para no reutilizar datos de ayer si la pestaña queda abierta varios días.
 */
export function useAvailability(leadHours: number, madeToOrder: boolean, enabled: boolean) {
  const today = toIsoDate(new Date())
  const end = new Date()
  end.setDate(end.getDate() + 100)
  return useQuery({
    queryKey: ['availability', today, leadHours, madeToOrder],
    queryFn: () => fetchAvailability(today, toIsoDate(end), leadHours, madeToOrder),
    enabled,
    staleTime: 60_000,
    retry: 1,
  })
}
