// Mensajes para el administrador. Nunca se muestran details/hint de la BD (podrían revelar esquema).
// Los mensajes de las funciones propias (22023, P0001, P0002) ya están escritos en español.
const OWN_MESSAGE_CODES = new Set(['22023', 'P0001', 'P0002'])

export function adminErrorMessage(error: unknown): string {
  const e = error as { code?: string; message?: string; status?: number } | null
  if (!e) return 'Ocurrió un error inesperado. Inténtalo de nuevo.'
  if (e.code && OWN_MESSAGE_CODES.has(e.code) && e.message) return e.message
  switch (e.code) {
    case '23505':
      return 'Ya existe un registro con ese valor (por ejemplo, el SKU o la clave de URL).'
    case '23503':
      return 'No se puede completar: hay registros relacionados. Desactívalo en lugar de borrarlo.'
    case '23514':
      return 'El valor no cumple las reglas (por ejemplo, las existencias no pueden quedar en negativo).'
    case '42501':
      return 'No tienes permiso para realizar esta acción.'
    case 'PGRST301':
      return 'Tu sesión expiró. Vuelve a iniciar sesión.'
  }
  if (e.status === 401 || e.status === 403) return 'No tienes permiso o tu sesión expiró. Vuelve a iniciar sesión.'
  return 'Ocurrió un error inesperado. Inténtalo de nuevo.'
}
