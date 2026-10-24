// Edge Function: avisa por correo de un pedido nuevo. La invoca el disparador `orders_notify_new` (pg_net).
// Sin JWT de usuario (verify_jwt = false en config.toml): se autentica con el secreto compartido `x-webhook-secret`.
// Secrets requeridos: ORDER_WEBHOOK_SECRET, SMTP_USER, SMTP_PASSWORD, NOTIFY_TO (correos separados por coma),
// y SITE_URL (opcional, para el enlace al panel). SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.16'

const env = (name: string) => Deno.env.get(name) ?? ''

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const mxn = (cents: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(cents / 100) + ' MXN'

// Comparación en tiempo constante para no filtrar el secreto por tiempos de respuesta.
function sameSecret(a: string, b: string) {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  if (x.length !== y.length || x.length === 0) return false
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!
  return diff === 0
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  if (!sameSecret(req.headers.get('x-webhook-secret') ?? '', env('ORDER_WEBHOOK_SECRET'))) return json({ error: 'unauthorized' }, 401)

  let orderId: unknown
  try {
    orderId = ((await req.json()) as { order_id?: unknown }).order_id
  } catch {
    return json({ error: 'body' }, 400)
  }
  if (typeof orderId !== 'string' || !/^[0-9a-f-]{36}$/i.test(orderId)) return json({ error: 'order_id' }, 400)

  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
  const { data: order, error } = await admin
    .from('orders')
    .select(
      'folio, customer_name, customer_phone, customer_email, fulfillment, requested_date, notes, total_cents, order_items(name, quantity, unit_price_cents, customization)',
    )
    .eq('id', orderId)
    .maybeSingle()
  if (error || !order) return json({ error: 'not_found' }, 404)

  const items = (order.order_items ?? []) as { name: string; quantity: number; unit_price_cents: number; customization: string | null }[]
  const modo = order.fulfillment === 'delivery' ? 'Entrega a domicilio' : 'Recolección'
  const panel = env('SITE_URL') ? `${env('SITE_URL').replace(/\/$/, '')}/#/admin/pedidos` : ''

  const lines = items.map(
    (i) => `${i.quantity} × ${i.name} (${mxn(i.unit_price_cents)} c/u)${i.customization ? `\n   Personalización: ${i.customization}` : ''}`,
  )
  const text = [
    `Pedido nuevo ${order.folio} (pendiente de contacto)`,
    '',
    `Cliente: ${order.customer_name}`,
    `Teléfono: ${order.customer_phone}`,
    order.customer_email ? `Correo: ${order.customer_email}` : '',
    `${modo} · fecha solicitada: ${order.requested_date}`,
    '',
    ...lines,
    '',
    `Total estimado: ${mxn(order.total_cents)}`,
    order.notes ? `Notas: ${order.notes}` : '',
    '',
    'El pedido NO está confirmado: espera el mensaje del cliente por WhatsApp con este folio.',
    panel ? `Panel: ${panel}` : '',
  ]
    .filter((l, idx, all) => l !== '' || all[idx - 1] !== '')
    .join('\n')

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;color:#2D1B3D">
<h2 style="color:#7C3AED">Pedido nuevo ${escapeHtml(order.folio)}</h2>
<p><strong>${escapeHtml(order.customer_name)}</strong> · ${escapeHtml(order.customer_phone)}${order.customer_email ? ` · ${escapeHtml(order.customer_email)}` : ''}</p>
<p>${modo} · fecha solicitada: <strong>${escapeHtml(String(order.requested_date))}</strong></p>
<ul>${items
    .map(
      (i) =>
        `<li>${i.quantity} × ${escapeHtml(i.name)}${i.customization ? `<br><em>Personalización: ${escapeHtml(i.customization)}</em>` : ''}</li>`,
    )
    .join('')}</ul>
<p>Total estimado: <strong>${mxn(order.total_cents)}</strong></p>
${order.notes ? `<p>Notas: ${escapeHtml(order.notes)}</p>` : ''}
<p style="color:#6B7280;font-size:14px">El pedido <strong>no está confirmado</strong>: espera el mensaje del cliente por WhatsApp con este folio.</p>
${panel ? `<p><a href="${escapeHtml(panel)}">Abrir el panel de pedidos</a></p>` : ''}
</div>`

  const transport = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: env('SMTP_USER'), pass: env('SMTP_PASSWORD') },
  })
  const to = env('NOTIFY_TO').split(',').map((s) => s.trim()).filter(Boolean)
  if (to.length === 0) return json({ error: 'no_recipients' }, 500)

  try {
    await transport.sendMail({
      from: `"Pastelería Luchy" <${env('SMTP_USER')}>`,
      to,
      subject: `Pedido nuevo ${order.folio}`,
      text,
      html,
    })
  } catch {
    return json({ error: 'smtp' }, 502) // sin detalles internos en la respuesta
  }
  return json({ ok: true })
})
