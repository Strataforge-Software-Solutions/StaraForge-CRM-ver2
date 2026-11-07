import { useState } from 'react'
import { Activity, ArrowLeft, ArrowRight, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, CreditCard, Eye, Layers3, X } from 'lucide-react'
import { DirectoryHeader, MetricsStrip, DirectoryTabs, RecordActionButtons, RecordActionDialog, type DirectoryAction } from '../components/DirectoryShared'
import { CustomSelect } from '../components/CustomControls'
import { projectTaskRows, type ProjectTaskRecord } from './ProjectTasksPage'

export type ProjectDirectoryRow = { name: string; client: string; initials: string; type: string; start: string; target: string; value: string; status: string; tone: string }


export const projectDirectory: ProjectDirectoryRow[] = [
  { name: 'Jollibee pos system', client: 'Jollibee', initials: 'JO', type: 'Website', start: 'Nov 30, 2026', target: 'Dec 1, 2026', value: 'PHP 2,000.00', status: 'Planned', tone: 'blue' },
  { name: 'VioTrack Monitoring System Website', client: 'VioTrack', initials: 'VI', type: 'Website', start: 'Nov 2, 2026', target: 'Dec 1, 2026', value: 'PHP 3,000.00', status: 'Completed', tone: 'green' },
  { name: 'Company ABC Website', client: 'Company ABC', initials: 'CA', type: 'Website', start: 'Oct 31, 2026', target: 'Nov 5, 2026', value: 'USD 100.00', status: 'In progress', tone: 'green' },
]

const dateInputValue = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const dateDisplayValue = (value: string) => {
  if (!value) return ''
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}


