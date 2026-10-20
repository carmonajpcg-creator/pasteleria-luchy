// Datos ficticios y deterministas para pruebas; no son productos ni precios comerciales.
const categories = [
  { id: 'c1', slug: 'pasteles', name: 'Pasteles', sort_order: 1 },
  { id: 'c2', slug: 'cupcakes', name: 'Cupcakes', sort_order: 2 },
  { id: 'c3', slug: 'postres-individuales-y-cajas', name: 'Postres individuales y cajas', sort_order: 3 },
]

const base = { allergens: [], allergens_verified: false, featured: false, available: true }

const products = [
  {
    ...base, id: 'p1', slug: 'pastel-tres-leches', sku: 'PAS-004', name: 'Pastel de tres leches',
    description: 'Bizcocho bañado en tres leches.', price_cents: 60000, lead_time_hours: 48,
    fulfillment_type: 'made_to_order', featured: true, category_id: 'c1', category_slug: 'pasteles', category_name: 'Pasteles',
  },
  {
    ...base, id: 'p2', slug: 'pastel-chocolate-fudge', sku: 'PAS-002', name: 'Pastel de chocolate fudge',
    description: 'Bizcocho de chocolate con cobertura fudge.', price_cents: 70000, lead_time_hours: 48,
    fulfillment_type: 'made_to_order', category_id: 'c1', category_slug: 'pasteles', category_name: 'Pasteles',
  },
  {
    ...base, id: 'p3', slug: 'cupcake-vainilla', sku: 'CUP-001', name: 'Cupcake de vainilla',
    description: 'Cupcake de vainilla con betún.', price_cents: 4500, lead_time_hours: 0,
    fulfillment_type: 'stock', category_id: 'c2', category_slug: 'cupcakes', category_name: 'Cupcakes',
  },
  {
    ...base, id: 'p4', slug: 'cupcake-chocolate', sku: 'CUP-002', name: 'Cupcake de chocolate',
    description: 'Cupcake de chocolate con betún.', price_cents: 4500, lead_time_hours: 0,
    fulfillment_type: 'stock', available: false, category_id: 'c2', category_slug: 'cupcakes', category_name: 'Cupcakes',
  },
  {
    ...base, id: 'p5', slug: 'mini-tiramisu', sku: 'POS-002', name: 'Mini tiramisú',
    description: 'Tiramisú en porción individual.', price_cents: 6000, lead_time_hours: 0,
    fulfillment_type: 'stock', featured: true, allergens: ['Gluten', 'Lácteos', 'Huevo'], allergens_verified: true,
    category_id: 'c3', category_slug: 'postres-individuales-y-cajas', category_name: 'Postres individuales y cajas',
  },
]

const settings = {
  store_name: 'Pastelería Luchy',
  whatsapp_number: '525500000000',
  contact_email: null,
  contact_phone: null,
  schedule_text: null,
  coverage_text: null,
  timezone: 'UTC',
}

export const fixtures = { categories, products, settings }
export type FixtureProduct = (typeof products)[number]
