import { categorySchema, parseAllergens, productSchema, toCategoryInput, toProductInput, type ProductValues } from './catalog/schema'
import { signedDelta } from './inventory/api'
import { availableActions, balanceCents } from './orders/transitions'
import { settingsSchema, toSettingsPatch, type SettingsValues } from './settings/schema'

describe('transiciones de pedido', () => {
  const kinds = (status: Parameters<typeof availableActions>[0]) =>
    availableActions(status).map((a) => (a.kind === 'advance' ? `advance:${a.to}` : a.kind))

  it('refleja la máquina de estados de la BD', () => {
    expect(kinds('pending_contact')).toEqual(['confirm', 'cancel'])
    expect(kinds('confirmed')).toEqual(['advance:in_preparation', 'cancel'])
    expect(kinds('in_preparation')).toEqual(['advance:ready', 'cancel'])
    expect(kinds('ready')).toEqual(['advance:delivered'])
  })
  it('un pedido entregado o cancelado no tiene acciones', () => {
    expect(availableActions('delivered')).toEqual([])
    expect(availableActions('cancelled')).toEqual([])
  })
  it('un pedido listo ya no se puede cancelar (igual que cancel_order)', () => {
    expect(kinds('ready')).not.toContain('cancel')
  })
})

describe('saldo pendiente', () => {
  it('descuenta pagos y suma reembolsos', () => {
    expect(balanceCents(10000, [])).toBe(10000)
    expect(balanceCents(10000, [{ amount_cents: 4000, is_refund: false }])).toBe(6000)
    expect(
      balanceCents(10000, [
        { amount_cents: 10000, is_refund: false },
        { amount_cents: 2500, is_refund: true },
      ]),
    ).toBe(2500)
  })
  it('nunca es negativo (pago de más)', () => {
    expect(balanceCents(10000, [{ amount_cents: 12000, is_refund: false }])).toBe(0)
  })
})

describe('signedDelta (inventario)', () => {
  it('producción y compra suman; merma resta', () => {
    expect(signedDelta('production', 'subtract', '5')).toBe(5)
    expect(signedDelta('purchase', 'subtract', '3')).toBe(3)
    expect(signedDelta('waste', 'add', '2')).toBe(-2)
  })
  it('el ajuste manual usa la dirección elegida', () => {
    expect(signedDelta('adjustment', 'add', '4')).toBe(4)
    expect(signedDelta('adjustment', 'subtract', '4')).toBe(-4)
  })
  it.each(['', '0', '-3', '1.5', 'abc', '1234567'])('rechaza «%s»', (amount) => {
    expect(signedDelta('adjustment', 'add', amount)).toBeNull()
  })
})

describe('esquema de categoría', () => {
  const valid = { name: 'Pasteles', slug: 'pasteles', sortOrder: '1', active: true }
  it('acepta datos válidos y los convierte', () => {
    expect(categorySchema.safeParse(valid).success).toBe(true)
    expect(toCategoryInput(valid)).toEqual({ name: 'Pasteles', slug: 'pasteles', sort_order: 1, active: true })
  })
  it('rechaza claves de URL inválidas y orden no numérico', () => {
    expect(categorySchema.safeParse({ ...valid, slug: 'Con Espacios' }).success).toBe(false)
    expect(categorySchema.safeParse({ ...valid, sortOrder: 'uno' }).success).toBe(false)
    expect(categorySchema.safeParse({ ...valid, name: ' ' }).success).toBe(false)
  })
})

describe('esquema de producto', () => {
  const valid: ProductValues = {
    name: 'Pastel de fresa',
    slug: 'pastel-de-fresa',
    sku: 'PAS-100',
    description: 'Descripción',
    categoryId: 'cat-1',
    price: '650.50',
    fulfillmentType: 'made_to_order',
    leadTimeHours: '48',
    lowStockThreshold: '3',
    allergens: 'gluten, lácteos ; huevo, gluten',
    allergensVerified: false,
    featured: false,
    active: true,
  }
  it('convierte pesos a centavos y alérgenos a lista sin duplicados', () => {
    expect(productSchema.safeParse(valid).success).toBe(true)
    const input = toProductInput(valid)
    expect(input.price_cents).toBe(65050)
    expect(input.allergens).toEqual(['gluten', 'lácteos', 'huevo'])
    expect(input.lead_time_hours).toBe(48)
    expect(input).not.toHaveProperty('stock_quantity') // el stock solo cambia con adjust_stock
  })
  it('rechaza precio inválido, categoría vacía y SKU vacío', () => {
    expect(productSchema.safeParse({ ...valid, price: '12.345' }).success).toBe(false)
    expect(productSchema.safeParse({ ...valid, price: '-1' }).success).toBe(false)
    expect(productSchema.safeParse({ ...valid, categoryId: '' }).success).toBe(false)
    expect(productSchema.safeParse({ ...valid, sku: '' }).success).toBe(false)
    expect(productSchema.safeParse({ ...valid, leadTimeHours: '-4' }).success).toBe(false)
  })
  it('parseAllergens tolera vacíos', () => {
    expect(parseAllergens('')).toEqual([])
    expect(parseAllergens(' , ;')).toEqual([])
  })
})

describe('esquema de configuración', () => {
  const valid: SettingsValues = {
    storeName: 'Pastelería Luchy',
    whatsapp: '528787030104',
    contactEmail: '',
    contactPhone: '',
    scheduleText: '',
    coverageText: '',
    timezone: 'America/Matamoros',
    orderExpiryHours: '48',
    confirmWhatsapp: false,
  }
  const issue = (over: Partial<SettingsValues>) => {
    const r = settingsSchema.safeParse({ ...valid, ...over })
    return r.success ? null : r.error.issues[0]?.message
  }
  it('acepta datos válidos y deja vacíos como nulos', () => {
    expect(issue({})).toBeNull()
    const patch = toSettingsPatch({ ...valid, whatsapp: '' })
    expect(patch.whatsapp_number).toBeNull()
    expect(patch.contact_email).toBeNull()
    expect(patch.order_expiry_hours).toBe(48)
  })
  it('valida WhatsApp en formato internacional sin «+»', () => {
    expect(issue({ whatsapp: '+528787030104' })).toMatch(/dígitos/)
    expect(issue({ whatsapp: '8787030104x' })).toMatch(/dígitos/)
    expect(issue({ whatsapp: '123' })).toMatch(/dígitos/)
    expect(issue({ whatsapp: '' })).toBeNull() // aún sin definir
  })
  it('valida zona horaria, caducidad y correo', () => {
    expect(issue({ timezone: 'No/Existe' })).toMatch(/Zona horaria/)
    expect(issue({ orderExpiryHours: '0' })).toMatch(/horas/)
    expect(issue({ orderExpiryHours: '721' })).toMatch(/horas/)
    expect(issue({ contactEmail: 'sin-arroba' })).toMatch(/correo/i)
  })
})
