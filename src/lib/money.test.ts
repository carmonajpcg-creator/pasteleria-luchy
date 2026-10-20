import { formatMXN } from './money'

describe('formatMXN', () => {
  it.each([
    [0, '$0.00 MXN'],
    [4500, '$45.00 MXN'],
    [65000, '$650.00 MXN'],
    [123456, '$1,234.56 MXN'],
  ])('%i centavos → %s', (cents, expected) => {
    expect(formatMXN(cents)).toBe(expected)
  })
})
