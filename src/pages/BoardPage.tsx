import { useRef, useState } from 'react'
import { Activity, ArrowDown, ArrowRight, ArrowUpDown, ArrowUpRight, Bell, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Circle, ClipboardList, Ellipsis, Filter, FolderKanban, Layers3, LayoutDashboard, Plus, Search, Settings, SlidersHorizontal, Sparkles, Users, X } from 'lucide-react'

type Ticket = { id: string; project: string; title: string; priority: 'Low' | 'Medium' | 'High' | 'Urgent'; client: string; date: string; owner: string }
type TicketColumn = { id: string; name: string; color: string; tickets: Ticket[] }

const initialBoard: TicketColumn[] = [
  { id: 'new', name: 'New Leads', color: 'gray', tickets: [
    { id: 'SF-38', project: 'VioTrack Website', title: 'Explore approval cards for agent handoffs', priority: 'Low', client: 'VioTrack', date: 'Since Nov 2', owner: 'MC' },
    { id: 'SF-86', project: 'Company ABC Website', title: 'Add saved views for each project team', priority: 'Low', client: 'Company', date: 'Since Nov 3', owner: 'EK' },
    { id: 'SF-23', project: 'Jollibee POS System', title: 'Record client feedback after review', priority: 'Medium', client: 'Jollibee', date: 'Since Nov 4', owner: 'DK' },
  ] },
  { id: 'contacted', name: 'Contacted', color: 'blue', tickets: [
    { id: 'SF-34', project: 'Company ABC Website', title: 'Define semantic tokens for elevated surfaces', priority: 'High', client: 'Company', date: 'Due Nov 6', owner: 'MC' },
    { id: 'SF-82', project: 'VioTrack Website', title: 'Add keyboard navigation to project picker', priority: 'Low', client: 'VioTrack', date: 'Due Nov 7', owner: 'NW' },
    { id: 'SF-19', project: 'Jollibee POS System', title: 'Return rolling limits with reset timestamps', priority: 'Low', client: 'Jollibee', date: 'Due Nov 8', owner: 'DK' },
  ] },
  { id: 'progress', name: 'In Progress', color: 'orange', tickets: [
    { id: 'SF-79', project: 'VioTrack Website', title: 'Animate nested task groups as they stream', priority: 'Medium', client: 'VioTrack', date: 'Due Nov 5', owner: 'EK' },
    { id: 'SF-31', project: 'Company ABC Website', title: 'Tune chart contrast on dark dashboard cards', priority: 'Urgent', client: 'Company', date: 'Due Nov 5', owner: 'MC' },
  ] },
  { id: 'review', name: 'Review / Proposal', color: 'purple', tickets: [
    { id: 'SF-76', project: 'Jollibee POS System', title: 'Polish the transition between plan questions', priority: 'Low', client: 'Jollibee', date: 'Due Nov 6', owner: 'PS' },
  ] },
  { id: 'won', name: 'Won', color: 'green', tickets: [
    { id: 'SF-27', project: 'VioTrack Website', title: 'Ship overlapping avatar groups for cards', priority: 'Low', client: 'VioTrack', date: 'Completed Nov 1', owner: 'MC' },
    { id: 'SF-71', project: 'Company ABC Website', title: 'Keep generated screens aligned while zooming', priority: 'Medium', client: 'Company', date: 'Completed Oct 31', owner: 'NW' },
  ] },
]

function TicketModal({ stage, onClose, onCreate }: { stage: string; onClose: () => void; onCreate: (ticket: Ticket, stage: string) => void }) {
  const [title, setTitle] = useState('')
  const [project, setProject] = useState('VioTrack Website')
  const [priority, setPriority] = useState<Ticket['priority']>('Low')
  const [column, setColumn] = useState(stage)
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!title.trim()) return
    const client = project.startsWith('Company') ? 'Company' : project.startsWith('Jollibee') ? 'Jollibee' : 'VioTrack'
    onCreate({ id: `SF-${Math.floor(90 + Math.random() * 9)}`, project, title: title.trim(), priority, client, date: 'Due Nov 9', owner: 'B' }, column)
  }
  return <div className="modal-backdrop" onClick={onClose}><form className="modal ticket-modal" onSubmit={submit} onClick={event => event.stopPropagation()}>
    <div className="modal-head"><div><span className="eyebrow">PROJECT BOARD</span><h2>New ticket</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={17}/></button></div>
    <label className="field-label">Ticket title<input autoFocus required value={title} onChange={event => setTitle(event.target.value)} placeholder="What needs to be done?"/></label>
    <div className="field-pair"><label className="field-label">Project<select value={project} onChange={event => setProject(event.target.value)}><option>VioTrack Website</option><option>Company ABC Website</option><option>Jollibee POS System</option></select></label>
      <label className="field-label">Stage<select value={column} onChange={event => setColumn(event.target.value)}>{initialBoard.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
    <label className="field-label">Priority<select value={priority} onChange={event => setPriority(event.target.value as Ticket['priority'])}><option>Low</option><option>Medium</option><option>High</option><option>Urgent</option></select></label>
    <button className="modal-submit" type="submit">Create ticket <Plus size={15}/></button>
  </form></div>
}

