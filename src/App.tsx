import { useWorkspaceTasks } from './lib/tasks'
import FollowUpsPage from './pages/FollowUpsPage'
import CardHelp from './components/CardHelp'
import { recordId, overrideFor, related } from './lib/records'
import { retryDatabaseWrites, downloadUnsavedDrafts, reloadSavedData } from './lib/database'
import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { AddNewModal, MobileBottomNav, Sidebar, Topbar, type CreateRecordType, type GlobalSearchItem, type WorkspaceNotification } from './components/AppShell'
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
import { authChangeEvent, getCurrentSession, signOut, type WorkspaceSession } from './lib/workspaceAccount'
import { emptyProfilePhotos } from './lib/profilePhoto'
import { recordLeadActivity } from './lib/leadActivity'

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

function buildWorkspaceNotifications(leads: LeadDirectoryRow[], tasks: ProjectTaskRecord[]): WorkspaceNotification[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dayMs = 24 * 60 * 60 * 1000
  const taskItems = tasks.flatMap(task => {
    if (task.status === 'Completed') return []
    const due = new Date(task.due)
    if (Number.isNaN(due.getTime())) return []
    due.setHours(0, 0, 0, 0)
    const daysUntilDue = Math.floor((due.getTime() - today.getTime()) / dayMs)
    if (daysUntilDue > 7) return []
    const date = task.due
    return [{
      id: `task:${task.title}:${task.project}:${task.due}`,
      title: daysUntilDue < 0 ? 'Task overdue' : daysUntilDue === 0 ? 'Task due today' : 'Task due soon',
      detail: `${task.title} · ${task.project}`,
      page: 'Project tasks',
      date,
      sortTime: due.getTime(),
    }]
  }).sort((a, b) => a.sortTime - b.sortTime).slice(0, 5)
  const leadItems = leads.slice(-5).reverse().map(lead => ({
    id: `lead:${lead.name}:${lead.date}`,
    title: 'New lead added',
    detail: `${lead.name} · ${lead.source || 'Unspecified source'}`,
    page: 'Leads',
    date: lead.date,
  }))
  const followUps = leads.filter(lead => lead.followUpDate && new Date(`${lead.followUpDate}T00:00:00`) <= today && !['Won', 'Lost'].includes(lead.status)).map(lead => ({ id: `followup:${recordId(lead)}:${lead.followUpDate}`, title: 'Lead follow-up due', detail: `${lead.name} · ${lead.nextAction || 'Contact this lead'}`, page: 'Follow-ups', date: lead.followUpDate! }))
  return [...followUps, ...taskItems, ...leadItems].slice(0, 12)
}

export default function App() {
  return <WorkspaceAuthGate><WorkspaceApp/></WorkspaceAuthGate>
}

