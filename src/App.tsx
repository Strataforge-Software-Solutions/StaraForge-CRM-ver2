import { useEffect, useRef, useState } from 'react'
import { AddNewModal, Sidebar, Topbar, type CreateRecordType, type GlobalSearchItem } from './components/AppShell'
import BoardPage from './pages/BoardPage'
import CalendarPage from './pages/CalendarPage'
import ClientsPage, { clientDirectory } from './pages/ClientsPage'
import type { ClientDirectoryRow } from './pages/ClientsPage'
import ClientRecordPage from './pages/ClientRecordPage'
import DashboardPage from './pages/DashboardPage'
import AccessPage from './pages/AccessPage'
import AuditHistoryPage from './pages/AuditHistoryPage'
import LeadsPage, { leadDirectory } from './pages/LeadsPage'
import LeadDetailPage from './pages/LeadDetailPage'
import type { LeadDirectoryRow } from './pages/LeadsPage'
import ProjectTaskDetailPage from './pages/ProjectTaskDetailPage'
import ProjectsPage, { projectDirectory, type ProjectDirectoryRow } from './pages/ProjectsPage'
import ProjectTasksPage, { projectTaskRows, type ProjectTaskRecord } from './pages/ProjectTasksPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'
import SecurityPage from './pages/SecurityPage'
import WorkspaceAuthGate from './components/WorkspaceAuthGate'
import { updateDatabaseCollection, useDatabaseCollection, useDatabaseStatus } from './lib/database'
import { showWorkspaceToast, workspaceToastEvent } from './lib/workspaceToast'
import { signOut } from './lib/supabase'

function formatElapsed(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':')
}

