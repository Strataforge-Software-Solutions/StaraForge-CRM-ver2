import { ArrowLeft, Building2, FolderKanban, Mail, MapPin, Phone } from 'lucide-react'
import type { ClientDirectoryRow } from './ClientsPage'
import { projectDirectory, type ProjectDirectoryRow } from './ProjectsPage'

export default function ClientRecordPage({ client, additionalProjects = [], statusOverrides = {}, onBack }: {
  client: ClientDirectoryRow
  additionalProjects?: ProjectDirectoryRow[]
  statusOverrides?: Record<string, string>
  onBack: () => void
}) {
  const projects = [...projectDirectory.filter(project => !additionalProjects.some(extra => extra.name === project.name)), ...additionalProjects]
    .filter(project => project.client === client.name)
    .map(project => ({ ...project, status: statusOverrides[project.name] ?? project.status }))

  return <div className="directory-page task-detail-page client-record-page">
    <button className="task-detail-back" onClick={onBack}><ArrowLeft size={15}/> Back to clients</button>
    <header className="task-detail-heading">
      <div><span className="directory-eyebrow">RELATIONSHIPS / CLIENTS</span><h1>{client.name}</h1><p>{client.kind} · {client.relation}</p></div>
      <span className="client-active">{client.status}</span>
    </header>
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
        {projects.length ? <div className="client-record-project-list">{projects.map(project => <ProjectCard key={project.name} project={project}/>)}</div> : <div className="client-drawer-empty">No projects linked to this client yet.</div>}
      </section>
    </div>
  </div>
}

function ProjectCard({ project }: { project: ProjectDirectoryRow }) {
  return <article className="client-record-project"><div><b>{project.name}</b><small>{project.type} · Target {project.target}</small></div><span className={`project-record-status ${project.status.toLowerCase().replace(/ /g, '-')}`}>{project.status}</span><strong>{project.value}</strong></article>
}
