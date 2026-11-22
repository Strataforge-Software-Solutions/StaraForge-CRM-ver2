import { useWorkspaceTasks } from '../lib/tasks'
import PaymentPanel from '../components/PaymentPanel'
import { recordId, overrideFor, related } from '../lib/records'
import type { RecordIdentity } from '../lib/records'
import { Pagination, usePagination } from '../components/Pagination'
import { useState } from 'react'
import { Activity, ArrowLeft, ArrowRight, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, CreditCard, Eye, Layers3, X } from 'lucide-react'
import { DirectoryHeader, MetricsStrip, DirectoryTabs, RecordActionButtons, RecordActionDialog, useDrawerExit, type DirectoryAction } from '../components/DirectoryShared'
import { CustomSelect } from '../components/CustomControls'
import { projectTaskRows, type ProjectTaskRecord } from './ProjectTasksPage'
import ProjectTaskDetailPage from './ProjectTaskDetailPage'
import BoardPage from './BoardPage'
import { useDatabaseCollection } from '../lib/database'

export type ProjectDirectoryRow = RecordIdentity & { name: string; client: string; initials: string; type: string; start: string; target: string; value: string; status: string; tone: string; scope?: string; primaryContact?: string; contactEmail?: string; contactPhone?: string; proposalFileId?: string; acceptanceFileId?: string; acceptanceSummary?: string; avatarUrl?: string }

export function ProjectAvatar({ project, className = 'directory-avatar' }: { project: Pick<ProjectDirectoryRow, 'initials' | 'tone' | 'avatarUrl'>; className?: string }) {
  return <span className={`${className} ${project.tone} ${project.avatarUrl ? 'has-photo' : ''}`} aria-hidden="true">{project.avatarUrl ? <img src={project.avatarUrl} alt=""/> : project.initials}</span>
}


export const projectDirectory: ProjectDirectoryRow[] = []

const dateInputValue = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const dateDisplayValue = (value: string) => {
  if (!value) return ''
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}


