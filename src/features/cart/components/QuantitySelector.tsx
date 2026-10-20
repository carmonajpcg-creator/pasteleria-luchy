import { MAX_QUANTITY } from '../store'

interface Props {
  value: number
  onChange: (value: number) => void
  name: string
}

const button =
  'inline-flex size-12 items-center justify-center rounded-full border border-line bg-white text-xl font-semibold disabled:text-muted'

// Selector −/+ unificado (revisión R9). Etiquetas con el nombre del producto para lectores de pantalla.
export function QuantitySelector({ value, onChange, name }: Props) {
  return (
    <div role="group" aria-label={`Cantidad de ${name}`} className="inline-flex items-center gap-2">
      <button
        type="button"
        className={button}
        aria-label={`Quitar una unidad de ${name}`}
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <span aria-live="polite" className="min-w-8 text-center font-semibold">
        {value}
      </span>
      <button
        type="button"
        className={button}
        aria-label={`Agregar una unidad de ${name}`}
        disabled={value >= MAX_QUANTITY}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  )
}
