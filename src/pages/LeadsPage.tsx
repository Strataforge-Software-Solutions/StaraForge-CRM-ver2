import { useState } from 'react'
import { ArrowRight, Check, ChevronLeft, ChevronRight, ClipboardList, Phone, Plus, Search, Tag, Users, X } from 'lucide-react'
import { ContactDetails, DirectoryHeader, MetricsStrip, DirectoryTabs, RecordActionButtons, RecordActionDialog, type DirectoryAction } from '../components/DirectoryShared'
import { CustomSelect } from '../components/CustomControls'

export type LeadDirectoryRow = { name: string; client: string; initials: string; email: string; phone: string; source: string; type: string; budget: string; status: string; date: string; tone: string; location?: string; notes?: string; timeline?: string; followUpDate?: string }
type LeadDrawerTab = 'Overview' | 'Activity' | 'Notes'

const leadDirectory: LeadDirectoryRow[] = [
  { name: 'Jollibee', client: 'Jollibee', initials: 'J', email: 'jollibee@gmail.com', phone: '67676767', source: 'Referral', type: 'Website', budget: 'PHP 2,000.00', status: 'New Leads', date: 'Nov 3, 2026', tone: 'orange' },
  { name: 'Jollibee2', client: 'Jollibee', initials: 'JO', email: 'jollibee@gmail.com', phone: '67676767', source: 'Unspecified', type: 'Website', budget: 'Not discussed', status: 'Contacted', date: 'Nov 4, 2026', tone: 'blue' },
  { name: 'Mr. Jose', client: 'Mr. Jose', initials: 'MJ', email: 'bahba@bahbah.com', phone: '6767', source: 'Referral', type: 'Frontend', budget: 'USD 10,000.00', status: 'Awaiting deposit', date: 'Nov 4, 2026', tone: 'green' },
  { name: 'VioTrack', client: 'VioTrack', initials: 'V', email: 'viotrack@gmail.com', phone: '09876543211', source: 'Social Media: Facebook', type: 'Website', budget: 'PHP 3,000.00', status: 'Won', date: 'Nov 2, 2026', tone: 'purple' },
  { name: 'Company ABC', client: '12345', initials: 'CA', email: 'companyabc@gmail.com', phone: '0987654321', source: 'Inquiry Form', type: 'Website', budget: 'USD 70.00', status: 'Won', date: 'Oct 31, 2026', tone: 'orange' },
]


