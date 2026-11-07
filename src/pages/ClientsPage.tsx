import { useState } from 'react'
import { ArrowRight, Building2, Check, ChevronDown, ChevronLeft, ChevronRight, Layers3, Mail, Phone, Plus, Search, Trash2, Users, X } from 'lucide-react'
import { ContactDetails, DirectoryHeader, MetricsStrip, DirectoryTabs, RecordActionButtons, RecordActionDialog, type DirectoryAction } from '../components/DirectoryShared'
import { CustomSelect } from '../components/CustomControls'
import { projectDirectory, type ProjectDirectoryRow } from './ProjectsPage'

export type ClientDirectoryRow = { name: string; initials: string; kind: string; contact: string; relation: string; email: string; phone: string; status: string; projects: number; value: string; updated: string; tone: string; website?: string; location?: string }
type ClientDrawerTab = 'Overview' | 'Projects' | 'Notes' | 'CRM changes'

const clientDirectory: ClientDirectoryRow[] = [
  { name: 'Jollibee', initials: 'J', kind: 'Organization', contact: 'Jollibee', relation: 'From linked inquiry', email: 'jollibee@gmail.com', phone: '67676767', status: 'Active', projects: 1, value: 'PHP 2,000.00', updated: 'Nov 4, 2026', tone: 'orange' },
  { name: 'Strataforge', initials: 'ST', kind: 'Organization', contact: 'Ber', relation: 'Company', email: 'asdasdasd@gmail.com', phone: '213213', status: 'Active', projects: 0, value: '—', updated: 'Nov 4, 2026', tone: 'blue' },
  { name: 'VioTrack', initials: 'VI', kind: 'Organization', contact: 'VioTrack', relation: 'From linked inquiry', email: 'viotrack@gmail.com', phone: '09876543211', status: 'Active', projects: 1, value: 'PHP 3,000.00', updated: 'Nov 2, 2026', tone: 'purple' },
  { name: 'Company ABC', initials: 'CA', kind: 'Individual', contact: '12345', relation: 'From linked inquiry', email: 'companyabc@gmail.com', phone: '0987654321', status: 'Active', projects: 1, value: 'USD 100.00', updated: 'Oct 31, 2026', tone: 'orange' },
]


