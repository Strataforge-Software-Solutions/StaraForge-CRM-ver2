export function todayKey(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
export function dateKey(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '' : `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
}
export function reportPeriod(range: string) {
  const end = todayKey()
  const startDate = new Date(`${end}T12:00:00`)
  if (range === 'This year') startDate.setMonth(0, 1)
  else startDate.setDate(startDate.getDate() - (range === 'Last 7 days' ? 6 : range === 'Last 90 days' ? 89 : 29))
  const start = dateKey(startDate.toDateString())
  const label = `${new Date(`${start}T12:00:00`).toLocaleDateString('en-US')} – ${new Date(`${end}T12:00:00`).toLocaleDateString('en-US')}`
  return { start, end, label, includes: (value: string) => { const key = dateKey(value); return Boolean(key && key >= start && key <= end) } }
}
