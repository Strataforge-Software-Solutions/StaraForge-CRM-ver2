import { useWorkspaceTasks } from '../lib/tasks'
import CustomerHub from '../components/CustomerHub'
import { recordId, overrideFor, related } from '../lib/records'
import { ArrowLeft, Building2, CalendarDays, Check, ClipboardList, FolderKanban, Mail, MapPin, Phone } from 'lucide-react'
import { ClientAvatar, type ClientDirectoryRow } from './ClientsPage'
import { ProjectAvatar, projectDirectory, type ProjectDirectoryRow } from './ProjectsPage'
import { projectTaskRows, type ProjectTaskRecord } from './ProjectTasksPage'
import { useDatabaseCollection } from '../lib/database'

export default function ClientRecordPage({ client, additionalProjects = [], statusOverrides = {}, onBack, onOpenProject, onOpenTask }: {
  client: ClientDirectoryRow
  additionalProjects?: ProjectDirectoryRow[]
  statusOverrides?: Record<string, string>
  onBack: () => void
  onOpenProject: (projectName: string) => void
  onOpenTask?: (task: ProjectTaskRecord) => void
}) {
  const [allTasks] = useWorkspaceTasks()
  const projects = [...projectDirectory.filter(project => !additionalProjects.some(extra => extra.name === project.name)), ...additionalProjects]
    .filter(project => related(project, client, 'client'))
    .map(project => ({ ...project, status: overrideFor(statusOverrides, project) ?? project.status }))
  const projectValue = projects.length === 0 ? '—' : projects.length === 1 ? projects[0].value : `${projects.length} projects`
  const projectNames = new Set(projects.map(project => project.name.toLowerCase()))
  const linkedTasks = allTasks.filter(task => projectNames.has(task.project.toLowerCase())).sort((a, b) => a.due.localeCompare(b.due))
  const openTasks = linkedTasks.filter(task => task.status !== 'Completed').length

  return <div className="directory-page task-detail-page client-record-page">
    <button className="task-detail-back" onClick={onBack}><ArrowLeft size={15}/> Back to clients</button>
    <header className="task-detail-heading">
      <div className="client-record-heading-main"><ClientAvatar client={client} className="client-record-avatar"/><div><span className="directory-eyebrow">RELATIONSHIPS / CLIENTS</span><h1>{client.name}</h1><p>{client.kind} · {client.relation}</p></div></div>
      <span className="client-active">{client.status}</span>
    </header>
    <section className="client-record-metrics" aria-label="Client summary">
      <div><span>Contacts</span><b>1</b><small>Primary: {client.contact}</small></div>
      <div><span>Projects</span><b>{projects.length}</b><small>{projects.length ? 'Linked projects' : 'No linked projects'}</small></div>
      <div><span>Project value</span><b>{projectValue}</b><small>Across linked projects</small></div>
      <div><span>Open tasks</span><b>{openTasks}</b><small>{linkedTasks.length - openTasks} completed</small></div>
    </section>
    <div className="client-record-grid">
      <section className="task-detail-card">
        <div className="task-detail-card-heading"><span className="client-record-icon"><Building2 size={17}/></span><div><h2>Client information</h2><p>Contact and relationship details</p></div></div>
        <div className="client-record-details">
          <div><small>Primary contact</small><b>{client.contact}</b></div>
          <div><small>Client type</small><b>{client.kind}</b></div>
          <div><span><Mail size={15}/><small>Email address</small></span><b>{client.email}</b></div>
          <div><span><Phone size={15}/><small>Phone</small></span><b>{client.phone}</b></div>
          <div><span><MapPin size={15}/><small>Location</small></span><b>{client.location || 'Not provided'}</b></div>
          <div><small>Website</small><b>{client.website || 'Not added'}</b></div>
          <div><small>Updated</small><b>{client.updated}</b></div>
          <div><small>Relationship</small><b>{client.relation}</b></div>
        </div>
      </section>
      <section className="task-detail-card client-record-projects">
        <div className="task-detail-card-heading"><span className="client-record-icon"><FolderKanban size={17}/></span><div><h2>Projects</h2><p>{projects.length} linked {projects.length === 1 ? 'project' : 'projects'}</p></div></div>
        {projects.length ? <div className="client-record-project-list">{projects.map(project => <ProjectCard key={project.name} project={project} onOpen={() => onOpenProject(project.name)}/>)}</div> : <div className="client-record-empty"><FolderKanban size={18}/><b>No projects yet</b><span>Projects linked to this client will appear here.</span></div>}
      </section>
    </div>
    <section className="task-detail-card client-record-task-section">
      <div className="task-detail-card-heading"><span className="client-record-icon client-record-task-icon"><ClipboardList size={17}/></span><div><h2>Project tasks</h2><p>{linkedTasks.length} linked {linkedTasks.length === 1 ? 'task' : 'tasks'} across this client’s projects</p></div><span className="client-record-task-open-count">{openTasks} open</span></div>
      {linkedTasks.length ? <div className="client-record-task-list">{linkedTasks.map(task => <button type="button" className="client-record-task-row" key={`${task.project}-${task.title}`} onClick={() => onOpenTask?.(task)} disabled={!onOpenTask}><span className="client-record-task-check"><Check size={14}/></span><span className="client-record-task-copy"><b>{task.title}</b><small>{task.project}</small></span><span className="client-record-task-due"><CalendarDays size={13}/>{task.due}</span><span className={`project-task-status ${task.status.toLowerCase().replace(/ /g, '-')}`}>{task.status}</span></button>)}</div> : <div className="client-record-empty"><ClipboardList size={18}/><b>No tasks linked yet</b><span>Tasks from the client’s projects will appear here.</span></div>}
    </section>
    <CustomerHub client={client}/>
  </div>
}

function ProjectCard({ project, onOpen }: { project: ProjectDirectoryRow; onOpen: () => void }) {
  return <article className="client-record-project"><div className="client-record-project-main"><ProjectAvatar project={project}/><div><button type="button" className="client-record-project-link" onClick={onOpen}>{project.name}</button><small>{project.type} · Target {project.target}</small></div></div><span className={`project-record-status ${project.status.toLowerCase().replace(/ /g, '-')}`}>{project.status}</span><strong>{project.value}</strong></article>
}
