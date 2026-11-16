import { useState } from 'react'
import { CircleCheck, Clock3, ChevronDown, ChevronLeft, ChevronRight, FolderKanban, ListChecks, PlayCircle, Search } from 'lucide-react'
import { DirectoryHeader, DirectoryStat, DirectoryTabs } from '../components/DirectoryShared'
import { CustomSelect } from '../components/CustomControls'
import { useDatabaseCollection } from '../lib/database'

export type ProjectTaskRecord = { title: string; project: string; assignee: string; due: string; priority: 'Low' | 'Medium' | 'High' | 'Urgent'; status: 'To do' | 'In progress' | 'Completed'; overdue?: boolean }
export const projectTaskRows: ProjectTaskRecord[] = []

export default function ProjectTasksPage({ onOpenProject, initialProjectName }: { onOpenProject?: (projectName: string) => void; initialProjectName?: string }) {
  const [tasks] = useDatabaseCollection('tasks', projectTaskRows)
  const [active, setActive] = useState('all')
  const [search, setSearch] = useState('')
  const [project, setProject] = useState(initialProjectName ?? 'All projects')
  const [sort, setSort] = useState('Due date')
  const projectOptions = ['All projects', ...Array.from(new Set(tasks.map(task => task.project).filter(Boolean)))]
  const tabs = [{ label: 'All tasks', value: 'all', count: tasks.length }, { label: 'To do', value: 'To do', count: tasks.filter(task => task.status === 'To do').length }, { label: 'In progress', value: 'In progress', count: tasks.filter(task => task.status === 'In progress').length }, { label: 'Completed', value: 'Completed', count: tasks.filter(task => task.status === 'Completed').length }, { label: 'Overdue', value: 'Overdue', count: tasks.filter(task => task.overdue).length }]
  const filtered = tasks.filter(row => (active === 'all' || (active === 'Overdue' ? row.overdue : row.status === active)) && (project === 'All projects' || row.project === project) && `${row.title} ${row.project} ${row.assignee}`.toLowerCase().includes(search.toLowerCase()))
  const visible = sort === 'Task name' ? [...filtered].sort((a, b) => a.title.localeCompare(b.title)) : filtered
  return <div className="directory-page">
    <DirectoryHeader section="DELIVERY WORKSPACE" title="Project tasks" description="Coordinate task ownership and deadlines across every project."/>
    <div className="directory-stat-grid">
      <DirectoryStat icon={ListChecks} label="Total tasks" value={String(tasks.length)} detail="Across all projects" tone="orange"/><DirectoryStat icon={Clock3} label="To do" value={String(tasks.filter(task => task.status === 'To do').length)} detail="Ready to start" tone="blue"/><DirectoryStat icon={PlayCircle} label="In progress" value={String(tasks.filter(task => task.status === 'In progress').length)} detail="Currently underway" tone="purple"/><DirectoryStat icon={CircleCheck} label="Completed" value={String(tasks.filter(task => task.status === 'Completed').length)} detail="Finished tasks" tone="green"/>
    </div>
    <div className="directory-toolbar"><DirectoryTabs tabs={tabs} active={active} onChange={setActive}/><div className="toolbar-controls"><label className="directory-sort project-task-filter"><CustomSelect className="directory-sort-select" showChevron={false} ariaLabel="Filter by project" value={projectOptions.includes(project) ? project : 'All projects'} options={projectOptions} onChange={setProject}/><ChevronDown size={15}/></label><label className="directory-search compact"><Search size={17}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search tasks..."/></label></div></div>
    <section className="directory-panel"><div className="directory-panel-head"><div><h2>Task tracker</h2><span>{visible.length} {visible.length === 1 ? 'task' : 'tasks'}</span></div><label className="directory-sort task-sort"><span>Sort by</span><CustomSelect className="directory-sort-select" showChevron={false} ariaLabel="Sort tasks" value={sort} options={['Due date', 'Task name']} onChange={setSort}/><ChevronDown size={15}/></label></div>
      <div className="directory-table-wrap"><table className="directory-table project-tasks-table"><thead><tr><th>Project</th><th>Assignee</th><th>Due date</th><th>Priority</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {visible.map(row => <tr key={row.title}><td>{onOpenProject ? <button type="button" className="project-task-project-link" onClick={() => onOpenProject(row.project)}>{row.project}</button> : row.project}</td><td><span className="task-assignee">{row.assignee === 'Unassigned' ? '—' : row.assignee}</span></td><td className={row.overdue ? 'overdue-date' : ''}>{row.due}</td><td><span className={`priority ${row.priority.toLowerCase()}`}>{row.priority}</span></td><td><span className={`project-task-status ${row.status.toLowerCase().replace(/ /g, '-')}`}>{row.status}</span></td><td>{onOpenProject && <div className="record-actions"><button type="button" className="record-action-icon view-project-action" aria-label={`View project ${row.project}`} title="View project" onClick={() => onOpenProject(row.project)}><FolderKanban size={14}/><span>View project</span></button></div>}</td></tr>)}
      </tbody></table>{visible.length === 0 && <div className="directory-empty">No tasks match your filters.</div>}</div>
      <div className="directory-panel-foot"><span>1–{visible.length} of {visible.length} tasks</span><span className="pagination"><button disabled><ChevronLeft size={16}/></button>Page 1 of 1<button disabled><ChevronRight size={16}/></button></span><label>Rows <CustomSelect className="rows-select" value="10 per page" options={['10 per page', '25 per page']}/></label></div>
    </section>
  </div>
}


