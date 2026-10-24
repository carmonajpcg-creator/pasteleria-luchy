import { Link } from 'react-router-dom'
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

const h2 = 'mb-1 mt-6 text-xl font-bold'
const list = 'list-disc space-y-1 pl-6'

// Datos de contacto configurables (Panel → Configuración); mientras no existan se indica que están por definir.
function StoreContact() {
  const s = useStoreSettings().data
  return (
    <ul className={list}>
      <li>Correo: {s?.contact_email ?? pending}</li>
      <li>Teléfono: {s?.contact_phone ?? pending}</li>
    </ul>
  )
}

export function PrivacyPage() {
  usePageTitle('Aviso de privacidad')
  return (
    <section className="max-w-2xl">
      <h1 className="mb-3 text-3xl font-bold">Aviso de privacidad</h1>
      <Draft />
      <p>
        Este aviso explica qué datos personales se recaban en este sitio, para qué se usan y cómo puedes ejercer tus
        derechos, conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.
      </p>

      <h2 className={h2}>Responsable</h2>
      <p>
        La pastelería titular de este sitio (el nombre comercial y la razón social definitivos se publicarán aquí
        cuando la tienda los confirme) es responsable del tratamiento de tus datos. Para cualquier asunto de privacidad:
      </p>
      <StoreContact />

      <h2 className={h2}>Datos que recabamos</h2>
      <ul className={list}>
        <li>Nombre y teléfono, necesarios para gestionar tu pedido.</li>
        <li>Correo electrónico, opcional.</li>
        <li>Modalidad (entrega o recolección), fecha solicitada y notas o personalización del pedido.</li>
        <li>Fecha y hora en que aceptaste este aviso.</li>
      </ul>
      <p className="mt-2">
        No recabamos datos de tarjetas ni de cuentas bancarias: este sitio no cobra en línea. No pedimos datos
        sensibles; te pedimos no escribirlos en las notas. Si indicas alergias en las notas, solo se usan para preparar
        tu pedido con cuidado.
      </p>

      <h2 className={h2}>Para qué los usamos</h2>
      <p>Finalidades necesarias:</p>
      <ul className={list}>
        <li>Registrar tu pedido y asignarle un folio.</li>
        <li>Contactarte (por WhatsApp o teléfono) para confirmar el pedido, la fecha, el pago y la entrega.</li>
        <li>Preparar, entregar y llevar el control de pedidos, anticipos e inventario del negocio.</li>
        <li>Atender aclaraciones y cumplir obligaciones legales o fiscales aplicables.</li>
      </ul>
      <p className="mt-2">No usamos tus datos para publicidad ni los vendemos.</p>

      <h2 className={h2}>WhatsApp</h2>
      <p>
        Al terminar tu pedido, el sitio prepara un mensaje y abre WhatsApp para que tú decidas si lo envías. Abrir
        WhatsApp no envía nada por sí solo. Lo que escribas en esa conversación queda sujeto además a las políticas de
        WhatsApp.
      </p>

      <h2 className={h2}>Con quién los compartimos</h2>
      <p>
        No transferimos tus datos a terceros con fines propios. Usamos proveedores que almacenan o procesan la
        información en nuestro nombre, por ejemplo el servicio de base de datos y alojamiento del sitio, y solo para
        operar la tienda.
      </p>

      <h2 className={h2}>Cuánto tiempo los conservamos</h2>
      <p>
        Los conservamos el tiempo necesario para atender tu pedido y las obligaciones derivadas de él. Los pedidos que
        no se confirman caducan y dejan de estar activos. Puedes pedir que los suprimamos cuando ya no sean necesarios.
      </p>

      <h2 className={h2}>Tus derechos (ARCO)</h2>
      <p>
        Puedes solicitar el acceso a tus datos, su rectificación o cancelación, y oponerte a su tratamiento, así como
        revocar tu consentimiento. Escríbenos a los datos de contacto de arriba indicando tu nombre, tu teléfono y el
        folio de tu pedido para localizarlo. Responderemos por el mismo medio.
      </p>

      <h2 className={h2}>Almacenamiento en tu dispositivo</h2>
      <p>
        El sitio guarda en tu navegador el contenido de tu carrito y los datos necesarios para consultar tu pedido. No
        usamos cookies de publicidad ni de seguimiento. Puedes borrarlos desde la configuración de tu navegador.
      </p>

      <h2 className={h2}>Cambios a este aviso</h2>
      <p>Si este aviso cambia, publicaremos la versión vigente en esta página.</p>
    </section>
  )
}

