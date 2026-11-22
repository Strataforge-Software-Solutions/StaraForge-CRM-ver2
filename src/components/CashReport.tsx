import { usePaymentLedger, money } from '../lib/payments'
import { reportPeriod } from '../lib/dates'
export default function CashReport({ range }: { range: string }) {
  const { receipts } = usePaymentLedger()
  const period = reportPeriod(range)
  const selected = receipts.filter(row => period.includes(row.date))
  return <div className="crm-cash-report" key={range}><p className="cash-period-label">{period.label}</p>{['PHP', 'USD'].map(currency => {
    const rows = selected.filter(row => row.currency === currency)
    const groups = Object.entries(rows.reduce<Record<string, number>>((result, row) => { result[row.date] = (result[row.date] || 0) + row.amount; return result }, {})).sort(([a], [b]) => a.localeCompare(b))
    const max = Math.max(1, ...groups.map(([, value]) => value))
    return <section className="cash-currency-section" key={currency}><div className="cash-currency-heading"><span className={`cash-currency-mark ${currency.toLowerCase()}`}>{currency === 'PHP' ? '₱' : '$'}</span><div><span>{currency} received</span><strong>{money(rows.reduce((sum, row) => sum + row.amount, 0), currency)}</strong></div></div>{groups.length ? <div className="crm-list cash-rows">{groups.map(([date, value]) => <div className="cash-row" key={date}><time dateTime={date}>{new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</time><span className="crm-cash-track"><i style={{ width: `${value / max * 100}%` }}/></span><b>{money(value, currency)}</b></div>)}</div> : <p className="cash-empty">No {currency} payments were recorded in this period.</p>}</section>
  })}</div>
}
