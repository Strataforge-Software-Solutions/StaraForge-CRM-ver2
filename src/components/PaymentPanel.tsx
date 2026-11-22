import { useState } from 'react'
import { usePaymentLedger, money, moneyValue, type Receipt, type PaymentSchedule } from '../lib/payments'
import { updateDatabaseCollection } from '../lib/database'
import { recordId } from '../lib/records'
import { todayKey } from '../lib/dates'
import { CustomDatePicker, CustomSelect } from './CustomControls'
import type { ProjectDirectoryRow } from '../pages/ProjectsPage'
export default function PaymentPanel({ project }: { project: ProjectDirectoryRow }) {
  const { receipts, schedules } = usePaymentLedger()
  const { amount: agreed, currency } = moneyValue(project.value)
  const projectId = recordId(project)
  const rows = receipts.filter(row => row.projectId === projectId && row.currency === currency)
  const plan = schedules.filter(row => row.projectId === projectId)
  const paid = rows.reduce((sum, row) => sum + row.amount, 0)
  const [mode, setMode] = useState<'receipt' | 'schedule' | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [paymentDate, setPaymentDate] = useState(todayKey())
  const [basis, setBasis] = useState('fixed')
  const [scheduleId, setScheduleId] = useState('')
  return <section className="crm-panel"><h3>Payments and schedule</h3><div className="crm-summary"><span>Agreed <b>{money(agreed, currency)}</b></span><span>Received <b>{money(paid, currency)}</b></span><span>{paid > agreed ? 'Credit' : 'Remaining'} <b>{money(Math.abs(agreed - paid), currency)}</b></span></div>
    <div className="crm-actions"><button onClick={() => { setMode('receipt'); setError('') }}>Record receipt</button><button onClick={() => { setMode('schedule'); setError('') }}>Add payment milestone</button></div>
    {mode && <form className="crm-form" key={mode} onSubmit={async event => {
      event.preventDefault(); const form = event.currentTarget; const values = new FormData(form); setError(''); setBusy(true)
      try {
        const raw = Number(values.get('amount')); const amount = basis === 'percent' ? Math.round(agreed * raw) / 100 : raw
        if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter a positive amount. Set an agreed proposal value before using a percentage.')
        if (basis === 'percent' && raw > 100) throw new Error('Percentage must be at most 100.')
        const date = paymentDate; if (!date) throw new Error('Choose a date.'); const name = String(values.get('note')).trim()
        if (mode === 'receipt') {
          if (date > todayKey()) throw new Error('A receipt date cannot be in the future.')
          const row: Receipt = { id: crypto.randomUUID(), projectId, amount, currency, date, note: name, scheduleId }
          await updateDatabaseCollection<Receipt[]>('payments', [], current => [...current, row])
        } else {
          if (agreed && plan.reduce((sum, row) => sum + row.amount, 0) + amount > agreed + .01) throw new Error('Scheduled payments exceed the agreed value. Review the milestones.')
          const row: PaymentSchedule = { id: crypto.randomUUID(), projectId, amount, currency, due: date, name }
          await updateDatabaseCollection<PaymentSchedule[]>('paymentSchedules', [], current => [...current, row])
        }
        setMode(null)
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save payment.') } finally { setBusy(false) }
    }}><label>{mode === 'receipt' ? 'Receipt reference / note' : 'Milestone name'}<input name="note" required maxLength={300}/></label><label>Amount<input name="amount" type="number" min="0.01" step="0.01" required/></label>{mode === 'schedule' && <label>Amount type<CustomSelect ariaLabel="Amount type" value={basis} options={[{ label: `Fixed amount (${currency})`, value: 'fixed' }, { label: 'Percentage of agreed value', value: 'percent' }]} onChange={setBasis}/></label>}<label>{mode === 'receipt' ? 'Date received' : 'Due date'}<CustomDatePicker ariaLabel={mode === 'receipt' ? 'Date received' : 'Due date'} value={paymentDate} onChange={setPaymentDate}/></label>{mode === 'receipt' && <label>Apply to milestone<CustomSelect ariaLabel="Apply to milestone" value={scheduleId} options={[{ label: 'Unallocated receipt', value: '' }, ...plan.map(row => ({ label: row.name, value: row.id }))]} onChange={setScheduleId}/></label>}<div className="crm-actions"><button disabled={busy}>{busy ? 'Saving…' : 'Save'}</button><button type="button" disabled={busy} onClick={() => setMode(null)}>Cancel</button></div>{error && <p role="alert">{error}</p>}</form>}
    {plan.length > 0 && <div className="crm-list">{plan.map(row => { const received = rows.filter(payment => payment.scheduleId === row.id).reduce((sum, payment) => sum + payment.amount, 0); return <div key={row.id}><span><b>{row.name}</b><small>Due {row.due} · {received >= row.amount ? 'Paid' : row.due < todayKey() ? 'Overdue' : 'Scheduled'}</small></span><span>{money(row.amount, currency)}<small>{money(received, currency)} allocated</small></span></div> })}</div>}
    <h4>Receipt history</h4>{rows.length ? <div className="crm-list">{[...rows].sort((a, b) => b.date.localeCompare(a.date)).map(row => <div key={row.id}><span><b>{row.note}</b><small>{row.date}</small></span><b>{money(row.amount, row.currency)}</b></div>)}</div> : <p>No receipts recorded for this project.</p>}
  </section>
}
