import { useEffect, useRef, useState } from 'react'
import { Activity, ArrowDown, ArrowRight, ArrowUpDown, ArrowUpRight, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Circle, ClipboardList, Ellipsis, FileText, Filter, FolderKanban, Layers3, LayoutDashboard, MessageSquare, Paperclip, Plus, Search, Send, Settings, SlidersHorizontal, Sparkles, Trash2, Upload, Users, X } from 'lucide-react'
import { CustomSelect } from '../components/CustomControls'
import { useDatabaseCollection } from '../lib/database'
import { showWorkspaceToast } from '../lib/workspaceToast'
import { leadDirectory, type LeadDirectoryRow } from './LeadsPage'

type Ticket = { id: string; project: string; title: string; priority: 'Low' | 'Medium' | 'High' | 'Urgent'; client: string; date: string; owner: string }
type TicketAttachment = { id: string; ticketId: string; boardKey?: string; name: string; type: string; size: number; dataUrl: string; addedAt: string }
type TicketComment = { id: string; ticketId: string; boardKey?: string; message: string; author: string; createdAt: string }
type TicketActivityEntry = { id: string; ticketId: string; boardKey?: string; fromStage: string; toStage: string; actor: string; createdAt: string }
type TicketColumn = { id: string; name: string; color: string; tickets: Ticket[] }
type BoardPreferences = { compactCards: boolean; showTicketIds: boolean; sortByTitle: boolean }
const defaultBoardPreferences: BoardPreferences = { compactCards: false, showTicketIds: true, sortByTitle: false }

const initialBoard: TicketColumn[] = [
  { id: 'new', name: 'New Leads', color: 'gray', tickets: [] },
  { id: 'contacted', name: 'Contacted', color: 'blue', tickets: [] },
  { id: 'progress', name: 'In Progress', color: 'orange', tickets: [] },
  { id: 'review', name: 'Review / Proposal', color: 'purple', tickets: [] },
  { id: 'won', name: 'Won', color: 'green', tickets: [] },
]

const leadBoardStages = [
  { id: 'new', name: 'New Leads', color: 'gray', status: 'New Leads' },
  { id: 'contacted', name: 'Contacted', color: 'blue', status: 'Contacted' },
  { id: 'discovery', name: 'Discovery', color: 'cyan', status: 'Discovery' },
  { id: 'proposal', name: 'Proposal sent', color: 'purple', status: 'Proposal sent' },
  { id: 'awaiting-deposit', name: 'Awaiting deposit', color: 'orange', status: 'Awaiting deposit' },
  { id: 'won', name: 'Won', color: 'green', status: 'Won' },
  { id: 'lost', name: 'Lost', color: 'gray', status: 'Lost' },
] as const

function TicketModal({ stage, columns, projectName, projectClient, projects, onClose, onCreate }: { stage: string; columns: TicketColumn[]; projectName?: string; projectClient?: string; projects: { name: string; client: string }[]; onClose: () => void; onCreate: (ticket: Ticket, stage: string) => void }) {
  const [title, setTitle] = useState('')
  const [project, setProject] = useState(projectName ?? '')
  const [priority, setPriority] = useState<Ticket['priority']>('Low')
  const [column, setColumn] = useState(stage)
  useEffect(() => { if (!project && projects.length) setProject(projects[0].name) }, [project, projects])
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!title.trim() || !project) return
    const client = projectClient ?? projects.find(item => item.name === project)?.client ?? ''
    onCreate({ id: `SF-${Math.floor(90 + Math.random() * 9)}`, project, title: title.trim(), priority, client, date: 'Due Nov 9', owner: 'B' }, column)
  }
  return <div className="modal-backdrop" onClick={onClose}><form className="modal ticket-modal" onSubmit={submit} onClick={event => event.stopPropagation()}>
    <div className="modal-head"><div><span className="eyebrow">PROJECT BOARD</span><h2>New ticket</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={17}/></button></div>
    <label className="field-label">Ticket title<input autoFocus required value={title} onChange={event => setTitle(event.target.value)} placeholder="What needs to be done?"/></label>
    <div className="field-pair"><label className="field-label">Project<CustomSelect ariaLabel="Project" value={project || 'No projects yet'} options={projects.length ? projects.map(item => item.name) : ['No projects yet']} onChange={setProject}/></label>
      <label className="field-label">Stage<CustomSelect value={column} options={columns.map(item => ({ label: item.name, value: item.id }))} onChange={setColumn}/></label></div>
    <label className="field-label">Priority<CustomSelect value={priority} options={['Low', 'Medium', 'High', 'Urgent']} onChange={value => setPriority(value as Ticket['priority'])}/></label>
    <button className="modal-submit" type="submit" disabled={!project || !projects.length}>Create ticket <Plus size={15}/></button>
  </form></div>
}

