import { describe, expect, it } from 'vitest'
import { toCsv } from './csv'

describe('toCsv', () => {
  it('lleva BOM UTF-8 y separa filas con CRLF', () => {
    expect(toCsv([['a', 1], ['b', 2]])).toBe('﻿a,1\r\nb,2\r\n')
  })

  it('entrecomilla comas, comillas y saltos de línea', () => {
    expect(toCsv([['Pastel, "grande"', 'línea\nnueva']])).toBe('﻿"Pastel, ""grande""","línea\nnueva"\r\n')
  })

  it('neutraliza texto que parecería una fórmula, pero no los números', () => {
    expect(toCsv([['=HYPERLINK("x")', '+1', '-1', '@x', -5]])).toBe('﻿"\'=HYPERLINK(""x"")",\'+1,\'-1,\'@x,-5\r\n')
  })

  it('una fila vacía queda como línea en blanco', () => {
    expect(toCsv([['a'], [], ['b']])).toBe('﻿a\r\n\r\nb\r\n')
  })
})
