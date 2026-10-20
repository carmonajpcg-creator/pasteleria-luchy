interface Props {
  title: string
  phase: string
}

// Marcador de posición hasta implementar la pantalla en su fase.
export function PlaceholderPage({ title, phase }: Props) {
  return (
    <section>
      <h1 className="mb-2 text-3xl font-bold">{title}</h1>
      <p className="text-muted">Pantalla pendiente de implementar ({phase}).</p>
    </section>
  )
}
