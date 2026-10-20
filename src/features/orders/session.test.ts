import { attemptKey, clearAttempt, loadExtras, saveExtras } from './session'

beforeEach(() => {
  sessionStorage.clear()
  clearAttempt()
})

const pedido = (n: number) => ({ items: [{ productId: 'a', quantity: n }], values: { name: 'Ana López', phone: '5512345678' } })

describe('clave de idempotencia', () => {
  it('reutiliza la clave mientras el contenido del pedido no cambie', async () => {
    const first = await attemptKey(pedido(1))
    expect(await attemptKey(pedido(1))).toBe(first)
    expect(first).toMatch(/^[0-9a-f-]{36}$/)
  })
  it('genera otra clave si el contenido cambia', async () => {
    const first = await attemptKey(pedido(1))
    expect(await attemptKey(pedido(2))).not.toBe(first)
  })
  it('guarda solo un hash: nunca datos personales en claro', async () => {
    const key = await attemptKey(pedido(1))
    const raw = sessionStorage.getItem('luchy-order-attempt') as string
    expect(raw).not.toMatch(/Ana|5512345678/)
    expect(JSON.parse(raw)).toEqual({ fingerprint: expect.stringMatching(/^[0-9a-f]{64}$/), key })
  })
  it('sobrevive a una recarga y se renueva tras un pedido exitoso', async () => {
    const first = await attemptKey(pedido(1))
    clearAttempt()
    expect(await attemptKey(pedido(1))).not.toBe(first)
  })
})

describe('datos del pedido en la pestaña', () => {
  it('guarda y recupera nombre, notas y personalización por folio', () => {
    saveExtras('L-1', { customerName: 'Ana', notes: 'n', customizations: { Pastel: 'Hola' } })
    expect(loadExtras('L-1')).toEqual({ customerName: 'Ana', notes: 'n', customizations: { Pastel: 'Hola' } })
    expect(loadExtras('L-2')).toBeNull()
  })
})
