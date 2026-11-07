import { useState } from 'react'
import { AddNewModal, Sidebar, Topbar } from './components/AppShell'
import BoardPage from './pages/BoardPage'
import CalendarPage from './pages/CalendarPage'
import ClientsPage from './pages/ClientsPage'
import type { ClientDirectoryRow } from './pages/ClientsPage'
import ClientRecordPage from './pages/ClientRecordPage'
import DashboardPage from './pages/DashboardPage'
import LeadsPage from './pages/LeadsPage'
import LeadDetailPage from './pages/LeadDetailPage'
import type { LeadDirectoryRow } from './pages/LeadsPage'
import ProjectTaskDetailPage from './pages/ProjectTaskDetailPage'
import ProjectsPage, { type ProjectDirectoryRow } from './pages/ProjectsPage'
import ProjectTasksPage, { type ProjectTaskRecord } from './pages/ProjectTasksPage'

export default function App() {
  const [collapsed, setCollapsed] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [activePage, setActivePage] = useState('Dashboard')
  const [selectedProjectTask, setSelectedProjectTask] = useState<ProjectTaskRecord | null>(null)
  const [selectedLead, setSelectedLead] = useState<LeadDirectoryRow | null>(null)
  const [selectedClient, setSelectedClient] = useState<ClientDirectoryRow | null>(null)
  const [selectedProjectName, setSelectedProjectName] = useState<string | null>(null)
  const [additionalProjects, setAdditionalProjects] = useState<ProjectDirectoryRow[]>([])
  const [leadStatusOverrides, setLeadStatusOverrides] = useState<Record<string, string>>({})
  const [projectStatusOverrides, setProjectStatusOverrides] = useState<Record<string, string>>({})
  const onAdd = () => setShowModal(true)
  const onNavigate = (page: string) => { setActivePage(page); setSelectedProjectTask(null); setSelectedLead(null); setSelectedClient(null); setSelectedProjectName(null) }

  const page = (() => {
    switch (activePage) {
      case 'Dashboard': return <DashboardPage />
      case 'Tasks / Deals': return <BoardPage />
      case 'Project tasks': return selectedProjectTask
        ? <ProjectTaskDetailPage task={selectedProjectTask} onBack={() => setSelectedProjectTask(null)} />
        : <ProjectTasksPage onAdd={onAdd} onViewTask={setSelectedProjectTask} initialProjectName={selectedProjectName ?? undefined} />
      case 'Leads': return selectedLead
        ? <LeadDetailPage lead={selectedLead} additionalProjects={additionalProjects} projectStatusOverrides={projectStatusOverrides} onLeadStatusChange={status => {
          setLeadStatusOverrides(current => ({ ...current, [selectedLead.name]: status }))
          setSelectedLead(current => current ? { ...current, status } : current)
        }} onProjectStatusChange={(name, status) => setProjectStatusOverrides(current => ({ ...current, [name]: status }))} onViewTasks={name => { setSelectedProjectName(name); setSelectedProjectTask(null); setActivePage('Project tasks') }} onOpenProject={name => { setSelectedProjectName(name); setActivePage('Projects') }} onOpenTask={task => { setSelectedProjectTask(task); setActivePage('Project tasks') }} onBack={() => setSelectedLead(null)} onConvert={project => {
          setAdditionalProjects(current => [...current.filter(item => item.name !== project.name), project])
          setLeadStatusOverrides(current => ({ ...current, [selectedLead.name]: 'Won' }))
          setSelectedProjectName(project.name)
          setSelectedLead(null)
          setActivePage('Projects')
        }} />
        : <LeadsPage onAdd={onAdd} statusOverrides={leadStatusOverrides} onFullWorkflow={setSelectedLead} />
      case 'Clients': return selectedClient
        ? <ClientRecordPage client={selectedClient} additionalProjects={additionalProjects} statusOverrides={projectStatusOverrides} onBack={() => setSelectedClient(null)} />
        : <ClientsPage onAdd={onAdd} onOpenRecord={setSelectedClient} />
      case 'Projects': return <ProjectsPage onAdd={onAdd} initialProjectName={selectedProjectName ?? undefined} additionalProjects={additionalProjects} statusOverrides={projectStatusOverrides} />
      case 'Calendar': return <CalendarPage />
      default: return <div className="blank-page" />
    }
  })()

  return <div className="app-shell">
    <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} active={activePage} onNavigate={onNavigate} />
    <main className="main-area">
      <Topbar onAdd={onAdd} onToggle={() => setCollapsed(!collapsed)} collapsed={collapsed} />
      {page}
    </main>
    {showModal && <AddNewModal onClose={() => setShowModal(false)} />}
  </div>
}
