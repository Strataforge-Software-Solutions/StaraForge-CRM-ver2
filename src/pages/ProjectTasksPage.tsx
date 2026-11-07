import { useState } from 'react'
import { Activity, Check, ChevronDown, ChevronLeft, ChevronRight, Circle, ClipboardList, Eye, Search } from 'lucide-react'
import { DirectoryHeader, DirectoryStat, DirectoryTabs } from '../components/DirectoryShared'
import { CustomSelect } from '../components/CustomControls'

export type ProjectTaskRecord = { title: string; project: string; assignee: string; due: string; priority: 'Low' | 'Medium' | 'High' | 'Urgent'; status: 'To do' | 'In progress' | 'Completed'; overdue?: boolean }
export const projectTaskRows: ProjectTaskRecord[] = [
  { title: 'center the div', project: 'VioTrack Monitoring System Website', assignee: 'Ber', due: 'Nov 2, 2026', priority: 'Medium', status: 'In progress' },
  { title: 'landing page', project: 'Company ABC Website', assignee: 'Unassigned', due: 'Nov 2, 2026', priority: 'Urgent', status: 'To do', overdue: true },
  { title: 'Hello', project: 'Jollibee pos system', assignee: 'Ber', due: 'Nov 3, 2026', priority: 'Low', status: 'To do' },
  { title: 'Update the UI', project: 'Company ABC Website', assignee: 'Ber', due: 'Nov 4, 2026', priority: 'High', status: 'In progress' },
  { title: 'QA checkout flow', project: 'Jollibee pos system', assignee: 'Mr. Jose', due: 'Nov 5, 2026', priority: 'Low', status: 'Completed' },
]

export default function ProjectTasksPage({ onAdd, onViewTask, initialProjectName }: { onAdd: () => void; onViewTask: (task: ProjectTaskRecord) => void; initialProjectName?: string }) {
  const [active, setActive] = useState('all')
  const [search, setSearch] = useState('')
  const [project, setProject] = useState(initialProjectName ?? 'All projects')
  const [sort, setSort] = useState('Due date')
  const tabs = [{ label: 'All tasks', value: 'all', count: 5 }, { label: 'To do', value: 'To do', count: 2 }, { label: 'In progress', value: 'In progress', count: 2 }, { label: 'Completed', value: 'Completed', count: 1 }, { label: 'Overdue', value: 'Overdue', count: 1 }]
  const filtered = projectTaskRows.filter(row => (active === 'all' || (active === 'Overdue' ? row.overdue : row.status === active)) && (project === 'All projects' || row.project === project) && `${row.title} ${row.project} ${row.assignee}`.toLowerCase().includes(search.toLowerCase()))
  const visible = sort === 'Task name' ? [...filtered].sort((a, b) => a.title.localeCompare(b.title)) : filtered
  return <div className="directory-page">
    <DirectoryHeader section="DELIVERY WORKSPACE" title="Project tasks" description="Coordinate task ownership and deadlines across every project." action="Add task" onAction={onAdd}/>
    <div className="directory-stat-grid">
      <DirectoryStat icon={ClipboardList} label="Total tasks" value="5" detail="Across all projects" tone="orange"/><DirectoryStat icon={Circle} label="To do" value="2" detail="Ready to start" tone="blue"/><DirectoryStat icon={Activity} label="In progress" value="2" detail="Currently underway" tone="purple"/><DirectoryStat icon={Check} label="Completed" value="1" detail="Finished tasks" tone="green"/>
    </div>
    <div className="directory-toolbar"><DirectoryTabs tabs={tabs} active={active} onChange={setActive}/><div className="toolbar-controls"><label className="directory-sort project-task-filter"><CustomSelect className="directory-sort-select" showChevron={false} ariaLabel="Filter by project" value={project} options={['All projects', 'VioTrack Monitoring System Website', 'Company ABC Website', 'Jollibee pos system']} onChange={setProject}/><ChevronDown size={15}/></label><label className="directory-search compact"><Search size={17}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search tasks..."/></label></div></div>
    <section className="directory-panel"><div className="directory-panel-head"><div><h2>Task tracker</h2><span>{visible.length} {visible.length === 1 ? 'task' : 'tasks'}</span></div><label className="directory-sort task-sort"><span>Sort by</span><CustomSelect className="directory-sort-select" showChevron={false} ariaLabel="Sort tasks" value={sort} options={['Due date', 'Task name']} onChange={setSort}/><ChevronDown size={15}/></label></div>
      <div className="directory-table-wrap"><table className="directory-table project-tasks-table"><thead><tr><th>Project</th><th>Assignee</th><th>Due date</th><th>Priority</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {visible.map(row => <tr key={row.title}><td>{row.project}</td><td><span className="task-assignee">{row.assignee === 'Unassigned' ? '—' : row.assignee}</span></td><td className={row.overdue ? 'overdue-date' : ''}>{row.due}</td><td><span className={`priority ${row.priority.toLowerCase()}`}>{row.priority}</span></td><td><span className={`project-task-status ${row.status.toLowerCase().replace(/ /g, '-')}`}>{row.status}</span></td><td><button className="record-action-icon" aria-label={`View ${row.title}`} title="View task" onClick={() => onViewTask(row)}><Eye size={15}/></button></td></tr>)}
      </tbody></table>{visible.length === 0 && <div className="directory-empty">No tasks match your filters.</div>}</div>
      <div className="directory-panel-foot"><span>1–{visible.length} of {visible.length} tasks</span><span className="pagination"><button disabled><ChevronLeft size={16}/></button>Page 1 of 1<button disabled><ChevronRight size={16}/></button></span><label>Rows <CustomSelect className="rows-select" value="10 per page" options={['10 per page', '25 per page']}/></label></div>
    </section>
  </div>
}


