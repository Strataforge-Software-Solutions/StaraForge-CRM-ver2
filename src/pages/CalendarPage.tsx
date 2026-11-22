import { useWorkspaceTasks } from '../lib/tasks'
import { usePaymentLedger } from '../lib/payments'
import { leadDirectory } from './LeadsPage'
import { todayKey, dateKey } from '../lib/dates'
import { useRef, useState } from 'react'
import { Activity, ArrowRight, CalendarDays, CalendarPlus, ChevronDown, ChevronLeft, ChevronRight, Clock, Plus, Trash2, X } from 'lucide-react'
import { CustomDatePicker } from '../components/CustomControls'
import { useDatabaseCollection } from '../lib/database'
import { showWorkspaceToast } from '../lib/workspaceToast'

type CalendarEvent = { id: number | string; source?: string; date: string; time: string; title: string; detail: string; kind: 'Meeting' | 'Task' | 'Project' | 'Lead' }
const initialCalendarEvents: CalendarEvent[] = []

const calendarDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const startOfCalendarWeek = (date: Date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  return start
}

const calendarKinds: CalendarEvent['kind'][] = ['Meeting', 'Task', 'Project', 'Lead']

function CalendarKindSelect({ value, onChange }: { value: CalendarEvent['kind']; onChange: (kind: CalendarEvent['kind']) => void }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  return <div className="calendar-kind-select" ref={containerRef} onKeyDown={event => { if (event.key === 'Escape') setOpen(false) }} onBlur={event => { if (!containerRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false) }}>
    <button type="button" className="calendar-type-trigger" aria-label="Event type" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(current => !current)}>
      <span className={`calendar-type-dot ${value.toLowerCase()}`}/>{value}<ChevronDown size={14}/>
    </button>
    {open && <div className="calendar-type-options" role="listbox" aria-label="Event type">
      {calendarKinds.map(kind => <button type="button" role="option" aria-selected={value === kind} className={value === kind ? 'selected' : ''} key={kind} onClick={() => { onChange(kind); setOpen(false) }}><span className={`calendar-type-dot ${kind.toLowerCase()}`}/>{kind}</button>)}
    </div>}
  </div>
}