function TimeoutScreen({ now, sessionStartedAt, lockedAt, onResume, onSignOut }: { now: number; sessionStartedAt: number; lockedAt: number; onResume: () => void; onSignOut: () => void }) {
  const current = new Date(now)
  return <main className="timeout-screen"><section className="timeout-card" aria-label="Workspace paused">
    <span className="directory-eyebrow">WORKSPACE PAUSED</span><h1>Take a break.</h1>
    <p className="timeout-intro">Your workspace is hidden while you take a break. Resume when you’re ready.</p>
    <div className="timeout-clock"><strong>{current.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</strong><span>{current.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span></div>
    <div className="timeout-stats"><div><span>Break time</span><b>{formatElapsed(now - lockedAt)}</b></div><div><span>Session time</span><b>{formatElapsed(now - sessionStartedAt)}</b></div></div>
    <div className="timeout-auth-note"><span>Your workspace data stays protected while paused.</span><small>The workspace locks automatically after 15 minutes of inactivity.</small></div>
    <button type="button" className="timeout-resume-button" onClick={onResume}>Resume workspace</button>
    <button type="button" className="timeout-signout-button" onClick={onSignOut}>Sign out instead</button>
  </section></main>
}

export default function App() {
  return <WorkspaceAuthGate><WorkspaceApp/></WorkspaceAuthGate>
}

function WorkspaceApp() {
  const [collapsed, setCollapsed] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [createType, setCreateType] = useState<CreateRecordType | null>(null)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [isTimedOut, setIsTimedOut] = useState(false)
  const [workspaceToast, setWorkspaceToast] = useState('')
  const workspaceToastTimer = useRef<number | null>(null)
  const [timedOutAt, setTimedOutAt] = useState<number | null>(null)
  const [sessionStartedAt, setSessionStartedAt] = useState(() => Date.now())
  const [clockNow, setClockNow] = useState(() => Date.now())
  const [activePage, setActivePage] = useState('Dashboard')
  const [selectedProjectTask, setSelectedProjectTask] = useState<ProjectTaskRecord | null>(null)
  const [selectedLead, setSelectedLead] = useState<LeadDirectoryRow | null>(null)
  const [selectedClient, setSelectedClient] = useState<ClientDirectoryRow | null>(null)
  const [selectedProjectName, setSelectedProjectName] = useState<string | null>(null)
  const [openProjectFullRecord, setOpenProjectFullRecord] = useState(false)
  const [additionalProjects, setAdditionalProjects] = useDatabaseCollection<ProjectDirectoryRow[]>('projects', [])
  const [leadStatusOverrides, setLeadStatusOverrides] = useDatabaseCollection<Record<string, string>>('leadStatusOverrides', {})
  const [projectStatusOverrides, setProjectStatusOverrides] = useDatabaseCollection<Record<string, string>>('projectStatusOverrides', {})
  const [savedLeads] = useDatabaseCollection('leads', leadDirectory)
  const [savedClients] = useDatabaseCollection('clients', clientDirectory)
  const [savedTasks] = useDatabaseCollection('tasks', projectTaskRows)
  const database = useDatabaseStatus()
  useEffect(() => {
    const clockInterval = window.setInterval(() => setClockNow(Date.now()), 1000)
    return () => window.clearInterval(clockInterval)
  }, [])
  useEffect(() => {
    const handleWorkspaceToast = (event: Event) => {
      const message = (event as CustomEvent<string>).detail
      setWorkspaceToast(message)
      if (workspaceToastTimer.current !== null) window.clearTimeout(workspaceToastTimer.current)
      workspaceToastTimer.current = window.setTimeout(() => { setWorkspaceToast(''); workspaceToastTimer.current = null }, 3000)
    }
    window.addEventListener(workspaceToastEvent, handleWorkspaceToast)
    return () => {
      window.removeEventListener(workspaceToastEvent, handleWorkspaceToast)
      if (workspaceToastTimer.current !== null) window.clearTimeout(workspaceToastTimer.current)
    }
  }, [])
  useEffect(() => {
    if (isTimedOut) return
    let idleTimer = 0
    const lockForInactivity = () => { setTimedOutAt(Date.now()); setIsTimedOut(true) }
    const resetIdleTimer = () => {
      window.clearTimeout(idleTimer)
      idleTimer = window.setTimeout(lockForInactivity, 15 * 60 * 1000)
    }
    const activityEvents: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'mousemove', 'wheel', 'touchstart']
    activityEvents.forEach(eventName => window.addEventListener(eventName, resetIdleTimer, { passive: true }))
    resetIdleTimer()
    return () => {
      window.clearTimeout(idleTimer)
      activityEvents.forEach(eventName => window.removeEventListener(eventName, resetIdleTimer))
    }
  }, [isTimedOut])
  const onAdd = (type?: CreateRecordType) => { setCreateType(type ?? null); setShowModal(true) }
  const onCreateRecord = async (type: CreateRecordType, values: Record<string, string>) => {
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const initials = (value: string) => value.trim().split(/\s+/).map(part => part[0] ?? '').join('').slice(0, 2).toUpperCase() || 'NA'
    if (type === 'Lead') {
      const name = values.contact?.trim() || values.company?.trim() || 'New lead'
      const budget = values.budgetFrom ? `${values.currency || 'PHP'} ${Number(values.budgetFrom).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Not discussed'
      const row = { name, client: values.company?.trim() || name, initials: initials(name), email: values.email ?? '', phone: values.phone ?? '', source: values.source || 'Unspecified', type: values.projectType || 'Website', budget, status: 'New Leads', date, tone: 'orange', location: values.location ?? '', notes: values.notes ?? '', timeline: values.timeline ?? '', followUpDate: values.followUpDate ?? '' }
      await updateDatabaseCollection('leads', leadDirectory, rows => [...rows.filter(item => item.name !== row.name), row])
    } else if (type === 'Client') {
      const name = values.name?.trim() || 'New client'
      const row = { name, initials: initials(name), kind: values.type || 'Organization', contact: values.contact?.trim() || name, relation: 'Manually added', email: values.email ?? '', phone: values.phone ?? '', status: values.status || 'Active', projects: 0, value: '—', updated: date, tone: 'orange', website: values.website ?? '', location: '' }
      await updateDatabaseCollection('clients', clientDirectory, rows => [...rows.filter(item => item.name !== row.name), row])
    } else if (type === 'Project') {
      const name = values.name?.trim() || 'New project'
      const row = { name, client: values.client || '', initials: initials(values.client || name), type: 'Website', start: values.start || 'Not set', target: values.target || 'Not set', value: '—', status: 'Planned', tone: 'orange' }
      await updateDatabaseCollection<ProjectDirectoryRow[]>('projects', [], rows => [...rows.filter(item => item.name !== row.name), row])
    } else {
      if (!values.project) throw new Error('Choose a project before creating a task.')
      const row: ProjectTaskRecord = { title: values.title?.trim() || 'New task', project: values.project, assignee: 'Unassigned', due: date, priority: 'Low', status: 'To do' }
      await updateDatabaseCollection<ProjectTaskRecord[]>('tasks', projectTaskRows, rows => [...rows, row])
    }
    showWorkspaceToast(`${type} added.`)
  }
  const onNavigate = (page: string) => { setActivePage(page); setSelectedProjectTask(null); setSelectedLead(null); setSelectedClient(null); setSelectedProjectName(null); setOpenProjectFullRecord(false) }
  const searchItems: GlobalSearchItem[] = [
    ...savedLeads.map(row => ({ kind: 'Lead' as const, title: row.name, subtitle: `${leadStatusOverrides[row.name] ?? row.status} · ${row.email}`, page: 'Leads', key: row.name })),
    ...savedClients.map(row => ({ kind: 'Client' as const, title: row.name, subtitle: `${row.kind} · ${row.email}`, page: 'Clients', key: row.name })),
    ...[...projectDirectory.filter(project => !additionalProjects.some(extra => extra.name === project.name)), ...additionalProjects].map(row => ({ kind: 'Project' as const, title: row.name, subtitle: `${row.client} · ${row.status}`, page: 'Projects', key: row.name })),
    ...savedTasks.map(row => ({ kind: 'Task' as const, title: row.title, subtitle: `${row.project} · ${row.due}`, page: 'Project tasks', key: row.title })),
    ...[
      ['Dashboard', 'Workspace overview'], ['Tasks / Deals', 'Project board'], ['Project tasks', 'Task tracker'], ['Leads', 'Sales workspace'], ['Clients', 'Relationships'], ['Projects', 'Delivery workspace'], ['Calendar', 'Meetings, tasks, and milestones'], ['Reports', 'Workspace reports'], ['Access', 'Team access'], ['Audit history', 'Workspace activity log'], ['Settings', 'Account settings'], ['Security', 'Security settings'],
    ].map(([title, subtitle]) => ({ kind: 'Page' as const, title, subtitle, page: title, key: title })),
  ]
  const onSearchSelect = (item: GlobalSearchItem) => {
    setSelectedProjectTask(null); setSelectedLead(null); setSelectedClient(null); setSelectedProjectName(null); setOpenProjectFullRecord(false)
    if (item.kind === 'Lead') {
      const lead = savedLeads.find(row => row.name === item.key)
      if (lead) setSelectedLead({ ...lead, status: leadStatusOverrides[lead.name] ?? lead.status })
    } else if (item.kind === 'Client') {
      const client = savedClients.find(row => row.name === item.key)
      if (client) setSelectedClient(client)
    } else if (item.kind === 'Project') setSelectedProjectName(item.key)
    else if (item.kind === 'Task') setSelectedProjectTask(savedTasks.find(row => row.title === item.key) ?? null)
    setActivePage(item.page)
  }

  const page = (() => {
    switch (activePage) {
      case 'Dashboard': return <DashboardPage onOpenLead={lead => { setSelectedLead({ ...lead, status: leadStatusOverrides[lead.name] ?? lead.status }); setActivePage('Leads') }} />
      case 'Tasks / Deals': return <BoardPage />
      case 'Project tasks': return selectedProjectTask
        ? <ProjectTaskDetailPage task={selectedProjectTask} onBack={() => setSelectedProjectTask(null)} onOpenProject={name => { setSelectedProjectName(name); setOpenProjectFullRecord(true); setSelectedProjectTask(null); setActivePage('Projects') }} projectContext />
        : <ProjectTasksPage onOpenProject={name => { setSelectedProjectName(name); setOpenProjectFullRecord(true); setActivePage('Projects') }} initialProjectName={selectedProjectName ?? undefined} />
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
          showWorkspaceToast('Project created.')
        }} />
        : <LeadsPage onAdd={() => onAdd('Lead')} statusOverrides={leadStatusOverrides} onFullWorkflow={setSelectedLead} />
      case 'Clients': return selectedClient
        ? <ClientRecordPage client={selectedClient} additionalProjects={additionalProjects} statusOverrides={projectStatusOverrides} onBack={() => setSelectedClient(null)} onOpenProject={name => { setSelectedProjectName(name); setOpenProjectFullRecord(true); setSelectedClient(null); setActivePage('Projects') }} onOpenTask={task => { setSelectedProjectTask(task); setSelectedClient(null); setActivePage('Project tasks') }} />
        : <ClientsPage onAdd={() => onAdd('Client')} onOpenRecord={setSelectedClient} />
      case 'Projects': return <ProjectsPage key={openProjectFullRecord ? `full-${selectedProjectName}` : 'directory'} onAdd={() => onAdd('Project')} onOpenFullProject={name => { setSelectedProjectName(name); setOpenProjectFullRecord(true) }} onBackFromFullProject={() => { setOpenProjectFullRecord(false); setSelectedProjectName(null) }} onOpenTask={task => { setSelectedProjectTask(task); setSelectedProjectName(task.project); setActivePage('Project tasks') }} initialProjectName={openProjectFullRecord ? undefined : selectedProjectName ?? undefined} initialFullProjectName={openProjectFullRecord ? selectedProjectName ?? undefined : undefined} additionalProjects={additionalProjects} statusOverrides={projectStatusOverrides} />
      case 'Calendar': return <CalendarPage />
      case 'Reports': return <ReportsPage leadStatusOverrides={leadStatusOverrides} projectStatusOverrides={projectStatusOverrides} additionalProjects={additionalProjects} />
      case 'Access': return <AccessPage />
      case 'Audit history': return <AuditHistoryPage />
      case 'Settings': return <SettingsPage />
      case 'Security': return <SecurityPage onManageAccess={() => onNavigate('Access')} />
      default: return <div className="blank-page" />
    }
  })()

  return <div className="app-shell">
    <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} active={activePage} onNavigate={onNavigate} onLogout={() => setShowLogoutConfirm(true)} />
    <main className="main-area">
      <Topbar onAdd={onAdd} onToggle={() => setCollapsed(!collapsed)} collapsed={collapsed} searchItems={searchItems} onSearchSelect={onSearchSelect} onNavigate={onNavigate} onTimeout={() => { setTimedOutAt(Date.now()); setIsTimedOut(true) }} onLogout={() => setShowLogoutConfirm(true)} />
      {database.status === 'error' && <div className="database-error-banner" role="alert">Supabase connection issue. Changes may not be saved. {database.error}</div>}
      {page}
    </main>
    {showModal && <AddNewModal initialChoice={createType} clients={savedClients.map(client => client.name)} projects={additionalProjects.map(project => project.name)} onCreate={onCreateRecord} onClose={() => setShowModal(false)} />}
    {showLogoutConfirm && <div className="admin-modal-backdrop" onClick={() => setShowLogoutConfirm(false)}><section className="admin-invite-modal logout-confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="logout-title" onClick={event => event.stopPropagation()}><header><div><span className="directory-eyebrow">ACCOUNT</span><h2 id="logout-title">Log out?</h2><p>End your StrataForge workspace session on this device.</p></div></header><footer><button className="admin-cancel" onClick={() => setShowLogoutConfirm(false)}>Cancel</button><button className="admin-submit" onClick={() => { setShowLogoutConfirm(false); void signOut() }}>Log out</button></footer></section></div>}
    {isTimedOut && <TimeoutScreen now={clockNow} sessionStartedAt={sessionStartedAt} lockedAt={timedOutAt ?? clockNow} onResume={() => { setIsTimedOut(false); setTimedOutAt(null); showWorkspaceToast('You’re back at your desk.') }} onSignOut={() => { setIsTimedOut(false); void signOut() }} />}
    {workspaceToast && <div className="workspace-toast" role="status" aria-live="polite"><span aria-hidden="true">✓</span>{workspaceToast}</div>}
  </div>
}
