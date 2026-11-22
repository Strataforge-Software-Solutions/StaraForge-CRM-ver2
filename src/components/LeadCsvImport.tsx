import { useState } from 'react'
import { parseCsv } from '../../shared/csv'
import { useDatabaseCollection, updateDatabaseCollection } from '../lib/database'
import { leadDirectory, type LeadDirectoryRow } from '../pages/LeadsPage'
import { todayKey } from '../lib/dates'
export default function LeadCsvImport() {
  const [leads] = useDatabaseCollection('leads', leadDirectory)
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const duplicate = (row: Record<string, string>, against: { name: string; email?: string }[]) => against.some(item => item.name.trim().toLowerCase() === row.name?.trim().toLowerCase() || Boolean(row.email && item.email?.toLowerCase() === row.email.toLowerCase()))
  const preview = rows.map((row, index) => ({ row, issue: !row.name?.trim() ? 'Missing name' : row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email) ? 'Invalid email' : duplicate(row, [...leads, ...rows.slice(0, index).map(item => ({ name: item.name || '', email: item.email }))]) ? 'Possible duplicate — skipped' : '' }))
  const valid = preview.filter(item => !item.issue)
  return <section className="crm-panel"><details><summary>Import leads from CSV</summary><p>Use columns: name, company, email, phone, source, notes. Preview up to 500 rows; possible duplicates are skipped.</p><label className="crm-upload">Choose CSV<input type="file" accept=".csv,text/csv" disabled={busy} onChange={async event => { const file = event.target.files?.[0]; setError(''); setMessage(''); if (!file) return; try { if (file.size > 1000000) throw new Error('Choose a CSV under 1 MB.'); setRows(parseCsv(await file.text())) } catch (cause) { setRows([]); setError((cause as Error).message) } event.target.value = '' }}/></label>{rows.length > 0 && <><p>{valid.length} ready to import · {rows.length - valid.length} skipped</p><div className="crm-import-preview">{preview.map(({ row, issue }, index) => <div key={index}><b>{index + 2}. {row.name || '(no name)'}</b><span>{row.email || 'No email'} · {issue || 'Ready'}</span></div>)}</div><div className="crm-actions"><button disabled={busy || !valid.length} onClick={async () => { setBusy(true); setError(''); try {
    await updateDatabaseCollection<LeadDirectoryRow[]>('leads', [], current => { const added: LeadDirectoryRow[] = []; for (const { row } of valid) { if (duplicate(row, [...current, ...added])) continue; const id = crypto.randomUUID(); added.push({ id, workflowKey: id, name: row.name, client: row.company || row.name, initials: row.name.slice(0, 2).toUpperCase(), email: row.email || '', phone: row.phone || '', source: row.source || 'CSV import', type: 'Website', budget: 'Not discussed', status: 'New Leads', date: todayKey(), tone: 'orange', notes: row.notes || '' }) } return [...current, ...added] })
    setMessage('Import saved. Possible duplicates were skipped.'); setRows([])
  } catch (cause) { setError((cause as Error).message) } finally { setBusy(false) } }}>{busy ? 'Importing…' : `Import ${valid.length} valid leads`}</button><button disabled={busy} onClick={() => setRows([])}>Cancel</button></div></>}{error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}</details></section>
}