export default function CalendarPage({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [savedEvents, setEvents] = useDatabaseCollection('calendar', initialCalendarEvents)
  const [tasks] = useWorkspaceTasks()
  const [leads] = useDatabaseCollection('leads', leadDirectory)
  const { schedules } = usePaymentLedger()
  const [editingId, setEditingId] = useState<string | number | null>(null)
  const events: CalendarEvent[] = [...savedEvents,
    ...tasks.filter(task => task.status !== 'Completed' && dateKey(task.due)).map(task => ({ id: `task:${task.id || task.title}`, date: dateKey(task.due), time: 'All day', title: task.title, detail: task.project, kind: 'Task' as const, source: 'Project tasks' })),
    ...leads.filter(lead => lead.followUpDate && !['Won', 'Lost'].includes(lead.status)).map(lead => ({ id: `lead:${lead.id}`, date: lead.followUpDate!, time: 'All day', title: lead.nextAction || `Follow up with ${lead.name}`, detail: lead.name, kind: 'Lead' as const, source: 'Follow-ups' })),
    ...schedules.map(schedule => ({ id: `payment:${schedule.id}`, date: schedule.due, time: 'All day', title: schedule.name, detail: `${schedule.currency} ${schedule.amount}`, kind: 'Project' as const, source: 'Projects' }))]

  const [month, setMonth] = useState(new Date(`${todayKey()}T12:00:00`))
  const [selectedDate, setSelectedDate] = useState(new Date(`${todayKey()}T12:00:00`))
  const [view, setView] = useState<'Month' | 'Week'>('Month')
  const [showCreate, setShowCreate] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CalendarEvent | null>(null)
  const [draft, setDraft] = useState({ title: '', date: todayKey(), time: '09:00', detail: '', kind: 'Meeting' as CalendarEvent['kind'] })
  const [error, setError] = useState('')

  const monthLabel = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const rangeStart = view === 'Month' ? startOfCalendarWeek(new Date(month.getFullYear(), month.getMonth(), 1)) : startOfCalendarWeek(selectedDate)
  const rangeEnd = new Date(rangeStart)
  rangeEnd.setDate(rangeStart.getDate() + 6)
  const weekLabel = `${rangeStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${rangeEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  const monthEventCount = events.filter(event => event.date.startsWith(`${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`)).length
  const visibleDates = Array.from({ length: view === 'Month' ? 42 : 7 }, (_, index) => {
    const date = new Date(rangeStart)
    date.setDate(rangeStart.getDate() + index)
    return date
  })
  const selectedKey = calendarDateKey(selectedDate)
  const selectedEvents = events.filter(event => event.date === selectedKey).sort((a, b) => a.time.localeCompare(b.time))
  const changeMonth = (amount: number) => {
    setMonth(current => new Date(current.getFullYear(), current.getMonth() + amount, 1))
    setSelectedDate(current => {
      const nextMonth = new Date(current.getFullYear(), current.getMonth() + amount, 1)
      const lastDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate()
      return new Date(nextMonth.getFullYear(), nextMonth.getMonth(), Math.min(current.getDate(), lastDay))
    })
  }
  const changePeriod = (amount: number) => {
    if (view === 'Month') { changeMonth(amount); return }
    setSelectedDate(current => {
      const next = new Date(current)
      next.setDate(next.getDate() + amount * 7)
      setMonth(new Date(next.getFullYear(), next.getMonth(), 1))
      return next
    })
  }
  const openCreate = (date = selectedDate) => {
    setEditingId(null)
    setDraft({ title: '', date: calendarDateKey(date), time: '09:00', detail: '', kind: 'Meeting' })
    setError('')
    setShowCreate(true)
  }
  const saveEvent = (event: React.FormEvent) => {
    event.preventDefault()
    if (!draft.title.trim() || !draft.date) { setError('Add an event title and date to continue.'); return }
    const item: CalendarEvent = { ...draft, id: Date.now(), title: draft.title.trim(), detail: draft.detail.trim() || draft.kind }
    setEvents(current => editingId == null ? [...current, item] : current.map(existing => existing.id === editingId ? { ...item, id: editingId } : existing))
    showWorkspaceToast(editingId == null ? 'Calendar event added.' : 'Calendar event updated.')
    const date = new Date(`${draft.date}T12:00:00`)
    setSelectedDate(date)
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1))
    setShowCreate(false)
  }
  const deleteEvent = () => {
    if (!deleteTarget) return
    setEvents(current => current.filter(event => event.id !== deleteTarget.id))
    showWorkspaceToast('Calendar event deleted.')
    setDeleteTarget(null)
  }

  return <div className="directory-page calendar-page">
    <div className="directory-heading"><div><span className="directory-eyebrow">WORKSPACE</span><h1>Calendar</h1><p>Keep client meetings, project milestones, and tasks in view.</p></div><button className="directory-add" onClick={() => openCreate()}><CalendarPlus size={17}/>Add event</button></div>
    <section className="calendar-panel">
      <div className="calendar-toolbar"><div className="calendar-month-controls"><button className="calendar-icon-button" aria-label={view === 'Month' ? 'Previous month' : 'Previous week'} onClick={() => changePeriod(-1)}><ChevronLeft size={17}/></button><button className="calendar-icon-button" aria-label={view === 'Month' ? 'Next month' : 'Next week'} onClick={() => changePeriod(1)}><ChevronRight size={17}/></button><h2>{view === 'Month' ? monthLabel : weekLabel}</h2><button className="calendar-today" onClick={() => { const today = new Date(`${todayKey()}T12:00:00`); setSelectedDate(today); setMonth(new Date(today.getFullYear(), today.getMonth(), 1)) }}>Today</button></div><span className="calendar-event-total">{monthEventCount} scheduled {monthEventCount === 1 ? 'event' : 'events'}</span><div className="calendar-view-toggle" aria-label="Calendar view">{(['Month', 'Week'] as const).map(option => <button key={option} className={view === option ? 'selected' : ''} onClick={() => setView(option)}>{option}</button>)}</div></div>
      <div className="calendar-layout"><div className={`calendar-grid ${view === 'Week' ? 'week-view' : ''}`} role="grid" aria-label={`${monthLabel} ${view.toLowerCase()} view`}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <div className="calendar-weekday" role="columnheader" key={day}>{day}</div>)}
        {visibleDates.map(date => {
          const key = calendarDateKey(date)
          const dayEvents = events.filter(event => event.date === key).slice(0, 3)
          const outsideMonth = view === 'Month' && date.getMonth() !== month.getMonth()
          return <button type="button" role="gridcell" key={key} className={`calendar-day ${outsideMonth ? 'outside' : ''} ${key === selectedKey ? 'selected' : ''}`} onClick={() => { setSelectedDate(date); if (outsideMonth) setMonth(new Date(date.getFullYear(), date.getMonth(), 1)) }} aria-label={`${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}, ${dayEvents.length} events`}>
            <span className="calendar-day-number">{date.getDate()}</span><span className="calendar-day-events">{dayEvents.map(event => <span key={event.id} className={`calendar-event-chip ${event.kind.toLowerCase()}`} title={`${event.time} · ${event.title}`}><i/>{event.title}</span>)}</span>
            {dayEvents.length === 3 && events.filter(event => event.date === key).length > 3 && <small className="calendar-more">+{events.filter(event => event.date === key).length - 3} more</small>}
          </button>
        })}
      </div>
      <aside className="calendar-agenda"><div className="calendar-agenda-heading"><div><span className="directory-eyebrow">AGENDA</span><h3>{selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h3></div><button className="calendar-icon-button" aria-label="Add event on selected day" onClick={() => openCreate(selectedDate)}><Plus size={17}/></button></div>
        {selectedEvents.length ? <div className="calendar-agenda-list">{selectedEvents.map(event => <article className="calendar-agenda-event" key={event.id}><span className={`calendar-event-mark ${event.kind.toLowerCase()}`}/><div><span className="calendar-agenda-time"><Clock size={13}/>{event.time}</span><h4>{event.title}</h4><p>{event.detail}</p><span className={`calendar-kind ${event.kind.toLowerCase()}`}>{event.kind}</span></div>{event.source ? <button type="button" className="calendar-icon-button" aria-label={`Open ${event.source}`} onClick={() => onNavigate?.(event.source!)}><ArrowRight size={14}/></button> : <><button type="button" className="calendar-icon-button" aria-label={`Edit ${event.title}`} onClick={() => { setEditingId(event.id); setDraft({ title: event.title, date: event.date, time: /^\d{2}:\d{2}$/.test(event.time) ? event.time : '09:00', detail: event.detail, kind: event.kind }); setError(''); setShowCreate(true) }}>Edit</button><button type="button" className="calendar-event-delete" aria-label={`Delete ${event.title}`} title="Delete event" onClick={() => setDeleteTarget(event)}><Trash2 size={14}/></button></>}</article>)}</div> : <div className="calendar-empty"><span><CalendarDays size={19}/></span><b>No events scheduled</b><p>Keep this day open or add an event.</p><button onClick={() => openCreate(selectedDate)}>Add event</button></div>}
        <div className="calendar-legend"><span><i className="meeting"/>Meetings</span><span><i className="task"/>Tasks</span><span><i className="project"/>Projects</span><span><i className="lead"/>Leads</span></div>
      </aside></div>
    </section>
    {showCreate && <div className="modal-backdrop calendar-modal-backdrop" onClick={() => setShowCreate(false)}><form className="modal calendar-create-modal" onSubmit={saveEvent} onClick={event => event.stopPropagation()}>
      <div className="modal-head"><div><span className="directory-eyebrow">CALENDAR</span><h2>{editingId == null ? 'Add event' : 'Edit event'}</h2></div><button className="icon-button" type="button" aria-label="Close" onClick={() => setShowCreate(false)}><X size={16}/></button></div>
      <p>Add a meeting, task, or milestone to your calendar.</p>
      <label className="field-label">Event title<input autoFocus required value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} placeholder="e.g. Client kickoff"/></label>
      <div className="field-pair"><label className="field-label">Date<CustomDatePicker value={draft.date} onChange={date => setDraft(current => ({ ...current, date }))}/></label><label className="field-label">Type<CalendarKindSelect value={draft.kind} onChange={kind => setDraft(current => ({ ...current, kind }))}/></label></div>
      <label className="field-label">Time<input type="time" value={draft.time} onChange={event => setDraft(current => ({ ...current, time: event.target.value }))} placeholder="9:00 AM"/></label>
      <label className="field-label">Related client or project<input value={draft.detail} onChange={event => setDraft(current => ({ ...current, detail: event.target.value }))} placeholder="Optional"/></label>
      {error && <p className="calendar-form-error" role="alert">{error}</p>}
      <button className="modal-submit" type="submit">Save event <ArrowRight size={15}/></button>
    </form></div>}
    {deleteTarget && <div className="modal-backdrop calendar-delete-backdrop" onClick={() => setDeleteTarget(null)}><section className="modal calendar-delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="calendar-delete-title" aria-describedby="calendar-delete-description" onClick={event => event.stopPropagation()}><div className="modal-head"><div><span className="directory-eyebrow">CALENDAR</span><h2 id="calendar-delete-title">Delete event?</h2></div><button className="icon-button" type="button" aria-label="Close" onClick={() => setDeleteTarget(null)}><X size={16}/></button></div><p id="calendar-delete-description">Delete “{deleteTarget.title}” from your calendar? This can’t be undone.</p><div className="calendar-delete-actions"><button type="button" className="record-dialog-cancel" onClick={() => setDeleteTarget(null)}>Cancel</button><button type="button" className="calendar-delete-confirm" onClick={deleteEvent}><Trash2 size={14}/>Delete event</button></div></section></div>}
  </div>
}


