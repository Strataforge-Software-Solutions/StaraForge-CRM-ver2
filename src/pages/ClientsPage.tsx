import { recordId, overrideFor, related } from '../lib/records'
import type { RecordIdentity } from '../lib/records'
import { Pagination, usePagination } from '../components/Pagination'
import { useState } from 'react'
import { ArrowRight, Building2, Check, ChevronDown, ChevronLeft, ChevronRight, Layers3, Mail, Phone, Plus, Search, Trash2, Users, X } from 'lucide-react'
import { ContactDetails, DirectoryHeader, MetricsStrip, DirectoryTabs, RecordActionButtons, RecordActionDialog, useDrawerExit, type DirectoryAction } from '../components/DirectoryShared'
import { CustomSelect } from '../components/CustomControls'
import { useDatabaseCollection } from '../lib/database'
import { showWorkspaceToast } from '../lib/workspaceToast'
import { ProjectAvatar, projectDirectory, type ProjectDirectoryRow } from './ProjectsPage'

export type ClientDirectoryRow = RecordIdentity & { name: string; initials: string; kind: string; contact: string; relation: string; email: string; phone: string; status: string; projects: number; value: string; updated: string; tone: string; website?: string; location?: string; avatarUrl?: string }
type ClientDrawerTab = 'Overview' | 'Projects' | 'Notes' | 'CRM changes'

export const clientDirectory: ClientDirectoryRow[] = []

export function ClientAvatar({ client, className = 'directory-avatar' }: { client: Pick<ClientDirectoryRow, 'initials' | 'tone' | 'avatarUrl'>; className?: string }) {
  return <span className={`${className} ${client.tone} ${client.avatarUrl ? 'has-photo' : ''}`} aria-hidden="true">{client.avatarUrl ? <img src={client.avatarUrl} alt=""/> : client.initials}</span>
}