function WorkspaceApp() {
  const [collapsed, setCollapsed] = useState(() => window.matchMedia('(max-width: 1050px)').matches)
  const compactViewport = useRef(window.matchMedia('(max-width: 1050px)').matches)
  const mobileViewport = useRef(window.matchMedia('(max-width: 700px)').matches)
  const [showModal, setShowModal] = useState(false)
  const [createType, setCreateType] = useState<CreateRecordType | null>(null)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [isTimedOut, setIsTimedOut] = useState(false)
  const [workspaceToast, setWorkspaceToast] = useState('')
  const [workspaceToastClosing, setWorkspaceToastClosing] = useState(false)
  const [session, setSession] = useState<WorkspaceSession | null>(null)
  const [profilePhotos] = useDatabaseCollection<Record<string, string>>('profilePhotos', emptyProfilePhotos)
  const [accountSettings, setAccountSettings] = useDatabaseCollection<Record<string, { name?: string; readNotificationIds?: string[]; taskReminders?: boolean; emailUpdates?: boolean }>>('accountSettings', {})
  const workspaceToastTimer = useRef<number | null>(null)
  const dismissWorkspaceToast = () => {
    if (workspaceToastTimer.current !== null) window.clearTimeout(workspaceToastTimer.current)
    setWorkspaceToastClosing(true)
    workspaceToastTimer.current = window.setTimeout(() => {
      setWorkspaceToast('')
      setWorkspaceToastClosing(false)
      workspaceToastTimer.current = null
    }, 240)
  }
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
  const [savedLeads, setSavedLeads] = useDatabaseCollection('leads', leadDirectory)
  const [savedClients] = useDatabaseCollection('clients', clientDirectory)
  const [savedTasks] = useWorkspaceTasks()
  const notificationItems = buildWorkspaceNotifications(savedLeads, savedTasks).filter(item => item.id.startsWith('task:') ? accountSettings[session?.user.id ?? '']?.taskReminders !== false : accountSettings[session?.user.id ?? '']?.emailUpdates !== false)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1050px)')
    const mobileMedia = window.matchMedia('(max-width: 700px)')
    const syncViewport = () => {
      if (media.matches !== compactViewport.current) {
        compactViewport.current = media.matches
        setCollapsed(media.matches)
      }
      mobileViewport.current = mobileMedia.matches
    }
    media.addEventListener('change', syncViewport)
    mobileMedia.addEventListener('change', syncViewport)
    return () => {
      media.removeEventListener('change', syncViewport)
      mobileMedia.removeEventListener('change', syncViewport)
    }
  }, [])
  const currentUserId = session?.user.id ?? ''
  const readNotificationIds = accountSettings[currentUserId]?.readNotificationIds ?? []
  const markNotificationsRead = (ids: string[]) => {
    if (!currentUserId || !ids.length) return
    setAccountSettings(current => ({ ...current, [currentUserId]: { ...current[currentUserId], readNotificationIds: [...new Set([...(current[currentUserId]?.readNotificationIds ?? []), ...ids])] } }))
  }
  const database = useDatabaseStatus()
  useEffect(() => {
    const clockInterval = window.setInterval(() => setClockNow(Date.now()), 1000)
    return () => window.clearInterval(clockInterval)
  }, [])
  useEffect(() => {
    let active = true
    const loadAccount = async () => {
      const currentSession = await getCurrentSession()
      if (!active) return
      setSession(currentSession)
    }
    const onAuthChange = () => { void loadAccount() }
    void loadAccount()
    window.addEventListener(authChangeEvent, onAuthChange)
    return () => {
      active = false
      window.removeEventListener(authChangeEvent, onAuthChange)
    }
  }, [])
  useEffect(() => {
    const handleWorkspaceToast = (event: Event) => {
      const message = (event as CustomEvent<string>).detail
      setWorkspaceToastClosing(false)
      setWorkspaceToast(message)
      if (workspaceToastTimer.current !== null) window.clearTimeout(workspaceToastTimer.current)
      workspaceToastTimer.current = window.setTimeout(() => {
        setWorkspaceToastClosing(true)
        workspaceToastTimer.current = window.setTimeout(() => {
          setWorkspaceToast('')
          setWorkspaceToastClosing(false)
          workspaceToastTimer.current = null
        }, 240)
      }, 3000)
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
      const budgetFrom = values.budgetFrom?.replace(/,/g, '') ?? ''
      const budget = budgetFrom ? `${values.currency || 'PHP'} ${Number(budgetFrom).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Not discussed'
      const row = { id: crypto.randomUUID(), name, clientId: savedClients.find(client => client.name === values.company?.trim())?.id, workflowKey: crypto.randomUUID(), client: values.company?.trim() || name, initials: initials(name), ...(values.avatarUrl ? { avatarUrl: values.avatarUrl } : {}), email: values.email ?? '', phone: values.phone ?? '', source: values.source || 'Unspecified', type: values.projectType || 'Website', budget, status: 'New Leads', date, tone: 'orange', location: values.location ?? '', notes: values.notes ?? '', timeline: values.timeline ?? '', followUpDate: values.followUpDate ?? '' }
      await updateDatabaseCollection('leads', leadDirectory, rows => { if (rows.some(item => item.name.toLowerCase() === row.name.toLowerCase())) throw new Error('A record with this name already exists. Open it or use a distinct opportunity name.'); return [...rows, row] })
      await recordLeadActivity(row.name, 'Lead created', `${row.name} was added to the lead pipeline.`)
    } else if (type === 'Client') {
      const name = values.name?.trim() || 'New client'
      const row = { id: crypto.randomUUID(), name, initials: initials(name), ...(values.avatarUrl ? { avatarUrl: values.avatarUrl } : {}), kind: values.type || 'Organization', contact: values.contact?.trim() || name, relation: 'Manually added', email: values.email ?? '', phone: values.phone ?? '', status: values.status || 'Active', projects: 0, value: '—', updated: date, tone: 'orange', website: values.website ?? '', location: '' }
      await updateDatabaseCollection('clients', clientDirectory, rows => { if (rows.some(item => item.name.toLowerCase() === row.name.toLowerCase())) throw new Error('A record with this name already exists. Open it or use a distinct opportunity name.'); return [...rows, row] })
    } else if (type === 'Project') {
      const name = values.name?.trim() || 'New project'
      const row = { id: crypto.randomUUID(), name, clientId: savedClients.find(client => client.name === values.client)?.id, client: values.client || '', initials: initials(values.client || name), type: values.type || 'Website', start: values.start || 'Not set', target: values.target || 'Not set', value: '—', status: 'Planned', tone: 'orange', scope: values.scope || '' }
      await updateDatabaseCollection<ProjectDirectoryRow[]>('projects', [], rows => { if (rows.some(item => item.name.toLowerCase() === row.name.toLowerCase())) throw new Error('A record with this name already exists. Open it or use a distinct opportunity name.'); return [...rows, row] })
    } else {
      if (!values.project) throw new Error('Choose a project before creating a task.')
      const row: ProjectTaskRecord = { id: crypto.randomUUID(), projectId: additionalProjects.find(project => project.name === values.project)?.id, title: values.title?.trim() || 'New task', project: values.project, assignee: 'Unassigned', due: date, priority: 'Low', status: 'To do' }
      await updateDatabaseCollection<ProjectTaskRecord[]>('tasks', projectTaskRows, rows => [...rows, row])
    }
    showWorkspaceToast(`${type} added.`)
  }
  const onNavigate = (page: string) => { setActivePage(page); setSelectedProjectTask(null); setSelectedLead(null); setSelectedClient(null); setSelectedProjectName(null); setOpenProjectFullRecord(false); if (mobileViewport.current) setCollapsed(true) }
  const currentDisplayName = accountSettings[session?.user.id ?? '']?.name?.trim() || String((session?.user.user_metadata as { full_name?: unknown; name?: unknown } | undefined)?.full_name ?? (session?.user.user_metadata as { name?: unknown } | undefined)?.name ?? session?.user.email?.split('@')[0] ?? 'Workspace member')
  const searchItems: GlobalSearchItem[] = [
    ...savedLeads.map(row => ({ kind: 'Lead' as const, title: row.name, subtitle: `${row.status} · ${row.email}`, page: 'Leads', key: row.name })),
    ...savedClients.map(row => ({ kind: 'Client' as const, title: row.name, subtitle: `${row.kind} · ${row.email}`, page: 'Clients', key: row.name })),
    ...[...projectDirectory.filter(project => !additionalProjects.some(extra => extra.name === project.name)), ...additionalProjects].map(row => ({ kind: 'Project' as const, title: row.name, subtitle: `${row.client} · ${row.status}`, page: 'Projects', key: row.name })),
    ...savedTasks.map(row => ({ kind: 'Task' as const, title: row.title, subtitle: `${row.project} · ${row.due}`, page: 'Project tasks', key: row.title })),
    ...[
      ['Dashboard', 'Workspace overview'], ['Tasks / Deals', 'Lead Pipeline'], ['Project tasks', 'Task tracker'], ['Leads', 'Sales workspace'], ['Clients', 'Relationships'], ['Projects', 'Delivery workspace'], ['Calendar', 'Meetings, tasks, and milestones'], ['Follow-ups', 'Daily sales actions'], ['Reports', 'Workspace reports'], ['Access', 'Team access'], ['Audit history', 'Workspace activity log'], ['Settings', 'Account settings'], ['Security', 'Security settings'],
    ].map(([title, subtitle]) => ({ kind: 'Page' as const, title, subtitle, page: title, key: title })),
  ]
  const onSearchSelect = (item: GlobalSearchItem) => {
    setSelectedProjectTask(null); setSelectedLead(null); setSelectedClient(null); setSelectedProjectName(null); setOpenProjectFullRecord(false)
    if (item.kind === 'Lead') {
      const lead = savedLeads.find(row => row.name === item.key)
      if (lead) setSelectedLead({ ...lead, status: lead.status })
    } else if (item.kind === 'Client') {
      const client = savedClients.find(row => row.name === item.key)
      if (client) setSelectedClient(client)
    } else if (item.kind === 'Project') setSelectedProjectName(item.key)
    else if (item.kind === 'Task') setSelectedProjectTask(savedTasks.find(row => row.title === item.key) ?? null)
    setActivePage(item.page)
  }

  const page = (() => {
    switch (activePage) {
      case 'Dashboard': return <DashboardPage onNavigate={onNavigate} onOpenLead={lead => { setSelectedLead({ ...lead, status: lead.status }); setActivePage('Leads') }} onViewTasks={() => onNavigate('Project tasks')} />
      case 'Tasks / Deals': return <BoardPage onOpenLead={lead => { setSelectedLead({ ...lead, status: lead.status }); setActivePage('Leads') }} />
      case 'Project tasks': return selectedProjectTask
        ? <ProjectTaskDetailPage task={selectedProjectTask} onBack={() => setSelectedProjectTask(null)} onOpenProject={name => { setSelectedProjectName(name); setOpenProjectFullRecord(true); setSelectedProjectTask(null); setActivePage('Projects') }} projectContext />
        : <ProjectTasksPage onOpenProject={name => { setSelectedProjectName(name); setOpenProjectFullRecord(true); setActivePage('Projects') }} initialProjectName={selectedProjectName ?? undefined} />
      case 'Leads': return selectedLead
        ? <LeadDetailPage lead={selectedLead} additionalProjects={additionalProjects} projectStatusOverrides={projectStatusOverrides} onLeadStatusChange={status => {
          setSavedLeads(current => current.map(item => recordId(item) === recordId(selectedLead) ? { ...item, status } : item))
          setSelectedLead(current => current ? { ...current, status } : current)
          void recordLeadActivity(selectedLead.name, 'Stage changed', `Opportunity stage changed to ${status}.`)
        }} onProjectStatusChange={(name, status) => setProjectStatusOverrides(current => ({ ...current, [name]: status }))} onViewTasks={name => { setSelectedProjectName(name); setSelectedProjectTask(null); setActivePage('Project tasks') }} onOpenProject={name => { setSelectedProjectName(name); setActivePage('Projects') }} onOpenTask={task => { setSelectedProjectTask(task); setActivePage('Project tasks') }} onBack={() => setSelectedLead(null)} onConvert={project => {
          setAdditionalProjects(current => [...current.filter(item => recordId(item) !== recordId(project)), project])
          setSavedLeads(current => current.map(item => recordId(item) === recordId(selectedLead) ? { ...item, status: 'Won' } : item))
          void recordLeadActivity(selectedLead.name, 'Lead converted', `Converted to project “${project.name}”.`)
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
      case 'Calendar': return <CalendarPage onNavigate={onNavigate}/>
      case 'Follow-ups': return <FollowUpsPage onOpenLead={lead => { setSelectedLead(lead); setActivePage('Leads') }}/>
      case 'Reports': return <ReportsPage leadStatusOverrides={leadStatusOverrides} projectStatusOverrides={projectStatusOverrides} additionalProjects={additionalProjects} />
      case 'Access': return <AccessPage displayName={currentDisplayName} />
      case 'Audit history': return <AuditHistoryPage />
      case 'Settings': return <SettingsPage />
      case 'Security': return <SecurityPage onManageAccess={() => onNavigate('Access')} onSignOut={() => setShowLogoutConfirm(true)} />
      default: return <div className="blank-page" />
    }
  })()

  return <div className="app-shell">
    <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} active={activePage} onNavigate={onNavigate} onLogout={() => setShowLogoutConfirm(true)} />
    <button type="button" className={`mobile-nav-backdrop${collapsed ? ' is-hidden' : ''}`} aria-label="Close navigation" aria-hidden={collapsed} tabIndex={collapsed ? -1 : 0} onClick={() => setCollapsed(true)} />
    <main className="main-area"><CardHelp/>
      <Topbar onAdd={onAdd} onToggle={() => setCollapsed(!collapsed)} collapsed={collapsed} searchItems={searchItems} onSearchSelect={onSearchSelect} onNavigate={onNavigate} onTimeout={() => { setTimedOutAt(Date.now()); setIsTimedOut(true) }} onLogout={() => setShowLogoutConfirm(true)} accountName={currentDisplayName} accountEmail={session?.user.email ?? ''} profilePhotoUrl={profilePhotos[session?.user.id ?? ''] ?? null} notifications={notificationItems} readNotificationIds={readNotificationIds} onMarkNotificationsRead={markNotificationsRead} showAdd={activePage !== 'Tasks / Deals'} />
      {database.status === 'saving' && <div className="database-error-banner" role="status">Saving changes…</div>}
      {database.status === 'error' && <div className="database-error-banner" role="alert">Changes need attention. {database.error}<button onClick={() => void retryDatabaseWrites().catch(() => undefined)}>Retry save</button><button onClick={downloadUnsavedDrafts}>Download unsaved draft</button><button onClick={() => { if (window.confirm('Discard unsaved changes and reload the saved version? Download your draft first if you need to keep it.')) void reloadSavedData().catch(() => undefined) }}>Reload saved version</button></div>}
      {page}
    </main>
    <MobileBottomNav active={activePage} onNavigate={onNavigate} onAdd={onAdd} />
    {showModal && <AddNewModal initialChoice={createType} clients={savedClients.map(client => client.name)} projects={additionalProjects.map(project => project.name)} onCreate={onCreateRecord} onClose={() => setShowModal(false)} />}
    {showLogoutConfirm && <div className="admin-modal-backdrop" onClick={() => setShowLogoutConfirm(false)}><section className="admin-invite-modal logout-confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="logout-title" onClick={event => event.stopPropagation()}><header><div><span className="directory-eyebrow">ACCOUNT</span><h2 id="logout-title">Log out?</h2><p>End your StrataForge workspace session on this device.</p></div></header><footer><button className="admin-cancel" onClick={() => setShowLogoutConfirm(false)}>Cancel</button><button className="admin-submit" onClick={() => { setShowLogoutConfirm(false); void signOut() }}>Log out</button></footer></section></div>}
    {isTimedOut && <TimeoutScreen now={clockNow} sessionStartedAt={sessionStartedAt} lockedAt={timedOutAt ?? clockNow} onResume={() => { setIsTimedOut(false); setTimedOutAt(null); showWorkspaceToast('You’re back at your desk.') }} onSignOut={() => { setIsTimedOut(false); void signOut() }} />}
    {workspaceToast && <div className={`workspace-toast${workspaceToastClosing ? ' is-dismissing' : ''}`} role="status" aria-live="polite"><span aria-hidden="true">✓</span><span className="workspace-toast-message">{workspaceToast}</span><button type="button" className="workspace-toast-dismiss" aria-label="Dismiss notification" disabled={workspaceToastClosing} onClick={dismissWorkspaceToast}><X size={14}/></button></div>}
  </div>
}