export default function LeadsPage({ onAdd, onFullWorkflow, statusOverrides = {} }: { onAdd: () => void; onFullWorkflow: (lead: LeadDirectoryRow) => void; statusOverrides?: Record<string, string> }) {
  const [active, setActive] = useState('all')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState(() => leadDirectory.map(row => ({ ...row, status: statusOverrides[row.name] ?? row.status })))
  const [action, setAction] = useState<DirectoryAction | null>(null)
  const [selectedLead, setSelectedLead] = useState<LeadDirectoryRow | null>(null)
  const countStatus = (status: string) => rows.filter(row => row.status === status).length
  const tabs = [
    { label: 'All Leads', value: 'all', count: rows.length }, { label: 'New Leads', value: 'New Leads', count: countStatus('New Leads') },
    { label: 'Contacted', value: 'Contacted', count: countStatus('Contacted') }, { label: 'Discovery', value: 'Discovery', count: countStatus('Discovery') },
    { label: 'Proposal sent', value: 'Proposal sent', count: countStatus('Proposal sent') }, { label: 'Awaiting deposit', value: 'Awaiting deposit', count: countStatus('Awaiting deposit') },
    { label: 'Won', value: 'Won', count: countStatus('Won') }, { label: 'Lost', value: 'Lost', count: countStatus('Lost') },
  ]
  const visible = rows.filter(row => (active === 'all' || row.status === active) && `${row.name} ${row.client} ${row.email} ${row.source}`.toLowerCase().includes(search.toLowerCase()))
  const openAction = (row: LeadDirectoryRow, mode: DirectoryAction['mode']) => {
    const budgetMatch = row.budget.match(/^(PHP|USD)\s*([\d,.]+)/)
    const currency = budgetMatch?.[1] ?? 'PHP'
    const amount = budgetMatch?.[2]?.replace(/,/g, '') ?? ''
    setAction({
      mode, name: row.name,
      fields: [['Client', row.client], ['Email', row.email], ['Phone', row.phone], ['Source', row.source], ['Project type', row.type], ['Budget', row.budget], ['Status', row.status], ['Date', row.date]],
      editTitle: 'Edit website inquiry',
      editDescription: 'Update the contact, request, and follow-up details for this lead.',
      editSections: mode === 'edit' ? [
        { title: 'Inquiry', description: 'Capture what the client wants to build and how to reach them.', fields: [
          { key: 'company', label: 'Company or client name', value: row.client },
          { key: 'contact', label: 'Primary contact', value: row.name },
          { key: 'email', label: 'Email address', value: row.email, type: 'email' },
          { key: 'phone', label: 'Phone', value: row.phone, type: 'tel' },
          { key: 'location', label: 'Location', value: row.location ?? '', placeholder: 'City or region' },
          { key: 'notes', label: 'Notes', value: row.notes ?? 'Other inquiry for this client', type: 'textarea' },
        ] },
        { title: 'Follow-up and budget', description: 'Leave these blank until the client has shared the details.', fields: [
          { key: 'source', label: 'Source', value: row.source, type: 'select', options: ['Referral', 'Unspecified', 'Inquiry Form', 'Social Media: Facebook'] },
          { key: 'type', label: 'Project type', value: row.type },
          { key: 'timeline', label: 'Timeline', value: row.timeline ?? '', placeholder: 'e.g. 1–2 months' },
          { key: 'followUpDate', label: 'Next follow-up date', value: row.followUpDate ?? '', type: 'date' },
          { key: 'budgetFrom', label: 'Budget from', value: amount, type: 'number', placeholder: '0.00' },
          { key: 'budgetTo', label: 'Budget to', value: amount, type: 'number', placeholder: '0.00' },
          { key: 'currency', label: 'Budget currency', value: currency, type: 'select', options: ['PHP', 'USD'] },
          { key: 'status', label: 'Opportunity stage', value: row.status, type: 'select', options: ['New Leads', 'Contacted', 'Discovery', 'Proposal sent', 'Awaiting deposit', 'Won', 'Lost'] },
        ] },
      ] : undefined,
      onSave: values => {
        const updateRow = (item: LeadDirectoryRow): LeadDirectoryRow => ({
          ...item,
          name: values.contact.trim() || item.name,
          client: values.company.trim() || item.client,
          initials: (values.contact.trim() || item.name).trim().split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase(),
          email: values.email.trim(), phone: values.phone.trim(), location: values.location.trim(), notes: values.notes.trim(),
          source: values.source, type: values.type.trim(), timeline: values.timeline.trim(), followUpDate: values.followUpDate,
          budget: values.budgetFrom ? `${values.currency} ${Number(values.budgetFrom).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${values.budgetTo && values.budgetTo !== values.budgetFrom ? ` – ${values.currency} ${Number(values.budgetTo).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}` : 'Not discussed',
          status: values.status,
        })
        setRows(current => current.map(item => item.name === row.name ? updateRow(item) : item))
        setSelectedLead(current => current?.name === row.name ? updateRow(current) : current)
      },
      onDelete: () => setRows(current => current.filter(item => item.name !== row.name)),
    })
  }
  return <div className="directory-page">
    <DirectoryHeader section="SALES WORKSPACE" title="Leads" description="Manage website inquiries and move promising conversations toward a real project." action="Add Lead" onAction={onAdd}/>
    <MetricsStrip metrics={[
      { icon: Users, label: 'Total Leads', value: String(rows.length), detail: 'All active inquiries', tone: 'orange' },
      { icon: ClipboardList, label: 'New Leads', value: String(countStatus('New Leads')), detail: 'Awaiting first contact', tone: 'blue' },
      { icon: Phone, label: 'Contacted', value: String(countStatus('Contacted')), detail: 'Conversation started', tone: 'green' },
      { icon: Check, label: 'Converted', value: String(countStatus('Won')), detail: 'Confirmed projects', tone: 'purple' },
    ]}/>
    <DirectoryTabs tabs={tabs} active={active} onChange={setActive}/>
    <section className="directory-panel"><div className="directory-panel-head"><div><h2>{active === 'all' ? 'All Leads' : active}</h2><span>{visible.length} {visible.length === 1 ? 'lead' : 'leads'}</span></div><form className="directory-search" onSubmit={event => event.preventDefault()}><Search size={17}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search leads..."/><button>Search</button></form></div>
      <div className="directory-table-wrap"><table className="directory-table leads-table"><thead><tr><th>Name</th><th>Contact</th><th>Source</th><th>Project Type</th><th>Budget</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead><tbody>
        {visible.map(row => <tr key={row.name}><td><div className="person-cell"><span className={`directory-avatar ${row.tone}`}>{row.initials}</span><div><b>{row.name}</b><small>{row.client}</small><em>Other inquiry for this client</em></div></div></td><td><ContactDetails email={row.email} phone={row.phone}/></td><td>{row.source}</td><td><span className="type-chip">{row.type}</span></td><td>{row.budget}</td><td><span className={`record-status ${row.status.toLowerCase().replace(/ /g, '-')}`}>{row.status}</span></td><td>{row.date}</td><td><RecordActionButtons name={row.name} onAction={mode => mode === 'view' ? setSelectedLead(row) : openAction(row, mode)}/></td></tr>)}
      </tbody></table>{visible.length === 0 && <div className="directory-empty">No leads match your search.</div>}</div>
      <div className="directory-panel-foot"><span>1–{visible.length} of {visible.length} leads</span><span className="pagination"><button disabled><ChevronLeft size={16}/></button>Page 1 of 1<button disabled><ChevronRight size={16}/></button></span><label>Rows <CustomSelect className="rows-select" value="10" options={['10', '25']}/></label></div>
    </section>
    {action && <RecordActionDialog key={`${action.mode}-${action.name}`} action={action} onClose={() => setAction(null)}/>}
    {selectedLead && <LeadDetailDrawer key={selectedLead.name} lead={selectedLead} onClose={() => setSelectedLead(null)} onFullWorkflow={onFullWorkflow} onEdit={() => openAction(selectedLead, 'edit')}/>}
  </div>
}

function LeadDetailDrawer({ lead, onClose, onFullWorkflow, onEdit }: { lead: LeadDirectoryRow; onClose: () => void; onFullWorkflow: (lead: LeadDirectoryRow) => void; onEdit: () => void }) {
  const [tab, setTab] = useState<LeadDrawerTab>('Overview')
  const [tags, setTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState('')
  const [noteDraft, setNoteDraft] = useState('')
  const [notes, setNotes] = useState<string[]>([])
  const addTag = (event: React.FormEvent) => {
    event.preventDefault()
    const tag = tagDraft.trim()
    if (!tag || tags.length >= 12 || tags.some(item => item.toLowerCase() === tag.toLowerCase())) return
    setTags(current => [...current, tag])
    setTagDraft('')
  }
  const saveNote = (event: React.FormEvent) => {
    event.preventDefault()
    const note = noteDraft.trim()
    if (!note) return
    setNotes(current => [note, ...current])
    setNoteDraft('')
  }
  const tabs: LeadDrawerTab[] = ['Overview', 'Activity', 'Notes']
  return <div className="client-drawer-backdrop lead-drawer-backdrop" onClick={onClose}><aside className="client-detail-drawer lead-detail-drawer" role="dialog" aria-modal="true" aria-label={`${lead.name} lead details`} onClick={event => event.stopPropagation()}>
    <header className="client-drawer-header"><span className={`directory-avatar ${lead.tone}`}>{lead.initials}</span><div className="client-drawer-title"><h2>{lead.name}</h2><span>{lead.client} · {lead.status}</span></div><button className="client-drawer-close" aria-label="Close lead details" onClick={onClose}><X size={17}/></button></header>
    <nav className="client-drawer-tabs lead-drawer-tabs" aria-label="Lead details tabs" role="tablist">{tabs.map(item => <button key={item} role="tab" aria-selected={tab === item} className={tab === item ? 'selected' : ''} onClick={() => setTab(item)}>{item}</button>)}<button className="lead-full-workflow" onClick={() => onFullWorkflow(lead)}>Full workflow <ArrowRight size={12}/></button></nav>
    <div className="client-drawer-content">
      {tab === 'Overview' && <>
        <section className="lead-stage-card"><span>Opportunity stage</span><div><b className={`record-status ${lead.status.toLowerCase().replace(/ /g, '-')}`}>{lead.status}</b><button onClick={() => onFullWorkflow(lead)}>Manage stage in workflow <ArrowRight size={12}/></button></div></section>
        <section className="client-drawer-section lead-fields-grid">
          <div><small>Contact name</small><b>{lead.client}</b></div><div><small>Email</small><b>{lead.email}</b></div>
          <div><small>Phone</small><b>{lead.phone}</b></div><div><small>Source</small><b>{lead.source}</b></div>
          <div><small>Project type</small><b>{lead.type}</b></div><div><small>Estimated budget</small><b>{lead.budget}</b></div>
          <div><small>Next follow-up</small><b>Not set</b></div><div><small>Created</small><b>{lead.date}</b></div>
          <div><small>Timeline</small><b>Not set</b></div><div><small>Location</small><b>Not provided</b></div>
        </section>
        <section className="client-drawer-section"><h3>About this opportunity</h3><div className="lead-opportunity-summary">Other inquiry for this client</div></section>
        <section className="client-drawer-section"><div className="client-section-heading"><h3>Tags</h3><span>{tags.length}/12</span></div>{tags.length ? <div className="client-tag-list">{tags.map(tag => <button key={tag} onClick={() => setTags(current => current.filter(item => item !== tag))}>{tag}<X size={12}/></button>)}</div> : <p className="client-muted">No tags yet.</p>}<form className="client-tag-form" onSubmit={addTag}><input value={tagDraft} onChange={event => setTagDraft(event.target.value)} maxLength={24} placeholder="Add a tag..." aria-label="New lead tag"/><button type="submit" disabled={tags.length >= 12}><Plus size={13}/> Add tag</button></form></section>
        <section className="client-drawer-section"><div className="client-section-heading"><h3>Recent activity</h3><button onClick={() => setTab('Activity')}>View all <span>→</span></button></div><div className="client-drawer-empty activity-empty">No activity has been recorded for this lead.</div></section>
      </>}
      {tab === 'Activity' && <section className="client-drawer-section"><div className="client-section-heading"><h3>Activity</h3><span>Recent updates</span></div><div className="client-drawer-empty">No activity has been recorded for this lead yet.</div></section>}
      {tab === 'Notes' && <section className="client-drawer-section"><h3>Notes</h3><form className="client-note-form" onSubmit={saveNote}><textarea value={noteDraft} onChange={event => setNoteDraft(event.target.value)} placeholder="Write a note about this lead..." rows={4}/><button type="submit" disabled={!noteDraft.trim()}>Save note</button></form>{notes.length ? <div className="client-notes-list">{notes.map((note, index) => <article key={`${index}-${note}`}><span>Ber · Just now</span><p>{note}</p></article>)}</div> : <div className="client-drawer-empty">No notes yet.</div>}</section>}
    </div>
    <footer className="lead-drawer-footer"><button className="lead-edit-button" onClick={onEdit}><Tag size={14}/>Edit lead</button><button className="lead-open-project" onClick={() => onFullWorkflow(lead)}>Open full workflow <ArrowRight size={14}/></button></footer>
  </aside></div>
}


