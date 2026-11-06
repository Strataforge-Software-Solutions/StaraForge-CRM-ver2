import { useState } from 'react'
import { ArrowRight, Check, ChevronLeft, ChevronRight, ClipboardList, Phone, Plus, Search, Tag, Users, X } from 'lucide-react'
import { ContactDetails, DirectoryHeader, MetricsStrip, DirectoryTabs, RecordActionButtons, RecordActionDialog, type DirectoryAction } from '../components/DirectoryShared'
import { projectDirectory, type ProjectDirectoryRow } from './ProjectsPage'

export type LeadDirectoryRow = { name: string; client: string; initials: string; email: string; phone: string; source: string; type: string; budget: string; status: string; date: string; tone: string }
type LeadDrawerTab = 'Overview' | 'Activity' | 'Notes'

const leadDirectory: LeadDirectoryRow[] = [
  { name: 'Jollibee', client: 'Jollibee', initials: 'J', email: 'jollibee@gmail.com', phone: '67676767', source: 'Referral', type: 'Website', budget: 'PHP 2,000.00', status: 'New Leads', date: 'Nov 3, 2026', tone: 'orange' },
  { name: 'Jollibee2', client: 'Jollibee', initials: 'JO', email: 'jollibee@gmail.com', phone: '67676767', source: 'Unspecified', type: 'Website', budget: 'Not discussed', status: 'Contacted', date: 'Nov 4, 2026', tone: 'blue' },
  { name: 'Mr. Jose', client: 'Mr. Jose', initials: 'MJ', email: 'bahba@bahbah.com', phone: '6767', source: 'Referral', type: 'Frontend', budget: 'USD 10,000.00', status: 'Awaiting deposit', date: 'Nov 4, 2026', tone: 'green' },
  { name: 'VioTrack', client: 'VioTrack', initials: 'V', email: 'viotrack@gmail.com', phone: '09876543211', source: 'Social Media: Facebook', type: 'Website', budget: 'PHP 3,000.00', status: 'Won', date: 'Nov 2, 2026', tone: 'purple' },
  { name: 'Company ABC', client: '12345', initials: 'CA', email: 'companyabc@gmail.com', phone: '0987654321', source: 'Inquiry Form', type: 'Website', budget: 'USD 70.00', status: 'Won', date: 'Oct 31, 2026', tone: 'orange' },
]


