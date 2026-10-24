// CSV para Excel/Google Sheets: separador «,», saltos CRLF y BOM UTF-8 (acentos correctos en Excel).
// Las celdas de texto que empiezan con = + - @ se neutralizan con una comilla para evitar fórmulas inyectadas.
export type Cell = string | number

const cell = (value: Cell) => {
  let text = String(value)
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export const toCsv = (rows: Cell[][]) => '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'

export function downloadCsv(filename: string, rows: Cell[][]) {
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