export default function ProjectsPage({ onAdd, initialProjectName, additionalProjects = [], statusOverrides = {} }: { onAdd: () => void; initialProjectName?: string; additionalProjects?: ProjectDirectoryRow[]; statusOverrides?: Record<string, string> }) {
  const [active, setActive] = useState('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('Recently updated')
  const [projectOverrides, setProjectOverrides] = useState<Record<string, Partial<ProjectDirectoryRow>>>({})
  const [deletedProjects, setDeletedProjects] = useState<string[]>([])
  const [action, setAction] = useState<DirectoryAction | null>(null)
  const allProjects = [...projectDirectory.filter(project => !additionalProjects.some(extra => extra.name === project.name)), ...additionalProjects]
    .map(project => ({ ...project, ...projectOverrides[project.name], status: statusOverrides[project.name] ?? projectOverrides[project.name]?.status ?? project.status }))
    .filter(project => !deletedProjects.includes(project.name))
  const [selectedProject, setSelectedProject] = useState<ProjectDirectoryRow | null>(() => allProjects.find(project => project.name === initialProjectName) ?? null)
  const [fullProject, setFullProject] = useState<ProjectDirectoryRow | null>(null)
  const openAction = (project: ProjectDirectoryRow, mode: 'edit' | 'delete') => setAction({
    mode, name: project.name,
    fields: [['Client', project.client], ['Project type', project.type], ['Start date', project.start], ['Target date', project.target], ['Agreed value', project.value], ['Status', project.status]],
    editTitle: 'Edit project',
    editDescription: 'Update the project name and delivery dates.',
    editNote: 'Agreed value stays tied to the accepted proposal.',
    modalClassName: mode === 'edit' ? 'project-edit-dialog' : undefined,
    editSections: mode === 'edit' ? [{ title: 'Project details', fields: [
      { key: 'name', label: 'Project name', value: project.name, wide: true },
      { key: 'start', label: 'Start date', value: dateInputValue(project.start), type: 'date' },
      { key: 'target', label: 'Target date', value: dateInputValue(project.target), type: 'date' },
    ] }] : undefined,
    onSave: values => {
      const updated = { ...project, name: values.name.trim() || project.name, start: dateDisplayValue(values.start), target: dateDisplayValue(values.target) }
      setProjectOverrides(current => ({ ...current, [project.name]: { ...current[project.name], name: updated.name, start: updated.start, target: updated.target } }))
      setSelectedProject(current => current?.name === project.name ? updated : current)
    },
    onDelete: () => { setDeletedProjects(current => [...new Set([...current, project.name])]); setSelectedProject(current => current?.name === project.name ? null : current) },
  })
  const countStatus = (status: string) => allProjects.filter(project => project.status === status).length
  const tabs = [{ label: 'All projects', value: 'all', count: allProjects.length }, { label: 'Planned', value: 'Planned', count: countStatus('Planned') }, { label: 'In progress', value: 'In progress', count: countStatus('In progress') }, { label: 'Completed', value: 'Completed', count: countStatus('Completed') }, { label: 'On hold', value: 'On hold', count: countStatus('On hold') }, { label: 'Cancelled', value: 'Cancelled', count: countStatus('Cancelled') }]
  const filtered = allProjects.filter(row => (active === 'all' || row.status === active) && `${row.name} ${row.client} ${row.type}`.toLowerCase().includes(search.toLowerCase()))
  const sorted = sort === 'Name A–Z' ? [...filtered].sort((a, b) => a.name.localeCompare(b.name)) : sort === 'Target date' ? [...filtered].sort((a, b) => a.target.localeCompare(b.target)) : filtered
  return <div className="directory-page">
    <DirectoryHeader section="DELIVERY WORKSPACE" title="Projects" description="Manage client projects from accepted proposal through delivery." action="New project" onAction={onAdd}/>
    <MetricsStrip metrics={[
      { icon: Layers3, label: 'Total projects', value: String(allProjects.length), detail: 'Confirmed client work', tone: 'orange' },
      { icon: Activity, label: 'In progress', value: String(countStatus('In progress')), detail: 'Currently in delivery', tone: 'blue' },
      { icon: Check, label: 'Completed', value: String(countStatus('Completed')), detail: 'Finished projects', tone: 'green' },
      { icon: ClipboardList, label: 'On hold', value: String(countStatus('On hold')), detail: 'Paused delivery', tone: 'purple' },
    ]}/>
    <div className="directory-toolbar"><DirectoryTabs tabs={tabs} active={active} onChange={setActive}/></div>
    <section className="directory-panel"><div className="directory-panel-head"><div><h2>Project directory</h2><span>{sorted.length} {sorted.length === 1 ? 'project' : 'projects'}</span></div><div className="project-panel-controls"><label><span>Search projects</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Project or client name..."/></label><label className="directory-sort"><span>Sort by</span><CustomSelect className="directory-sort-select" showChevron={false} ariaLabel="Sort projects" value={sort} options={['Recently updated', 'Name A–Z', 'Target date']} onChange={setSort}/><ChevronDown size={15}/></label></div></div>
      <div className="directory-table-wrap"><table className="directory-table projects-table"><thead><tr><th>Project</th><th>Client</th><th>Type</th><th>Start date</th><th>Target date</th><th>Agreed value</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {sorted.map(row => <tr key={row.name}><td><div className="person-cell"><span className={`directory-avatar ${row.tone}`}>{row.initials}</span><div><b>{row.name}</b><small>{row.status}</small></div></div></td><td>{row.client}</td><td>{row.type}</td><td>{row.start}</td><td>{row.target}</td><td>{row.value}</td><td><span className={`project-record-status ${row.status.toLowerCase().replace(/ /g, '-')}`}>{row.status}</span></td><td><RecordActionButtons name={row.name} onAction={mode => mode === 'view' ? setSelectedProject(row) : openAction(row, mode)}/></td></tr>)}
      </tbody></table>{sorted.length === 0 && <div className="directory-empty">No projects match your search.</div>}</div>
      <div className="directory-panel-foot"><span>1–{sorted.length} of {sorted.length} projects</span><span className="pagination"><button disabled><ChevronLeft size={16}/></button>Page 1 of 1<button disabled><ChevronRight size={16}/></button></span><label>Rows <CustomSelect className="rows-select" value="10 per page" options={['10 per page', '25 per page']}/></label></div>
    </section>
    {action && <RecordActionDialog key={`${action.mode}-${action.name}`} action={action} onClose={() => setAction(null)}/>}
    {selectedProject && <ProjectDetailDrawer key={selectedProject.name} project={selectedProject} onClose={() => setSelectedProject(null)} onEdit={() => { setSelectedProject(null); openAction(selectedProject, 'edit') }} onDelete={() => { setSelectedProject(null); openAction(selectedProject, 'delete') }} onOpenFullProject={() => { setFullProject(selectedProject); setSelectedProject(null) }}/>}
    {fullProject && <ProjectFullRecord project={fullProject} onBack={() => setFullProject(null)}/>}
  </div>
}

type ProjectDrawerTab = 'Overview' | 'Tasks' | 'Payments'

function ProjectDetailDrawer({ project, onClose, onEdit, onDelete, onOpenFullProject }: { project: ProjectDirectoryRow; onClose: () => void; onEdit: () => void; onDelete: () => void; onOpenFullProject: () => void }) {
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
    <footer className="project-detail-footer"><button className="project-edit-button" onClick={onEdit}>Edit project</button><button className="project-delete-button" onClick={onDelete}>Delete project</button><button className="project-full-record-button" onClick={onOpenFullProject}>Open full project <ArrowRight size={14}/></button></footer>
  </aside></div>
}

function ProjectFullRecord({ project, onBack }: { project: ProjectDirectoryRow; onBack: () => void }) {
  const relatedTasks = projectTaskRows.filter(task => task.project === project.name)
  return <div className="directory-page task-detail-page project-full-record">
    <button className="task-detail-back" onClick={onBack}><ArrowLeft size={15}/> Back to projects</button>
    <header className="task-detail-heading"><div><span className="directory-eyebrow">DELIVERY WORKSPACE / PROJECTS</span><h1>{project.name}</h1><p>{project.client} · {project.type}</p></div><span className={`project-task-status ${project.status.toLowerCase().replace(/ /g, '-')}`}>{project.status}</span></header>
    <div className="task-detail-grid">
      <div className="task-detail-main">
        <section className="task-detail-card"><div className="task-detail-card-heading"><span className="task-detail-icon orange"><Layers3 size={17}/></span><div><h2>Project information</h2><p>Client and delivery details</p></div></div><div className="task-detail-properties"><div><div><small>Client</small><b>{project.client}</b></div></div><div><div><small>Project type</small><b>{project.type}</b></div></div><div><div><small>Start date</small><b>{project.start}</b></div></div><div><div><small>Target date</small><b>{project.target}</b></div></div><div><div><small>Agreed value</small><b>{project.value}</b></div></div><div><div><small>Status</small><b>{project.status}</b></div></div></div><p className="project-payment-help">Payment records show receipts; delivery progress is tracked separately by project status and tasks.</p></section>
        <section className="task-detail-card"><div className="task-detail-card-heading"><span className="task-detail-icon blue"><ClipboardList size={17}/></span><div><h2>Project tasks</h2><p>{relatedTasks.length} linked {relatedTasks.length === 1 ? 'task' : 'tasks'}</p></div></div>{relatedTasks.length ? <div className="project-drawer-task-list">{relatedTasks.map(task => <ProjectTaskMiniCard key={task.title} task={task}/>)}</div> : <div className="client-drawer-empty">No tasks are linked to this project yet.</div>}</section>
      </div>
      <aside className="task-detail-side"><section className="task-detail-card"><div className="task-detail-card-heading"><span className="task-detail-icon green"><CreditCard size={17}/></span><div><h2>Payments</h2><p>Recorded receipts</p></div></div><div className="client-drawer-empty project-payment-empty"><span><CreditCard size={18}/></span><b>No payment records yet</b><p>Recorded receipts will appear here.</p></div></section></aside>
    </div>
  </div>
}

function ProjectTaskMiniCard({ task }: { task: ProjectTaskRecord }) {
  return <article className="project-task-mini-card"><div className="project-task-mini-heading"><b>{task.title}</b><span className={`project-task-status ${task.status.toLowerCase().replace(/ /g, '-')}`}>{task.status}</span></div><div className="project-task-mini-meta"><span><CalendarDays size={12}/>{task.due}</span><span className={`priority ${task.priority.toLowerCase()}`}>{task.priority}</span></div>{task.overdue && <small className="overdue-note">Overdue</small>}</article>
}