function BoardSettingsModal({ preferences, onClose, onSave }: { preferences: BoardPreferences; onClose: () => void; onSave: (next: BoardPreferences) => void }) {
  const [draft, setDraft] = useState(preferences)
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])
  return <div className="modal-backdrop board-settings-backdrop" onClick={onClose}><section className="modal board-settings-modal" role="dialog" aria-modal="true" aria-labelledby="board-settings-title" onClick={event => event.stopPropagation()}>
    <header className="modal-head"><div><span className="eyebrow">PROJECT BOARD</span><h2 id="board-settings-title">Board settings</h2><p>Choose how tickets appear and are ordered.</p></div><button type="button" className="icon-button" aria-label="Close settings" onClick={onClose}><X size={17}/></button></header>
    <div className="board-settings-options">
      <label className="board-setting-row"><span><b>Compact ticket cards</b><small>Fit more tickets into each column.</small></span><input type="checkbox" checked={draft.compactCards} onChange={event => setDraft(current => ({ ...current, compactCards: event.target.checked }))}/><i aria-hidden="true"/></label>
      <label className="board-setting-row"><span><b>Show ticket IDs</b><small>Display identifiers such as SF-38 on cards.</small></span><input type="checkbox" checked={draft.showTicketIds} onChange={event => setDraft(current => ({ ...current, showTicketIds: event.target.checked }))}/><i aria-hidden="true"/></label>
      <label className="board-setting-row"><span><b>Sort titles A–Z</b><small>Keep tickets alphabetized within each column.</small></span><input type="checkbox" checked={draft.sortByTitle} onChange={event => setDraft(current => ({ ...current, sortByTitle: event.target.checked }))}/><i aria-hidden="true"/></label>
    </div>
    <footer className="board-settings-footer"><button type="button" className="ticket-confirm-cancel" onClick={() => setDraft(defaultBoardPreferences)}>Restore defaults</button><div><button type="button" className="ticket-confirm-cancel" onClick={onClose}>Cancel</button><button type="button" className="modal-submit" onClick={() => onSave(draft)}>Save settings</button></div></footer>
  </section></div>
}

const projectBoardStageNames: Record<string, string> = {
  new: 'New Feature',
  contacted: 'Planned',
  progress: 'Building',
  review: 'Testing/QA',
  won: 'Deploy',
}