export default function ClientsPage({ onAdd, onOpenRecord }: { onAdd: () => void; onOpenRecord: (client: ClientDirectoryRow) => void }) {
  const [active, setActive] = useState('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('Recently updated')
  const [rows, setRows] = useState(clientDirectory)
  const [action, setAction] = useState<DirectoryAction | null>(null)
  const [selectedClient, setSelectedClient] = useState<ClientDirectoryRow | null>(null)
  const tabs = [{ label: 'All clients', value: 'all', count: 4 }, { label: 'Active', value: 'Active', count: 4 }, { label: 'On hold', value: 'On hold', count: 0 }, { label: 'Inactive', value: 'Inactive', count: 0 }]
  const visible = rows.filter(row => (active === 'all' || row.status === active) && `${row.name} ${row.contact} ${row.email}`.toLowerCase().includes(search.toLowerCase()))
  const sorted = sort === 'Name A–Z' ? [...visible].sort((a, b) => a.name.localeCompare(b.name)) : sort === 'Project count' ? [...visible].sort((a, b) => b.projects - a.projects) : visible
  const openAction = (row: ClientDirectoryRow, mode: Exclude<DirectoryAction['mode'], 'view'>) => setAction({
    mode, name: row.name,
    fields: [['Type', row.kind], ['Primary contact', row.contact], ['Email', row.email], ['Phone', row.phone], ['Status', row.status], ['Projects', String(row.projects)], ['Total value', row.value], ['Updated', row.updated]],
    editTitle: 'Edit client',
    editDescription: 'Update the organization and primary contact details for this client.',
    editSections: mode === 'edit' ? [
      { title: 'Client details', description: 'Keep the client profile and contact information up to date.', fields: [
        { key: 'name', label: 'Company or client name', value: row.name },
        { key: 'contact', label: 'Primary contact', value: row.contact },
        { key: 'email', label: 'Email address', value: row.email, type: 'email' },
        { key: 'phone', label: 'Phone', value: row.phone, type: 'tel' },
        { key: 'kind', label: 'Client type', value: row.kind, type: 'select', options: ['Organization', 'Individual'] },
        { key: 'status', label: 'Status', value: row.status, type: 'select', options: ['Active', 'On hold', 'Inactive'] },
        { key: 'website', label: 'Website', value: row.website ?? '', placeholder: 'https://example.com' },
        { key: 'location', label: 'Location', value: row.location ?? '', placeholder: 'City or region' },
      ] },
    ] : undefined,
    onSave: values => setRows(current => current.map(item => item.name === row.name ? {
      ...item,
      name: values.name.trim() || item.name,
      initials: (values.name.trim() || item.name).trim().split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase(),
      contact: values.contact.trim(), email: values.email.trim(), phone: values.phone.trim(), kind: values.kind, status: values.status,
      website: values.website.trim(), location: values.location.trim(),
    } : item)),
    onDelete: () => { setRows(current => current.filter(item => item.name !== row.name)); setSelectedClient(current => current?.name === row.name ? null : current) },
  })
  return <div className="directory-page">
    <DirectoryHeader section="RELATIONSHIPS" title="Clients" description="Manage your clients, their projects, and communication in one place." action="Add Client" onAction={onAdd}/>
    <MetricsStrip metrics={[
      { icon: Users, label: 'Total clients', value: '4', detail: 'In your workspace', tone: 'orange' },
      { icon: Building2, label: 'Active clients', value: '4', detail: 'Current relationships', tone: 'blue' },
      { icon: Check, label: 'Completed projects', value: '1', detail: 'Finished client work', tone: 'green' },
      { icon: Layers3, label: 'Ongoing projects', value: '2', detail: 'Planned or in delivery', tone: 'purple' },
    ]}/>
    <div className="directory-toolbar"><DirectoryTabs tabs={tabs} active={active} onChange={setActive}/><div className="toolbar-controls"><label className="directory-search compact"><Search size={17}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search clients, projects, or contacts..."/></label><label className="directory-sort"><CustomSelect className="directory-sort-select" showChevron={false} value={sort} options={['Recently updated', 'Name A–Z', 'Project count']} onChange={setSort}/><ChevronDown size={15}/></label></div></div>
    <section className="directory-panel"><div className="directory-panel-head"><div><h2>Client directory</h2><span>{sorted.length} {sorted.length === 1 ? 'client' : 'clients'}</span></div></div>
      <div className="directory-table-wrap"><table className="directory-table clients-table"><thead><tr><th>Client</th><th>Primary contact</th><th>Email / phone</th><th>Status</th><th>Projects</th><th>Total value</th><th>Updated</th><th>Actions</th></tr></thead><tbody>
        {sorted.map(row => <tr key={row.name}><td><div className="person-cell"><span className={`directory-avatar ${row.tone}`}>{row.initials}</span><div><b>{row.name}</b><small>{row.kind}</small></div></div></td><td><div className="primary-contact"><b>{row.contact}</b><small>{row.relation}</small></div></td><td><ContactDetails email={row.email} phone={row.phone}/></td><td><span className="client-active">{row.status}</span></td><td>{row.projects}</td><td>{row.value}</td><td>{row.updated}</td><td><RecordActionButtons name={row.name} onAction={mode => mode === 'view' ? setSelectedClient(row) : openAction(row, mode)}/></td></tr>)}
      </tbody></table>{sorted.length === 0 && <div className="directory-empty">No clients match your search.</div>}</div>
      <div className="directory-panel-foot"><span>1–{sorted.length} of {sorted.length} clients</span><span className="pagination"><button disabled><ChevronLeft size={16}/></button>Page 1 of 1<button disabled><ChevronRight size={16}/></button></span><label>Rows <CustomSelect className="rows-select" value="10 per page" options={['10 per page', '25 per page']}/></label></div>
    </section>
    {action && <RecordActionDialog key={`${action.mode}-${action.name}`} action={action} onClose={() => setAction(null)}/>}
    {selectedClient && <ClientDetailDrawer key={selectedClient.name} client={selectedClient} onClose={() => setSelectedClient(null)} onDelete={() => openAction(selectedClient, 'delete')} onOpenRecord={() => { onOpenRecord(selectedClient); setSelectedClient(null) }}/>}
  </div>
}

function ClientDetailDrawer({ client, onClose, onDelete, onOpenRecord }: { client: ClientDirectoryRow; onClose: () => void; onDelete: () => void; onOpenRecord: () => void }) {
  const [tab, setTab] = useState<ClientDrawerTab>('Overview')
  const [tags, setTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState('')
  const [noteDraft, setNoteDraft] = useState('')
  const [notes, setNotes] = useState<string[]>([])
  const relatedProjects = projectDirectory.filter(project => project.client === client.name)
  const addTag = (event: React.FormEvent) => {
    event.preventDefault()
    const tag = tagDraft.trim()
    if (!tag || tags.some(item => item.toLowerCase() === tag.toLowerCase())) return
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
  const tabs: ClientDrawerTab[] = ['Overview', 'Projects', 'Notes', 'CRM changes']
  return <div className="client-drawer-backdrop" onClick={onClose}><aside className="client-detail-drawer" role="dialog" aria-modal="true" aria-label={`${client.name} client details`} onClick={event => event.stopPropagation()}>
    <header className="client-drawer-header"><span className={`directory-avatar ${client.tone}`}>{client.initials}</span><div className="client-drawer-title"><h2>{client.name}</h2><span>{client.relation}</span></div><span className="client-drawer-status">{client.status}</span><button className="client-drawer-close" aria-label="Close client details" onClick={onClose}><X size={17}/></button></header>
    <nav className="client-drawer-tabs" aria-label="Client details tabs" role="tablist">{tabs.map(item => <button key={item} role="tab" aria-selected={tab === item} className={tab === item ? 'selected' : ''} onClick={() => setTab(item)}>{item}</button>)}</nav>
    <div className="client-drawer-content">
      {tab === 'Overview' && <>
        <section className="client-drawer-section"><h3>Client information</h3><div className="client-drawer-contact"><span className="client-drawer-info-icon"><Users size={15}/></span><div><b>{client.contact}</b><small>Primary contact</small><span><Mail size={12}/>{client.email}</span><span><Phone size={12}/>{client.phone}</span></div></div>
          <dl className="client-info-list"><div><dt>Client type</dt><dd>{client.kind}</dd></div><div><dt>Status</dt><dd>{client.status}</dd></div><div><dt>Website</dt><dd>{client.website || 'Not added'}</dd></div><div><dt>Location</dt><dd>{client.location || 'Not provided'}</dd></div><div><dt>Updated</dt><dd>{client.updated}</dd></div></dl>
        </section>
        <section className="client-drawer-section"><div className="client-section-heading"><h3>Projects ({relatedProjects.length})</h3><button onClick={() => setTab('Projects')}>View all <span>→</span></button></div>
          {relatedProjects.length ? <div className="client-related-projects">{relatedProjects.map(project => <ProjectMiniCard key={project.name} project={project}/>)}</div> : <div className="client-drawer-empty compact-empty">No projects linked to this client.</div>}
        </section>
        <section className="client-drawer-section"><div className="client-section-heading"><h3>Tags</h3><span>{tags.length}/12</span></div>
          {tags.length ? <div className="client-tag-list">{tags.map(tag => <button key={tag} onClick={() => setTags(current => current.filter(item => item !== tag))}>{tag}<X size={12}/></button>)}</div> : <p className="client-muted">No tags yet.</p>}
          <form className="client-tag-form" onSubmit={addTag}><input value={tagDraft} onChange={event => setTagDraft(event.target.value)} maxLength={24} placeholder="Add a tag..." aria-label="New client tag"/><button type="submit"><Plus size={13}/> Add tag</button></form>
        </section>
        <section className="client-drawer-section"><div className="client-section-heading"><h3>Recent activity</h3><span className="client-muted">Latest updates</span></div><div className="client-drawer-empty activity-empty">No client activity has been recorded yet.</div></section>
      </>}
      {tab === 'Projects' && <section className="client-drawer-section"><h3>Projects</h3><p className="client-muted">Projects linked to {client.name}</p>{relatedProjects.length ? <div className="client-related-projects">{relatedProjects.map(project => <ProjectMiniCard key={project.name} project={project}/>)}</div> : <div className="client-drawer-empty">No projects linked to this client yet.</div>}</section>}
      {tab === 'Notes' && <section className="client-drawer-section"><h3>Notes</h3><form className="client-note-form" onSubmit={saveNote}><textarea value={noteDraft} onChange={event => setNoteDraft(event.target.value)} placeholder="Write a note about this client..." rows={4}/><button type="submit" disabled={!noteDraft.trim()}>Save note</button></form>{notes.length ? <div className="client-notes-list">{notes.map((note, index) => <article key={`${index}-${note}`}><span>Ber · Just now</span><p>{note}</p></article>)}</div> : <div className="client-drawer-empty">No notes yet.</div>}</section>}
      {tab === 'CRM changes' && <section className="client-drawer-section"><h3>CRM changes</h3><div className="client-drawer-empty">No changes have been recorded for this client yet.</div></section>}
    </div>
    <footer className="client-detail-footer"><button className="client-delete-button" onClick={onDelete}><Trash2 size={14}/>Delete client</button><button className="client-open-record-button" onClick={onOpenRecord}>Open full client record <ArrowRight size={14}/></button></footer>
  </aside></div>
}

function ProjectMiniCard({ project }: { project: ProjectDirectoryRow }) {
  return <article className="client-project-card"><div><b>{project.name}</b><small>{project.value}</small></div><span className={`project-record-status ${project.status.toLowerCase().replace(/ /g, '-')}`}>{project.status}</span></article>
}


