import { recordId, overrideFor, related } from '../lib/records'
import type { RecordIdentity } from '../lib/records'
import { useEffect, useState } from 'react'
import { CalendarDays, CircleCheck, Clock3, ChevronLeft, ChevronRight, ClipboardList, FolderKanban, ListChecks, PlayCircle } from 'lucide-react'
import { DirectoryHeader, DirectoryStat } from '../components/DirectoryShared'
import { useDatabaseCollection } from '../lib/database'
import type { ProjectDirectoryRow } from './ProjectsPage'

export type ProjectTaskRecord = RecordIdentity & { title: string; project: string; assignee: string; due: string; priority: 'Low' | 'Medium' | 'High' | 'Urgent'; status: 'To do' | 'In progress' | 'Completed'; overdue?: boolean }
export const projectTaskRows: ProjectTaskRecord[] = []

export default function ProjectTasksPage({ onOpenProject, initialProjectName }: { onOpenProject?: (projectName: string) => void; initialProjectName?: string }) {
  const [tasks] = useDatabaseCollection('tasks', projectTaskRows)
  const [projectBoard] = useDatabaseCollection<{ id: string; name: string; tickets: { id: string; project: string; title: string }[] }[]>('projectBoard', [])
  const [projects] = useDatabaseCollection<ProjectDirectoryRow[]>('projects', [])
  const [projectOverrides] = useDatabaseCollection<Record<string, Partial<ProjectDirectoryRow>>>('projectOverrides', {})
  const [deletedProjects] = useDatabaseCollection<string[]>('deletedProjects', [])
  const [projectPage, setProjectPage] = useState(1)
  const activeProjects = projects
    .map(project => ({ ...project, ...overrideFor(projectOverrides, project) }))
    .filter(project => !(deletedProjects.includes(recordId(project)) || deletedProjects.includes(project.legacyName || project.name)))
  const boardTasks = projectBoard.flatMap(column => column.tickets.map(ticket => {
    const stage = `${column.id} ${column.name}`.toLowerCase()
    const status: ProjectTaskRecord['status'] = /won|deploy|complete/.test(stage) ? 'Completed' : /progress|building|review|test/.test(stage) ? 'In progress' : 'To do'
    return { ...ticket, status }
  }))
  const allTasks = [...tasks, ...boardTasks]
  const pageSize = 6
  const pageCount = Math.max(1, Math.ceil(activeProjects.length / pageSize))
  const visibleProjects = activeProjects.slice((projectPage - 1) * pageSize, projectPage * pageSize)
  useEffect(() => { if (projectPage > pageCount) setProjectPage(pageCount) }, [projectPage, pageCount])
  return <div className="directory-page">
    <DirectoryHeader section="DELIVERY WORKSPACE" title="Project tasks" description="Coordinate task ownership and deadlines across every project."/>
    <div className="directory-stat-grid">
      <DirectoryStat icon={ListChecks} label="Total tasks" value={String(allTasks.length)} detail="Across all projects" tone="orange"/><DirectoryStat icon={Clock3} label="To do" value={String(allTasks.filter(task => task.status === 'To do').length)} detail="Ready to start" tone="blue"/><DirectoryStat icon={PlayCircle} label="In progress" value={String(allTasks.filter(task => task.status === 'In progress').length)} detail="Currently underway" tone="purple"/><DirectoryStat icon={CircleCheck} label="Completed" value={String(allTasks.filter(task => task.status === 'Completed').length)} detail="Finished tasks" tone="green"/>
    </div>
    <section className="directory-panel project-task-projects-panel"><div className="directory-panel-head"><div><h2>Projects</h2><span>{activeProjects.length} {activeProjects.length === 1 ? 'project' : 'projects'} across this workspace</span></div></div>
      <div className="project-task-project-grid">{activeProjects.length ? visibleProjects.map(projectItem => <button key={projectItem.name} type="button" className="project-task-project-card" onClick={() => onOpenProject?.(projectItem.name)} disabled={!onOpenProject}>
        <span className="project-task-project-card-top"><span className={`directory-avatar ${projectItem.tone}`}>{projectItem.initials}</span><span className={`project-record-status ${projectItem.status.toLowerCase().replace(/ /g, '-')}`}>{projectItem.status}</span></span>
        <span className="project-task-project-card-name">{projectItem.name}</span>
        <span className="project-task-project-card-client">{projectItem.client}</span>
        <span className="project-task-project-card-details"><span><small><FolderKanban size={11}/>Type</small><b>{projectItem.type || '—'}</b></span><span><small><CalendarDays size={11}/>Target date</small><b>{projectItem.target || 'Not set'}</b></span></span>
        <span className="project-task-project-card-footer"><span className="project-task-project-task-count"><ClipboardList size={12}/>{allTasks.filter(task => task.project === projectItem.name).length} tasks</span><ChevronRight size={15}/></span>
      </button>) : <div className="directory-empty">No projects yet. Projects will appear here when they’re added to the workspace.</div>}</div>
      {activeProjects.length > 0 && <div className="directory-panel-foot project-task-projects-foot"><span>{Math.min((projectPage - 1) * pageSize + 1, activeProjects.length)}–{Math.min(projectPage * pageSize, activeProjects.length)} of {activeProjects.length} projects</span><span className="pagination"><button type="button" aria-label="Previous projects" disabled={projectPage <= 1} onClick={() => setProjectPage(page => Math.max(1, page - 1))}><ChevronLeft size={16}/></button>Page {projectPage} of {pageCount}<button type="button" aria-label="Next projects" disabled={projectPage >= pageCount} onClick={() => setProjectPage(page => Math.min(pageCount, page + 1))}><ChevronRight size={16}/></button></span><label>Rows <b>{pageSize} per page</b></label></div>}
    </section>
  </div>
}