export default function LeadsPage({ onAdd, onFullWorkflow, onOpenProject }: { onAdd: () => void; onFullWorkflow: (lead: LeadDirectoryRow) => void; onOpenProject: (project: ProjectDirectoryRow) => void }) {
  const [active, setActive] = useState('all')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState(leadDirectory)
  const [action, setAction] = useState<DirectoryAction | null>(null)
  const [selectedLead, setSelectedLead] = useState<LeadDirectoryRow | null>(null)
  const tabs = [
    { label: 'All Leads', value: 'all', count: 5 }, { label: 'New Leads', value: 'New Leads', count: 1 },
    { label: 'Contacted', value: 'Contacted', count: 1 }, { label: 'Discovery', value: 'Discovery', count: 0 },
    { label: 'Proposal sent', value: 'Proposal sent', count: 0 }, { label: 'Awaiting deposit', value: 'Awaiting deposit', count: 1 },
    { label: 'Won', value: 'Won', count: 2 }, { label: 'Lost', value: 'Lost', count: 0 },
  ]
  const visible = rows.filter(row => (active === 'all' || row.status === active) && `${row.name} ${row.client} ${row.email} ${row.source}`.toLowerCase().includes(search.toLowerCase()))
  const openAction = (row: LeadDirectoryRow, mode: DirectoryAction['mode']) => setAction({ mode, name: row.name, fields: [['Client', row.client], ['Email', row.email], ['Phone', row.phone], ['Source', row.source], ['Project type', row.type], ['Budget', row.budget], ['Status', row.status], ['Date', row.date]], onSave: name => setRows(current => current.map(item => item.name === row.name ? { ...item, name } : item)), onDelete: () => setRows(current => current.filter(item => item.name !== row.name)) })
  return <div className="directory-page">
    <DirectoryHeader section="SALES WORKSPACE" title="Leads" description="Manage website inquiries and move promising conversations toward a real project." action="Add Lead" onAction={onAdd}/>
    <MetricsStrip metrics={[
      { icon: Users, label: 'Total Leads', value: '5', detail: 'All active inquiries', tone: 'orange' },
      { icon: ClipboardList, label: 'New Leads', value: '1', detail: 'Awaiting first contact', tone: 'blue' },
      { icon: Phone, label: 'Contacted', value: '1', detail: 'Conversation started', tone: 'green' },
      { icon: Check, label: 'Converted', value: '2', detail: 'Confirmed projects', tone: 'purple' },
    ]}/>
    <DirectoryTabs tabs={tabs} active={active} onChange={setActive}/>
    <section className="directory-panel"><div className="directory-panel-head"><div><h2>{active === 'all' ? 'All Leads' : active}</h2><span>{visible.length} {visible.length === 1 ? 'lead' : 'leads'}</span></div><form className="directory-search" onSubmit={event => event.preventDefault()}><Search size={17}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search leads..."/><button>Search</button></form></div>
      <div className="directory-table-wrap"><table className="directory-table leads-table"><thead><tr><th>Name</th><th>Contact</th><th>Source</th><th>Project Type</th><th>Budget</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead><tbody>
        {visible.map(row => <tr key={row.name}><td><div className="person-cell"><span className={`directory-avatar ${row.tone}`}>{row.initials}</span><div><b>{row.name}</b><small>{row.client}</small><em>Other inquiry for this client</em></div></div></td><td><ContactDetails email={row.email} phone={row.phone}/></td><td>{row.source}</td><td><span className="type-chip">{row.type}</span></td><td>{row.budget}</td><td><span className={`record-status ${row.status.toLowerCase().replace(/ /g, '-')}`}>{row.status}</span></td><td>{row.date}</td><td><RecordActionButtons name={row.name} onAction={mode => mode === 'view' ? setSelectedLead(row) : openAction(row, mode)}/></td></tr>)}
      </tbody></table>{visible.length === 0 && <div className="directory-empty">No leads match your search.</div>}</div>
      <div className="directory-panel-foot"><span>1–{visible.length} of {visible.length} leads</span><span className="pagination"><button disabled><ChevronLeft size={16}/></button>Page 1 of 1<button disabled><ChevronRight size={16}/></button></span><label>Rows <select defaultValue="10"><option>10</option><option>25</option></select></label></div>
    </section>
    {action && <RecordActionDialog key={`${action.mode}-${action.name}`} action={action} onClose={() => setAction(null)}/>}
    {selectedLead && <LeadDetailDrawer key={selectedLead.name} lead={selectedLead} onClose={() => setSelectedLead(null)} onFullWorkflow={onFullWorkflow} onEdit={() => openAction(selectedLead, 'edit')} onOpenProject={onOpenProject}/>}
  </div>
}

function LeadDetailDrawer({ lead, onClose, onFullWorkflow, onEdit, onOpenProject }: { lead: LeadDirectoryRow; onClose: () => void; onFullWorkflow: (lead: LeadDirectoryRow) => void; onEdit: () => void; onOpenProject: (project: ProjectDirectoryRow) => void }) {
  const [tab, setTab] = useState<LeadDrawerTab>('Overview')
  const [tags, setTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState('')
  const [noteDraft, setNoteDraft] = useState('')
  const [notes, setNotes] = useState<string[]>([])
  const relatedProject = projectDirectory.find(project => project.client === lead.client || project.client === lead.name)
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
    <footer className="lead-drawer-footer"><button className="lead-edit-button" onClick={onEdit}><Tag size={14}/>Edit lead</button><button className="lead-open-project" disabled={!relatedProject} onClick={() => relatedProject && onOpenProject(relatedProject)}>Open project <ArrowRight size={14}/></button></footer>
  </aside></div>
}


