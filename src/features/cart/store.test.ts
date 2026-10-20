import { MAX_LINES, MAX_QUANTITY, sanitizeItems, selectCount, useCart } from './store'

beforeEach(() => {
  localStorage.clear()
  useCart.setState({ items: [] })
})

describe('carrito', () => {
  it('agrega, suma cantidades del mismo producto y cuenta unidades', () => {
    useCart.getState().add('a', 2)
    useCart.getState().add('a', 3)
    useCart.getState().add('b', 1)
    expect(useCart.getState().items).toEqual([
      { productId: 'a', quantity: 5 },
      { productId: 'b', quantity: 1 },
    ])
    expect(selectCount(useCart.getState())).toBe(6)
  })

  it('limita la cantidad a 1..99', () => {
    useCart.getState().add('a', 500)
    expect(useCart.getState().items[0]?.quantity).toBe(MAX_QUANTITY)
    useCart.getState().setQuantity('a', 0)
    expect(useCart.getState().items[0]?.quantity).toBe(1)
  })

  it('cambia cantidad, elimina y vacía', () => {
    useCart.getState().add('a', 1)
    useCart.getState().add('b', 1)
    useCart.getState().setQuantity('a', 4)
    useCart.getState().remove('b')
    expect(useCart.getState().items).toEqual([{ productId: 'a', quantity: 4 }])
    useCart.getState().clear()
    expect(useCart.getState().items).toEqual([])
  })

  it('guarda la personalización recortada y la conserva al sumar más unidades', () => {
    useCart.getState().add('a', 1, '  Feliz cumpleaños  ')
    useCart.getState().add('a', 1)
    expect(useCart.getState().items[0]).toEqual({ productId: 'a', quantity: 2, customization: 'Feliz cumpleaños' })
  })

  it('rechaza más productos distintos que el máximo del servidor', () => {
    for (let i = 0; i < MAX_LINES; i++) expect(useCart.getState().add(`p${i}`, 1)).toBe(true)
    expect(useCart.getState().add('extra', 1)).toBe(false)
    expect(useCart.getState().items).toHaveLength(MAX_LINES)
  })

  it('persiste solo producto, cantidad y personalización (sin precios)', () => {
    useCart.getState().add('a', 2, 'nota')
    const stored = JSON.parse(localStorage.getItem('luchy-cart') as string) as { state: Record<string, unknown> }
    expect(Object.keys(stored.state)).toEqual(['items'])
    expect(stored.state.items).toEqual([{ productId: 'a', quantity: 2, customization: 'nota' }])
  })
})

describe('sanitizeItems', () => {
  it('descarta datos manipulados o inválidos', () => {
    expect(
      sanitizeItems([
        { productId: 'a', quantity: 2 },
        { productId: 'a', quantity: 9 }, // duplicado
        { productId: '', quantity: 1 },
        { productId: 'b', quantity: -1 },
        { productId: 'c', quantity: 'mucho' },
        { productId: 'd', quantity: 1000, customization: 42 },
        null,
        'x',
      ]),
    ).toEqual([
      { productId: 'a', quantity: 2 },
      { productId: 'd', quantity: MAX_QUANTITY },
    ])
  })
  it('tolera valores que no son listas', () => {
    expect(sanitizeItems(undefined)).toEqual([])
    expect(sanitizeItems({ productId: 'a' })).toEqual([])
  })
})
