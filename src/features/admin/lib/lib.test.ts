import { adminErrorMessage } from './errors'
import { filterText } from './filterText'
import { imageStoragePath, MAX_IMAGE_BYTES, validateImage } from './image'
import { centsToPesosInput, parsePesos } from './pesos'
import { slugify, SLUG_PATTERN } from './slugify'

describe('parsePesos', () => {
  it.each([
    ['650', 65000],
    ['650.5', 65050],
    ['650.50', 65050],
    ['0.05', 5],
    ['$1,250.00', 125000],
    [' 12 ', 1200],
    ['0', 0],
  ])('«%s» → %i centavos', (input, cents) => {
    expect(parsePesos(input)).toBe(cents)
  })

  it.each(['', 'abc', '-5', '1.234', '1..2', '1,2,3.456', '.5', '5.', '1e3', '99999999999'])(
    'rechaza «%s»',
    (input) => {
      expect(parsePesos(input)).toBeNull()
    },
  )

  it('evita errores de punto flotante (19.99 × 100)', () => {
    expect(parsePesos('19.99')).toBe(1999)
    expect(parsePesos('0.29')).toBe(29)
  })

  it('ida y vuelta con centsToPesosInput', () => {
    for (const cents of [0, 5, 100, 1999, 65050, 123456]) {
      expect(parsePesos(centsToPesosInput(cents))).toBe(cents)
    }
    expect(centsToPesosInput(65000)).toBe('650.00')
    expect(centsToPesosInput(5)).toBe('0.05')
  })
})

describe('slugify', () => {
  it.each([
    ['Pastel de tres leches', 'pastel-de-tres-leches'],
    ['  Mini Tiramisú  ', 'mini-tiramisu'],
    ['Brownies & Barras!', 'brownies-barras'],
    ['Piña colada 2x1', 'pina-colada-2x1'],
    ['---', ''],
  ])('«%s» → «%s»', (input, expected) => {
    expect(slugify(input)).toBe(expected)
  })
  it('produce claves aceptadas por la BD', () => {
    expect(SLUG_PATTERN.test(slugify('Galletas con chispas de chocolate'))).toBe(true)
    expect(SLUG_PATTERN.test('Con Mayúsculas')).toBe(false)
    expect(SLUG_PATTERN.test('doble--guion')).toBe(false)
  })
})

describe('validateImage', () => {
  it('acepta JPG, PNG y WebP dentro del límite', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(validateImage({ type, size: 1000 })).toBeNull()
    }
    expect(validateImage({ type: 'image/png', size: MAX_IMAGE_BYTES })).toBeNull()
  })
  it('rechaza otros tipos, vacíos y archivos de más de 2 MB', () => {
    expect(validateImage({ type: 'image/gif', size: 10 })).toMatch(/JPG, PNG o WebP/)
    expect(validateImage({ type: 'image/svg+xml', size: 10 })).toMatch(/JPG, PNG o WebP/)
    expect(validateImage({ type: 'application/pdf', size: 10 })).toMatch(/JPG, PNG o WebP/)
    expect(validateImage({ type: 'image/png', size: 0 })).toMatch(/vacío/)
    expect(validateImage({ type: 'image/png', size: MAX_IMAGE_BYTES + 1 })).toMatch(/2 MB/)
  })
  it('la ruta usa un nombre aleatorio, no el del archivo original', () => {
    expect(imageStoragePath('prod-1', 'image/webp', 'abc')).toBe('products/prod-1/abc.webp')
  })
})

describe('adminErrorMessage', () => {
  it('muestra los mensajes propios de la BD (en español)', () => {
    expect(adminErrorMessage({ code: '22023', message: 'Existencias insuficientes de Pastel' })).toBe(
      'Existencias insuficientes de Pastel',
    )
    expect(adminErrorMessage({ code: 'P0001', message: 'Los reembolsos superan lo pagado' })).toBe(
      'Los reembolsos superan lo pagado',
    )
  })
  it('traduce errores técnicos sin filtrar detalles', () => {
    expect(adminErrorMessage({ code: '23505', message: 'duplicate key value violates unique constraint "products_sku_key"' })).toMatch(
      /Ya existe/,
    )
    expect(adminErrorMessage({ code: '23503', message: 'violates foreign key constraint "products_category_id_fkey"' })).toMatch(
      /registros relacionados/,
    )
    expect(adminErrorMessage({ code: '42501', message: 'permission denied for table payments' })).toMatch(/permiso/)
    expect(adminErrorMessage({ status: 401 })).toMatch(/sesión/)
  })
  it('un error desconocido no revela el mensaje original', () => {
    const text = adminErrorMessage({ code: 'XX000', message: 'relation "secret_table" does not exist' })
    expect(text).not.toMatch(/secret_table/)
    expect(adminErrorMessage(null)).toMatch(/inesperado/)
  })
})

describe('filterText', () => {
  it('ignora acentos y mayúsculas y exige todos los términos', () => {
    expect(filterText('tiramisu', 'Mini Tiramisú MIN-1')).toBe(true)
    expect(filterText('mini cupcake', 'Mini Tiramisú')).toBe(false)
    expect(filterText('', 'cualquier cosa')).toBe(true)
  })
})
