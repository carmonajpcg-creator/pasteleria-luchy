import { attemptKey, clearAttempt, loadExtras, saveExtras } from './session'

beforeEach(() => {
  sessionStorage.clear()
  clearAttempt()
})

describe('clave de idempotencia', () => {
  it('reutiliza la clave mientras el contenido del pedido no cambie', () => {
    const first = attemptKey('pedido-1')
    expect(attemptKey('pedido-1')).toBe(first)
    expect(first).toMatch(/^[0-9a-f-]{36}$/)
  })
  it('genera otra clave si el contenido cambia', () => {
    const first = attemptKey('pedido-1')
    expect(attemptKey('pedido-2')).not.toBe(first)
  })
  it('sobrevive a una recarga (sessionStorage) y se renueva tras un pedido exitoso', () => {
    const first = attemptKey('pedido-1')
    expect(JSON.parse(sessionStorage.getItem('luchy-order-attempt') as string)).toEqual({
      fingerprint: 'pedido-1',
      key: first,
    })
    clearAttempt()
    expect(attemptKey('pedido-1')).not.toBe(first)
  })
})

describe('datos del pedido en la pestaña', () => {
  it('guarda y recupera nombre, notas y personalización por folio', () => {
    saveExtras('L-1', { customerName: 'Ana', notes: 'n', customizations: { Pastel: 'Hola' } })
    expect(loadExtras('L-1')).toEqual({ customerName: 'Ana', notes: 'n', customizations: { Pastel: 'Hola' } })
    expect(loadExtras('L-2')).toBeNull()
  })
})
