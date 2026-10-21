import { useQuery } from '@tanstack/react-query'
import { toIsoDate } from '../../lib/dates'
import { supabase } from '../../lib/supabase'
import type { DayAvailability } from './availabilityDays'
import type { Fulfillment } from './types'

export async function fetchAvailability(
  from: string,
  to: string,
  leadHours: number,
  madeToOrder: boolean,
  fulfillment: Fulfillment,
): Promise<DayAvailability[]> {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { data, error } = await supabase.rpc('get_availability', {
    p_from: from,
    p_to: to,
    p_lead_hours: leadHours,
    p_made_to_order: madeToOrder,
    p_fulfillment: fulfillment,
  })
  if (error) throw error
  return data as DayAvailability[]
}

/**
 * Disponibilidad de los próximos días según lo que lleva el carrito y la modalidad elegida (hay días
 * sin recolección pero con entrega). La clave incluye la fecha de hoy para no reutilizar datos de
 * ayer si la pestaña queda abierta varios días.
 */
export function useAvailability(leadHours: number, madeToOrder: boolean, fulfillment: Fulfillment, enabled: boolean) {
  const today = toIsoDate(new Date())
  const end = new Date()
  end.setDate(end.getDate() + 100)
  return useQuery({
    queryKey: ['availability', today, leadHours, madeToOrder, fulfillment],
    queryFn: () => fetchAvailability(today, toIsoDate(end), leadHours, madeToOrder, fulfillment),
    enabled,
    staleTime: 60_000,
    retry: 1,
    // Al cambiar de modalidad se conserva la lista anterior mientras llega la nueva (sin parpadeo).
    placeholderData: (previous) => previous,
  })
}
