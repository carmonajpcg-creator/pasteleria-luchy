// Estados de carga y error de las consultas remotas.
export function Loading({ what }: { what: string }) {
  return (
    <p role="status" className="text-muted">
      Cargando {what}…
    </p>
  )
}

export function LoadError({ what, onRetry }: { what: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-card border border-danger bg-white p-4 text-danger">
      <p>No pudimos cargar {what}. Revisa tu conexión e inténtalo de nuevo.</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-2 min-h-12 font-semibold underline">
          Reintentar
        </button>
      )}
    </div>
  )
}