export default function BoardPage() {
  const [search, setSearch] = useState('')
  const [project, setProject] = useState('All projects')
  const [sort, setSort] = useState(false)
  const [columns, setColumns] = useState(initialBoard)
  const [modalStage, setModalStage] = useState<string | null>(null)
  const [activeTicket, setActiveTicket] = useState<{ ticket: Ticket; stage: string } | null>(null)
  const [draggingTicketId, setDraggingTicketId] = useState<string | null>(null)
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null)
  const [recentlyMovedTicketId, setRecentlyMovedTicketId] = useState<string | null>(null)
  const ticketElements = useRef(new Map<string, HTMLElement>())
  const ghostElements = useRef(new Map<string, HTMLElement>())
  const [toast, setToast] = useState('')
  const total = columns.reduce((count, column) => count + column.tickets.length, 0)
  const draggedTicket = columns.flatMap(column => column.tickets).find(ticket => ticket.id === draggingTicketId)
  const addTicket = (ticket: Ticket, stage: string) => {
    setColumns(current => current.map(column => column.id === stage ? { ...column, tickets: [...column.tickets, ticket] } : column))
    setModalStage(null)
  }
  const moveTicket = (ticketId: string, destination: string) => {
    const positions = new Map<string, { left: number; top: number }>()
    ticketElements.current.forEach((element, id) => {
      const rect = element.getBoundingClientRect()
      positions.set(id, { left: rect.left, top: rect.top })
    })
    const dropGhost = ghostElements.current.get(destination)?.getBoundingClientRect()
    if (dropGhost) positions.set(ticketId, { left: dropGhost.left, top: dropGhost.top })
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
    setActiveTicket(current => current?.ticket.id === ticketId ? { ...current, stage: destination } : current)
    setDraggingTicketId(null)
    setDragOverColumnId(null)
    setRecentlyMovedTicketId(ticketId)
    window.setTimeout(() => setRecentlyMovedTicketId(current => current === ticketId ? null : current), 420)
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
  }
  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }
  return <div className="dashboard-content board-content">
    <div className="board-heading-row"><div><div className="breadcrumb"><span>WORKSPACE</span><b>/</b><span>TASKS &amp; DEALS</span></div><h1>Project board</h1><p>Plan work, track delivery, and keep every project moving.</p></div>
      <div className="board-heading-actions"><button className="board-notice" aria-label="Notifications"><Bell size={15}/><i/></button><button className="add-button new-ticket-button" onClick={() => setModalStage('new')}><Plus size={14}/>New ticket</button></div>
    </div>
    <div className="board-toolbar"><div className="board-tab"><span className="board-tab-icon"><LayoutDashboard size={14}/></span><b>Board</b><i/><span>{total} tickets</span></div>
      <div className="board-tools"><label className="board-search"><Search size={14}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search tickets"/></label>
        <label className="project-filter"><Filter size={13}/><select value={project} onChange={event => setProject(event.target.value)}><option>All projects</option><option>VioTrack Website</option><option>Company ABC Website</option><option>Jollibee POS System</option></select><ChevronDown size={13}/></label>
        <button className={`board-tool-button ${sort ? 'tool-selected' : ''}`} onClick={() => setSort(value => !value)}><ArrowUpDown size={13}/>Sort</button>
        <button className="board-tool-button settings-tool" onClick={() => showToast('Board settings are coming soon.')}><SlidersHorizontal size={14}/>Settings</button>
      </div>
    </div>
    <div className="kanban-board">{columns.map(column => {
      const filtered = column.tickets.filter(ticket => (project === 'All projects' || ticket.project === project) && `${ticket.id} ${ticket.project} ${ticket.title} ${ticket.client}`.toLowerCase().includes(search.toLowerCase()))
      const visibleTickets = sort ? [...filtered].sort((a, b) => a.title.localeCompare(b.title)) : filtered
      return <section className={`kanban-column ${dragOverColumnId === column.id ? 'drag-over' : ''}`} key={column.id} onDragEnter={event => { event.preventDefault(); setDragOverColumnId(column.id) }} onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDragOverColumnId(column.id) }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOverColumnId(current => current === column.id ? null : current) }} onDrop={event => { event.preventDefault(); const ticketId = event.dataTransfer.getData('text/plain'); if (ticketId) moveTicket(ticketId, column.id); else setDragOverColumnId(null) }}>
        <div className="kanban-column-head"><span className={`column-dot ${column.color}`}/><strong>{column.name}</strong><b className="column-count">{column.tickets.length}</b><button aria-label={`${column.name} options`} onClick={() => showToast(`${column.name} options are coming soon.`)}><Ellipsis size={16}/></button></div>
        <div className="ticket-stack">{visibleTickets.map(ticket => <article ref={element => { if (element) ticketElements.current.set(ticket.id, element); else ticketElements.current.delete(ticket.id) }} className={`ticket-card ${draggingTicketId === ticket.id ? 'ghost-card' : ''} ${recentlyMovedTicketId === ticket.id ? 'moved-card' : ''}`} key={ticket.id} draggable onDragStart={event => {
          setDraggingTicketId(ticket.id)
          setDragOverColumnId(null)
          event.dataTransfer.setData('text/plain', ticket.id)
          event.dataTransfer.effectAllowed = 'move'
          const dragPreview = event.currentTarget.cloneNode(true) as HTMLElement
          dragPreview.classList.add('ticket-drag-preview')
          document.body.appendChild(dragPreview)
          event.dataTransfer.setDragImage(dragPreview, 36, 26)
          window.setTimeout(() => dragPreview.remove(), 0)
        }} onDragEnd={() => { setDraggingTicketId(null); setDragOverColumnId(null) }} onClick={() => setActiveTicket({ ticket, stage: column.id })}>
          <div className="ticket-reference"><span>{ticket.id}</span><i>·</i>{ticket.project}</div><h3>{ticket.title}</h3>
          <div className="ticket-tags"><span className={`priority ${ticket.priority.toLowerCase()}`}>{ticket.priority}</span><span className="client-tag"><i/>{ticket.client}</span></div>
          <div className="ticket-footer"><span>{ticket.date}</span><b className={`assignee assignee-${ticket.owner.toLowerCase()}`}>{ticket.owner}</b></div>
        </article>)}{draggedTicket && dragOverColumnId === column.id && <article ref={element => { if (element) ghostElements.current.set(column.id, element); else ghostElements.current.delete(column.id) }} className="ticket-card destination-ghost" aria-hidden="true">
          <div className="ticket-reference"><span>{draggedTicket.id}</span><i>·</i>{draggedTicket.project}</div><h3>{draggedTicket.title}</h3>
          <div className="ticket-tags"><span className={`priority ${draggedTicket.priority.toLowerCase()}`}>{draggedTicket.priority}</span><span className="client-tag"><i/>{draggedTicket.client}</span></div>
          <div className="ticket-footer"><span>{draggedTicket.date}</span><b className={`assignee assignee-${draggedTicket.owner.toLowerCase()}`}>{draggedTicket.owner}</b></div>
        </article>}</div>
        {column.id !== 'won' && <button className="add-ticket-inline" onClick={() => setModalStage(column.id)}><Plus size={13}/>Add ticket</button>}
      </section>
    })}</div>
    {toast && <div className="board-toast"><span>{toast}</span><button aria-label="Dismiss" onClick={() => setToast('')}><X size={13}/></button></div>}
    {modalStage && <TicketModal stage={modalStage} onClose={() => setModalStage(null)} onCreate={addTicket} />}
    {activeTicket && <div className="detail-backdrop" onClick={() => setActiveTicket(null)}><aside className="ticket-detail" onClick={event => event.stopPropagation()}>
      <div className="detail-header"><span>TICKET DETAILS</span><button className="icon-button" onClick={() => setActiveTicket(null)} aria-label="Close ticket details"><X size={17}/></button></div>
      <div className="detail-reference"><b>{activeTicket.ticket.id}</b><span>·</span>{activeTicket.ticket.project}</div>
      <h2>{activeTicket.ticket.title}</h2>
      <p className="detail-description">Track this work item through the project workflow. Updates are saved in this session.</p>
      <div className="detail-form-grid">
        <label className="field-label">Status<select value={activeTicket.stage} onChange={event => moveTicket(activeTicket.ticket.id, event.target.value)}>{columns.map(column => <option key={column.id} value={column.id}>{column.name}</option>)}</select></label>
        <label className="field-label">Priority<select value={activeTicket.ticket.priority} onChange={event => updatePriority(activeTicket.ticket.id, event.target.value as Ticket['priority'])}><option>Low</option><option>Medium</option><option>High</option><option>Urgent</option></select></label>
      </div>
      <div className="detail-properties"><div><span>Project</span><b>{activeTicket.ticket.project}</b></div><div><span>Client</span><b>{activeTicket.ticket.client}</b></div><div><span>Assignee</span><b><i className={`assignee assignee-${activeTicket.ticket.owner.toLowerCase()}`}>{activeTicket.ticket.owner}</i>{activeTicket.ticket.owner}</b></div><div><span>Schedule</span><b>{activeTicket.ticket.date}</b></div></div>
      <div className="detail-activity"><strong>Activity</strong><p><i className="online-dot"/>Ticket is in <b>{columns.find(column => column.id === activeTicket.stage)?.name}</b></p><small>Changes are local and reset when the page reloads.</small></div>
    </aside></div>}
  </div>
}


