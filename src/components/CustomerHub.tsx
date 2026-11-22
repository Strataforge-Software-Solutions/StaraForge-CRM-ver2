import { useState } from 'react'
import { useDatabaseCollection, updateDatabaseCollection } from '../lib/database'
import { recordId, related } from '../lib/records'
import { leadDirectory } from '../pages/LeadsPage'
import type { ClientDirectoryRow } from '../pages/ClientsPage'
type Contact = { id: string; clientId: string; name: string; role: string; email: string; phone: string }
type Interaction = { id: string; clientId: string; type: string; detail: string; createdAt: string }
export default function CustomerHub({ client }: { client: ClientDirectoryRow }) {
  const [contacts] = useDatabaseCollection<Contact[]>('contacts', [])
  const [interactions] = useDatabaseCollection<Interaction[]>('interactions', [])
  const [leads] = useDatabaseCollection('leads', leadDirectory)
  const [history] = useDatabaseCollection<any[]>('recordHistory', [])
  const [mode, setMode] = useState<'contact' | 'interaction' | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const clientId = recordId(client)
  const opportunities = leads.filter(lead => related(lead, client, 'client'))
  const ids = new Set([clientId, ...opportunities.map(recordId), ...opportunities.map(lead => lead.workflowKey)])
  const timeline = [...interactions.filter(item => item.clientId === clientId).map(item => ({ id: item.id, title: item.type, detail: item.detail, createdAt: item.createdAt })), ...history.filter(item => item.entityIds?.some((id: string) => ids.has(id))).map(item => ({ id: item.id, title: `${item.action} · ${item.actor}`, detail: item.detail, createdAt: item.createdAt }))].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return <section className="crm-panel"><h2>Customer history and contacts</h2><div className="crm-actions"><button onClick={() => { setMode('contact'); setError('') }}>Add contact</button><button onClick={() => { setMode('interaction'); setError('') }}>Log call, meeting, or note</button></div>{mode && <form className="crm-form" key={mode} onSubmit={async event => {
    event.preventDefault(); setBusy(true); setError(''); const data = new FormData(event.currentTarget)
    try {
      if (mode === 'contact') { const row: Contact = { id: crypto.randomUUID(), clientId, name: String(data.get('name')).trim(), role: String(data.get('role')), email: String(data.get('email')), phone: String(data.get('phone')) }; if (contacts.some(item => item.clientId === clientId && row.email && item.email.toLowerCase() === row.email.toLowerCase())) throw new Error('This contact email already exists for this client.'); await updateDatabaseCollection<Contact[]>('contacts', [], current => [...current, row]) }
      else { const row: Interaction = { id: crypto.randomUUID(), clientId, type: String(data.get('type')), detail: String(data.get('detail')).trim(), createdAt: new Date().toISOString() }; await updateDatabaseCollection<Interaction[]>('interactions', [], current => [...current, row]) }
      setMode(null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save.') } finally { setBusy(false) }
  }}>{mode === 'contact' ? <><label>Name<input name="name" required/></label><label>Role / title<input name="role"/></label><label>Email<input name="email" type="email"/></label><label>Phone<input name="phone" type="tel"/></label></> : <><label>Activity<select name="type">{['Call', 'Meeting', 'Email', 'Note'].map(type => <option key={type}>{type}</option>)}</select></label><label>Details<textarea name="detail" required maxLength={4000}/></label></>}<div className="crm-actions"><button disabled={busy}>{busy ? 'Saving…' : 'Save'}</button><button type="button" disabled={busy} onClick={() => setMode(null)}>Cancel</button></div>{error && <p role="alert">{error}</p>}</form>}<h3>Contacts</h3><div className="crm-list"><div><span><b>{client.contact}</b><small>Primary contact</small></span><span>{client.email}<small>{client.phone}</small></span></div>{contacts.filter(item => item.clientId === clientId).map(item => <div key={item.id}><span><b>{item.name}</b><small>{item.role}</small></span><span>{item.email}<small>{item.phone}</small></span></div>)}</div><h3>Opportunities</h3><div className="crm-list">{opportunities.map(lead => <div key={recordId(lead)}><b>{lead.name}</b><span>{lead.status}<small>{lead.nextAction}</small></span></div>)}</div><h3>Timeline</h3>{timeline.length ? <div className="crm-list">{timeline.map(item => <div key={item.id}><span><b>{item.title}</b><small>{item.detail}</small></span><time>{new Date(item.createdAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</time></div>)}</div> : <p>No activities recorded yet. Log the next conversation here.</p>}</section>
}
