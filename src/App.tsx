import { useState } from 'react'
import { AddNewModal, Sidebar, Topbar } from './components/AppShell'
import BoardPage from './pages/BoardPage'
import CalendarPage from './pages/CalendarPage'
import ClientsPage from './pages/ClientsPage'
import DashboardPage from './pages/DashboardPage'
import LeadsPage from './pages/LeadsPage'
import LeadDetailPage from './pages/LeadDetailPage'
import type { LeadDirectoryRow } from './pages/LeadsPage'
import ProjectTaskDetailPage from './pages/ProjectTaskDetailPage'
import ProjectsPage from './pages/ProjectsPage'
import ProjectTasksPage, { type ProjectTaskRecord } from './pages/ProjectTasksPage'

export default function App() {
  const [collapsed, setCollapsed] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [activePage, setActivePage] = useState('Dashboard')
  const [selectedProjectTask, setSelectedProjectTask] = useState<ProjectTaskRecord | null>(null)
  const [selectedLead, setSelectedLead] = useState<LeadDirectoryRow | null>(null)
  const [selectedProjectName, setSelectedProjectName] = useState<string | null>(null)
  const onAdd = () => setShowModal(true)
  const onNavigate = (page: string) => { setActivePage(page); setSelectedProjectTask(null); setSelectedLead(null); setSelectedProjectName(null) }

  const page = (() => {
    switch (activePage) {
      case 'Dashboard': return <DashboardPage />
      case 'Tasks / Deals': return <BoardPage />
      case 'Project tasks': return selectedProjectTask
        ? <ProjectTaskDetailPage task={selectedProjectTask} onBack={() => setSelectedProjectTask(null)} />
        : <ProjectTasksPage onAdd={onAdd} onViewTask={setSelectedProjectTask} />
      case 'Leads': return selectedLead
        ? <LeadDetailPage lead={selectedLead} onBack={() => setSelectedLead(null)} />
        : <LeadsPage onAdd={onAdd} onFullWorkflow={setSelectedLead} onOpenProject={project => { setSelectedProjectName(project.name); setActivePage('Projects') }} />
      case 'Clients': return <ClientsPage onAdd={onAdd} />
      case 'Projects': return <ProjectsPage onAdd={onAdd} initialProjectName={selectedProjectName ?? undefined} />
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