export default function ProjectsPage({ onAdd, onOpenTask, onOpenFullProject, onBackFromFullProject, initialProjectName, initialFullProjectName, additionalProjects = [], statusOverrides = {} }: { onAdd: () => void; onOpenTask?: (task: ProjectTaskRecord) => void; onOpenFullProject?: (projectName: string) => void; onBackFromFullProject?: () => void; initialProjectName?: string; initialFullProjectName?: string; additionalProjects?: ProjectDirectoryRow[]; statusOverrides?: Record<string, string> }) {
  const [active, setActive] = useState('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('Recently updated')
  const [projectOverrides, setProjectOverrides] = useDatabaseCollection<Record<string, Partial<ProjectDirectoryRow>>>('projectOverrides', {})
  const [deletedProjects, setDeletedProjects] = useDatabaseCollection<string[]>('deletedProjects', [])
  const [action, setAction] = useState<DirectoryAction | null>(null)
  const allProjects = [...projectDirectory.filter(project => !additionalProjects.some(extra => extra.name === project.name)), ...additionalProjects]
    .map(project => ({ ...project, ...overrideFor(projectOverrides, project), status: overrideFor(statusOverrides, project) ?? overrideFor(projectOverrides, project)?.status ?? project.status }))
    .filter(project => !(deletedProjects.includes(recordId(project)) || deletedProjects.includes(project.legacyName || project.name)))
  const [selectedProject, setSelectedProject] = useState<ProjectDirectoryRow | null>(() => allProjects.find(project => project.name === initialProjectName) ?? null)
  const [fullProject, setFullProject] = useState<ProjectDirectoryRow | null>(() => allProjects.find(project => project.name === initialFullProjectName) ?? null)
  const openAction = (project: ProjectDirectoryRow, mode: 'edit' | 'delete') => setAction({
    mode, name: project.name,
    fields: [['Client', project.client], ['Project type', project.type], ['Start date', project.start], ['Target date', project.target], ['Agreed value', project.value], ['Status', project.status]],
    editTitle: 'Edit project',
    editDescription: 'Update the project name and delivery dates.',
    editNote: 'Agreed value stays tied to the accepted proposal.',
    modalClassName: mode === 'edit' ? 'project-edit-dialog' : undefined,
    editSections: mode === 'edit' ? [{ title: 'Project details', fields: [
      { key: 'avatarUrl', label: 'Project profile photo', value: project.avatarUrl ?? '', type: 'image', wide: true },
      { key: 'name', label: 'Project name', value: project.name, wide: true },
      { key: 'start', label: 'Start date', value: dateInputValue(project.start), type: 'date' },
      { key: 'target', label: 'Target date', value: dateInputValue(project.target), type: 'date' },
    ] }] : undefined,
    onSave: values => {
      const updated = { ...project, name: values.name.trim() || project.name, start: dateDisplayValue(values.start), target: dateDisplayValue(values.target), avatarUrl: values.avatarUrl }
      setProjectOverrides(current => ({ ...current, [recordId(project)]: { ...current[project.name], updatedAt: new Date().toISOString(), name: updated.name, start: updated.start, target: updated.target, avatarUrl: updated.avatarUrl } }))
      setSelectedProject(current => current?.name === project.name ? updated : current)
    },
    onDelete: () => { setDeletedProjects(current => [...new Set([...current, recordId(project)])]); setSelectedProject(current => current?.name === project.name ? null : current) },
  })
  const countStatus = (status: string) => allProjects.filter(project => project.status === status).length
  const tabs = [{ label: 'All projects', value: 'all', count: allProjects.length }, { label: 'Planned', value: 'Planned', count: countStatus('Planned') }, { label: 'In progress', value: 'In progress', count: countStatus('In progress') }, { label: 'Completed', value: 'Completed', count: countStatus('Completed') }, { label: 'On hold', value: 'On hold', count: countStatus('On hold') }, { label: 'Cancelled', value: 'Cancelled', count: countStatus('Cancelled') }]
  const filtered = allProjects.filter(row => (active === 'all' || row.status === active) && `${row.name} ${row.client} ${row.type}`.toLowerCase().includes(search.toLowerCase()))
  const sorted = sort === 'Name A–Z' ? [...filtered].sort((a, b) => a.name.localeCompare(b.name)) : sort === 'Target date' ? [...filtered].sort((a, b) => (new Date(a.target).getTime() || Infinity) - (new Date(b.target).getTime() || Infinity)) : [...filtered].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
  const paging = usePagination(sorted, `${active}:${search}`)
  if (fullProject) return <ProjectFullRecord project={fullProject} onBack={() => { setFullProject(null); onBackFromFullProject?.() }} onOpenTask={onOpenTask}/>
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
        {paging.items.map(row => <tr key={recordId(row)}><td><div className="person-cell"><ProjectAvatar project={row}/><div><b>{row.name}</b><small>{row.status}</small></div></div></td><td>{row.client}</td><td>{row.type}</td><td>{row.start}</td><td>{row.target}</td><td>{row.value}</td><td><span className={`project-record-status ${row.status.toLowerCase().replace(/ /g, '-')}`}>{row.status}</span></td><td><RecordActionButtons name={row.name} onAction={mode => mode === 'view' ? setSelectedProject(row) : openAction(row, mode)}/></td></tr>)}
      </tbody></table>{sorted.length === 0 && <div className="directory-empty">No projects match your search.</div>}</div>
      <Pagination paging={paging} noun="projects"/>
    </section>
    {action && <RecordActionDialog key={`${action.mode}-${action.name}`} action={action} onClose={() => setAction(null)}/>}
    {selectedProject && <ProjectDetailDrawer key={selectedProject.name} project={selectedProject} onClose={() => setSelectedProject(null)} onEdit={() => { setSelectedProject(null); openAction(selectedProject, 'edit') }} onDelete={() => { setSelectedProject(null); openAction(selectedProject, 'delete') }} onOpenFullProject={() => { setFullProject(selectedProject); setSelectedProject(null); onOpenFullProject?.(selectedProject.name) }}/>}
  </div>
}


function ProjectHandoffFiles({ project }: { project: ProjectDirectoryRow }) {
  const [files] = useDatabaseCollection<Record<string, { name: string; data: string }>>('workflowFiles', {})
  return <div className="project-handoff-files">{([['Proposal', project.proposalFileId], ['Approval', project.acceptanceFileId]] as const).map(([label, id]) => id && files[id] ? <a key={label} href={files[id].data} download={files[id].name}>{label}: {files[id].name}</a> : null)}</div>
}
type ProjectDrawerTab = 'Overview' | 'Tasks' | 'Payments'

function ProjectDetailDrawer({ project, onClose, onEdit, onDelete, onOpenFullProject }: { project: ProjectDirectoryRow; onClose: () => void; onEdit: () => void; onDelete: () => void; onOpenFullProject: () => void }) {
  const { closing, close } = useDrawerExit(onClose)
  const [tab, setTab] = useState<ProjectDrawerTab>('Overview')
  const [allTasks] = useWorkspaceTasks()
  const relatedTasks = allTasks.filter(task => related(task, project, 'project'))
  const tabs: ProjectDrawerTab[] = ['Overview', 'Tasks', 'Payments']
  return <div className={`client-drawer-backdrop${closing ? ' is-closing' : ''}`} onClick={() => close()}><aside className={`client-detail-drawer${closing ? ' is-closing' : ''}`} role="dialog" aria-modal="true" aria-label={`${project.name} project details`} onClick={event => event.stopPropagation()}>
    <header className="client-drawer-header"><ProjectAvatar project={project}/><div className="client-drawer-title"><h2>{project.name}</h2><span>{project.client}</span></div><span className={`project-record-status ${project.status.toLowerCase().replace(/ /g, '-')}`}>{project.status}</span><button className="client-drawer-close" aria-label="Close project details" onClick={() => close()}><X size={17}/></button></header>
    <nav className="client-drawer-tabs" aria-label="Project details tabs" role="tablist">{tabs.map(item => <button key={item} role="tab" aria-selected={tab === item} className={tab === item ? 'selected' : ''} onClick={() => setTab(item)}>{item}{item === 'Tasks' ? ` (${relatedTasks.length})` : item === 'Payments' ? ' (0)' : ''}</button>)}</nav>
    <div className="client-drawer-content">
      {tab === 'Overview' && <>
        <section className="client-drawer-section"><h3>Project information</h3><dl className="client-info-list"><div><dt>Client</dt><dd>{project.client}</dd></div><div><dt>Project type</dt><dd>{project.type}</dd></div><div><dt>Status</dt><dd>{project.status}</dd></div><div><dt>Start date</dt><dd>{project.start}</dd></div><div><dt>Target date</dt><dd>{project.target}</dd></div>{project.primaryContact && <div><dt>Primary contact</dt><dd>{project.primaryContact}</dd></div>}{project.contactEmail && <div><dt>Contact email</dt><dd>{project.contactEmail}</dd></div>}{project.contactPhone && <div><dt>Contact phone</dt><dd>{project.contactPhone}</dd></div>}<div><dt>Agreed value</dt><dd>{project.value}</dd></div><div><dt>Paid to date</dt><dd>Not recorded</dd></div></dl><p className="project-payment-help">Payment records show receipts; delivery progress is tracked separately by project status and tasks.</p></section>
        <section className="client-drawer-section"><h3>Accepted scope</h3>{project.scope ? <p className="project-accepted-scope">{project.scope}</p> : <div className="client-drawer-empty compact-empty">No accepted scope has been added yet.</div>}{project.acceptanceSummary && <p className="project-acceptance-summary"><b>Approval:</b> {project.acceptanceSummary}</p>}<ProjectHandoffFiles project={project}/></section>
      </>}
      {tab === 'Tasks' && <section className="client-drawer-section"><h3>Project tasks</h3>{relatedTasks.length ? <div className="project-drawer-task-list">{relatedTasks.map(task => <ProjectTaskMiniCard key={task.title} task={task}/>)}</div> : <div className="client-drawer-empty">No tasks are linked to this project yet.</div>}</section>}
      {tab === 'Payments' && <PaymentPanel project={project}/>}
    </div>
    <footer className="project-detail-footer"><button className="project-edit-button" onClick={() => close(onEdit)}>Edit project</button><button className="project-delete-button" onClick={() => close(onDelete)}>Delete project</button><button className="project-full-record-button" onClick={() => close(onOpenFullProject)}>Open full project <ArrowRight size={14}/></button></footer>
  </aside></div>
}

function ProjectFullRecord({ project, onBack, onOpenTask }: { project: ProjectDirectoryRow; onBack: () => void; onOpenTask?: (task: ProjectTaskRecord) => void }) {
  const [allTasks] = useWorkspaceTasks()
  const relatedTasks = allTasks.filter(task => related(task, project, 'project'))
  const primaryTask = relatedTasks[0]
  if (primaryTask) return <ProjectTaskDetailPage task={primaryTask} onBack={onBack} onOpenProject={() => {}} hideOpenProject projectContext projectClient={project.client}/>
  return <div className="directory-page task-detail-page project-full-record">
    <button className="task-detail-back" onClick={onBack}><ArrowLeft size={15}/> Back to projects</button>
    <header className="task-detail-heading"><div><span className="directory-eyebrow">DELIVERY WORKSPACE / PROJECTS</span><h1>{project.name}</h1><p>{project.client} · {project.type}</p></div><span className={`project-task-status ${project.status.toLowerCase().replace(/ /g, '-')}`}>{project.status}</span></header>
    <div className="task-detail-grid">
      <div className="task-detail-main">
        <section className="task-detail-card"><div className="task-detail-card-heading"><span className="task-detail-icon orange"><Layers3 size={17}/></span><div><h2>Project information</h2><p>Client and delivery details</p></div></div><div className="task-detail-properties"><div><div><small>Client</small><b>{project.client}</b></div></div><div><div><small>Project type</small><b>{project.type}</b></div></div><div><div><small>Start date</small><b>{project.start}</b></div></div><div><div><small>Target date</small><b>{project.target}</b></div></div><div><div><small>Agreed value</small><b>{project.value}</b></div></div><div><div><small>Status</small><b>{project.status}</b></div></div></div><p className="project-payment-help">Payment records show receipts; delivery progress is tracked separately by project status and tasks.</p></section>
        <section className="task-detail-card"><div className="task-detail-card-heading"><span className="task-detail-icon blue"><ClipboardList size={17}/></span><div><h2>Project tasks</h2><p>No linked tasks</p></div></div><div className="client-drawer-empty">No tasks are linked to this project yet.</div></section>
      </div>
      <aside className="task-detail-side"><PaymentPanel project={project}/></aside>
    </div>
    <div className="task-detail-board-section"><BoardPage projectContext projectId={project.id} legacyProjectName={project.legacyName} projectName={project.name} projectClient={project.client}/></div>
  </div>
}

function ProjectTaskMiniCard({ task, onOpen }: { task: ProjectTaskRecord; onOpen?: () => void }) {
  const content = <><div className="project-task-mini-heading"><b>{task.title}</b><span className={`project-task-status ${task.status.toLowerCase().replace(/ /g, '-')}`}>{task.status}</span></div><div className="project-task-mini-meta"><span><CalendarDays size={12}/>{task.due}</span><span className={`priority ${task.priority.toLowerCase()}`}>{task.priority}</span></div>{task.overdue && <small className="overdue-note">Overdue</small>}</>
  return onOpen ? <button type="button" className="project-task-mini-card is-clickable" onClick={onOpen}>{content}</button> : <article className="project-task-mini-card">{content}</article>
}


