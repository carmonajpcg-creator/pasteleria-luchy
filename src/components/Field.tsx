export const inputClass = 'min-h-12 w-full rounded-xl border bg-white px-4'

// Campo de formulario accesible: etiqueta asociada y mensaje de error anunciado (role="alert").
export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string
  label: string
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-4 flex flex-col gap-1">
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      {children}
      {hint && (
        <span id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </span>
      )}
    </div>
  )
}

/** Valor de aria-describedby según haya pista y/o error. */
export const describedBy = (id: string, { hint, error }: { hint?: boolean; error?: boolean }) =>
  [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
