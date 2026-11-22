export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++ } else quoted = !quoted }
    else if (char === ',' && !quoted) { row.push(cell.trim()); cell = '' }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && text[i + 1] === '\n') i++; row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = '' }
    else cell += char
  }
  if (quoted) throw new Error('A quoted field is not closed.')
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row)
  const headers = (rows.shift() || []).map(value => value.replace(/^\uFEFF/, '').toLowerCase())
  if (!headers.includes('name')) throw new Error('The CSV needs a name column. Optional columns: company, email, phone, source, notes.')
  if (new Set(headers).size !== headers.length) throw new Error('Column names must be unique.')
  if (rows.length > 500) throw new Error('Import at most 500 rows at a time.')
  return rows.map((values, index) => { if (values.length !== headers.length) throw new Error(`Row ${index + 2} has the wrong number of columns.`); return Object.fromEntries(headers.map((key, i) => [key, values[i]])) })
}