export function TermsPage() {
  usePageTitle('Condiciones de pedido')
  const s = useStoreSettings().data
  return (
    <section className="max-w-2xl">
      <h1 className="mb-3 text-3xl font-bold">Condiciones de pedido</h1>
      <Draft />

      <h2 className={h2}>Cómo funciona tu pedido</h2>
      <ol className="list-decimal space-y-1 pl-6">
        <li>Eliges tus productos y llenas tus datos. El sitio registra tu pedido con un folio.</li>
        <li>Se abre WhatsApp con un mensaje listo. Tú decides enviarlo.</li>
        <li>La tienda revisa tu mensaje y confirma contigo disponibilidad, fecha, precio final y forma de pago.</li>
      </ol>
      <p className="mt-2">
        <strong>Tu pedido no está confirmado</strong> hasta que la tienda te lo confirme expresamente. Crear el pedido
        o abrir WhatsApp no lo confirma ni reserva existencias.
      </p>

      <h2 className={h2}>Precios y disponibilidad</h2>
      <ul className={list}>
        <li>El total mostrado es estimado. El precio y la disponibilidad se validan al registrar y al confirmar el pedido.</li>
        <li>Los precios están en pesos mexicanos (MXN).</li>
        <li>Los productos bajo pedido requieren la anticipación indicada y están sujetos a la capacidad del día.</li>
        <li>Las fotografías son ilustrativas; la decoración puede variar ligeramente por ser un producto artesanal.</li>
      </ul>

      <h2 className={h2}>Pedidos sin confirmar</h2>
      <p>
        Los pedidos que la tienda no confirma dentro del plazo establecido caducan automáticamente. Puedes hacer uno
        nuevo cuando quieras.
      </p>

      <h2 className={h2}>Pagos y anticipos</h2>
      <p>
        El sitio no cobra en línea. Si se requiere anticipo, la tienda te indicará el monto y los medios de pago por
        WhatsApp y lo registrará al recibirlo. No compartas datos de tu tarjeta en el sitio.
      </p>

      <h2 className={h2}>Cambios y cancelaciones</h2>
      <p>
        Avísanos lo antes posible por WhatsApp. Las condiciones de cambios, cancelaciones y reembolsos de anticipos
        dependen de qué tan cerca esté la fecha y de si el producto ya está en preparación; la tienda te las informará al
        confirmar tu pedido.
      </p>

      <h2 className={h2}>Entrega y recolección</h2>
      <ul className={list}>
        <li>Cobertura de entregas: {s?.coverage_text ?? pending}</li>
        <li>Horarios: {s?.schedule_text ?? pending}</li>
        <li>Las entregas a domicilio pueden tener un costo que la tienda te informará antes de confirmar.</li>
        <li>Revisa tu producto al recibirlo y avísanos de inmediato si hay algún problema.</li>
      </ul>

      <h2 className={h2}>Alérgenos</h2>
      <p>
        La información de alérgenos de cada producto puede estar pendiente de verificar; el sitio lo indica. Si tú o
        quien recibirá el pedido tienen alergias, avísanos por WhatsApp antes de confirmar. Nuestros productos se
        elaboran en una cocina donde se manejan ingredientes como gluten, lácteos, huevo y frutos secos.
      </p>

      <h2 className={h2}>Datos personales</h2>
      <p>
        Tratamos tus datos conforme al{' '}
        <Link to="/privacidad" className="font-semibold text-purple-700 underline">
          aviso de privacidad
        </Link>
        .
      </p>
    </section>
  )
}
