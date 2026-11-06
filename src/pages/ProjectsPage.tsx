import { useState } from 'react'
import { Activity, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, CreditCard, Eye, Layers3, X } from 'lucide-react'
import { DirectoryHeader, MetricsStrip, DirectoryTabs } from '../components/DirectoryShared'
import { projectTaskRows, type ProjectTaskRecord } from './ProjectTasksPage'

export type ProjectDirectoryRow = { name: string; client: string; initials: string; type: string; start: string; target: string; value: string; status: string; tone: string }


export const projectDirectory: ProjectDirectoryRow[] = [
  { name: 'Jollibee pos system', client: 'Jollibee', initials: 'JO', type: 'Website', start: 'Nov 30, 2026', target: 'Dec 1, 2026', value: 'PHP 2,000.00', status: 'Planned', tone: 'blue' },
  { name: 'VioTrack Monitoring System Website', client: 'VioTrack', initials: 'VI', type: 'Website', start: 'Nov 2, 2026', target: 'Dec 1, 2026', value: 'PHP 3,000.00', status: 'Completed', tone: 'green' },
  { name: 'Company ABC Website', client: 'Company ABC', initials: 'CA', type: 'Website', start: 'Oct 31, 2026', target: 'Nov 5, 2026', value: 'USD 100.00', status: 'In progress', tone: 'green' },
]


