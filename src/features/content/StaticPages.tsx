import { Loading, LoadError } from '../../components/QueryState'
import { btnPrimary } from '../../components/ui'
import { usePageTitle } from '../../hooks/usePageTitle'
import { useStoreSettings } from '../catalog/hooks'
import { demoImages } from '../catalog/demoImages'

const pending = <span className="text-muted">por definir</span>

function Draft() {
  return (
    <p role="note" className="mb-4 rounded-xl bg-purple-100 p-3 text-sm">
      Texto provisional pendiente de revisión por la tienda y, en su caso, asesoría legal. No constituye una
      política vigente.
    </p>
  )
}

export function AboutPage() {
  usePageTitle('Nosotros')
  return (
    <section className="content-split">
      <div className="content-copy"><h1>Nosotros</h1>
      <p>
        Somos una pastelería que prepara pasteles, cupcakes, galletas, brownies y postres. La historia y las
        fotografías definitivas del negocio se publicarán aquí cuando la tienda las proporcione.
      </p><p className="mt-6">Desde un pequeño antojo hasta el pastel de una celebración: explora las opciones y cuéntanos cómo te gustaría compartirlo.</p></div>
      <figure className="relative"><img src={demoImages.cookies} width="1024" height="1024" alt="Imagen de ejemplo: galletas de chocolate" /><figcaption className="demo-caption">Imagen de ejemplo</figcaption></figure>
    </section>
  )
}

export function ContactPage() {
  usePageTitle('Contacto')
  const settings = useStoreSettings()
  const s = settings.data

  return (
    <section className="content-split">
      <div className="content-copy"><h1>Contacto</h1>
      <p>¿Planeamos algo dulce? Consulta nuestros datos y hablemos de tu pedido.</p>
      {settings.isPending && <Loading what="los datos de contacto" />}
      {settings.isError && <LoadError what="los datos de contacto" onRetry={() => void settings.refetch()} />}
      {s && (
        <>
          <dl className="contact-details">
            <div>
              <dt className="font-semibold">Teléfono</dt>
              <dd>{s.contact_phone ?? pending}</dd>
            </div>
            <div>
              <dt className="font-semibold">Correo</dt>
              <dd>{s.contact_email ?? pending}</dd>
            </div>
            <div>
              <dt className="font-semibold">Horarios</dt>
              <dd>{s.schedule_text ?? pending}</dd>
            </div>
            <div>
              <dt className="font-semibold">Cobertura de entregas</dt>
              <dd>{s.coverage_text ?? pending}</dd>
            </div>
          </dl>
          {s.whatsapp_number && (
            <a className={btnPrimary} href={`https://wa.me/${s.whatsapp_number}`} target="_blank" rel="noopener noreferrer">
              Escribir por WhatsApp<span className="sr-only"> (se abre en una pestaña nueva)</span>
            </a>
          )}
        </>
      )}</div>
      <figure className="relative"><img src={demoImages.cake} width="1024" height="1024" alt="Imagen de ejemplo: pastel de celebración con fresas" /><figcaption className="demo-caption">Imagen de ejemplo</figcaption></figure>
    </section>
  )
}

export function PrivacyPage() {
  usePageTitle('Aviso de privacidad')
  return (
    <section className="max-w-2xl">
      <h1 className="mb-3 text-3xl font-bold">Aviso de privacidad</h1>
      <Draft />
      <h2 className="mb-1 mt-4 text-xl font-bold">Datos que se solicitan</h2>
      <p>
        Al hacer un pedido se solicitan nombre, teléfono, correo (opcional), modalidad y fecha de entrega o
        recolección, y notas opcionales.
      </p>
      <h2 className="mb-1 mt-4 text-xl font-bold">Finalidad</h2>
      <p>Gestionar y confirmar tu pedido con la tienda. Responsable, plazos y derechos: por definir.</p>
    </section>
  )
}

export function TermsPage() {
  usePageTitle('Condiciones de pedido')
  return (
    <section className="max-w-2xl">
      <h1 className="mb-3 text-3xl font-bold">Condiciones de pedido</h1>
      <Draft />
      <ul className="list-disc pl-6">
        <li>El pedido no queda confirmado hasta que la tienda lo confirme contigo por WhatsApp.</li>
        <li>Los precios mostrados son provisionales y pueden cambiar.</li>
        <li>Anticipos, cambios, cancelaciones, cobertura y horarios: por definir.</li>
      </ul>
    </section>
  )
}