export default function ClientsPage({ onAdd, onOpenRecord }: { onAdd: () => void; onOpenRecord: (client: ClientDirectoryRow) => void }) {
  const [active, setActive] = useState('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('Recently updated')
  const [rows, setRows] = useDatabaseCollection('clients', clientDirectory)
  const [additionalProjects] = useDatabaseCollection<ProjectDirectoryRow[]>('projects', [])
  const [projectOverrides] = useDatabaseCollection<Record<string, Partial<ProjectDirectoryRow>>>('projectOverrides', {})
  const [deletedProjects] = useDatabaseCollection<string[]>('deletedProjects', [])
  const [projectStatusOverrides] = useDatabaseCollection<Record<string, string>>('projectStatusOverrides', {})
  const [action, setAction] = useState<DirectoryAction | null>(null)
  const [selectedClient, setSelectedClient] = useState<ClientDirectoryRow | null>(null)
  const allProjects = [...projectDirectory.filter(project => !additionalProjects.some(extra => extra.name === project.name)), ...additionalProjects]
    .map(project => ({ ...project, ...overrideFor(projectOverrides, project), status: overrideFor(projectStatusOverrides, project) ?? overrideFor(projectOverrides, project)?.status ?? project.status }))
    .filter(project => !(deletedProjects.includes(recordId(project)) || deletedProjects.includes(project.legacyName || project.name)))
  const activeClients = rows.filter(row => row.status.toLowerCase() === 'active').length
  const completedProjects = allProjects.filter(project => project.status.toLowerCase() === 'completed').length
  const ongoingProjects = allProjects.filter(project => ['planned', 'in progress'].includes(project.status.toLowerCase())).length
  const tabs = [{ label: 'All clients', value: 'all', count: rows.length }, { label: 'Active', value: 'Active', count: rows.filter(row => row.status === 'Active').length }, { label: 'On hold', value: 'On hold', count: rows.filter(row => row.status === 'On hold').length }, { label: 'Inactive', value: 'Inactive', count: rows.filter(row => row.status === 'Inactive').length }]
  const visible = rows.filter(row => (active === 'all' || row.status === active) && `${row.name} ${row.contact} ${row.email}`.toLowerCase().includes(search.toLowerCase()))
  const sorted = sort === 'Name A–Z' ? [...visible].sort((a, b) => a.name.localeCompare(b.name)) : sort === 'Project count' ? [...visible].sort((a, b) => b.projects - a.projects) : [...visible].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
  const paging = usePagination(sorted, `${active}:${search}`)
  const openAction = (row: ClientDirectoryRow, mode: Exclude<DirectoryAction['mode'], 'view'>) => setAction({
    mode, name: row.name,
    fields: [['Type', row.kind], ['Primary contact', row.contact], ['Email', row.email], ['Phone', row.phone], ['Status', row.status], ['Projects', String(row.projects)], ['Total value', row.value], ['Updated', row.updated]],
    editTitle: 'Edit client',
    editDescription: 'Update the organization and primary contact details for this client.',
    editSections: mode === 'edit' ? [
      { title: 'Client details', description: 'Keep the client profile and contact information up to date.', fields: [
        { key: 'avatarUrl', label: 'Profile photo', value: row.avatarUrl ?? '', type: 'image', wide: true },
        { key: 'name', label: 'Company or client name', value: row.name },
        { key: 'contact', label: 'Primary contact', value: row.contact },
        { key: 'email', label: 'Email address', value: row.email, type: 'email' },
        { key: 'phone', label: 'Phone', value: row.phone, type: 'tel' },
        { key: 'kind', label: 'Client type', value: row.kind, type: 'select', options: [...new Set([row.kind, 'Organization', 'Individual', 'Small business', 'Enterprise', 'Startup', 'Freelancer', 'Agency', 'Nonprofit', 'Government', 'Education', 'Healthcare', 'Retail', 'Other'])] },
        { key: 'status', label: 'Status', value: row.status, type: 'select', options: ['Active', 'On hold', 'Inactive'] },
        { key: 'website', label: 'Website', value: row.website ?? '', placeholder: 'https://example.com' },
        { key: 'location', label: 'Location', value: row.location ?? '', placeholder: 'City or region' },
      ] },
    ] : undefined,
    onSave: values => setRows(current => current.map(item => recordId(item) === recordId(row) ? {
      ...item,
      name: values.name.trim() || item.name,
      initials: (values.name.trim() || item.name).trim().split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase(),
      avatarUrl: values.avatarUrl || undefined,
      contact: values.contact.trim(), email: values.email.trim(), phone: values.phone.trim(), kind: values.kind, status: values.status,
      website: values.website.trim(), location: values.location.trim(),
    } : item)),
    onDelete: () => { setRows(current => current.filter(item => recordId(item) !== recordId(row))); setSelectedClient(current => current?.name === row.name ? null : current) },
  })
  return <div className="directory-page">
    <DirectoryHeader section="RELATIONSHIPS" title="Clients" description="Manage your clients, their projects, and communication in one place." action="Add Client" onAction={onAdd}/>
    <MetricsStrip metrics={[
      { icon: Users, label: 'Total clients', value: String(rows.length), detail: 'In your workspace', tone: 'orange' },
      { icon: Building2, label: 'Active clients', value: String(activeClients), detail: 'Current relationships', tone: 'blue' },
      { icon: Check, label: 'Completed projects', value: String(completedProjects), detail: 'Finished client work', tone: 'green' },
      { icon: Layers3, label: 'Ongoing projects', value: String(ongoingProjects), detail: 'Planned or in delivery', tone: 'purple' },
    ]}/>
    <div className="directory-toolbar"><DirectoryTabs tabs={tabs} active={active} onChange={setActive}/><div className="toolbar-controls"><label className="directory-search compact"><Search size={17}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search clients, projects, or contacts..."/></label><label className="directory-sort"><CustomSelect className="directory-sort-select" showChevron={false} value={sort} options={['Recently updated', 'Name A–Z', 'Project count']} onChange={setSort}/><ChevronDown size={15}/></label></div></div>
    <section className="directory-panel"><div className="directory-panel-head"><div><h2>Client directory</h2><span>{sorted.length} {sorted.length === 1 ? 'client' : 'clients'}</span></div></div>
      <div className="directory-table-wrap"><table className="directory-table clients-table"><thead><tr><th>Client</th><th>Primary contact</th><th>Email / phone</th><th>Status</th><th>Projects</th><th>Total value</th><th>Updated</th><th>Actions</th></tr></thead><tbody>
        {paging.items.map(row => <tr key={recordId(row)}><td><div className="person-cell"><ClientAvatar client={row}/><div><b>{row.name}</b><small>{row.kind}</small></div></div></td><td><div className="primary-contact"><b>{row.contact}</b><small>{row.relation}</small></div></td><td><ContactDetails email={row.email} phone={row.phone}/></td><td><span className="client-active">{row.status}</span></td><td>{row.projects}</td><td>{row.value}</td><td>{row.updated}</td><td><RecordActionButtons name={row.name} onAction={mode => mode === 'view' ? setSelectedClient(row) : openAction(row, mode)}/></td></tr>)}
      </tbody></table>{sorted.length === 0 && <div className="directory-empty">{rows.length === 0 && active === 'all' && !search.trim() ? 'No clients yet. Add a client to get started.' : 'No clients match your search or filter.'}</div>}</div>
      <Pagination paging={paging} noun="clients"/>
    </section>
    {action && <RecordActionDialog key={`${action.mode}-${action.name}`} action={action} onClose={() => setAction(null)}/>}
    {selectedClient && <ClientDetailDrawer key={selectedClient.name} client={selectedClient} onClose={() => setSelectedClient(null)} onDelete={() => openAction(selectedClient, 'delete')} onOpenRecord={() => { onOpenRecord(selectedClient); setSelectedClient(null) }}/>}
  </div>
}

function ClientDetailDrawer({ client, onClose, onDelete, onOpenRecord }: { client: ClientDirectoryRow; onClose: () => void; onDelete: () => void; onOpenRecord: () => void }) {
  const { closing, close } = useDrawerExit(onClose)
  const [tab, setTab] = useState<ClientDrawerTab>('Overview')
  const [tags, setTags] = useDatabaseCollection<string[]>(`clientTags:${recordId(client)}`, [])
  const [tagDraft, setTagDraft] = useState('')
  const [noteDraft, setNoteDraft] = useState('')
  const [notes, setNotes] = useDatabaseCollection<string[]>(`clientNotes:${recordId(client)}`, [])
  const [storedProjects] = useDatabaseCollection<ProjectDirectoryRow[]>('projects', [])
  const relatedProjects = storedProjects.filter(project => related(project, client, 'client'))
  const addTag = (event: React.FormEvent) => {
    event.preventDefault()
    const tag = tagDraft.trim()
    if (!tag || tags.some(item => item.toLowerCase() === tag.toLowerCase())) return
    setTags(current => [...current, tag])
    setTagDraft('')
    showWorkspaceToast('Client tag added.')
  }
  const saveNote = (event: React.FormEvent) => {
    event.preventDefault()
    const note = noteDraft.trim()
    if (!note) return
    setNotes(current => [note, ...current])
    setNoteDraft('')
    showWorkspaceToast('Client note added.')
  }
  const tabs: ClientDrawerTab[] = ['Overview', 'Projects', 'Notes', 'CRM changes']
  return <div className={`client-drawer-backdrop${closing ? ' is-closing' : ''}`} onClick={() => close()}><aside className={`client-detail-drawer${closing ? ' is-closing' : ''}`} role="dialog" aria-modal="true" aria-label={`${client.name} client details`} onClick={event => event.stopPropagation()}>
    <header className="client-drawer-header"><ClientAvatar client={client}/><div className="client-drawer-title"><h2>{client.name}</h2><span>{client.relation}</span></div><span className="client-drawer-status">{client.status}</span><button className="client-drawer-close" aria-label="Close client details" onClick={() => close()}><X size={17}/></button></header>
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
          {tags.length ? <div className="client-tag-list">{tags.map(tag => <button key={tag} onClick={() => { setTags(current => current.filter(item => item !== tag)); showWorkspaceToast('Client tag removed.') }}>{tag}<X size={12}/></button>)}</div> : <p className="client-muted">No tags yet.</p>}
          <form className="client-tag-form" onSubmit={addTag}><input value={tagDraft} onChange={event => setTagDraft(event.target.value)} maxLength={24} placeholder="Add a tag..." aria-label="New client tag"/><button type="submit"><Plus size={13}/> Add tag</button></form>
        </section>
        <section className="client-drawer-section"><div className="client-section-heading"><h3>Recent activity</h3><span className="client-muted">Latest updates</span></div><div className="client-drawer-empty activity-empty">No client activity has been recorded yet.</div></section>
      </>}
      {tab === 'Projects' && <section className="client-drawer-section"><h3>Projects</h3><p className="client-muted">Projects linked to {client.name}</p>{relatedProjects.length ? <div className="client-related-projects">{relatedProjects.map(project => <ProjectMiniCard key={project.name} project={project}/>)}</div> : <div className="client-drawer-empty">No projects linked to this client yet.</div>}</section>}
      {tab === 'Notes' && <section className="client-drawer-section"><h3>Notes</h3><form className="client-note-form" onSubmit={saveNote}><textarea value={noteDraft} onChange={event => setNoteDraft(event.target.value)} placeholder="Write a note about this client..." rows={4}/><button type="submit" disabled={!noteDraft.trim()}>Save note</button></form>{notes.length ? <div className="client-notes-list">{notes.map((note, index) => <article key={`${index}-${note}`}><span>Workspace member · Just now</span><p>{note}</p></article>)}</div> : <div className="client-drawer-empty">No notes yet.</div>}</section>}
      {tab === 'CRM changes' && <section className="client-drawer-section"><h3>CRM changes</h3><div className="client-drawer-empty">No changes have been recorded for this client yet.</div></section>}
    </div>
    <footer className="client-detail-footer"><button className="client-delete-button" onClick={() => close(onDelete)}><Trash2 size={14}/>Delete client</button><button className="client-open-record-button" onClick={() => close(onOpenRecord)}>Open full client record <ArrowRight size={14}/></button></footer>
  </aside></div>
}

function ProjectMiniCard({ project }: { project: ProjectDirectoryRow }) {
  return <article className="client-project-card"><ProjectAvatar project={project}/><div><b>{project.name}</b><small>{project.value}</small></div><span className={`project-record-status ${project.status.toLowerCase().replace(/ /g, '-')}`}>{project.status}</span></article>
}