export default function BoardPage({ projectContext = false, projectName, projectClient }: { projectContext?: boolean; projectName?: string; projectClient?: string } = {}) {
  const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024
  const MAX_ATTACHMENT_STORAGE = 10 * 1024 * 1024
  const boardKey = projectContext ? 'projectBoard' : 'board'
  const [savedProjects] = useDatabaseCollection<{ name: string; client: string }[]>('projects', [])
  const [savedLeads] = useDatabaseCollection<LeadDirectoryRow[]>('leads', leadDirectory)
  const [leadStatusOverrides, setLeadStatusOverrides] = useDatabaseCollection<Record<string, string>>('leadStatusOverrides', {})
  const projectChoices = projectContext && projectName ? [{ name: projectName, client: projectClient ?? '' }] : savedProjects
  const [search, setSearch] = useState('')
  const [project, setProject] = useState('All projects')
  const [preferences, setPreferences] = useDatabaseCollection<BoardPreferences>(`${boardKey}Preferences`, defaultBoardPreferences)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [columns, setColumns] = useDatabaseCollection(boardKey, initialBoard.map(column => ({
    ...column,
    name: projectContext ? projectBoardStageNames[column.id] ?? column.name : column.name,
  })))
  const [ticketAttachments, setTicketAttachments] = useDatabaseCollection<TicketAttachment[]>('ticketAttachments', [])
  const [ticketComments, setTicketComments] = useDatabaseCollection<TicketComment[]>('ticketComments', [])
  const [ticketActivity, setTicketActivity] = useDatabaseCollection<TicketActivityEntry[]>('ticketActivity', [])
  const [modalStage, setModalStage] = useState<string | null>(null)
  const [activeTicket, setActiveTicket] = useState<{ ticket: Ticket; stage: string } | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [ticketTab, setTicketTab] = useState<'Overview' | 'Activity' | 'Comments' | 'Attachments'>('Overview')
  const [commentDraft, setCommentDraft] = useState('')
  const [imagePreview, setImagePreview] = useState<TicketAttachment | null>(null)
  const attachmentInput = useRef<HTMLInputElement>(null)
  const [draggingTicketId, setDraggingTicketId] = useState<string | null>(null)
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null)
  const [recentlyMovedTicketId, setRecentlyMovedTicketId] = useState<string | null>(null)
  const ticketElements = useRef(new Map<string, HTMLElement>())
  const [toast, setToast] = useState('')
  useEffect(() => {
    if (!projectContext) return
    setColumns(current => {
      const renamed = current.map(column => ({ ...column, name: projectBoardStageNames[column.id] ?? column.name }))
      return renamed.some((column, index) => column.name !== current[index]?.name) ? renamed : current
    })
  }, [columns, projectContext, setColumns])
  useEffect(() => {
    if (!imagePreview) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setImagePreview(null) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [imagePreview])
  const leadTickets = savedLeads.map(lead => {
    const status = leadStatusOverrides[lead.name] ?? lead.status
    const stage = leadBoardStages.find(item => item.status === status) ?? leadBoardStages[0]
    return {
      stageId: stage.id,
      lead,
      ticket: { id: `lead:${lead.name}`, project: lead.type || 'Lead', title: lead.name, priority: 'Low' as const, client: lead.client, date: lead.date, owner: lead.initials || lead.name.slice(0, 1) },
    }
  })
  const boardColumns: TicketColumn[] = projectContext ? columns : leadBoardStages.map(stage => ({
    id: stage.id,
    name: stage.name,
    color: stage.color,
    tickets: leadTickets.filter(item => item.stageId === stage.id).map(item => item.ticket),
  }))
  const leadByTicketId = new Map(leadTickets.map(item => [item.ticket.id, item.lead]))
  const normalizedProjectClient = projectClient?.trim().toLowerCase() || projectName?.trim().split(/\s+/)[0].toLowerCase()
  const belongsToProject = (ticket: Ticket) => !projectName || ticket.project.toLowerCase() === projectName.toLowerCase() || Boolean(normalizedProjectClient && ticket.client.toLowerCase() === normalizedProjectClient)
  const total = boardColumns.reduce((count, column) => count + column.tickets.filter(belongsToProject).length, 0)
  const addTicket = (ticket: Ticket, stage: string) => {
    setColumns(current => current.map(column => column.id === stage ? { ...column, tickets: [...column.tickets, ticket] } : column))
    setModalStage(null)
    showWorkspaceToast(projectContext ? 'Task added.' : 'Ticket added.')
  }
  const moveTicket = (ticketId: string, destination: string) => {
    const sourceColumn = boardColumns.find(column => column.tickets.some(ticket => ticket.id === ticketId))
    const destinationColumn = boardColumns.find(column => column.id === destination)
    if (!sourceColumn || !destinationColumn || sourceColumn.id === destinationColumn.id) {
      setDraggingTicketId(null)
      setDragOverColumnId(null)
      return
    }
    if (!projectContext) {
      const lead = leadByTicketId.get(ticketId)
      const nextStatus = leadBoardStages.find(stage => stage.id === destination)?.status
      if (lead && nextStatus) {
        setLeadStatusOverrides(current => ({ ...current, [lead.name]: nextStatus }))
        setDraggingTicketId(null)
        setDragOverColumnId(null)
        setRecentlyMovedTicketId(ticketId)
        window.setTimeout(() => setRecentlyMovedTicketId(current => current === ticketId ? null : current), 420)
        showWorkspaceToast('Lead moved.')
      }
      return
    }
    const positions = new Map<string, { left: number; top: number }>()
    ticketElements.current.forEach((element, id) => {
      const rect = element.getBoundingClientRect()
      positions.set(id, { left: rect.left, top: rect.top })
    })
    setColumns(current => {
      let moving: Ticket | undefined
      const withoutTicket = current.map(column => ({
        ...column,
        tickets: column.tickets.filter(ticket => {
          if (ticket.id !== ticketId) return true
          moving = ticket
          return false
        }),
      }))
      if (!moving) return current
      return withoutTicket.map(column => column.id === destination ? { ...column, tickets: [...column.tickets, moving!] } : column)
    })
    setTicketActivity(current => [...current, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ticketId, boardKey, fromStage: sourceColumn.name, toStage: destinationColumn.name, actor: 'Workspace member', createdAt: new Date().toISOString() }])
    setActiveTicket(current => current?.ticket.id === ticketId ? { ...current, stage: destination } : current)
    setDraggingTicketId(null)
    setDragOverColumnId(null)
    setRecentlyMovedTicketId(ticketId)
    window.setTimeout(() => setRecentlyMovedTicketId(current => current === ticketId ? null : current), 420)
    showWorkspaceToast(projectContext ? 'Task updated.' : 'Ticket moved.')
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.requestAnimationFrame(() => {
        const movingElements: HTMLElement[] = []
        ticketElements.current.forEach((element, id) => {
          const previous = positions.get(id)
          if (!previous || !element.isConnected) return
          const current = element.getBoundingClientRect()
          const dx = previous.left - current.left
          const dy = previous.top - current.top
          if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return
          element.style.transition = 'none'
          element.style.transform = `translate3d(${dx}px, ${dy}px, 0)`
          movingElements.push(element)
        })
        window.requestAnimationFrame(() => {
          movingElements.forEach(element => {
            element.style.transition = 'transform 380ms cubic-bezier(.2,.85,.25,1)'
            element.style.transform = ''
          })
          window.setTimeout(() => movingElements.forEach(element => { element.style.transition = '' }), 420)
        })
      })
    }
  }
  const updatePriority = (ticketId: string, priority: Ticket['priority']) => {
    setColumns(current => current.map(column => ({ ...column, tickets: column.tickets.map(ticket => ticket.id === ticketId ? { ...ticket, priority } : ticket) })))
    setActiveTicket(current => current?.ticket.id === ticketId ? { ...current, ticket: { ...current.ticket, priority } } : current)
    showWorkspaceToast(projectContext ? 'Task updated.' : 'Ticket updated.')
  }
  const addAttachments = async (files: FileList | null) => {
    if (!files || !activeTicket) return
    const selectedFiles = Array.from(files)
    const existingBytes = ticketAttachments.reduce((totalBytes, attachment) => totalBytes + attachment.size, 0)
    let queuedBytes = 0
    const accepted: TicketAttachment[] = []
    for (const file of selectedFiles) {
      if (file.size > MAX_ATTACHMENT_SIZE) {
        showToast(`${file.name} is larger than 5 MB.`)
        continue
      }
      if (existingBytes + queuedBytes + file.size > MAX_ATTACHMENT_STORAGE) {
        showToast('Attachments have reached the 10 MB workspace storage limit.')
        break
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read file.'))
        reader.onerror = () => reject(new Error('Could not read file.'))
        reader.readAsDataURL(file)
      }).catch(() => '')
      if (!dataUrl) {
        showToast(`Could not read ${file.name}.`)
        continue
      }
      queuedBytes += file.size
      accepted.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ticketId: activeTicket.ticket.id, boardKey, name: file.name, type: file.type || 'application/octet-stream', size: file.size, dataUrl, addedAt: new Date().toISOString() })
    }
    if (accepted.length) {
      setTicketAttachments(current => [...current, ...accepted])
      showWorkspaceToast(accepted.length === 1 ? 'Attachment added.' : `${accepted.length} attachments added.`)
    }
    if (attachmentInput.current) attachmentInput.current.value = ''
  }
  const deleteTicket = () => {
    if (!activeTicket) return
    setShowDeleteConfirm(true)
  }
  const confirmDeleteTicket = () => {
    if (!activeTicket) return
    const { ticket } = activeTicket
    setColumns(current => current.map(column => ({ ...column, tickets: column.tickets.filter(item => item.id !== ticket.id) })))
    setTicketAttachments(current => current.filter(attachment => attachment.ticketId !== ticket.id || (attachment.boardKey ?? 'board') !== boardKey))
    setTicketComments(current => current.filter(comment => comment.ticketId !== ticket.id || (comment.boardKey ?? 'board') !== boardKey))
    setShowDeleteConfirm(false)
    setActiveTicket(null)
    showWorkspaceToast(projectContext ? 'Task deleted.' : 'Ticket deleted.')
  }
  const addTicketComment = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeTicket || !commentDraft.trim()) return
    const comment: TicketComment = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ticketId: activeTicket.ticket.id, boardKey, message: commentDraft.trim(), author: 'Workspace member', createdAt: new Date().toISOString() }
    setTicketComments(current => [...current, comment])
    setCommentDraft('')
    showWorkspaceToast('Comment added.')
  }
  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }
  const currentTicketActivity = activeTicket
    ? ticketActivity.filter(item => item.ticketId === activeTicket.ticket.id && (item.boardKey ?? 'board') === boardKey).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : []
  return <div className="dashboard-content board-content">
    <div className="board-heading-row"><div><div className="breadcrumb"><span>WORKSPACE</span><b>/</b><span>{projectContext ? 'PROJECT TASKS' : 'TASKS & DEALS'}</span></div><h1>{projectContext ? 'Project board' : 'Lead pipeline'}</h1><p>{projectContext ? 'Plan work, track delivery, and keep every project moving.' : 'Move leads through your sales pipeline by dragging them between stages.'}</p></div>
      {projectContext && <div className="board-heading-actions"><button className="add-button new-ticket-button" onClick={() => setModalStage('new')}><Plus size={14}/>New ticket</button></div>}
    </div>
    <div className="board-toolbar"><div className="board-tab"><span className="board-tab-icon"><LayoutDashboard size={14}/></span><b>{projectContext ? 'Board' : 'Leads'}</b><i/><span>{total} {projectContext ? 'tickets' : total === 1 ? 'lead' : 'leads'}</span></div>
      <div className="board-tools"><label className="board-search"><Search size={14}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder={projectContext ? 'Search tickets' : 'Search leads'}/></label>
        {projectContext && (projectName ? <span className="project-filter project-filter-static" title={projectName}><Filter size={13}/><span>{projectName}</span></span> : <label className="project-filter"><Filter size={13}/><CustomSelect className="board-filter-select" showChevron={false} ariaLabel="Filter by project" value={project} options={['All projects', ...projectChoices.map(item => item.name)]} onChange={setProject}/><ChevronDown size={13}/></label>)}
        <button className={`board-tool-button ${preferences.sortByTitle ? 'tool-selected' : ''}`} aria-pressed={preferences.sortByTitle} onClick={() => setPreferences(current => ({ ...current, sortByTitle: !current.sortByTitle }))}><ArrowUpDown size={13}/>Sort</button>
        {projectContext && <button className="board-tool-button settings-tool" aria-haspopup="dialog" onClick={() => setSettingsOpen(true)}><SlidersHorizontal size={14}/>Settings</button>}
      </div>
    </div>
    <div className={`kanban-board ${projectContext ? '' : 'lead-kanban-board'}`}>{boardColumns.map(column => {
      const projectTickets = column.tickets.filter(belongsToProject)
      const filtered = projectTickets.filter(ticket => (!projectContext || projectName || project === 'All projects' || ticket.project === project) && `${ticket.id} ${ticket.project} ${ticket.title} ${ticket.client} ${leadByTicketId.get(ticket.id)?.email ?? ''}`.toLowerCase().includes(search.toLowerCase()))
      const visibleTickets = preferences.sortByTitle ? [...filtered].sort((a, b) => a.title.localeCompare(b.title)) : filtered
      return <section className={`kanban-column ${dragOverColumnId === column.id ? 'drag-over' : ''}`} key={column.id} onDragEnter={event => { event.preventDefault(); setDragOverColumnId(column.id) }} onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDragOverColumnId(column.id) }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOverColumnId(current => current === column.id ? null : current) }} onDrop={event => { event.preventDefault(); const ticketId = event.dataTransfer.getData('text/plain'); if (ticketId) moveTicket(ticketId, column.id); else setDragOverColumnId(null) }}>
        <div className="kanban-column-head"><span className={`column-dot ${column.color}`}/><strong>{column.name}</strong><b className="column-count">{projectTickets.length}</b>{projectContext && <button aria-label={`${column.name} options`} onClick={() => showToast(`${column.name} options are coming soon.`)}><Ellipsis size={16}/></button>}</div>
        <div className="ticket-stack">{visibleTickets.map(ticket => <article ref={element => { if (element) ticketElements.current.set(ticket.id, element); else ticketElements.current.delete(ticket.id) }} className={`ticket-card ${preferences.compactCards ? 'compact-card' : ''} ${draggingTicketId === ticket.id ? 'drag-source-hidden' : ''} ${recentlyMovedTicketId === ticket.id ? 'moved-card' : ''}`} key={ticket.id} draggable onDragStart={event => {
          setDraggingTicketId(ticket.id)
          setDragOverColumnId(null)
          event.dataTransfer.setData('text/plain', ticket.id)
          event.dataTransfer.effectAllowed = 'move'
          const dragPreview = event.currentTarget.cloneNode(true) as HTMLElement
          dragPreview.classList.add('ticket-drag-preview')
          document.body.appendChild(dragPreview)
          event.dataTransfer.setDragImage(dragPreview, 36, 26)
          window.setTimeout(() => dragPreview.remove(), 0)
        }} onDragEnd={() => { setDraggingTicketId(null); setDragOverColumnId(null) }} onClick={projectContext ? () => { setTicketTab('Overview'); setCommentDraft(''); setActiveTicket({ ticket, stage: column.id }) } : undefined} aria-label={!projectContext ? `Drag ${ticket.title} to change lead stage` : undefined}>
          {!projectContext && leadByTicketId.has(ticket.id) ? <><div className="ticket-reference">{leadByTicketId.get(ticket.id)?.type || 'Lead'}</div><h3>{ticket.title}</h3><div className="lead-card-contact">{ticket.client} · {leadByTicketId.get(ticket.id)?.email}</div><div className="ticket-footer"><span>{leadByTicketId.get(ticket.id)?.source}</span><b>{leadByTicketId.get(ticket.id)?.budget}</b></div></> : <><div className="ticket-reference">{preferences.showTicketIds && <><span>{ticket.id}</span><i>·</i></>}{ticket.project}</div><h3>{ticket.title}</h3>
          <div className="ticket-tags"><span className={`priority ${ticket.priority.toLowerCase()}`}>{ticket.priority}</span><span className="client-tag"><i/>{ticket.client}</span></div>
          <div className="ticket-footer"><span>{ticket.date}</span><b className={`assignee assignee-${ticket.owner.toLowerCase()}`}>{ticket.owner}</b></div></>}
        </article>)}</div>
        {projectContext && column.id !== 'won' && <button className="add-ticket-inline" onClick={() => setModalStage(column.id)}><Plus size={13}/>Add ticket</button>}
      </section>
    })}</div>
    {toast && <div className="board-toast"><span>{toast}</span><button aria-label="Dismiss" onClick={() => setToast('')}><X size={13}/></button></div>}
    {settingsOpen && <BoardSettingsModal preferences={preferences} onClose={() => setSettingsOpen(false)} onSave={next => { setPreferences(next); setSettingsOpen(false); showWorkspaceToast('Board settings saved.') }}/>}
    {projectContext && modalStage && <TicketModal stage={modalStage} columns={columns} projectName={projectName} projectClient={projectClient} projects={projectChoices} onClose={() => setModalStage(null)} onCreate={addTicket} />}
    {activeTicket && <div className="detail-backdrop" onClick={() => setActiveTicket(null)}><aside className="ticket-detail ticket-drawer-like" role="dialog" aria-modal="true" aria-label={`${activeTicket.ticket.title} ticket details`} onClick={event => event.stopPropagation()}>
      <header className="client-drawer-header ticket-drawer-header"><div className="client-drawer-title"><h2>{activeTicket.ticket.title}</h2><span>{activeTicket.ticket.id} · {activeTicket.ticket.project}</span></div><span className="ticket-drawer-stage">{columns.find(column => column.id === activeTicket.stage)?.name}</span><button className="client-drawer-close" onClick={() => setActiveTicket(null)} aria-label="Close ticket details"><X size={16}/></button></header>
      <nav className="client-drawer-tabs ticket-drawer-tabs" role="tablist" aria-label="Ticket details tabs">{(['Overview', 'Activity', 'Comments', 'Attachments'] as const).map(tab => <button key={tab} role="tab" aria-selected={ticketTab === tab} className={ticketTab === tab ? 'selected' : ''} onClick={() => setTicketTab(tab)}>{tab}{tab === 'Comments' && <span className="ticket-attachment-count">{ticketComments.filter(comment => comment.ticketId === activeTicket.ticket.id && (comment.boardKey ?? 'board') === boardKey).length}</span>}{tab === 'Attachments' && <span className="ticket-attachment-count">{ticketAttachments.filter(attachment => attachment.ticketId === activeTicket.ticket.id && (attachment.boardKey ?? 'board') === boardKey).length}</span>}</button>)}</nav>
      <div className="ticket-drawer-content">
        {ticketTab === 'Overview' && <>
          <section className="ticket-stage-summary"><span>Workflow stage</span><div><span className="ticket-drawer-stage large">{columns.find(column => column.id === activeTicket.stage)?.name}</span><span className={`priority ${activeTicket.ticket.priority.toLowerCase()}`}>{activeTicket.ticket.priority}</span></div></section>
          <div className="detail-form-grid ticket-drawer-fields"><label className="field-label">Priority<CustomSelect ariaLabel="Ticket priority" value={activeTicket.ticket.priority} options={['Low', 'Medium', 'High', 'Urgent']} onChange={value => updatePriority(activeTicket.ticket.id, value as Ticket['priority'])}/></label></div>
          <section className="ticket-drawer-section"><h3>Ticket information</h3><dl className="ticket-drawer-properties"><div><dt>Project</dt><dd>{activeTicket.ticket.project}</dd></div><div><dt>Client</dt><dd>{activeTicket.ticket.client}</dd></div><div><dt>Assignee</dt><dd><i className={`assignee assignee-${activeTicket.ticket.owner.toLowerCase()}`}>{activeTicket.ticket.owner}</i>{activeTicket.ticket.owner}</dd></div><div><dt>Schedule</dt><dd>{activeTicket.ticket.date}</dd></div></dl></section>
          <section className="ticket-drawer-section ticket-drawer-actions"><h3>Actions</h3><div className="ticket-action-controls"><label className="field-label">Move to...<CustomSelect ariaLabel="Move ticket to stage" value={activeTicket.stage} options={columns.map(column => ({ label: column.name, value: column.id }))} onChange={value => moveTicket(activeTicket.ticket.id, value)}/></label><button type="button" className="ticket-delete-button" onClick={deleteTicket}><Trash2 size={15}/>Delete task</button></div></section>
          <p className="ticket-drawer-note">Ticket changes are saved to your Supabase workspace.</p>
        </>}
        {ticketTab === 'Activity' && <section className="ticket-drawer-section ticket-activity-section"><h3>Recent activity</h3><div className="ticket-activity-current"><span className="ticket-activity-icon"><Activity size={16}/></span><div><small>Current stage</small><strong>{columns.find(column => column.id === activeTicket.stage)?.name}</strong></div><span className="ticket-activity-live"><i/>Current</span></div>{currentTicketActivity.length ? <div className="ticket-activity-list">{currentTicketActivity.map(item => <article className="ticket-activity-entry" key={item.id}><span className="ticket-activity-entry-icon"><ArrowRight size={14}/></span><div><strong>Stage changed</strong><p>{item.fromStage} <ArrowRight size={12}/> {item.toStage}</p><small>{item.actor} · {new Date(item.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</small></div></article>)}</div> : <div className="ticket-activity-empty"><span>No activity history yet</span><p>Stage changes will appear here when this task moves.</p></div>}</section>}
        {ticketTab === 'Comments' && <section className="ticket-drawer-section ticket-comments-section"><div className="ticket-attachments-heading"><div><h3>Comments</h3><p>Keep task discussion in one place.</p></div></div>
          <form className="ticket-comment-form" onSubmit={addTicketComment}><textarea value={commentDraft} onChange={event => setCommentDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (commentDraft.trim()) event.currentTarget.form?.requestSubmit() } }} placeholder="Write a comment..." aria-label="Write a comment" rows={3} maxLength={2000}/><div><span>{commentDraft.length}/2000 · Enter to post · Shift+Enter for a new line</span><button type="submit" disabled={!commentDraft.trim()}><Send size={14}/>Post comment</button></div></form>
          <div className="ticket-comment-list">{ticketComments.filter(comment => comment.ticketId === activeTicket.ticket.id && (comment.boardKey ?? 'board') === boardKey).slice().reverse().map(comment => <article className="ticket-comment" key={comment.id}><span className="ticket-comment-avatar">{comment.author.slice(0, 1)}</span><div><div className="ticket-comment-meta"><b>{comment.author}</b><time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString()}</time></div><p>{comment.message}</p></div></article>)}
            {!ticketComments.some(comment => comment.ticketId === activeTicket.ticket.id && (comment.boardKey ?? 'board') === boardKey) && <div className="ticket-drawer-empty ticket-comment-empty"><MessageSquare size={17}/><span>No comments yet. Start the discussion.</span></div>}
          </div>
        </section>}
        {ticketTab === 'Attachments' && <section className="ticket-drawer-section ticket-attachments-section"><div className="ticket-attachments-heading"><div><h3>Attachments</h3><p>Files attached to this task.</p></div><button type="button" className="ticket-upload-button" onClick={() => attachmentInput.current?.click()}><Upload size={14}/>Add files</button><input ref={attachmentInput} type="file" multiple className="ticket-attachment-input" onChange={event => void addAttachments(event.currentTarget.files)} aria-label="Choose ticket attachments"/></div>
          <div className="ticket-attachment-list">{ticketAttachments.filter(attachment => attachment.ticketId === activeTicket.ticket.id && (attachment.boardKey ?? 'board') === boardKey).map(attachment => <article className={`ticket-attachment-row ${attachment.type.startsWith('image/') ? 'has-image-preview' : ''}`} key={attachment.id}>{attachment.type.startsWith('image/') ? <button type="button" className="ticket-attachment-preview-link" onClick={() => setImagePreview(attachment)} aria-label={`View ${attachment.name} full screen`}><img className="ticket-attachment-preview" src={attachment.dataUrl} alt={attachment.name}/></button> : <span className="ticket-attachment-icon"><FileText size={17}/></span>}<div className="ticket-attachment-copy"><a href={attachment.dataUrl} download={attachment.name}>{attachment.name}</a><small>{attachment.size < 1024 * 1024 ? `${Math.max(1, Math.round(attachment.size / 1024))} KB` : `${(attachment.size / (1024 * 1024)).toFixed(1)} MB`} · Added {new Date(attachment.addedAt).toLocaleDateString()}</small></div><button type="button" className="ticket-attachment-remove" aria-label={`Remove ${attachment.name}`} title="Remove attachment" onClick={() => { setTicketAttachments(current => current.filter(item => item.id !== attachment.id)); showWorkspaceToast('Attachment removed.') }}><X size={15}/></button></article>)}
            {!ticketAttachments.some(attachment => attachment.ticketId === activeTicket.ticket.id && (attachment.boardKey ?? 'board') === boardKey) && <div className="ticket-drawer-empty ticket-attachments-empty"><Paperclip size={17}/><span>No files attached yet. Add a file to keep it with this task.</span></div>}
          </div><p className="ticket-attachment-hint">Up to 5 MB per file, with 10 MB total attachment storage for this workspace.</p>
        </section>}
      </div>
    </aside>{showDeleteConfirm && <div className="modal-backdrop ticket-confirm-backdrop" onClick={() => setShowDeleteConfirm(false)}><section className="modal ticket-delete-confirm" role="alertdialog" aria-modal="true" aria-labelledby="ticket-delete-title" aria-describedby="ticket-delete-description" onClick={event => event.stopPropagation()}><div className="ticket-delete-icon"><Trash2 size={19}/></div><h2 id="ticket-delete-title">Delete task?</h2><p id="ticket-delete-description">Delete “{activeTicket.ticket.title}” from this board? This can’t be undone.</p><div className="ticket-confirm-actions"><button type="button" className="ticket-confirm-cancel" onClick={() => setShowDeleteConfirm(false)}>Cancel</button><button type="button" className="ticket-confirm-delete" onClick={confirmDeleteTicket}><Trash2 size={14}/>Delete task</button></div></section></div>}{imagePreview && <div className="ticket-image-preview-backdrop" onClick={() => setImagePreview(null)}><section className="ticket-image-preview-dialog" role="dialog" aria-modal="true" aria-label={`Image preview: ${imagePreview.name}`} onClick={event => event.stopPropagation()}><header><div><b>{imagePreview.name}</b><span>Image preview</span></div><button type="button" className="ticket-preview-download" onClick={() => { const link = document.createElement('a'); link.href = imagePreview.dataUrl; link.download = imagePreview.name; link.click() }}>Download</button><button type="button" aria-label="Close image preview" onClick={() => setImagePreview(null)}><X size={18}/></button></header><div className="ticket-image-preview-stage"><img src={imagePreview.dataUrl} alt={imagePreview.name}/></div></section></div>}</div>}
  </div>
}