export default function ProjectsPage({ onAdd, initialProjectName }: { onAdd: () => void; initialProjectName?: string }) {
  const [active, setActive] = useState('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('Recently updated')
  const [selectedProject, setSelectedProject] = useState<ProjectDirectoryRow | null>(() => projectDirectory.find(project => project.name === initialProjectName) ?? null)
  const tabs = [{ label: 'All projects', value: 'all', count: 3 }, { label: 'Planned', value: 'Planned', count: 1 }, { label: 'In progress', value: 'In progress', count: 1 }, { label: 'Completed', value: 'Completed', count: 1 }, { label: 'On hold', value: 'On hold', count: 0 }, { label: 'Cancelled', value: 'Cancelled', count: 0 }]
  const filtered = projectDirectory.filter(row => (active === 'all' || row.status === active) && `${row.name} ${row.client} ${row.type}`.toLowerCase().includes(search.toLowerCase()))
  const sorted = sort === 'Name A–Z' ? [...filtered].sort((a, b) => a.name.localeCompare(b.name)) : sort === 'Target date' ? [...filtered].sort((a, b) => a.target.localeCompare(b.target)) : filtered
  return <div className="directory-page">
    <DirectoryHeader section="DELIVERY WORKSPACE" title="Projects" description="Manage client projects from accepted proposal through delivery." action="New project" onAction={onAdd}/>
    <MetricsStrip metrics={[
      { icon: Layers3, label: 'Total projects', value: '3', detail: 'Confirmed client work', tone: 'orange' },
      { icon: Activity, label: 'In progress', value: '1', detail: 'Currently in delivery', tone: 'blue' },
      { icon: Check, label: 'Completed', value: '1', detail: 'Finished projects', tone: 'green' },
      { icon: ClipboardList, label: 'On hold', value: '0', detail: 'Paused delivery', tone: 'purple' },
    ]}/>
    <div className="directory-toolbar"><DirectoryTabs tabs={tabs} active={active} onChange={setActive}/></div>
    <section className="directory-panel"><div className="directory-panel-head"><div><h2>Project directory</h2><span>{sorted.length} {sorted.length === 1 ? 'project' : 'projects'}</span></div><div className="project-panel-controls"><label><span>Search projects</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Project or client name..."/></label><label className="directory-sort"><span>Sort by</span><select value={sort} onChange={event => setSort(event.target.value)}><option>Recently updated</option><option>Name A–Z</option><option>Target date</option></select><ChevronDown size={15}/></label></div></div>
      <div className="directory-table-wrap"><table className="directory-table projects-table"><thead><tr><th>Project</th><th>Client</th><th>Type</th><th>Start date</th><th>Target date</th><th>Agreed value</th><th>Status</th><th>Open</th></tr></thead><tbody>
        {sorted.map(row => <tr key={row.name}><td><div className="person-cell"><span className={`directory-avatar ${row.tone}`}>{row.initials}</span><div><b>{row.name}</b><small>{row.status}</small></div></div></td><td>{row.client}</td><td>{row.type}</td><td>{row.start}</td><td>{row.target}</td><td>{row.value}</td><td><span className={`project-record-status ${row.status.toLowerCase().replace(/ /g, '-')}`}>{row.status}</span></td><td><button className="open-link project-open-icon" aria-label={`Open ${row.name}`} title="Open project" onClick={() => setSelectedProject(row)}><Eye size={15}/></button></td></tr>)}
      </tbody></table>{sorted.length === 0 && <div className="directory-empty">No projects match your search.</div>}</div>
      <div className="directory-panel-foot"><span>1–{sorted.length} of {sorted.length} projects</span><span className="pagination"><button disabled><ChevronLeft size={16}/></button>Page 1 of 1<button disabled><ChevronRight size={16}/></button></span><label>Rows <select defaultValue="10"><option>10 per page</option><option>25 per page</option></select></label></div>
    </section>
    {selectedProject && <ProjectDetailDrawer key={selectedProject.name} project={selectedProject} onClose={() => setSelectedProject(null)}/>}
  </div>
}

type ProjectDrawerTab = 'Overview' | 'Tasks' | 'Payments'

function ProjectDetailDrawer({ project, onClose }: { project: ProjectDirectoryRow; onClose: () => void }) {
  const [tab, setTab] = useState<ProjectDrawerTab>('Overview')
  const relatedTasks = projectTaskRows.filter(task => task.project === project.name)
  const tabs: ProjectDrawerTab[] = ['Overview', 'Tasks', 'Payments']
  return <div className="client-drawer-backdrop" onClick={onClose}><aside className="client-detail-drawer" role="dialog" aria-modal="true" aria-label={`${project.name} project details`} onClick={event => event.stopPropagation()}>
    <header className="client-drawer-header"><span className={`directory-avatar ${project.tone}`}>{project.initials}</span><div className="client-drawer-title"><h2>{project.name}</h2><span>{project.client}</span></div><span className={`project-record-status ${project.status.toLowerCase().replace(/ /g, '-')}`}>{project.status}</span><button className="client-drawer-close" aria-label="Close project details" onClick={onClose}><X size={17}/></button></header>
    <nav className="client-drawer-tabs" aria-label="Project details tabs" role="tablist">{tabs.map(item => <button key={item} role="tab" aria-selected={tab === item} className={tab === item ? 'selected' : ''} onClick={() => setTab(item)}>{item}{item === 'Tasks' ? ` (${relatedTasks.length})` : item === 'Payments' ? ' (0)' : ''}</button>)}</nav>
    <div className="client-drawer-content">
      {tab === 'Overview' && <>
        <section className="client-drawer-section"><h3>Project information</h3><dl className="client-info-list"><div><dt>Client</dt><dd>{project.client}</dd></div><div><dt>Project type</dt><dd>{project.type}</dd></div><div><dt>Status</dt><dd>{project.status}</dd></div><div><dt>Start date</dt><dd>{project.start}</dd></div><div><dt>Target date</dt><dd>{project.target}</dd></div><div><dt>Agreed value</dt><dd>{project.value}</dd></div><div><dt>Paid to date</dt><dd>Not recorded</dd></div></dl><p className="project-payment-help">Payment records show receipts; delivery progress is tracked separately by project status and tasks.</p></section>
        <section className="client-drawer-section"><h3>Accepted scope</h3><div className="client-drawer-empty compact-empty">No accepted scope has been added yet.</div></section>
      </>}
      {tab === 'Tasks' && <section className="client-drawer-section"><h3>Project tasks</h3>{relatedTasks.length ? <div className="project-drawer-task-list">{relatedTasks.map(task => <ProjectTaskMiniCard key={task.title} task={task}/>)}</div> : <div className="client-drawer-empty">No tasks are linked to this project yet.</div>}</section>}
      {tab === 'Payments' && <section className="client-drawer-section"><h3>Payments</h3><div className="client-drawer-empty project-payment-empty"><span><CreditCard size={18}/></span><b>No payment records yet</b><p>Recorded receipts will appear here.</p></div></section>}
    </div>
  </aside></div>
}

function ProjectTaskMiniCard({ task }: { task: ProjectTaskRecord }) {
  return <article className="project-task-mini-card"><div className="project-task-mini-heading"><b>{task.title}</b><span className={`project-task-status ${task.status.toLowerCase().replace(/ /g, '-')}`}>{task.status}</span></div><div className="project-task-mini-meta"><span><CalendarDays size={12}/>{task.due}</span><span className={`priority ${task.priority.toLowerCase()}`}>{task.priority}</span></div>{task.overdue && <small className="overdue-note">Overdue</small>}</article>
}


